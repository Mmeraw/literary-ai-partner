/**
 * Dead-Letter Path — Terminal Failure Logic
 * 
 * Phase C Week 1 Item #2
 * 
 * Determines when jobs should enter terminal 'failed' state and never retry.
 * Enforces clear boundaries between transient failures (retry) and permanent
 * failures (dead-letter).
 * 
 * @module lib/reliability/deadLetter
 */

import { FailureEnvelope, ERROR_CODES } from './types';

/**
 * Decision result from terminal failure check
 */
export interface DeadLetterDecision {
  /** Whether job should transition to 'failed' status */
  shouldFail: boolean;
  /** Reason for terminal failure, null if should continue retrying */
  reason: 'non_retryable' | 'max_attempts' | 'already_failed' | null;
}

/**
 * Determines if a job should enter terminal 'failed' state
 * 
 * Terminal conditions:
 * 1. Already in 'failed' status (idempotent check)
 * 2. Attempt count exceeds max attempts
 * 3. Latest failure envelope is marked non-retryable
 * 
 * @param status - Current job status from evaluation_jobs.status
 * @param attemptCount - Current attempt_count from evaluation_jobs.attempt_count
 * @param failureEnvelope - Latest failure envelope from evaluation_jobs.failure_envelope
 * @param maxAttempts - Maximum retry attempts allowed (default: 3)
 * @returns Decision with shouldFail flag and reason
 * 
 * @example
 * ```typescript
 * // Check after a failed provider call
 * const decision = shouldMarkFailed(
 *   job.status,
 *   job.attempt_count,
 *   result.error,
 *   3 // max attempts
 * );
 * 
 * if (decision.shouldFail) {
 *   await transitionToFailed(job.id, result.error);
 *   console.log(`Job dead-lettered: ${decision.reason}`);
 * }
 * ```
 */
export function shouldMarkFailed(
  status: string,
  attemptCount: number,
  failureEnvelope: FailureEnvelope | null,
  maxAttempts: number = 3
): DeadLetterDecision {
  // Idempotency: Already in terminal state
  if (status === 'failed') {
    return { shouldFail: true, reason: 'already_failed' };
  }

  // Max attempts exhausted (even if error is retryable)
  if (attemptCount >= maxAttempts) {
    return { shouldFail: true, reason: 'max_attempts' };
  }

  // Non-retryable error encountered
  if (failureEnvelope && !failureEnvelope.retryable) {
    return { shouldFail: true, reason: 'non_retryable' };
  }

  // Continue retrying
  return { shouldFail: false, reason: null };
}

/**
 * Checks if error code represents a non-retryable failure
 * 
 * Non-retryable codes from ERROR_CODES:
 * - invalid_api_key: Invalid/expired credentials
 * - model_not_found: Model not available for account
 * - content_policy_violation: Blocked by safety/policy
 * - malformed_request: Request schema/inputs invalid
 * - invalid_job_state: Internal contract violation
 * - missing_manuscript: Missing upstream data
 * - schema_validation_error: Failed validation
 * 
 * @param errorCode - Error code from FailureEnvelope.error_code
 * @returns true if error should cause immediate terminal failure
 */
export function isNonRetryableError(errorCode: string): boolean {
  const nonRetryableCodes: string[] = [
    // Provider errors (non-retryable)
    ERROR_CODES.INVALID_API_KEY,
    ERROR_CODES.MODEL_NOT_FOUND,
    ERROR_CODES.CONTENT_POLICY_VIOLATION,
    ERROR_CODES.MALFORMED_REQUEST,

    // System errors (non-retryable)
    ERROR_CODES.INVALID_JOB_STATE,
    ERROR_CODES.MISSING_MANUSCRIPT,
    ERROR_CODES.SCHEMA_VALIDATION_ERROR,
  ];

  return nonRetryableCodes.includes(errorCode);
}

/**
 * SQL Query Template: All failed jobs in last N hours with reasons
 * 
 * Usage in Supabase CLI or psql:
 * ```sql
 * SELECT 
 *   id,
 *   created_at,
 *   last_attempt_at,
 *   attempt_count,
 *   failure_envelope->>'provider' AS provider,
 *   failure_envelope->>'error_code' AS error_code,
 *   failure_envelope->>'message' AS message,
 *   failure_envelope->>'retryable' AS retryable
 * FROM evaluation_jobs
 * WHERE status = 'failed'
 *   AND last_attempt_at >= NOW() - INTERVAL '24 hours'
 * ORDER BY last_attempt_at DESC;
 * ```
 * 
 * Top error codes (aggregated):
 * ```sql
 * SELECT 
 *   failure_envelope->>'error_code' AS error_code,
 *   COUNT(*) AS count
 * FROM evaluation_jobs
 * WHERE status = 'failed'
 *   AND last_attempt_at >= NOW() - INTERVAL '24 hours'
 * GROUP BY failure_envelope->>'error_code'
 * ORDER BY count DESC
 * LIMIT 5;
 * ```
 */
export const OPS_QUERIES = {
  FAILED_JOBS_LAST_24H: `
    SELECT 
      id,
      created_at,
      last_attempt_at,
      attempt_count,
      failure_envelope->>'provider' AS provider,
      failure_envelope->>'error_code' AS error_code,
      failure_envelope->>'message' AS message,
      failure_envelope->>'retryable' AS retryable
    FROM evaluation_jobs
    WHERE status = 'failed'
      AND last_attempt_at >= NOW() - INTERVAL '24 hours'
    ORDER BY last_attempt_at DESC;
  `,
  
  TOP_ERROR_CODES_LAST_24H: `
    SELECT 
      failure_envelope->>'error_code' AS error_code,
      COUNT(*) AS count
    FROM evaluation_jobs
    WHERE status = 'failed'
      AND last_attempt_at >= NOW() - INTERVAL '24 hours'
    GROUP BY failure_envelope->>'error_code'
    ORDER BY count DESC
    LIMIT 5;
  `,

  FAILED_JOBS_BY_PROVIDER: `
    SELECT 
      failure_envelope->>'provider' AS provider,
      failure_envelope->>'error_code' AS error_code,
      COUNT(*) AS count
    FROM evaluation_jobs
    WHERE status = 'failed'
      AND last_attempt_at >= NOW() - INTERVAL '24 hours'
    GROUP BY 
      failure_envelope->>'provider',
      failure_envelope->>'error_code'
    ORDER BY count DESC;
  `,
};

/**
 * Validates that job state prevents re-claiming after terminal failure
 * 
 * Contract enforcement:
 * - Jobs with status='failed' must never appear in claimNextJob() results
 * - Worker query MUST include: WHERE status IN ('queued', 'running')
 * - Failed jobs remain queryable but never executable
 * 
 * @param jobStatus - Current status from evaluation_jobs
 * @returns true if job is claimable by workers
 */
export function isClaimable(jobStatus: string): boolean {
  const claimableStatuses = ['queued'];
  return claimableStatuses.includes(jobStatus);
}

/**
 * Validates that terminal transition is legal per JobStatus contract
 * 
 * Legal transitions TO 'failed':
 * - queued → failed (early validation failure)
 * - running → failed (provider call failure)
 * - failed → failed (idempotent, no-op)
 * 
 * Illegal transitions:
 * - complete → failed (violates finality)
 * 
 * @param fromStatus - Current status
 * @param toStatus - Target status
 * @returns true if transition is legal
 */
export function isLegalFailedTransition(fromStatus: string, toStatus: string): boolean {
  if (toStatus !== 'failed') {
    return true; // Only validating transitions TO failed
  }

  const legalFromStatuses = ['queued', 'running', 'failed'];
  return legalFromStatuses.includes(fromStatus);
}
