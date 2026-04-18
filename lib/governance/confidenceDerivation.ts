/**
 * U1 — Confidence Derivation Layer
 *
 * Deterministic confidence derivation from structured system signals.
 * This module is intentionally pure (no I/O, no DB, no pipeline imports).
 *
 * Important contract notes:
 * 1) ConfidenceInputs is a derivation contract, not a persistence contract.
 *    The caller owns mapping from persisted fields (e.g. validity_status) and
 *    execution artifacts into these booleans/enums.
 * 2) `reasons` are cumulative diagnostics. Not every reason is sufficient to
 *    produce the terminal confidence state; terminal state is chosen by the
 *    highest-severity rule that matches.
 */

export const CONFIDENCE_DERIVATION_VERSION = "u1.v1";

export type EvaluationConfidence = "high" | "medium" | "low" | "withheld";

export type ConfidenceReason =
  | "criterion_completeness_failed"
  | "anchor_integrity_failed"
  | "governance_block"
  | "pass_convergence_failed"
  | "pass_disagreement_material"
  | "pass1_unresolved_warnings_present"
  | "used_fallback_path"
  | "execution_degraded"
  | "invalid_output"
  | "quarantined_output"
  | "evidence_coverage_partial"
  | "evidence_coverage_thin";

export type ConfidenceInputs = {
  criterionCompletenessPassed: boolean;
  anchorIntegrityPassed: boolean;
  governancePassed: boolean;
  passConvergencePassed: boolean;
  hasMaterialPassDisagreement: boolean;
  pass1UnresolvedWarningCount: number;
  usedFallbackPath: boolean;
  executionDegraded: boolean;
  invalidOutput: boolean;
  quarantinedOutput: boolean;
  evidenceCoverage: "strong" | "partial" | "thin";
};

export type ConfidenceResult = {
  confidence: EvaluationConfidence;
  reasons: ConfidenceReason[];
};

export function deriveConfidence(input: ConfidenceInputs): ConfidenceResult {
  const reasons: ConfidenceReason[] = [];

  if (!input.criterionCompletenessPassed) {
    reasons.push("criterion_completeness_failed");
  }

  if (!input.anchorIntegrityPassed) {
    reasons.push("anchor_integrity_failed");
  }

  if (!input.governancePassed) {
    reasons.push("governance_block");
  }

  if (!input.passConvergencePassed) {
    reasons.push("pass_convergence_failed");
  }

  if (input.hasMaterialPassDisagreement) {
    reasons.push("pass_disagreement_material");
  }

  if (input.pass1UnresolvedWarningCount > 0) {
    reasons.push("pass1_unresolved_warnings_present");
  }

  if (input.usedFallbackPath) {
    reasons.push("used_fallback_path");
  }

  if (input.executionDegraded) {
    reasons.push("execution_degraded");
  }

  if (input.invalidOutput) {
    reasons.push("invalid_output");
  }

  if (input.quarantinedOutput) {
    reasons.push("quarantined_output");
  }

  if (input.evidenceCoverage === "partial") {
    reasons.push("evidence_coverage_partial");
  }

  if (input.evidenceCoverage === "thin") {
    reasons.push("evidence_coverage_thin");
  }

  // Rule 1: withhold confidence on core trust failures.
  if (
    !input.criterionCompletenessPassed ||
    !input.anchorIntegrityPassed ||
    !input.governancePassed ||
    input.quarantinedOutput
  ) {
    return { confidence: "withheld", reasons };
  }

  // Rule 2: low confidence on critical quality deficits.
  if (
    input.invalidOutput ||
    input.evidenceCoverage === "thin" ||
    input.hasMaterialPassDisagreement
  ) {
    return { confidence: "low", reasons };
  }

  // Rule 3: medium confidence on degradations/partials.
  if (
    input.pass1UnresolvedWarningCount > 0 ||
    input.usedFallbackPath ||
    input.executionDegraded ||
    input.evidenceCoverage === "partial" ||
    !input.passConvergencePassed
  ) {
    return { confidence: "medium", reasons };
  }

  // Rule 4: high confidence only if no downgrade condition matched.
  return { confidence: "high", reasons };
}
