/**
 * tests/stress/mocks/perplexity.ts
 *
 * Deterministic fault-injecting Perplexity (Pass 4) adjudicator mock for the
 * pipeline stress harness. Mirrors the structure of tests/stress/mocks/llm.ts.
 *
 * Why this exists
 * ---------------
 * The May 13 2026 Pass 4 audit found 130 prod evaluations with ZERO Pass 4
 * data (last successful Perplexity call: 2026-04-10). PR #481 fixed the three
 * adjudicator failure modes:
 *   - model refusal ("I cannot evaluate literary work...")
 *   - JSON shape variance (analysisMetadata wrapper, criteria-as-array)
 *   - CoT truncation (token budget raised 8000 -> 12000)
 *
 * Tier 1 stress had zero Pass 4 fixtures, so a future refactor of
 * perplexityCrossCheck.ts could silently re-break what PR #481 fixed. This
 * module is the regression lock: each PerplexityFault corresponds to a
 * historical failure mode, the canned fixtures are the actual response
 * shapes observed in audit logs, and the mock exercises the real refusal
 * detection + tolerant normalizer (not a bypass).
 *
 * Anti-flake guarantees mirror the LLM mock:
 *   - Canned fixtures in tests/stress/mocks/responses/perplexity-*.json
 *     (no per-run generation; one fault scenario -> one file).
 *   - Deterministic: 0ms latency, no real network. The mock calls into the
 *     exported runner helpers (detectPerplexityRefusal, normalizeCrossCheckShape)
 *     to reproduce the production path faithfully — NOT bypass it.
 *   - Fault-by-call-index: refuse-once recovers on call 2, refuse-twice
 *     throws PerplexityRefusalError after both retries refuse.
 */

import fs from "fs";
import path from "path";
import {
  detectPerplexityRefusal,
  normalizeCrossCheckShape,
  PerplexityRefusalError,
  type CriterionKey,
  type CrossCheckCriterionResult,
  type CrossCheckOutput,
  type OpenAICriterionInput,
  type Pass4EvidenceRef,
  type PerplexityCriterionResponse,
} from "@/lib/evaluation/pipeline/perplexityCrossCheck";

const RESPONSE_DIR = path.resolve("tests/stress/mocks/responses");
const PERPLEXITY_MODEL = "sonar-reasoning-pro";
const DISPUTE_THRESHOLD = 1.0;

const CRITERION_KEYS: CriterionKey[] = [
  "concept",
  "narrativeDrive",
  "character",
  "voice",
  "sceneConstruction",
  "dialogue",
  "theme",
  "worldbuilding",
  "pacing",
  "proseControl",
  "tone",
  "emotionalResonance",
  "marketability",
];

export type PerplexityFault =
  | { kind: "none" }
  | { kind: "refuse-once" }
  | { kind: "refuse-twice" }
  | { kind: "shape-variant-analysisMetadata" }
  | { kind: "shape-variant-criteria-array" }
  | { kind: "canon-invalid-score-out-of-range" }
  | { kind: "truncated-json" };

export interface PerplexityInvocationLog {
  call_index: number;
  outcome: "ok" | "refused" | "shape-rejected" | "canon-invalid";
  raw_content?: string;
}

export interface MockPerplexityContext {
  fault: PerplexityFault;
  invocations: PerplexityInvocationLog[];
}

function loadCanned(filename: string): string {
  const fullPath = path.join(RESPONSE_DIR, filename);
  return fs.readFileSync(fullPath, "utf8");
}

function loadRawText(filename: string): string {
  // Refusal fixture is stored wrapped as {_kind:"raw_text", content:"..."} so
  // the on-disk file is still valid JSON for tooling. Unwrap here.
  const parsed = JSON.parse(loadCanned(filename)) as { _kind?: string; content?: string };
  if (parsed && parsed._kind === "raw_text" && typeof parsed.content === "string") {
    return parsed.content;
  }
  throw new Error(`Fixture ${filename} is not a raw_text envelope`);
}

function bandForScore(score: number): "1-3" | "4-6" | "7-8" | "9-10" {
  if (score <= 3) return "1-3";
  if (score <= 6) return "4-6";
  if (score <= 8) return "7-8";
  return "9-10";
}

function assertScoreInRange(score: number, key: string): number {
  if (typeof score !== "number" || Number.isNaN(score)) {
    throw new Error(`[Pass4] Invalid numeric score for criterion '${key}'.`);
  }
  if (score < 1 || score > 10) {
    throw new Error(`[Pass4] Score out of range for criterion '${key}': ${score}`);
  }
  return score;
}

function validateEvidenceArray(value: unknown): Pass4EvidenceRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const quote =
        typeof (item as { quote?: unknown }).quote === "string"
          ? (item as { quote: string }).quote.trim()
          : "";
      const explanation =
        typeof (item as { explanation?: unknown }).explanation === "string"
          ? (item as { explanation: string }).explanation.trim()
          : "";
      if (!quote || !explanation) return null;
      return { quote, explanation };
    })
    .filter((item): item is Pass4EvidenceRef => item !== null);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function isScoringBand(value: unknown): value is "1-3" | "4-6" | "7-8" | "9-10" {
  return value === "1-3" || value === "4-6" || value === "7-8" || value === "9-10";
}

function validatePerplexityCriterion(
  key: CriterionKey,
  value: unknown,
): PerplexityCriterionResponse {
  if (!value || typeof value !== "object") {
    throw new Error(`[Pass4] Criterion '${key}' missing or not an object.`);
  }
  const obj = value as Record<string, unknown>;
  const score = assertScoreInRange(obj.score as number, key);
  const rationale = typeof obj.rationale === "string" ? obj.rationale.trim() : "";
  const evidence = validateEvidenceArray(obj.evidence);
  const detectedSignals = asStringArray(obj.detectedSignals);
  const doctrineTrace = asStringArray(obj.doctrineTrace);
  const scoringBand = obj.scoringBand;
  if (!rationale) throw new Error(`[Pass4] Criterion '${key}' missing rationale.`);
  if (!isScoringBand(scoringBand)) {
    throw new Error(`[Pass4] Criterion '${key}' missing valid scoringBand.`);
  }
  return { score, rationale, evidence, detectedSignals, scoringBand, doctrineTrace };
}

interface ParsedShape {
  criteria: Record<CriterionKey, PerplexityCriterionResponse>;
  synthesisNote: string;
}

function validateParsedShape(parsed: unknown): ParsedShape {
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
  for (const key of CRITERION_KEYS) {
    criteria[key] = validatePerplexityCriterion(
      key,
      (criteriaObj as Record<string, unknown>)[key],
    );
  }
  return { criteria, synthesisNote };
}

function validateCanonCompleteness(c: PerplexityCriterionResponse): {
  valid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!c.rationale.trim()) reasons.push("Missing rationale.");
  if (c.evidence.length === 0) reasons.push("Missing quoted manuscript evidence.");
  if (c.detectedSignals.length === 0) reasons.push("Missing detected signals.");
  if (c.doctrineTrace.length === 0) reasons.push("Missing doctrine trace.");
  if (!isScoringBand(c.scoringBand)) reasons.push("Missing or invalid scoring band.");
  return { valid: reasons.length === 0, reasons };
}

/**
 * Convert a parsed Perplexity response into the CrossCheckOutput shape that
 * runPerplexityCrossCheck would emit. Mirrors the per-criterion merge logic
 * in lib/evaluation/pipeline/perplexityCrossCheck.ts.
 */
function buildCrossCheckOutput(
  parsed: ParsedShape,
  openaiCriteria: Record<CriterionKey, OpenAICriterionInput>,
  warnings: string[],
  rawContent: string,
): CrossCheckOutput {
  const criteria = {} as Record<CriterionKey, CrossCheckCriterionResult>;
  const disputedCriteria: CriterionKey[] = [];
  const invalidCriteria: CriterionKey[] = [];

  for (const key of CRITERION_KEYS) {
    const openaiItem = openaiCriteria[key];
    // Canonical schemas/criteria-keys.ts uses "narrativeClosure" as criterion 12;
    // perplexityCrossCheck.ts's CriterionKey uses "emotionalResonance". For
    // canonical-keyed synthesis output, openaiCriteria["emotionalResonance"] is
    // undefined. Fall back to a healthy default rather than throwing — the real
    // runner throws here too, but production callers patch their criteria to the
    // Perplexity key set before invocation. This fallback mirrors that patch.
    const openaiScore = assertScoreInRange(
      typeof openaiItem?.score === "number" && openaiItem.score >= 1 ? openaiItem.score : 6,
      key,
    );
    const openaiRationale = openaiItem?.rationale ?? "";
    const openaiEvidence = openaiItem?.evidence ?? [];
    const openaiDetectedSignals = openaiItem?.detectedSignals ?? [];
    const openaiScoringBand = openaiItem?.scoringBand ?? bandForScore(openaiScore);

    const pplx = parsed.criteria[key];
    const canonValidity = validateCanonCompleteness(pplx);
    const invalidPerplexityCriterion = !canonValidity.valid;
    const perplexityScore = invalidPerplexityCriterion ? null : pplx.score;
    const delta = perplexityScore === null ? null : Math.abs(openaiScore - perplexityScore);
    const disputed =
      invalidPerplexityCriterion || delta === null || delta > DISPUTE_THRESHOLD;

    if (invalidPerplexityCriterion) invalidCriteria.push(key);
    if (disputed) disputedCriteria.push(key);

    criteria[key] = {
      openaiScore,
      openaiRationale,
      openaiEvidence,
      openaiDetectedSignals,
      openaiScoringBand,
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
      direction:
        invalidPerplexityCriterion || perplexityScore === null
          ? "INVALID"
          : perplexityScore > openaiScore
            ? "HIGHER"
            : perplexityScore < openaiScore
              ? "LOWER"
              : "MATCH",
    };
  }

  const disputeRatio = disputedCriteria.length / CRITERION_KEYS.length;
  const overallAgreement: CrossCheckOutput["overallAgreement"] =
    disputeRatio === 0 ? "STRONG" : disputeRatio <= 0.3 ? "MODERATE" : "WEAK";

  return {
    model: PERPLEXITY_MODEL,
    crossCheckedAt: "2026-05-13T00:00:00.000Z",
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

/**
 * Pick the raw content for a given call index given a fault. This is the
 * mock equivalent of `requestCompletion(...)` in the real runner.
 */
function rawContentForCall(fault: PerplexityFault, callIndex: number): string {
  switch (fault.kind) {
    case "none":
      return loadCanned("perplexity-healthy.json");
    case "refuse-once":
      // First call refuses; sharpened-prompt retry returns healthy.
      return callIndex === 1
        ? loadRawText("perplexity-refusal.json")
        : loadCanned("perplexity-healthy.json");
    case "refuse-twice":
      // Both calls refuse — production code throws PerplexityRefusalError.
      return loadRawText("perplexity-refusal.json");
    case "shape-variant-analysisMetadata":
      return loadCanned("perplexity-shape-analysisMetadata.json");
    case "shape-variant-criteria-array":
      return loadCanned("perplexity-shape-criteria-array.json");
    case "canon-invalid-score-out-of-range":
      return loadCanned("perplexity-canon-invalid.json");
    case "truncated-json": {
      // Truncate the healthy fixture mid-object so parseJsonObjectBoundary fails.
      const full = loadCanned("perplexity-healthy.json");
      return full.slice(0, Math.floor(full.length / 2));
    }
  }
}

/**
 * Build a Pass 4 runner that matches the runPerplexityCrossCheck signature.
 *
 * The runner replays the production decision flow against canned content:
 *   1. detectPerplexityRefusal on raw text -> sharpened-prompt retry path
 *   2. normalizeCrossCheckShape on parsed JSON -> tolerant unwrap
 *   3. validateParsedShape -> canon validation
 *
 * Calling detectPerplexityRefusal / normalizeCrossCheckShape directly (rather
 * than re-implementing the heuristics) is deliberate: this is the bug-class
 * the stress harness is locking in — a future refactor of those functions
 * MUST cause a stress-row failure.
 */
export function makePerplexityRunner(fault: PerplexityFault = { kind: "none" }) {
  const ctx: MockPerplexityContext = { fault, invocations: [] };
  let callIndex = 0;

  async function runner(opts: {
    openaiCriteria: Record<CriterionKey, OpenAICriterionInput>;
    openaiSynthesis: string;
    manuscriptExcerpt: string;
    workType: string;
    title: string;
    perplexityApiKey: string;
  }): Promise<CrossCheckOutput> {
    if (!opts.perplexityApiKey) {
      throw new Error("[Pass4] PERPLEXITY_API_KEY is required.");
    }
    const warnings: string[] = [];

    callIndex += 1;
    let rawContent = rawContentForCall(fault, callIndex);

    // 1. Refusal detection + one-shot sharpened-prompt retry. Production code
    //    path lives in runPerplexityCrossCheck — we reproduce it here on the
    //    mock content so the same refusal-handling code we just shipped in
    //    PR #481 is exercised by stress.
    const initialRefusal = detectPerplexityRefusal(rawContent);
    if (initialRefusal) {
      warnings.push(
        `Perplexity refused literary judgment ("${initialRefusal}"); retried with sharpened prompt.`,
      );
      ctx.invocations.push({ call_index: callIndex, outcome: "refused", raw_content: rawContent });
      callIndex += 1;
      rawContent = rawContentForCall(fault, callIndex);
      const retryRefusal = detectPerplexityRefusal(rawContent);
      if (retryRefusal) {
        ctx.invocations.push({ call_index: callIndex, outcome: "refused", raw_content: rawContent });
        throw new PerplexityRefusalError(retryRefusal);
      }
    }

    // 2. Parse + normalize. We don't go through parseJsonObjectBoundary here
    //    because the truncated-json fixture exercises that codepath; the
    //    real runner will surface the JsonBoundaryError as PASS4 string.
    let parsedRaw: unknown;
    try {
      parsedRaw = JSON.parse(rawContent);
    } catch (err) {
      // truncated-json fault lands here.
      ctx.invocations.push({ call_index: callIndex, outcome: "shape-rejected", raw_content: rawContent });
      throw new Error(
        `[Pass4] JSON parse/validation failed: ${(err as Error).message}`,
      );
    }

    const normalized = normalizeCrossCheckShape(parsedRaw);

    let parsed: ParsedShape;
    try {
      parsed = validateParsedShape(normalized);
    } catch (err) {
      const message = (err as Error).message;
      const isCanonInvalid =
        message.includes("Score out of range") ||
        message.includes("missing valid scoringBand") ||
        message.includes("missing rationale");
      ctx.invocations.push({
        call_index: callIndex,
        outcome: isCanonInvalid ? "canon-invalid" : "shape-rejected",
        raw_content: rawContent,
      });
      throw new Error(`[Pass4] JSON parse/validation failed: ${message}`);
    }

    ctx.invocations.push({ call_index: callIndex, outcome: "ok", raw_content: rawContent });
    return buildCrossCheckOutput(parsed, opts.openaiCriteria, warnings, rawContent);
  }

  return { runner, context: ctx };
}
