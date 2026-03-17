/**
 * Bridge between EvaluationResultV1 and GovernanceEnvelope.
 *
 * Maps existing evaluation schema to governance envelope format,
 * and wires governance enforcement into the evaluation persistence path.
 */

import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import type { CriterionKey } from "@/schemas/criteria-keys";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  beforePersistEvaluationArtifacts,
  beforeAllowRefinement,
} from "./enforcementHooks";
import {
  evaluateEligibilityGate,
  isRefinementEligible,
} from "./eligibilityGate";
import { GovernanceError } from "./errors";
import type { EvaluationEnvelope, CriterionScore } from "./types";

/**
 * Map EvaluationResultV1 criteria (score_0_10) to GovernanceEnvelope criteria (score 1-10).
 *
 * The existing system uses 0-10 scores; governance layer uses 1-10 integer scores.
 * Conversion: score_0_10 → floor(score_0_10) + 1 to shift to [1..11], clamped to [1..10]
 *
 * Alternatively: use score_0_10 as-is if it's already in the right range.
 * For safety, we treat 0 as invalid and clamp to [1..10].
 */
export function mapEvaluationResultToGovernanceEnvelope(
  evaluation: EvaluationResultV1
): EvaluationEnvelope {
  const criteria = evaluation.criteria.map(
    (criterion): CriterionScore => {
      // Map the existing score (0-10) to governance range (1-10)
      // Treat 0 as 1 (minimum), 10 stays 10
      const score = Math.max(1, Math.min(10, Math.round(criterion.score_0_10)));

      return {
        key: criterion.key as any, // Key mapping happens via type compatibility
        score,
        reasoning: criterion.rationale,
      };
    }
  );

  return {
    id: evaluation.ids?.evaluation_run_id,
    evaluation_run_id: evaluation.ids?.evaluation_run_id,
    criteria,
  };
}

/**
 * Apply governance enforcement to an EvaluationResultV1 before persistence.
 *
 * Calls beforePersistEvaluationArtifacts() to:
 * - Validate criteria envelope (exactly 13 criteria)
 * - Compute weightedCompositeScore
 * - Evaluate eligibility gate
 * - Augment evaluation with gate result and readiness state
 *
 * @throws GovernanceError if governance validation fails
 */
export function applyGovernanceEnforcement(
  evaluation: EvaluationResultV1
): EvaluationResultV1 {
  // Convert to governance envelope
  const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

  // Apply governance enforcement (throws on failure)
  const augmentedEnvelope = beforePersistEvaluationArtifacts(envelope);

  // Augment the original evaluation with governance results
  return {
    ...evaluation,
    // Store governance decision inline
    governance: {
      eligibility_gate: augmentedEnvelope.eligibility_gate || "BLOCK",
      readiness_state: augmentedEnvelope.readiness_state,
      weighted_composite_score: augmentedEnvelope.weighted_composite_score,
    },
  } as any; // Type assertion needed as we're extending the schema
}

/**
 * Check refinement eligibility before allowing proposal/synthesis/apply paths.
 *
 * @throws GovernanceError with code REFINEMENT_BLOCKED_BY_GATE if ineligible
 */
export function checkRefinementEligibility(
  evaluation: EvaluationResultV1
): void {
  const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

  // Add governance metadata if available
  if ((evaluation as any).governance) {
    envelope.eligibility_gate = (evaluation as any).governance.eligibility_gate;
    envelope.readiness_state = (evaluation as any).governance.readiness_state;
  }

  // Hard block if not eligible
  beforeAllowRefinement(envelope);
}

/**
 * Audit helper: extract governance decision from evaluation result.
 */
export function getGovernanceDecision(evaluation: EvaluationResultV1): {
  eligibilityGate: string;
  readinessState?: string;
} {
  const governance = (evaluation as any).governance;
  return {
    eligibilityGate: governance?.eligibility_gate || "(not evaluated)",
    readinessState: governance?.readiness_state,
  };
}

/**
 * Check refinement eligibility via database lookup (for revision engine entry points).
 *
 * Fetches the evaluation artifact for a given evaluation_run_id and checks
 * if refinement is permitted. Throws REFINEMENT_BLOCKED_BY_GATE if not eligible.
 *
 * This is the enforcement point for refinement/proposal/synthesis/apply paths.
 *
 * @throws GovernanceError if evaluation not found, or if eligibility_gate is BLOCK
 */
export async function checkRefinementEligibilityByEvaluationRun(
  supabase: SupabaseClient,
  evaluationRunId: string
): Promise<void> {
  // Fetch the evaluation artifact from database
  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .select("content")
    .eq("job_id", evaluationRunId)
    .eq("artifact_type", "evaluation_result_v1")
    .maybeSingle();

  if (error) {
    throw new GovernanceError(
      `Failed to load evaluation artifact for refinement eligibility check: ${error.message}`,
      "REFINEMENT_BLOCKED_BY_GATE",
      { evaluationRunId, dbError: error.message }
    );
  }

  if (!data?.content) {
    throw new GovernanceError(
      `Evaluation artifact not found for run ${evaluationRunId}. Refinement cannot proceed without prior evaluation.`,
      "REFINEMENT_BLOCKED_BY_GATE",
      { evaluationRunId }
    );
  }

  const evaluation = data.content as EvaluationResultV1;

  // Check refinement eligibility (throws if BLOCK)
  checkRefinementEligibility(evaluation);
}
