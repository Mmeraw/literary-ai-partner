/**
 * Failure Code Taxonomy — RevisionGrade Runtime
 * Retry is allowed ONLY for transient codes.
 * Canonical rejection is non-transient and fail-closed.
 */

export const FAILURE_CODES = [
  // Transient (retry allowed)
  "TRANSIENT_NETWORK",
  "TRANSIENT_UPSTREAM",
  "RATE_LIMITED",
  // Non-transient (fail closed, no retry)
  "VALIDATION_ERROR",
  "SCHEMA_ERROR",
  "GOVERNANCE_BLOCK",
  "ANCHOR_CONTRACT_VIOLATION",
  "MISSING_PASS_ARTIFACT",
  "PASS_CONVERGENCE_FAILURE",
  "CANONICAL_ARTIFACT_WRITE_FAILED",
  "SUMMARY_PROJECTION_FAILED",
  "LEASE_EXPIRED",
  "STATE_TRANSITION_INVALID",
  "RLS_BLOCKED",
  "MANUAL_REVIEW_REQUIRED",
  "EVALUATION_GATE_REJECTED",
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

export const FAILURE_CODE_SET: ReadonlySet<string> = new Set(FAILURE_CODES);

const TRANSIENT_CODES: ReadonlySet<FailureCode> = new Set([
  "TRANSIENT_NETWORK",
  "TRANSIENT_UPSTREAM",
  "RATE_LIMITED",
]);

export interface RuntimeFailure extends Error {
  failureCode: FailureCode;
  detail?: unknown;
  retryable: boolean;
}

export function isTransientFailure(code: FailureCode): boolean {
  return TRANSIENT_CODES.has(code);
}

export function isNonTransientFailure(code: FailureCode): boolean {
  return !TRANSIENT_CODES.has(code);
}

export function assertValidFailureCode(
  code: string,
): asserts code is FailureCode {
  if (!FAILURE_CODE_SET.has(code)) {
    throw new Error(`Invalid failure code: ${code}`);
  }
}

export function createRuntimeFailure(
  failureCode: FailureCode,
  message: string,
  detail?: unknown,
): RuntimeFailure {
  const err = new Error(message) as RuntimeFailure;
  err.failureCode = failureCode;
  err.detail = detail;
  err.retryable = isTransientFailure(failureCode);
  return err;
}

export function createEvaluationGateRejectedFailure(
  message: string,
  detail?: unknown,
): RuntimeFailure {
  return createRuntimeFailure("EVALUATION_GATE_REJECTED", message, detail);
}

export function isEvaluationGateRejected(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "failureCode" in error &&
    (error as { failureCode?: unknown }).failureCode ===
      "EVALUATION_GATE_REJECTED"
  );
}

/**
 * Error thrown when the evaluation gate rejects a chunk.
 * Non-retryable by design — canonical rejection.
 */
export class EvaluationGateRejectedError extends Error {
  public readonly failureCode = "EVALUATION_GATE_REJECTED" as const;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "EvaluationGateRejectedError";
    this.details = details;
  }
}
