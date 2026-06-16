/**
 * Phase A.2: Retry Backoff Calculation
 * 
 * Exponential backoff for job retries to prevent thundering herd
 * and give transient errors time to resolve.
 */

/** Error codes that indicate progressive checkpoint work was saved. */
const CHECKPOINT_RETRY_CODES = new Set([
  'RETRYING_CHECKPOINT',
]);

/**
 * Calculate next retry time using exponential backoff
 * 
 * Backoff schedule (standard):
 * - Attempt 1: 30 seconds
 * - Attempt 2: 90 seconds (30 * 3^1)
 * - Attempt 3: 270 seconds (30 * 3^2)
 * - Max: 30 minutes (safety cap)
 *
 * Checkpoint retry schedule (when errorCode indicates cached progress):
 * - Fixed 15-second delay regardless of attempt count.
 *   The worker made forward progress via chunk caching; long backoff
 *   just delays the next productive invocation.
 * 
 * @param attemptCount - Current attempt count (0-indexed or 1-indexed)
 * @param baseDelaySeconds - Base delay (default 30s)
 * @param maxDelaySeconds - Maximum delay cap (default 30min)
 * @param errorCode - Optional failure code; checkpoint codes use minimal backoff
 * @returns ISO 8601 timestamp for next retry
 */
export function calculateNextAttemptAt(
  attemptCount: number,
  baseDelaySeconds: number = 30,
  maxDelaySeconds: number = 30 * 60,
  errorCode?: string,
): string {
  const isCheckpointRetry = errorCode != null && CHECKPOINT_RETRY_CODES.has(errorCode);

  const delaySeconds = isCheckpointRetry
    ? 15
    : Math.min(
        baseDelaySeconds * Math.pow(3, Math.max(0, attemptCount - 1)),
        maxDelaySeconds,
      );
  
  const nextAttemptMs = Date.now() + delaySeconds * 1000;
  return new Date(nextAttemptMs).toISOString();
}

/**
 * Calculate delay in seconds for a given attempt
 * (Used for logging/debugging)
 */
export function getBackoffDelay(
  attemptCount: number,
  baseDelaySeconds: number = 30
): number {
  const exponent = Math.max(0, attemptCount - 1);
  return baseDelaySeconds * Math.pow(3, exponent);
}

/**
 * Check if a job has exhausted its retry attempts
 */
export function hasExhaustedRetries(
  attemptCount: number,
  maxAttempts: number
): boolean {
  return attemptCount >= maxAttempts;
}
