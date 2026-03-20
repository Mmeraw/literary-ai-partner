/**
 * Phase 2.7 — Pass 3: Synthesis & Reconciliation Runner
 *
 * Receives Pass 1 + Pass 2 outputs and reconciles them into a unified
 * dual-axis evaluation. Also handles local reconciliation of scores
 * as a deterministic fallback if the AI response is incomplete.
 *
 * Temperature: 0.2 (per Vol III Tools §PASS3 — lower for precision)
 * Max tokens: 5000
 */

import OpenAI from "openai";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { PASS3_SYSTEM_PROMPT, PASS3_PROMPT_VERSION, buildPass3UserPrompt } from "./prompts/pass3-synthesis";
import type { SinglePassOutput, SynthesisOutput, SynthesizedCriterion, EvidenceAnchor } from "./types";

const PASS3_TEMPERATURE = 0.2;
const PASS3_MAX_TOKENS = 5000;
const PASS3_MODEL = "gpt-4o-mini";

export interface RunPass3Options {
  pass1: SinglePassOutput;
  pass2: SinglePassOutput;
  manuscriptText: string;
  title: string;
  openaiApiKey?: string;
}

/**
 * Run Pass 3 — Synthesis & Reconciliation.
 * Receives both axis outputs and reconciles into a SynthesisOutput.
 * Throws on OpenAI error or unparseable response.
 */
export async function runPass3Synthesis(opts: RunPass3Options): Promise<SynthesisOutput> {
  const apiKey = opts.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("[Pass3] OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({ apiKey, maxRetries: 0 });

  const userPrompt = buildPass3UserPrompt({
    pass1Json: JSON.stringify(opts.pass1, null, 2),
    pass2Json: JSON.stringify(opts.pass2, null, 2),
    manuscriptText: opts.manuscriptText,
    title: opts.title,
  });

  const completion = await openai.chat.completions.create({
    model: PASS3_MODEL,
    messages: [
      { role: "system", content: PASS3_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: PASS3_TEMPERATURE,
    max_tokens: PASS3_MAX_TOKENS,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("[Pass3] Empty response from OpenAI");
  }

  return parsePass3Response(responseText, opts.pass1, opts.pass2);
}

export function parsePass3Response(
  raw: string,
  pass1: SinglePassOutput,
  pass2: SinglePassOutput,
): SynthesisOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("[Pass3] Response is not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("[Pass3] Response is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
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

    const evidence: EvidenceAnchor[] = parseEvidenceArray(rawEntry?.["evidence"]);
    const recommendations = parseRecommendations(rawEntry?.["recommendations"]);

    criteria.push({
      key,
      craft_score: Math.min(10, Math.max(0, craftScore)),
      editorial_score: Math.min(10, Math.max(0, editorialScore)),
      final_score_0_10: finalScore,
      score_delta: delta,
      delta_explanation:
        delta > 2 ? String(rawEntry?.["delta_explanation"] ?? "Axes diverge significantly.") : undefined,
      final_rationale: String(rawEntry?.["final_rationale"] ?? p1c?.rationale ?? ""),
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

  const summary = String(rawOverall["one_paragraph_summary"] ?? "").substring(0, 500);

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
    },
    metadata: {
      pass1_model: String(rawMeta["pass1_model"] ?? pass1.model),
      pass2_model: String(rawMeta["pass2_model"] ?? pass2.model),
      pass3_model: String(rawMeta["pass3_model"] ?? PASS3_MODEL),
      generated_at: new Date().toISOString(),
    },
  };
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

function parseRecommendations(raw: unknown): SynthesizedCriterion["recommendations"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => {
      const priority = String(r["priority"] ?? "medium");
      const sourcePass = Number(r["source_pass"] ?? 3);
      return {
        priority: (priority === "high" || priority === "low" ? priority : "medium") as "high" | "medium" | "low",
        action: String(r["action"] ?? ""),
        expected_impact: String(r["expected_impact"] ?? ""),
        anchor_snippet: String(r["anchor_snippet"] ?? ""),
        source_pass: (sourcePass === 1 || sourcePass === 2 ? sourcePass : 3) as 1 | 2 | 3,
      };
    });
}
