import OpenAI from "openai";
import {
  PASS1A_SYSTEM_PROMPT,
  PASS1A_PROMPT_VERSION,
  buildPass1aUserPrompt,
} from "./prompts/pass1a-character-sweep";
import type { Pass1aChunkOutput, Pass1aCharacterChunkEntry, ManuscriptChunkEvidence } from "./types";
import { getCanonicalPass1Model, isReasoningStyleModel } from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";

const PASS1A_TEMPERATURE = 0.2;
const PASS1A_MAX_OUTPUT_TOKENS = 16_000;
const PASS1A_LENGTH_RETRY_MAX_OUTPUT_TOKENS = 16_000;
const PASS1A_DEFAULT_MODEL = "gpt-5.1";
const PASS1A_CHUNK_CONCURRENCY = 5;
const PASS1A_CHUNK_RETRY_MAX = 3;
const PASS1A_CHUNK_RETRY_BASE_MS = 8000;

const CAPS = {
  maxCharacters: 15,
  maxEvidenceAnchors: 3,
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
  return text.includes("truncated") || text.includes("json_parse_failed_truncated") || text.includes("json extraction failed");
}

function isTimeoutError(reason: unknown): boolean {
  const text = String(reason instanceof Error ? reason.message : reason).toLowerCase();
  return text.includes("request timed out") || text.includes("timeout") || text.includes("etimedout") || text.includes("econnreset") || text.includes("socket hang up") || text.includes("network error") || (reason instanceof Error && reason.name === "AbortError");
}

function nextLengthRetryTokens(current: number): number {
  return Math.min(PASS1A_LENGTH_RETRY_MAX_OUTPUT_TOKENS, Math.max(8000, current * 2));
}

function parseRetryAfterMs(reason: unknown): number | null {
  const text = String(reason instanceof Error ? reason.message : reason);
  const secMatch = text.match(/try again in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!secMatch) return null;
  const sec = Number.parseFloat(secMatch[1]);
  return Number.isFinite(sec) && sec > 0 ? Math.ceil(sec * 1000) : null;
}

function normalizeField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (Array.isArray(value)) {
    const joined = value.map(normalizeField).filter((s): s is string => Boolean(s)).join("; ");
    return joined.length > 0 ? joined : null;
  }
  if (typeof value === "object") {
    const r = value as Record<string, unknown>;
    const preferred =
      normalizeField(r.description) ??
      normalizeField(r.signal) ??
      normalizeField(r.value) ??
      normalizeField(r.text) ??
      normalizeField(r.mechanism) ??
      normalizeField(r.summary) ??
      normalizeField(r.note) ??
      normalizeField(r.label) ??
      normalizeField(r.name);
    if (preferred) return preferred;
    const flat = Object.values(r).map(normalizeField).filter((s): s is string => Boolean(s)).join("; ");
    return flat.length > 0 ? flat : null;
  }
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function uniqueStringArray(values: unknown): string[] {
  const array = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of array) {
    const normalized = normalizeField(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function getIdentityGroup(entry: Pass1aCharacterChunkEntry): string | null {
  const record = entry as Pass1aCharacterChunkEntry & {
    canonical_identity_group?: unknown;
    identity_group?: unknown;
    identityGroup?: unknown;
  };
  return normalizeField(record.canonical_identity_group ?? record.identity_group ?? record.identityGroup);
}

function enforceCaps(entry: Pass1aCharacterChunkEntry): Pass1aCharacterChunkEntry {
  const localName = normalizeField(entry.canonical_name) ?? "Unknown Character";
  const identityGroup = getIdentityGroup(entry);
  const canonicalName = identityGroup ?? localName;
  const aliases = uniqueStringArray(entry.aliases);
  if (identityGroup && !sameText(identityGroup, localName)) aliases.push(localName);
  const dedupedAliases = uniqueStringArray(aliases).filter((alias) => !sameText(alias, canonicalName));

  return {
    ...entry,
    canonical_name: canonicalName,
    aliases: dedupedAliases,
    who_is_this: normalizeField(entry.who_is_this) ?? "",
    what_do_they_want: normalizeField(entry.what_do_they_want),
    where_are_they: normalizeField(entry.where_are_they),
    when_signal: normalizeField(entry.when_signal),
    why_signal: normalizeField(entry.why_signal),
    how_signal: normalizeField(entry.how_signal),
    arc_state_in_chunk: normalizeField(entry.arc_state_in_chunk) ?? "",
    arc_pressure: normalizeField(entry.arc_pressure),
    arc_shift: normalizeField(entry.arc_shift),
    evidence_anchors: (entry.evidence_anchors ?? []).slice(0, CAPS.maxEvidenceAnchors).map((anchor) => ({
      ...anchor,
      excerpt: (normalizeField(anchor.excerpt) ?? "").slice(0, CAPS.maxExcerptChars),
    })),
    relationship_signals: (entry.relationship_signals ?? []).slice(0, CAPS.maxRelationshipSignals),
    symbolic_objects: (entry.symbolic_objects ?? []).slice(0, CAPS.maxSymbolicObjects),
    pronouns: uniqueStringArray(entry.pronouns),
    lgbtq_signals: uniqueStringArray(entry.lgbtq_signals),
    racial_ethnic_signals: uniqueStringArray(entry.racial_ethnic_signals),
    skin_tone_signals: uniqueStringArray(entry.skin_tone_signals),
    language_signals: uniqueStringArray(entry.language_signals),
    religion_signals: uniqueStringArray(entry.religion_signals),
    socioeconomic_signals: uniqueStringArray(entry.socioeconomic_signals),
    nationality_signals: uniqueStringArray(entry.nationality_signals),
    disability_neuro_signals: uniqueStringArray(entry.disability_neuro_signals),
  };
}

function normalizeChunkOutput(output: Pass1aChunkOutput): Pass1aChunkOutput {
  return {
    ...output,
    characters: (output.characters ?? []).slice(0, CAPS.maxCharacters).map(enforceCaps),
    prompt_version: output.prompt_version || PASS1A_PROMPT_VERSION,
    generated_at: output.generated_at || new Date().toISOString(),
  };
}

function parsePass1aResponse(raw: string, chunkIndex: number): Pass1aChunkOutput {
  const result = parseJsonObjectBoundary(raw);
  const data = result.value;
  if (typeof data !== "object" || data === null || !Array.isArray((data as Record<string, unknown>).characters)) {
    const keys = typeof data === "object" && data !== null ? Object.keys(data as object).join(", ") : typeof data;
    throw new Error(`[Pass1A] Chunk ${chunkIndex}: invalid response shape — missing characters array. Top-level keys: [${keys}]`);
  }

  const rawCharacters = data.characters as unknown[];
  const characters: Pass1aCharacterChunkEntry[] = [];
  for (let i = 0; i < Math.min(rawCharacters.length, CAPS.maxCharacters); i++) {
    const entry = rawCharacters[i];
    if (typeof entry !== "object" || entry === null || typeof (entry as Record<string, unknown>).canonical_name !== "string") {
      console.warn("[Pass1A] Dropping corrupt character entry", {
        chunk_index: chunkIndex,
        entry_index: i,
        entry_type: typeof entry,
        entry_preview: JSON.stringify(entry)?.slice(0, 200),
      });
      continue;
    }
    try {
      characters.push(enforceCaps(entry as Pass1aCharacterChunkEntry));
    } catch (err) {
      console.warn("[Pass1A] enforceCaps threw on character entry (skipping)", {
        chunk_index: chunkIndex,
        entry_index: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return normalizeChunkOutput({
    pass: "1a",
    axis: "character_evidence_sweep",
    chunk_index: chunkIndex,
    characters,
    prompt_version: PASS1A_PROMPT_VERSION,
    generated_at: typeof data.generated_at === "string" ? data.generated_at : new Date().toISOString(),
  });
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
  const cached = chunkCache?.get(chunk.chunk_index);
  if (cached) return normalizeChunkOutput(cached);

  const userPrompt = buildPass1aUserPrompt({ manuscriptText: chunk.content, chunkIndex: chunk.chunk_index, title, workType });
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
        throw new Error(`[Pass1A] Chunk ${chunk.chunk_index}: empty response (model=${model}, finish_reason=${finishReason})`);
      }
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
          activeMaxTokens = nextLengthRetryTokens(activeMaxTokens);
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

  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  console.error("[Pass1A] Chunk failed after all retries — returning degraded result (zero characters)", {
    chunk_index: chunk.chunk_index,
    error: errorMsg,
  });
  return {
    pass: "1a" as const,
    axis: "character_evidence_sweep" as const,
    chunk_index: chunk.chunk_index,
    characters: [],
    prompt_version: PASS1A_PROMPT_VERSION,
    generated_at: new Date().toISOString(),
    _degraded: true,
    _degraded_reason: errorMsg,
  } as Pass1aChunkOutput & { _degraded: boolean; _degraded_reason: string };
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
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, () => runWorker()));
  return settled;
}

export interface Pass1aChunkCacheEntry {
  chunk_index: number;
  result: Pass1aChunkOutput;
  completed_at: string;
}

export interface Pass1aChunkCacheArtifact {
  job_id: string;
  source_hash: string;
  chunks: Record<number, Pass1aChunkCacheEntry>;
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
  _chunkCache?: Map<number, Pass1aChunkOutput>;
  _onChunkComplete?: (chunk_index: number, result: Pass1aChunkOutput) => Promise<void>;
}

export interface RunPass1aResult {
  chunkOutputs: Pass1aChunkOutput[];
  failedChunkIndices: number[];
  failedChunkErrors: Array<{ chunk_index: number; error: string }>;
  model: string;
  prompt_version: string;
  total_chunks: number;
  successful_chunks: number;
}

export async function runPass1a(opts: RunPass1aOptions): Promise<RunPass1aResult> {
  const model = resolvePass1aModel();
  const openai = new OpenAI({
    apiKey: opts.openaiApiKey ?? process.env.OPENAI_API_KEY,
    timeout: getEvalOpenAiTimeoutMs(),
    maxRetries: 0,
  });

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

  const settled = await runChunksWithConcurrency(chunks, PASS1A_CHUNK_CONCURRENCY, async (chunk) => {
    const result = await runSingleChunk({
      chunk,
      title: opts.title,
      workType: opts.workType,
      openai,
      model,
      chunkCache: opts._chunkCache,
    });
    if (opts._onChunkComplete) {
      try {
        await opts._onChunkComplete(chunk.chunk_index, result);
      } catch (err) {
        console.warn(`[Pass1A] _onChunkComplete threw for chunk ${chunk.chunk_index} (non-fatal)`, err instanceof Error ? err.message : String(err));
      }
    }
    return result;
  });

  const chunkOutputs: Pass1aChunkOutput[] = [];
  const failedChunkIndices: number[] = [];
  const failedChunkErrors: Array<{ chunk_index: number; error: string }> = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled") {
      chunkOutputs.push(normalizeChunkOutput(result.value));
    } else {
      const chunkIndex = chunks[i].chunk_index;
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failedChunkIndices.push(chunkIndex);
      failedChunkErrors.push({ chunk_index: chunkIndex, error });
      console.error("[Pass1A] Chunk failed after retries", { job_id: opts.jobId ?? null, chunk_index: chunkIndex, error });
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
