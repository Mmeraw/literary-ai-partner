import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type { AxisCriterionResult, SinglePassOutput } from "./types";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeJsonStringFragment(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return value.replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
  }
}

function extractStringField(source: string, field: string): string | undefined {
  const match = new RegExp(`"${escapeRegex(field)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i").exec(source);
  if (!match?.[1]) return undefined;
  return decodeJsonStringFragment(match[1]).trim();
}

function extractNumberField(source: string, field: string): number | undefined {
  const match = new RegExp(`"${escapeRegex(field)}"\\s*:\\s*(-?\\d+)`, "i").exec(source);
  if (!match?.[1]) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCriterionWindow(rawText: string, key: CriterionKey): string | null {
  const match = new RegExp(`"key"\\s*:\\s*"${escapeRegex(key)}"`, "i").exec(rawText);
  if (!match) return null;
  return rawText.slice(match.index, Math.min(rawText.length, match.index + 1600));
}

function buildFallbackRationale(axis: SinglePassOutput["axis"], key: CriterionKey): string {
  const axisLabel = axis === "craft_execution" ? "craft" : "editorial";
  return `Provisional ${axisLabel} assessment for ${key}: the model response truncated before the full justification completed, so confidence is reduced.`;
}

function buildFallbackCriterion(
  key: CriterionKey,
  axis: SinglePassOutput["axis"],
  rawText: string,
): { criterion: AxisCriterionResult; salvaged: boolean } {
  const window = getCriterionWindow(rawText, key);
  if (!window) {
    return {
      criterion: {
        key,
        score_0_10: 5,
        rationale: buildFallbackRationale(axis, key),
        evidence: [],
        recommendations: [],
      },
      salvaged: false,
    };
  }

  const score = extractNumberField(window, "score_0_10");
  const rationale = extractStringField(window, "rationale");
  const snippet = extractStringField(window, "snippet");
  const priority = extractStringField(window, "priority");
  const action = extractStringField(window, "action");
  const expectedImpact = extractStringField(window, "expected_impact");
  const anchorSnippet = extractStringField(window, "anchor_snippet");

  return {
    criterion: {
      key,
      score_0_10: typeof score === "number" ? Math.max(0, Math.min(10, score)) : 5,
      rationale: rationale && rationale.length > 0 ? rationale : buildFallbackRationale(axis, key),
      evidence: snippet ? [{ snippet: snippet.slice(0, 200) }] : [],
      recommendations:
        priority === "high" || priority === "medium" || priority === "low"
          ? [
              {
                priority,
                action:
                  action && action.length > 0
                    ? action
                    : `Re-run this evaluation for a fuller ${axis === "craft_execution" ? "craft" : "editorial"} diagnosis once the model output completes.`,
                expected_impact:
                  expectedImpact && expectedImpact.length > 0
                    ? expectedImpact
                    : "Improves confidence and completeness of the evaluation.",
                anchor_snippet: anchorSnippet ?? snippet ?? "",
              },
            ]
          : [],
    },
    salvaged: true,
  };
}

export function buildDegradedSinglePassOutput(params: {
  pass: 1 | 2;
  axis: SinglePassOutput["axis"];
  model: string;
  promptVersion: string;
  temperature: number;
  warning: string;
  rawText?: string;
}): SinglePassOutput {
  const rawText = params.rawText ?? "";
  const built = CRITERIA_KEYS.map((key) => buildFallbackCriterion(key, params.axis, rawText));
  const salvagedCount = built.filter((entry) => entry.salvaged).length;

  return {
    pass: params.pass,
    axis: params.axis,
    criteria: built.map((entry) => entry.criterion),
    model: params.model,
    prompt_version: params.promptVersion,
    temperature: params.temperature,
    generated_at: new Date().toISOString(),
    verdict_status: "partial",
    confidence: "reduced",
    warnings:
      salvagedCount > 0
        ? [params.warning, "MODEL_TRUNCATED_SALVAGED"]
        : [params.warning],
  };
}
