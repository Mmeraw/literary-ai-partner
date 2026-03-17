/**
 * Enforcement hooks for governance integration.
 *
 * These hooks are called at critical points in the revision lifecycle:
 * 1. Before persisting evaluation artifacts - augment with eligibility gate result
 * 2. Before enabling refinement - check hard gate and throw if BLOCK
 */

import { GovernanceError } from "./errors";
import { evaluateEligibilityGate, isRefinementEligible } from "./eligibilityGate";
import { validateCriteriaEnvelope } from "./criteriaEnvelope";
import type { EvaluationEnvelope, EligibilityGateResult } from "./types";

/**
 * Pre-persist evaluation hook.
 *
 * Called before writing evaluation_artifacts to the database.
 * Evaluates the eligibility gate and augments the envelope with the result.
 *
 * This is the point where governance enforcement becomes durable.
 *
 * @param envelope The evaluation envelope to augment
 * @returns The augmented envelope with eligibility gate result
 * @throws GovernanceError if validation fails
 */
export function beforePersistEvaluationArtifacts(
  envelope: EvaluationEnvelope
): EvaluationEnvelope {
  // Validate criteria envelope structure
  validateCriteriaEnvelope(envelope);

  // Evaluate the eligibility gate
  const gateResult = evaluateEligibilityGate(envelope);

  // Augment envelope with gate result
  const augmentedEnvelope: EvaluationEnvelope = {
    ...envelope,
    eligibility_gate: gateResult.eligibilityGate,
    readiness_state: gateResult.readinessState,
  };

  return augmentedEnvelope;
}

/**
 * Pre-refinement gate hook.
 *
 * Called before allowing a revision session to enter the refinement path.
 * Checks that the eligibility gate is "PASS"; throws if "BLOCK".
 *
 * This is the hard enforcement point: refinement is not permitted if gate is BLOCK.
 *
 * @param envelope The evaluation envelope to check
 * @throws GovernanceError with code REFINEMENT_BLOCKED_BY_GATE if gate is BLOCK
 */
export function beforeAllowRefinement(envelope: EvaluationEnvelope): void {
  // Validate envelope has been evaluated
  if (!envelope.eligibility_gate) {
    throw new GovernanceError(
      "REFINEMENT_BLOCKED_BY_GATE",
      "Evaluation envelope must have eligibility_gate before refinement",
      {
        envelopeId: envelope.id || "(no id)",
        hasGate: !!envelope.eligibility_gate,
      }
    );
  }

  if (envelope.eligibility_gate === "BLOCK") {
    throw new GovernanceError(
      "REFINEMENT_BLOCKED_BY_GATE",
      `Refinement blocked: eligibility gate is BLOCK (readiness_state: ${envelope.readiness_state || "(unknown)"})`,
      {
        envelopeId: envelope.id,
        eligibilityGate: envelope.eligibility_gate,
        readinessState: envelope.readiness_state,
        reasons: envelope.evaluation_artifacts?.gateReasons || [],
      }
    );
  }
}

/**
 * Pre-applicant-submission hook (informational).
 *
 * Called before allowing a revision to be submitted for market review.
 * This is advisory only (no hard block) but serves as audit point.
 *
 * Returns { permitted: boolean, message?: string }
 */
export function checkMarketReviewEligibility(
  envelope: EvaluationEnvelope
): { permitted: boolean; message?: string } {
  if (!envelope.eligibility_gate) {
    return {
      permitted: false,
      message: "Envelope has not been evaluated for eligibility gate",
    };
  }

  if (envelope.eligibility_gate === "BLOCK") {
    return {
      permitted: false,
      message: `Market review blocked: eligibility gate is BLOCK (readiness: ${envelope.readiness_state})`,
    };
  }

  return {
    permitted: true,
    message: `Eligible for market review (readiness: ${envelope.readiness_state})`,
  };
}

/**
 * Audit hook: returns human-readable governance enforcement summary.
 *
 * Useful for logging, metrics, audit trails.
 */
export function auditGovernanceDecision(
  envelope: EvaluationEnvelope
): {
  envelopeId: string;
  eligibilityGate: string;
  readinessState: string;
  decision: string;
  timestamp: string;
} {
  return {
    envelopeId: envelope.id || "(no id)",
    eligibilityGate: envelope.eligibility_gate || "(not evaluated)",
    readinessState: envelope.readiness_state || "(unknown)",
    decision:
      envelope.eligibility_gate === "PASS"
        ? "ELIGIBLE_FOR_REFINEMENT"
        : "BLOCKED_FROM_REFINEMENT",
    timestamp: new Date().toISOString(),
  };
}
