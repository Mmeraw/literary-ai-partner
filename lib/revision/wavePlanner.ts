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

export function deriveWaveTargetsFromFindings(findings: Record<string, unknown>): number[] {
  const tokens = new Set<string>();
  collectStringTokens(findings, tokens);

  const matchedWaveIds = new Set<number>();
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