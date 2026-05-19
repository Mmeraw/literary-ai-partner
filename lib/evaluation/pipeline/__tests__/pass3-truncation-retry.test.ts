/**
 * Pass 3 retry-on-truncation behavior.
 *
 * Mirrors the perplexityChunkScorer.ts PERPLEXITY_LENGTH_RETRY_MAX_TOKENS
 * pattern: when the first Pass 3 GPT call returns finish_reason="length" OR
 * contains a recommendation flagged by hasTruncatedRecommendationAction(),
 * runPass3Synthesis retries ONCE with an expanded token budget and uses the
 * second response. If the retry also truncates, the runner proceeds with
 * whatever was returned (no infinite retry).
 */

import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { runPass3Synthesis } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { CreateCompletionFn } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import { buildPass2aStructuredContext } from "@/lib/evaluation/pipeline/buildPass2aStructuredContext";

function makePassOutput(pass: 1 | 2, axis: string): SinglePassOutput {
  return {
    pass,
    axis: axis as SinglePassOutput["axis"],
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Analysis of ${key} for pass ${pass}.`,
      evidence: [{ snippet: "The river moved slowly." }],
      recommendations: [],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makePass3Fixture(
  recommendationAction: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      final_rationale: `Synthesized analysis for ${key} combining both axes.`,
      evidence: [{ snippet: "The river moved slowly." }],
      recommendations: [
        {
          priority: "medium",
          action: recommendationAction,
          expected_impact: "Elevates overall quality.",
          anchor_snippet: '"slowly"',
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary:
        "This manuscript shows strong potential but needs targeted revision before submission.",
      top_3_strengths: ["Strong voice", "Clear arc", "Vivid imagery"],
      top_3_risks: ["Pacing gaps", "Thin character motivation", "Weak world-building"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
    },
    ...overrides,
  };
}

const TRUNCATED_ACTION =
  "Tighten the opening scene to land the inciting question before the";
const COMPLETE_ACTION =
  "Tighten the opening scene to land the inciting question before the first chapter break because readers need stakes anchored early.";

describe("runPass3Synthesis — retry-on-truncation", () => {
  const registry = loadCanonicalRegistry();
  const pass1 = makePassOutput(1, "craft_execution");
  const pass2 = makePassOutput(2, "editorial_literary");
  const context = buildPass2aStructuredContext({
    manuscriptText:
      "Crown Hyla watched the chamber. Zimeon arrived three years later and met Thorander in the Dead Zone.",
  });

  it("retries exactly once when finish_reason=length and uses the second response", async () => {
    const truncatedFixture = makePass3Fixture(TRUNCATED_ACTION);
    const completeFixture = makePass3Fixture(COMPLETE_ACTION);
    const calls: Array<{ maxTokens: number | undefined }> = [];

    const completion: CreateCompletionFn = async (params) => {
      const maxTokens =
        (params as Record<string, unknown>).max_tokens as number | undefined ??
        (params as Record<string, unknown>).max_completion_tokens as number | undefined;
      calls.push({ maxTokens });
      if (calls.length === 1) {
        return {
          choices: [
            {
              message: { content: JSON.stringify(truncatedFixture) },
              finish_reason: "length",
            },
          ],
          usage: { prompt_tokens: 1000, completion_tokens: 8000, total_tokens: 9000 },
        };
      }
      return {
        choices: [
          {
            message: { content: JSON.stringify(completeFixture) },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 9000, total_tokens: 10000 },
      };
    };

    const result = await runPass3Synthesis({
      pass1,
      pass2,
      pass2aStructuredContext: context,
      manuscriptText: "The river moved slowly through the valley.",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: completion,
    });

    // Exactly one retry fired (two total invocations).
    expect(calls).toHaveLength(2);
    // Second invocation requested an expanded token budget (+4000 over the first).
    expect(calls[1].maxTokens).toBeGreaterThan(calls[0].maxTokens ?? 0);
    expect((calls[1].maxTokens ?? 0) - (calls[0].maxTokens ?? 0)).toBe(4000);

    // The second response was used — recommendation action carries the complete trailing clause.
    const recAction = result.criteria.find((c) => c.key === "concept")?.recommendations[0]?.action;
    expect(recAction).toBeTruthy();
    expect(recAction).toContain("first chapter break");
  });

  it("retries exactly once when a recommendation action is truncated even if finish_reason=stop", async () => {
    const truncatedFixture = makePass3Fixture(TRUNCATED_ACTION);
    const completeFixture = makePass3Fixture(COMPLETE_ACTION);
    const calls: Array<{ maxTokens: number | undefined }> = [];

    const completion: CreateCompletionFn = async (params) => {
      const maxTokens =
        (params as Record<string, unknown>).max_tokens as number | undefined ??
        (params as Record<string, unknown>).max_completion_tokens as number | undefined;
      calls.push({ maxTokens });
      if (calls.length === 1) {
        return {
          choices: [
            {
              message: { content: JSON.stringify(truncatedFixture) },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1000, completion_tokens: 7000, total_tokens: 8000 },
        };
      }
      return {
        choices: [
          {
            message: { content: JSON.stringify(completeFixture) },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 9000, total_tokens: 10000 },
      };
    };

    const result = await runPass3Synthesis({
      pass1,
      pass2,
      pass2aStructuredContext: context,
      manuscriptText: "The river moved slowly through the valley.",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: completion,
    });

    expect(calls).toHaveLength(2);
    const recAction = result.criteria.find((c) => c.key === "concept")?.recommendations[0]?.action;
    expect(recAction).toContain("first chapter break");
  });

  it("does not retry when first response is clean (no truncation signals)", async () => {
    const completeFixture = makePass3Fixture(COMPLETE_ACTION);
    let invocationCount = 0;

    const completion: CreateCompletionFn = async () => {
      invocationCount += 1;
      return {
        choices: [
          {
            message: { content: JSON.stringify(completeFixture) },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 5000, total_tokens: 6000 },
      };
    };

    await runPass3Synthesis({
      pass1,
      pass2,
      pass2aStructuredContext: context,
      manuscriptText: "The river moved slowly through the valley.",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: completion,
    });

    expect(invocationCount).toBe(1);
  });
});
