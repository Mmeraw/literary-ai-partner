/**
 * Phase A.1: Canonical Error Envelope
 * 
 * Structured error format for evaluation job failures.
 * Enables:
 * - Bounded retry logic (retryable vs permanent failures)
 * - Dead-letter queue (admin visibility)
 * - Error classification (per provider, per phase)
 */

export interface ErrorEnvelopeV1 {
  /** Short stable error code (e.g., 'RATE_LIMIT', 'INVALID_INPUT') */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Can this error be auto-retried? */
  retryable: boolean;
  
  /** Which phase failed */
  phase: 'phase_1' | 'phase_2';
  
  /** AI provider (if applicable) */
  provider?: 'openai' | 'anthropic' | null;
  
  /** Additional context (job_id, chunk_index, etc.) */
  context?: Record<string, unknown>;
  
  /** When the error occurred (ISO 8601) */
  occurred_at: string;
}

/**
 * Error codes with retryability classification
 */
export const ERROR_CODES = {
  // Retryable errors (transient)
  RATE_LIMIT: { retryable: true, message: 'API rate limit exceeded' },
  TIMEOUT: { retryable: true, message: 'Request timeout' },
  NETWORK_ERROR: { retryable: true, message: 'Network connection failed' },
  PROVIDER_UNAVAILABLE: { retryable: true, message: 'Provider service unavailable' },
  SERVER_ERROR: { retryable: true, message: 'Provider server error (5xx)' },
  
  // Non-retryable errors (permanent)
  INVALID_INPUT: { retryable: false, message: 'Invalid manuscript or input format' },
  AUTH_FAILED: { retryable: false, message: 'Authentication failed' },
  QUOTA_EXCEEDED: { retryable: false, message: 'API quota exhausted' },
  MANUSCRIPT_NOT_FOUND: { retryable: false, message: 'Manuscript not found' },
  CHUNK_MISSING: { retryable: false, message: 'Required chunks missing' },
  SCHEMA_VIOLATION: { retryable: false, message: 'Database schema violation' },
  
  // Generic fallback
  UNKNOWN_ERROR: { retryable: false, message: 'Unknown error occurred' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Classify an error based on its characteristics
 */
export function classifyError(error: unknown): { code: ErrorCode; retryable: boolean } {
  const err = error as any;
  
  // OpenAI/Anthropic rate limits
  if (err?.status === 429 || err?.code === 'rate_limit_exceeded') {
    return { code: 'RATE_LIMIT', retryable: true };
  }
  
  // Timeouts
  if (err?.code === 'ETIMEDOUT' || err?.code === 'ESOCKETTIMEDOUT' || err?.message?.includes('timeout')) {
    return { code: 'TIMEOUT', retryable: true };
  }
  
  // Network errors
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ENETUNREACH') {
    return { code: 'NETWORK_ERROR', retryable: true };
  }
  
  // Server errors (5xx)
  if (err?.status >= 500 && err?.status < 600) {
    return { code: 'SERVER_ERROR', retryable: true };
  }
  
  // Service unavailable
  if (err?.status === 503 || err?.code === 'ECONNRESET') {
    return { code: 'PROVIDER_UNAVAILABLE', retryable: true };
  }
  
  // Auth failures (4xx except 429)
  if (err?.status === 401 || err?.status === 403) {
    return { code: 'AUTH_FAILED', retryable: false };
  }
  
  // Quota exceeded (OpenAI specific)
  if (err?.code === 'insufficient_quota') {
    return { code: 'QUOTA_EXCEEDED', retryable: false };
  }
  
  // Invalid input (4xx client errors)
  if (err?.status >= 400 && err?.status < 500 && err?.status !== 429) {
    return { code: 'INVALID_INPUT', retryable: false };
  }
  
  // Manuscript/data not found
  if (err?.message?.includes('not found') || err?.message?.includes('missing')) {
    return { code: 'MANUSCRIPT_NOT_FOUND', retryable: false };
  }
  
  // Default: non-retryable unknown error
  return { code: 'UNKNOWN_ERROR', retryable: false };
}

/**
 * Convert any error into a canonical envelope
 */
export function toErrorEnvelope(
  error: unknown,
  context: {
    phase: 'phase_1' | 'phase_2';
    jobId?: string;
    manuscriptId?: number;
    provider?: 'openai' | 'anthropic';
    chunkIndex?: number;
    [key: string]: unknown;
  }
): ErrorEnvelopeV1 {
  const { code, retryable } = classifyError(error);
  const errorCodeDef = ERROR_CODES[code];
  
  // Extract error message
  let message: string = errorCodeDef.message;
  if (error instanceof Error) {
    message = `${errorCodeDef.message}: ${error.message}`;
  } else if (typeof error === 'string') {
    message = `${errorCodeDef.message}: ${error}`;
  }
  
  // Build envelope
  return {
    code,
    message: truncateMessage(message, 500), // Limit message length
    retryable,
    phase: context.phase,
    provider: context.provider || null,
    context: {
      jobId: context.jobId,
      manuscriptId: context.manuscriptId,
      chunkIndex: context.chunkIndex,
      // Include any additional context provided
      ...Object.fromEntries(
        Object.entries(context).filter(([k]) => 
          !['phase', 'jobId', 'manuscriptId', 'provider', 'chunkIndex'].includes(k)
        )
      ),
    },
    occurred_at: new Date().toISOString(),
  };
}

/**
 * Check if an error is retryable (convenience helper)
 */
export function isRetryable(error: unknown): boolean {
  const { retryable } = classifyError(error);
  return retryable;
}

/**
 * Truncate message to avoid DB overflow
 */
function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
}
