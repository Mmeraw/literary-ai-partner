/**
 * Bridge between EvaluationResultV1 and GovernanceEnvelope.
 *
 * Maps existing evaluation schema to governance envelope format,
 * and wires governance enforcement into the evaluation persistence path.
 *
 * The bridge is responsible for:
 * 1. Translating EvaluationResultV1 criterion keys to canonical governance keys
 * 2. Converting 0-10 scores to 1-10 integer band
 * 3. Rejecting unknown criterion keys (fail-closed)
 */

import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
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
import type { CriterionKey } from "./canonicalCriteria";

/**
 * Explicit mapping from EvaluationResultV1 criterion keys to canonical governance keys.
 *
 * This is the bridge point where the existing evaluation schema is translated
 * to the governance layer's canonical keys. No "as any" casts allowed here.
 *
 * Source system keys (lowercase) → Governance canonical keys (UPPERCASE)
 *
 * EvaluationResultV1 uses lowercase camelCase keys like:
 * - concept, narrativeDrive, character, voice, sceneConstruction, dialogue, theme,
 *   worldbuilding, pacing, proseControl, tone, narrativeClosure, marketability
 *
 * Governance canonical keys are UPPERCASE like:
 * - CONCEPT, MOMENTUM, CHARACTER, POVVOICE, SCENE, DIALOGUE, THEME, WORLD,
 *   PACING, PROSE, TONE, CLOSURE, MARKET
 */
const EVALUATION_TO_GOVERNANCE_KEY_MAP: Record<string, CriterionKey> = {
  // EvaluationResultV1 key → Governance canonical key (with type safety)
  concept: "CONCEPT" as CriterionKey,
  narrativeDrive: "MOMENTUM" as CriterionKey,
  character: "CHARACTER" as CriterionKey,
  voice: "POVVOICE" as CriterionKey,
  sceneConstruction: "SCENE" as CriterionKey,
  dialogue: "DIALOGUE" as CriterionKey,
  theme: "THEME" as CriterionKey,
  worldbuilding: "WORLD" as CriterionKey,
  pacing: "PACING" as CriterionKey,
  proseControl: "PROSE" as CriterionKey,
  tone: "TONE" as CriterionKey,
  narrativeClosure: "CLOSURE" as CriterionKey,
  marketability: "MARKET" as CriterionKey,
};

/**
 * Translate a criterion key from EvaluationResultV1 to canonical governance key.
 *
 * Throws GovernanceError if the key is unknown (fail-closed).
 *
 * @throws GovernanceError with code CRITERIA_SCHEMA_VIOLATION if key not recognized
 */
function translateCriterionKey(incomingKey: unknown): CriterionKey {
  if (typeof incomingKey !== "string") {
    throw new GovernanceError(
      `Criterion key must be a string, got ${typeof incomingKey}`,
      "CRITERIA_SCHEMA_VIOLATION",
      { receivedKey: incomingKey, receivedType: typeof incomingKey }
    );
  }

  const canonicalKey = EVALUATION_TO_GOVERNANCE_KEY_MAP[incomingKey];
  if (!canonicalKey) {
    throw new GovernanceError(
      `Unknown criterion key from evaluation: "${incomingKey}". No mapping to governance canonical key.`,
      "CRITERIA_SCHEMA_VIOLATION",
      {
        unknownKey: incomingKey,
        knownKeys: Object.keys(EVALUATION_TO_GOVERNANCE_KEY_MAP),
      }
    );
  }

  return canonicalKey;
}

/**
 * Map EvaluationResultV1 criteria to GovernanceEnvelope criteria.
 *
 * Translations:
 * - Criterion keys: EvaluationResultV1 keys → canonical governance keys (via explicit map, throws on unknown)
 * - Scores: 0-10 band → 1-10 band (0 becomes 1, 10 stays 10)
 *
 * @throws GovernanceError if any criterion key is unknown
 */
export function mapEvaluationResultToGovernanceEnvelope(
  evaluation: EvaluationResultV1
): EvaluationEnvelope {
  const criteria = evaluation.criteria.map(
    (criterion): CriterionScore => {
      // Translate criterion key, throws on unknown (fail-closed)
      const canonicalKey = translateCriterionKey(criterion.key);

      // Convert score from 0-10 band to 1-10 band
      // 0 → 1 (minimum), 10 → 10 (maximum)
      const score = Math.max(1, Math.min(10, Math.round(criterion.score_0_10)));

      return {
        key: canonicalKey,
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
 * Map EvaluationResultV2 criteria to GovernanceEnvelope criteria.
 *
 * v2 rule:
 * - Only SCORABLE criteria are projected into governance numeric envelope.
 * - Non-scorable criteria are intentionally excluded (no null→0 or null→1 coercion).
 */
export function mapEvaluationResultV2ToGovernanceEnvelope(
  evaluation: EvaluationResultV2,
): EvaluationEnvelope {
  const criteria = evaluation.criteria
    .filter((criterion) => criterion.status === "SCORABLE")
    .map((criterion): CriterionScore => {
      const canonicalKey = translateCriterionKey(criterion.key);

      // v2 SCORABLE criteria already guarantee numeric 0-10; preserve existing
      // governance band conversion behavior for numeric projection only.
      const score = Math.max(1, Math.min(10, Math.round(criterion.score_0_10)));

      return {
        key: canonicalKey,
        score,
        reasoning: criterion.rationale,
      };
    });

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
    .select("content, artifact_type, created_at")
    .eq("job_id", evaluationRunId)
    .in("artifact_type", ["evaluation_result_v2", "evaluation_result_v1"])
    .order("created_at", { ascending: false })
    .limit(1)
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

  const artifactType = (data as any).artifact_type as string | undefined;
  const contentRecord = (data as any).content as { schema_version?: string } | undefined;
  const isV2Artifact =
    artifactType === "evaluation_result_v2" || contentRecord?.schema_version === "evaluation_result_v2";

  if (isV2Artifact) {
    const evaluationV2 = data.content as EvaluationResultV2;
    const envelope = mapEvaluationResultV2ToGovernanceEnvelope(evaluationV2);
    const gateResult = evaluateEligibilityGate(envelope);

    if (!isRefinementEligible(gateResult)) {
      throw new GovernanceError(
        `Refinement blocked: eligibility gate is ${gateResult.eligibilityGate} (readiness_state: ${gateResult.readinessState})`,
        "REFINEMENT_BLOCKED_BY_GATE",
        {
          evaluationRunId,
          artifactType,
          eligibilityGate: gateResult.eligibilityGate,
          readinessState: gateResult.readinessState,
          reasons: gateResult.reasons,
        }
      );
    }

    return;
  }

  const evaluation = data.content as EvaluationResultV1;

  // Check refinement eligibility (throws if BLOCK)
  checkRefinementEligibility(evaluation);
}
