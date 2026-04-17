/**
 * Failure codes for the job pipeline.
 * Source of truth for retryability decisions.
 *
 * Retryability doctrine (#18.R):
 *   - Only transient execution failures are auto-retryable.
 *   - A failed job is an execution outcome, not a validity judgment.
 *   - status='complete' + validity_status='invalid'|'quarantined' are NOT retry states.
 *   - Non-transient failures must be blocked from automatic retry without operator action.
 */
export const FAILURE_CODES = [
  // Transient / auto-retryable
  'TIMEOUT',
  'UPSTREAM_ERROR',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'LEASE_EXPIRED',           // transient: worker died; new worker may acquire a new lease
  // Non-transient / terminal
  'EVALUATION_GATE_REJECTED',
  'MAX_RETRIES_EXCEEDED',
  'INVALID_INPUT',
  'SCHEMA_VALIDATION_FAILED',
  // Finalizer authority & invariant codes (all non-transient)
  'STATE_TRANSITION_INVALID',
  'MISSING_PASS_ARTIFACT',       // deterministic: retrying does not create the artifact
  'PASS_CONVERGENCE_FAILURE',    // deterministic: same input will not converge differently
  'ANCHOR_CONTRACT_VIOLATION',
  'GOVERNANCE_BLOCK',
  'SCHEMA_ERROR',
  'VALIDATION_ERROR',
  'CANONICAL_ARTIFACT_WRITE_FAILED',
  'SUMMARY_PROJECTION_FAILED',
  'CRITERION_COMPLETENESS_FAILED',
] as const;

export type FailureCode = typeof FAILURE_CODES[number];

const NON_TRANSIENT_CODES = new Set<FailureCode>([
  'EVALUATION_GATE_REJECTED',
  'MAX_RETRIES_EXCEEDED',
  'INVALID_INPUT',
  'SCHEMA_VALIDATION_FAILED',
  // Finalizer invariant failures are always terminal (wrong output is worse than no output)
  'STATE_TRANSITION_INVALID',
  'MISSING_PASS_ARTIFACT',
  'PASS_CONVERGENCE_FAILURE',
  'ANCHOR_CONTRACT_VIOLATION',
  'GOVERNANCE_BLOCK',
  'SCHEMA_ERROR',
  'VALIDATION_ERROR',
  'CANONICAL_ARTIFACT_WRITE_FAILED',
  'SUMMARY_PROJECTION_FAILED',
  'CRITERION_COMPLETENESS_FAILED',
]);

export function assertValidFailureCode(raw: string): asserts raw is FailureCode {
  if (!(FAILURE_CODES as readonly string[]).includes(raw)) {
    throw new Error(`Unknown failure code: ${raw}`);
  }
}

export function isTransientFailure(code: FailureCode): boolean {
  return !NON_TRANSIENT_CODES.has(code);
}

export function isNonTransientFailure(code: FailureCode): boolean {
  return NON_TRANSIENT_CODES.has(code);
}

/** Alias for isTransientFailure — explicitly named for retry decision sites. */
export const isRetryableFailure = isTransientFailure;

/**
 * Map an Error to the closest canonical FailureCode.
 * Used to route errors through the canonical taxonomy rather than
 * ad-hoc message-string heuristics.
 *
 * Retryable (transient) matches are tried first; non-retryable patterns
 * take precedence if they match — fail closed wins.
 */
export function classifyError(error: Error): FailureCode {
  const msg = error.message.toLowerCase();

  // Non-retryable patterns (checked first — fail-closed wins)
  if (msg.includes('state transition') || msg.includes('illegal transition'))
    return 'STATE_TRANSITION_INVALID';
  if (msg.includes('anchor contract'))         return 'ANCHOR_CONTRACT_VIOLATION';
  if (msg.includes('governance'))              return 'GOVERNANCE_BLOCK';
  if (msg.includes('convergence'))             return 'PASS_CONVERGENCE_FAILURE';
  if (msg.includes('missing pass artifact') || msg.includes('pass artifact'))
    return 'MISSING_PASS_ARTIFACT';
  if (msg.includes('criterion completeness'))  return 'CRITERION_COMPLETENESS_FAILED';
  if (msg.includes('canonical artifact'))      return 'CANONICAL_ARTIFACT_WRITE_FAILED';
  if (msg.includes('summary projection'))      return 'SUMMARY_PROJECTION_FAILED';
  if (msg.includes('invalid api key') || msg.includes('authentication'))
    return 'INVALID_INPUT';
  if (msg.includes('schema'))                  return 'SCHEMA_ERROR';
  if (msg.includes('validation'))              return 'VALIDATION_ERROR';
  if (msg.includes('invalid input') || msg.includes('malformed'))
    return 'INVALID_INPUT';

  // Retryable (transient) patterns
  if (msg.includes('rate limit') || msg.includes('429'))  return 'RATE_LIMITED';
  if (msg.includes('timeout'))                            return 'TIMEOUT';
  if (msg.includes('network') || msg.includes('econnreset') || msg.includes('econnrefused'))
    return 'UPSTREAM_ERROR';
  if (msg.includes('lease expired'))                      return 'LEASE_EXPIRED';

  // Default to INTERNAL_ERROR (transient) — unknown failures get one retry chance
  return 'INTERNAL_ERROR';
}
