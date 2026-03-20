/**
 * Phase 2.7 — Pass 2: Editorial/Literary Insight Runner
 *
 * INDEPENDENCE GUARANTEE (Non-Negotiable Rule #3):
 *   This function MUST NOT receive Pass 1 output.
 *   The function signature enforces this at the type level —
 *   there is no parameter for Pass 1 data.
 *
 * Temperature: 0.3 (per Vol III Tools §PASS2)
 * Max tokens: 4000
 */

import OpenAI from "openai";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS2_SYSTEM_PROMPT, PASS2_PROMPT_VERSION, buildPass2UserPrompt } from "./prompts/pass2-editorial";
import type { SinglePassOutput, AxisCriterionResult, EvidenceAnchor, CompletionUsage, PassCompletionCapture } from "./types";

const PASS2_TEMPERATURE = 0.3;
const PASS2_MAX_TOKENS = 4000;
const PASS2_MODEL = "gpt-4o-mini";

/** Function signature for creating a chat completion (enables DI for testing). */
export type CreateCompletionFn = (params: {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  max_tokens: number;
  response_format: { type: string };
}) => Promise<{ choices: { message: { content: string | null } }[]; usage?: CompletionUsage }>;

export interface RunPass2Options {
  /**
   * The original manuscript text — the ONLY thing Pass 2 receives.
   * Pass 1 output must NEVER appear here.
   */
  manuscriptText: string;
  workType: string;
  title: string;
  model?: string;
  openaiApiKey?: string;
  /** Override the completion function (for testing). Production callers omit this. */
  _createCompletion?: CreateCompletionFn;
  _onCompletion?: (capture: PassCompletionCapture) => void;
}

/**
 * Run Pass 2 — Editorial/Literary Insight analysis.
 *
 * Independence guarantee: this function only accepts manuscript text.
 * There is deliberately no parameter for Pass 1 data.
 *
 * Returns a validated SinglePassOutput with axis="editorial_literary".
 * Throws on OpenAI error or unparseable response.
 */
export async function runPass2(opts: RunPass2Options): Promise<SinglePassOutput> {
  const createCompletion = opts._createCompletion ?? defaultCreateCompletion(opts.openaiApiKey);
  const selectedModel = opts.model ?? PASS2_MODEL;

  const userPrompt = buildPass2UserPrompt({
    manuscriptText: opts.manuscriptText,
    workType: opts.workType,
    title: opts.title,
  });

  const completion = await createCompletion({
    model: selectedModel,
    messages: [
      { role: "system", content: PASS2_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: PASS2_TEMPERATURE,
    max_tokens: PASS2_MAX_TOKENS,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("[Pass2] Empty response from OpenAI");
  }

  opts._onCompletion?.({
    pass: 2,
    raw_text: responseText,
    model: selectedModel,
    usage: completion.usage,
    generated_at: new Date().toISOString(),
  });

  return parsePass2Response(responseText, selectedModel);
}

/**
 * Build the default OpenAI completion function.
 * Separated so the constructor is only called when no DI override is provided.
 */
function defaultCreateCompletion(openaiApiKey?: string): CreateCompletionFn {
  const apiKey = openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("[Pass2] OPENAI_API_KEY is not configured");
  }
  const openai = new OpenAI({ apiKey, maxRetries: 0 });
  return (params) =>
    openai.chat.completions.create(params as Parameters<typeof openai.chat.completions.create>[0]) as Promise<{
      choices: { message: { content: string | null } }[];
      usage?: CompletionUsage;
    }>;
}

/**
 * Parse and validate a raw OpenAI response for Pass 2.
 * Pure function — no I/O, deterministic, fully testable.
 *
 * @param raw Unknown JSON object from OpenAI
 * @returns Validated SinglePassOutput with axis="editorial_literary"
 * @throws on invalid structure, empty criteria, or parse errors
 */
export function parsePass2Response(raw: string, fallbackModel = PASS2_MODEL): SinglePassOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("[Pass2] Response is not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("[Pass2] Response is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
  const rawCriteria = Array.isArray(obj["criteria"]) ? (obj["criteria"] as unknown[]) : [];

  if (rawCriteria.length === 0) {
    throw new Error("[Pass2] Response contains no criteria");
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
    pass: 2,
    axis: "editorial_literary",
    criteria,
    model: String(obj["model"] ?? fallbackModel),
    prompt_version: PASS2_PROMPT_VERSION,
    temperature: PASS2_TEMPERATURE,
    generated_at: new Date().toISOString(),
  };
}
