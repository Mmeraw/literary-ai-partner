/**
 * Phase A.2: Retry Backoff Calculation
 * 
 * Exponential backoff for job retries to prevent thundering herd
 * and give transient errors time to resolve.
 */

/**
 * Calculate next retry time using exponential backoff
 * 
 * Backoff schedule:
 * - Attempt 1: 30 seconds
 * - Attempt 2: 90 seconds (30 * 3^1)
 * - Attempt 3: 270 seconds (30 * 3^2)
 * - Max: 30 minutes (safety cap)
 * 
 * @param attemptCount - Current attempt count (0-indexed or 1-indexed)
 * @param baseDelaySeconds - Base delay (default 30s)
 * @param maxDelaySeconds - Maximum delay cap (default 30min)
 * @returns ISO 8601 timestamp for next retry
 */
export function calculateNextAttemptAt(
  attemptCount: number,
  baseDelaySeconds: number = 30,
  maxDelaySeconds: number = 30 * 60
): string {
  // Exponential backoff: baseDelay * 3^(attempt-1)
  // Attempt 1 → 30s, Attempt 2 → 90s, Attempt 3 → 270s
  const exponent = Math.max(0, attemptCount - 1);
  const delaySeconds = Math.min(
    baseDelaySeconds * Math.pow(3, exponent),
    maxDelaySeconds
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
