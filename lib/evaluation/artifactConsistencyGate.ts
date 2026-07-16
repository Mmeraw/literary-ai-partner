import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import type { CriterionKey } from '@/schemas/criteria-keys';
import { hasGovernedOpportunityCoverage } from '@/lib/evaluation/policy/opportunityDiscoveryPolicy';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import {
  missingBottomWeaknessCriteria,
  summarizePropagationIntegrity,
} from '@/lib/evaluation/pipeline/propagationIntegrity';

export type ArtifactConsistencyGateCheckId =
  | 'summary_criteria_bottom_weakness_alignment'
  | 'recommendation_criterion_traceability';

export type ArtifactConsistencyGateCheck = {
  check_id: ArtifactConsistencyGateCheckId;
  status: 'pass' | 'fail';
  details: string;
  affected_criteria: CriterionKey[];
};

export type ArtifactConsistencyGateV1 = {
  schema_version: 'artifact_consistency_gate_v1';
  created_at: string;
  generated_at: string;
  source_artifact: 'evaluation_result_v2';
  status: 'pass' | 'fail';
  blocking_reasons: string[];
  checked_invariants: ArtifactConsistencyGateCheckId[];
  checks: ArtifactConsistencyGateCheck[];
  source_result_hash: string;
  effective_qg_result_hash: string;
  qg_normalized: true;
};

function criterionHasRecommendation(result: EvaluationResultV2, key: CriterionKey): boolean {
  const criterion = result.criteria.find((item) => item.key === key);
  if (!criterion) return false;

  const hasRec =
    criterion.recommendations?.some((rec) => rec.action.trim().length > 0) ||
    [...result.recommendations.quick_wins, ...result.recommendations.strategic_revisions].some(
      (rec) => rec.criterion_key === key && rec.action.trim().length > 0,
    );

  if (hasRec) return true;

  // ODP: a weak criterion without recommendations is still covered if it carries
  // a governed zero-opportunity status with concrete rationale.
  return hasGovernedOpportunityCoverage({
    score: (criterion as { score_0_10?: number | null }).score_0_10 ?? null,
    meaningfulOpportunityCount: criterion.recommendations?.length ?? 0,
    recommendationStatus: criterion.recommendation_status,
    recommendationStatusRationale: criterion.recommendation_status_rationale,
  });
}

export function evaluateArtifactConsistencyGateV1(
  params: {
    sourceResult: EvaluationResultV2;
    effectiveQGResult: EvaluationResultV2;
  },
): ArtifactConsistencyGateV1 {
  const generatedAt = new Date().toISOString();
  const propagation = summarizePropagationIntegrity(params.effectiveQGResult.criteria);
  const missingWeaknesses = missingBottomWeaknessCriteria(
    params.effectiveQGResult.overview.one_paragraph_summary,
    propagation.bottomScoreCriteria,
  );

  const checks: ArtifactConsistencyGateCheck[] = [
    {
      check_id: 'summary_criteria_bottom_weakness_alignment',
      status: missingWeaknesses.length === 0 ? 'pass' : 'fail',
      details: missingWeaknesses.length === 0
        ? 'Overview summary names all QG-normalized bottom-score weakness criteria.'
        : `Overview summary omits QG-normalized bottom-score weakness criteria: ${missingWeaknesses.join(',')}`,
      affected_criteria: missingWeaknesses,
    },
  ];

  const weakCriteriaWithoutRecommendations = propagation.bottomScoreCriteria.filter(
    (key) => !criterionHasRecommendation(params.effectiveQGResult, key),
  );
  checks.push({
    check_id: 'recommendation_criterion_traceability',
    status: weakCriteriaWithoutRecommendations.length === 0 ? 'pass' : 'fail',
    details: weakCriteriaWithoutRecommendations.length === 0
      ? 'Every QG-normalized bottom-score weakness has at least one traceable recommendation/action.'
      : `QG-normalized bottom-score weaknesses lack traceable recommendations/actions: ${weakCriteriaWithoutRecommendations.join(',')}`,
    affected_criteria: weakCriteriaWithoutRecommendations,
  });

  const blockingReasons = checks
    .filter((check) => check.status === 'fail')
    .map((check) => check.check_id);

  return {
    schema_version: 'artifact_consistency_gate_v1',
    created_at: generatedAt,
    generated_at: generatedAt,
    source_artifact: 'evaluation_result_v2',
    status: blockingReasons.length === 0 ? 'pass' : 'fail',
    blocking_reasons: blockingReasons,
    checked_invariants: checks.map((check) => check.check_id),
    checks,
    source_result_hash: canonicalJsonSha256(params.sourceResult),
    effective_qg_result_hash: canonicalJsonSha256(params.effectiveQGResult),
    qg_normalized: true,
  };
}
