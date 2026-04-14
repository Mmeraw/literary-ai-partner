/**
 * Failure codes for the job pipeline.
 * Source of truth for retryability decisions.
 * EVALUATION_GATE_REJECTED is non-transient: never retry.
 */

export const FAILURE_CODES = [
  // Transient / retriable
  'TIMEOUT',
  'UPSTREAM_ERROR',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  // Non-transient / terminal
  'EVALUATION_GATE_REJECTED',
  'MAX_RETRIES_EXCEEDED',
  'INVALID_INPUT',
  'SCHEMA_VALIDATION_FAILED',
  // Finalizer authority & invariant codes
  'STATE_TRANSITION_INVALID',
  'LEASE_EXPIRED',
  'MISSING_PASS_ARTIFACT',
  'PASS_CONVERGENCE_FAILURE',
  'ANCHOR_CONTRACT_VIOLATION',
  'GOVERNANCE_BLOCK',
  'SCHEMA_ERROR',
  'VALIDATION_ERROR',
  'CANONICAL_ARTIFACT_WRITE_FAILED',
  'SUMMARY_PROJECTION_FAILED',
] as const;

export type FailureCode = typeof FAILURE_CODES[number];

const NON_TRANSIENT_CODES = new Set<FailureCode>([
  'EVALUATION_GATE_REJECTED',
  'MAX_RETRIES_EXCEEDED',
  'INVALID_INPUT',
  'SCHEMA_VALIDATION_FAILED',
  // Finalizer invariant failures are always terminal (wrong output is worse than no output)
  'STATE_TRANSITION_INVALID',
  'ANCHOR_CONTRACT_VIOLATION',
  'GOVERNANCE_BLOCK',
  'SCHEMA_ERROR',
  'VALIDATION_ERROR',
  'CANONICAL_ARTIFACT_WRITE_FAILED',
  'SUMMARY_PROJECTION_FAILED',
]);

export function assertValidFailureCode(raw: string): asserts raw is FailureCode {
  if (!(FAILURE_CODES as readonly string[]).includes(raw)) {
    throw new Error(`Unknown failure code: ${raw}`);
  }
}

export function isTransientFailure(code: FailureCode): boolean {
  return !NON_TRANSIENT_CODES.has(code);
}
