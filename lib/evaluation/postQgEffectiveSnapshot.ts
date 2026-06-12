import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { QualityGateV2Result } from '@/lib/evaluation/pipeline/qualityGate';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';

export type PostQgEffectiveSnapshotV1 = {
  schema_version: 'post_qg_effective_snapshot_v1';
  created_at: string;
  source_artifact: 'evaluation_result_v2_candidate';
  qg_status: 'pass' | 'fail';
  qg_normalized: true;
  source_result_hash: string;
  effective_result_hash: string;
  summary: EvaluationResultV2['overview'];
  criteria: Array<{
    key: EvaluationResultV2['criteria'][number]['key'];
    status: EvaluationResultV2['criteria'][number]['status'];
    scorable: boolean;
    score_0_10: number | null;
    model_emitted_score_unverified?: number;
    confidence_band: EvaluationResultV2['criteria'][number]['confidence_band'];
    confidence_level?: EvaluationResultV2['criteria'][number]['confidence_level'];
    confidence_score_0_100?: number;
    confidence_reasons?: string[];
    signal_strength: EvaluationResultV2['criteria'][number]['signal_strength'];
    scorability_status?: EvaluationResultV2['criteria'][number]['scorability_status'];
    rationale: string;
    evidence: EvaluationResultV2['criteria'][number]['evidence'];
    recommendations: EvaluationResultV2['criteria'][number]['recommendations'];
  }>;
  recommendations: EvaluationResultV2['recommendations'];
  opportunities: unknown;
  quality_gate: {
    pass: boolean;
    failed_checks: string[];
    checks: QualityGateV2Result['checks'];
    warnings: string[];
    artifact_gate: QualityGateV2Result['artifactGate'] | null;
  };
  effective_evaluation_result: EvaluationResultV2;
};

export function buildPostQgEffectiveSnapshotV1(params: {
  sourceResult: EvaluationResultV2;
  effectiveResult: EvaluationResultV2;
  qualityGate: QualityGateV2Result;
  createdAt?: string;
}): PostQgEffectiveSnapshotV1 {
  const createdAt = params.createdAt ?? new Date().toISOString();

  return {
    schema_version: 'post_qg_effective_snapshot_v1',
    created_at: createdAt,
    source_artifact: 'evaluation_result_v2_candidate',
    qg_status: params.qualityGate.pass ? 'pass' : 'fail',
    qg_normalized: true,
    source_result_hash: canonicalJsonSha256(params.sourceResult),
    effective_result_hash: canonicalJsonSha256(params.effectiveResult),
    summary: params.effectiveResult.overview,
    criteria: params.effectiveResult.criteria.map((criterion) => ({
      key: criterion.key,
      status: criterion.status,
      scorable: criterion.scorable,
      score_0_10: criterion.score_0_10,
      model_emitted_score_unverified: criterion.model_emitted_score_unverified,
      confidence_band: criterion.confidence_band,
      confidence_level: criterion.confidence_level,
      confidence_score_0_100: criterion.confidence_score_0_100,
      confidence_reasons: criterion.confidence_reasons,
      signal_strength: criterion.signal_strength,
      scorability_status: criterion.scorability_status,
      rationale: criterion.rationale,
      evidence: criterion.evidence,
      recommendations: criterion.recommendations,
    })),
    recommendations: params.effectiveResult.recommendations,
    opportunities: (params.effectiveResult as unknown as { opportunities?: unknown }).opportunities ?? null,
    quality_gate: {
      pass: params.qualityGate.pass,
      failed_checks: params.qualityGate.checks
        .filter((check) => !check.passed)
        .map((check) => check.check_id),
      checks: params.qualityGate.checks,
      warnings: params.qualityGate.warnings ?? [],
      artifact_gate: params.qualityGate.artifactGate ?? null,
    },
    effective_evaluation_result: params.effectiveResult,
  };
}
