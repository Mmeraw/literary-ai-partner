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
import { getCanonicalPass1Model } from "@/lib/evaluation/policy";
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
  const parsed = parseJsonObjectBoundary(raw);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).characters)
  ) {
    throw new Error(
      `[Pass1A] Chunk ${chunkIndex}: invalid response shape — missing characters array`,
    );
  }

  const data = parsed as Record<string, unknown>;
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
}): Promise<Pass1aChunkOutput> {
  const { chunk, title, workType, openai, model } = params;

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
        temperature: PASS1A_TEMPERATURE,
        max_completion_tokens: activeMaxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PASS1A_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      });

      const rawContent = completion.choices?.[0]?.message?.content;
      if (typeof rawContent !== "string" || rawContent.trim() === "") {
        throw new Error(
          `[Pass1A] Chunk ${chunk.chunk_index}: empty response (model=${model})`,
        );
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

export interface RunPass1aOptions {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  title: string;
  workType: string;
  openaiApiKey?: string;
  jobId?: string;
}

export interface RunPass1aResult {
  chunkOutputs: Pass1aChunkOutput[];
  /** Chunks that failed after retries — non-fatal: reducer works with partial data */
  failedChunkIndices: number[];
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

  const settled = await runChunksWithConcurrency(
    chunks,
    PASS1A_CHUNK_CONCURRENCY,
    (chunk) =>
      runSingleChunk({
        chunk,
        title: opts.title,
        workType: opts.workType,
        openai,
        model,
      }),
  );

  const chunkOutputs: Pass1aChunkOutput[] = [];
  const failedChunkIndices: number[] = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      chunkOutputs.push(result.value);
    } else {
      failedChunkIndices.push(chunks[i].chunk_index);
      console.error("[Pass1A] Chunk failed after retries", {
        job_id: opts.jobId ?? null,
        chunk_index: chunks[i].chunk_index,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
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
    model,
    prompt_version: PASS1A_PROMPT_VERSION,
    total_chunks: chunks.length,
    successful_chunks: chunkOutputs.length,
  };
}
