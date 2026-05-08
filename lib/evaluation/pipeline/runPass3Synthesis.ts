/**
 * Phase 2.7 — Pass 3: Synthesis & Reconciliation Runner
 *
 * Receives Pass 1 + Pass 2 outputs and reconciles them into a unified
 * dual-axis evaluation. Also handles local reconciliation of scores
 * as a deterministic fallback if the AI response is incomplete.
 *
 * Temperature: 0.2 (per Vol III Tools §PASS3 — lower for precision)
 * Max tokens: 16000 (default, override via EVAL_PASS3_MAX_TOKENS)
 */

import OpenAI from "openai";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS3_SYSTEM_PROMPT, PASS3_PROMPT_VERSION, buildPass3UserPrompt } from "./prompts/pass3-synthesis";
import type {
  SinglePassOutput,
  SynthesisOutput,
  SynthesizedCriterion,
  EvidenceAnchor,
  CompletionUsage,
  PassCompletionCapture,
  ManuscriptChunkEvidence,
} from "./types";
import type { CanonRegistry } from "@/lib/governance/canonRegistry";
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPipelineModel,
  OPENAI_SDK_MAX_RETRIES,
} from "@/lib/evaluation/policy";
import { buildComparisonPacket } from "./comparisonPacket";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { summarizePromptCoverage, getDefaultSynthesisReferenceCharBudget } from "./promptInput";
import { PLACEHOLDER_RATIONALE_PATTERNS } from "./placeholderRationalePatterns";
import { JsonBoundaryError, parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";
import { enforcePass3QualityGuards } from "@/lib/evaluation/governance/runtimeQualityGuards";
import { normalizeIssueFamily, normalizeStrategicLever, normalizeRevisionGranularity } from "./recommendationSemantics";
import { DIALOGUE_MECHANISM_MARKERS } from "./mechanismMarkers";
import {
  EDITORIAL_CONTEXT_MARKERS,
  EDITORIAL_FIX_MARKERS,
  EDITORIAL_MECHANISM_MARKERS,
  EDITORIAL_READER_EFFECT_MARKERS,
} from "./editorialRecommendationContract";
import {
  annotateSurfaceIntegrityFlag,
  checkSurfaceIntegrity,
  repairSurfaceIntegrity,
} from "./surfaceIntegrity";
import { analyzeDialogueAttributionForGate } from "@/lib/evaluation/pov/analyzeDialogueAttribution";
import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";

const PASS3_TEMPERATURE = 0.2;
// Pass 3 model is resolved exclusively via getCanonicalPipelineModel(opts.model). The central
// resolver in policy.ts enforces the production reasoning-model invariant (forbids o-series
// unless EVAL_ALLOW_REASONING_MODELS=true).
const PASS3_MIN_RATIONALE_LENGTH = 40;
const PASS3_PLACEHOLDER_RATIONALE_PATTERNS = PLACEHOLDER_RATIONALE_PATTERNS;
const PASS3_VOICE_MECHANISM_MARKERS = [
  "pov",
  "point of view",
  "perspective",
  "psychic distance",
  "narrative distance",
  "focali",
  "first person",
  "third person",
  "close third",
  "free indirect",
  "interior",
  "interiority",
  "internal",
  "narrat",
  "rendering",
  "diction",
  "register",
  "syntax",
  "cadence",
  "tone",
  "rhythm",
] as const;

type CompletionChoice = {
  message?: {
    content?: unknown;
    refusal?: unknown;
  };
  finish_reason?: unknown;
};

function extractResponseText(content: unknown): string {
  if (typeof content === "string") {
    return content;
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
  coverage: ReturnType<typeof summarizePromptCoverage>;
  comparisonPacketChars: number;
  promptChars: number;
}): string {
  const { model, completion, firstChoice, rawContent, coverage, comparisonPacketChars, promptChars } = params;
  const usage = completion.usage;
  const finishReason =
    typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";
  const contentType =
    rawContent === null ? "null" : Array.isArray(rawContent) ? "array" : typeof rawContent;
  const refusal =
    typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined;
  const choiceCount = Array.isArray(completion.choices) ? completion.choices.length : 0;
  const likelyBudgetPressure = finishReason === "length" ? " budget_exhausted_likely=true" : "";

  return (
    `[Pass3] Empty response from OpenAI ` +
    `(model=${model} finish_reason=${finishReason} content_type=${contentType} choices=${choiceCount} ` +
    `max_output_tokens=${getEvaluationRuntimeConfig().pass.pass3MaxTokens} prompt_chars=${promptChars} comparison_packet_chars=${comparisonPacketChars} ` +
    `reference_chars=${coverage.analyzedChars} source_chars=${coverage.sourceChars}` +
    `${typeof usage?.prompt_tokens === "number" ? ` prompt_tokens=${usage.prompt_tokens}` : ""}` +
    `${typeof usage?.completion_tokens === "number" ? ` completion_tokens=${usage.completion_tokens}` : ""}` +
    `${typeof usage?.total_tokens === "number" ? ` total_tokens=${usage.total_tokens}` : ""}` +
    `${refusal ? ` refusal=${JSON.stringify(refusal).slice(0, 120)}` : ""}` +
    `${likelyBudgetPressure})`
  );
}

function assertPass3PromptTripwires(userPrompt: string): void {
  if (userPrompt.length > getEvaluationRuntimeConfig().pass.pass3PromptMaxChars) {
    throw new Error(
      `[Pass3] PROMPT_TOO_LARGE: prompt_chars=${userPrompt.length} limit=${getEvaluationRuntimeConfig().pass.pass3PromptMaxChars}`,
    );
  }

  const hasLegacySectionHeaders =
    userPrompt.includes("## PASS 1 OUTPUT (Craft Execution)") ||
    userPrompt.includes("## PASS 2 OUTPUT (Editorial/Literary Insight)");
  const hasRawPass1Shape = /"pass"\s*:\s*1\s*,\s*"axis"\s*:\s*"craft_execution"/.test(userPrompt);
  const hasRawPass2Shape = /"pass"\s*:\s*2\s*,\s*"axis"\s*:\s*"editorial_literary"/.test(userPrompt);

  if (hasLegacySectionHeaders || (hasRawPass1Shape && hasRawPass2Shape)) {
    throw new Error("[Pass3] RAW_PASS_PAYLOAD_DETECTED: raw pass payload is forbidden in Pass 3 prompt input");
  }
}

function buildPromptPacketFromComparison(packet: ReturnType<typeof buildComparisonPacket>) {
  const criteria = packet.criteria.map((criterion) => {
    const base = {
      key: criterion.key,
      state: criterion.state,
      score_delta: criterion.score_delta,
      pass1_score: criterion.pass1_score,
      pass2_score: criterion.pass2_score,
      pass1_mechanism_summary: criterion.pass1_mechanism_summary,
      pass2_rationale_short: criterion.pass2_rationale_short,
    };

    if (criterion.state === "soft_divergence" || criterion.state === "hard_divergence") {
      return {
        ...base,
        pass1_evidence: criterion.pass1_evidence.slice(0, 1),
        disputed_excerpt_window: criterion.disputed_excerpt_window,
      };
    }

    if (criterion.state === "missing_or_invalid") {
      return {
        ...base,
        pass1_evidence: criterion.pass1_evidence.slice(0, 1),
      };
    }

    return base;
  });

  return {
    criteria_count_by_state: packet.criteria_count_by_state,
    criteria,
  };
}

/** Function signature for creating a chat completion (enables DI for testing). */
export type CreateCompletionFn = (params: {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  response_format: { type: string };
}) => Promise<{ choices: CompletionChoice[]; usage?: CompletionUsage }>;

import type { SubmissionScopeProfile } from "./submissionScope";

export interface RunPass3Options {
  scopeProfile?: SubmissionScopeProfile;
  pass1: SinglePassOutput;
  pass2: SinglePassOutput;
  manuscriptText: string;
  manuscriptChunks?: ManuscriptChunkEvidence[];
  title: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  registry: CanonRegistry;
  model?: string;
  openaiApiKey?: string;
  /** Override the completion function (for testing). Production callers omit this. */
  _createCompletion?: CreateCompletionFn;
  _onCompletion?: (capture: PassCompletionCapture) => void;
}

/**
 * Run Pass 3 — Synthesis & Reconciliation.
 * Receives both axis outputs and reconciles into a SynthesisOutput.
 * Throws on OpenAI error or unparseable response.
 */
export async function runPass3Synthesis(opts: RunPass3Options): Promise<SynthesisOutput> {
  if (!opts.registry || opts.registry.size === 0) {
    throw new Error("[Pass3] Canonical registry binding missing");
  }

  const createCompletion = opts._createCompletion ?? defaultCreateCompletion(opts.openaiApiKey);
  const selectedModel = getCanonicalPipelineModel(opts.model);

  const comparisonPacket = buildComparisonPacket(opts.pass1, opts.pass2, {
    manuscriptText: opts.manuscriptText,
    chunks: opts.manuscriptChunks,
  });
  const promptPacket = buildPromptPacketFromComparison(comparisonPacket);
  const comparisonPacketJson = JSON.stringify(promptPacket);
  const reducerTelemetry = {
    criteria_count_by_state: comparisonPacket.criteria_count_by_state,
  };

  const userPrompt = buildPass3UserPrompt({
    comparisonPacketJson,
    manuscriptText: opts.manuscriptText,
    title: opts.title,
    executionMode: opts.executionMode,
    scopeProfile: opts.scopeProfile,
  });
  assertPass3PromptTripwires(userPrompt);

  const pass3ReducerTelemetry = {
    schema_version: "1" as const,
    prompt_version: PASS3_PROMPT_VERSION,
    criteria_count_by_state: reducerTelemetry.criteria_count_by_state,
    chunk_count: Array.isArray(opts.manuscriptChunks) ? opts.manuscriptChunks.length : 0,
    comparison_packet_chars: comparisonPacketJson.length,
    system_prompt_chars: PASS3_SYSTEM_PROMPT.length,
    user_prompt_chars: userPrompt.length,
    max_output_tokens: getEvaluationRuntimeConfig().pass.pass3MaxTokens,
  };

  console.log("[Pass3][ReducerTelemetry]", pass3ReducerTelemetry);
  
  // Compute coverage metadata (for truth enforcement)
  const synthesisBudget = getDefaultSynthesisReferenceCharBudget();
  const coverage = summarizePromptCoverage(opts.manuscriptText, synthesisBudget);

  console.log(`[Pass3] completion request model=${selectedModel}`);

  const completion = await createCompletion({
    model: selectedModel,
    messages: [
      { role: "system", content: PASS3_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    ...buildOpenAITemperatureParam(selectedModel, PASS3_TEMPERATURE),
    ...buildOpenAIOutputTokenParam(selectedModel, getEvaluationRuntimeConfig().pass.pass3MaxTokens),
    response_format: { type: "json_object" },
  });

  const firstChoice = completion.choices?.[0] as CompletionChoice | undefined;
  const rawContent = firstChoice?.message?.content;
  const responseText = extractResponseText(rawContent);

  if (responseText.trim().length === 0) {
    const diagnosticMessage = buildEmptyResponseDiagnostic({
      model: selectedModel,
      completion,
      firstChoice,
      rawContent,
      coverage,
      comparisonPacketChars: comparisonPacketJson.length,
      promptChars: userPrompt.length,
    });

    console.error("[Pass3] Completion boundary diagnostic", {
      model: selectedModel,
      hasChoices: Array.isArray((completion as { choices?: unknown }).choices),
      choiceCount: Array.isArray((completion as { choices?: unknown[] }).choices)
        ? (completion as { choices: unknown[] }).choices.length
        : 0,
      finishReason:
        typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown",
      contentType: rawContent === null ? "null" : typeof rawContent,
      contentPreview: typeof rawContent === "string" ? rawContent.slice(0, 160) : undefined,
      usage: completion.usage,
      comparisonPacketChars: comparisonPacketJson.length,
      promptChars: userPrompt.length,
      promptCoverage: coverage,
      maxOutputTokens: getEvaluationRuntimeConfig().pass.pass3MaxTokens,
      refusal:
        typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined,
    });
    throw new Error(diagnosticMessage);
  }

  // P0: Check finish_reason — log a warning if the model stopped due to token limit
  const finishReasonWarning = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined;
  if (finishReasonWarning === "length") {
    console.warn("[Pass3] finish_reason=length — output may be truncated", {
      model: selectedModel,
      maxOutputTokens: getEvaluationRuntimeConfig().pass.pass3MaxTokens,
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
    pass: 3,
    raw_text: responseText,
    model: selectedModel,
    usage: completion.usage,
    finish_reason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined,
    request_id: requestId,
    generated_at: new Date().toISOString(),
    pass3_reducer_telemetry: pass3ReducerTelemetry,
  });

  const finishReason = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";

  let synthesis: SynthesisOutput;
  try {
    synthesis = parsePass3Response(responseText, opts.pass1, opts.pass2, selectedModel, opts.manuscriptText);

    // Normalization and required-field validation happen inside parsePass3Response
    // (parseRecommendations + parseSubmissionReadiness are fail-closed at parse boundary).

    enforcePass3QualityGuards({
      telemetry: reducerTelemetry,
      output: synthesis,
    });
  } catch (error) {
    console.error("[Pass3] Parse boundary diagnostic", {
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
  
  // Truth enforcement: attach coverage metadata proving whether evaluation was complete or partial
  return {
    ...synthesis,
    partial_evaluation: coverage.truncated,
    coverage_scope: {
      sourceChars: coverage.sourceChars,
      sourceWords: coverage.sourceWords,
      analyzedChars: coverage.analyzedChars,
      analyzedWords: coverage.analyzedWords,
      strategy: coverage.strategy,
    },
  };
}

/**
 * Build the default OpenAI completion function.
 * Separated so the constructor is only called when no DI override is provided.
 */
function defaultCreateCompletion(openaiApiKey?: string): CreateCompletionFn {
  const apiKey = openaiApiKey ?? getEvaluationRuntimeConfig().openaiApiKey;
  if (!apiKey) {
    throw new Error("[Pass3] OPENAI_API_KEY is not configured");
  }
  const timeoutMs = getEvalOpenAiTimeoutMs();
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

export function parsePass3Response(
  raw: string,
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
  fallbackModel?: string,
  manuscriptText?: string,
): SynthesisOutput {
  const resolvedFallback =
    typeof fallbackModel === "string" && fallbackModel.length > 0
      ? fallbackModel
      : getCanonicalPipelineModel(undefined);

  // P0: Log raw response preview before parse
  console.log(`[Pass3] raw response preview len=${raw.length}: ${raw.slice(0, 200)}`);

  let parsed: Record<string, unknown>;
  try {
    const boundary = parseJsonObjectBoundary<Record<string, unknown>>(raw, {
      label: "Pass3",
    });
    parsed = boundary.value;
  } catch (error) {
    if (error instanceof JsonBoundaryError) {
      throw new Error(`[Pass3] ${error.code}: ${error.message}`);
    }
    throw new Error("[Pass3] JSON_PARSE_FAILED_MALFORMED: Response is not valid JSON (malformed JSON)");
  }

  const obj = parsed;
  const rawCriteria = Array.isArray(obj["criteria"]) ? (obj["criteria"] as unknown[]) : [];

  // Build a lookup from key → pass outputs (deterministic fallback)
  const p1Map = new Map(pass1.criteria.map((c) => [c.key, c]));
  const p2Map = new Map(pass2.criteria.map((c) => [c.key, c]));

  const criteria: SynthesizedCriterion[] = [];
  for (const key of CRITERIA_KEYS) {
    const p1c = p1Map.get(key);
    const p2c = p2Map.get(key);

    // Find synthesis entry from AI
    const rawEntry = rawCriteria.find((item) => {
      if (typeof item !== "object" || item === null) return false;
      return (item as Record<string, unknown>)["key"] === key;
    }) as Record<string, unknown> | undefined;

    const craftScore = rawEntry
      ? Math.round(Number(rawEntry["craft_score"] ?? p1c?.score_0_10 ?? 5))
      : (p1c?.score_0_10 ?? 5);
    const editorialScore = rawEntry
      ? Math.round(Number(rawEntry["editorial_score"] ?? p2c?.score_0_10 ?? 5))
      : (p2c?.score_0_10 ?? 5);

    const rawFinal = rawEntry ? Number(rawEntry["final_score_0_10"]) : NaN;
    const finalScore = Number.isFinite(rawFinal)
      ? Math.min(10, Math.max(0, Math.round(rawFinal)))
      : Math.min(10, Math.max(0, Math.round((craftScore + editorialScore) / 2)));

    const delta = Math.abs(craftScore - editorialScore);

    let evidence: EvidenceAnchor[] = parseEvidenceArray(rawEntry?.["evidence"]);
    let recommendations = parseRecommendations(rawEntry?.["recommendations"], key);
    const pressurePoints = parseStringArray(rawEntry?.["pressure_points"], 3);
    const decisionPoints = parseStringArray(rawEntry?.["decision_points"], 3);
    const consequenceStatus = parseConsequenceStatus(rawEntry?.["consequence_status"], delta, finalScore);
    const deferredRiskRaw = String(rawEntry?.["deferred_consequence_risk"] ?? "").trim();

    const fallbackPressurePoint = evidence[0]?.snippet
      ? `Pressure signal observed in: "${evidence[0].snippet.substring(0, 120)}"`
      : `Pressure signal inferred for ${key} from combined craft/editorial analysis.`;

    const fallbackDecisionPoint =
      craftScore > editorialScore
        ? `Decision inflection favors craft signal for ${key}.`
        : editorialScore > craftScore
          ? `Decision inflection favors editorial signal for ${key}.`
          : `Decision inflection resolves as balanced craft/editorial synthesis for ${key}.`;

    const deferredRisk =
      consequenceStatus === "deferred"
        ? (deferredRiskRaw ||
            `Deferred consequence risk: unresolved ${key} pressure may compound and degrade downstream payoff.`)
            .substring(0, 280)
        : undefined;

    const rawRationale = String(rawEntry?.["final_rationale"] ?? "").trim();
    const baselineRationale = rawRationale || p1c?.rationale || p2c?.rationale || "";

    if (evidence.length === 0) {
      evidence = backfillEvidenceFromAxis(pass1, pass2, key);
    }

    if (recommendations.length === 0) {
      recommendations = backfillRecommendationsFromAxis(pass1, pass2, key);
    }

    const finalRationale = needsRationaleBackfill(key, baselineRationale)
      ? buildBackfilledRationale(key, p1c?.rationale, p2c?.rationale, evidence, manuscriptText)
      : baselineRationale;

    criteria.push({
      key,
      craft_score: Math.min(10, Math.max(0, craftScore)),
      editorial_score: Math.min(10, Math.max(0, editorialScore)),
      final_score_0_10: finalScore,
      score_delta: delta,
      delta_explanation:
        delta > 2 ? String(rawEntry?.["delta_explanation"] ?? "Axes diverge significantly.") : undefined,
      final_rationale: finalRationale,
      pressure_points: pressurePoints.length > 0 ? pressurePoints : [fallbackPressurePoint],
      decision_points: decisionPoints.length > 0 ? decisionPoints : [fallbackDecisionPoint],
      consequence_status: consequenceStatus,
      deferred_consequence_risk: deferredRisk,
      evidence,
      recommendations,
    });
  }

  // Build overall
  const rawOverall = typeof obj["overall"] === "object" && obj["overall"] !== null
    ? (obj["overall"] as Record<string, unknown>)
    : {};

  const avgScore = criteria.reduce((sum, c) => sum + c.final_score_0_10, 0) / criteria.length;
  const overallScore0_100 = typeof rawOverall["overall_score_0_100"] === "number"
    ? Math.min(100, Math.max(0, Math.round(rawOverall["overall_score_0_100"])))
    : Math.min(100, Math.max(0, Math.round(avgScore * 10)));

  const rawVerdict = String(rawOverall["verdict"] ?? "");
  const verdict: "pass" | "revise" | "fail" =
    rawVerdict === "pass" || rawVerdict === "fail" ? rawVerdict : "revise";

  const rawSummary = String(rawOverall["one_paragraph_summary"] ?? "").substring(0, 500);
  const summary = enforceSummaryWeaknessPresence(rawSummary, criteria);

  const strengths = Array.isArray(rawOverall["top_3_strengths"])
    ? (rawOverall["top_3_strengths"] as unknown[]).slice(0, 3).map(String)
    : [];
  const risks = Array.isArray(rawOverall["top_3_risks"])
    ? (rawOverall["top_3_risks"] as unknown[]).slice(0, 3).map(String)
    : [];

  // Build metadata
  const rawMeta = typeof obj["metadata"] === "object" && obj["metadata"] !== null
    ? (obj["metadata"] as Record<string, unknown>)
    : {};

  return {
    criteria,
    overall: {
      overall_score_0_100: overallScore0_100,
      verdict,
      one_paragraph_summary: summary,
      top_3_strengths: strengths,
      top_3_risks: risks,
      submission_readiness: parseSubmissionReadiness(rawOverall["submission_readiness"], verdict, criteria),
    },
    metadata: {
      pass1_model: String(rawMeta["pass1_model"] ?? pass1.model),
      pass2_model: String(rawMeta["pass2_model"] ?? pass2.model),
      pass3_model: String(rawMeta["pass3_model"] ?? resolvedFallback),
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false, // will be overridden by runPass3Synthesis with real value
  };
}

function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function clampRecommendationAction(action: string): string {
  const normalized = action.replace(/\s+/g, " ").trim();
  if (normalized.length <= 300) return ensureTerminalPunctuation(normalized);

  const mechanismMatch = normalized.match(/\b(because|since|so that)\b/i);
  if (!mechanismMatch || mechanismMatch.index === undefined) {
    return ensureTerminalPunctuation(
      normalized.slice(0, 300).replace(/\s+\S*$/, "").trim(),
    );
  }

  const mechanismIndex = mechanismMatch.index;
  const prefix = normalized.slice(0, mechanismIndex).trim();
  const suffix = normalized.slice(mechanismIndex).trim();

  const prefixBudget = 180;
  const suffixBudget = 119;

  const safePrefix =
    prefix.length > prefixBudget
      ? prefix.slice(0, prefixBudget).replace(/\s+\S*$/, "").trim()
      : prefix;

  const safeSuffix =
    suffix.length > suffixBudget
      ? suffix.slice(0, suffixBudget).replace(/\s+\S*$/, "").trim()
      : suffix;

  const clamped = `${safePrefix} ${safeSuffix}`.trim();
  return ensureTerminalPunctuation(
    clamped.length <= 300
      ? clamped
      : clamped.slice(0, 300).replace(/\s+\S*$/, "").trim(),
  );
}

function parseEvidenceArray(raw: unknown): EvidenceAnchor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
    .map((e) => ({
      snippet: String(e["snippet"] ?? "").substring(0, 200),
      char_start: typeof e["char_start"] === "number" ? e["char_start"] : undefined,
      char_end: typeof e["char_end"] === "number" ? e["char_end"] : undefined,
    }));
}

function parseRecommendations(
  raw: unknown,
  criterionKey: SynthesizedCriterion["key"],
): SynthesizedCriterion["recommendations"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => {
      const priority = String(r["priority"] ?? "medium");
      const sourcePass = Number(r["source_pass"] ?? 3);
      const parsed = {
        priority: (priority === "high" || priority === "low" ? priority : "medium") as "high" | "medium" | "low",
        action: String(r["action"] ?? "").trim(),
        expected_impact: String(r["expected_impact"] ?? "").trim(),
        anchor_snippet: String(r["anchor_snippet"] ?? "").trim(),
        source_pass: (sourcePass === 1 || sourcePass === 2 ? sourcePass : 3) as 1 | 2 | 3,
        issue_family: (() => {
          if (!("issue_family" in r) || r["issue_family"] === undefined || r["issue_family"] === null) {
            throw new Error("[Pass3] recommendation is missing required field: issue_family");
          }
          return (normalizeIssueFamily(r["issue_family"]) ?? r["issue_family"]) as SynthesizedCriterion["recommendations"][number]["issue_family"];
        })(),
        strategic_lever:
          (normalizeStrategicLever(r["strategic_lever"]) ?? r["strategic_lever"] ?? "scene_goal_clarity") as SynthesizedCriterion["recommendations"][number]["strategic_lever"],
        revision_granularity:
          (normalizeRevisionGranularity(r["revision_granularity"]) ?? r["revision_granularity"] ?? "scene") as SynthesizedCriterion["recommendations"][number]["revision_granularity"],
        // Structured editorial specificity triple — parsed from LLM output; normalized/repaired below
        mechanism: String(r["mechanism"] ?? "").trim(),
        specific_fix: String(r["specific_fix"] ?? "").trim(),
        reader_effect: String(r["reader_effect"] ?? "").trim(),
      };

      const normalized = normalizeRecommendationContract(parsed, criterionKey);
      const initialIntegrity = checkSurfaceIntegrity(normalized.action);

      let actionForOutput = normalized.action;
      let integrity = initialIntegrity;

      if (integrity.status === "REJECT") {
        const repairedAction = repairSurfaceIntegrity(actionForOutput, integrity.reasons);
        if (repairedAction) {
          const repairedIntegrity = checkSurfaceIntegrity(repairedAction);
          if (repairedIntegrity.status !== "REJECT") {
            actionForOutput = repairedAction;
            integrity = repairedIntegrity;
          }
        }
      }

      if (integrity.status === "REJECT") {
        return null;
      }

      const flaggedExpectedImpact =
        integrity.status === "FLAG"
          ? annotateSurfaceIntegrityFlag(normalized.expected_impact, integrity.reasons)
          : normalized.expected_impact;

      return {
        ...normalized,
        action: clampRecommendationAction(actionForOutput),
        expected_impact: flaggedExpectedImpact,
      };
    })
    .filter(
      (
        recommendation,
      ): recommendation is SynthesizedCriterion["recommendations"][number] => recommendation !== null,
    );
}

function normalizeRecommendationContract(
  recommendation: SynthesizedCriterion["recommendations"][number],
  criterionKey: SynthesizedCriterion["key"],
): SynthesizedCriterion["recommendations"][number] {
  const action = recommendation.action.trim();
  const expectedImpact = recommendation.expected_impact.trim();
  const anchorSnippet = recommendation.anchor_snippet.trim();

  const hasAnchorContext = anchorSnippet.length > 0 || EDITORIAL_CONTEXT_MARKERS.test(action);
  const hasSpecificFixMove = EDITORIAL_FIX_MARKERS.test(action) && hasAnchorContext;
  const hasMechanismCause = EDITORIAL_MECHANISM_MARKERS.test(action) || EDITORIAL_MECHANISM_MARKERS.test(expectedImpact);
  const hasReaderEffect = EDITORIAL_READER_EFFECT_MARKERS.test(expectedImpact);

  // hasAnchor controls whether static criterion-aware defaults are permitted as
  // last-resort fallbacks. For anchorless recs, the triple is resolved from local
  // evidence only (extraction from action/expected_impact). If extraction also
  // fails, the fields remain "": the recommendation stays generic and
  // QG_EDITORIAL_GENERIC_FEEDBACK can fire on true generic content — not bypassed
  // by static defaults.
  const hasAnchor = anchorSnippet.length > 0;
  const mechanism = resolveMechanism(recommendation.mechanism, action, expectedImpact, hasAnchor, criterionKey);
  const specificFix = resolveSpecificFix(recommendation.specific_fix, action, hasAnchor, criterionKey);
  const readerEffect = resolveReaderEffect(recommendation.reader_effect, expectedImpact, hasAnchor, criterionKey);

  const finalize = (
    normalizedAction: string,
    normalizedImpact: string,
    normalizedAnchor: string,
  ): SynthesizedCriterion["recommendations"][number] => ({
    ...recommendation,
    action: clampRecommendationAction(normalizedAction),
    expected_impact: normalizedImpact,
    anchor_snippet: normalizedAnchor,
    mechanism,
    specific_fix: specificFix,
    reader_effect: readerEffect,
  });

  if (hasSpecificFixMove && hasMechanismCause && hasReaderEffect) {
    return finalize(action, expectedImpact, anchorSnippet);
  }

  // For anchorless recs: do NOT repair action/expected_impact — no manuscript context
  // to anchor a repair. The triple fields are also not backfilled with static defaults
  // (handled above by hasAnchor=false). Gate sees the genuine generic content.
  if (anchorSnippet.length === 0) {
    return finalize(action, expectedImpact, anchorSnippet);
  }

  const intentFragment = extractIntentFragment(action);
  const repairedAction = buildCriterionAwareActionRepair(criterionKey, anchorSnippet, intentFragment);
  const repairedImpact = hasReaderEffect
    ? expectedImpact
    : buildCriterionAwareImpactRepair(criterionKey);

  return finalize(repairedAction, repairedImpact, anchorSnippet);
}

/**
 * Resolve the mechanism field: use explicit LLM value if non-empty; otherwise
 * extract from action/expected_impact text (evidence-derived); otherwise return ""
 * if the recommendation is anchorless so the gate can fire on true generic content.
 * Static criterion-aware defaults are intentionally NOT applied for anchorless recs.
 */
function resolveMechanism(
  explicit: string,
  action: string,
  expectedImpact: string,
  hasAnchor: boolean,
  criterionKey: SynthesizedCriterion["key"],
): string {
  if (explicit.length > 0) return explicit;
  // Try to extract after a causal connector in action or expected_impact (evidence-derived)
  const mechanismMatch =
    action.match(/\b(?:because|since|so\s+that)\b(.{10,150})/i) ??
    expectedImpact.match(/\b(?:because|since|so\s+that)\b(.{10,150})/i);
  if (mechanismMatch) return mechanismMatch[1].replace(/\.$/, "").trim();
  // Only apply static criterion-aware default when anchor exists; for anchorless recs
  // leave empty so QG_EDITORIAL_GENERIC_FEEDBACK can fire on true generic content.
  if (!hasAnchor) return "";
  return buildCriterionAwareMechanismDefault(criterionKey);
}

/**
 * Resolve the specific_fix field: use explicit LLM value if non-empty; otherwise
 * extract from action text (evidence-derived); otherwise return "" if anchorless.
 * Static criterion-aware defaults are intentionally NOT applied for anchorless recs.
 */
function resolveSpecificFix(
  explicit: string,
  action: string,
  hasAnchor: boolean,
  criterionKey: SynthesizedCriterion["key"],
): string {
  if (explicit.length > 0) return explicit;
  // Build extraction regex from the canonical EDITORIAL_FIX_MARKERS source to avoid duplication
  const fixExtractor = new RegExp(EDITORIAL_FIX_MARKERS.source + ".{0,120}", "i");
  const fixMatch = action.match(fixExtractor);
  if (fixMatch) return fixMatch[0].replace(/\s+because.*$/i, "").replace(/\s+since.*$/i, "").trim().slice(0, 120);
  // Only apply static criterion-aware default when anchor exists; for anchorless recs
  // leave empty so QG_EDITORIAL_GENERIC_FEEDBACK can fire on true generic content.
  if (!hasAnchor) return "";
  return buildCriterionAwareSpecificFixDefault(criterionKey);
}

/**
 * Resolve the reader_effect field: use explicit LLM value if non-empty; otherwise
 * extract from expected_impact text (evidence-derived); otherwise return "" if anchorless.
 * Static criterion-aware defaults are intentionally NOT applied for anchorless recs.
 */
function resolveReaderEffect(
  explicit: string,
  expectedImpact: string,
  hasAnchor: boolean,
  criterionKey: SynthesizedCriterion["key"],
): string {
  if (explicit.length > 0) return explicit;
  if (EDITORIAL_READER_EFFECT_MARKERS.test(expectedImpact)) {
    return expectedImpact.slice(0, 150);
  }
  // Only apply static criterion-aware default when anchor exists; for anchorless recs
  // leave empty so QG_EDITORIAL_GENERIC_FEEDBACK can fire on true generic content.
  if (!hasAnchor) return "";
  return buildCriterionAwareReaderEffectDefault(criterionKey);
}

function buildCriterionAwareMechanismDefault(criterionKey: SynthesizedCriterion["key"]): string {
  switch (criterionKey) {
    case "character":
      return "the abstract phrasing diffuses motivation before the decision point, weakening character agency";
    case "sceneConstruction":
      return "the causal sequencing is inverted, so the consequence lands before the trigger, losing scene-turn coherence";
    case "dialogue":
      return "the attribution gap causes speaker intent to blur, reducing tension in the exchange";
    case "pacing":
      return "the reflective passage stalls forward momentum before the narrative urgency peaks";
    case "voice":
      return "the psychic distance collapses inconsistently, breaking the established POV rendering contract";
    case "theme":
      return "the thematic signal is stated abstractly rather than embodied in concrete action, reducing resonance";
    case "narrativeDrive":
      return "the stakes signal arrives too late in the passage, diffusing narrative urgency at the turn";
    case "worldbuilding":
      return "the sensory grounding is absent, preventing the reader from anchoring in the setting";
    case "tone":
      return "the tonal register shifts mid-passage without a clear trigger, disrupting emotional continuity";
    case "marketability":
      return "the hook does not establish genre expectations early enough, reducing submission alignment";
    default:
      return "the current phrasing diffuses the criterion signal before the decision point";
  }
}

function buildCriterionAwareSpecificFixDefault(criterionKey: SynthesizedCriterion["key"]): string {
  switch (criterionKey) {
    case "character":
      return "replace one abstract reaction line with a concrete decision beat and one desire-vs-fear contradiction";
    case "sceneConstruction":
      return "split one long descriptive passage and move one image after the causal action beat";
    case "dialogue":
      return "replace one expository exchange with two short turns plus an interruption beat";
    case "pacing":
      return "cut one reflective sentence and insert one immediate external action trigger";
    case "voice":
      return "recast one summary sentence as close-third free indirect discourse to restore psychic distance";
    case "theme":
      return "replace one abstract thematic statement with a concrete image or action that embodies the theme";
    case "narrativeDrive":
      return "insert one concrete stakes beat that lands the deferred decision at the current scene turn";
    case "worldbuilding":
      return "anchor one passage with two specific sensory details that ground the setting without exposition";
    case "tone":
      return "rewrite one tonal outlier sentence to match the established register of the surrounding passage";
    case "marketability":
      return "move one genre-signaling detail to the first paragraph to establish category expectations earlier";
    default:
      return "replace one abstract sentence with a concrete criterion-specific move and insert one causal beat";
  }
}

function buildCriterionAwareReaderEffectDefault(criterionKey: SynthesizedCriterion["key"]): string {
  switch (criterionKey) {
    case "character":
      return "clearer motivation and emotional stakes, improving trust in character decisions";
    case "sceneConstruction":
      return "clearer scene cause-and-effect and stronger transition coherence";
    case "dialogue":
      return "clearer speaker intent and tension progression, increasing engagement";
    case "pacing":
      return "stronger forward momentum and cleaner urgency through the section turn";
    case "voice":
      return "consistent narrative immersion with stable psychic distance throughout the passage";
    case "theme":
      return "stronger thematic resonance and payoff at the scene turn";
    case "narrativeDrive":
      return "increased momentum as the stalled decision converts to visible consequence";
    case "worldbuilding":
      return "immediate sensory grounding, reducing cognitive load and increasing immersion";
    case "tone":
      return "consistent emotional register that sustains reader trust through the passage";
    case "marketability":
      return "clearer genre alignment and stronger first-impression hook for submission readers";
    default:
      return "clearer cause-and-effect, stronger immersion, and higher engagement at the turn";
  }
}

function extractIntentFragment(action: string): string {
  const normalized = action.replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const withoutLeadIn = normalized
    .replace(/^in\s+[^,]+,\s*/i, "")
    .replace(/^for\s+[^,]+,\s*/i, "")
    .replace(/[.;:!?]+$/g, "")
    .trim();

  return withoutLeadIn.slice(0, 120);
}

function normalizeIntentForActionTail(intentFragment: string): string {
  const compact = intentFragment.replace(/\s+/g, " ").trim().replace(/[.;:!?]+$/, "");
  if (!compact) return "";

  const lowered = `${compact.charAt(0).toLowerCase()}${compact.slice(1)}`;
  const withoutLeadingConjunction = lowered.replace(/^(and|or)\s+/i, "");
  const withoutTrailingDanglers = withoutLeadingConjunction
    .replace(/\s+(and|or|to|of|in|on|with|for|where|a|an|the)$/i, "")
    .trim();

  if (!withoutTrailingDanglers) return "";

  return withoutTrailingDanglers.length <= 90
    ? withoutTrailingDanglers
    : withoutTrailingDanglers.slice(0, 90).replace(/\s+\S*$/, "").trim();
}

type RecommendationFamily =
  | "observational"
  | "surgical"
  | "contrastive"
  | "pressure"
  | "reader_effect"
  | "structural"
  | "opportunity"
  | "scene_level"
  | "cadence";

const CRITERION_PREFERRED_FAMILIES: Record<
  SynthesizedCriterion["key"],
  readonly RecommendationFamily[]
> = {
  concept: ["observational", "opportunity", "reader_effect"],
  narrativeDrive: ["pressure", "structural", "scene_level"],
  character: ["contrastive", "pressure", "observational"],
  voice: ["cadence", "observational", "surgical"],
  sceneConstruction: ["structural", "scene_level", "contrastive"],
  dialogue: ["pressure", "contrastive", "scene_level"],
  theme: ["observational", "opportunity", "reader_effect"],
  worldbuilding: ["scene_level", "observational", "reader_effect"],
  pacing: ["structural", "pressure", "scene_level"],
  proseControl: ["cadence", "surgical", "observational"],
  tone: ["cadence", "observational", "contrastive"],
  narrativeClosure: ["reader_effect", "structural", "opportunity"],
  marketability: ["opportunity", "reader_effect", "contrastive"],
};

function deterministicHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function summarizeAnchorContext(anchorSnippet: string): string {
  const normalized = anchorSnippet
    .replace(/\s+/g, " ")
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim();
  if (!normalized) return "the current passage";

  const shortened = normalized.length > 64
    ? normalized.slice(0, 64).replace(/\s+\S*$/, "").trim()
    : normalized;
  const lowered = `${shortened.charAt(0).toLowerCase()}${shortened.slice(1)}`;
  return lowered || "the current passage";
}

function capitalizeSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

type ActionTemplateParams = {
  context: string;
  intentTail: string;
};

function enforceEditorialActionContract(
  action: string,
  criterionKey: SynthesizedCriterion["key"],
): string {
  const normalized = action.replace(/\s+/g, " ").trim().replace(/[.;:!?]+$/, "");
  if (!normalized) return normalized;

  const hasSpecificFixMove = EDITORIAL_FIX_MARKERS.test(normalized);
  const hasMechanismCause = EDITORIAL_MECHANISM_MARKERS.test(normalized);

  let repaired = normalized;

  if (!hasSpecificFixMove) {
    const fixLead = buildCriterionAwareSpecificFixDefault(criterionKey).replace(/[.;:!?]+$/, "");
    repaired = `${fixLead}; ${repaired}`;
  }

  if (!hasMechanismCause) {
    const mechanism = buildCriterionAwareMechanismDefault(criterionKey).replace(/[.;:!?]+$/, "");
    const withoutDanglingConnector = repaired
      .replace(/[,:;]?\s+(let|can|to|and|or)$/i, "")
      .trim();
    repaired = `${withoutDanglingConnector} because ${mechanism}`;
  }

  return repaired;
}

const ACTION_TEMPLATES_BY_FAMILY: Record<RecommendationFamily, readonly ((params: ActionTemplateParams) => string)[]> = {
  observational: [
    ({ context, intentTail }) =>
      `The current draft surfaces pressure in ${context}, but the consequence arrives abstractly. A concrete causal beat would ${intentTail}.`,
    ({ context, intentTail }) =>
      `Several lines around ${context} summarize effect before dramatizing cause. Re-ordering the beat sequence would ${intentTail}.`,
  ],
  surgical: [
    ({ context, intentTail }) =>
      `Revise one line in ${context} to replace abstraction with a concrete sensory-action choice, then keep the next beat causal so the passage can ${intentTail}.`,
    ({ context, intentTail }) =>
      `Tighten the sentence-level execution in ${context}: swap one vague phrase for a specific action image and trim the trailing summary to ${intentTail}.`,
  ],
  contrastive: [
    ({ context, intentTail }) =>
      `Rather than explaining the pressure in ${context}, let one interruption or decision beat carry it on the page so the scene can ${intentTail}.`,
    ({ context, intentTail }) =>
      `Instead of resolving the moment in exposition at ${context}, pivot to a visible reaction-then-consequence turn to ${intentTail}.`,
  ],
  pressure: [
    ({ context, intentTail }) =>
      `Tension softens around ${context} because the decision pressure diffuses too early. Keep the external trigger active for one more beat to ${intentTail}.`,
    ({ context, intentTail }) =>
      `The pressure line in ${context} resolves before the reader sees immediate consequence. Hold the conflict open through a short action beat to ${intentTail}.`,
  ],
  reader_effect: [
    ({ context, intentTail }) =>
      `Readers will track stakes more clearly if ${context} lands on a concrete consequence rather than thematic summary; this would ${intentTail}.`,
    ({ context, intentTail }) =>
      `To strengthen reader trust, let ${context} conclude with visible payoff instead of abstraction; the result should ${intentTail}.`,
  ],
  structural: [
    ({ context, intentTail }) =>
      `Scene momentum drops near ${context} when reflection resolves before action. Re-sequencing the turn as trigger → reaction → consequence would ${intentTail}.`,
    ({ context, intentTail }) =>
      `The structural turn at ${context} is close, but the causal order is inverted. Move the trigger ahead of reflection so the section can ${intentTail}.`,
  ],
  opportunity: [
    ({ context, intentTail }) =>
      `The material in ${context} has stronger upside than the current phrasing shows. Framing the beat as a specific reader-facing promise could ${intentTail}.`,
    ({ context, intentTail }) =>
      `There is a clear editorial opportunity in ${context}: convert the abstract claim into a concrete outcome cue to ${intentTail}.`,
  ],
  scene_level: [
    ({ context, intentTail }) =>
      `At the scene level, ${context} would benefit from one immediate external action cue before returning to reflection, helping the passage ${intentTail}.`,
    ({ context, intentTail }) =>
      `Within ${context}, add a short action-response beat pair so scene movement stays visible and can ${intentTail}.`,
  ],
  cadence: [
    ({ context, intentTail }) =>
      `Cadence flattens in ${context} when long abstract phrasing stacks without tactile detail. Varying sentence rhythm with one concrete beat would ${intentTail}.`,
    ({ context, intentTail }) =>
      `The prose rhythm around ${context} is close to landing; a shorter concrete sentence after the reflective line would ${intentTail}.`,
  ],
};

function buildCriterionAwareActionRepair(
  criterionKey: SynthesizedCriterion["key"],
  anchorSnippet: string,
  intentFragment: string,
): string {
  const anchor = anchorSnippet.slice(0, 72);
  const context = summarizeAnchorContext(anchor);
  const normalizedIntent = normalizeIntentForActionTail(intentFragment);
  const intentTail = normalizedIntent.length > 0
    ? normalizedIntent
    : "increase scene-level clarity and consequence";

  const preferredFamilies = CRITERION_PREFERRED_FAMILIES[criterionKey] ?? ["observational"];
  const familySeed = deterministicHash(`${criterionKey}|${anchor}|${intentTail}`);
  const family = preferredFamilies[familySeed % preferredFamilies.length];
  const familyTemplates = ACTION_TEMPLATES_BY_FAMILY[family] ?? ACTION_TEMPLATES_BY_FAMILY.observational;
  const template = familyTemplates[familySeed % familyTemplates.length];
  const rawAction = template({
    context,
    intentTail,
  });

  return ensureTerminalPunctuation(
    capitalizeSentence(enforceEditorialActionContract(rawAction, criterionKey)),
  );
}

function buildCriterionAwareImpactRepair(
  criterionKey: SynthesizedCriterion["key"],
): string {
  switch (criterionKey) {
    case "character":
      return "Gives the reader clearer motivation and emotional stakes, improving trust in character decisions.";
    case "sceneConstruction":
      return "Gives the reader clearer scene cause-and-effect and stronger transition coherence.";
    case "dialogue":
      return "Gives the reader clearer speaker intent and tension progression, increasing engagement.";
    case "pacing":
      return "Gives the reader stronger forward momentum and cleaner urgency through the section turn.";
    default:
      return "Gives the reader clearer cause-and-effect, stronger immersion, and higher engagement at the turn.";
  }
}

function normalizeForPhraseMatch(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasVoiceMechanismMarker(text: string): boolean {
  const normalized = normalizeForPhraseMatch(text);
  return PASS3_VOICE_MECHANISM_MARKERS.some((marker) => normalized.includes(marker));
}

function hasDialogueMechanismMarker(text: string): boolean {
  const normalized = normalizeForPhraseMatch(text);
  return DIALOGUE_MECHANISM_MARKERS.some((marker) => normalized.includes(marker));
}

function needsRationaleBackfill(key: string, rationale: string): boolean {
  const normalized = normalizeForPhraseMatch(rationale);
  if (normalized.length < PASS3_MIN_RATIONALE_LENGTH) {
    return true;
  }

  if (PASS3_PLACEHOLDER_RATIONALE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  // Deterministic guard: voice rationale must carry explicit POV/rendering
  // mechanism language before entering Pass 4 gate.
  if (key === "voice" && !hasVoiceMechanismMarker(normalized)) {
    return true;
  }

  // Deterministic guard: dialogue rationale must carry explicit attribution/
  // rendering mechanism language before entering Pass 4 gate.
  if (key === "dialogue" && !hasDialogueMechanismMarker(normalized)) {
    return true;
  }

  return false;
}

function buildBackfilledRationale(
  key: string,
  pass1Rationale: string | undefined,
  pass2Rationale: string | undefined,
  evidence: EvidenceAnchor[],
  manuscriptText?: string,
): string {
  const p1 = (pass1Rationale || "").trim();
  const p2 = (pass2Rationale || "").trim();
  const evidenceLead = evidence[0]?.snippet?.trim();

  const p1Summary = p1.length > 0 ? p1 : `Pass 1 identifies craft execution pressure in ${key}.`;
  const p2Summary = p2.length > 0 ? p2 : `Pass 2 identifies editorial and interpretive pressure in ${key}.`;
  const anchor = evidenceLead
    ? `The manuscript evidence "${evidenceLead.substring(0, 120)}" supports this synthesis.`
    : `Available manuscript signals support this synthesis for ${key}.`;

  const base = `${p1Summary} ${p2Summary} ${anchor}`.trim();
  const normalized = normalizeForPhraseMatch(base);

  // For dialogue: use diagnostic-aware backfill if manuscript available
  if (key === "dialogue" && !hasDialogueMechanismMarker(normalized)) {
    // Try to compute diagnostics to produce specific rationale
    if (manuscriptText && manuscriptText.trim().length > 0) {
      try {
        const diagnostics = analyzeDialogueAttributionForGate({ manuscriptText });
        
        // Generate diagnostic-grounded rationale
        const parts: string[] = [base];
        
        if (diagnostics.renderingModesDetected.length > 0) {
          parts.push(
            `Dialogue employs ${diagnostics.renderingModesDetected.join(" and ")} rendering modes, with explicit mechanism language anchoring speaker clarity.`
          );
        } else if (diagnostics.speakerAttributionStrategy.length > 0) {
          parts.push(
            `Speaker attribution is achieved through ${diagnostics.speakerAttributionStrategy.join(" and ")}, supporting clear dialogue flow.`
          );
        } else if (diagnostics.actionBeatCount > 0 || diagnostics.explicitTagCount > 0) {
          parts.push(
            `Dialogue attribution relies on mechanical mechanisms: ${diagnostics.explicitTagCount > 0 ? "explicit tags" : ""} ${diagnostics.actionBeatCount > 0 ? "action beats" : ""}, supporting reader comprehension.`.replace(/\s+/g, " "),
          );
        } else {
          parts.push(
            `Dialogue is rendered through speaker attribution structure: ${diagnostics.turnTakingClarity} turn-taking with ${diagnostics.speakerAmbiguityRisk} ambiguity risk.`
          );
        }
        
        return parts.join(" ").trim();
      } catch (_err) {
        // Fall back to generic if diagnostic computation fails
      }
    }
    
    // Fallback when no manuscript or diagnostic computation fails
    return `${base} Dialogue is rendered through explicit speaker attribution mechanics (speaker identification, attribution tags/beats, and quote-level turn-taking clarity).`.trim();
  }

  // For voice: use existing generic fallback (can be enhanced similarly)
  if (key === "voice" && !hasVoiceMechanismMarker(normalized)) {
    return `${base} Voice handling is anchored in explicit POV mechanics (perspective control, narrative/psychic distance, and rendering choices at the sentence level).`.trim();
  }

  return base;
}

function backfillEvidenceFromAxis(
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
  key: string,
): EvidenceAnchor[] {
  const p1Evidence = pass1.criteria.find((c) => c.key === key)?.evidence ?? [];
  const p2Evidence = pass2.criteria.find((c) => c.key === key)?.evidence ?? [];
  const combined = [...p1Evidence, ...p2Evidence]
    .map((e) => ({
      snippet: String(e.snippet ?? "").trim().substring(0, 200),
      char_start: typeof e.char_start === "number" ? e.char_start : undefined,
      char_end: typeof e.char_end === "number" ? e.char_end : undefined,
      segment_id: typeof e.segment_id === "string" ? e.segment_id : undefined,
    }))
    .filter((e) => e.snippet.length > 0);

  const seen = new Set<string>();
  const deduped: EvidenceAnchor[] = [];
  for (const e of combined) {
    const sig = e.snippet.toLowerCase();
    if (seen.has(sig)) continue;
    seen.add(sig);
    deduped.push(e);
    if (deduped.length >= 3) break;
  }

  return deduped;
}

function backfillRecommendationsFromAxis(
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
  key: string,
): SynthesizedCriterion["recommendations"] {
  const criterionKey = key as SynthesizedCriterion["key"];
  const fromPass = (pass: SinglePassOutput, sourcePass: 1 | 2): SynthesizedCriterion["recommendations"] => {
    const passCriterion = pass.criteria.find((c) => c.key === key);
    if (!passCriterion) return [];
    return passCriterion.recommendations
      .map((r) => {
        const base = {
          priority: r.priority,
          action: String(r.action ?? "").trim(),
          expected_impact: String(r.expected_impact ?? "").trim(),
          anchor_snippet: String(r.anchor_snippet ?? "").trim(),
          source_pass: sourcePass,
          issue_family: r.issue_family,
          strategic_lever: r.strategic_lever,
          revision_granularity: r.revision_granularity,
          mechanism: "",
          specific_fix: "",
          reader_effect: "",
        };
        // Run through normalizer so the specificity triple is populated/repaired
        return normalizeRecommendationContract(base, criterionKey);
      })
      .filter((r) => r.action.length > 0 && r.expected_impact.length > 0 && r.anchor_snippet.length > 0);
  };

  const combined = [...fromPass(pass1, 1), ...fromPass(pass2, 2)];
  const seen = new Set<string>();
  const deduped: SynthesizedCriterion["recommendations"] = [];

  for (const rec of combined) {
    const sig = rec.action.toLowerCase();
    if (seen.has(sig)) continue;
    seen.add(sig);
    deduped.push(rec);
    if (deduped.length >= 3) break;
  }

  return deduped;
}

function parseStringArray(raw: unknown, maxItems: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => String(entry ?? "").trim())
    .filter((entry) => entry.length > 0)
    .slice(0, maxItems);
}

function parseConsequenceStatus(
  raw: unknown,
  scoreDelta: number,
  finalScore: number,
): SynthesizedCriterion["consequence_status"] {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "landed" || normalized === "deferred" || normalized === "dissipated") {
    return normalized;
  }

  if (scoreDelta >= 3) return "deferred";
  if (finalScore <= 4) return "dissipated";
  return "landed";
}

function parseSubmissionReadiness(
  raw: unknown,
  verdict: SynthesisOutput["overall"]["verdict"],
  criteria: SynthesizedCriterion[],
): SynthesisOutput["overall"]["submission_readiness"] {
  if (raw === undefined || raw === null) {
    throw new Error("[Pass3] overall.submission_readiness is required but was missing from model output");
  }
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === "queryable_now" || normalized === "close" || normalized === "not_yet") {
    return normalized;
  }

  const lowScoreCount = criteria.filter((criterion) => criterion.final_score_0_10 < 5).length;
  if (verdict === "fail" || lowScoreCount >= 3) {
    return "not_yet";
  }

  if (verdict === "pass") {
    return "queryable_now";
  }

  return "close";
}

function getBottomScoreCriteriaKeys(criteria: SynthesizedCriterion[]): string[] {
  const scored = criteria
    .filter((criterion) => Number.isFinite(criterion.final_score_0_10))
    .map((criterion) => ({
      key: criterion.key,
      score: criterion.final_score_0_10,
    }));

  if (scored.length === 0) {
    return [];
  }

  const minScore = Math.min(...scored.map((criterion) => criterion.score));
  const threshold = Math.min(5, minScore + 1);

  return scored
    .filter((criterion) => criterion.score <= threshold)
    .map((criterion) => criterion.key);
}

function criterionKeyToReadableToken(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();
}

function summaryMentionsCriteria(summary: string, criteriaKeys: string[]): boolean {
  const normalizedSummary = summary.toLowerCase();
  return criteriaKeys.some((key) =>
    normalizedSummary.includes(criterionKeyToReadableToken(key)),
  );
}

function enforceSummaryWeaknessPresence(
  summary: string,
  criteria: SynthesizedCriterion[],
): string {
  const trimmedSummary = summary.trim();
  const bottomScoreCriteria = getBottomScoreCriteriaKeys(criteria);

  if (trimmedSummary.length === 0 || bottomScoreCriteria.length === 0) {
    return trimmedSummary;
  }

  if (summaryMentionsCriteria(trimmedSummary, bottomScoreCriteria)) {
    return trimmedSummary;
  }

  const weaknessTokens = bottomScoreCriteria
    .slice(0, 3)
    .map((key) => criterionKeyToReadableToken(key));
  const weaknessClause = `Key revision pressure remains in ${weaknessTokens.join(", ")}.`;
  const punctuatedSummary = /[.!?]$/.test(trimmedSummary)
    ? trimmedSummary
    : `${trimmedSummary}.`;

  return `${punctuatedSummary} ${weaknessClause}`.substring(0, 500);
}
