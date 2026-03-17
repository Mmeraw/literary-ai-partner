/**
 * Eligibility gate evaluation (Volume II-A governance).
 *
 * Determines whether a revision is eligible for agent refinement based on:
 * 1. Structural criteria readiness (6 of 13 must meet threshold)
 * 2. Weighted composite score (WCS) bands determine readiness state
 * 3. REFINEMENT_ELIGIBLE state or better is required for refinement
 */

import {
  STRUCTURAL_CRITERIA,
  CRITERION_WEIGHT_MAP,
} from "./canonicalCriteria";
import { GovernanceError } from "./errors";
import {
  computeWeightedCompositeScore,
  validateCriteriaEnvelope,
} from "./criteriaEnvelope";
import type { EvaluationEnvelope, EligibilityGateResult, ReadinessState } from "./types";

// Volume II-A Constants (locked from source doctrine)
export const WAVE_ELIGIBILITY_MIN_WCS = 7.0; // Minimum WCS for any refinement path
export const STRUCTURAL_FAIL_THRESHOLD = 5; // Min structural criteria meeting 60% of their weight threshold
export const AGENT_READY_WCS = 8.5; // WCS threshold for AGENT_READY state
export const MARKET_REVIEW_TRIGGER = 6; // WCS threshold for market review consideration

/**
 * Evaluates the eligibility gate for a revision session.
 *
 * Returns a result with eligibility_gate ("PASS" | "BLOCK") and readiness_state.
 *
 * @throws GovernanceError if envelope validation fails
 */
export function evaluateEligibilityGate(
  envelope: EvaluationEnvelope
): EligibilityGateResult {
  // Validate envelope structure (exactly 13 criteria, scores in [1..10])
  validateCriteriaEnvelope(envelope);

  const wcs = computeWeightedCompositeScore(envelope);
  const reasons: string[] = [];

  // Check structural readiness
  const structuralReadiness = checkStructuralReadiness(envelope);
  if (!structuralReadiness.passed) {
    reasons.push(`Structural readiness check failed: ${structuralReadiness.failureReason}`);
  }

  // Determine readiness state from WCS band
  const readinessState = determineReadinessState(wcs);

  // Determine eligibility gate decision
  let eligibilityGate: "PASS" | "BLOCK" = "BLOCK";
  let gateDecision = "";

  // Gate logic:
  // - If WCS < 7.0: always BLOCK (insufficient minimum)
  // - If structural check fails: BLOCK
  // - If readiness_state is FOUNDATIONAL or DEVELOPING: BLOCK
  // - Otherwise: PASS

  if (wcs < WAVE_ELIGIBILITY_MIN_WCS) {
    gateDecision = `WCS (${wcs.toFixed(2)}) below minimum (${WAVE_ELIGIBILITY_MIN_WCS})`;
    eligibilityGate = "BLOCK";
  } else if (!structuralReadiness.passed) {
    gateDecision = `Structural readiness failed: ${structuralReadiness.failureReason}`;
    eligibilityGate = "BLOCK";
  } else if (readinessState === "FOUNDATIONAL" || readinessState === "DEVELOPING") {
    gateDecision = `Readiness state ${readinessState} does not permit refinement`;
    eligibilityGate = "BLOCK";
  } else {
    gateDecision = `WCS (${wcs.toFixed(2)}) and structural readiness meet requirement for ${readinessState}`;
    eligibilityGate = "PASS";
  }

  reasons.push(gateDecision);

  return {
    eligibilityGate,
    readinessState,
    reasons,
  };
}

/**
 * Checks structural readiness requirement.
 *
 * Structural criteria (6 of 13) must collectively have weighted average >= 60% of their contribution.
 *
 * Returns { passed: boolean, failureReason?: string }
 */
function checkStructuralReadiness(envelope: EvaluationEnvelope) {
  const structuralScores = envelope.criteria
    .filter((c) => STRUCTURAL_CRITERIA.has(c.key))
    .map((c) => ({
      key: c.key,
      score: c.score,
      weight: CRITERION_WEIGHT_MAP[c.key] || 0,
    }));

  if (structuralScores.length === 0) {
    return {
      passed: false,
      failureReason: "No structural criteria found in envelope",
    };
  }

  // Compute weighted sum for structural criteria
  let structuralWeightedSum = 0;
  let structuralWeightSum = 0;
  for (const s of structuralScores) {
    structuralWeightedSum += s.score * s.weight;
    structuralWeightSum += s.weight;
  }

  // Expected maximum: 10 * structuralWeightSum
  const structuralMax = 10 * structuralWeightSum;
  const structuralThreshold = structuralMax * 0.6; // 60% of max

  if (structuralWeightedSum < structuralThreshold) {
    return {
      passed: false,
      failureReason: `Structural weighted sum (${structuralWeightedSum.toFixed(2)}) below threshold (${structuralThreshold.toFixed(2)})`,
    };
  }

  return { passed: true };
}

/**
 * Determines readiness state based on WCS band.
 *
 * Volume II-A readiness state definitions:
 * - WCS < 5.0: FOUNDATIONAL
 * - 5.0 <= WCS < 6.0: DEVELOPING
 * - 6.0 <= WCS < 8.5: REFINEMENT_ELIGIBLE
 * - WCS >= 8.5: AGENT_READY
 */
function determineReadinessState(wcs: number): ReadinessState {
  if (wcs < 5.0) {
    return "FOUNDATIONAL";
  } else if (wcs < 6.0) {
    return "DEVELOPING";
  } else if (wcs < AGENT_READY_WCS) {
    return "REFINEMENT_ELIGIBLE";
  } else {
    return "AGENT_READY";
  }
}

/**
 * Checks if a revision is eligible for refinement.
 *
 * Returns true if eligibility_gate result is "PASS" and readiness_state
 * permits refinement (REFINEMENT_ELIGIBLE or AGENT_READY).
 */
export function isRefinementEligible(gateResult: EligibilityGateResult): boolean {
  return (
    gateResult.eligibilityGate === "PASS" &&
    (gateResult.readinessState === "REFINEMENT_ELIGIBLE" ||
      gateResult.readinessState === "AGENT_READY")
  );
}
