/**
 * Pass 4 – Perplexity Cross-Check (Hardened / Canon-Aligned)
 *
 * Purpose:
 * Independent second-opinion adjudication over the 13 Story Criteria.
 *
 * Canon alignment:
 * - Artifact-based evaluation only (no author-intent privilege)
 * - Scores must be derived from detected signals
 * - Each criterion must include evidence + reasoning
 * - Missing evidence/reasoning invalidates the criterion
 * - Divergence identifies judgment zones; agreement strengthens validity
 *
 * This pass is diagnostic/adjudicative. It does NOT perform WAVE refinement.
 */

import {
  JsonBoundaryError,
  parseJsonObjectBoundary,
} from "./jsonParseBoundary";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import {
  classifyParseError,
  detectShapeVariant,
  emitPass4Log,
  summarizeCriteriaKeys,
  type Pass4ShapeVariant,
} from "./perplexityCrossCheckObservability";
import {
  buildPerplexityResponseSchema,
  buildRefusalRetryUserPrompt,
} from "./perplexityCrossCheckRequest";
import { buildPass4EvidencePacket } from "./pass4EvidencePacket";

// CriterionKey is re-exported below from the canonical registry. The local
// union was removed to eliminate criterion-authority drift between Pass 4 and
// the rest of the pipeline (Pass 1/2/3, QualityGate). Do NOT reintroduce.
export { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";


export interface OpenAICriterionInput {
  score: number;
  rationale?: string;
  evidence?: string[];
  detectedSignals?: string[];
  scoringBand?: "1-3" | "4-6" | "7-8" | "9-10";
}

export interface Pass4EvidenceRef {
  quote: string;
  explanation: string;
}

export interface PerplexityCriterionResponse {
  score: number;
  rationale: string;
  evidence: Pass4EvidenceRef[];
  detectedSignals: string[];
  scoringBand: "1-3" | "4-6" | "7-8" | "9-10";
  doctrineTrace: string[];
  validationReasons?: string[];
}

export interface CanonValidity {
  valid: boolean;
  reasons: string[];
}

export interface CrossCheckCriterionResult {
  openaiScore: number | null;
  openaiRationale: string;
  openaiEvidence: string[];
  openaiDetectedSignals: string[];
  openaiScoringBand?: "1-3" | "4-6" | "7-8" | "9-10";
  invalidOpenaiCriterion?: boolean;
  missingFromOpenai?: boolean;

  perplexityScore: number | null;
  perplexityRationale: string;
  perplexityEvidence: Pass4EvidenceRef[];
  perplexityDetectedSignals: string[];
  perplexityScoringBand: "1-3" | "4-6" | "7-8" | "9-10" | null;
  perplexityDoctrineTrace: string[];

  delta: number | null;
  disputed: boolean;
  missingFromPerplexity: boolean;
  invalidPerplexityCriterion: boolean;
  canonValidity: CanonValidity;
  direction: "HIGHER" | "LOWER" | "MATCH" | "MISSING" | "INVALID";
}

export interface CrossCheckOutput {
  model: string;
  crossCheckedAt: string;
  overallAgreement: "STRONG" | "MODERATE" | "WEAK";
  disputedCriteria: CriterionKey[];
  invalidCriteria: CriterionKey[];
  criteria: Record<CriterionKey, CrossCheckCriterionResult>;
  perplexitySynthesisNote: string;
  canonValid: boolean;
  warnings?: string[];
  rawPerplexityResponse?: string;
}

type PerplexityResponseShape = {
  criteria: Record<CriterionKey, PerplexityCriterionResponse>;
  synthesisNote: string;
};

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const PERPLEXITY_MODEL = "sonar-reasoning-pro";
// Premium two-AI adjudication budget. Raised from 8000 -> 12000 after Pass 4 audit
// observed 2/11 historical truncations at 8000 with sonar-reasoning-pro reasoning headers.
const PERPLEXITY_MAX_TOKENS = 12000;
export const DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS = 180_000;
export const MIN_PERPLEXITY_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Resolve the Perplexity request timeout from the environment.
 *
 * Defaults to 180_000ms (180s). Sonar-reasoning-pro on full-novel
 * packets (~30k chars) routinely takes 90-150s; 60s was the prior
 * hardcoded ceiling and proved too tight for novel-length runs. The
 * env var lets production raise/lower without a code change.
 *
 * Policy (not just parsing):
 *   - undefined / empty / whitespace  -> default
 *   - non-numeric / NaN               -> default
 *   - value < MIN (60_000ms)          -> default
 *   - valid value >= MIN              -> use it (no upper clamp)
 *
 * Exported for direct unit testing. PERPLEXITY_REQUEST_TIMEOUT_MS is
 * a module-level constant captured at import time; tests should call
 * the resolver directly rather than mutating process.env after import.
 */
export function resolvePerplexityRequestTimeoutMs(
  raw: string | undefined = process.env.PERPLEXITY_REQUEST_TIMEOUT_MS,
): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < MIN_PERPLEXITY_REQUEST_TIMEOUT_MS) {
    return DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS;
  }

  return parsed;
}

const PERPLEXITY_REQUEST_TIMEOUT_MS = resolvePerplexityRequestTimeoutMs();
const DISPUTE_THRESHOLD = 1.0;

// Phrases observed in 3/11 historical Pass 4 failures where sonar refused
// literary judgment ("I cannot do literary judgment, I am search-based"). Used
// for refusal detection before JSON parse, with a one-shot sharpened-prompt retry.
const REFUSAL_PHRASES: readonly string[] = [
  "i cannot",
  "i can't",
  "i'm unable",
  "i am unable",
  "outside my design",
  "outside the scope",
  "search-based assistant",
  "search assistant",
  "not designed to provide",
  "i don't perform",
  "i do not perform",
  "as an ai search",
];

// Pass 4 iterates the canonical criterion registry. Single source of truth:
// schemas/criteria-keys.ts. Do NOT reintroduce a local CRITERIA_KEYS array.

function assertScore(score: unknown, key: string): number {
  if (typeof score !== "number" || Number.isNaN(score)) {
    throw new Error(`[Pass4] Invalid numeric score for criterion '${key}'.`);
  }
  if (score < 1 || score > 10) {
    throw new Error(`[Pass4] Score out of range for criterion '${key}': ${score}`);
  }
  return score;
}

function normalizePerplexityScore(score: unknown, key: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (typeof score !== "number" || Number.isNaN(score)) {
    reasons.push(`[Pass4] Invalid numeric score for criterion '${key}'.`);
    return { score: 1, reasons };
  }

  if (score < 1) {
    reasons.push(`[Pass4] Score below range for criterion '${key}': ${score}`);
    return { score: 1, reasons };
  }

  if (score > 10) {
    reasons.push(`[Pass4] Score above range for criterion '${key}': ${score}`);
    return { score: 10, reasons };
  }

  return { score, reasons };
}

type OpenAIScoreNormalization =
  | { kind: "valid"; score: number }
  | { kind: "missing"; reason: string }
  | { kind: "invalid"; reason: string };

function normalizeOpenAIScore(
  item: OpenAICriterionInput | undefined,
  key: string,
): OpenAIScoreNormalization {
  if (!item) {
    return {
      kind: "missing",
      reason: `[Pass4] OpenAI criterion '${key}' missing from Pass 3 output.`,
    };
  }
  const raw = (item as { score?: unknown }).score;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      kind: "invalid",
      reason: `[Pass4] OpenAI score for criterion '${key}' is non-finite: ${String(raw)}`,
    };
  }
  if (raw < 1 || raw > 10) {
    return {
      kind: "invalid",
      reason: `[Pass4] OpenAI score for criterion '${key}' out of range: ${raw}`,
    };
  }
  return { kind: "valid", score: raw };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function isScoringBand(value: unknown): value is "1-3" | "4-6" | "7-8" | "9-10" {
  return value === "1-3" || value === "4-6" || value === "7-8" || value === "9-10";
}

function validateEvidenceArray(value: unknown): Pass4EvidenceRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const quote = typeof (item as { quote?: unknown }).quote === "string"
        ? (item as { quote: string }).quote.trim()
        : "";
      const explanation = typeof (item as { explanation?: unknown }).explanation === "string"
        ? (item as { explanation: string }).explanation.trim()
        : "";

      if (!quote || !explanation) return null;

      return { quote, explanation };
    })
    .filter((item): item is Pass4EvidenceRef => item !== null);
}
function validatePerplexityCriterion(
  key: CriterionKey,
  value: unknown
): PerplexityCriterionResponse {
  if (!value || typeof value !== "object") {
    throw new Error(`[Pass4] Criterion '${key}' missing or not an object.`);
  }

  const obj = value as Record<string, unknown>;
  const normalizedScore = normalizePerplexityScore(obj.score, key);
  const rationale = typeof obj.rationale === "string" ? obj.rationale.trim() : "";
  const evidence = validateEvidenceArray(obj.evidence);
  const detectedSignals = asStringArray(obj.detectedSignals);
  const doctrineTrace = asStringArray(obj.doctrineTrace);
  const scoringBand = obj.scoringBand;

  if (!rationale) {
    throw new Error(`[Pass4] Criterion '${key}' missing rationale.`);
  }

  if (!isScoringBand(scoringBand)) {
    throw new Error(`[Pass4] Criterion '${key}' missing valid scoringBand.`);
  }

  return {
    score: normalizedScore.score,
    rationale,
    evidence,
    detectedSignals,
    scoringBand,
    doctrineTrace,
    validationReasons: normalizedScore.reasons,
  };
}

function validateParsedResponse(parsed: unknown): PerplexityResponseShape {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("[Pass4] Parsed response is not an object.");
  }

  const obj = parsed as Record<string, unknown>;
  const criteriaObj = obj.criteria;
  const synthesisNote = typeof obj.synthesisNote === "string" ? obj.synthesisNote : "";

  if (!criteriaObj || typeof criteriaObj !== "object") {
    throw new Error("[Pass4] Parsed response missing 'criteria'.");
  }

  const criteria = {} as Record<CriterionKey, PerplexityCriterionResponse>;

  for (const key of CRITERIA_KEYS) {
    criteria[key] = validatePerplexityCriterion(
      key,
      (criteriaObj as Record<string, unknown>)[key]
    );
  }

  return { criteria, synthesisNote };
}

function bandForScore(score: number): "1-3" | "4-6" | "7-8" | "9-10" {
  if (score <= 3) return "1-3";
  if (score <= 6) return "4-6";
  if (score <= 8) return "7-8";
  return "9-10";
}

function validateCanonCompleteness(
  criterion: PerplexityCriterionResponse,
  extraReasons: string[] = [],
): CanonValidity {
  const reasons: string[] = [...extraReasons];

  if (!criterion.rationale.trim()) {
    reasons.push("Missing rationale.");
  }

  if (criterion.evidence.length === 0) {
    reasons.push("Missing quoted manuscript evidence.");
  }

  if (criterion.detectedSignals.length === 0) {
    reasons.push("Missing detected signals.");
  }

  if (criterion.doctrineTrace.length === 0) {
    reasons.push("Missing doctrine trace.");
  }

  if (!isScoringBand(criterion.scoringBand)) {
    reasons.push("Missing or invalid scoring band.");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

function extractPerplexityResponseText(rawContent: unknown): string {
  if (typeof rawContent === "string") {
    return rawContent;
  }

  if (Array.isArray(rawContent)) {
    return rawContent
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (!item || typeof item !== "object") {
          return "";
        }

        const record = item as { text?: unknown; content?: unknown };
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

  if (rawContent && typeof rawContent === "object") {
    const record = rawContent as { text?: unknown; content?: unknown };
    if (typeof record.text === "string") {
      return record.text;
    }
    if (typeof record.content === "string") {
      return record.content;
    }
  }

  return "";
}

function getRetryPass4MaxTokens(currentMaxTokens: number): number {
  return Math.min(16000, Math.max(PERPLEXITY_MAX_TOKENS, currentMaxTokens + 4000));
}

function isRetryableBoundaryFailure(error: unknown): boolean {
  return (
    error instanceof JsonBoundaryError &&
    (error.code === "JSON_PARSE_FAILED_EMPTY" ||
      error.code === "JSON_PARSE_FAILED_NO_OBJECT" ||
      error.code === "JSON_PARSE_FAILED_TRUNCATED")
  );
}

/**
 * Sentinel error thrown when sonar refuses literary judgment with a
 * "I cannot / search-based assistant" reply. Caught upstream to trigger a
 * one-shot retry with a sharpened, refusal-resistant prompt.
 */
export class PerplexityRefusalError extends Error {
  readonly phrase: string;
  constructor(phrase: string) {
    super(`[Pass4] Perplexity refused literary judgment: "${phrase}"`);
    this.name = "PerplexityRefusalError";
    this.phrase = phrase;
  }
}

/**
 * Detect a model refusal in the raw response text BEFORE attempting JSON parse.
 *
 * Returns the matched phrase if a refusal is detected anywhere in the leading
 * non-JSON prose, otherwise null. We intentionally only scan the first 1500
 * characters because legitimate JSON bodies do not begin with refusal prose.
 */
export function detectPerplexityRefusal(rawContent: string): string | null {
  if (!rawContent) return null;

  // If the raw content already begins with valid-looking JSON, skip refusal scan.
  const trimmed = rawContent.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith("```")) {
    return null;
  }

  const head = rawContent.slice(0, 1500).toLowerCase();
  for (const phrase of REFUSAL_PHRASES) {
    if (head.includes(phrase)) {
      return phrase;
    }
  }
  return null;
}

/**
 * Tolerant normalizer for Perplexity response shape variants observed in the
 * Pass 4 audit (Apr 9-10 2026 historical runs):
 *   1. Top-level `analysisMetadata` wrapper -> unwrap to inner object
 *   2. `criteria` returned as an array of {name|key, ...} -> rekey by name/key
 *   3. Per-criterion `name` field instead of being a record key -> already handled by (2)
 *   4. `synthesis_note` / `synthesis` snake_case alias -> normalize to `synthesisNote`
 *
 * Strict shape (object-keyed criteria + synthesisNote) is returned unchanged.
 */
export function normalizeCrossCheckShape(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;

  let obj = parsed as Record<string, unknown>;

  // Variant 1: analysisMetadata wrapper
  if (
    obj.analysisMetadata &&
    typeof obj.analysisMetadata === "object" &&
    (obj.criteria === undefined || obj.criteria === null)
  ) {
    const inner = obj.analysisMetadata as Record<string, unknown>;
    if (inner.criteria !== undefined) {
      obj = { ...inner, ...obj, criteria: inner.criteria };
    }
  }

  // Variant 2: criteria-as-array -> criteria-as-record
  if (Array.isArray(obj.criteria)) {
    const record: Record<string, unknown> = {};
    for (const item of obj.criteria as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const candidateKey =
        (typeof entry.key === "string" && entry.key) ||
        (typeof entry.name === "string" && entry.name) ||
        (typeof entry.criterion === "string" && entry.criterion) ||
        "";
      const normalizedKey = candidateKey.trim();
      if (!normalizedKey) continue;
      // Strip the key/name field so it doesn't leak into the criterion object.
      const { key: _k, name: _n, criterion: _c, ...rest } = entry;
      void _k; void _n; void _c;
      record[normalizedKey] = rest;
    }
    obj = { ...obj, criteria: record };
  }

  // Variant 4: snake_case synthesis alias
  if (
    (typeof obj.synthesisNote !== "string" || obj.synthesisNote.trim() === "") &&
    typeof (obj as Record<string, unknown>).synthesis_note === "string"
  ) {
    obj = { ...obj, synthesisNote: (obj as Record<string, unknown>).synthesis_note };
  }
  if (
    (typeof obj.synthesisNote !== "string" || obj.synthesisNote.trim() === "") &&
    typeof (obj as Record<string, unknown>).synthesis === "string"
  ) {
    obj = { ...obj, synthesisNote: (obj as Record<string, unknown>).synthesis };
  }

  return obj;
}

export async function runPerplexityCrossCheck(opts: {
  openaiCriteria: Record<CriterionKey, OpenAICriterionInput>;
  openaiSynthesis: string;
  manuscriptExcerpt: string;
  workType: string;
  title: string;
  perplexityApiKey: string;
  /**
   * Optional caller-supplied job id used purely for grep-by-job log correlation
   * in `[Pass4] {...}` structured log lines. No effect on behavior.
   */
  jobId?: string;
}): Promise<CrossCheckOutput> {
  const {
    openaiCriteria,
    openaiSynthesis,
    manuscriptExcerpt,
    workType,
    title,
    perplexityApiKey,
    jobId,
  } = opts;

  const fnStartMs = Date.now();
  const logJobId = jobId ?? "unknown";

  if (!perplexityApiKey) {
    throw new Error("[Pass4] PERPLEXITY_API_KEY is required.");
  }

  const criteriaBlock = CRITERIA_KEYS.map((key) => {
    const item = openaiCriteria[key];
    const score = item?.score ?? 0;
    const rationale = item?.rationale?.trim()
      ? ` \u2014 "${item.rationale.slice(0, 140)}${item.rationale.length > 140 ? "..." : ""}"`
      : "";
    return `- ${key}: ${score}/10${rationale}`;
  }).join("\n");

  // Pass 4 evidence packet: replaces the legacy first-3000-char
  // excerpt with a bounded representative slice spanning opening /
  // early / middle / late / ending windows. See
  // lib/evaluation/pipeline/pass4EvidencePacket.ts for the design.
  const evidencePacket = buildPass4EvidencePacket(manuscriptExcerpt);

  const systemPrompt = `You are an independent literary evaluation adjudicator performing a canon-governed second-opinion review.

Rules:
1. Evaluate the manuscript excerpt as a standalone artifact.
2. Do not use author intent.
3. Score each criterion ONLY from detected signals in the excerpt.
4. Each criterion MUST include:
   - score
   - rationale
   - at least one short quoted manuscript reference
   - detectedSignals
   - scoringBand
   - doctrineTrace
5. If evidence is absent, the criterion is invalid.
6. Do not provide revision advice.
7. Do not perform line-editing or WAVE refinement.
8. Return ONLY valid JSON.

Required schema:
{
  "criteria": {
    "concept": {
      "score": 1,
      "rationale": "string",
      "evidence": [{ "quote": "string", "explanation": "string" }],
      "detectedSignals": ["string"],
      "scoringBand": "1-3",
      "doctrineTrace": ["string"]
    },
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
  },
  "synthesisNote": "3-5 sentence adjudication summary"
}`;

  const userPrompt = `MANUSCRIPT TITLE: "${title}"
WORK TYPE: ${workType}

REPRESENTATIVE MANUSCRIPT EVIDENCE PACKET:
${evidencePacket.text}

PRIMARY EVALUATOR SCORES:
${criteriaBlock}

PRIMARY EVALUATOR SYNTHESIS:
${openaiSynthesis?.slice(0, 900) ?? "(none)"}

Now return the independent adjudication as JSON.`;

  const responseSchema = buildPerplexityResponseSchema(CRITERIA_KEYS);

  const initialPromptChars = systemPrompt.length + userPrompt.length;
  let attemptCounter = 0;

  emitPass4Log("log", {
    event: "pass4_start",
    job_id: logJobId,
    chunk_count: Object.keys(openaiCriteria ?? {}).length,
    model: PERPLEXITY_MODEL,
    prompt_chars: initialPromptChars,
    max_completion_tokens: PERPLEXITY_MAX_TOKENS,
    mode: process.env.EVAL_EXTERNAL_ADJUDICATION_MODE ?? null,
    pass4_packet_chars: evidencePacket.packetChars,
    pass4_packet_compression_ratio: evidencePacket.compressionRatio,
    pass4_selected_windows: evidencePacket.selectedWindows,
    pass4_includes_opening: evidencePacket.includesOpening,
    pass4_includes_ending: evidencePacket.includesEnding,
    pass4_source_words: evidencePacket.sourceWords,
  });

  const requestCompletion = async (
    maxTokens: number,
    activeUserPrompt: string = userPrompt,
  ) => {
    attemptCounter += 1;
    const attemptNumber = attemptCounter;
    const attemptStartMs = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PERPLEXITY_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${PERPLEXITY_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${perplexityApiKey}`,
        },
        body: JSON.stringify({
          model: PERPLEXITY_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: activeUserPrompt },
          ],
          temperature: 0.1,
          max_tokens: maxTokens,
          return_citations: false,
          // Pass 4 hardening (added in Pass 4 Perplexity adjudicator restore PR):
          //   - response_format pins JSON schema so sonar emits valid JSON without prose.
          //   - disable_search prevents the model from trying to look up the manuscript online.
          //   - reasoning_effort=high engages sonar-reasoning-pro's deeper analysis path.
          //   - stream_mode=concise reduces chain-of-thought leakage in non-streaming responses.
          // Unsupported fields are ignored server-side, so this stays safe across API versions.
          response_format: {
            type: "json_schema",
            json_schema: { schema: responseSchema, strict: true, name: "pass4_crosscheck" },
          },
          disable_search: true,
          reasoning_effort: "high",
          stream_mode: "concise",
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        emitPass4Log("error", {
          event: "pass4_attempt",
          job_id: logJobId,
          attempt: attemptNumber,
          elapsed_ms_attempt: Date.now() - attemptStartMs,
          http_status: null,
          response_bytes: 0,
          finish_reason: null,
          usage: null,
          error: "timeout",
        });
        throw new Error(
          `[Pass4] Perplexity request timed out after ${PERPLEXITY_REQUEST_TIMEOUT_MS}ms`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text();
      emitPass4Log("error", {
        event: "pass4_attempt",
        job_id: logJobId,
        attempt: attemptNumber,
        elapsed_ms_attempt: Date.now() - attemptStartMs,
        http_status: response.status,
        response_bytes: errText.length,
        finish_reason: null,
        usage: null,
        error: "http_error",
      });
      throw new Error(
        `[Pass4] Perplexity API error ${response.status}: ${errText.slice(0, 400)}`
      );
    }

    const raw = await response.json();
    const rawMessageContent = raw?.choices?.[0]?.message?.content;
    const rawContent = extractPerplexityResponseText(rawMessageContent);
    const finishReason = typeof raw?.choices?.[0]?.finish_reason === "string"
      ? raw.choices[0].finish_reason
      : "unknown";
    const usage = raw && typeof raw === "object" && raw !== null && "usage" in raw
      ? (raw as { usage?: unknown }).usage ?? null
      : null;

    let responseBytes = 0;
    try {
      responseBytes = JSON.stringify(raw).length;
    } catch {
      responseBytes = rawContent.length;
    }

    emitPass4Log("log", {
      event: "pass4_attempt",
      job_id: logJobId,
      attempt: attemptNumber,
      elapsed_ms_attempt: Date.now() - attemptStartMs,
      http_status: response.status,
      response_bytes: responseBytes,
      finish_reason: finishReason,
      usage,
    });

    return { rawContent, finishReason, attemptNumber };
  };

  const warnings: string[] = [];
  let activeMaxTokens = PERPLEXITY_MAX_TOKENS;
  let activeUserPrompt = userPrompt;
  let attempt1 = await requestCompletion(activeMaxTokens, activeUserPrompt);
  let rawContent = attempt1.rawContent;
  let finishReason = attempt1.finishReason;
  let lastAttemptNumber = attempt1.attemptNumber;

  // Refusal detection + one-shot retry with a sharpened prompt. This addresses
  // the 3/11 historical Pass 4 failures where sonar replied with prose like
  // "I cannot do literary judgment, I am search-based." Detected before JSON
  // parsing because a refusal will fail boundary parsing anyway and we want a
  // cleaner error signature + a real recovery attempt.
  const initialRefusal = detectPerplexityRefusal(rawContent);
  if (initialRefusal) {
    emitPass4Log("warn", {
      event: "pass4_parse",
      job_id: logJobId,
      attempt: lastAttemptNumber,
      refusal_detected: true,
      refusal_signature: initialRefusal,
      shape_variant: "unknown",
      parse_outcome: "refusal",
      criteria_keys_seen: [],
      error_message: `refusal: ${initialRefusal}`.slice(0, 200),
    });
    warnings.push(
      `Perplexity refused literary judgment ("${initialRefusal}"); retried with sharpened prompt.`,
    );
    console.warn("[Pass4] Refusal detected, retrying with sharpened prompt", {
      model: PERPLEXITY_MODEL,
      phrase: initialRefusal,
      previewLen: rawContent.length,
    });
    activeUserPrompt = buildRefusalRetryUserPrompt(userPrompt);
    const retryResp = await requestCompletion(activeMaxTokens, activeUserPrompt);
    rawContent = retryResp.rawContent;
    finishReason = retryResp.finishReason;
    lastAttemptNumber = retryResp.attemptNumber;

    const retryRefusal = detectPerplexityRefusal(rawContent);
    if (retryRefusal) {
      emitPass4Log("error", {
        event: "pass4_parse",
        job_id: logJobId,
        attempt: lastAttemptNumber,
        refusal_detected: true,
        refusal_signature: retryRefusal,
        shape_variant: "unknown",
        parse_outcome: "refusal",
        criteria_keys_seen: [],
        error_message: `refusal: ${retryRefusal}`.slice(0, 200),
      });
      emitPass4Log("error", {
        event: "pass4_failed",
        job_id: logJobId,
        total_elapsed_ms: Date.now() - fnStartMs,
        attempts_made: lastAttemptNumber,
        final_status: "refusal_exhausted",
        cross_check_returned: false,
        error_code: "PASS4_REFUSAL_EXHAUSTED",
      });
      throw new PerplexityRefusalError(retryRefusal);
    }
  }

  if (finishReason === "length") {
    console.warn("[Pass4] finish_reason=length — Perplexity output may be truncated", {
      model: PERPLEXITY_MODEL,
      rawContentLen: rawContent.length,
      maxTokens: activeMaxTokens,
    });
  }

  console.log(`[Pass4] raw Perplexity response preview len=${rawContent.length}: ${rawContent.slice(0, 200)}`);

  const parseAndLog = (
    content: string,
    attemptNum: number,
    fnLogJobId: string,
  ): PerplexityResponseShape => {
    let preNormalized: unknown = null;
    let shapeVariant: Pass4ShapeVariant = "unknown";
    try {
      const boundary = parseJsonObjectBoundary<Record<string, unknown>>(content, {
        label: "Pass4",
      });
      preNormalized = boundary.value;
      shapeVariant = detectShapeVariant(preNormalized);
      const normalized = normalizeCrossCheckShape(preNormalized);
      const parsed = validateParsedResponse(normalized);
      emitPass4Log("log", {
        event: "pass4_parse",
        job_id: fnLogJobId,
        attempt: attemptNum,
        refusal_detected: false,
        refusal_signature: null,
        shape_variant: shapeVariant,
        parse_outcome: "ok",
        criteria_keys_seen: Object.keys(parsed.criteria),
        error_message: null,
      });
      return parsed;
    } catch (error) {
      const { outcome } = classifyParseError(error);
      const errMsg = error instanceof Error ? error.message : String(error);
      emitPass4Log("warn", {
        event: "pass4_parse",
        job_id: fnLogJobId,
        attempt: attemptNum,
        refusal_detected: false,
        refusal_signature: null,
        shape_variant: shapeVariant,
        parse_outcome: outcome,
        criteria_keys_seen: summarizeCriteriaKeys(preNormalized),
        error_message: errMsg.slice(0, 200),
      });
      throw error;
    }
  };

  let parsed: PerplexityResponseShape;
  try {
    parsed = parseAndLog(rawContent, lastAttemptNumber, logJobId);
  } catch (error) {
    const shouldRetry = finishReason === "length" || isRetryableBoundaryFailure(error);
    if (shouldRetry) {
      const retryMaxTokens = getRetryPass4MaxTokens(activeMaxTokens);
      warnings.push("Perplexity cross-check required a retry after a truncated or incomplete JSON response.");
      console.warn("[Pass4] Retrying Perplexity cross-check with higher token budget", {
        model: PERPLEXITY_MODEL,
        initialMaxTokens: activeMaxTokens,
        retryMaxTokens,
        finishReason,
        error: error instanceof Error ? error.message : String(error),
      });

      activeMaxTokens = retryMaxTokens;
      const truncRetry = await requestCompletion(activeMaxTokens, activeUserPrompt);
      rawContent = truncRetry.rawContent;
      finishReason = truncRetry.finishReason;
      lastAttemptNumber = truncRetry.attemptNumber;
      if (finishReason === "length") {
        console.warn("[Pass4] retry finish_reason=length — response may still be truncated", {
          model: PERPLEXITY_MODEL,
          rawContentLen: rawContent.length,
          maxTokens: activeMaxTokens,
        });
      }
      console.log(`[Pass4] retry raw Perplexity response preview len=${rawContent.length}: ${rawContent.slice(0, 200)}`);

      try {
        parsed = parseAndLog(rawContent, lastAttemptNumber, logJobId);
      } catch (retryError) {
        const { errorCode, finalStatus } = classifyParseError(retryError);
        emitPass4Log("error", {
          event: "pass4_failed",
          job_id: logJobId,
          total_elapsed_ms: Date.now() - fnStartMs,
          attempts_made: lastAttemptNumber,
          final_status: finalStatus,
          cross_check_returned: false,
          error_code: errorCode,
        });
        if (retryError instanceof JsonBoundaryError) {
          throw new Error(
            `[Pass4] ${retryError.code}: ${retryError.message} (after retry; finish_reason=${finishReason}; preview=${rawContent
              .slice(0, 200)
              .replace(/\s+/g, " ")})`,
          );
        }

        throw new Error(
          `[Pass4] JSON parse/validation failed after retry: ${(retryError as Error).message}`,
        );
      }
    } else if (error instanceof JsonBoundaryError) {
      emitPass4Log("error", {
        event: "pass4_failed",
        job_id: logJobId,
        total_elapsed_ms: Date.now() - fnStartMs,
        attempts_made: lastAttemptNumber,
        final_status: "schema_invalid",
        cross_check_returned: false,
        error_code: `PASS4_${error.code}`,
      });
      throw new Error(
        `[Pass4] ${error.code}: ${error.message}`
      );
    } else {
      const { errorCode, finalStatus } = classifyParseError(error);
      emitPass4Log("error", {
        event: "pass4_failed",
        job_id: logJobId,
        total_elapsed_ms: Date.now() - fnStartMs,
        attempts_made: lastAttemptNumber,
        final_status: finalStatus,
        cross_check_returned: false,
        error_code: errorCode,
      });
      throw new Error(
        `[Pass4] JSON parse/validation failed: ${(error as Error).message}`
      );
    }
  }

  const criteria = {} as Record<CriterionKey, CrossCheckCriterionResult>;
  const disputedCriteria: CriterionKey[] = [];
  const invalidCriteria: CriterionKey[] = [];

  for (const key of CRITERIA_KEYS) {
    const openaiItem = openaiCriteria[key];
    const openaiNorm = normalizeOpenAIScore(openaiItem, key);
    const openaiScore = openaiNorm.kind === "valid" ? openaiNorm.score : null;
    const openaiRationale = openaiItem?.rationale ?? "";
    const openaiEvidence = openaiItem?.evidence ?? [];
    const openaiDetectedSignals = openaiItem?.detectedSignals ?? [];
    const openaiScoringBand =
      openaiItem?.scoringBand ??
      (openaiScore !== null ? bandForScore(openaiScore) : undefined);
    const openaiMissing = openaiNorm.kind === "missing";
    const openaiInvalid = openaiNorm.kind === "invalid";
    const openaiUnusable = openaiMissing || openaiInvalid;

    if (openaiUnusable) {
      warnings.push(
        openaiNorm.kind === "missing" ? openaiNorm.reason : openaiNorm.reason,
      );
    }

    const pplx = parsed.criteria[key];

    if (!pplx) {
      invalidCriteria.push(key);
      disputedCriteria.push(key);

      criteria[key] = {
        openaiScore,
        openaiRationale,
        openaiEvidence,
        openaiDetectedSignals,
        openaiScoringBand,
        invalidOpenaiCriterion: openaiInvalid,
        missingFromOpenai: openaiMissing,
        perplexityScore: null,
        perplexityRationale: "",
        perplexityEvidence: [],
        perplexityDetectedSignals: [],
        perplexityScoringBand: null,
        perplexityDoctrineTrace: [],
        delta: null,
        disputed: true,
        missingFromPerplexity: true,
        invalidPerplexityCriterion: true,
        canonValidity: {
          valid: false,
          reasons: ["Criterion missing from Perplexity response."],
        },
        direction: "MISSING",
      };
      continue;
    }

    const canonValidity = validateCanonCompleteness(pplx, pplx.validationReasons ?? []);
    const invalidPerplexityCriterion = !canonValidity.valid;
    const perplexityScore = invalidPerplexityCriterion ? null : pplx.score;
    const delta =
      openaiScore === null || perplexityScore === null
        ? null
        : Math.abs(openaiScore - perplexityScore);
    const disputed =
      openaiUnusable ||
      invalidPerplexityCriterion ||
      delta === null ||
      delta > DISPUTE_THRESHOLD;

    if (openaiUnusable || invalidPerplexityCriterion) {
      invalidCriteria.push(key);
    }
    if (disputed) {
      disputedCriteria.push(key);
    }

    let direction: CrossCheckCriterionResult["direction"];
    if (openaiMissing) {
      direction = "MISSING";
    } else if (openaiInvalid || invalidPerplexityCriterion || perplexityScore === null || openaiScore === null) {
      direction = "INVALID";
    } else if (perplexityScore > openaiScore) {
      direction = "HIGHER";
    } else if (perplexityScore < openaiScore) {
      direction = "LOWER";
    } else {
      direction = "MATCH";
    }

    criteria[key] = {
      openaiScore,
      openaiRationale,
      openaiEvidence,
      openaiDetectedSignals,
      openaiScoringBand,
      invalidOpenaiCriterion: openaiInvalid,
      missingFromOpenai: openaiMissing,
      perplexityScore,
      perplexityRationale: pplx.rationale,
      perplexityEvidence: pplx.evidence,
      perplexityDetectedSignals: pplx.detectedSignals,
      perplexityScoringBand: pplx.scoringBand,
      perplexityDoctrineTrace: pplx.doctrineTrace,
      delta: delta === null ? null : Math.round(delta * 10) / 10,
      disputed,
      missingFromPerplexity: false,
      invalidPerplexityCriterion,
      canonValidity,
      direction,
    };
  }

  const disputeRatio = disputedCriteria.length / CRITERIA_KEYS.length;
  const overallAgreement: CrossCheckOutput["overallAgreement"] =
    disputeRatio === 0 ? "STRONG" : disputeRatio <= 0.3 ? "MODERATE" : "WEAK";

  emitPass4Log("log", {
    event: "pass4_complete",
    job_id: logJobId,
    total_elapsed_ms: Date.now() - fnStartMs,
    attempts_made: lastAttemptNumber,
    final_status: "success",
    cross_check_returned: true,
    error_code: null,
  });

  return {
    model: PERPLEXITY_MODEL,
    crossCheckedAt: new Date().toISOString(),
    overallAgreement,
    disputedCriteria,
    invalidCriteria,
    criteria,
    perplexitySynthesisNote: parsed.synthesisNote ?? "",
    canonValid: invalidCriteria.length === 0,
    warnings: warnings.length > 0 ? warnings : undefined,
    rawPerplexityResponse: rawContent,
  };
}