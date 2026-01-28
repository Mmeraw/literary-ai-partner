/**
 * Provider Call Forensics Types
 * Phase 2C-4: Audit-grade provider call persistence
 * 
 * Canonical schema version: 2c1.v1
 * Tracks: request config, response telemetry, errors, canon result envelope
 * Purpose: Append-only audit trail for OpenAI, Anthropic, simulated providers
 */

export type ProviderMetaVersion = '2c1.v1';
export type ProviderType = 'openai' | 'anthropic' | 'simulated';
export type PhaseType = 'phase_1' | 'phase_2' | 'phase_3';

/**
 * Request configuration (no secrets, just telemetry + config)
 */
export interface ProviderRequestMeta {
  model: string;                      // e.g. 'gpt-4o-mini', 'claude-3-sonnet'
  temperature: number;                // 0.0 - 1.0
  max_output_tokens?: number;         // max tokens allowed
  prompt_version: string;             // your versioning scheme (e.g. 'phase2-v1', 'sha256:abc...')
  input_chars: number;                // character count of input
}

/**
 * Response telemetry (latency, token usage, finish reason)
 */
export interface ProviderResponseMeta {
  latency_ms: number;                 // wall-clock time from request to response
  retries: number;                    // successful retry count (0 = first try)
  status_code?: number;               // HTTP status if applicable
  output_chars?: number;              // character count of model output
  tokens_input?: number;              // input token usage (if provided by provider)
  tokens_output?: number;             // output token usage (if provided by provider)
  finish_reason?: string;             // e.g. 'stop', 'length', 'content_filter'
}

/**
 * Error details (retryable classification, truncated message)
 */
export interface ProviderErrorMeta {
  code?: string;                      // provider error code (e.g. 'invalid_request_error', 'rate_limit_error')
  status_code?: number;               // HTTP status code (401, 429, 500, etc.)
  retryable: boolean;                 // true if error suggests retry is safe
  message: string;                    // error message (truncated to 512 chars for storage)
  error_kind?: string;                // classification: 'fast_fail', 'retryable_exhausted', 'circuit_open', 'unknown'
}

/**
 * Canonical result envelope (same structure returned to job)
 */
export interface CanonicalResultEnvelope {
  overview: {
    verdict: string;                  // e.g. 'accept', 'revise', 'reject', 'needs_review'
    strengths?: string[];
    concerns?: string[];
    summary?: string;
  };
  details: Record<string, any>;       // work-type specific details
  metadata: {
    simulated: boolean;
    provider_meta?: Record<string, any>;  // provider-specific telemetry
    openai_runtime?: {                     // Phase 2C-1 metadata
      model: string;
      temperature: number;
      max_output_tokens: number;
    };
    processingTimeMs: number;
    model?: string;
    tokensUsed?: number;
    [key: string]: any;
  };
  partial?: boolean;                  // true if this is a degraded/fallback result
}

/**
 * Full provider call record
 * Insert this into evaluation_provider_calls table
 */
export interface ProviderCallRecord {
  job_id: string;                     // UUID of evaluation_jobs.id
  phase: PhaseType;                   // 'phase_2', etc.
  provider: ProviderType;             // 'openai', 'anthropic', 'simulated'
  provider_meta_version: ProviderMetaVersion;  // canon version (currently '2c1.v1')
  
  request_meta: ProviderRequestMeta;
  response_meta?: ProviderResponseMeta;
  error_meta?: ProviderErrorMeta;
  result_envelope?: Record<string, any>;  // Canonical result structure (flexible to support variants)
}

/**
 * Fetch a provider call record from DB (for audit/forensics)
 */
export interface ProviderCallAuditRow {
  id: string;                         // uuid
  job_id: string;
  phase: string;
  provider: string;
  provider_meta_version: string;
  request_meta: ProviderRequestMeta;
  response_meta: ProviderResponseMeta | null;
  error_meta: ProviderErrorMeta | null;
  result_envelope: CanonicalResultEnvelope | null;
  created_at: string;                 // ISO 8601 timestamp
}

/**
 * Helper to truncate error messages (avoid bloating DB)
 */
export function truncateErrorMessage(msg: string, maxLen: number = 512): string {
  return msg.length > maxLen ? msg.slice(0, maxLen - 3) + '...' : msg;
}

/**
 * Helper to redact sensitive fields before persistence
 * (In case you later need to strip API keys, full prompts, etc.)
 */
export function redactProviderCallRecord(rec: ProviderCallRecord): ProviderCallRecord {
  // For now, no redaction needed (request_meta already excludes secrets)
  // Add redaction logic here if needed later
  return rec;
}

/**
 * Normalizer: Convert EvaluationResult → CanonicalResultEnvelope
 * Safe defaults for all required fields.
 *
 * Why: Internal EvaluationResult has looser typing (optional fields).
 * The DB schema is stricter (CanonicalResultEnvelope enforces shape).
 * This normalizer bridges the gap at persistence time, preventing type-shape drift.
 *
 * Usage: toCanonicalEnvelope(result) in persistProviderCall calls
 */
export function toCanonicalEnvelope(
  result: any, // EvaluationResult or partial result
  opts?: { simulatedDefault?: boolean }
): CanonicalResultEnvelope {
  const simulated = result?.metadata?.simulated ?? opts?.simulatedDefault ?? false;

  const processingTimeMs =
    typeof result?.metadata?.processingTimeMs === 'number'
      ? result.metadata.processingTimeMs
      : 0;

  return {
    overview: result?.overview ?? { verdict: 'unknown', summary: '' },
    details: result?.details ?? {},
    partial: result?.partial ?? false,
    metadata: {
      ...(result?.metadata ?? {}),
      simulated,
      processingTimeMs,
      // Preserve provider_meta/openai_runtime if present
      provider_meta: result?.metadata?.provider_meta,
      openai_runtime: result?.metadata?.openai_runtime,
    },
  };
}
