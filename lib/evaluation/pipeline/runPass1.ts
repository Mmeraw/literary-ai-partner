/**
 * Phase 2.7 — Pass 1: Craft Execution Runner
 *
 * Calls OpenAI with the craft execution prompt and parses the response
 * into a validated SinglePassOutput.
 *
 * Temperature: 0.3 (per Vol III Tools §PASS1)
 * Effective max tokens: runtime-configured budget with one bounded length retry.
 */

import OpenAI from "openai";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS1_SYSTEM_PROMPT, PASS1_PROMPT_VERSION, buildPass1UserPrompt } from "./prompts/pass1-craft";
import type { SinglePassOutput, AxisCriterionResult, EvidenceAnchor, CompletionUsage, PassCompletionCapture, ManuscriptChunkEvidence } from "./types";
import type { CanonRegistry } from "@/lib/governance/canonRegistry";
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPass1Model,
  OPENAI_SDK_MAX_RETRIES,
} from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { emitLatencyTrace } from "@/lib/observability/latencyTrace";
import { JsonBoundaryError, parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";
import { summarizePromptCoverage } from "./promptInput";
import { countWords } from "./submissionScope";
import { getConfiguredChunkCap } from "./chunkCap";
import {
  ChunkCountExceedsCapError,
  ChunkRoutingNotEngagedError,
} from "./failures";
import { annotateWeakCriteria, getPass1WeakCriteriaThreshold } from "./weakCriteriaCheck";
const PASS1_TEMPERATURE = 0.3;

// Mirror of processor.ts STRUCTURAL_CHUNKING_THRESHOLD_WORDS. Kept duplicated
// here to avoid a circular import — processor.ts pulls from pipeline modules.
const STRUCTURAL_CHUNKING_THRESHOLD_WORDS = 3_000;

const PASS1_LENGTH_RETRY_MAX_OUTPUT_TOKENS = 16000;
const PASS1_LIMITS = {
  maxRationaleChars: 220,
  maxEvidencePerCriterion: 1,
  maxEvidenceSnippetChars: 180,
} as const;
const DEFAULT_CHUNK_PASS_CONCURRENCY = 3;
const DEFAULT_CHUNK_RETRY_MAX = 3;
const DEFAULT_CHUNK_RETRY_BASE_MS = 10000;

/**
 * Pass 1 model is not caller-controlled.
 *
 * Resolution order:
 *  1) EVAL_PASS1_MODEL
 *  2) EVAL_CHUNK_MODEL
 *  3) default baseline model (gpt-5.1)
 */
const PASS1_DEFAULT_MODEL = "gpt-5.1";

function resolvePass1Model(): string {
  return getCanonicalPass1Model(PASS1_DEFAULT_MODEL);
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

function getEffectivePass1MaxTokens(): number {
  return getEvaluationRuntimeConfig().pass.pass1MaxTokens;
}

function getRetryPass1MaxTokens(currentMaxTokens: number): number {
  return Math.min(PASS1_LENGTH_RETRY_MAX_OUTPUT_TOKENS, Math.max(4000, currentMaxTokens * 2));
}

function truncateText(value: unknown, maxChars: number): string {
  const text = String(value ?? "").trim();
  return text.length > maxChars ? text.slice(0, maxChars).trimEnd() : text;
}

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
  effectiveMaxTokens: number;
  jobId?: string;
  retryExhausted?: boolean;
}): string {
  const { model, completion, firstChoice, rawContent, effectiveMaxTokens, jobId, retryExhausted } = params;
  const usage = completion.usage;
  const finishReason =
    typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";
  const contentType =
    rawContent === null ? "null" : Array.isArray(rawContent) ? "array" : typeof rawContent;
  const refusal =
    typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined;
  const choiceCount = Array.isArray(completion.choices) ? completion.choices.length : 0;
  const code =
    finishReason === "length"
      ? retryExhausted
        ? "PASS1_LENGTH_RETRY_EXHAUSTED"
        : "PASS1_TRUNCATED_EMPTY_RESPONSE"
      : "PASS1_EMPTY_RESPONSE";
  const safeJobId = typeof jobId === "string" && jobId.trim() !== "" ? jobId : "unknown";
  const exhaustionMessage = retryExhausted ? "Pass 1 exhausted length retry. " : "";

  return (
    `[Pass1] ${code} ${exhaustionMessage}Empty response from OpenAI ` +
    `(model=${model} finish_reason=${finishReason} content_type=${contentType} choices=${choiceCount} ` +
    `job_id=${safeJobId} ` +
    `max_output_tokens=${effectiveMaxTokens}` +
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
 * Aggregates multiple SinglePassOutput results from chunk evaluations.
 * Combines evidence, averages scores, and deduplicates recommendations.
 */
function aggregateChunkResults(results: SinglePassOutput[]): SinglePassOutput {
  if (results.length === 0) {
    throw new Error("[Pass1] No chunk results to aggregate");
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

    // Merge evidence from all chunks
    const mergedEvidence: EvidenceAnchor[] = [];
    const seenSnippets = new Set<string>();

    for (const crit of criteriaForKey) {
      for (const ev of crit.evidence) {
        const snippetKey = ev.snippet?.trim() || "";
        if (snippetKey && !seenSnippets.has(snippetKey)) {
          mergedEvidence.push(ev);
          seenSnippets.add(snippetKey);
        }
      }
    }

    // PR-D: Average only over chunks with a valid score in canonical range [1,10].
    // Chunks with a missing or invalid score (parser produced null) do not vote.
    const validScoreEntries = criteriaForKey.filter(
      (c) => typeof c.score_0_10 === "number" && c.score_0_10 >= 1 && c.score_0_10 <= 10
    );

    if (validScoreEntries.length === 0) {
      throw new Error(
        `PASS1_CHUNK_AGGREGATE_SCORE_MISSING ${JSON.stringify({
          code: "PASS1_CHUNK_AGGREGATE_SCORE_MISSING",
          criterion: key,
          chunks_total: criteriaForKey.length,
          valid_score_chunks: 0,
          invalid_score_chunks: criteriaForKey.length,
        })}`
      );
    }

    const avgScore = Math.round(
      validScoreEntries.reduce((sum, c) => sum + c.score_0_10, 0) / validScoreEntries.length
    );

    // Merge rationales (use first, they should be similar since from same criterion across chunks)
    const firstRationale = criteriaForKey[0]?.rationale || "";

    aggregatedCriteria.push({
      key,
      // PR-D: canonical floor is 1, never 0
      score_0_10: Math.min(10, Math.max(1, avgScore)),
      rationale: firstRationale,
      evidence: mergedEvidence.slice(0, PASS1_LIMITS.maxEvidencePerCriterion),
      recommendations: [],
    });
  }

  return {
    pass: 1,
    axis: "craft_execution",
    criteria: aggregatedCriteria,
    model: results[0].model,
    prompt_version: PASS1_PROMPT_VERSION,
    temperature: PASS1_TEMPERATURE,
    generated_at: new Date().toISOString(),
  };
}

import type { SubmissionScopeProfile } from "./submissionScope";

export interface RunPass1Options {
  scopeProfile?: SubmissionScopeProfile;
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  /** Marks an already-materialized chunk in chunk-native execution. */
  isChunkUnit?: boolean;
  workType: string;
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  registry: CanonRegistry;
  // NOTE: model is intentionally absent — Pass1 model authority is not caller-controlled.
  /**
   * Explicit API key override. Pass `null` to force "no key" in tests without
   * relying on process.env mutation (prevents fallback to runtime config).
   * Omit (undefined) to fall back to getEvaluationRuntimeConfig().openaiApiKey.
   */
  openaiApiKey?: string | null;
  /** Optional provider timeout override from pipeline-level scoped resolution. */
  openAiTimeoutMs?: number;
  /** Job ID forwarded from the processor for latency trace correlation. */
  jobId?: string;
  /** Override the completion function (for testing). Production callers omit this. */
  _createCompletion?: CreateCompletionFn;
  _onCompletion?: (capture: PassCompletionCapture) => void;
}

/**
 * Run Pass 1 — Craft Execution analysis.
 * Returns a validated SinglePassOutput with axis="craft_execution".
 * Throws on OpenAI error or unparseable response.
 */
export async function runPass1(opts: RunPass1Options): Promise<SinglePassOutput> {
  const passStartMs = nowMs();
  const selectedModel = resolvePass1Model();

  if (!opts.registry || opts.registry.size === 0) {
    throw new Error("[Pass1] Canonical registry binding missing");
  }

  // ─── CHUNK-NATIVE ROUTING (Long-Form Path) ──────────────────────────────
  // If chunks are present and count > 1, evaluate each chunk independently
  // and aggregate results. Otherwise, fall through to single-pass window path.
  const hasChunks = Array.isArray(opts.manuscriptChunks) && opts.manuscriptChunks.length > 1;
  if (hasChunks) {
    const chunksTotal = opts.manuscriptChunks!.length;
    const chunkConcurrency = getChunkPassConcurrency();
    const chunkCap = getConfiguredChunkCap();
    const chunkRetryMax = getChunkRetryMax();
    const chunkRetryBaseMs = getChunkRetryBaseMs();
    // Fail-closed: NEVER silently truncate chunks. If a manuscript produces
    // more chunks than the per-pass cap, the evaluation must fail with a clear
    // diagnostic — "every word is evaluated, or the job fails."
    if (opts.manuscriptChunks!.length > chunkCap) {
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
      `[Pass1] Chunk-native path: total=${chunksTotal} attempted=${selectedChunks.length} concurrency=${chunkConcurrency}`,
    );

    const settled = await runChunksWithConcurrency(
      selectedChunks,
      chunkConcurrency,
      async (chunk) => {
        let attempt = 0;
        while (true) {
          try {
            return await runPass1({
              ...opts,
              manuscriptText: chunk.content,
              manuscriptChunks: undefined, // Prevent recursive chunking
              isChunkUnit: true,
              _onCompletion: (capture) => {
                if (capture.pass === 1) {
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
              `[Pass1] Chunk ${chunk.chunk_index} rate-limited; retry ${attempt}/${chunkRetryMax} after ${waitMs}ms`,
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
      stage: "pass1",
      state: "pass1_chunk_eval",
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
        `[Pass1] Chunk evaluation failures: failed=${failures.length}/${selectedChunks.length}; first_chunk=${firstFailure.chunkIndex}; first_error=${firstFailure.reason}`,
      );
    }

    const aggregated = aggregateChunkResults(chunkResults);
    const weakThreshold = getPass1WeakCriteriaThreshold();
    const weakAnnotated = annotateWeakCriteria(aggregated, weakThreshold);

    if (weakAnnotated.weakKeys.length > 0) {
      console.warn("[Pass1] weak_criteria_flagged", {
        threshold: weakThreshold,
        weak_keys: weakAnnotated.weakKeys,
      });
    }

    console.log(`[Pass1] Chunk aggregation complete: ${weakAnnotated.output.criteria.length} criteria`);
    return {
      ...weakAnnotated.output,
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
  const pass1WordCount = countWords(opts.manuscriptText);
  if (!opts.isChunkUnit && pass1WordCount >= STRUCTURAL_CHUNKING_THRESHOLD_WORDS) {
    throw new ChunkRoutingNotEngagedError(
      `Pass 1 received ${pass1WordCount} words (≥ ${STRUCTURAL_CHUNKING_THRESHOLD_WORDS}) with ` +
      `no chunks; direct_window fallback would silently timeout. Refusing to dispatch.`,
      {
        code: 'CHUNK_ROUTING_NOT_ENGAGED',
        manuscript_words: pass1WordCount,
        chunk_count: opts.manuscriptChunks?.length ?? 0,
        guard_location: 'runPass1.direct_window_entry',
      },
    );
  }

  const effectiveOpenAiTimeoutMs = opts.openAiTimeoutMs ?? getEvalOpenAiTimeoutMs();
  const createCompletion = opts._createCompletion ?? defaultCreateCompletion(opts.openaiApiKey, effectiveOpenAiTimeoutMs);

  const promptAssemblyStartMs = nowMs();

  const userPrompt = buildPass1UserPrompt({
    manuscriptText: opts.manuscriptText,
    workType: opts.workType,
    title: opts.title,
    executionMode: opts.executionMode,
    scopeProfile: opts.scopeProfile,
  });
  const promptAssemblyMs = nowMs() - promptAssemblyStartMs;
  const inputChars = opts.manuscriptText.length;
  const promptChars = PASS1_SYSTEM_PROMPT.length + userPrompt.length;

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
        { role: "system", content: PASS1_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      ...buildOpenAITemperatureParam(selectedModel, PASS1_TEMPERATURE),
      ...outputTokenParam,
      response_format: { type: "json_object" },
    });

    return { completion, configuredMaxTokens };
  };

  console.log(`[Pass1] completion request model=${selectedModel}`);

  let activeMaxTokens = getEffectivePass1MaxTokens();
  const modelCallStartMs = nowMs();
  let { completion, configuredMaxTokens } = await requestCompletion(activeMaxTokens);
  let modelCallMs = nowMs() - modelCallStartMs;

  const parseValidationStartMs = nowMs();

  let firstChoice = completion.choices?.[0] as CompletionChoice | undefined;
  let rawContent = firstChoice?.message?.content;
  let responseText = extractResponseText(rawContent);
  let retriedForLength = false;
  let lengthRetryExhausted = false;

  if (
    responseText.trim().length === 0 &&
    typeof firstChoice?.finish_reason === "string" &&
    firstChoice.finish_reason === "length"
  ) {
    retriedForLength = true;
    const retryMaxTokens = getRetryPass1MaxTokens(activeMaxTokens);

    if (retryMaxTokens > activeMaxTokens) {
      console.warn("[Pass1] Empty length-limited response; retrying with higher output token budget", {
        model: selectedModel,
        job_id: opts.jobId ?? "unknown",
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
      if (
        responseText.trim().length === 0 &&
        typeof firstChoice?.finish_reason === "string" &&
        firstChoice.finish_reason === "length"
      ) {
        lengthRetryExhausted = true;
      }
    } else {
      lengthRetryExhausted = true;
    }
  }

  if (responseText.trim().length === 0) {
    const diagnosticMessage = buildEmptyResponseDiagnostic({
      model: selectedModel,
      completion,
      firstChoice,
      rawContent,
      effectiveMaxTokens: activeMaxTokens,
      jobId: opts.jobId,
      retryExhausted: lengthRetryExhausted,
    });

    console.error("[Pass1] Completion boundary diagnostic", {
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
      jobId: opts.jobId ?? "unknown",
      retriedForLength,
      lengthRetryExhausted,
      refusal:
        typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined,
    });
    const parseValidationMs = nowMs() - parseValidationStartMs;
    const totalMs = nowMs() - passStartMs;
    emitLatencyTrace({
      job_id: opts.jobId ?? 'unknown',
      stage: 'pass1',
      state: 'pass1_timings_failure',
      metadata: {
        finish_reason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : 'empty_response',
        model: selectedModel,
        input_chars: inputChars,
        prompt_chars: promptChars,
        output_chars: responseText.length,
        prompt_assembly_ms: promptAssemblyMs,
        model_call_ms: modelCallMs,
        parse_validation_ms: parseValidationMs,
        total_ms: totalMs,
        configured_timeout_ms: effectiveOpenAiTimeoutMs,
        configured_max_tokens: configuredMaxTokens,
        active_max_tokens: activeMaxTokens,
        retried_for_length: retriedForLength,
        length_retry_exhausted: lengthRetryExhausted,
        usage_prompt_tokens: completion.usage?.prompt_tokens ?? null,
        usage_completion_tokens: completion.usage?.completion_tokens ?? null,
        usage_total_tokens: completion.usage?.total_tokens ?? null,
      },
    });
    throw new Error(diagnosticMessage);
  }

  const finishReasonWarning = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined;
  if (finishReasonWarning === "length") {
    console.warn("[Pass1] finish_reason=length — output may be truncated", {
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
    pass: 1,
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
    parsedOutput = parsePass1Response(responseText, selectedModel);
  } catch (error) {
    console.error("[Pass1] Parse boundary diagnostic", {
      title: opts.title,
      model: selectedModel,
      request_id: requestId ?? null,
      finish_reason: finishReason,
      configured_max_tokens: configuredMaxTokens,
      active_max_tokens: activeMaxTokens,
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

  emitLatencyTrace({
    job_id: opts.jobId ?? 'unknown',
    stage: 'pass1',
    state: 'pass1_timings',
    metadata: {
      model: selectedModel,
      input_chars: inputChars,
      prompt_chars: promptChars,
      output_chars: responseText.length,
      prompt_assembly_ms: promptAssemblyMs,
      model_call_ms: modelCallMs,
      parse_validation_ms: parseValidationMs,
      total_ms: totalMs,
      configured_timeout_ms: effectiveOpenAiTimeoutMs,
      configured_max_tokens: configuredMaxTokens,
      active_max_tokens: activeMaxTokens,
      retried_for_length: retriedForLength,
      usage_prompt_tokens: completion.usage?.prompt_tokens ?? null,
      usage_completion_tokens: completion.usage?.completion_tokens ?? null,
      usage_total_tokens: completion.usage?.total_tokens ?? null,
    },
  });

  const weakThreshold = getPass1WeakCriteriaThreshold();
  const weakAnnotated = annotateWeakCriteria(parsedOutput, weakThreshold);

  if (weakAnnotated.weakKeys.length > 0) {
    console.warn("[Pass1] weak_criteria_flagged", {
      threshold: weakThreshold,
      weak_keys: weakAnnotated.weakKeys,
    });
  }

  const promptCoverage = summarizePromptCoverage(opts.manuscriptText);

  return {
    ...weakAnnotated.output,
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
function defaultCreateCompletion(openaiApiKey?: string | null, openAiTimeoutMs?: number): CreateCompletionFn {
  // null = explicit "no key" (test sentinel). undefined = fall back to runtime config.
  const apiKey =
    openaiApiKey === null ? undefined : (openaiApiKey ?? getEvaluationRuntimeConfig().openaiApiKey);
  if (!apiKey) {
    throw new Error("[Pass1] OPENAI_API_KEY is not configured");
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

/**
 * Parse and validate a raw OpenAI response for Pass 1.
 * Pure function — no I/O, deterministic, fully testable.
 * 
 * @param raw Unknown JSON object from OpenAI
 * @returns Validated SinglePassOutput with axis="craft_execution"
 * @throws on invalid structure, empty criteria, or parse errors
 */
export function parsePass1Response(raw: string, fallbackModel: string = PASS1_DEFAULT_MODEL): SinglePassOutput {
  // P0: Log raw response preview before parse
  console.log(`[Pass1] raw response preview len=${raw.length}: ${raw.slice(0, 200)}`);

  let parsed: Record<string, unknown>;
  try {
    const boundary = parseJsonObjectBoundary<Record<string, unknown>>(raw, {
      label: "Pass1",
    });
    parsed = boundary.value;
  } catch (error) {
    if (error instanceof JsonBoundaryError) {
      throw new Error(`[Pass1] ${error.code}: ${error.message}`);
    }
    throw new Error("[Pass1] JSON_PARSE_FAILED_MALFORMED: Response is not valid JSON (malformed JSON)");
  }

  const obj = parsed;
  const rawCriteria = Array.isArray(obj["criteria"]) ? (obj["criteria"] as unknown[]) : [];

  if (rawCriteria.length === 0) {
    throw new Error("[Pass1] Response contains no criteria");
  }

  const criteria: AxisCriterionResult[] = [];
  for (const item of rawCriteria.slice(0, CRITERIA_KEYS.length)) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    const key = String(c["key"] ?? "");
    if (!(CRITERIA_KEYS as readonly string[]).includes(key)) continue;

    const evidence: EvidenceAnchor[] = Array.isArray(c["evidence"])
      ? (c["evidence"] as unknown[]).slice(0, PASS1_LIMITS.maxEvidencePerCriterion).map((e) => {
          const ev = e as Record<string, unknown>;
          return {
            snippet: truncateText(ev["snippet"], PASS1_LIMITS.maxEvidenceSnippetChars),
            char_start: typeof ev["char_start"] === "number" ? ev["char_start"] : undefined,
            char_end: typeof ev["char_end"] === "number" ? ev["char_end"] : undefined,
          };
        })
      : [];

    // PR-D: Reject missing/non-finite/out-of-range scores instead of silently coercing to 0.
    // Canon range is [1,10]; an invalid score yields null so the aggregator can exclude it.
    const rawScore = c["score_0_10"];
    const parsedScore = Number(rawScore);
    const score: number | null =
      Number.isFinite(parsedScore) && Math.round(parsedScore) >= 1 && Math.round(parsedScore) <= 10
        ? Math.round(parsedScore)
        : null;

    criteria.push({
      key: key as AxisCriterionResult["key"],
      // null sentinel for invalid scores; downstream aggregator filters these out
      score_0_10: (score as unknown) as number,
      rationale: truncateText(c["rationale"], PASS1_LIMITS.maxRationaleChars),
      evidence,
      recommendations: [],
    });
  }

  return {
    pass: 1,
    axis: "craft_execution",
    criteria,
    // PR-I (2026-05-16): Provenance must reflect the model that actually executed.
    // The LLM has no reliable knowledge of its own deployment identifier and frequently
    // emits stale literals (commonly "gpt-4.1") that contaminate downstream report stamps.
    // Always trust the resolver-determined fallback. Do NOT consult obj["model"].
    model: String(fallbackModel),
    prompt_version: PASS1_PROMPT_VERSION,
    temperature: PASS1_TEMPERATURE,
    generated_at: new Date().toISOString(),
  };
}
