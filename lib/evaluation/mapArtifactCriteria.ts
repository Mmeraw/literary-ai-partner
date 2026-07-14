import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';

/**
 * Maps EvaluationResultV2 criteria into the criterion shape consumed by the
 * ArtifactGate validator (see lib/evaluation/pipeline/validateEvaluationArtifact.ts).
 *
 * This is the single, shared mapping used by both processor.ts ArtifactGate
 * construction sites (the normal result and the effective/downgraded result),
 * so the two paths cannot drift apart again.
 *
 * `interpretation` is populated from `rationale` (matching the canonical
 * persistence boundary in persistEvaluationResultV2.ts). Emitting an empty
 * interpretation caused the validator to raise INTERP-MISSING-1 → HOLD and
 * withhold submission artifacts on every job that ran through these mappings.
 *
 * NOTE: This helper intentionally preserves the existing processor behavior of
 * passing `score_0_10` through unchanged. The schema permits `score_0_10: null`
 * for non-scorable criteria (NO_SIGNAL / INSUFFICIENT_SIGNAL / NOT_APPLICABLE);
 * the return type is left inferred (`number | null`) rather than declared as
 * CriterionEvaluation[] so the nullable reality is not hidden by the repo's
 * loose (strictNullChecks: false) compiler configuration. The processor-vs-
 * persistence null-score policy difference is out of scope for this mapping fix.
 */
export function mapArtifactCriteria(criteria: EvaluationResultV2['criteria']) {
  return criteria.map((criterion) => ({
    key: criterion.key,
    final_score_0_10: criterion.score_0_10,
    reasoning: criterion.rationale,
    evidence: criterion.evidence
      .map((item) => item.snippet)
      .filter(Boolean)
      .join(' | '),
    interpretation: criterion.rationale,
  }));
}
