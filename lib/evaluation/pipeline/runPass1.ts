/**
 * Phase 2.7 — Pass 1: Craft Execution Runner
 *
 * Calls OpenAI with the craft execution prompt and parses the response
 * into a validated SinglePassOutput.
 *
 * Temperature: 0.3 (per Vol III Tools §PASS1)
 * Max tokens: 4000 (default, override via EVAL_PASS1_MAX_TOKENS)
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
import { JsonBoundaryError, parseJsonObjectBoundary } from "@/lib/llm/jsonParseBoundary";

const PASS1_TEMPERATURE = 0.3;
const PASS1_MAX_TOKENS = (() => {
  const parsed = Number.parseInt(process.env.EVAL_PASS1_MAX_TOKENS || "4000", 10);
  return Number.isFinite(parsed) && parsed >= 1000 && parsed <= 8000 ? parsed : 4000;
})();
const PASS1_MODEL = "o3";
const OPENAI_TIMEOUT_MS = getEvalOpenAiTimeoutMs();

function nowMs(): number {
  return Date.now();
}

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
}) => Promise<{ choices: CompletionChoice[]; usage?: CompletionUsage; id?: string; request_id?: string }>;

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
  const passStartMs = nowMs();

  if (!opts.registry || opts.registry.size === 0) {
    throw new Error("[Pass1] Canonical registry binding missing");
  }

  const createCompletion = opts._createCompletion ?? defaultCreateCompletion(opts.openaiApiKey);
  const selectedModel = getCanonicalPipelineModel(opts.model ?? PASS1_MODEL);

  const promptAssemblyStartMs = nowMs();

  const userPrompt = buildPass1UserPrompt({
    manuscriptText: opts.manuscriptText,
    workType: opts.workType,
    title: opts.title,
    executionMode: opts.executionMode,
  });
  const promptAssemblyMs = nowMs() - promptAssemblyStartMs;
  const inputChars = opts.manuscriptText.length;

  const outputTokenParam = buildOpenAIOutputTokenParam(selectedModel, PASS1_MAX_TOKENS);
  const configuredMaxTokens =
    typeof (outputTokenParam as { max_completion_tokens?: unknown }).max_completion_tokens === "number"
      ? Number((outputTokenParam as { max_completion_tokens: number }).max_completion_tokens)
      : typeof (outputTokenParam as { max_tokens?: unknown }).max_tokens === "number"
      ? Number((outputTokenParam as { max_tokens: number }).max_tokens)
      : null;

  console.log(`[Pass1] completion request model=${selectedModel}`);

  const modelCallStartMs = nowMs();
  const completion = await createCompletion({
    model: selectedModel,
    messages: [
      { role: "system", content: PASS1_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    ...buildOpenAITemperatureParam(selectedModel, PASS1_TEMPERATURE),
    ...outputTokenParam,
    response_format: { type: "json_object" },
  });
  const modelCallMs = nowMs() - modelCallStartMs;

  const parseValidationStartMs = nowMs();

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
    const parseValidationMs = nowMs() - parseValidationStartMs;
    const totalMs = nowMs() - passStartMs;
    console.log("[Pass1][Timing]", {
      stage: "failure",
      model: selectedModel,
      input_chars: inputChars,
      output_chars: responseText.length,
      prompt_assembly_ms: promptAssemblyMs,
      model_call_ms: modelCallMs,
      parse_validation_ms: parseValidationMs,
      total_ms: totalMs,
      configured_timeout_ms: OPENAI_TIMEOUT_MS,
      configured_max_tokens: configuredMaxTokens,
      usage_prompt_tokens: completion.usage?.prompt_tokens ?? null,
      usage_completion_tokens: completion.usage?.completion_tokens ?? null,
      usage_total_tokens: completion.usage?.total_tokens ?? null,
      error: "empty_response",
    });
    throw new Error(diagnosticMessage);
  }

  // P0: Check finish_reason — log a warning if the model stopped due to token limit
  const finishReasonWarning = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined;
  if (finishReasonWarning === "length") {
    console.warn("[Pass1] finish_reason=length — output may be truncated", {
      model: selectedModel,
      maxOutputTokens: PASS1_MAX_TOKENS,
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
    pass: 1,
    raw_text: responseText,
    model: selectedModel,
    usage: completion.usage,
    finish_reason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined,
    request_id: requestId,
    generated_at: new Date().toISOString(),
  });

  const finishReason = typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : "unknown";

  let parsedOutput: SinglePassOutput;
  try {
    parsedOutput = parsePass1Response(responseText, selectedModel);
  } catch (error) {
    console.error("[Pass1] Parse boundary diagnostic", {
      title: opts.title,
      model: selectedModel,
      request_id: requestId ?? null,
      finish_reason: finishReason,
      configured_max_tokens: configuredMaxTokens,
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
  const parseValidationMs = nowMs() - parseValidationStartMs;
  const totalMs = nowMs() - passStartMs;

  console.log("[Pass1][Timing]", {
    stage: "success",
    model: selectedModel,
    input_chars: inputChars,
    output_chars: responseText.length,
    prompt_assembly_ms: promptAssemblyMs,
    model_call_ms: modelCallMs,
    parse_validation_ms: parseValidationMs,
    total_ms: totalMs,
    configured_timeout_ms: OPENAI_TIMEOUT_MS,
    configured_max_tokens: configuredMaxTokens,
    usage_prompt_tokens: completion.usage?.prompt_tokens ?? null,
    usage_completion_tokens: completion.usage?.completion_tokens ?? null,
    usage_total_tokens: completion.usage?.total_tokens ?? null,
  });

  return parsedOutput;
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
  const openai = new OpenAI({ apiKey, maxRetries: 2, timeout: OPENAI_TIMEOUT_MS });
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
 * @throws on invalid structure, empty criteria, or parse errors
 */
export function parsePass1Response(raw: string, fallbackModel = PASS1_MODEL): SinglePassOutput {
  // P0: Log raw response preview before parse
  console.log(`[Pass1] raw response preview len=${raw.length}: ${raw.slice(0, 200)}`);

  let parsed: Record<string, unknown>;
  try {
    const boundary = parseJsonObjectBoundary<Record<string, unknown>>(raw, {
      label: "Pass1",
    });
    parsed = boundary.value;
  } catch (error) {
    if (error instanceof JsonBoundaryError) {
      throw new Error(`[Pass1] ${error.code}: ${error.message}`);
    }
    throw new Error("[Pass1] JSON_PARSE_FAILED_MALFORMED: Response is not valid JSON (malformed JSON)");
  }

  const obj = parsed;
  const rawCriteria = Array.isArray(obj["criteria"]) ? (obj["criteria"] as unknown[]) : [];

  if (rawCriteria.length === 0) {
    throw new Error("[Pass1] Response contains no criteria");
  }

  const criteria: AxisCriterionResult[] = [];
  for (const item of rawCriteria) {
    if (typeof item !== "object" || item === null) continue;
    const c = item as Record<string, unknown>;
    const key = String(c["key"] ?? "");
    if (!(CRITERIA_KEYS as readonly string[]).includes(key)) continue;

    const evidence: EvidenceAnchor[] = Array.isArray(c["evidence"])
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
      evidence,
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
