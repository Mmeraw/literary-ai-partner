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
 * Hard-fail policy: dual-model evaluation is mandatory. The only acceptable
 * GPT-only path is when PERPLEXITY_API_KEY is not configured. Any API error
 * after the key is present causes the job to fail fast with a typed error.
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

const PROBE_RETRY_DELAY_MS = 5_000;
const SAMPLE_BATCH_SIZE = 4;
const SAMPLE_FAIL_THRESHOLD = 3;

const DETERMINISTIC_STATUS_CODES = new Set([400, 401, 403, 422]);
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);

export class PerplexityApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorBody: string,
    public readonly chunkIndex?: number,
  ) {
    super(`[PplxChunk] Perplexity API error ${statusCode}: ${errorBody.slice(0, 300)}`);
    this.name = 'PerplexityApiError';
  }
}

export interface PerplexityChunkScorerOptions {
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  workType: string;
  title: string;
  perplexityApiKey?: string;
  jobId?: string;
  /** Override for testing — provide a mock fetch-like function. */
  _fetch?: typeof fetch;
  /** Override for testing — replace the probe-retry backoff. */
  _sleep?: (ms: number) => Promise<void>;
  /** Override for testing — replace pipelineLog with a spy. */
  _log?: (args: {
    jobId: string;
    level: "info" | "warn" | "error";
    stage: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) => void;
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
  chunkIndex?: number;
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
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new PerplexityApiError(response.status, errText, args.chunkIndex);
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
    chunkIndex: args.chunk.chunk_index,
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
      chunkIndex: args.chunk.chunk_index,
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

function classifyProbeError(err: unknown): "deterministic" | "transient" {
  if (err instanceof PerplexityApiError) {
    if (DETERMINISTIC_STATUS_CODES.has(err.statusCode)) return "deterministic";
    if (TRANSIENT_STATUS_CODES.has(err.statusCode)) return "transient";
    // Unknown HTTP code → treat as deterministic (don't retry into the void).
    return "deterministic";
  }
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.message.includes("timed out")) {
      return "transient";
    }
  }
  return "transient";
}

function probeErrorSummary(err: unknown): { statusCode: number | null; errorBody: string } {
  if (err instanceof PerplexityApiError) {
    return { statusCode: err.statusCode, errorBody: err.errorBody };
  }
  return {
    statusCode: null,
    errorBody: err instanceof Error ? err.message : String(err),
  };
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run Perplexity chunk scoring across all chunks.
 *
 * Returns:
 *   - SinglePassOutput when scoring succeeds for the probe and the sample
 *     batch, and at least the existing main batch concurrency logic resolves.
 *   - null ONLY when PERPLEXITY_API_KEY is not configured (operator chose
 *     GPT-only mode).
 *
 * Throws (HARD FAIL — propagates to job failure handler):
 *   - PERPLEXITY_CHUNK_SCORER_FATAL when the first-chunk probe hits a
 *     deterministic HTTP error (400/401/403/422).
 *   - PERPLEXITY_CHUNK_SCORER_TRANSIENT_FAILURE when the probe fails
 *     transiently twice in a row.
 *   - PERPLEXITY_CHUNK_SCORER_HIGH_ERROR_RATE when ≥75% of the sample
 *     batch (3/4) fails.
 */
export async function runPerplexityChunkScorer(
  opts: PerplexityChunkScorerOptions,
): Promise<SinglePassOutput | null> {
  const optsKey = opts.perplexityApiKey?.trim();
  const envKey = process.env.PERPLEXITY_API_KEY?.trim();
  const apiKey = optsKey || envKey;
  console.log("[PplxChunk] scorer invoked", {
    hasKey: !!apiKey,
    keyLength: apiKey?.length ?? 0,
    optsKeyPresent: !!optsKey,
    envKeyPresent: !!envKey,
    jobId: opts.jobId ?? "unknown",
  });
  if (!apiKey) {
    console.warn(
      "[PplxChunk] PERPLEXITY_API_KEY missing — skipping Perplexity chunk sweep (GPT-only mode by operator config)",
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
  const sleep = opts._sleep ?? defaultSleep;
  const timeoutMs = getPplxChunkTimeoutMs();
  const concurrency = getPplxChunkConcurrency();
  const jobLabel = opts.jobId ?? "unknown";

  const log = (args: {
    jobId: string;
    level: "info" | "warn" | "error";
    stage: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (opts._log) opts._log(args);
    void pipelineLog(args);
  };

  const hasChunks = Array.isArray(opts.manuscriptChunks) && opts.manuscriptChunks.length > 0;
  const chunks: ManuscriptChunkEvidence[] = hasChunks
    ? opts.manuscriptChunks!
    : [{ chunk_index: 0, content: opts.manuscriptText }];

  if (opts.jobId) {
    log({
      jobId: opts.jobId,
      level: "info",
      stage: "pplx_chunk_scorer",
      message: "Perplexity chunk scorer invoked",
      metadata: {
        hasKey: !!apiKey,
        keyLength: apiKey?.length ?? 0,
        chunkCount: chunks.length,
        concurrency,
        timeoutMs,
      },
    });
  }

  const startMs = Date.now();
  console.log(
    `[PplxChunk] Starting Perplexity chunk sweep: job_id=${jobLabel} chunks=${chunks.length} concurrency=${concurrency} timeout_ms=${timeoutMs}`,
  );

  const runOne = (chunk: ManuscriptChunkEvidence) =>
    scoreChunk({
      chunk,
      chunkCount: chunks.length,
      title: opts.title,
      workType: opts.workType,
      perplexityApiKey: apiKey,
      timeoutMs,
      fetchFn,
    });

  // ── Gate 1: First-chunk probe ─────────────────────────────────────────
  const probeChunk = chunks[0];
  let probeResult: AxisCriterionResult[];
  try {
    probeResult = await runOne(probeChunk);
  } catch (firstErr) {
    const kind = classifyProbeError(firstErr);
    const { statusCode, errorBody } = probeErrorSummary(firstErr);

    if (kind === "deterministic") {
      log({
        jobId: jobLabel,
        level: "error",
        stage: "pplx_chunk_scorer",
        message: "Perplexity probe failed — deterministic error, aborting job",
        metadata: { statusCode, errorBody: errorBody.slice(0, 300) },
      });
      throw new Error(
        `PERPLEXITY_CHUNK_SCORER_FATAL: Perplexity API returned ${statusCode ?? "unknown"} — dual-model evaluation cannot proceed. Error: ${errorBody}`,
      );
    }

    // Transient — wait and retry once.
    console.warn(
      `[PplxChunk] Probe failed transiently (status=${statusCode ?? "n/a"}) — retrying once after ${PROBE_RETRY_DELAY_MS}ms. job_id=${jobLabel}`,
    );
    await sleep(PROBE_RETRY_DELAY_MS);

    try {
      probeResult = await runOne(probeChunk);
    } catch (secondErr) {
      const second = probeErrorSummary(secondErr);
      log({
        jobId: jobLabel,
        level: "error",
        stage: "pplx_chunk_scorer",
        message: "Perplexity probe failed twice — transient, aborting job",
        metadata: {
          firstStatusCode: statusCode,
          firstErrorBody: errorBody.slice(0, 300),
          retryStatusCode: second.statusCode,
          retryErrorBody: second.errorBody.slice(0, 300),
        },
      });
      throw new Error(
        `PERPLEXITY_CHUNK_SCORER_TRANSIENT_FAILURE: Perplexity probe failed twice (${second.statusCode ?? statusCode ?? "unknown"}) — dual-model evaluation cannot proceed`,
      );
    }
  }

  // Probe succeeded. Remaining chunks split into sample (next 4) + main batch.
  const remaining = chunks.slice(1);

  if (remaining.length === 0) {
    // Single-chunk job — probe IS the entire sweep.
    const elapsedMs = Date.now() - startMs;
    console.log(
      `[PplxChunk] Perplexity chunk sweep complete (probe-only): job_id=${jobLabel} elapsed_ms=${elapsedMs}`,
    );
    const aggregatedCriteria = aggregateChunkCriteria([probeResult]);
    if (opts.jobId) {
      log({
        jobId: opts.jobId,
        level: "info",
        stage: "pplx_chunk_scorer",
        message: "Perplexity chunk scorer complete",
        metadata: {
          successCount: 1,
          failureCount: 0,
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
  }

  // ── Gate 2: Sample batch (first 4 of remaining) ────────────────────────
  const sampleChunks = remaining.slice(0, SAMPLE_BATCH_SIZE);
  const mainChunks = remaining.slice(SAMPLE_BATCH_SIZE);

  const sampleSettled = await runChunksWithConcurrency(
    sampleChunks,
    concurrency,
    runOne,
  );

  const sampleSuccesses: AxisCriterionResult[][] = [];
  const sampleFailures: Array<{ chunkIndex: number; reason: string }> = [];
  for (let i = 0; i < sampleSettled.length; i += 1) {
    const result = sampleSettled[i];
    if (!result) continue;
    const chunkIndex = sampleChunks[i].chunk_index;
    if (result.status === "fulfilled") {
      sampleSuccesses.push(result.value);
    } else {
      const err = result.reason;
      const reason =
        err instanceof PerplexityApiError
          ? `HTTP ${err.statusCode}: ${err.errorBody.slice(0, 200)}`
          : String(err).slice(0, 300);
      sampleFailures.push({ chunkIndex, reason });
      log({
        jobId: jobLabel,
        level: "error",
        stage: "pplx_chunk_scorer",
        message: `Chunk ${chunkIndex} failed`,
        metadata: { chunkIndex, reason },
      });
    }
  }

  if (sampleFailures.length >= SAMPLE_FAIL_THRESHOLD) {
    const failCount = sampleFailures.length;
    log({
      jobId: jobLabel,
      level: "error",
      stage: "pplx_chunk_scorer",
      message: "Perplexity sweep aborted — error rate too high",
      metadata: { failCount, sampleSize: SAMPLE_BATCH_SIZE },
    });
    throw new Error(
      `PERPLEXITY_CHUNK_SCORER_HIGH_ERROR_RATE: ${failCount}/${SAMPLE_BATCH_SIZE} sample chunks failed — dual-model evaluation cannot proceed`,
    );
  }

  // ── Gate 3: Main batch ────────────────────────────────────────────────
  const mainSettled = await runChunksWithConcurrency(
    mainChunks,
    concurrency,
    runOne,
  );

  const mainSuccesses: AxisCriterionResult[][] = [];
  const mainFailures: Array<{ chunkIndex: number; reason: string }> = [];
  for (let i = 0; i < mainSettled.length; i += 1) {
    const result = mainSettled[i];
    if (!result) continue;
    const chunkIndex = mainChunks[i].chunk_index;
    if (result.status === "fulfilled") {
      mainSuccesses.push(result.value);
    } else {
      const err = result.reason;
      const reason =
        err instanceof PerplexityApiError
          ? `HTTP ${err.statusCode}: ${err.errorBody.slice(0, 200)}`
          : String(err).slice(0, 300);
      mainFailures.push({ chunkIndex, reason });
      log({
        jobId: opts.jobId ?? "unknown",
        level: "error",
        stage: "pplx_chunk_scorer",
        message: `Chunk ${chunkIndex} failed`,
        metadata: { chunkIndex, reason },
      });
    }
  }

  const allSuccesses = [probeResult, ...sampleSuccesses, ...mainSuccesses];
  const allFailures = [...sampleFailures, ...mainFailures];
  const elapsedMs = Date.now() - startMs;

  if (allFailures.length > 0) {
    console.warn(
      `[PplxChunk] Partial Perplexity chunk sweep — succeeded=${allSuccesses.length} failed=${allFailures.length} job_id=${jobLabel} elapsed_ms=${elapsedMs}`,
      allFailures.slice(0, 3),
    );
  } else {
    console.log(
      `[PplxChunk] Perplexity chunk sweep complete: succeeded=${allSuccesses.length}/${chunks.length} job_id=${jobLabel} elapsed_ms=${elapsedMs}`,
    );
  }

  const aggregatedCriteria = aggregateChunkCriteria(allSuccesses);

  if (opts.jobId) {
    log({
      jobId: opts.jobId,
      level: "info",
      stage: "pplx_chunk_scorer",
      message: "Perplexity chunk scorer complete",
      metadata: {
        successCount: allSuccesses.length,
        failureCount: allFailures.length,
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
}
