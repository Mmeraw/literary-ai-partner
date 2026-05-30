export type EvaluationMode =
  | 'short_form_evaluation'
  | 'long_form_evaluation'
  | 'long_form_multi_layer_evaluation';

export type SeedClaimVerificationStatus =
  | 'proposed_unverified'
  | 'partially_confirmed'
  | 'confirmed_by_evidence'
  | 'drift_detected'
  | 'superseded_by_evidence'
  | 'invalidated';

export type EvaluationSeedBenchmarkRecommendation =
  | 'seed_improves_quality_and_latency'
  | 'seed_improves_quality_but_costs_latency'
  | 'seed_improves_latency_but_hurts_quality'
  | 'seed_no_material_benefit'
  | 'seed_harmful_disable';

type UnknownRecord = Record<string, unknown>;

export type SeedClaim = {
  claim_id: string;
  claim_status: SeedClaimVerificationStatus;
  hypothesis: string;
  temp_seed_entity_id?: string | null;
  criterion_key?: string | null;
  evidence_coordinates?: string[];
};

export type SeedArtifact = {
  artifact_type: 'story_seed_v1' | 'evaluation_seed_v1';
  authority: 'seed_only';
  artifact_status: 'created' | 'superseded' | 'archived' | 'failed';
  claims: SeedClaim[];
};

export type EvaluationSeedRunArtifacts = {
  story_seed_v1?: SeedArtifact;
  evaluation_seed_v1?: SeedArtifact;
  chunk_evidence_index_v1?: unknown;
  accepted_story_ledger_v1?: UnknownRecord;
  pass12_handoff_v1?: unknown;
  evaluation_result_v2?: unknown;
};

export type EvaluationSeedBenchmarkRun = {
  run_id: string;
  job_id: string;
  manuscript_id: number;
  word_count: number;
  evaluation_mode: EvaluationMode;
  total_ms: number;
  phase_ms?: {
    phase0_ms?: number;
    seed_ms?: number;
    extraction_ms?: number;
    reducer_ms?: number;
    review_gate_ready_ms?: number;
    phase2_ms?: number;
    phase3_ms?: number;
    wave_ms?: number;
  };
  artifacts: EvaluationSeedRunArtifacts;
};

export type StoryLedgerGoldExpectation = {
  required_character_ids?: string[];
  required_aliases_by_character_id?: Record<string, string[]>;
  required_pov_character_ids?: string[];
  forbidden_pov_character_ids?: string[];
  required_pressure_needles?: string[];
  required_relationship_pair_keys?: string[];
  required_location_needles?: string[];
};

export type StoryLedgerQualityScore = {
  total_score: number;
  canonical_identity_score: number;
  alias_accuracy_score: number;
  pov_accuracy_score: number;
  pressure_detection_score: number;
  relationship_accuracy_score: number;
  location_accuracy_score: number;
  evidence_coverage_score: number;
  hallucination_risk_score: number;
  seed_only_canon_promotions: number;
  duplicate_canonical_id_count: number;
  duplicate_relationship_pair_count: number;
  missing_required_truths: string[];
  forbidden_failures: string[];
};

export type EvaluationSeedBenchmarkArtifact = {
  artifact_type: 'evaluation_seed_benchmark_v1';
  artifact_version: 'v1';
  job_id: string;
  manuscript_id: number;
  word_count: number;
  evaluation_mode: EvaluationMode;
  baseline_run_id: string;
  seed_run_id: string;
  baseline_total_ms: number;
  seed_total_ms: number;
  latency_delta_ms: number;
  latency_delta_percent: number;
  baseline_story_ledger_score: number;
  seed_story_ledger_score: number;
  ledger_quality_delta: number;
  canonical_identity_delta: number;
  alias_accuracy_delta: number;
  pov_accuracy_delta: number;
  pressure_detection_delta: number;
  evidence_coverage_delta: number;
  hallucination_delta: number;
  degraded_layers_baseline: string[];
  degraded_layers_seed: string[];
  seed_claims_confirmed: number;
  seed_claims_invalidated: number;
  seed_claims_drifted: number;
  seed_only_canon_promotions: number;
  baseline_quality: StoryLedgerQualityScore;
  seed_quality: StoryLedgerQualityScore;
  path_issues: string[];
  recommendation: EvaluationSeedBenchmarkRecommendation;
};

export type EvaluationSeedBenchmarkInput = {
  baseline: EvaluationSeedBenchmarkRun;
  seed: EvaluationSeedBenchmarkRun;
  gold?: StoryLedgerGoldExpectation;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, round(value)));
}

function percent(matched: number, total: number): number {
  if (total <= 0) return 100;
  return clampScore((matched / total) * 100);
}

function arrayFromPath(root: unknown, path: string[]): unknown[] {
  let cursor: unknown = root;
  for (const segment of path) {
    if (!isRecord(cursor)) return [];
    cursor = cursor[segment];
  }
  return Array.isArray(cursor) ? cursor : [];
}

function collectIdentityGroups(ledger: unknown): UnknownRecord[] {
  return arrayFromPath(ledger, ['layers', 'canonical_identity_layer', 'identity_groups']).filter(isRecord);
}

function collectPovCharacters(ledger: unknown): UnknownRecord[] {
  return arrayFromPath(ledger, ['layers', 'pov_structure_layer', 'pov_characters']).filter(isRecord);
}

function collectPressureSystems(ledger: unknown): UnknownRecord[] {
  const pressureSystems = arrayFromPath(ledger, ['layers', 'threat_antagonist_ending_layer', 'pressure_systems']).filter(isRecord);
  return pressureSystems.length > 0
    ? pressureSystems
    : arrayFromPath(ledger, ['layers', 'threat_antagonist_ending_layer', 'threat_systems']).filter(isRecord);
}

function collectRelationshipPairs(ledger: unknown): UnknownRecord[] {
  return arrayFromPath(ledger, ['layers', 'relationship_network_layer', 'relationship_pairs']).filter(isRecord);
}

function collectObjects(ledger: unknown): UnknownRecord[] {
  return arrayFromPath(ledger, ['layers', 'object_symbol_layer', 'objects']).filter(isRecord);
}

function collectLocations(ledger: unknown): string[] {
  return arrayFromPath(ledger, ['layers', 'location_timeline_worldstate_layer', 'unique_locations']).map(String);
}

function canonicalPairKey(a: unknown, b: unknown): string {
  return [String(a ?? ''), String(b ?? '')].sort().join('↔');
}

function objectHasEvidence(value: UnknownRecord): boolean {
  const candidates = [
    value.evidence,
    value.evidence_anchor,
    value.evidence_anchors,
    value.evidence_coordinates,
    value.manuscript_coordinates,
    value.source_coordinates,
    value.location_ref,
  ];

  return candidates.some((candidate) => {
    if (typeof candidate === 'string') return candidate.trim().length > 0;
    if (Array.isArray(candidate)) return candidate.length > 0;
    return false;
  });
}

function collectScoredLedgerEntries(ledger: unknown): UnknownRecord[] {
  return [
    ...collectIdentityGroups(ledger),
    ...collectPovCharacters(ledger),
    ...collectPressureSystems(ledger),
    ...collectRelationshipPairs(ledger),
    ...collectObjects(ledger),
  ];
}

function hasSeedOnlyProvenance(entry: UnknownRecord): boolean {
  return [entry.source, entry.provenance, entry.source_artifact_type, entry.authority]
    .map(normalizeText)
    .some((value) => value === 'seed' || value === 'seed_only' || value.includes('story_seed_v1') || value.includes('evaluation_seed_v1'));
}

function collectSeedOnlyCanonPromotions(ledger: unknown): UnknownRecord[] {
  return collectScoredLedgerEntries(ledger).filter((entry) => hasSeedOnlyProvenance(entry) && !objectHasEvidence(entry));
}

function duplicateCount(values: string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const raw of values) {
    const value = normalizeText(raw);
    if (!value) continue;
    if (seen.has(value)) {
      duplicates += 1;
    } else {
      seen.add(value);
    }
  }
  return duplicates;
}

function getCharacterId(entry: UnknownRecord): string {
  return String(entry.character_id ?? entry.id ?? '').trim();
}

function scoreRequiredCharacters(ledger: unknown, gold: StoryLedgerGoldExpectation, missing: string[]): number {
  const ids = new Set(collectIdentityGroups(ledger).map(getCharacterId));
  const required = gold.required_character_ids ?? [];
  let matched = 0;
  for (const id of required) {
    if (ids.has(id)) {
      matched += 1;
    } else {
      missing.push(`MISSING_REQUIRED_TRUTH: canonical character '${id}' missing.`);
    }
  }
  return percent(matched, required.length);
}

function scoreAliases(ledger: unknown, gold: StoryLedgerGoldExpectation, missing: string[]): number {
  const groups = collectIdentityGroups(ledger);
  let total = 0;
  let matched = 0;
  for (const [characterId, aliases] of Object.entries(gold.required_aliases_by_character_id ?? {})) {
    const group = groups.find((entry) => getCharacterId(entry) === characterId);
    const haystack = JSON.stringify(group ?? {}).toLowerCase();
    for (const alias of aliases) {
      total += 1;
      if (haystack.includes(alias.toLowerCase())) {
        matched += 1;
      } else {
        missing.push(`MISSING_REQUIRED_TRUTH: alias '${alias}' missing for '${characterId}'.`);
      }
    }
  }
  return percent(matched, total);
}

function scorePov(ledger: unknown, gold: StoryLedgerGoldExpectation, missing: string[], forbidden: string[]): number {
  const povIds = new Set(collectPovCharacters(ledger).map(getCharacterId).filter(Boolean));
  const required = gold.required_pov_character_ids ?? [];
  const forbiddenIds = gold.forbidden_pov_character_ids ?? [];
  let matched = 0;

  for (const id of required) {
    if (povIds.has(id)) {
      matched += 1;
    } else {
      missing.push(`MISSING_REQUIRED_TRUTH: POV owner '${id}' missing.`);
    }
  }

  let forbiddenMatches = 0;
  for (const id of forbiddenIds) {
    if (povIds.has(id)) {
      forbiddenMatches += 1;
      forbidden.push(`FORBIDDEN_FAILURE: '${id}' must not be a POV owner.`);
    }
  }

  const penalty = forbiddenIds.length > 0 ? (forbiddenMatches / forbiddenIds.length) * 50 : 0;
  return clampScore(percent(matched, required.length) - penalty);
}

function scorePressure(ledger: unknown, gold: StoryLedgerGoldExpectation, missing: string[]): number {
  const pressureText = JSON.stringify(collectPressureSystems(ledger)).toLowerCase();
  const required = gold.required_pressure_needles ?? [];
  let matched = 0;
  for (const needle of required) {
    if (pressureText.includes(needle.toLowerCase())) {
      matched += 1;
    } else {
      missing.push(`MISSING_REQUIRED_TRUTH: pressure system missing '${needle}'.`);
    }
  }
  return percent(matched, required.length);
}

function scoreRelationships(ledger: unknown, gold: StoryLedgerGoldExpectation, missing: string[], forbidden: string[]): number {
  const pairKeys = collectRelationshipPairs(ledger).map((pair) => canonicalPairKey(pair.character_a, pair.character_b));
  const required = gold.required_relationship_pair_keys ?? [];
  let matched = 0;

  for (const pairKey of required) {
    if (pairKeys.includes(pairKey)) {
      matched += 1;
    } else {
      missing.push(`MISSING_REQUIRED_TRUTH: relationship pair '${pairKey}' missing.`);
    }
  }

  const duplicates = duplicateCount(pairKeys);
  if (duplicates > 0) forbidden.push(`FORBIDDEN_FAILURE: ${duplicates} duplicate relationship canonical pair(s) detected.`);
  return clampScore(percent(matched, required.length) - duplicates * 10);
}

function scoreLocations(ledger: unknown, gold: StoryLedgerGoldExpectation, missing: string[]): number {
  const locations = collectLocations(ledger).map(normalizeText);
  const required = gold.required_location_needles ?? [];
  let matched = 0;
  for (const needle of required) {
    if (locations.some((location) => location.includes(needle.toLowerCase()))) {
      matched += 1;
    } else {
      missing.push(`MISSING_REQUIRED_TRUTH: location '${needle}' missing.`);
    }
  }
  return percent(matched, required.length);
}

function scoreEvidenceCoverage(ledger: unknown): number {
  const entries = collectScoredLedgerEntries(ledger);
  if (entries.length === 0) return 0;
  return percent(entries.filter(objectHasEvidence).length, entries.length);
}

function countSeedClaims(run: EvaluationSeedBenchmarkRun, statuses: SeedClaimVerificationStatus[]): number {
  return [
    ...(run.artifacts.story_seed_v1?.claims ?? []),
    ...(run.artifacts.evaluation_seed_v1?.claims ?? []),
  ].filter((claim) => statuses.includes(claim.claim_status)).length;
}

function collectDegradedLayers(ledger: unknown): string[] {
  if (!isRecord(ledger)) return ['accepted_story_ledger_v1_missing'];
  if (Array.isArray(ledger.degraded_layers)) return ledger.degraded_layers.map(String).filter(Boolean);

  const layers = isRecord(ledger.layers) ? ledger.layers : {};
  return Object.entries(layers)
    .filter(([, value]) => isRecord(value) && ['degraded', 'blocked', 'failed'].includes(normalizeText(value.status)))
    .map(([key]) => key);
}

export function scoreStoryLedgerQuality(ledger: unknown, gold: StoryLedgerGoldExpectation = {}): StoryLedgerQualityScore {
  const missingRequiredTruths: string[] = [];
  const forbiddenFailures: string[] = [];
  const identityGroups = collectIdentityGroups(ledger);
  const relationshipPairs = collectRelationshipPairs(ledger);
  const seedOnlyCanonPromotions = collectSeedOnlyCanonPromotions(ledger).length;
  const duplicateCanonicalIdCount = duplicateCount(identityGroups.map(getCharacterId));
  const duplicateRelationshipPairCount = duplicateCount(
    relationshipPairs.map((pair) => canonicalPairKey(pair.character_a, pair.character_b)),
  );

  if (duplicateCanonicalIdCount > 0) forbiddenFailures.push(`FORBIDDEN_FAILURE: ${duplicateCanonicalIdCount} duplicate canonical character id(s) detected.`);
  if (seedOnlyCanonPromotions > 0) forbiddenFailures.push(`FORBIDDEN_FAILURE: ${seedOnlyCanonPromotions} seed-only canon promotion(s) detected.`);

  const canonicalIdentityScore = scoreRequiredCharacters(ledger, gold, missingRequiredTruths);
  const aliasAccuracyScore = scoreAliases(ledger, gold, missingRequiredTruths);
  const povAccuracyScore = scorePov(ledger, gold, missingRequiredTruths, forbiddenFailures);
  const pressureDetectionScore = scorePressure(ledger, gold, missingRequiredTruths);
  const relationshipAccuracyScore = scoreRelationships(ledger, gold, missingRequiredTruths, forbiddenFailures);
  const locationAccuracyScore = scoreLocations(ledger, gold, missingRequiredTruths);
  const evidenceCoverageScore = scoreEvidenceCoverage(ledger);
  const hallucinationRiskScore = clampScore(100 - forbiddenFailures.length * 8 - seedOnlyCanonPromotions * 15);
  const totalScore =
    canonicalIdentityScore * 0.2
    + aliasAccuracyScore * 0.12
    + povAccuracyScore * 0.15
    + pressureDetectionScore * 0.15
    + relationshipAccuracyScore * 0.1
    + locationAccuracyScore * 0.08
    + evidenceCoverageScore * 0.15
    + hallucinationRiskScore * 0.05;

  return {
    total_score: clampScore(totalScore),
    canonical_identity_score: canonicalIdentityScore,
    alias_accuracy_score: aliasAccuracyScore,
    pov_accuracy_score: povAccuracyScore,
    pressure_detection_score: pressureDetectionScore,
    relationship_accuracy_score: relationshipAccuracyScore,
    location_accuracy_score: locationAccuracyScore,
    evidence_coverage_score: evidenceCoverageScore,
    hallucination_risk_score: hallucinationRiskScore,
    seed_only_canon_promotions: seedOnlyCanonPromotions,
    duplicate_canonical_id_count: duplicateCanonicalIdCount,
    duplicate_relationship_pair_count: duplicateRelationshipPairCount,
    missing_required_truths: missingRequiredTruths,
    forbidden_failures: forbiddenFailures,
  };
}

export function validateEvaluationSeedRun(run: EvaluationSeedBenchmarkRun, seedEnabled: boolean): string[] {
  const issues: string[] = [];
  const artifacts = run.artifacts;

  if (seedEnabled) {
    if (!artifacts.story_seed_v1) issues.push('MISSING_ARTIFACT: story_seed_v1 is required for SEED-enabled run.');
    if (!artifacts.evaluation_seed_v1) issues.push('MISSING_ARTIFACT: evaluation_seed_v1 is required for SEED-enabled run.');
  }

  if (!artifacts.chunk_evidence_index_v1) issues.push('MISSING_ARTIFACT: chunk_evidence_index_v1 is required for E2E comparison.');
  if (!artifacts.accepted_story_ledger_v1) issues.push('MISSING_ARTIFACT: accepted_story_ledger_v1 is required before Phase 2.');
  if (!artifacts.pass12_handoff_v1) issues.push('MISSING_ARTIFACT: pass12_handoff_v1 is required before Phase 3.');
  if (!artifacts.evaluation_result_v2) issues.push('MISSING_ARTIFACT: evaluation_result_v2 is required for completed evaluation.');

  if (artifacts.accepted_story_ledger_v1 && collectSeedOnlyCanonPromotions(artifacts.accepted_story_ledger_v1).length > 0) {
    issues.push('AUTHORITY_VIOLATION: seed-only claim was promoted into accepted_story_ledger_v1 without evidence.');
  }

  return issues;
}

function chooseRecommendation(params: {
  qualityDelta: number;
  latencyDeltaMs: number;
  latencyDeltaPercent: number;
  hallucinationDelta: number;
  seedOnlyCanonPromotions: number;
}): EvaluationSeedBenchmarkRecommendation {
  if (params.seedOnlyCanonPromotions > 0 || params.hallucinationDelta < -5 || params.qualityDelta < -2) return 'seed_harmful_disable';
  if (params.qualityDelta >= 2 && params.latencyDeltaMs <= 0) return 'seed_improves_quality_and_latency';
  if (params.qualityDelta >= 2 && params.latencyDeltaPercent <= 25) return 'seed_improves_quality_but_costs_latency';
  if (params.latencyDeltaMs < 0 && params.qualityDelta < 0) return 'seed_improves_latency_but_hurts_quality';
  return 'seed_no_material_benefit';
}

export function buildEvaluationSeedBenchmark(input: EvaluationSeedBenchmarkInput): EvaluationSeedBenchmarkArtifact {
  const baselineQuality = scoreStoryLedgerQuality(input.baseline.artifacts.accepted_story_ledger_v1, input.gold);
  const seedQuality = scoreStoryLedgerQuality(input.seed.artifacts.accepted_story_ledger_v1, input.gold);
  const latencyDeltaMs = input.seed.total_ms - input.baseline.total_ms;
  const latencyDeltaPercent = input.baseline.total_ms > 0 ? round((latencyDeltaMs / input.baseline.total_ms) * 100) : 0;
  const ledgerQualityDelta = round(seedQuality.total_score - baselineQuality.total_score);
  const hallucinationDelta = round(seedQuality.hallucination_risk_score - baselineQuality.hallucination_risk_score);
  const seedOnlyCanonPromotions = seedQuality.seed_only_canon_promotions;

  return {
    artifact_type: 'evaluation_seed_benchmark_v1',
    artifact_version: 'v1',
    job_id: input.seed.job_id,
    manuscript_id: input.seed.manuscript_id,
    word_count: input.seed.word_count,
    evaluation_mode: input.seed.evaluation_mode,
    baseline_run_id: input.baseline.run_id,
    seed_run_id: input.seed.run_id,
    baseline_total_ms: input.baseline.total_ms,
    seed_total_ms: input.seed.total_ms,
    latency_delta_ms: latencyDeltaMs,
    latency_delta_percent: latencyDeltaPercent,
    baseline_story_ledger_score: baselineQuality.total_score,
    seed_story_ledger_score: seedQuality.total_score,
    ledger_quality_delta: ledgerQualityDelta,
    canonical_identity_delta: round(seedQuality.canonical_identity_score - baselineQuality.canonical_identity_score),
    alias_accuracy_delta: round(seedQuality.alias_accuracy_score - baselineQuality.alias_accuracy_score),
    pov_accuracy_delta: round(seedQuality.pov_accuracy_score - baselineQuality.pov_accuracy_score),
    pressure_detection_delta: round(seedQuality.pressure_detection_score - baselineQuality.pressure_detection_score),
    evidence_coverage_delta: round(seedQuality.evidence_coverage_score - baselineQuality.evidence_coverage_score),
    hallucination_delta: hallucinationDelta,
    degraded_layers_baseline: collectDegradedLayers(input.baseline.artifacts.accepted_story_ledger_v1),
    degraded_layers_seed: collectDegradedLayers(input.seed.artifacts.accepted_story_ledger_v1),
    seed_claims_confirmed: countSeedClaims(input.seed, ['confirmed_by_evidence']),
    seed_claims_invalidated: countSeedClaims(input.seed, ['invalidated', 'superseded_by_evidence']),
    seed_claims_drifted: countSeedClaims(input.seed, ['drift_detected']),
    seed_only_canon_promotions: seedOnlyCanonPromotions,
    baseline_quality: baselineQuality,
    seed_quality: seedQuality,
    path_issues: [...validateEvaluationSeedRun(input.baseline, false), ...validateEvaluationSeedRun(input.seed, true)],
    recommendation: chooseRecommendation({
      qualityDelta: ledgerQualityDelta,
      latencyDeltaMs,
      latencyDeltaPercent,
      hallucinationDelta,
      seedOnlyCanonPromotions,
    }),
  };
}
