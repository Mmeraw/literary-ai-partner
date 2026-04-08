/**
 * OpenAI integration for Phase 2 evaluations
 * Phase 2C-1: Real OpenAI calls with retry/circuit-breaker hardening
 *
 * DEPRECATION NOTICE (Slice 2 Canonical Cutover):
 * - This module is legacy worker-path evaluation logic.
 * - Canonical evaluation authority is now `runPipeline()` invoked via
 *   `processEvaluationJob()` in `lib/evaluation/processor.ts`.
 * - Keep only for backward compatibility with legacy worker scripts until
 *   final shutdown. Do not use as primary evaluation engine.
 * 
 * Canon-compliant guarantees:
 * - No schema drift (metadata stored in existing JSONB)
 * - Audit-grade persistence (model/temp/latency/retries/breaker state)
 * - Deterministic failure modes (bounded retries, circuit breaker)
 * - Idempotent (safe to retry)
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
} from '@/lib/evaluation/policy';

/**
 * Circuit Breaker Types for OpenAI resilience
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringInterval: number;
}

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  nextAttemptTime: number | null;
}

export interface EvaluationContext {
  jobId: string;
  manuscriptId: number;
  workType: string;
  phase: string;
  policyFamily: string;
  voicePreservationLevel: string;
  englishVariant: string;
  chunks?: Array<{ index: number; content: string }>;
}

export interface EvaluationResult {
  overview: {
    verdict: string;
    strengths?: string[];
    concerns?: string[];
    summary?: string;
  };
  details: any;
  metadata: {
    model?: string;
    tokensUsed?: number;
    processingTimeMs?: number;
    simulated?: boolean;
    provider_meta?: OpenAIMeta;
    openai_runtime?: {
      model: string;
      temperature: number;
      max_output_tokens: number;
    };
    [key: string]: any;
  };
  partial?: boolean;
}

type LogFn = (
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
) => void;

type OpenAIMeta = {
  provider: "openai";
  model: string;
  temperature: number;
  max_output_tokens: number;
  latency_ms: number;
  retries: number;
  circuit_breaker: {
    state: "closed" | "open" | "half_open";
    opened_at?: string;
  };
  request_id?: string;
  error?: {
    kind: "fast_fail" | "retryable_exhausted" | "circuit_open" | "unknown";
    status?: number;
    code?: string;
    message?: string;
  };
};

// -----------------------------
// Circuit breaker (per-process)
// -----------------------------
const breaker = {
  state: "closed" as "closed" | "open" | "half_open",
  consecutiveFailures: 0,
  openedAtMs: 0,
};

const CB_FAILURE_THRESHOLD = Number(process.env.OPENAI_CB_FAILS ?? "5");
const CB_COOLDOWN_MS = Number(process.env.OPENAI_CB_COOLDOWN_MS ?? "45000");

function breakerSnapshot(): OpenAIMeta["circuit_breaker"] {
  return breaker.state === "open"
    ? { state: "open", opened_at: new Date(breaker.openedAtMs).toISOString() }
    : { state: breaker.state };
}

function maybeTripBreaker() {
  if (breaker.consecutiveFailures >= CB_FAILURE_THRESHOLD && breaker.state !== "open") {
    breaker.state = "open";
    breaker.openedAtMs = Date.now();
  }
}

function maybeHalfOpen() {
  if (breaker.state === "open" && Date.now() - breaker.openedAtMs >= CB_COOLDOWN_MS) {
    breaker.state = "half_open";
  }
}

function recordSuccess() {
  breaker.consecutiveFailures = 0;
  breaker.state = "closed";
  breaker.openedAtMs = 0;
}

function recordFailure() {
  breaker.consecutiveFailures += 1;
  maybeTripBreaker();
}

// -----------------------------
// Retry helpers
// -----------------------------
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number) {
  const j = Math.floor(Math.random() * Math.min(250, ms * 0.1));
  return ms + j;
}

function isRetryableStatus(status?: number) {
  // Retry 429 (rate limit), 500/503 (server / overloaded)
  return status === 429 || status === 500 || status === 503;
}

function isFastFailStatus(status?: number) {
  // Fast-fail on auth / forbidden / bad request / not found / etc.
  return status !== undefined && status >= 400 && status < 500 && status !== 429;
}

function extractStatus(err: any): number | undefined {
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.response?.status === "number") return err.response.status;
  return undefined;
}

function extractRequestId(err: any): string | undefined {
  return (
    err?.request_id ??
    err?.response?.headers?.["x-request-id"] ??
    err?.response?.headers?.get?.("x-request-id")
  );
}

// -----------------------------
// OpenAI call (Phase 2C-1)
// -----------------------------
async function callOpenAI(context: EvaluationContext, chunks: Array<{ index: number; content: string }>, log: LogFn) {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? "0.2");
  const max_output_tokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? "1200");
  const maxRetries = Number(process.env.OPENAI_MAX_RETRIES ?? "4");
  const baseBackoffMs = Number(process.env.OPENAI_BACKOFF_BASE_MS ?? "800");

  // Circuit breaker gate
  maybeHalfOpen();
  if (breaker.state === "open") {
    const meta: OpenAIMeta = {
      provider: "openai",
      model,
      temperature,
      max_output_tokens,
      latency_ms: 0,
      retries: 0,
      circuit_breaker: breakerSnapshot(),
      error: { kind: "circuit_open", message: "Circuit breaker open" },
    };
    return { ok: false as const, meta };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Canon prompt: deterministic + metadata-rich
  const messages = [
    {
      role: "system" as const,
      content:
        "You are RevisionGrade Phase 2 evaluator. Analyze the manuscript and return ONLY valid JSON matching the schema: {\"verdict\":\"accept|revise|reject\",\"strengths\":[\"...\"],\"concerns\":[\"...\"],\"details\":{}}. No markdown, no explanations outside JSON.",
    },
    {
      role: "user" as const,
      content: JSON.stringify(
        {
          job_id: context.jobId,
          manuscript_id: context.manuscriptId,
          policy_family: context.policyFamily,
          voice_preservation_level: context.voicePreservationLevel,
          english_variant: context.englishVariant,
          chunks: chunks.map((c) => ({ index: c.index, content: c.content })),
        },
        null,
        0
      ),
    },
  ];

  const t0 = Date.now();
  let attempt = 0;
  let lastErr: any = null;

  while (attempt <= maxRetries) {
    try {
      attempt += 1;
      log("info", "OpenAI request attempt", { jobId: context.jobId, attempt, model });

      const resp = await client.chat.completions.create({
        model,
        messages,
        ...buildOpenAITemperatureParam(model, temperature),
        ...buildOpenAIOutputTokenParam(model, max_output_tokens),
      });

      const latency_ms = Date.now() - t0;
      const text = resp.choices[0]?.message?.content ?? "";
      const request_id = (resp as any)?.id ?? undefined;

      const meta: OpenAIMeta = {
        provider: "openai",
        model,
        temperature,
        max_output_tokens,
        latency_ms,
        retries: attempt - 1,
        circuit_breaker: breakerSnapshot(),
        request_id,
      };

      recordSuccess();
      return { ok: true as const, text, meta };
    } catch (err: any) {
      lastErr = err;
      const status = extractStatus(err);
      const request_id = extractRequestId(err);

      // Fast-fail on non-retryable 4xx (except 429)
      if (isFastFailStatus(status)) {
        recordFailure();
        const meta: OpenAIMeta = {
          provider: "openai",
          model,
          temperature,
          max_output_tokens,
          latency_ms: Date.now() - t0,
          retries: attempt - 1,
          circuit_breaker: breakerSnapshot(),
          request_id,
          error: {
            kind: "fast_fail",
            status,
            code: err?.code,
            message: err?.message,
          },
        };
        return { ok: false as const, meta };
      }

      const retryable = isRetryableStatus(status) || status === undefined;
      if (!retryable || attempt > maxRetries) {
        recordFailure();
        const meta: OpenAIMeta = {
          provider: "openai",
          model,
          temperature,
          max_output_tokens,
          latency_ms: Date.now() - t0,
          retries: attempt - 1,
          circuit_breaker: breakerSnapshot(),
          request_id,
          error: {
            kind: "retryable_exhausted",
            status,
            code: err?.code,
            message: err?.message,
          },
        };
        return { ok: false as const, meta };
      }

      // Exponential backoff with jitter
      const backoff = jitter(baseBackoffMs * Math.pow(2, attempt - 1));
      log("warn", "OpenAI retryable error; backing off", {
        jobId: context.jobId,
        attempt,
        status,
        backoff_ms: backoff,
      });
      await sleep(backoff);
    }
  }

  // Should never reach here, but keep canon-safe return
  recordFailure();
  const meta: OpenAIMeta = {
    provider: "openai",
    model,
    temperature,
    max_output_tokens,
    latency_ms: 0,
    retries: maxRetries,
    circuit_breaker: breakerSnapshot(),
    error: { kind: "unknown", message: lastErr?.message },
  };
  return { ok: false as const, meta };
}

/**
 * Execute Phase 2 evaluation with OpenAI
 * Phase 2C-1: Real OpenAI integration with retry/circuit-breaker
 * Idempotent: can be retried safely
 */
export async function executePhase2Evaluation(
  context: EvaluationContext,
  log: LogFn
): Promise<EvaluationResult> {
  const startTime = Date.now();

  log('info', 'Starting Phase 2 evaluation (OpenAI)', {
    jobId: context.jobId,
    manuscriptId: context.manuscriptId,
    workType: context.workType,
    phase: context.phase
  });

  // Step 1: Fetch manuscript chunks
  const supabase = getSupabaseClient();
  const { data: chunks, error } = await supabase
    .from('manuscript_chunks')
    .select('chunk_index as index, content')
    .eq('manuscript_id', context.manuscriptId)
    .order('chunk_index', { ascending: true });

  if (error || !chunks || chunks.length === 0) {
    log('error', 'Failed to fetch manuscript chunks', {
      jobId: context.jobId,
      error: error?.message
    });
    throw new Error(`Failed to fetch manuscript chunks: ${error?.message}`);
  }

  log('info', 'Manuscript chunks loaded', {
    jobId: context.jobId,
    chunkCount: chunks.length
  });

  // Step 2: Call OpenAI with retry/circuit-breaker
  const openai = await callOpenAI(context, chunks as unknown as Array<{ index: number; content: string }>, log);

  if (!openai.ok) {
    // Canon-compatible "partial" result:
    // - keeps pipeline moving
    // - preserves error + metadata for audit/retry
    log('warn', 'OpenAI call failed, returning partial result', {
      jobId: context.jobId,
      error_kind: openai.meta.error?.kind
    });

    return {
      overview: {
        verdict: "needs_review",
        summary: "Evaluation unavailable (OpenAI error).",
      },
      details: {
        notes: [],
      },
      metadata: {
        simulated: false,
        provider_meta: openai.meta,
        processingTimeMs: Date.now() - startTime
      },
      partial: true,
    };
  }

  // Step 3: Parse model output as JSON (strict)
  let parsed: any = null;
  try {
    parsed = JSON.parse(openai.text);
  } catch (e: any) {
    log('error', 'Failed to parse OpenAI response as JSON', {
      jobId: context.jobId,
      responsePreview: openai.text.slice(0, 200)
    });

    return {
      overview: {
        verdict: "needs_review",
        summary: "Evaluation returned invalid JSON.",
      },
      details: { notes: [] },
      metadata: {
        simulated: false,
        provider_meta: {
          ...openai.meta,
          error: {
            kind: "fast_fail",
            message: "Model output was not valid JSON",
          },
        },
        processingTimeMs: Date.now() - startTime
      },
      partial: true,
    };
  }

  // Step 4: Attach provider metadata (model/version/temp/latency) into existing envelope
  const result: EvaluationResult = {
    overview: {
      verdict: parsed.verdict ?? "needs_review",
      strengths: parsed.strengths ?? [],
      concerns: parsed.concerns ?? [],
      summary: parsed.summary ?? "Evaluation completed"
    },
    details: parsed.details ?? {},
    metadata: {
      ...(parsed.metadata ?? {}),
      simulated: false,
      provider_meta: openai.meta,
      processingTimeMs: Date.now() - startTime,
      model: openai.meta.model,
      tokensUsed: 0,  // OpenAI SDK doesn't return token count in all responses
      openai_runtime: {
        model: openai.meta.model,
        temperature: openai.meta.temperature,
        max_output_tokens: openai.meta.max_output_tokens,
      }
    }
  };

  log('info', 'Phase 2 evaluation completed successfully', {
    jobId: context.jobId,
    verdict: result.overview.verdict,
    latency_ms: openai.meta.latency_ms,
    retries: openai.meta.retries
  });

  return result;
}

/**
 * Get Supabase client (shared utility)
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Determine if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Retryable: rate limits, timeouts, network errors
  if (message.includes('rate limit')) return true;
  if (message.includes('timeout')) return true;
  if (message.includes('network')) return true;
  if (message.includes('econnreset')) return true;
  
  // Not retryable: auth errors, invalid requests
  if (message.includes('invalid api key')) return false;
  if (message.includes('authentication')) return false;
  
  // Default: retry most errors
  return true;
}
