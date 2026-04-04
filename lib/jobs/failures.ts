/**
 * Failure Code Taxonomy — RevisionGrade Phase 1
 * 
 * Classified failure codes for structured error handling.
 * Retry is ONLY allowed for transient codes.
 */

export type FailureCode =
  // Transient (retry allowed)
  | "TRANSIENT_NETWORK"
  | "TRANSIENT_UPSTREAM"
  | "RATE_LIMITED"
  // Non-transient (fail closed, no retry)
  | "VALIDATION_ERROR"
  | "SCHEMA_ERROR"
  | "GOVERNANCE_BLOCK"
  | "ANCHOR_CONTRACT_VIOLATION"
  | "MISSING_PASS_ARTIFACT"
  | "PASS_CONVERGENCE_FAILURE"
  | "CANONICAL_ARTIFACT_WRITE_FAILED"
  | "SUMMARY_PROJECTION_FAILED"
  | "LEASE_EXPIRED"
  | "STATE_TRANSITION_INVALID"
  | "RLS_BLOCKED"
  | "MANUAL_REVIEW_REQUIRED";

const TRANSIENT_CODES: ReadonlySet<FailureCode> = new Set([
  "TRANSIENT_NETWORK",
  "TRANSIENT_UPSTREAM",
  "RATE_LIMITED",
]);

export function isTransientFailure(code: FailureCode): boolean {
  return TRANSIENT_CODES.has(code);
}

export function isNonTransientFailure(code: FailureCode): boolean {
  return !TRANSIENT_CODES.has(code);
}

/**
 * Assert that a failure code is valid.
 * Throws if the code is not in the taxonomy.
 */
export function assertValidFailureCode(code: string): asserts code is FailureCode {
  const ALL_CODES: string[] = [
    "TRANSIENT_NETWORK", "TRANSIENT_UPSTREAM", "RATE_LIMITED",
    "VALIDATION_ERROR", "SCHEMA_ERROR", "GOVERNANCE_BLOCK",
    "ANCHOR_CONTRACT_VIOLATION", "MISSING_PASS_ARTIFACT",
    "PASS_CONVERGENCE_FAILURE", "CANONICAL_ARTIFACT_WRITE_FAILED",
    "SUMMARY_PROJECTION_FAILED", "LEASE_EXPIRED",
    "STATE_TRANSITION_INVALID", "RLS_BLOCKED", "MANUAL_REVIEW_REQUIRED",
  ];
  if (!ALL_CODES.includes(code)) {
    throw new Error(`Invalid failure code: ${code}`);
  }
}
