/**
 * Pass 1A — Character Evidence Sweep Runner
 *
 * Runs IN PARALLEL with Pass 1 and Pass 2 via Promise.allSettled.
 * Never receives Pass 1 or Pass 2 output — full independence.
 * Processes all manuscript chunks with the same concurrency pattern as runPass1.
 * Output feeds characterReducer → Pass1aCharacterLedger → Pass 3 + Pass 3b.
 *
 * Temperature: 0.2 (lower than Pass 1/2 — evidence capture, not analysis)
 * Model: same as Pass 1 model (configurable via EVAL_PASS1A_MODEL env)
 */

import OpenAI from "openai";
import {
  PASS1A_SYSTEM_PROMPT,
  PASS1A_PROMPT_VERSION,
  buildPass1aUserPrompt,
} from "./prompts/pass1a-character-sweep";
import type {
  Pass1aChunkOutput,
  Pass1aCharacterChunkEntry,
} from "./types";
import type { ManuscriptChunkEvidence, CompletionUsage } from "./types";
import { getCanonicalPass1Model, isReasoningStyleModel } from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";

const PASS1A_TEMPERATURE = 0.2;
const PASS1A_MAX_OUTPUT_TOKENS = 16_000;          // raised from 4096 — prevents JSON_PARSE_FAILED_TRUNCATED
const PASS1A_LENGTH_RETRY_MAX_OUTPUT_TOKENS = 16_000; // ceiling for length-retry doubling
const PASS1A_DEFAULT_MODEL = "gpt-5.1";

// Slightly lower concurrency than Pass 1/2 to avoid TPM ceiling when all 3 run in parallel.
// Pass 1 (c=7) + Pass 2 (c=7) + Pass 1A (c=5) = 19 simultaneous calls max.
const PASS1A_CHUNK_CONCURRENCY = 5;
const PASS1A_CHUNK_RETRY_MAX = 3;                  // raised from 2 — extra retry budget for length expansion
const PASS1A_CHUNK_RETRY_BASE_MS = 8000;
const PASS1A_CHUNK_TIMEOUT_MS = 45_000; // kept for reference; actual timeout is OpenAI client-level

// Hard caps — mirror of prompt rules, enforced post-parse
const CAPS = {
  maxCharacters: 10,
  maxEvidenceAnchors: 2,
  maxRelationshipSignals: 3,
  maxSymbolicObjects: 6,
  maxExcerptChars: 120,
} as const;

function resolvePass1aModel(): string {
  const envOverride = process.env.EVAL_PASS1A_MODEL;
  if (envOverride && envOverride.trim()) return envOverride.trim();
  return getCanonicalPass1Model(PASS1A_DEFAULT_MODEL);
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(reason: unknown): boolean {
  const text = String(reason instanceof Error ? reason.message : reason).toLowerCase();
  return text.includes("429") || text.includes("rate limit") || text.includes("tokens per min");
}

function isTruncationError(reason: unknown): boolean {
  const text = String(reason instanceof Error ? reason.message : reason).toLowerCase();
  return (
    text.includes("truncated") ||
    text.includes("json_parse_failed_truncated") ||
    text.includes("json extraction failed")
  );
}

function isTimeoutError(reason: unknown): boolean {
  const text = String(reason instanceof Error ? reason.message : reason).toLowerCase();
  return (
    text.includes("request timed out") ||
    text.includes("timeout") ||
    text.includes("etimedout") ||
    text.includes("econnreset") ||
    text.includes("socket hang up") ||
    text.includes("network error") ||
    (reason instanceof Error && reason.name === "AbortError")
  );
}

function nextLengthRetryTokens(current: number): number {
  return Math.min(PASS1A_LENGTH_RETRY_MAX_OUTPUT_TOKENS, Math.max(8000, current * 2));
}

function parseRetryAfterMs(reason: unknown): number | null {
  const text = String(reason instanceof Error ? reason.message : reason);
  const secMatch = text.match(/try again in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (secMatch) {
    const sec = Number.parseFloat(secMatch[1]);
    if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec * 1000);
  }
  return null;
}

/**
 * Enforce hard caps on a single character entry post-parse.
 * Trims arrays silently — never throws.
 */
function enforceCaps(entry: Pass1aCharacterChunkEntry): Pass1aCharacterChunkEntry {
  return {
    ...entry,
    evidence_anchors: (entry.evidence_anchors ?? [])
      .slice(0, CAPS.maxEvidenceAnchors)
      .map((a) => ({
        ...a,
        excerpt: typeof a.excerpt === "string"
          ? a.excerpt.slice(0, CAPS.maxExcerptChars)
          : "",
      })),
    relationship_signals: (entry.relationship_signals ?? []).slice(0, CAPS.maxRelationshipSignals),
    symbolic_objects: (entry.symbolic_objects ?? []).slice(0, CAPS.maxSymbolicObjects),
    aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
    pronouns: Array.isArray(entry.pronouns) ? entry.pronouns : [],
    lgbtq_signals: Array.isArray(entry.lgbtq_signals) ? entry.lgbtq_signals : [],
    racial_ethnic_signals: Array.isArray(entry.racial_ethnic_signals) ? entry.racial_ethnic_signals : [],
    skin_tone_signals: Array.isArray(entry.skin_tone_signals) ? entry.skin_tone_signals : [],
    language_signals: Array.isArray(entry.language_signals) ? entry.language_signals : [],
    religion_signals: Array.isArray(entry.religion_signals) ? entry.religion_signals : [],
    socioeconomic_signals: Array.isArray(entry.socioeconomic_signals) ? entry.socioeconomic_signals : [],
    nationality_signals: Array.isArray(entry.nationality_signals) ? entry.nationality_signals : [],
    disability_neuro_signals: Array.isArray(entry.disability_neuro_signals) ? entry.disability_neuro_signals : [],
  };
}

function parsePass1aResponse(
  raw: string,
  chunkIndex: number,
): Pass1aChunkOutput {
  // parseJsonObjectBoundary returns JsonBoundaryParseResult<T> — the parsed
  // object lives in .value, not at the top level. Throws JsonBoundaryError on
  // parse failure (truncated, malformed, etc.) — caught by retry loop above.
  const result = parseJsonObjectBoundary(raw);
  const data = result.value;

  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as Record<string, unknown>).characters)
  ) {
    const keys = typeof data === "object" && data !== null
      ? Object.keys(data as object).join(", ")
      : typeof data;
    console.error("[Pass1A] Invalid response shape", {
      chunk_index: chunkIndex,
      top_level_keys: keys,
      raw_head: raw.slice(0, 400),
      raw_tail: raw.slice(-200),
    });
    throw new Error(
      `[Pass1A] Chunk ${chunkIndex}: invalid response shape — missing characters array. Top-level keys: [${keys}]`,
    );
  }
  const characters = (data.characters as Pass1aCharacterChunkEntry[])
    .slice(0, CAPS.maxCharacters)
    .map(enforceCaps);

  return {
    pass: "1a",
    axis: "character_evidence_sweep",
    chunk_index: chunkIndex,
    characters,
    prompt_version: PASS1A_PROMPT_VERSION,
    generated_at:
      typeof data.generated_at === "string"
        ? data.generated_at
        : new Date().toISOString(),
  };
}

async function runSingleChunk(params: {
  chunk: ManuscriptChunkEvidence;
  title: string;
  workType: string;
  openai: OpenAI;
  model: string;
  chunkCache?: Map<number, Pass1aChunkOutput>;
}): Promise<Pass1aChunkOutput> {
  const { chunk, title, workType, openai, model, chunkCache } = params;

  // PR-E chunk checkpoint: if this chunk is already in the pre-loaded cache,
  // return it immediately without calling OpenAI. The cache entry was previously
  // validated before being stored, so it is trusted as-is.
  if (chunkCache?.has(chunk.chunk_index)) {
    return chunkCache.get(chunk.chunk_index)!;
  }

  const userPrompt = buildPass1aUserPrompt({
    manuscriptText: chunk.content,
    chunkIndex: chunk.chunk_index,
    title,
    workType,
  });

  let lastError: unknown;
  let activeMaxTokens = PASS1A_MAX_OUTPUT_TOKENS;

  for (let attempt = 0; attempt <= PASS1A_CHUNK_RETRY_MAX; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        ...(isReasoningStyleModel(model) ? {} : { temperature: PASS1A_TEMPERATURE }),
        max_completion_tokens: activeMaxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PASS1A_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const rawContent = completion.choices?.[0]?.message?.content;
      const finishReason = completion.choices?.[0]?.finish_reason;
      if (typeof rawContent !== "string" || rawContent.trim() === "") {
        throw new Error(
          `[Pass1A] Chunk ${chunk.chunk_index}: empty response (model=${model}, finish_reason=${finishReason})`,
        );
      }

      // Debug: log finish_reason and first 200 chars of response
      if (finishReason && finishReason !== "stop") {
        console.warn("[Pass1A] Non-stop finish_reason", {
          chunk_index: chunk.chunk_index,
          finish_reason: finishReason,
          response_head: rawContent.slice(0, 200),
        });
      }

      return parsePass1aResponse(rawContent, chunk.chunk_index);
    } catch (err) {
      lastError = err;
      if (attempt < PASS1A_CHUNK_RETRY_MAX) {
        if (isTruncationError(err)) {
          // Length retry: double the token budget and retry immediately
          const expanded = nextLengthRetryTokens(activeMaxTokens);
          console.warn("[Pass1A] Truncation detected — expanding token budget", {
            chunk_index: chunk.chunk_index,
            attempt,
            old_tokens: activeMaxTokens,
            new_tokens: expanded,
          });
          activeMaxTokens = expanded;
          // No sleep needed — not a rate limit or server error
        } else {
          const retryAfterMs =
            isRateLimitError(err) || isTimeoutError(err)
              ? (parseRetryAfterMs(err) ?? PASS1A_CHUNK_RETRY_BASE_MS * Math.pow(2, attempt))
              : PASS1A_CHUNK_RETRY_BASE_MS * Math.pow(2, attempt);
          await sleepMs(retryAfterMs);
        }
      }
    }
  }

  throw lastError;
}

async function runChunksWithConcurrency(
  chunks: ManuscriptChunkEvidence[],
  concurrency: number,
  worker: (chunk: ManuscriptChunkEvidence) => Promise<Pass1aChunkOutput>,
): Promise<Array<PromiseSettledResult<Pass1aChunkOutput>>> {
  const settled: Array<PromiseSettledResult<Pass1aChunkOutput>> = new Array(chunks.length);
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= chunks.length) return;
      try {
        settled[index] = { status: "fulfilled", value: await worker(chunks[index]) };
      } catch (reason) {
        settled[index] = { status: "rejected", reason };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, chunks.length) }, () => runWorker()),
  );
  return settled;
}

/**
 * PR-E chunk checkpoint: shape of a single entry in the pass1a_chunk_cache_v1
 * artifact. Stored keyed by chunk_index so resume reads can skip already-completed
 * chunks after a wall-clock kill.
 */
export interface Pass1aChunkCacheEntry {
  chunk_index: number;
  result: Pass1aChunkOutput;
  completed_at: string; // ISO timestamp
}

/**
 * Top-level shape of the pass1a_chunk_cache_v1 evaluation_artifact content.
 * source_hash formula matches Pass1ChunkCacheArtifact exactly:
 *   SHA-256 of "${job_id}:${manuscript_id}:${chunk_count}"
 */
export interface Pass1aChunkCacheArtifact {
  job_id: string;
  source_hash: string;
  chunks: Record<number, Pass1aChunkCacheEntry>; // key = chunk_index as string in JSON
  total_expected: number;
  cached_at: string;
}

export interface RunPass1aOptions {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  title: string;
  workType: string;
  openaiApiKey?: string;
  jobId?: string;
  /**
   * PR-E chunk checkpoint: pre-loaded cache from a pass1a_chunk_cache_v1 artifact.
   * When provided, any chunk_index present in this map is returned immediately
   * without calling OpenAI, allowing Pass 1A to resume from the last checkpoint
   * after a job is retried following a wall-clock kill.
   */
  _chunkCache?: Map<number, Pass1aChunkOutput>;
  /**
   * PR-E chunk checkpoint: callback fired after each chunk successfully completes
   * (either from cache or from a fresh OpenAI call). Allows the processor to write
   * rolling checkpoint upserts to the pass1a_chunk_cache_v1 artifact.
   * Fail-soft: errors thrown by this callback are logged but do NOT fail the chunk.
   */
  _onChunkComplete?: (chunk_index: number, result: Pass1aChunkOutput) => Promise<void>;
}

export interface RunPass1aResult {
  chunkOutputs: Pass1aChunkOutput[];
  /** Chunks that failed after retries — non-fatal: reducer works with partial data */
  failedChunkIndices: number[];
  /** Per-chunk failure details for diagnostics and explicit zero-output failures */
  failedChunkErrors: Array<{ chunk_index: number; error: string }>;
  model: string;
  prompt_version: string;
  total_chunks: number;
  successful_chunks: number;
}

/**
 * Main entry point — called from runPipeline in the parallel block.
 * Returns all successfully-parsed chunk outputs.
 * NEVER throws — partial failure is logged and passed to reducer.
 * Pass 3 degrades gracefully if Pass 1A fails entirely.
 */
export async function runPass1a(opts: RunPass1aOptions): Promise<RunPass1aResult> {
  const model = resolvePass1aModel();
  const timeoutMs = getEvalOpenAiTimeoutMs();

  const openai = new OpenAI({
    apiKey: opts.openaiApiKey ?? process.env.OPENAI_API_KEY,
    timeout: timeoutMs,
    maxRetries: 0, // retries handled in runSingleChunk
  });

  // Determine chunks — same pattern as runPass1
  const chunks: ManuscriptChunkEvidence[] =
    Array.isArray(opts.manuscriptChunks) && opts.manuscriptChunks.length > 0
      ? [...opts.manuscriptChunks].sort((a, b) => a.chunk_index - b.chunk_index)
      : [{ chunk_index: 0, content: opts.manuscriptText }];

  console.log("[Pass1A] Starting character evidence sweep", {
    job_id: opts.jobId ?? null,
    title: opts.title,
    total_chunks: chunks.length,
    model,
    concurrency: PASS1A_CHUNK_CONCURRENCY,
  });

  const chunkCache = opts._chunkCache;
  const onChunkComplete = opts._onChunkComplete;

  const settled = await runChunksWithConcurrency(
    chunks,
    PASS1A_CHUNK_CONCURRENCY,
    async (chunk) => {
      const result = await runSingleChunk({
        chunk,
        title: opts.title,
        workType: opts.workType,
        openai,
        model,
        chunkCache,
      });

      // PR-E: rolling checkpoint upsert. Fail-soft: callback errors are logged
      // but do NOT fail the chunk. Fires for both cache hits and fresh results
      // so the rolling artifact stays timestamp-refreshed across retries.
      if (onChunkComplete) {
        try {
          await onChunkComplete(chunk.chunk_index, result);
        } catch (cbErr) {
          console.warn(
            `[Pass1A] _onChunkComplete threw for chunk ${chunk.chunk_index} (non-fatal)`,
            cbErr instanceof Error ? cbErr.message : String(cbErr),
          );
        }
      }

      return result;
    },
  );

  const chunkOutputs: Pass1aChunkOutput[] = [];
  const failedChunkIndices: number[] = [];
  const failedChunkErrors: Array<{ chunk_index: number; error: string }> = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      chunkOutputs.push(result.value);
    } else {
      const chunkIndex = chunks[i].chunk_index;
      const errorText = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failedChunkIndices.push(chunkIndex);
      failedChunkErrors.push({
        chunk_index: chunkIndex,
        error: errorText,
      });
      console.error("[Pass1A] Chunk failed after retries", {
        job_id: opts.jobId ?? null,
        chunk_index: chunkIndex,
        error: errorText,
      });
    }
  }

  console.log("[Pass1A] Sweep complete", {
    job_id: opts.jobId ?? null,
    total_chunks: chunks.length,
    successful_chunks: chunkOutputs.length,
    failed_chunks: failedChunkIndices.length,
  });

  return {
    chunkOutputs,
    failedChunkIndices,
    failedChunkErrors,
    model,
    prompt_version: PASS1A_PROMPT_VERSION,
    total_chunks: chunks.length,
    successful_chunks: chunkOutputs.length,
  };
}
