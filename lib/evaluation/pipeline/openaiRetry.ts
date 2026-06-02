/**
 * openaiRetry.ts
 *
 * Centralized retry wrapper for OpenAI API calls.
 * Handles 429 (rate limit), 500/502/503 (server errors), and timeout errors
 * with exponential backoff.
 *
 * Usage:
 *   import { withRetry } from './openaiRetry';
 *   const result = await withRetry(() => openai.chat.completions.create({...}));
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 2000) */
  initialDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay cap in ms (default: 30000) */
  maxDelayMs?: number;
  /** Optional label for logging (e.g., 'pass1a_chunk_3') */
  label?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'label'>> = {
  maxAttempts: 3,
  initialDelayMs: 2000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
};

/** HTTP status codes that are retryable */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 529]);

function isRetryableError(err: unknown): boolean {
  if (err == null) return false;

  // OpenAI SDK errors have a `status` property
  if (typeof (err as { status?: number }).status === 'number') {
    return RETRYABLE_STATUS_CODES.has((err as { status: number }).status);
  }

  // Check error message for common transient patterns
  const message = err instanceof Error ? err.message : String(err);
  const retryablePatterns = [
    'rate limit',
    'Rate limit',
    '429',
    'timeout',
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'socket hang up',
    'network error',
    'fetch failed',
    'exceeded your current quota',
    'server_error',
    'overloaded',
    'Bad gateway',
    'Service Unavailable',
  ];

  return retryablePatterns.some(p => message.includes(p));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract Retry-After header value from OpenAI error (if present).
 * Returns delay in ms, or null if not available.
 */
function getRetryAfterMs(err: unknown): number | null {
  const headers = (err as { headers?: Record<string, string> })?.headers;
  if (!headers) return null;

  const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
  if (!retryAfter) return null;

  const seconds = parseFloat(retryAfter);
  if (!isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 60000); // Cap at 60s
  }
  return null;
}

/**
 * Wrap an async OpenAI call with retry logic.
 *
 * @param fn - The async function to retry (e.g., () => openai.chat.completions.create({...}))
 * @param options - Retry configuration
 * @returns The result of the function call
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const {
    maxAttempts = DEFAULT_OPTIONS.maxAttempts,
    initialDelayMs = DEFAULT_OPTIONS.initialDelayMs,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
  } = options ?? {};
  const label = options?.label ?? 'openai_call';

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) {
        // Exhausted all retries
        console.error(
          `[openaiRetry] ${label}: all ${maxAttempts} attempts exhausted`,
          { error: err instanceof Error ? err.message : String(err) },
        );
        break;
      }

      if (!isRetryableError(err)) {
        // Non-retryable error (e.g., 400 bad request, 401 auth) — fail immediately
        console.error(
          `[openaiRetry] ${label}: non-retryable error on attempt ${attempt}/${maxAttempts}`,
          { error: err instanceof Error ? err.message : String(err) },
        );
        break;
      }

      // Use Retry-After header if available, otherwise exponential backoff
      const retryAfterMs = getRetryAfterMs(err);
      const waitMs = retryAfterMs ?? Math.min(delay, maxDelayMs);

      console.warn(
        `[openaiRetry] ${label}: retryable error on attempt ${attempt}/${maxAttempts}, waiting ${Math.round(waitMs / 1000)}s`,
        {
          status: (err as { status?: number }).status,
          error: err instanceof Error ? err.message.substring(0, 100) : String(err).substring(0, 100),
          retry_after_header: retryAfterMs != null,
        },
      );

      await sleep(waitMs);
      delay *= backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Create a retry-wrapped version of openai.chat.completions.create.
 * Useful when you want to pass a retrying create function around.
 *
 * @param openaiCreate - The bound openai.chat.completions.create function
 * @param baseOptions - Default retry options for all calls through this wrapper
 */
export function createRetryingCompletion<TParams, TResult>(
  openaiCreate: (params: TParams) => Promise<TResult>,
  baseOptions?: RetryOptions,
): (params: TParams, callOptions?: RetryOptions) => Promise<TResult> {
  return (params: TParams, callOptions?: RetryOptions) => {
    const mergedOptions = { ...baseOptions, ...callOptions };
    return withRetry(() => openaiCreate(params), mergedOptions);
  };
}
