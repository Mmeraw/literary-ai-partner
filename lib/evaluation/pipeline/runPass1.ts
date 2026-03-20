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
import type { SinglePassOutput, AxisCriterionResult, EvidenceAnchor } from "./types";

const PASS1_TEMPERATURE = 0.3;
const PASS1_MAX_TOKENS = 4000;
const PASS1_MODEL = "gpt-4o-mini";

export interface RunPass1Options {
  manuscriptText: string;
  workType: string;
  title: string;
  openaiApiKey?: string;
}

/**
 * Run Pass 1 — Craft Execution analysis.
 * Returns a validated SinglePassOutput with axis="craft_execution".
 * Throws on OpenAI error or unparseable response.
 */
export async function runPass1(opts: RunPass1Options): Promise<SinglePassOutput> {
  const apiKey = opts.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("[Pass1] OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey, maxRetries: 0 });

  const userPrompt = buildPass1UserPrompt({
    manuscriptText: opts.manuscriptText,
    workType: opts.workType,
    title: opts.title,
  });

  const completion = await openai.chat.completions.create({
    model: PASS1_MODEL,
    messages: [
      { role: "system", content: PASS1_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: PASS1_TEMPERATURE,
    max_tokens: PASS1_MAX_TOKENS,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("[Pass1] Empty response from OpenAI");
  }

  return parsePass1Response(responseText);
}

/**
 * Parse and validate a raw OpenAI response for Pass 1.
 * Pure function — no I/O, deterministic, fully testable.
 * 
 * @param raw Unknown JSON object from OpenAI
 * @returns Validated SinglePassOutput with axis="craft_execution"
 * @throws on invalid structure, empty criteria, or parse errors
 */
export function parsePass1Response(raw: string): SinglePassOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("[Pass1] Response is not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("[Pass1] Response is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
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
    model: String(obj["model"] ?? PASS1_MODEL),
    prompt_version: PASS1_PROMPT_VERSION,
    temperature: PASS1_TEMPERATURE,
    generated_at: new Date().toISOString(),
  };
}
