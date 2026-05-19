/**
 * Perplexity Chunk Scorer — Dual-Model Parallel Scoring
 *
 * Calls sonar-reasoning-pro to score each manuscript chunk on the 13
 * canonical criteria. Output shape mirrors the GPT chunk pass
 * (SinglePassOutput) so the Pass 3 collator can consume both packets.
 *
 * Concurrency: process.env.EVAL_PPLX_CHUNK_CONCURRENCY (default 8).
 * Timeout per request: process.env.EVAL_PPLX_CHUNK_TIMEOUT_MS (default 120_000).
 *
 * Graceful degradation: if PERPLEXITY_API_KEY is missing, this module
 * returns null and the pipeline continues with the GPT-only path.
 *
 * Independence: this scorer never sees GPT scores. It is an independent
 * second evaluation of the manuscript chunks, paired with GPT at Pass 3.
 */

import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type {
  AxisCriterionResult,
  EvidenceAnchor,
  ManuscriptChunkEvidence,
  SinglePassOutput,
} from "./types";
import {
  JsonBoundaryError,
  parseJsonObjectBoundary,
} from "@/lib/llm/jsonParseBoundary";
import { pipelineLog } from "./pipelineLogger";

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const PERPLEXITY_MODEL = "sonar-reasoning-pro";
const PERPLEXITY_TEMPERATURE = 0.1;
const PERPLEXITY_MAX_TOKENS = 8000;
const PERPLEXITY_LENGTH_RETRY_MAX_TOKENS = 12000;

const DEFAULT_PPLX_CHUNK_CONCURRENCY = 8;
const DEFAULT_PPLX_CHUNK_TIMEOUT_MS = 120_000;

const PROMPT_VERSION = "pplx-chunk-scorer-v1";

export interface PerplexityChunkScorerOptions {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  workType: string;
  title: string;
  perplexityApiKey?: string;
  jobId?: string;
  /** Override for testing — provide a mock fetch-like function. */
  _fetch?: typeof fetch;
}

export function getPplxChunkConcurrency(): number {
  const raw = process.env.EVAL_PPLX_CHUNK_CONCURRENCY;
  if (!raw) return DEFAULT_PPLX_CHUNK_CONCURRENCY;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PPLX_CHUNK_CONCURRENCY;
  return Math.min(20, Math.max(1, parsed));
}

export function getPplxChunkTimeoutMs(): number {
  const raw = process.env.EVAL_PPLX_CHUNK_TIMEOUT_MS;
  if (!raw) return DEFAULT_PPLX_CHUNK_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PPLX_CHUNK_TIMEOUT_MS;
  return Math.max(30_000, parsed);
}

function buildSystemPrompt(): string {
  return `You are an independent literary evaluator scoring a manuscript chunk on 13 canonical craft criteria.

Rules:
1. Evaluate the chunk as a standalone artifact.
2. Score each criterion 1-10 (integer; canonical range, never 0).
3. Each criterion MUST include:
   - score (integer 1-10)
   - rationale (1-3 sentences, anchored in the chunk)
   - evidence (one short verbatim quote from the chunk; <= 180 chars)
4. Do not invent evidence. If a criterion has no observable signal, score conservatively (3-5) and note the absence in rationale.
5. Do not perform line-editing or revision advice.
6. Return ONLY valid JSON.

Required schema:
{
  "criteria": {
    "concept": { "score": 7, "rationale": "string", "evidence": "string" },
    "narrativeDrive": { ...same shape... },
    "character": { ...same shape... },
    "voice": { ...same shape... },
    "sceneConstruction": { ...same shape... },
    "dialogue": { ...same shape... },
    "theme": { ...same shape... },
    "worldbuilding": { ...same shape... },
    "pacing": { ...same shape... },
    "proseControl": { ...same shape... },
    "tone": { ...same shape... },
    "narrativeClosure": { ...same shape... },
    "marketability": { ...same shape... }
  }
}

Criteria keys: ${CRITERIA_KEYS.join(", ")}`;
}

function buildUserPrompt(args: {
  chunkContent: string;
  title: string;
  workType: string;
  chunkIndex: number;
  chunkCount: number;
}): string {
  const chunkContext =
    args.chunkCount > 1
      ? `This is chunk ${args.chunkIndex + 1} of ${args.chunkCount}.`
      : `This is the full submission window.`;

  return `MANUSCRIPT TITLE: "${args.title}"
WORK TYPE: ${args.workType}
${chunkContext}

CHUNK TEXT:
${args.chunkContent}

Score all 13 craft criteria on this chunk and return the JSON object as specified.`;
}

type RawPerplexityCriterion = {
  score?: unknown;
  rationale?: unknown;
  evidence?: unknown;
};

function clampScore(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function toShortText(raw: unknown, maxChars: number): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  return text.length > maxChars ? text.slice(0, maxChars).trimEnd() : text;
}

function parseChunkCriteria(
  responseText: string,
  chunkIndex: number,
): AxisCriterionResult[] {
  const boundary = parseJsonObjectBoundary<Record<string, unknown>>(responseText, {
    label: "PplxChunk",
  });
  const parsed = boundary.value;
  const criteriaObj = parsed.criteria;
  if (!criteriaObj || typeof criteriaObj !== "object") {
    throw new Error(
      `[PplxChunk] chunk ${chunkIndex} missing criteria object`,
    );
  }

  const record = criteriaObj as Record<string, RawPerplexityCriterion>;
  const results: AxisCriterionResult[] = [];

  for (const key of CRITERIA_KEYS) {
    const entry = record[key];
    if (!entry || typeof entry !== "object") {
      results.push({
        key,
        score_0_10: 5,
        rationale: `[Perplexity] criterion missing from response for chunk ${chunkIndex}`,
        evidence: [],
        recommendations: [],
      });
      continue;
    }

    const score = clampScore(entry.score);
    const rationale = toShortText(entry.rationale, 220) || `[Perplexity] no rationale provided for ${key}`;
    const evidenceSnippet = toShortText(entry.evidence, 180);
    const evidence: EvidenceAnchor[] = evidenceSnippet
      ? [{ snippet: evidenceSnippet }]
      : [];

    results.push({
      key: key as CriterionKey,
      score_0_10: score,
      rationale,
      evidence,
      recommendations: [],
    });
  }

  return results;
}

function isRetryableBoundary(error: unknown): boolean {
  return (
    error instanceof JsonBoundaryError &&
    (error.code === "JSON_PARSE_FAILED_EMPTY" ||
      error.code === "JSON_PARSE_FAILED_NO_OBJECT" ||
      error.code === "JSON_PARSE_FAILED_TRUNCATED")
  );
}

function extractContent(rawMessageContent: unknown): string {
  if (typeof rawMessageContent === "string") return rawMessageContent;
  if (!Array.isArray(rawMessageContent)) return "";
  return rawMessageContent
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const record = item as { text?: unknown; content?: unknown };
      if (typeof record.text === "string") return record.text;
      if (typeof record.content === "string") return record.content;
      return "";
    })
    .join("")
    .trim();
}

async function callPerplexityForChunk(args: {
  systemPrompt: string;
  userPrompt: string;
  perplexityApiKey: string;
  maxTokens: number;
  timeoutMs: number;
  fetchFn: typeof fetch;
}): Promise<{ rawContent: string; finishReason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await args.fetchFn(`${PERPLEXITY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.userPrompt },
        ],
        temperature: PERPLEXITY_TEMPERATURE,
        max_tokens: args.maxTokens,
        return_citations: false,
        disable_search: true,
        reasoning_effort: "high",
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `[PplxChunk] Perplexity API error ${response.status}: ${errText.slice(0, 400)}`,
      );
    }

    const raw = (await response.json()) as {
      choices?: Array<{
        message?: { content?: unknown };
        finish_reason?: unknown;
      }>;
    };
    const firstChoice = raw.choices?.[0];
    const rawContent = extractContent(firstChoice?.message?.content);
    const finishReason =
      typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";

    return { rawContent, finishReason };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `[PplxChunk] Perplexity request timed out after ${args.timeoutMs}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function scoreChunk(args: {
  chunk: ManuscriptChunkEvidence;
  chunkCount: number;
  title: string;
  workType: string;
  perplexityApiKey: string;
  timeoutMs: number;
  fetchFn: typeof fetch;
}): Promise<AxisCriterionResult[]> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    chunkContent: args.chunk.content,
    title: args.title,
    workType: args.workType,
    chunkIndex: args.chunk.chunk_index,
    chunkCount: args.chunkCount,
  });

  let maxTokens = PERPLEXITY_MAX_TOKENS;
  let result = await callPerplexityForChunk({
    systemPrompt,
    userPrompt,
    perplexityApiKey: args.perplexityApiKey,
    maxTokens,
    timeoutMs: args.timeoutMs,
    fetchFn: args.fetchFn,
  });

  try {
    return parseChunkCriteria(result.rawContent, args.chunk.chunk_index);
  } catch (err) {
    const shouldRetry =
      result.finishReason === "length" || isRetryableBoundary(err);
    if (!shouldRetry) throw err;

    maxTokens = PERPLEXITY_LENGTH_RETRY_MAX_TOKENS;
    result = await callPerplexityForChunk({
      systemPrompt,
      userPrompt,
      perplexityApiKey: args.perplexityApiKey,
      maxTokens,
      timeoutMs: args.timeoutMs,
      fetchFn: args.fetchFn,
    });
    return parseChunkCriteria(result.rawContent, args.chunk.chunk_index);
  }
}

async function runChunksWithConcurrency(
  chunks: ManuscriptChunkEvidence[],
  concurrency: number,
  worker: (chunk: ManuscriptChunkEvidence) => Promise<AxisCriterionResult[]>,
): Promise<Array<PromiseSettledResult<AxisCriterionResult[]>>> {
  const settled: Array<PromiseSettledResult<AxisCriterionResult[]>> = new Array(
    chunks.length,
  );
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= chunks.length) return;
      try {
        const value = await worker(chunks[index]);
        settled[index] = { status: "fulfilled", value };
      } catch (reason) {
        settled[index] = { status: "rejected", reason };
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, chunks.length) },
    () => runWorker(),
  );
  await Promise.all(workers);
  return settled;
}

function aggregateChunkCriteria(
  chunkResults: AxisCriterionResult[][],
): AxisCriterionResult[] {
  if (chunkResults.length === 0) {
    throw new Error("[PplxChunk] no successful chunk results to aggregate");
  }
  if (chunkResults.length === 1) return chunkResults[0];

  const aggregated: AxisCriterionResult[] = [];

  for (const key of CRITERIA_KEYS) {
    const entries = chunkResults
      .flatMap((r) => r)
      .filter((c) => c.key === key);

    if (entries.length === 0) continue;

    const validScores = entries
      .map((c) => c.score_0_10)
      .filter((n) => typeof n === "number" && n >= 1 && n <= 10);

    const avgScore =
      validScores.length > 0
        ? Math.round(validScores.reduce((s, n) => s + n, 0) / validScores.length)
        : 5;

    const seen = new Set<string>();
    const mergedEvidence: EvidenceAnchor[] = [];
    for (const entry of entries) {
      for (const ev of entry.evidence) {
        const snippetKey = ev.snippet?.trim() || "";
        if (snippetKey && !seen.has(snippetKey)) {
          seen.add(snippetKey);
          mergedEvidence.push(ev);
        }
      }
    }

    aggregated.push({
      key,
      score_0_10: Math.min(10, Math.max(1, avgScore)),
      rationale: entries[0]?.rationale ?? "",
      evidence: mergedEvidence.slice(0, 1),
      recommendations: [],
    });
  }

  return aggregated;
}

/**
 * Run Perplexity chunk scoring across all chunks.
 *
 * Returns:
 *   - SinglePassOutput when scoring succeeds (any chunk count >= 1)
 *   - null when graceful degradation kicks in (no API key, or all chunks failed)
 *
 * Never throws — graceful degradation is mandatory. Callers should expect null
 * and fall through to the GPT-only path.
 */
export async function runPerplexityChunkScorer(
  opts: PerplexityChunkScorerOptions,
): Promise<SinglePassOutput | null> {
  const optsKey = opts.perplexityApiKey?.trim();
  const envKey = process.env.PERPLEXITY_API_KEY?.trim();
  const apiKey = optsKey || envKey;
  // Diagnostic: surface whether the scorer was invoked with a key so Vercel
  // logs can distinguish "scorer never ran" from "scorer ran but key missing"
  // from "scorer ran with key but Perplexity API rejected it."
  console.log("[PplxChunk] scorer invoked", {
    hasKey: !!apiKey,
    keyLength: apiKey?.length ?? 0,
    optsKeyPresent: !!optsKey,
    envKeyPresent: !!envKey,
    jobId: opts.jobId ?? "unknown",
  });
  if (!apiKey) {
    console.warn(
      "[PplxChunk] PERPLEXITY_API_KEY missing — skipping Perplexity chunk sweep (graceful degradation to GPT-only)",
    );
    if (opts.jobId) {
      void pipelineLog({
        jobId: opts.jobId,
        level: "warn",
        stage: "pplx_chunk_scorer",
        message: "Perplexity chunk scorer skipped — no API key",
        metadata: {
          optsKeyPresent: !!opts.perplexityApiKey,
          envKeyPresent: !!process.env.PERPLEXITY_API_KEY,
        },
      });
    }
    return null;
  }

  const fetchFn = opts._fetch ?? fetch;
  const timeoutMs = getPplxChunkTimeoutMs();
  const concurrency = getPplxChunkConcurrency();

  const hasChunksForLog = Array.isArray(opts.manuscriptChunks) && opts.manuscriptChunks.length > 0;
  const chunkCountForLog = hasChunksForLog ? opts.manuscriptChunks!.length : 1;
  if (opts.jobId) {
    void pipelineLog({
      jobId: opts.jobId,
      level: "info",
      stage: "pplx_chunk_scorer",
      message: "Perplexity chunk scorer invoked",
      metadata: {
        hasKey: !!apiKey,
        keyLength: apiKey?.length ?? 0,
        chunkCount: chunkCountForLog,
        concurrency,
        timeoutMs,
      },
    });
  }

  const hasChunks = Array.isArray(opts.manuscriptChunks) && opts.manuscriptChunks.length > 0;
  const chunks: ManuscriptChunkEvidence[] = hasChunks
    ? opts.manuscriptChunks!
    : [{ chunk_index: 0, content: opts.manuscriptText }];

  const jobLabel = opts.jobId ?? "unknown";
  const startMs = Date.now();

  console.log(
    `[PplxChunk] Starting Perplexity chunk sweep: job_id=${jobLabel} chunks=${chunks.length} concurrency=${concurrency} timeout_ms=${timeoutMs}`,
  );

  try {
    const settled = await runChunksWithConcurrency(chunks, concurrency, (chunk) =>
      scoreChunk({
        chunk,
        chunkCount: chunks.length,
        title: opts.title,
        workType: opts.workType,
        perplexityApiKey: apiKey,
        timeoutMs,
        fetchFn,
      }),
    );

    const successes: AxisCriterionResult[][] = [];
    const failures: Array<{ chunkIndex: number; reason: string }> = [];

    for (let i = 0; i < settled.length; i += 1) {
      const result = settled[i];
      if (!result) continue;
      if (result.status === "fulfilled") {
        successes.push(result.value);
      } else {
        failures.push({
          chunkIndex: chunks[i].chunk_index,
          reason:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    }

    const elapsedMs = Date.now() - startMs;

    if (successes.length === 0) {
      console.warn(
        `[PplxChunk] All Perplexity chunk requests failed — returning null (graceful degradation). job_id=${jobLabel} failures=${failures.length} elapsed_ms=${elapsedMs}`,
        failures.slice(0, 3),
      );
      return null;
    }

    if (failures.length > 0) {
      console.warn(
        `[PplxChunk] Partial Perplexity chunk sweep — succeeded=${successes.length} failed=${failures.length} job_id=${jobLabel} elapsed_ms=${elapsedMs}`,
        failures.slice(0, 3),
      );
    } else {
      console.log(
        `[PplxChunk] Perplexity chunk sweep complete: succeeded=${successes.length}/${chunks.length} job_id=${jobLabel} elapsed_ms=${elapsedMs}`,
      );
    }

    const aggregatedCriteria = aggregateChunkCriteria(successes);

    if (opts.jobId) {
      void pipelineLog({
        jobId: opts.jobId,
        level: "info",
        stage: "pplx_chunk_scorer",
        message: "Perplexity chunk scorer complete",
        metadata: {
          successCount: successes.length,
          failureCount: failures.length,
          criteriaCount: aggregatedCriteria.length,
        },
      });
    }

    return {
      pass: 1,
      axis: "craft_execution",
      criteria: aggregatedCriteria,
      model: PERPLEXITY_MODEL,
      prompt_version: PROMPT_VERSION,
      temperature: PERPLEXITY_TEMPERATURE,
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(
      `[PplxChunk] Perplexity chunk sweep threw unexpectedly — graceful degradation. job_id=${jobLabel}: ${reason}`,
    );
    return null;
  }
}
