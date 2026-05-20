/**
 * runPass3Preflight — Pass 3A: Independent Full-Manuscript Reader
 *
 * Two-step pipeline:
 *   1. MAP:  Each chunk read independently (concurrency=2) → Pass3AChunkObservation[]
 *   2. AGG:  TypeScript zone-aggregation → 6 Pass3AZoneSummary objects (no LLM)
 *   3. REDUCE: Single LLM call receiving 6 zone summaries → Pass3PreflightDraft
 *   4. ENFORCE: enforceEvidenceRules (deterministic TS, no LLM)
 *   5. PERSIST: upsertEvaluationArtifact as pass3_preflight_draft_v1
 *
 * Non-fatal contract: partial/failed preflight is persisted with degraded authority.
 * Pass 3B receives PREFLIGHT UNAVAILABLE if chunks === 0.
 */

import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManuscriptChunkEvidence } from "./types";
import type {
  Pass3AChunkObservation,
  Pass3PreflightDraft,
  Pass3AZoneSummary,
  Pass3ACriterionDraft,
  Pass3AActZone,
  Pass3AConfidence,
} from "./types";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { CriterionKey } from "@/schemas/criteria-keys";
import {
  PASS3A_CHUNK_READER_SYSTEM_PROMPT,
  PASS3A_CHUNK_READER_PROMPT_VERSION,
  PASS3A_CHUNK_READER_TEMPERATURE,
  buildPass3AChunkReaderUserPrompt,
} from "./prompts/pass3a-chunk-reader";
import {
  PASS3A_REDUCER_SYSTEM_PROMPT,
  PASS3A_REDUCER_PROMPT_VERSION,
  PASS3A_REDUCER_TEMPERATURE,
  buildPass3AReducerUserPrompt,
} from "./prompts/pass3a-preflight-reducer";
import { upsertEvaluationArtifact, sha256Hex } from "@/lib/evaluation/artifactPersistence";
import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";

// ─── Constants ─────────────────────────────────────────────────────────────────

export const PASS3A_DEFAULT_CHUNK_CONCURRENCY = 2;
/** Max chars per zone summary sent to the reducer */
const PASS3A_ZONE_SUMMARY_CAP = 3000;
const PASS3A_DEFAULT_MODEL = "gpt-4o";
const PASS3A_MAX_OUTPUT_TOKENS = 4096;

// ─── Act-zone classification ────────────────────────────────────────────────

const ACT_ZONES: Pass3AActZone[] = [
  "Opening",
  "Early-Middle",
  "Mid-Act",
  "Late-Middle",
  "Late",
  "Close",
];

function classifyChunkToZone(chunkIndex: number, totalChunks: number): Pass3AActZone {
  if (totalChunks <= 1) return "Opening";
  const progress = chunkIndex / (totalChunks - 1); // 0.0 → 1.0
  if (progress < 0.10) return "Opening";
  if (progress < 0.30) return "Early-Middle";
  if (progress < 0.55) return "Mid-Act";
  if (progress < 0.75) return "Late-Middle";
  if (progress < 0.90) return "Late";
  return "Close";
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function nowMs(): number {
  return Date.now();
}

function capText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + " [truncated]";
}

// Tolerant act-zone normalizer — handles common model casing errors so a
// "late" emit still routes to the canonical "Late" Pass3AActZone value.
function normalizeActZone(z: unknown): Pass3AActZone {
  if (typeof z !== "string") return "Opening";
  const map: Record<string, Pass3AActZone> = {
    "opening": "Opening",
    "early-middle": "Early-Middle",
    "mid-act": "Mid-Act",
    "late-middle": "Late-Middle",
    "late": "Late",
    "close": "Close",
  };
  return map[z.toLowerCase()] ?? (z as Pass3AActZone);
}

// Tolerant normalizer: accept either the old (`criteriaSignals`, `signalType`,
// `observation`) or new (`criterionSignals`, `signal`, `provisionalNote`)
// field shape from the model and normalize to the canonical
// Pass3AChunkObservation contract before aggregation.
function normalizeChunkObservation(raw: unknown): Pass3AChunkObservation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawSignals = (r.criterionSignals ?? r.criteriaSignals ?? []) as Array<Record<string, unknown>>;
  const allowedSignals = new Set(["strength", "weakness", "mixed", "no_signal"]);
  const criterionSignals = rawSignals.map((sig) => {
    const rawSignal = String(sig.signal ?? sig.signalType ?? "no_signal");
    const normalizedSignal = rawSignal === "ambiguous" ? "mixed" : rawSignal;
    return {
      criterion: sig.criterion as CriterionKey,
      signal: (allowedSignals.has(normalizedSignal) ? normalizedSignal : "no_signal") as
        | "strength"
        | "weakness"
        | "mixed"
        | "no_signal",
      evidenceQuotes: Array.isArray(sig.evidenceQuotes) ? (sig.evidenceQuotes as string[]) : [],
      provisionalNote: String(sig.provisionalNote ?? sig.observation ?? ""),
    };
  });
  return {
    ...r,
    criterionSignals,
  } as Pass3AChunkObservation;
}

// ─── Zone aggregation (TypeScript, no LLM) ──────────────────────────────────

function aggregateChunksToZoneSummaries(
  observations: Array<{ chunkIndex: number; observation: Pass3AChunkObservation }>,
  totalChunks: number,
): Pass3AZoneSummary[] {
  // Group by zone
  const byZone = new Map<Pass3AActZone, typeof observations>();
  for (const zone of ACT_ZONES) {
    byZone.set(zone, []);
  }

  for (const item of observations) {
    const zone = item.observation.actZone;
    byZone.get(zone)?.push(item);
  }

  const summaries: Pass3AZoneSummary[] = [];

  for (const zone of ACT_ZONES) {
    const items = byZone.get(zone)!;
    if (items.length === 0) {
      summaries.push({
        zone,
        chunkIndices: [],
        wordCount: 0,
        summary: `[No chunks observed in ${zone} zone]`,
        criteriaSignalCount: 0,
        characterNames: [],
        arbitrationWarningCount: 0,
      });
      continue;
    }

    const chunkIndices = items.map(i => i.chunkIndex);
    const wordCount = items.reduce((sum, i) => sum + (i.observation.wordCount ?? 0), 0);

    // Collect criteria signals
    const criterionSignalsByKey = new Map<string, string[]>();
    for (const item of items) {
      for (const sig of (item.observation.criterionSignals ?? [])) {
        const existing = criterionSignalsByKey.get(sig.criterion) ?? [];
        existing.push(`[c${item.chunkIndex}][${sig.signal}] ${sig.provisionalNote}`);
        criterionSignalsByKey.set(sig.criterion, existing);
      }
    }

    // Collect character names (deduplicated)
    const characterNames = [
      ...new Set(
        items.flatMap(i => (i.observation.characterObservations ?? []).map(c => c.name))
      ),
    ];

    // Collect narrative events (deduped by prefix)
    const events = items
      .flatMap(i => (i.observation.narrativeEvents ?? []).map(e => `[c${i.chunkIndex}] ${e}`))
      .slice(0, 12);

    // Collect arbitration warnings
    const warnings = items
      .flatMap(i => (i.observation.arbitrationWarnings ?? []).map(w => `[c${i.chunkIndex}][${w.blockerType}] ${w.warning}`))
      .slice(0, 6);

    // Collect promise/payoff signals
    const promiseSignals = items
      .flatMap(i => (i.observation.promisePayoffSignals ?? []).map(p => `[c${i.chunkIndex}][${p.type}] ${p.description}`))
      .slice(0, 6);

    // Collect closure signals
    const closureSignals = items
      .flatMap(i => (i.observation.closureSignals ?? []).map(c => `[c${i.chunkIndex}][${c.strength}] ${c.signal}`))
      .slice(0, 4);

    // Build summary text
    const summaryParts: string[] = [];
    summaryParts.push(`Chunks: ${chunkIndices.join(", ")} | Words: ~${wordCount}`);

    if (events.length > 0) {
      summaryParts.push(`NARRATIVE EVENTS:\n${events.join("\n")}`);
    }

    if (criterionSignalsByKey.size > 0) {
      const criteriaLines = [...criterionSignalsByKey.entries()]
        .map(([k, v]) => `  ${k}: ${v.slice(0, 2).join(" | ")}`)
        .join("\n");
      summaryParts.push(`CRITERIA SIGNALS:\n${criteriaLines}`);
    }

    if (characterNames.length > 0) {
      summaryParts.push(`CHARACTERS OBSERVED: ${characterNames.join(", ")}`);
    }

    if (promiseSignals.length > 0) {
      summaryParts.push(`PROMISE/PAYOFF:\n${promiseSignals.join("\n")}`);
    }

    if (closureSignals.length > 0) {
      summaryParts.push(`CLOSURE SIGNALS:\n${closureSignals.join("\n")}`);
    }

    if (warnings.length > 0) {
      summaryParts.push(`ARBITRATION WARNINGS:\n${warnings.join("\n")}`);
    }

    const rawSummary = summaryParts.join("\n\n");

    summaries.push({
      zone,
      chunkIndices,
      wordCount,
      summary: capText(rawSummary, PASS3A_ZONE_SUMMARY_CAP),
      criteriaSignalCount: criterionSignalsByKey.size,
      characterNames,
      arbitrationWarningCount: warnings.length,
    });
  }

  return summaries;
}

// ─── Evidence enforcement rules (deterministic TypeScript) ──────────────────

function enforceEvidenceRules(
  drafts: Pass3ACriterionDraft[],
  zoneSummaries: Pass3AZoneSummary[],
): Pass3ACriterionDraft[] {
  const lateZones: Pass3AActZone[] = ["Late", "Close"];
  const lateZoneSummaries = zoneSummaries.filter(z => lateZones.includes(z.zone));
  const hasLateEvidence = lateZoneSummaries.some(z => z.criteriaSignalCount > 0);

  // Narrative closure criterion key (last in CRITERIA_KEYS)
  const closureCriterionKey = CRITERIA_KEYS[CRITERIA_KEYS.length - 1];

  return drafts.map(draft => {
    const d = { ...draft };

    // Rule 1: No evidence quotes → no score
    if (!d.evidenceQuotes || d.evidenceQuotes.length === 0) {
      d.provisionalScore = null;
      d.confidence = "low";
      d.findingStatus = "insufficient_preflight_evidence";
    }

    // Rule 2: narrativeClosure requires late/close zone evidence
    if (d.criterion === closureCriterionKey) {
      const hasLateSupport = d.actZonesSupporting?.some(z => lateZones.includes(z));
      if (!hasLateSupport || !hasLateEvidence) {
        d.provisionalScore = null;
        d.confidence = "low";
        d.findingStatus = "closure_requires_late_evidence";
      }
    }

    // Rule 3: Multi-zone structural claims require ≥2 supporting zones
    if (
      d.provisionalScore !== null &&
      d.actZonesSupporting &&
      d.actZonesSupporting.length < 2 &&
      d.confidence === "high"
    ) {
      // Downgrade high → moderate if only 1 zone
      d.confidence = "moderate";
    }

    return d;
  });
}

// ─── Authority computation ───────────────────────────────────────────────────

function computePreflightAuthority(
  chunksReceived: number,
  chunksExpected: number,
): Pass3PreflightDraft["preflight_authority"] {
  if (chunksExpected === 0) return "unavailable";
  if (chunksReceived === 0) return "unavailable";
  const coverage = chunksReceived / chunksExpected;
  if (coverage >= 1.0) return "full";
  if (coverage >= 0.85) return "reduced";
  return "advisory";
}

// ─── OpenAI call helpers ─────────────────────────────────────────────────────

async function createOpenAICompletion(params: {
  openai: OpenAI;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const response = await params.openai.chat.completions.create(
      {
        model: params.model,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        temperature: params.temperature,
        max_completion_tokens: params.maxTokens,
        response_format: { type: "json_object" },
      },
      { signal: controller.signal },
    );
    return response.choices[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// ─── Main runner ─────────────────────────────────────────────────────────────

export interface RunPass3PreflightOptions {
  manuscriptChunks: ManuscriptChunkEvidence[];
  title: string;
  workType: string;
  jobId: string;
  manuscriptId: number;
  openaiApiKey?: string | null;
  openAiTimeoutMs?: number;
  supabase: SupabaseClient;
  /** Chunk concurrency — default 2 */
  _chunkConcurrency?: number;
  /** Forced heartbeat after each chunk settles */
  _onChunkHeartbeat?: (chunkIndex: number) => void;
}

export interface RunPass3PreflightResult {
  preflight: Pass3PreflightDraft;
  artifactId: string;
  durationMs: number;
  chunksFailed: number;
}

export async function runPass3Preflight(
  opts: RunPass3PreflightOptions,
): Promise<RunPass3PreflightResult> {
  const startMs = nowMs();
  const totalChunks = opts.manuscriptChunks.length;
  const concurrency = opts._chunkConcurrency ?? PASS3A_DEFAULT_CHUNK_CONCURRENCY;
  const timeoutMs = opts.openAiTimeoutMs ?? getEvalOpenAiTimeoutMs();
  const model = PASS3A_DEFAULT_MODEL;

  const effectiveApiKey =
    opts.openaiApiKey === null
      ? undefined
      : opts.openaiApiKey ?? getEvaluationRuntimeConfig().openaiApiKey;

  if (!effectiveApiKey) {
    throw new Error("[Pass3A] OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey: effectiveApiKey, timeout: timeoutMs });

  // ── STEP 1: MAP — read every chunk independently ──────────────────────────
  console.log(
    `[Pass3A] Starting map phase: ${totalChunks} chunks, concurrency=${concurrency}`,
  );

  const observations: Array<{ chunkIndex: number; observation: Pass3AChunkObservation }> = [];
  const failedChunkIndices: number[] = [];

  // Concurrency pool (same pattern as runPass1)
  const chunkItems = opts.manuscriptChunks.map((chunk, arrayIdx) => ({ chunk, i: chunk.chunk_index ?? arrayIdx }));
  let cursor = 0;

  const runChunkWorker = async (): Promise<void> => {
    while (true) {
      const idx = cursor++;
      if (idx >= chunkItems.length) return;
      const { chunk, i } = chunkItems[idx];

      const actZone = classifyChunkToZone(i, totalChunks);
      const chunkText = chunk.content ?? "";
      const wordCount = (chunk.content ?? "").trim().split(/\s+/).length;

      try {
        const userPrompt = buildPass3AChunkReaderUserPrompt({
          chunkIndex: i,
          totalChunks,
          chunkText,
          actZone,
          wordCount,
          title: opts.title,
          workType: opts.workType,
        });

        const raw = await createOpenAICompletion({
          openai,
          model,
          systemPrompt: PASS3A_CHUNK_READER_SYSTEM_PROMPT,
          userPrompt,
          temperature: PASS3A_CHUNK_READER_TEMPERATURE,
          maxTokens: PASS3A_MAX_OUTPUT_TOKENS,
          timeoutMs,
        });

        const rawParsed = parseJsonObjectBoundary(raw);
        if (typeof rawParsed !== "object" || rawParsed === null) {
          throw new Error("Parsed observation is null");
        }
        const parsed = normalizeChunkObservation(rawParsed);
        parsed.chunkIndex = i;
        parsed.actZone = actZone;
        parsed.wordCount = wordCount;
        observations.push({ chunkIndex: i, observation: parsed });
        console.log(`[Pass3A] Chunk ${i + 1}/${totalChunks} (${actZone}) ✓`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Pass3A] Chunk ${i + 1}/${totalChunks} failed: ${msg}`);
        failedChunkIndices.push(i);
      } finally {
        opts._onChunkHeartbeat?.(i);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, totalChunks) }, () => runChunkWorker()),
  );

  const chunksReceived = observations.length;
  const missingChunks = Array.from({ length: totalChunks }, (_, i) => i).filter(
    i => !observations.some(o => o.chunkIndex === i),
  );

  console.log(
    `[Pass3A] Map complete: ${chunksReceived}/${totalChunks} chunks succeeded, ${failedChunkIndices.length} failed`,
  );

  const fullReadCertified =
    chunksReceived === totalChunks && missingChunks.length === 0;

  const preflightAuthority = computePreflightAuthority(chunksReceived, totalChunks);

  // If no chunks succeeded, persist degraded artifact and return
  if (chunksReceived === 0) {
    console.warn("[Pass3A] Zero chunks succeeded — persisting UNAVAILABLE preflight");
    const degradedPreflight = buildDegradedPreflight({
      totalChunks,
      reason: "all_chunks_failed",
      title: opts.title,
    });
    const artifactId = await persistPreflightArtifact({
      preflight: degradedPreflight,
      jobId: opts.jobId,
      manuscriptId: opts.manuscriptId,
      supabase: opts.supabase,
    });
    return {
      preflight: degradedPreflight,
      artifactId,
      durationMs: nowMs() - startMs,
      chunksFailed: failedChunkIndices.length,
    };
  }

  // ── STEP 2: ZONE AGGREGATION (TypeScript, no LLM) ────────────────────────
  console.log("[Pass3A] Aggregating observations into zone summaries...");
  const zoneSummaries = aggregateChunksToZoneSummaries(observations, totalChunks);

  // ── STEP 3: REDUCE — single LLM call ─────────────────────────────────────
  console.log("[Pass3A] Starting reduce phase (single LLM call)...");

  let reducerOutput: Partial<Pass3PreflightDraft> | null = null;

  try {
    const reducerUserPrompt = buildPass3AReducerUserPrompt({
      title: opts.title,
      workType: opts.workType,
      zoneSummaries: zoneSummaries.map(z => ({
        zone: z.zone,
        chunkCount: z.chunkIndices.length,
        wordCount: z.wordCount,
        summary: z.summary,
      })),
      totalChunksExpected: totalChunks,
      totalChunksReceived: chunksReceived,
      missingChunks,
    });

    const raw = await createOpenAICompletion({
      openai,
      model,
      systemPrompt: PASS3A_REDUCER_SYSTEM_PROMPT,
      userPrompt: reducerUserPrompt,
      temperature: PASS3A_REDUCER_TEMPERATURE,
      maxTokens: PASS3A_MAX_OUTPUT_TOKENS * 2, // reducer output is larger
      timeoutMs,
    });

    reducerOutput = parseJsonObjectBoundary(raw) as unknown as Partial<Pass3PreflightDraft>;
    console.log("[Pass3A] Reduce phase complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Pass3A] Reduce phase failed: ${msg} — building degraded preflight`);
  }

  // ── STEP 4: ENFORCE EVIDENCE RULES ───────────────────────────────────────
  let criterionDrafts: Pass3ACriterionDraft[] = [];

  if (reducerOutput?.criterionDrafts && Array.isArray(reducerOutput.criterionDrafts)) {
    // Ensure all 13 criteria are present
    const draftsMap = new Map<string, Pass3ACriterionDraft>();
    for (const dRaw of reducerOutput.criterionDrafts as Pass3ACriterionDraft[]) {
      // Normalize actZonesSupporting casing (e.g. "late" → "Late")
      const d: Pass3ACriterionDraft = {
        ...dRaw,
        actZonesSupporting: Array.isArray(dRaw.actZonesSupporting)
          ? (dRaw.actZonesSupporting as unknown[]).map(normalizeActZone)
          : [],
      };
      if (d.criterion) draftsMap.set(d.criterion, d);
    }
    // Fill any missing criteria with null-score placeholders
    for (const key of CRITERIA_KEYS) {
      if (!draftsMap.has(key)) {
        draftsMap.set(key, {
          criterion: key as CriterionKey,
          provisionalScore: null,
          confidence: "low" as Pass3AConfidence,
          findingStatus: "insufficient_preflight_evidence",
          rationale: "No signal observed in Pass 3A read.",
          evidenceQuotes: [],
          actZonesSupporting: [],
          strengthFindings: [],
          weaknessFindings: [],
        });
      }
    }
    criterionDrafts = CRITERIA_KEYS.map(k => draftsMap.get(k)!);
    criterionDrafts = enforceEvidenceRules(criterionDrafts, zoneSummaries);
  } else {
    // Reducer failed — all criteria get null scores
    criterionDrafts = CRITERIA_KEYS.map(k => ({
      criterion: k as CriterionKey,
      provisionalScore: null,
      confidence: "low" as Pass3AConfidence,
      findingStatus: "insufficient_preflight_evidence" as const,
      rationale: "Pass 3A reducer did not produce output for this criterion.",
      evidenceQuotes: [],
      actZonesSupporting: [],
      strengthFindings: [],
      weaknessFindings: [],
    }));
  }

  // ── STEP 5: ASSEMBLE FULL PREFLIGHT DRAFT ────────────────────────────────
  const sourceWordCount = opts.manuscriptChunks.reduce(
    (sum, c) => sum + (c.content ?? "").trim().split(/\s+/).length,
    0,
  );
  const sourceCharCount = opts.manuscriptChunks.reduce(
    (sum, c) => sum + (c.content ?? "").length,
    0,
  );

  const preflight: Pass3PreflightDraft = {
    schema_version: "pass3_preflight_draft_v1",
    pass: "3A",
    visibility: "internal_only",
    manuscript_read_status: {
      received_full_manuscript: fullReadCertified,
      source_word_count: sourceWordCount,
      source_char_count: sourceCharCount,
      chunks_expected: totalChunks,
      chunks_received: chunksReceived,
      missing_chunks: missingChunks,
      truncation_detected: !fullReadCertified && missingChunks.length > 0,
      full_read_certified: fullReadCertified,
      coverage_status: fullReadCertified
        ? "full"
        : chunksReceived > 0
          ? "partial"
          : "windowed_fallback",
    },
    preflight_authority: preflightAuthority,
    criterionDrafts,
    whole_novel_read: reducerOutput?.whole_novel_read ?? {
      premise_read: "Reducer did not produce output.",
      central_spine: "",
      emotional_engine: "",
      structural_shape: "",
      ending_read: "",
      promise_payoff_assessment: "",
    },
    character_observations: reducerOutput?.character_observations ?? [],
    object_symbol_observations: reducerOutput?.object_symbol_observations ?? [],
    arbitrationQuestionsForPass3B: reducerOutput?.arbitrationQuestionsForPass3B ?? [],
    coverageLimitations: reducerOutput?.coverageLimitations ?? [],
    independentPressurePoints: reducerOutput?.independentPressurePoints ?? [],
  };

  // ── STEP 6: PERSIST ───────────────────────────────────────────────────────
  const artifactId = await persistPreflightArtifact({
    preflight,
    jobId: opts.jobId,
    manuscriptId: opts.manuscriptId,
    supabase: opts.supabase,
  });

  const durationMs = nowMs() - startMs;
  console.log(
    `[Pass3A] Complete: authority=${preflightAuthority}, ` +
    `coverage=${chunksReceived}/${totalChunks}, ` +
    `duration=${durationMs}ms, artifactId=${artifactId}`,
  );

  return {
    preflight,
    artifactId,
    durationMs,
    chunksFailed: failedChunkIndices.length,
  };
}

// ─── Persistence helper ──────────────────────────────────────────────────────

async function persistPreflightArtifact(params: {
  preflight: Pass3PreflightDraft;
  jobId: string;
  manuscriptId: number;
  supabase: SupabaseClient;
}): Promise<string> {
  const sourceHash = sha256Hex(
    `pass3a:${params.jobId}:${params.preflight.manuscript_read_status.chunks_received}:${params.preflight.preflight_authority}`,
  );
  return upsertEvaluationArtifact({
    supabase: params.supabase,
    jobId: params.jobId,
    manuscriptId: params.manuscriptId,
    artifactType: "pass3_preflight_draft_v1",
    content: params.preflight,
    sourceHash,
    artifactVersion: "pass3_preflight_draft_v1",
  });
}

// ─── Degraded preflight builder ──────────────────────────────────────────────

function buildDegradedPreflight(params: {
  totalChunks: number;
  reason: string;
  title: string;
}): Pass3PreflightDraft {
  return {
    schema_version: "pass3_preflight_draft_v1",
    pass: "3A",
    visibility: "internal_only",
    manuscript_read_status: {
      received_full_manuscript: false,
      source_word_count: 0,
      source_char_count: 0,
      chunks_expected: params.totalChunks,
      chunks_received: 0,
      missing_chunks: Array.from({ length: params.totalChunks }, (_, i) => i),
      truncation_detected: false,
      full_read_certified: false,
      coverage_status: "windowed_fallback",
    },
    preflight_authority: "unavailable",
    criterionDrafts: CRITERIA_KEYS.map(k => ({
      criterion: k as CriterionKey,
      provisionalScore: null,
      confidence: "low" as Pass3AConfidence,
      findingStatus: "insufficient_preflight_evidence" as const,
      rationale: `Pass 3A unavailable (${params.reason}).`,
      evidenceQuotes: [],
      actZonesSupporting: [],
      strengthFindings: [],
      weaknessFindings: [],
    })),
    whole_novel_read: {
      premise_read: `Pass 3A unavailable: ${params.reason}`,
      central_spine: "",
      emotional_engine: "",
      structural_shape: "",
      ending_read: "",
      promise_payoff_assessment: "",
    },
    character_observations: [],
    object_symbol_observations: [],
    arbitrationQuestionsForPass3B: [],
    coverageLimitations: [
      {
        zone: "Opening",
        limitation: "not_sampled",
        consequence: `All chunks failed: ${params.reason}`,
      },
    ],
    independentPressurePoints: [`Pass 3A unavailable: ${params.reason}`],
  };
}

// ─── Compact summary builder for Pass 3B injection ──────────────────────────

/**
 * Build a compact preflight summary for Pass 3B prompt injection.
 * Target: ~2000-3000 chars.
 */
export function buildCompactPreflightSummary(preflight: Pass3PreflightDraft): string {
  if (preflight.preflight_authority === "unavailable") {
    return "PREFLIGHT UNAVAILABLE — Pass 3A did not complete successfully. Rely on Pass 1 and Pass 2 only.";
  }

  const coveragePct = preflight.manuscript_read_status.chunks_expected > 0
    ? Math.round(
        (preflight.manuscript_read_status.chunks_received /
          preflight.manuscript_read_status.chunks_expected) *
          100,
      )
    : 0;

  const authorityNote =
    preflight.preflight_authority === "full"
      ? `Full authority (${coveragePct}% read, full_read_certified=${preflight.manuscript_read_status.full_read_certified})`
      : preflight.preflight_authority === "reduced"
        ? `Reduced authority (${coveragePct}% read — weight P1/P2 heavier on borderline calls)`
        : `Advisory only (${coveragePct}% read — flag but do not override P1/P2)`;

  // Provisional scores table
  const scoresTable = preflight.criterionDrafts
    .map(d => {
      const score = d.provisionalScore !== null ? String(d.provisionalScore) : "null";
      const conf = d.confidence[0].toUpperCase();
      const status = d.findingStatus === "scored" ? "" : ` [${d.findingStatus}]`;
      return `  ${d.criterion}: ${score} (${conf})${status}`;
    })
    .join("\n");

  // Key arbitration questions (top 5)
  const arbQs = preflight.arbitrationQuestionsForPass3B
    .slice(0, 5)
    .map((q, i) => `  ${i + 1}. [${q.blockerType}] ${q.question}\n     Evidence: "${q.evidence}"\n     Implication: ${q.implication}`)
    .join("\n");

  // Key character observations
  const charObs = preflight.character_observations
    .slice(0, 4)
    .map(c => `  ${c.character}: ${c.arc_read}${c.name_state_notes ? ` | Name: ${c.name_state_notes}` : ""}`)
    .join("\n");

  // Key object observations
  const objObs = preflight.object_symbol_observations
    .slice(0, 3)
    .map(o => `  ${o.object_or_motif} → ${o.payoff_status}: ${o.observed_path.slice(0, 100)}`)
    .join("\n");

  // Pressure points
  const pressurePoints = preflight.independentPressurePoints
    .slice(0, 5)
    .map((p, i) => `  ${i + 1}. ${p}`)
    .join("\n");

  const parts: string[] = [
    `=== PASS 3A PREFLIGHT DRAFT ===`,
    `Coverage: ${authorityNote}`,
    preflight.manuscript_read_status.missing_chunks.length > 0
      ? `Missing chunks: ${preflight.manuscript_read_status.missing_chunks.join(", ")}`
      : "",
    ``,
    `PROVISIONAL SCORES (independent read, before arbitration):`,
    scoresTable,
    ``,
    `WHOLE NOVEL READ:`,
    `  Premise: ${preflight.whole_novel_read.premise_read}`,
    `  Central spine: ${preflight.whole_novel_read.central_spine}`,
    `  Emotional engine: ${preflight.whole_novel_read.emotional_engine}`,
    `  Ending: ${preflight.whole_novel_read.ending_read}`,
    `  Promise/Payoff: ${preflight.whole_novel_read.promise_payoff_assessment}`,
  ];

  if (charObs) {
    parts.push(``, `CHARACTER OBSERVATIONS:`, charObs);
  }

  if (objObs) {
    parts.push(``, `OBJECT/SYMBOL OBSERVATIONS:`, objObs);
  }

  if (pressurePoints) {
    parts.push(``, `INDEPENDENT PRESSURE POINTS:`, pressurePoints);
  }

  if (arbQs) {
    parts.push(``, `ARBITRATION QUESTIONS FOR YOU TO RESOLVE:`, arbQs);
  }

  if (preflight.coverageLimitations.length > 0) {
    const limits = preflight.coverageLimitations
      .map(l => `  ${l.zone}: ${l.limitation} — ${l.consequence}`)
      .join("\n");
    parts.push(``, `COVERAGE LIMITATIONS:`, limits);
  }

  parts.push(`=== END PASS 3A PREFLIGHT DRAFT ===`);

  return parts.filter(p => p !== undefined).join("\n");
}
