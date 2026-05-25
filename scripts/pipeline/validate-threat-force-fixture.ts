#!/usr/bin/env tsx
/**
 * validate-threat-force-fixture.ts
 *
 * Validates that a Pass 1A / Story Ledger artifact captures broadened threat scope:
 * named antagonists AND non-character threat forces.
 *
 * Usage:
 *   npx tsx scripts/pipeline/validate-threat-force-fixture.ts \
 *     --artifact=artifacts/smoke-pass1a/example.json \
 *     --case=river_remembers_blood_ch3
 *
 * Supported input shapes:
 *   1. Smoke output containing characterLedgerV2.threatForceLedger
 *   2. Story layer artifact containing story_layer.threat_antagonist_ending_layer.threat_forces
 *   3. Raw layer object containing threat_forces
 *   4. Pass 1A chunk output containing threat_forces
 */

import { existsSync, readFileSync } from "node:fs";

type Severity = "hard_fail" | "warn" | "pass";

type ValidationIssue = {
  code: string;
  severity: Severity;
  message: string;
};

type ThreatForce = {
  threat_id?: string;
  display_name?: string;
  threat_type?: string;
  character_id?: string | null;
  antagonist_function?: string;
  pressure_function?: string;
  ending_relevance?: string;
  evidence_anchors?: Array<{
    excerpt?: string;
    signal_type?: string;
    confidence?: string;
  }>;
};

type FixtureCase = {
  caseId: string;
  requiredThreatIds: string[];
  requiredNonCharacterThreatIds: string[];
  shouldDetectThreatIds: string[];
  minimumThreatCount: number;
};

const CASES: Record<string, FixtureCase> = {
  river_remembers_blood_ch3: {
    caseId: "river_remembers_blood_ch3",
    requiredThreatIds: [
      "river_judgment_force",
      "trespass_imbalance",
      "missing_man_white_truck",
    ],
    requiredNonCharacterThreatIds: [
      "river_judgment_force",
      "trespass_imbalance",
      "missing_man_white_truck",
    ],
    shouldDetectThreatIds: [
      "cultural_industrial_encroachment",
      "pv115_shadow",
      "predator_balance_logic",
      "belonging_non_belonging",
      "unresolved_ending_pressure",
    ],
    minimumThreatCount: 3,
  },
};

function getArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const eq = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);

  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];

  return fallback;
}

function normalizeThreatId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function readJson(path: string): unknown {
  if (!existsSync(path)) {
    throw new Error(`Artifact not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractThreatForces(payload: unknown): ThreatForce[] {
  const root = asRecord(payload);

  const characterLedgerV2 = asRecord(root.characterLedgerV2);
  const ledgerThreats = asArray(characterLedgerV2.threatForceLedger);
  if (ledgerThreats.length > 0) return ledgerThreats as ThreatForce[];

  const storyLayer = asRecord(root.story_layer);
  const layerFromEnvelope = asRecord(storyLayer.threat_antagonist_ending_layer);
  const envelopeThreats = asArray(layerFromEnvelope.threat_forces);
  if (envelopeThreats.length > 0) return envelopeThreats as ThreatForce[];

  const directLayer = asRecord(root.threat_antagonist_ending_layer);
  const directLayerThreats = asArray(directLayer.threat_forces);
  if (directLayerThreats.length > 0) return directLayerThreats as ThreatForce[];

  const rawThreats = asArray(root.threat_forces);
  if (rawThreats.length > 0) return rawThreats as ThreatForce[];

  const chunks = asArray(root.chunkOutputs);
  if (chunks.length > 0) {
    return chunks.flatMap((chunk) => asArray(asRecord(chunk).threat_forces)) as ThreatForce[];
  }

  const pass1aResult = asRecord(root.pass1a_result);
  const nestedChunks = asArray(pass1aResult.chunkOutputs);
  if (nestedChunks.length > 0) {
    return nestedChunks.flatMap((chunk) => asArray(asRecord(chunk).threat_forces)) as ThreatForce[];
  }

  return [];
}

function hasPressureSignals(payload: unknown): boolean {
  const text = JSON.stringify(payload).toLowerCase();
  const signalTerms = [
    "missing",
    "vanished",
    "disappearance",
    "threat",
    "danger",
    "pressure",
    "judg",
    "belong",
    "river",
    "coyote",
    "predator",
    "police",
    "rcmp",
    "institution",
    "encroachment",
    "industrial",
    "colonial",
    "trespass",
    "poison",
    "imbalance",
    "ending",
    "unresolved",
  ];

  return signalTerms.some((term) => text.includes(term));
}

function validateThreatForces(
  payload: unknown,
  threatForces: ThreatForce[],
  fixture: FixtureCase,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set(
    threatForces.map((threat) => normalizeThreatId(threat.threat_id || threat.display_name)),
  );

  const nonCharacterIds = new Set(
    threatForces
      .filter((threat) => threat.character_id === null || threat.character_id === undefined)
      .map((threat) => normalizeThreatId(threat.threat_id || threat.display_name)),
  );

  if (threatForces.length === 0) {
    issues.push({
      code: "THREAT_FORCE_UNDEREXTRACTED",
      severity: hasPressureSignals(payload) ? "hard_fail" : "warn",
      message:
        "No threat forces were found. Layer 8 must capture pressure systems, not only named antagonists.",
    });
    return issues;
  }

  if (threatForces.length < fixture.minimumThreatCount) {
    issues.push({
      code: "THREAT_FORCE_COUNT_BELOW_MINIMUM",
      severity: "hard_fail",
      message: `Expected at least ${fixture.minimumThreatCount} threat forces, found ${threatForces.length}.`,
    });
  }

  const nonCharacterThreats = threatForces.filter(
    (threat) => threat.character_id === null || threat.character_id === undefined,
  );

  if (nonCharacterThreats.length === 0) {
    issues.push({
      code: "CHARACTER_ONLY_ANTAGONIST_BIAS",
      severity: "hard_fail",
      message:
        "Threat list contains no non-character threat forces. This indicates named-antagonist bias.",
    });
  }

  for (const required of fixture.requiredThreatIds) {
    if (!ids.has(required)) {
      issues.push({
        code: "REQUIRED_THREAT_FORCE_MISSING",
        severity: "hard_fail",
        message: `Missing required threat force: ${required}`,
      });
    }
  }

  for (const requiredNonCharacter of fixture.requiredNonCharacterThreatIds) {
    if (!nonCharacterIds.has(requiredNonCharacter)) {
      issues.push({
        code: "NON_CHARACTER_PRIMARY_THREAT_MISSING",
        severity: "hard_fail",
        message: `Required threat must be represented as non-character with character_id null/undefined: ${requiredNonCharacter}`,
      });
    }
  }

  for (const optional of fixture.shouldDetectThreatIds) {
    if (!ids.has(optional)) {
      issues.push({
        code: "OPTIONAL_THREAT_FORCE_NOT_DETECTED",
        severity: "warn",
        message: `Should-detect threat force not found: ${optional}`,
      });
    }
  }

  for (const threat of threatForces) {
    const id = normalizeThreatId(threat.threat_id || threat.display_name);

    if (!threat.threat_type) {
      issues.push({
        code: "THREAT_TYPE_MISSING",
        severity: "hard_fail",
        message: `Threat ${id || "(unknown)"} is missing threat_type.`,
      });
    }

    if (!threat.pressure_function || threat.pressure_function.trim().length < 20) {
      issues.push({
        code: "PRESSURE_FUNCTION_UNDERDESCRIBED",
        severity: "warn",
        message: `Threat ${id || "(unknown)"} has weak or missing pressure_function.`,
      });
    }

    if (!Array.isArray(threat.evidence_anchors) || threat.evidence_anchors.length === 0) {
      issues.push({
        code: "THREAT_EVIDENCE_MISSING",
        severity: "warn",
        message: `Threat ${id || "(unknown)"} has no evidence anchors.`,
      });
    }
  }

  return issues;
}

function main() {
  const artifactPath = getArg("artifact");
  const caseName = getArg("case", "river_remembers_blood_ch3");

  if (!artifactPath) {
    throw new Error(
      "Missing --artifact path. Example: --artifact=artifacts/smoke-pass1a/example.json",
    );
  }

  const fixture = CASES[caseName ?? ""];
  if (!fixture) {
    throw new Error(
      `Unknown --case=${caseName}. Supported cases: ${Object.keys(CASES).join(", ")}`,
    );
  }

  const payload = readJson(artifactPath);
  const threatForces = extractThreatForces(payload);
  const issues = validateThreatForces(payload, threatForces, fixture);

  const hardFails = issues.filter((issue) => issue.severity === "hard_fail");
  const warnings = issues.filter((issue) => issue.severity === "warn");

  const summary = {
    case_id: fixture.caseId,
    artifact: artifactPath,
    threat_force_count: threatForces.length,
    non_character_threat_count: threatForces.filter(
      (threat) => threat.character_id === null || threat.character_id === undefined,
    ).length,
    hard_fail_count: hardFails.length,
    warning_count: warnings.length,
    detected_threat_ids: threatForces.map((threat) =>
      normalizeThreatId(threat.threat_id || threat.display_name),
    ),
    issues,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (hardFails.length > 0) {
    process.exit(1);
  }
}

main();
