/**
 * Phase 2.7 — Pass 2: Editorial/Literary Insight Runner
 *
 * INDEPENDENCE GUARANTEE (Non-Negotiable Rule #3):
 *   This function MUST NOT receive Pass 1 output.
 *   The function signature enforces this at the type level —
 *   there is no parameter for Pass 1 data.
 *
 * Temperature: 0.3 (per Vol III Tools §PASS2)
* Max tokens: 8000 (default, override via EVAL_PASS2_MAX_TOKENS)
 */

import OpenAI from "openai";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS2_SYSTEM_PROMPT, PASS2_PROMPT_VERSION, buildPass2UserPrompt } from "./prompts/pass2-editorial";
import type { SinglePassOutput, AxisCriterionResult, EvidenceAnchor, CompletionUsage, PassCompletionCapture, ManuscriptChunkEvidence } from "./types";
import type { CanonRegistry } from "@/lib/governance/canonRegistry";
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPass2Model,
  OPENAI_SDK_MAX_RETRIES,
} from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { emitLatencyTrace } from "@/lib/observability/latencyTrace";
import { JsonBoundaryError, parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";
import { summarizePromptCoverage } from "./promptInput";
import { countWords } from "./submissionScope";
import {
  ChunkCountExceedsCapError,
  ChunkRoutingNotEngagedError,
} from "./failures";

const PASS2_TEMPERATURE = 0.3;

// Mirror of processor.ts STRUCTURAL_CHUNKING_THRESHOLD_WORDS. Kept duplicated
// here to avoid a circular import — processor.ts pulls from pipeline modules.
const STRUCTURAL_CHUNKING_THRESHOLD_WORDS = 3_000;
const DEFAULT_CHUNK_PASS_CONCURRENCY = 5;
const DEFAULT_CHUNK_RETRY_MAX = 3;
const DEFAULT_CHUNK_RETRY_BASE_MS = 10000;
// Pass 2 model is resolved via getCanonicalPass2Model(opts.model), allowing
// EVAL_PASS2_MODEL (or EVAL_CHUNK_MODEL fallback) to control high-volume map-phase calls.

function getRetryPass2MaxTokens(currentMaxTokens: number): number {
  return Math.min(16000, Math.max(8000, currentMaxTokens + 4000));
}

function nowMs(): number {
  return Date.now();
}

type CompletionChoice = {
  message?: {
    content?: unknown;
    refusal?: unknown;
  };
  finish_reason?: unknown;
};

function extractResponseText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (typeof part !== "object" || part === null) {
        return "";
      }

      const record = part as Record<string, unknown>;
      if (typeof record.text === "string") {
        return record.text;
      }
      if (typeof record.content === "string") {
        return record.content;
      }
      return "";
    })
    .join("")
    .trim();
}

function buildEmptyResponseDiagnostic(params: {
  model: string;
  completion: { choices?: unknown; usage?: CompletionUsage };
  firstChoice: CompletionChoice | undefined;
  rawContent: unknown;
  maxOutputTokens: number;
}): string {
  const { model, completion, firstChoice, rawContent, maxOutputTokens } = params;
  const usage = completion.usage;
  const finishReason =
    typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";
  const contentType =
    rawContent === null ? "null" : Array.isArray(rawContent) ? "array" : typeof rawContent;
  const refusal =
    typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined;
  const choiceCount = Array.isArray(completion.choices) ? completion.choices.length : 0;

  return (
    `[Pass2] Empty response from OpenAI ` +
    `(model=${model} finish_reason=${finishReason} content_type=${contentType} choices=${choiceCount} ` +
    `max_output_tokens=${maxOutputTokens}` +
    `${typeof usage?.prompt_tokens === "number" ? ` prompt_tokens=${usage.prompt_tokens}` : ""}` +
    `${typeof usage?.completion_tokens === "number" ? ` completion_tokens=${usage.completion_tokens}` : ""}` +
    `${typeof usage?.total_tokens === "number" ? ` total_tokens=${usage.total_tokens}` : ""}` +
    `${refusal ? ` refusal=${JSON.stringify(refusal).slice(0, 120)}` : ""})`
  );
}

function getChunkPassConcurrency(): number {
  const raw = process.env.EVAL_CHUNK_PASS_CONCURRENCY;
  if (!raw) return DEFAULT_CHUNK_PASS_CONCURRENCY;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CHUNK_PASS_CONCURRENCY;
  return Math.min(24, Math.max(1, parsed));
}

function getChunkRetryMax(): number {
  const raw = process.env.EVAL_CHUNK_RETRY_MAX;
  if (!raw) return DEFAULT_CHUNK_RETRY_MAX;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CHUNK_RETRY_MAX;
  return Math.min(10, parsed);
}

function getChunkRetryBaseMs(): number {
  const raw = process.env.EVAL_CHUNK_RETRY_BASE_MS;
  if (!raw) return DEFAULT_CHUNK_RETRY_BASE_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CHUNK_RETRY_BASE_MS;
  return Math.min(60_000, Math.max(500, parsed));
}

function isRateLimitError(reason: unknown): boolean {
  const text = String(reason instanceof Error ? reason.message : reason).toLowerCase();
  return text.includes("429") || text.includes("rate limit") || text.includes("tokens per min") || text.includes("tpm");
}

function parseRetryAfterMs(reason: unknown): number | null {
  if (typeof reason === "object" && reason !== null) {
    const maybeHeaders = (reason as { headers?: unknown; response?: { headers?: unknown } }).headers
      ?? (reason as { response?: { headers?: unknown } }).response?.headers;
    if (typeof maybeHeaders === "object" && maybeHeaders !== null) {
      const headersRecord = maybeHeaders as Record<string, unknown>;
      const retryHeaderRaw = headersRecord["retry-after"] ?? headersRecord["Retry-After"];
      if (typeof retryHeaderRaw === "string" && retryHeaderRaw.trim() !== "") {
        const asSeconds = Number.parseFloat(retryHeaderRaw);
        if (Number.isFinite(asSeconds) && asSeconds > 0) {
          return Math.ceil(asSeconds * 1000);
        }
      } else if (typeof retryHeaderRaw === "number" && Number.isFinite(retryHeaderRaw) && retryHeaderRaw > 0) {
        return Math.ceil(retryHeaderRaw * 1000);
      }
    }
  }

  const text = String(reason instanceof Error ? reason.message : reason);
  const secMatch = text.match(/try again in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (secMatch) {
    const sec = Number.parseFloat(secMatch[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.ceil(sec * 1000);
    }
  }

  const msMatch = text.match(/retry[-_ ]after\s*[:=]?\s*([0-9]+)\s*ms/i);
  if (msMatch) {
    const ms = Number.parseInt(msMatch[1], 10);
    if (Number.isFinite(ms) && ms > 0) return ms;
  }

  return null;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getChunkPassMaxPerPass(): number | null {
  const raw = process.env.EVAL_CHUNK_MAX_PER_PASS;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

async function runChunksWithConcurrency<T>(
  chunks: ManuscriptChunkEvidence[],
  concurrency: number,
  worker: (chunk: ManuscriptChunkEvidence) => Promise<T>,
): Promise<Array<PromiseSettledResult<T>>> {
  const settled: Array<PromiseSettledResult<T>> = new Array(chunks.length);
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= chunks.length) {
        return;
      }

      try {
        const value = await worker(chunks[index]);
        settled[index] = { status: "fulfilled", value };
      } catch (reason) {
        settled[index] = { status: "rejected", reason };
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => runWorker());
  await Promise.all(workers);
  return settled;
}

/** Function signature for creating a chat completion (enables DI for testing). */
export type CreateCompletionFn = (params: {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  response_format: { type: string };
}) => Promise<{ choices: CompletionChoice[]; usage?: CompletionUsage; id?: string; request_id?: string }>;

/**
 * Aggregates multiple SinglePassOutput results from chunk evaluations (Pass 2 variant).
 * Combines evidence, averages scores, and deduplicates recommendations.
 */
function aggregateChunkResults(results: SinglePassOutput[]): SinglePassOutput {
  if (results.length === 0) {
    throw new Error("[Pass2] No chunk results to aggregate");
  }
  
  if (results.length === 1) {
    return results[0];
  }

  // Build aggregated criteria
  const aggregatedCriteria: AxisCriterionResult[] = [];
  
  for (const key of CRITERIA_KEYS) {
    const criteriaForKey = results
      .flatMap((r) => r.criteria)
      .filter((c) => c.key === key);
    
    if (criteriaForKey.length === 0) continue;

    // Merge evidence from all chunks (Pass 2 allows up to 2 evidence items)
    const mergedEvidence: EvidenceAnchor[] = [];
    const seenSnippets = new Set<string>();
    
    for (const crit of criteriaForKey) {
      for (const ev of crit.evidence) {
        const snippetKey = ev.snippet?.trim() || "";
        if (snippetKey && !seenSnippets.has(snippetKey)) {
          mergedEvidence.push(ev);
          seenSnippets.add(snippetKey);
          if (mergedEvidence.length >= 2) break;
        }
      }
      if (mergedEvidence.length >= 2) break;
    }

    // Average scores
    const avgScore = Math.round(
      criteriaForKey.reduce((sum, c) => sum + c.score_0_10, 0) / criteriaForKey.length
    );

    // Merge rationales (use first)
    const firstRationale = criteriaForKey[0]?.rationale || "";

    aggregatedCriteria.push({
      key,
      score_0_10: Math.min(10, Math.max(0, avgScore)),
      rationale: firstRationale,
      evidence: mergedEvidence,
      recommendations: [],
    });
  }

  return {
    pass: 2,
    axis: "editorial_literary",
    criteria: aggregatedCriteria,
    model: results[0].model,
    prompt_version: PASS2_PROMPT_VERSION,
    temperature: PASS2_TEMPERATURE,
    generated_at: new Date().toISOString(),
  };
}

import type { SubmissionScopeProfile } from "./submissionScope";

export interface RunPass2Options {
  scopeProfile?: SubmissionScopeProfile;
  /**
   * The original manuscript text — the ONLY thing Pass 2 receives.
   * Pass 1 output must NEVER appear here.
   */
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  workType: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  registry: CanonRegistry;
  model?: string;
  openaiApiKey?: string;
  /** Optional provider timeout override from pipeline-level scoped resolution. */
  openAiTimeoutMs?: number;
  manuscriptId?: string;
  jobId?: string;
  /** Override the completion function (for testing). Production callers omit this. */
  _createCompletion?: CreateCompletionFn;
  _onCompletion?: (capture: PassCompletionCapture) => void;
}

/**
 * Run Pass 2 — Editorial/Literary Insight analysis.
 *
 * Independence guarantee: this function only accepts manuscript text.
 * There is deliberately no parameter for Pass 1 data.
 *
 * Returns a validated SinglePassOutput with axis="editorial_literary".
 * Throws on OpenAI error or unparseable response.
 */
export async function runPass2(opts: RunPass2Options): Promise<SinglePassOutput> {
  // Fail fast if no OpenAI API key is available (even when completion is injected)
  const effectiveApiKey =
    opts.openaiApiKey ||
    process.env.OPENAI_API_KEY;

  if (!effectiveApiKey) {
    throw new Error("[Pass2] OPENAI_API_KEY is not configured");
  }

  const passStartMs = nowMs();
  const selectedModel = getCanonicalPass2Model(opts.model);

  if (!opts.registry || opts.registry.size === 0) {
    throw new Error("[Pass2] Canonical registry binding missing");
  }

  // ─── CHUNK-NATIVE ROUTING (Long-Form Path) ──────────────────────────────
  // If chunks are present and count > 1, evaluate each chunk independently
  // and aggregate results. Otherwise, fall through to single-pass window path.
  const hasChunks = Array.isArray(opts.manuscriptChunks) && opts.manuscriptChunks.length > 1;
  if (hasChunks) {
    const chunksTotal = opts.manuscriptChunks!.length;
    const chunkConcurrency = getChunkPassConcurrency();
    const chunkCap = getChunkPassMaxPerPass();
    const chunkRetryMax = getChunkRetryMax();
    const chunkRetryBaseMs = getChunkRetryBaseMs();
    // Fail-closed: NEVER silently truncate chunks. See runPass1 for rationale.
    if (chunkCap !== null && opts.manuscriptChunks!.length > chunkCap) {
      throw new ChunkCountExceedsCapError(
        `Manuscript produced ${opts.manuscriptChunks!.length} chunks; cap is ${chunkCap}. ` +
        `Please split the manuscript into smaller volumes for evaluation.`,
        {
          code: 'CHUNK_COUNT_EXCEEDS_CAP',
          chunk_count: opts.manuscriptChunks!.length,
          chunk_cap: chunkCap,
        },
      );
    }
    const selectedChunks = opts.manuscriptChunks!;
    const chunkEvalStartMs = nowMs();
    let rateLimitRetryCount = 0;
    let rateLimitWaitMs = 0;
    let usagePromptTokensTotal = 0;
    let usageCompletionTokensTotal = 0;
    let usageTotalTokensTotal = 0;

    const forwardCompletion = opts._onCompletion;

    console.log(
      `[Pass2] Chunk-native path: total=${chunksTotal} attempted=${selectedChunks.length} concurrency=${chunkConcurrency}`,
    );

    const settled = await runChunksWithConcurrency(
      selectedChunks,
      chunkConcurrency,
      async (chunk) => {
        let attempt = 0;
        while (true) {
          try {
            return await runPass2({
              ...opts,
              manuscriptText: chunk.content,
              manuscriptChunks: undefined, // Prevent recursive chunking
              _onCompletion: (capture) => {
                if (capture.pass === 2) {
                  usagePromptTokensTotal += capture.usage?.prompt_tokens ?? 0;
                  usageCompletionTokensTotal += capture.usage?.completion_tokens ?? 0;
                  usageTotalTokensTotal += capture.usage?.total_tokens ?? 0;
                }
                forwardCompletion?.(capture);
              },
            });
          } catch (error) {
            if (!isRateLimitError(error) || attempt >= chunkRetryMax) {
              throw error;
            }

            const suggestedWait = parseRetryAfterMs(error);
            const backoffMs = Math.min(90_000, chunkRetryBaseMs * Math.pow(2, attempt));
            const jitterMs = Math.floor(Math.random() * 750);
            const waitMs = Math.max(suggestedWait ?? 0, backoffMs) + jitterMs;
            rateLimitRetryCount += 1;
            rateLimitWaitMs += waitMs;
            attempt += 1;
            console.warn(
              `[Pass2] Chunk ${chunk.chunk_index} rate-limited; retry ${attempt}/${chunkRetryMax} after ${waitMs}ms`,
            );
            await sleepMs(waitMs);
          }
        }
      },
    );

    const chunkResults: SinglePassOutput[] = [];
    const failures: Array<{ chunkIndex: number; reason: string }> = [];
    const chunkFailuresByReason: Record<string, number> = {};
    for (let i = 0; i < settled.length; i += 1) {
      const result = settled[i];
      if (!result) continue;
      if (result.status === "fulfilled") {
        chunkResults.push(result.value);
      } else {
        const reason = String(result.reason instanceof Error ? result.reason.message : result.reason);
        const bucket = isRateLimitError(result.reason) ? "RATE_LIMIT_429" : "OTHER";
        chunkFailuresByReason[bucket] = (chunkFailuresByReason[bucket] ?? 0) + 1;
        failures.push({
          chunkIndex: selectedChunks[i].chunk_index,
          reason,
        });
      }
    }

    const chunkEvalTotalMs = nowMs() - chunkEvalStartMs;
    const chunkCoveragePct =
      chunksTotal > 0 ? Number(((chunkResults.length / chunksTotal) * 100).toFixed(2)) : 0;
    emitLatencyTrace({
      job_id: opts.jobId ?? "unknown",
      stage: "pass2",
      state: "pass2_chunk_eval",
      metadata: {
        chunks_total: chunksTotal,
        chunks_attempted: selectedChunks.length,
        chunks_succeeded: chunkResults.length,
        chunks_failed: failures.length,
        chunk_coverage_pct: chunkCoveragePct,
        chunk_concurrency: chunkConcurrency,
        chunk_eval_total_ms: chunkEvalTotalMs,
        provider: "openai",
        model: selectedModel,
        usage_prompt_tokens_total: usagePromptTokensTotal,
        usage_completion_tokens_total: usageCompletionTokensTotal,
        usage_total_tokens_total: usageTotalTokensTotal,
        rate_limit_retry_count: rateLimitRetryCount,
        rate_limit_total_wait_ms: rateLimitWaitMs,
        provider_tpm_limited: (chunkFailuresByReason["RATE_LIMIT_429"] ?? 0) > 0 || rateLimitRetryCount > 0,
        chunk_failures_by_reason: chunkFailuresByReason,
        chunk_cap_applied: false,
        chunk_cap_value: chunkCap,
      },
    });

    if (failures.length > 0) {
      const firstFailure = failures[0];
      throw new Error(
        `[Pass2] Chunk evaluation failures: failed=${failures.length}/${selectedChunks.length}; first_chunk=${firstFailure.chunkIndex}; first_error=${firstFailure.reason}`,
      );
    }

    const aggregated = aggregateChunkResults(chunkResults);
    console.log(`[Pass2] Chunk aggregation complete: ${aggregated.criteria.length} criteria`);
    return {
      ...aggregated,
      coverage_summary: {
        route: "chunk_map_reduce",
        fully_evaluated:
          failures.length === 0 &&
          selectedChunks.length === chunksTotal &&
          chunkResults.length === chunksTotal,
        chunk_ledger: {
          expected_chunks: chunksTotal,
          attempted_chunks: selectedChunks.length,
          evaluated_chunks: chunkResults.length,
          failed_chunks: failures.length,
          cap_applied: false,
        },
      },
    };
  }

  // ─── SINGLE-PASS SAMPLED-WINDOW PATH (Short-Form ONLY) ────────────────────
  // Below STRUCTURAL_CHUNKING_THRESHOLD_WORDS this is the correct single-unit
  // evaluation path. Above it, the upstream runPipeline assert refuses to
  // route here — this tautological safety net catches any caller that
  // somehow bypasses the upstream check.
  const pass2WordCount = countWords(opts.manuscriptText);
  if (pass2WordCount >= STRUCTURAL_CHUNKING_THRESHOLD_WORDS) {
    throw new ChunkRoutingNotEngagedError(
      `Pass 2 received ${pass2WordCount} words (≥ ${STRUCTURAL_CHUNKING_THRESHOLD_WORDS}) with ` +
      `no chunks; direct_window fallback would silently timeout. Refusing to dispatch.`,
      {
        code: 'CHUNK_ROUTING_NOT_ENGAGED',
        manuscript_words: pass2WordCount,
        chunk_count: opts.manuscriptChunks?.length ?? 0,
        guard_location: 'runPass2.direct_window_entry',
      },
    );
  }

  const effectiveOpenAiTimeoutMs = opts.openAiTimeoutMs ?? getEvalOpenAiTimeoutMs();
  const createCompletion = opts._createCompletion ?? defaultCreateCompletion(opts.openaiApiKey, effectiveOpenAiTimeoutMs);

  const promptAssemblyStartMs = nowMs();

  const userPrompt = buildPass2UserPrompt({
    manuscriptText: opts.manuscriptText,
    workType: opts.workType,
    title: opts.title,
    executionMode: opts.executionMode,
    scopeProfile: opts.scopeProfile,
  });
  const promptAssemblyMs = nowMs() - promptAssemblyStartMs;
  const inputChars = opts.manuscriptText.length;

  const requestCompletion = async (maxOutputTokens: number) => {
    const outputTokenParam = buildOpenAIOutputTokenParam(selectedModel, maxOutputTokens);
    const configuredMaxTokens =
      typeof (outputTokenParam as { max_completion_tokens?: unknown }).max_completion_tokens === "number"
        ? Number((outputTokenParam as { max_completion_tokens: number }).max_completion_tokens)
        : typeof (outputTokenParam as { max_tokens?: unknown }).max_tokens === "number"
        ? Number((outputTokenParam as { max_tokens: number }).max_tokens)
        : null;

    const completion = await createCompletion({
      model: selectedModel,
      messages: [
        { role: "system", content: PASS2_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      ...buildOpenAITemperatureParam(selectedModel, PASS2_TEMPERATURE),
      ...outputTokenParam,
      response_format: { type: "json_object" },
    });

    return { completion, configuredMaxTokens };
  };

  console.log(`[Pass2] completion request model=${selectedModel}`);

  let activeMaxTokens = getEvaluationRuntimeConfig().pass.pass2MaxTokens;
  const modelCallStartMs = nowMs();
  let { completion, configuredMaxTokens } = await requestCompletion(activeMaxTokens);
  let modelCallMs = nowMs() - modelCallStartMs;

  const parseValidationStartMs = nowMs();

  let firstChoice = completion.choices?.[0] as CompletionChoice | undefined;
  let rawContent = firstChoice?.message?.content;
  let responseText = extractResponseText(rawContent);
  let retriedForLength = false;

  if (
    responseText.trim().length === 0 &&
    typeof firstChoice?.finish_reason === "string" &&
    firstChoice.finish_reason === "length"
  ) {
    retriedForLength = true;
    const retryMaxTokens = getRetryPass2MaxTokens(activeMaxTokens);
    console.warn("[Pass2] Empty length-limited response; retrying with higher output token budget", {
      model: selectedModel,
      initialMaxTokens: activeMaxTokens,
      retryMaxTokens,
      usage: completion.usage,
    });

    activeMaxTokens = retryMaxTokens;
    const retryStartMs = nowMs();
    ({ completion, configuredMaxTokens } = await requestCompletion(activeMaxTokens));
    modelCallMs += nowMs() - retryStartMs;

    firstChoice = completion.choices?.[0] as CompletionChoice | undefined;
    rawContent = firstChoice?.message?.content;
    responseText = extractResponseText(rawContent);
  }

  if (responseText.trim().length === 0) {
    const diagnosticMessage = buildEmptyResponseDiagnostic({
      model: selectedModel,
      completion,
      firstChoice,
      rawContent,
      maxOutputTokens: activeMaxTokens,
    });

    console.error("[Pass2] Completion boundary diagnostic", {
      model: selectedModel,
      hasChoices: Array.isArray((completion as { choices?: unknown }).choices),
      choiceCount: Array.isArray((completion as { choices?: unknown[] }).choices)
        ? (completion as { choices: unknown[] }).choices.length
        : 0,
      finishReason:
        typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown",
      contentType: rawContent === null ? "null" : Array.isArray(rawContent) ? "array" : typeof rawContent,
      contentPreview: typeof rawContent === "string" ? rawContent.slice(0, 160) : undefined,
      usage: completion.usage,
      maxOutputTokens: activeMaxTokens,
      refusal:
        typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined,
    });
    const parseValidationMs = nowMs() - parseValidationStartMs;
    const totalMs = nowMs() - passStartMs;
    console.log("[Pass2][Timing]", {
      stage: "failure",
      model: selectedModel,
      input_chars: inputChars,
      output_chars: responseText.length,
      prompt_assembly_ms: promptAssemblyMs,
      model_call_ms: modelCallMs,
      parse_validation_ms: parseValidationMs,
      total_ms: totalMs,
      configured_timeout_ms: effectiveOpenAiTimeoutMs,
      configured_max_tokens: configuredMaxTokens,
      usage_prompt_tokens: completion.usage?.prompt_tokens ?? null,
      usage_completion_tokens: completion.usage?.completion_tokens ?? null,
      usage_total_tokens: completion.usage?.total_tokens ?? null,
      error: retriedForLength ? "empty_response_after_retry" : "empty_response",
    });
    throw new Error(diagnosticMessage);
  }

  // P0: Check finish_reason — log a warning if the model stopped due to token limit
  const finishReasonWarning = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined;
  if (finishReasonWarning === "length") {
    console.warn("[Pass2] finish_reason=length — output may be truncated", {
      model: selectedModel,
      maxOutputTokens: activeMaxTokens,
      responseLen: responseText.length,
      usage: completion.usage,
    });
  }

  const completionWithIds = completion as { request_id?: unknown; id?: unknown };
  const requestId =
    typeof completionWithIds.request_id === "string"
      ? completionWithIds.request_id
      : typeof completionWithIds.id === "string"
      ? completionWithIds.id
      : undefined;

  opts._onCompletion?.({
    pass: 2,
    raw_text: responseText,
    model: selectedModel,
    usage: completion.usage,
    finish_reason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined,
    request_id: requestId,
    generated_at: new Date().toISOString(),
  });

  const finishReason = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";

  let parsedOutput: SinglePassOutput;
  try {
    parsedOutput = parsePass2Response(responseText, selectedModel);
  } catch (error) {
    console.error("[Pass2] Parse boundary diagnostic", {
      job_id: opts.jobId ?? null,
      manuscript_id: opts.manuscriptId ?? null,
      title: opts.title,
      model: selectedModel,
      request_id: requestId ?? null,
      finish_reason: finishReason,
      usage_prompt_tokens: completion.usage?.prompt_tokens ?? null,
      usage_completion_tokens: completion.usage?.completion_tokens ?? null,
      usage_total_tokens: completion.usage?.total_tokens ?? null,
      output_chars: responseText.length,
      raw_head: responseText.slice(0, 1000),
      raw_tail: responseText.slice(-500),
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  const parseValidationMs = nowMs() - parseValidationStartMs;
  const totalMs = nowMs() - passStartMs;

  console.log("[Pass2][Timing]", {
    stage: "success",
    model: selectedModel,
    input_chars: inputChars,
    output_chars: responseText.length,
    prompt_assembly_ms: promptAssemblyMs,
    model_call_ms: modelCallMs,
    parse_validation_ms: parseValidationMs,
    total_ms: totalMs,
    configured_timeout_ms: effectiveOpenAiTimeoutMs,
    configured_max_tokens: configuredMaxTokens,
    usage_prompt_tokens: completion.usage?.prompt_tokens ?? null,
    usage_completion_tokens: completion.usage?.completion_tokens ?? null,
    usage_total_tokens: completion.usage?.total_tokens ?? null,
  });

  const promptCoverage = summarizePromptCoverage(opts.manuscriptText);

  return {
    ...parsedOutput,
    coverage_summary: {
      route: "direct_window",
      fully_evaluated: !promptCoverage.truncated,
    },
  };
}

/**
 * Build the default OpenAI completion function.
 * Separated so the constructor is only called when no DI override is provided.
 */
function defaultCreateCompletion(openaiApiKey?: string, openAiTimeoutMs?: number): CreateCompletionFn {
  const apiKey = openaiApiKey ?? getEvaluationRuntimeConfig().openaiApiKey;
  if (!apiKey) {
    throw new Error("[Pass2] OPENAI_API_KEY is not configured");
  }
  const timeoutMs = openAiTimeoutMs ?? getEvalOpenAiTimeoutMs();
  const openai = new OpenAI({ apiKey, maxRetries: OPENAI_SDK_MAX_RETRIES, timeout: timeoutMs });
  return (params) =>
    openai.chat.completions.create(
      params as Parameters<typeof openai.chat.completions.create>[0],
      { timeout: timeoutMs },
    ) as Promise<{
      choices: CompletionChoice[];
      usage?: CompletionUsage;
    }>;
}

function hasTextualAnchor(reasoning: string, evidence: EvidenceAnchor[]): boolean {
  if (/["“”][^"“”]{8,}["“”]/.test(reasoning)) {
    return true;
  }

  return evidence.some((anchor) => {
    const snippet = (anchor.snippet ?? "").trim();
    if (/["“”][^"“”]{8,}["“”]/.test(snippet)) {
      return true;
    }

    return snippet.length >= 20;
  });
}

/**
 * Parse and validate a raw OpenAI response for Pass 2.
 * Pure function — no I/O, deterministic, fully testable.
 *
 * @param raw Unknown JSON object from OpenAI
 * @returns Validated SinglePassOutput with axis="editorial_literary"
 * @throws on invalid structure, empty criteria, or parse errors
 */
export function parsePass2Response(raw: string, fallbackModel?: string): SinglePassOutput {
  const resolvedFallback =
    typeof fallbackModel === "string" && fallbackModel.length > 0
      ? fallbackModel
      : getCanonicalPass2Model(undefined);
  // P0: Log raw response preview before parse
  console.log(`[Pass2] raw response preview len=${raw.length}: ${raw.slice(0, 200)}`);

  let parsed: Record<string, unknown>;
  try {
    const boundary = parseJsonObjectBoundary<Record<string, unknown>>(raw, {
      label: "Pass2",
    });
    parsed = boundary.value;
  } catch (error) {
    if (error instanceof JsonBoundaryError) {
      throw new Error(`[Pass2] ${error.code}: ${error.message}`);
    }
    throw new Error("[Pass2] JSON_PARSE_FAILED_MALFORMED: Response is not valid JSON (malformed JSON)");
  }

  const obj = parsed;
  const rawCriteria = Array.isArray(obj["criteria"]) ? (obj["criteria"] as unknown[]) : [];

  if (rawCriteria.length === 0) {
    throw new Error("[Pass2] Response contains no criteria");
  }

  const criteria: AxisCriterionResult[] = [];
  for (const item of rawCriteria) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    const key = String(c["key"] ?? "");
    if (!(CRITERIA_KEYS as readonly string[]).includes(key)) continue;

    const evidence: EvidenceAnchor[] = Array.isArray(c["evidence"])
      ? (c["evidence"] as unknown[]).map((e) => {
          const ev = e as Record<string, unknown>;
          return {
            snippet: String(ev["snippet"] ?? "").substring(0, 200),
            char_start: typeof ev["char_start"] === "number" ? ev["char_start"] : undefined,
            char_end: typeof ev["char_end"] === "number" ? ev["char_end"] : undefined,
          };
        })
      : [];

    const recommendations = Array.isArray(c["recommendations"])
      ? (c["recommendations"] as unknown[]).map((r) => {
          const rec = r as Record<string, unknown>;
          const priority = String(rec["priority"] ?? "medium");
          return {
            priority: (priority === "high" || priority === "low" ? priority : "medium") as "high" | "medium" | "low",
            action: String(rec["action"] ?? ""),
            expected_impact: String(rec["expected_impact"] ?? ""),
            anchor_snippet: String(rec["anchor_snippet"] ?? ""),
            issue_family:
              (rec["issue_family"] ?? "scene_structure") as AxisCriterionResult["recommendations"][number]["issue_family"],
            strategic_lever:
              (rec["strategic_lever"] ?? "scene_goal_clarity") as AxisCriterionResult["recommendations"][number]["strategic_lever"],
            revision_granularity:
              (rec["revision_granularity"] ?? "scene") as AxisCriterionResult["recommendations"][number]["revision_granularity"],
          };
        })
      : [];

    const rawScore = c["score_0_10"];
    const score = Number.isFinite(Number(rawScore)) ? Math.round(Number(rawScore)) : 0;
    const rationale = String(c["rationale"] ?? "");

    const reasonCodes: string[] = [];
    let boundedScore = Math.min(10, Math.max(0, score));
    if (!hasTextualAnchor(rationale, evidence)) {
      reasonCodes.push("NO_TEXTUAL_ANCHOR");
      boundedScore = Math.min(boundedScore, 5);
    }

    criteria.push({
      key: key as AxisCriterionResult["key"],
      score_0_10: boundedScore,
      reason_codes: reasonCodes.length > 0 ? reasonCodes : undefined,
      rationale,
      evidence,
      recommendations,
    });
  }

  return {
    pass: 2,
    axis: "editorial_literary",
    criteria,
    model: String(obj["model"] ?? resolvedFallback),
    prompt_version: PASS2_PROMPT_VERSION,
    temperature: PASS2_TEMPERATURE,
    generated_at: new Date().toISOString(),
  };
}
