/**
 * Type definitions for governance and evaluation envelope structures.
 */

import type { CriterionKey } from "./canonicalCriteria";

/**
 * A single criterion score within an evaluation envelope.
 */
export interface CriterionScore {
  key: CriterionKey;
  score: number; // Integer in range [1..10]
  reasoning?: string;
}

/**
 * Readiness states (from Volume II-A) that encode structural fitness.
 *
 * These states are determined by weighted composite score (WCS) bands.
 */
export type ReadinessState = "FOUNDATIONAL" | "DEVELOPING" | "REFINEMENT_ELIGIBLE" | "AGENT_READY";
/**
 * Evaluation validity state (from EG Validator Layer).
 * VALID: all gates passed. INVALID: one or more gates failed.
 * DISPUTED: manual override of an INVALID result.
 */
export type ValidityState = "VALID" | "INVALID" | "DISPUTED";

/**
 * Result of evaluating the eligibility gate.
 */
export interface EligibilityGateResult {
  eligibilityGate: "PASS" | "BLOCK";
  readinessState: ReadinessState;
  reasons: string[];
}

/**
 * Evaluation envelope (minimal governance projection).
 *
 * This is the shape of fields required by governance enforcement.
 * The actual evaluation_artifacts row may have more fields; this is the
 * contract for governance operations.
 */
export interface EvaluationEnvelope {
  id?: string;
  evaluation_run_id?: string;
  criteria: CriterionScore[];
  weighted_composite_score?: number;
  eligibility_gate?: "PASS" | "BLOCK";
  readiness_state?: ReadinessState;
  validity_state?: ValidityState;
  evaluation_artifacts?: Record<string, unknown>;
}
