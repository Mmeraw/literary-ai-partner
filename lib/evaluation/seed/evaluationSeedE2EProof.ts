import {
  scoreStoryLedgerQuality,
  validateEvaluationSeedRun,
  type EvaluationMode,
  type EvaluationSeedBenchmarkRun,
  type StoryLedgerGoldExpectation,
  type StoryLedgerQualityScore,
} from './evaluationSeedBenchmark';

export type EvaluationSeedE2EProofRecommendation =
  | 'seed_path_usable'
  | 'seed_path_usable_with_warnings'
  | 'seed_path_blocked_missing_artifacts'
  | 'seed_path_disable';

export type EvaluationSeedE2EProofArtifact = {
  artifact_type: 'evaluation_seed_e2e_proof_v1';
  artifact_version: 'v1';
  job_id: string;
  manuscript_id: number;
  word_count: number;
  evaluation_mode: EvaluationMode;
  seed_run_id: string;
  seed_total_ms: number;
  story_ledger_score: number;
  canonical_identity_score: number;
  alias_accuracy_score: number;
  pov_accuracy_score: number;
  pressure_detection_score: number;
  relationship_accuracy_score: number;
  location_accuracy_score: number;
  evidence_coverage_score: number;
  hallucination_risk_score: number;
  degraded_layers_seed: string[];
  seed_claims_confirmed: number;
  seed_claims_invalidated: number;
  seed_claims_drifted: number;
  seed_only_canon_promotions: number;
  story_ledger_quality: StoryLedgerQualityScore;
  path_issues: string[];
  recommendation: EvaluationSeedE2EProofRecommendation;
};

export type EvaluationSeedE2EProofInput = {
  seed: EvaluationSeedBenchmarkRun;
  gold?: StoryLedgerGoldExpectation;
  minimumLedgerScore?: number;
  minimumEvidenceCoverageScore?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function collectDegradedLayers(ledger: unknown): string[] {
  if (!isRecord(ledger)) return ['accepted_story_ledger_v1_missing'];
  if (Array.isArray(ledger.degraded_layers)) return ledger.degraded_layers.map(String).filter(Boolean);

  const layers = isRecord(ledger.layers) ? ledger.layers : {};
  return Object.entries(layers)
    .filter(([, value]) => isRecord(value) && ['degraded', 'blocked', 'failed'].includes(normalizeText(value.status)))
    .map(([key]) => key);
}

function countSeedClaims(run: EvaluationSeedBenchmarkRun, statuses: string[]): number {
  return [
    ...(run.artifacts.story_map_seed_v1?.claims ?? []),
    ...(run.artifacts.evaluation_seed_v1?.claims ?? []),
  ].filter((claim) => statuses.includes(claim.claim_status)).length;
}

function chooseRecommendation(params: {
  pathIssues: string[];
  quality: StoryLedgerQualityScore;
  minimumLedgerScore: number;
  minimumEvidenceCoverageScore: number;
}): EvaluationSeedE2EProofRecommendation {
  const authorityViolation = params.pathIssues.some((issue) => issue.startsWith('AUTHORITY_VIOLATION'));
  if (authorityViolation || params.quality.seed_only_canon_promotions > 0 || params.quality.hallucination_risk_score < 90) {
    return 'seed_path_disable';
  }

  const missingArtifacts = params.pathIssues.some((issue) => issue.startsWith('MISSING_ARTIFACT'));
  if (missingArtifacts) return 'seed_path_blocked_missing_artifacts';

  if (
    params.quality.total_score >= params.minimumLedgerScore
    && params.quality.evidence_coverage_score >= params.minimumEvidenceCoverageScore
    && params.pathIssues.length === 0
  ) {
    return 'seed_path_usable';
  }

  return 'seed_path_usable_with_warnings';
}

export function buildEvaluationSeedE2EProof(input: EvaluationSeedE2EProofInput): EvaluationSeedE2EProofArtifact {
  const minimumLedgerScore = input.minimumLedgerScore ?? 75;
  const minimumEvidenceCoverageScore = input.minimumEvidenceCoverageScore ?? 80;
  const quality = scoreStoryLedgerQuality(input.seed.artifacts.accepted_story_ledger_v1, input.gold);
  const pathIssues = validateEvaluationSeedRun(input.seed, true);

  return {
    artifact_type: 'evaluation_seed_e2e_proof_v1',
    artifact_version: 'v1',
    job_id: input.seed.job_id,
    manuscript_id: input.seed.manuscript_id,
    word_count: input.seed.word_count,
    evaluation_mode: input.seed.evaluation_mode,
    seed_run_id: input.seed.run_id,
    seed_total_ms: input.seed.total_ms,
    story_ledger_score: quality.total_score,
    canonical_identity_score: quality.canonical_identity_score,
    alias_accuracy_score: quality.alias_accuracy_score,
    pov_accuracy_score: quality.pov_accuracy_score,
    pressure_detection_score: quality.pressure_detection_score,
    relationship_accuracy_score: quality.relationship_accuracy_score,
    location_accuracy_score: quality.location_accuracy_score,
    evidence_coverage_score: quality.evidence_coverage_score,
    hallucination_risk_score: quality.hallucination_risk_score,
    degraded_layers_seed: collectDegradedLayers(input.seed.artifacts.accepted_story_ledger_v1),
    seed_claims_confirmed: countSeedClaims(input.seed, ['confirmed_by_evidence']),
    seed_claims_invalidated: countSeedClaims(input.seed, ['invalidated', 'superseded_by_evidence']),
    seed_claims_drifted: countSeedClaims(input.seed, ['drift_detected']),
    seed_only_canon_promotions: quality.seed_only_canon_promotions,
    story_ledger_quality: quality,
    path_issues: pathIssues,
    recommendation: chooseRecommendation({
      pathIssues,
      quality,
      minimumLedgerScore: round(minimumLedgerScore),
      minimumEvidenceCoverageScore: round(minimumEvidenceCoverageScore),
    }),
  };
}
