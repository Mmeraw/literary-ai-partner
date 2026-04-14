/**
 * Phase 2.7 — Pass 1: Craft Execution Runner
 *
 * Calls OpenAI with the craft execution prompt and parses the response
 * into a validated SinglePassOutput.
 *
 * Temperature: 0.3 (per Vol III Tools §PASS1)
 * Max tokens: 4000
 */

import OpenAI from "openai";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS1_SYSTEM_PROMPT, PASS1_PROMPT_VERSION, buildPass1UserPrompt } from "./prompts/pass1-craft";
import type { SinglePassOutput, AxisCriterionResult, EvidenceAnchor, CompletionUsage, PassCompletionCapture } from "./types";
import type { CanonRegistry } from "@/lib/governance/canonRegistry";
import {
  buildOpenAIOutputTokenParam,
  buildOpenAITemperatureParam,
  getCanonicalPipelineModel,
} from "@/lib/evaluation/policy";
import { getEvalOpenAiTimeoutMs } from "@/lib/evaluation/config";
import { parseJsonObjectBoundary, JsonBoundaryError } from "@/lib/llm/jsonParseBoundary";
import { buildJsonBoundaryEvidence } from "@/lib/llm/jsonBoundaryTelemetry";
import { persistPassEvidence } from "@/lib/llm/persistPassEvidence";

const PASS1_TEMPERATURE = 0.3;
const PASS1_MAX_TOKENS = 4000;
const PASS1_MODEL = "o3";
const OPENAI_TIMEOUT_MS = getEvalOpenAiTimeoutMs();

type CompletionChoice = {
  message?: {
    content?: unknown;
    refusal?: unknown;
  };
  finish_reason?: unknown;
};

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
}): string {
  const { model, completion, firstChoice, rawContent } = params;
  const usage = completion.usage;
  const finishReason =
    typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";
  const contentType =
    rawContent === null ? "null" : Array.isArray(rawContent) ? "array" : typeof rawContent;
  const refusal =
    typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined;
  const choiceCount = Array.isArray(completion.choices) ? completion.choices.length : 0;

  return (
    `[Pass1] Empty response from OpenAI ` +
    `(model=${model} finish_reason=${finishReason} content_type=${contentType} choices=${choiceCount} ` +
    `max_output_tokens=${PASS1_MAX_TOKENS}` +
    `${typeof usage?.prompt_tokens === "number" ? ` prompt_tokens=${usage.prompt_tokens}` : ""}` +
    `${typeof usage?.completion_tokens === "number" ? ` completion_tokens=${usage.completion_tokens}` : ""}` +
    `${typeof usage?.total_tokens === "number" ? ` total_tokens=${usage.total_tokens}` : ""}` +
    `${refusal ? ` refusal=${JSON.stringify(refusal).slice(0, 120)}` : ""})`
  );
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

export interface RunPass1Options {
  manuscriptText: string;
  workType: string;
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
 * Run Pass 1 — Craft Execution analysis.
 * Returns a validated SinglePassOutput with axis="craft_execution".
 * Throws on OpenAI error or unparseable response.
 */
export async function runPass1(opts: RunPass1Options): Promise<SinglePassOutput> {
  if (!opts.registry || opts.registry.size === 0) {
    throw new Error("[Pass1] Canonical registry binding missing");
  }

  const createCompletion = opts._createCompletion ?? defaultCreateCompletion(opts.openaiApiKey);
  const selectedModel = getCanonicalPipelineModel(opts.model ?? PASS1_MODEL);

  const userPrompt = buildPass1UserPrompt({
    manuscriptText: opts.manuscriptText,
    workType: opts.workType,
    title: opts.title,
    executionMode: opts.executionMode,
  });

  console.log(`[Pass1] completion request model=${selectedModel}`);

  const completion = await createCompletion({
    model: selectedModel,
    messages: [
      { role: "system", content: PASS1_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    ...buildOpenAITemperatureParam(selectedModel, PASS1_TEMPERATURE),
    ...buildOpenAIOutputTokenParam(selectedModel, PASS1_MAX_TOKENS),
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
      maxOutputTokens: PASS1_MAX_TOKENS,
      refusal:
        typeof firstChoice?.message?.refusal === "string" ? firstChoice.message.refusal : undefined,
    });
    throw new Error(diagnosticMessage);
  }

  // P0: Check finish_reason — log a warning if the model stopped due to token limit
  const finishReason = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined;
  if (finishReason === "length") {
    console.warn("[Pass1] finish_reason=length — output may be truncated", {
      model: selectedModel,
      maxOutputTokens: PASS1_MAX_TOKENS,
      responseLen: responseText.length,
      usage: completion.usage,
    });
  }

  opts._onCompletion?.({
    pass: 1,
    raw_text: responseText,
    model: selectedModel,
    usage: completion.usage,
    generated_at: new Date().toISOString(),
  });

  return parsePass1Response(responseText, selectedModel);
}

/**
 * Build the default OpenAI completion function.
 * Separated so the constructor is only called when no DI override is provided.
 */
function defaultCreateCompletion(openaiApiKey?: string): CreateCompletionFn {
  const apiKey = openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("[Pass1] OPENAI_API_KEY is not configured");
  }
  const openai = new OpenAI({ apiKey, maxRetries: 0, timeout: OPENAI_TIMEOUT_MS });
  return (params) =>
    openai.chat.completions.create(
      params as Parameters<typeof openai.chat.completions.create>[0],
      { timeout: OPENAI_TIMEOUT_MS },
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
 * @throws JsonBoundaryError on parse failures
 */
export function parsePass1Response(raw: string, fallbackModel = PASS1_MODEL): SinglePassOutput {
  return finalizePass1FromResponse(raw, fallbackModel);
}

/**
 * Finalize Pass 1 from a raw response string using the shared JSON parse boundary.
 * Builds and persists evidence on both success and failure.
 *
 * @throws JsonBoundaryError on all parse failures (never bare Error)
 */
export function finalizePass1FromResponse(raw: string, fallbackModel = PASS1_MODEL): SinglePassOutput {
  // P0: Log raw response preview before parse
  console.log(`[Pass1] raw response preview len=${raw.length}: ${raw.slice(0, 200)}`);

  function isEvaluationResultV1(value: unknown): asserts value is Record<string, unknown> {
    if (typeof value !== "object" || value === null || !("criteria" in (value as object))) {
      throw new Error("Response is not valid JSON (missing criteria key)");
    }
  }

  const result = parseJsonObjectBoundary(raw, "Pass1", { validate: isEvaluationResultV1 });

  const evidence = buildJsonBoundaryEvidence({
    raw: result.raw,
    normalized: result.normalized,
    candidate: result.candidate,
    candidatesFound: result.candidatesFound,
    parseFailureCode: result.ok === false ? result.error.code : null,
    parseFailureMessage: result.ok === false ? result.error.message : null,
  });

  persistPassEvidence({
    pass: "pass1",
    status: result.ok ? "ok" : "failed",
    evidence: evidence as unknown as Record<string, unknown>,
  });

  if (result.ok === false) {
    throw result.error;
  }

  const obj = result.value as Record<string, unknown>;
  const rawCriteria = Array.isArray(obj["criteria"]) ? (obj["criteria"] as unknown[]) : [];

  if (rawCriteria.length === 0) {
    throw new JsonBoundaryError({
      message: "[Pass1] JSON_PARSE_FAILED_NO_OBJECT: Response contains no criteria",
      code: "NO_OBJECT",
      raw: result.raw,
      normalized: result.normalized,
      candidate: result.candidate,
    });
  }

  const criteria: AxisCriterionResult[] = [];
  for (const item of rawCriteria) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    const key = String(c["key"] ?? "");
    if (!(CRITERIA_KEYS as readonly string[]).includes(key)) continue;

    const evidenceAnchors: EvidenceAnchor[] = Array.isArray(c["evidence"])
      ? (c["evidence"] as unknown[]).map((e) => {
          const ev = e as Record<string, unknown>;
          return {
            snippet: String(ev["snippet"] ?? "").substring(0, 200),
            char_start: typeof ev["char_start"] === "number" ? ev["char_start"] : undefined,
            char_end: typeof ev["char_end"] === "number" ? ev["char_end"] : undefined,
          };
        })
      : [];

    const recommendations = Array.isArray(c["recommendations"])
      ? (c["recommendations"] as unknown[]).map((r) => {
          const rec = r as Record<string, unknown>;
          const priority = String(rec["priority"] ?? "medium");
          return {
            priority: (priority === "high" || priority === "low" ? priority : "medium") as "high" | "medium" | "low",
            action: String(rec["action"] ?? ""),
            expected_impact: String(rec["expected_impact"] ?? ""),
            anchor_snippet: String(rec["anchor_snippet"] ?? ""),
          };
        })
      : [];

    const rawScore = c["score_0_10"];
    const score = Number.isFinite(Number(rawScore)) ? Math.round(Number(rawScore)) : 0;

    criteria.push({
      key: key as AxisCriterionResult["key"],
      score_0_10: Math.min(10, Math.max(0, score)),
      rationale: String(c["rationale"] ?? ""),
      evidence: evidenceAnchors,
      recommendations,
    });
  }

  return {
    pass: 1,
    axis: "craft_execution",
    criteria,
    model: String(obj["model"] ?? fallbackModel),
    prompt_version: PASS1_PROMPT_VERSION,
    temperature: PASS1_TEMPERATURE,
    generated_at: new Date().toISOString(),
  };
}
