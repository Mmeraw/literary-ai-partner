import {
  type WaveEntry,
  type WaveScope,
  getWave,
  getWavesByPass,
  WAVE_REGISTRY,
} from "./waveRegistry";
import {
  buildExecutionPlan,
  resolveConflicts,
  type ConflictReport,
} from "./waveConflicts";

export type RevisionMode = "surgical" | "standard" | "deep";

export type WavePlan = {
  orderedWaveIds: number[];
  conflictReport: ConflictReport;
  estimatedEditCount: number;
  scopeBreakdown: Record<WaveScope, number[]>;
  passBreakdown: Record<1 | 2 | 3, number[]>;
  surgicalConstraints: { blockedWaves: number[]; reason: string }[];
};

const VALID_WAVE_IDS = new Set<number>(WAVE_REGISTRY.map((wave) => wave.id));
const SURGICAL_SCOPE_ALLOWLIST = new Set<WaveScope>(["sentence", "paragraph"]);

function normalizeWaveIds(ids: number[]): number[] {
  const seen = new Set<number>();
  const normalized: number[] = [];

  for (const id of ids) {
    if (!Number.isInteger(id) || seen.has(id) || !VALID_WAVE_IDS.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeCriterionKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function collectStringTokens(input: unknown, collector: Set<string>): void {
  if (typeof input === "string") {
    collector.add(normalizeCriterionKey(input));
    return;
  }

  if (Array.isArray(input)) {
    for (const value of input) {
      collectStringTokens(value, collector);
    }
    return;
  }

  const record = asRecord(input);
  if (!record) {
    return;
  }

  for (const [key, value] of Object.entries(record)) {
    collector.add(normalizeCriterionKey(key));
    collectStringTokens(value, collector);
  }
}

function getWaveMap(ids: readonly number[]): Map<number, WaveEntry> {
  const map = new Map<number, WaveEntry>();
  for (const id of ids) {
    const wave = getWave(id);
    if (wave) {
      map.set(id, wave);
    }
  }
  return map;
}

function estimateEditCount(waves: readonly WaveEntry[]): number {
  let estimate = 0;

  for (const wave of waves) {
    const baseUnit =
      wave.scope === "sentence"
        ? 1
        : wave.scope === "paragraph"
          ? 3
          : wave.scope === "scene"
            ? 8
            : 12;
    const radiusFactor = Math.max(1, Math.ceil(wave.maxEditRadiusSentences / 6));
    estimate += Math.max(1, Math.round((baseUnit + radiusFactor) / 2));
  }

  return estimate;
}

function buildScopeBreakdown(orderedWaveIds: readonly number[]): Record<WaveScope, number[]> {
  const breakdown: Record<WaveScope, number[]> = {
    sentence: [],
    paragraph: [],
    scene: [],
    chapter: [],
  };

  for (const waveId of orderedWaveIds) {
    const wave = getWave(waveId);
    if (!wave) {
      continue;
    }
    breakdown[wave.scope].push(waveId);
  }

  return breakdown;
}

function buildPassBreakdown(orderedWaveIds: readonly number[]): Record<1 | 2 | 3, number[]> {
  const orderedSet = new Set<number>(orderedWaveIds);
  const pass1 = new Set<number>(getWavesByPass(1).map((wave) => wave.id));
  const pass2 = new Set<number>(getWavesByPass(2).map((wave) => wave.id));
  const pass3 = new Set<number>(getWavesByPass(3).map((wave) => wave.id));

  const breakdown: Record<1 | 2 | 3, number[]> = {
    1: [],
    2: [],
    3: [],
  };

  for (const waveId of orderedWaveIds) {
    if (!orderedSet.has(waveId)) {
      continue;
    }
    if (pass1.has(waveId)) {
      breakdown[1].push(waveId);
    } else if (pass2.has(waveId)) {
      breakdown[2].push(waveId);
    } else if (pass3.has(waveId)) {
      breakdown[3].push(waveId);
    }
  }

  return breakdown;
}

export function planWaves(
  targetWaveIds: number[],
  revisionMode: RevisionMode,
  passFindings: { pass1?: unknown; pass2?: unknown; pass3?: unknown },
): WavePlan {
  const derivedFromPass1 = deriveWaveTargetsFromFindings(asRecord(passFindings.pass1) ?? {});
  const derivedFromPass2 = deriveWaveTargetsFromFindings(asRecord(passFindings.pass2) ?? {});
  const derivedFromPass3 = deriveWaveTargetsFromFindings(asRecord(passFindings.pass3) ?? {});

  const normalizedTargets = normalizeWaveIds([
    ...targetWaveIds,
    ...derivedFromPass1,
    ...derivedFromPass2,
    ...derivedFromPass3,
  ]);

  const baseReport = resolveConflicts(normalizedTargets, revisionMode);
  const blocked = new Set<number>([...baseReport.suppressedWaves, ...baseReport.deferredWaves]);

  const surgicalConstraints: { blockedWaves: number[]; reason: string }[] = [];
  const extraDeferred = new Set<number>();

  if (revisionMode === "surgical") {
    const scopeBlocked: number[] = [];

    for (const waveId of normalizedTargets) {
      if (blocked.has(waveId)) {
        continue;
      }
      const wave = getWave(waveId);
      if (!wave) {
        continue;
      }

      if (!SURGICAL_SCOPE_ALLOWLIST.has(wave.scope)) {
        blocked.add(waveId);
        extraDeferred.add(waveId);
        scopeBlocked.push(waveId);
      }
    }

    if (scopeBlocked.length > 0) {
      surgicalConstraints.push({
        blockedWaves: scopeBlocked.sort((a, b) => a - b),
        reason: "Surgical mode enforces sentence/paragraph-only execution scopes.",
      });
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const waveId of normalizedTargets) {
      if (blocked.has(waveId)) {
        continue;
      }

      const wave = getWave(waveId);
      if (!wave) {
        continue;
      }

      const missing = wave.dependencies.filter((dependencyId) => !blocked.has(dependencyId) && !normalizedTargets.includes(dependencyId));
      const blockedDependency = wave.dependencies.find((dependencyId) => blocked.has(dependencyId));

      if (missing.length > 0 || blockedDependency !== undefined) {
        blocked.add(waveId);
        extraDeferred.add(waveId);
        changed = true;
      }
    }
  }

  const enrichedReport: ConflictReport = {
    resolvedPairs: [
      ...baseReport.resolvedPairs,
      ...[...extraDeferred].map((waveId) => ({
        waveId,
        conflictingWaveId: -1,
        resolution: "defer" as const,
        reason:
          revisionMode === "surgical"
            ? "Deferred after surgical constraints removed required scope/dependency context."
            : "Deferred due to planner-level dependency constraints.",
        priority: getWave(waveId)?.priority ?? 0,
      })),
    ],
    suppressedWaves: [...new Set(baseReport.suppressedWaves)].sort((a, b) => a - b),
    deferredWaves: [...new Set([...baseReport.deferredWaves, ...extraDeferred])].sort((a, b) => a - b),
    mergedGroups: baseReport.mergedGroups,
  };

  const candidateWaveIds = normalizedTargets.filter(
    (waveId) =>
      !enrichedReport.suppressedWaves.includes(waveId) &&
      !enrichedReport.deferredWaves.includes(waveId),
  );

  const orderedWaveIds = buildExecutionPlan(candidateWaveIds, revisionMode).filter((waveId) =>
    candidateWaveIds.includes(waveId),
  );

  const waveMap = getWaveMap(orderedWaveIds);
  const orderedWaves = orderedWaveIds
    .map((waveId) => waveMap.get(waveId))
    .filter((wave): wave is WaveEntry => wave !== undefined);

  return {
    orderedWaveIds,
    conflictReport: enrichedReport,
    estimatedEditCount: estimateEditCount(orderedWaves),
    scopeBreakdown: buildScopeBreakdown(orderedWaveIds),
    passBreakdown: buildPassBreakdown(orderedWaveIds),
    surgicalConstraints,
  };
}

/**
 * Bridge from the 13 canonical evaluation criterion keys to wave IDs.
 *
 * The wave registry uses its own internal criterionIds (e.g. STRUCTURE_SPINE,
 * CLIMAX_CAUSALITY) that never appear in Pass 3 synthesis output. Pass 3 uses
 * the 13 canonical keys (concept, narrativeDrive, etc.). Without this bridge,
 * deriveWaveTargetsFromFindings returns zero matches for every evaluation —
 * the token sets are completely disjoint.
 *
 * Mapping strategy:
 *   - Structural/low-scoring criteria → structural + momentum waves
 *   - Mid-scoring criteria → targeted craft waves
 *   - High-scoring criteria → polish + continuity waves (still need checking)
 *
 * The wave IDs here mirror WAVE_CRITERION_FALLBACK_IDS in waveRevision.ts but
 * are the PRIMARY derivation path, not a fallback.
 */
const CANONICAL_CRITERION_WAVE_BRIDGE: Record<string, number[]> = {
  concept:           [1, 2, 9, 10],
  narrativeDrive:    [2, 3, 7, 31, 32, 36],
  character:         [15, 16, 17, 18, 19, 20],
  voice:             [5, 11, 12, 13, 14],
  sceneConstruction: [2, 3, 4, 42, 43, 44],
  dialogue:          [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  theme:             [1, 9, 10, 31],
  worldbuilding:     [4, 39, 45, 46, 47, 48, 49],
  pacing:            [7, 31, 32, 33, 34, 35],
  proseControl:      [33, 34, 36, 37, 38, 39, 40, 51, 52, 53, 54, 55, 56, 57, 58, 60],
  tone:              [11, 13, 14, 41, 48],
  narrativeClosure:  [5, 6, 9, 10, 31, 44, 50, 59],
  marketability:     [1, 2, 6, 51, 59, 60, 61, 62],
};

/**
 * Polish/continuity waves applied to high-scoring criteria (8+).
 * Even a score of 10 benefits from continuity audits and final polish.
 */
const HIGH_SCORE_POLISH_WAVE_IDS: Record<string, number[]> = {
  concept:           [59, 60],
  narrativeDrive:    [31, 59],
  character:         [18, 48],
  voice:             [14, 55],
  sceneConstruction: [43, 44, 50],
  dialogue:          [29, 30],
  theme:             [9, 50],
  worldbuilding:     [45, 49],
  pacing:            [33, 35],
  proseControl:      [51, 55, 56, 57, 58, 60],
  tone:              [14, 48, 55],
  narrativeClosure:  [50, 59],
  marketability:     [59, 60, 61],
};

function extractCriteriaFromFindings(findings: Record<string, unknown>): Array<{ key: string; score: number }> {
  const criteria = findings.criteria;
  if (!Array.isArray(criteria)) return [];
  return criteria
    .map((c) => {
      const rec = asRecord(c);
      if (!rec) return null;
      const key = typeof rec.key === 'string' ? rec.key : null;
      const score = typeof rec.final_score_0_10 === 'number' ? rec.final_score_0_10 : null;
      if (!key || score === null) return null;
      return { key, score };
    })
    .filter((c): c is { key: string; score: number } => c !== null);
}

export function deriveWaveTargetsFromFindings(findings: Record<string, unknown>): number[] {
  const tokens = new Set<string>();
  collectStringTokens(findings, tokens);

  const matchedWaveIds = new Set<number>();

  // Strategy 1: Match wave registry criterionIds against all string tokens in findings.
  // This catches cases where findings contain registry-native IDs like "STRUCTURE_SPINE".
  for (const wave of WAVE_REGISTRY) {
    const normalizedCriteria = wave.criterionIds.map((criterionId) => normalizeCriterionKey(criterionId));
    if (normalizedCriteria.some((criterionId) => tokens.has(criterionId))) {
      matchedWaveIds.add(wave.id);
      continue;
    }

    if (tokens.has(normalizeCriterionKey(wave.name)) || tokens.has(String(wave.id))) {
      matchedWaveIds.add(wave.id);
    }
  }

  // Strategy 2: Bridge the 13 canonical evaluation criterion keys to wave IDs.
  // Pass 3 findings use canonical keys (concept, narrativeDrive, etc.) that do NOT
  // appear in any wave's criterionIds — without this bridge, zero waves match.
  //
  // Score-aware selection:
  //   ≤ 7  → full structural bridge (needs real revision work)
  //   8-9  → polish + continuity waves only (strong but can be tightened)
  //   10   → continuity audit waves only (verify nothing was missed)
  const criteriaEntries = extractCriteriaFromFindings(findings);
  for (const { key, score } of criteriaEntries) {
    if (score <= 7) {
      // Criteria needing revision: fire the full structural bridge
      const bridgeIds = CANONICAL_CRITERION_WAVE_BRIDGE[key];
      if (bridgeIds) {
        for (const id of bridgeIds) {
          if (VALID_WAVE_IDS.has(id)) matchedWaveIds.add(id);
        }
      }
    }

    // All criteria scoring ≤ 9 get polish/continuity waves
    if (score <= 9) {
      const polishIds = HIGH_SCORE_POLISH_WAVE_IDS[key];
      if (polishIds) {
        for (const id of polishIds) {
          if (VALID_WAVE_IDS.has(id)) matchedWaveIds.add(id);
        }
      }
    }

    // Score 10 criteria: only continuity audit (wave 59 = Final Consistency, 60 = Hook Alignment)
    if (score === 10) {
      for (const id of [59, 60]) {
        if (VALID_WAVE_IDS.has(id)) matchedWaveIds.add(id);
      }
    }
  }

  return [...matchedWaveIds].sort((a, b) => a - b);
}

export function validatePlan(plan: WavePlan): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const ordered = plan.orderedWaveIds;
  const orderedSet = new Set<number>(ordered);

  if (ordered.length !== orderedSet.size) {
    violations.push("Ordered plan contains duplicate wave IDs.");
  }

  for (const waveId of ordered) {
    const wave = getWave(waveId);
    if (!wave) {
      violations.push(`Plan contains unknown wave ID: ${waveId}.`);
      continue;
    }

    for (const dependencyId of wave.dependencies) {
      if (!orderedSet.has(dependencyId)) {
        violations.push(`Wave ${waveId} missing dependency ${dependencyId} in ordered plan.`);
        continue;
      }

      if (ordered.indexOf(dependencyId) > ordered.indexOf(waveId)) {
        violations.push(`Wave ${waveId} appears before dependency ${dependencyId}.`);
      }
    }
  }

  const blocked = new Set<number>([
    ...plan.conflictReport.suppressedWaves,
    ...plan.conflictReport.deferredWaves,
  ]);
  for (const waveId of ordered) {
    if (blocked.has(waveId)) {
      violations.push(`Wave ${waveId} is both ordered and blocked in conflict report.`);
    }
  }

  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const a = getWave(ordered[i]);
      const b = getWave(ordered[j]);
      if (!a || !b) {
        continue;
      }

      if (a.conflicts.includes(b.id) || b.conflicts.includes(a.id)) {
        violations.push(`Mutually conflicting waves present in ordered plan: ${a.id} and ${b.id}.`);
      }
    }
  }

  const allScopeIds = new Set<number>([
    ...plan.scopeBreakdown.sentence,
    ...plan.scopeBreakdown.paragraph,
    ...plan.scopeBreakdown.scene,
    ...plan.scopeBreakdown.chapter,
  ]);
  if (allScopeIds.size !== orderedSet.size) {
    violations.push("Scope breakdown does not exactly match ordered wave IDs.");
  }

  const allPassIds = new Set<number>([
    ...plan.passBreakdown[1],
    ...plan.passBreakdown[2],
    ...plan.passBreakdown[3],
  ]);
  if (allPassIds.size !== orderedSet.size) {
    violations.push("Pass breakdown does not exactly match ordered wave IDs.");
  }

  for (const [pass, ids] of Object.entries(plan.passBreakdown) as Array<["1" | "2" | "3", number[]]>) {
    for (const waveId of ids) {
      const wave = getWave(waveId);
      if (!wave) {
        continue;
      }
      if (String(wave.passSource) !== pass) {
        violations.push(`Wave ${waveId} is listed under pass ${pass} but belongs to pass ${wave.passSource}.`);
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}