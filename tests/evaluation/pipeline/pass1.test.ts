/**
 * Phase 2.7 — Pass 1 Tests
 *
 * Tests the parsePass1Response pure function directly (no OpenAI mock needed).
 * Also tests runPass1 with dependency-injected completion function.
 */

import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass1Response, runPass1 } from "@/lib/evaluation/pipeline/runPass1";
import type { CreateCompletionFn } from "@/lib/evaluation/pipeline/runPass1";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import { getCanonicalPipelineModel } from "@/lib/evaluation/policy";
import { resetEvaluationRuntimeConfigCacheForTests } from "@/lib/config/evaluationRuntimeConfig";

// ── Fixture ──────────────────────────────────────────────────────────────────

function makePass1Fixture() {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Craft analysis for ${key}: The passage demonstrates competent handling.`,
      evidence: [{ snippet: "The river moved slowly through the valley." }],
      recommendations: [
        {
          priority: "medium",
          action: `Strengthen the ${key} dimension with more specific evidence from the text.`,
          expected_impact: "Increases reader engagement.",
          anchor_snippet: '"she whispered"',
        },
      ],
    })),
  };
}

/** Helper: build a mock completion function that returns the given JSON string. */
function mockCompletion(responseJson: string): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: responseJson } }],
  });
}

/** Helper: build a mock completion function that throws. */
function throwingCompletion(error: Error): CreateCompletionFn {
  return async () => {
    throw error;
  };
}

/** Helper: build a mock completion function that returns null content. */
function nullCompletion(): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: null } }],
  });
}

/** Helper: build a mock completion function that returns structured content parts. */
function arrayContentCompletion(responseJson: string): CreateCompletionFn {
  return async () => ({
    choices: [
      {
        message: {
          content: [{ type: "output_text", text: responseJson }],
        },
      },
    ],
  });
}

/** Helper: build a mock completion with finish metadata but no usable content. */
function lengthLimitedEmptyCompletion(): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: null }, finish_reason: "length" }],
    usage: { prompt_tokens: 700, completion_tokens: 4000, total_tokens: 4700 },
  });
}

// ── Pure parser tests ─────────────────────────────────────────────────────────

describe("parsePass1Response", () => {
  it("returns a valid SinglePassOutput with all 13 criteria", () => {
    const result = parsePass1Response(JSON.stringify(makePass1Fixture()));

    expect(result.pass).toBe(1);
    expect(result.axis).toBe("craft_execution");
    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(
      expect.arrayContaining(CRITERIA_KEYS as unknown as string[]),
    );
    expect(result.temperature).toBe(0.3);
  });

  it("clips scores to integer 0-10 range", () => {
    const fixture = makePass1Fixture();
    fixture.criteria[0].score_0_10 = 15; // out of range
    fixture.criteria[1].score_0_10 = -3; // out of range

    const result = parsePass1Response(JSON.stringify(fixture));

    expect(result.criteria[0].score_0_10).toBe(10);
    expect(result.criteria[1].score_0_10).toBe(0);
  });

  it("filters out criteria with unknown keys", () => {
    const fixture = makePass1Fixture();
    fixture.criteria.push({
      key: "FAKE_CRITERION" as never,
      score_0_10: 8,
      rationale: "This should be filtered.",
      evidence: [],
      recommendations: [],
    });

    const result = parsePass1Response(JSON.stringify(fixture));

    expect(
      result.criteria.every((c) => (CRITERIA_KEYS as readonly string[]).includes(c.key)),
    ).toBe(true);
    expect(result.criteria).toHaveLength(13);
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePass1Response("not json")).toThrow("JSON_PARSE_FAILED_NO_OBJECT");
  });

  it("classifies clearly truncated response with JSON_PARSE_FAILED_TRUNCATED", () => {
    // A response that starts like JSON but is cut off before closing brace
    expect(() => parsePass1Response('{"key": "value')).toThrow("JSON_PARSE_FAILED_TRUNCATED");
  });

  it("classifies malformed JSON ending with } as JSON_PARSE_FAILED_MALFORMED", () => {
    expect(() => parsePass1Response('{ this: is invalid }')).toThrow("JSON_PARSE_FAILED_MALFORMED");
  });

  it("strips markdown json fences before parse", () => {
    const fixture = makePass1Fixture();
    const fenced = "```json\n" + JSON.stringify(fixture) + "\n```";
    const result = parsePass1Response(fenced);
    expect(result.pass).toBe(1);
    expect(result.criteria).toHaveLength(13);
  });

  it("strips plain markdown fences before parse", () => {
    const fixture = makePass1Fixture();
    const fenced = "```\n" + JSON.stringify(fixture) + "\n```";
    const result = parsePass1Response(fenced);
    expect(result.pass).toBe(1);
    expect(result.criteria).toHaveLength(13);
  });

  it("throws on empty criteria array", () => {
    expect(() => parsePass1Response(JSON.stringify({ criteria: [] }))).toThrow(
      "no criteria",
    );
  });

  it("truncates evidence snippets to 180 chars", () => {
    const fixture = makePass1Fixture();
    fixture.criteria[0].evidence = [{ snippet: "x".repeat(300) }];

    const result = parsePass1Response(JSON.stringify(fixture));

        expect(result.criteria[0].evidence[0].snippet.length).toBe(180);
  });
});

// ── Runner integration tests (DI, no real OpenAI) ─────────────────────────────

describe("runPass1", () => {
  const registry = loadCanonicalRegistry();

  it("returns parsed output when given a valid completion", async () => {
    const result = await runPass1({
      manuscriptText: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: mockCompletion(JSON.stringify(makePass1Fixture())),
    });

    expect(result.pass).toBe(1);
    expect(result.axis).toBe("craft_execution");
    // RCA-PASS1-TOKEN-001: Pass1 must not use o3 in production.
    // Default model resolves to gpt-4o (the reliable JSON extraction model).
    expect(result.model).toBe(getCanonicalPipelineModel("gpt-4o"));
    expect(result.criteria).toHaveLength(13);
  });

  it("uses the caller-provided model override in the completion request", async () => {
    let requestedModel: string | undefined;
    const captureCompletion: CreateCompletionFn = async (params) => {
      requestedModel = params.model;
      return {
        choices: [{ message: { content: JSON.stringify(makePass1Fixture()) } }],
      };
    };

    const result = await runPass1({
      manuscriptText: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: captureCompletion,
    });

    expect(requestedModel).toBe("gpt-4o");
    expect(result.model).toBe("gpt-4o");
  });

  it("prefers EVAL_PASS1_MODEL over chunk/default routing", async () => {
    const previousPass1Model = process.env.EVAL_PASS1_MODEL;
    const previousChunkModel = process.env.EVAL_CHUNK_MODEL;
    process.env.EVAL_PASS1_MODEL = "gpt-5-mini";
    process.env.EVAL_CHUNK_MODEL = "gpt-4.1-mini";

    let requestedModel: string | undefined;
    const captureCompletion: CreateCompletionFn = async (params) => {
      requestedModel = params.model;
      return {
        choices: [{ message: { content: JSON.stringify(makePass1Fixture()) } }],
      };
    };

    try {
      const result = await runPass1({
        manuscriptText: "The river moved slowly through the valley.",
        workType: "literary_fiction",
        title: "Test Manuscript",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: captureCompletion,
      });

      expect(requestedModel).toBe("gpt-5-mini");
      expect(result.model).toBe("gpt-5-mini");
    } finally {
      if (previousPass1Model === undefined) {
        delete process.env.EVAL_PASS1_MODEL;
      } else {
        process.env.EVAL_PASS1_MODEL = previousPass1Model;
      }

      if (previousChunkModel === undefined) {
        delete process.env.EVAL_CHUNK_MODEL;
      } else {
        process.env.EVAL_CHUNK_MODEL = previousChunkModel;
      }
    }
  });

  it("throws when OPENAI_API_KEY is not configured", async () => {
    // Use openaiApiKey: null as the explicit "no key" sentinel.
    // This bypasses the runtime-config fallback without mutating process.env,
    // making the test hermetic in CI environments where OPENAI_API_KEY is always set.
    await expect(
      runPass1({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        registry,
        openaiApiKey: null,
      }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");
  });

  it("throws when OpenAI returns empty content", async () => {
    await expect(
      runPass1({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: nullCompletion(),
      }),
    ).rejects.toThrow("Empty response from OpenAI");
  });

  it("accepts structured content-part arrays when the provider does not return a flat string", async () => {
    const result = await runPass1({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: arrayContentCompletion(JSON.stringify(makePass1Fixture())),
    });

    expect(result.criteria).toHaveLength(13);
  });

  it("includes finish_reason and token usage in enriched empty-response errors", async () => {
    await expect(
      runPass1({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: lengthLimitedEmptyCompletion(),
      }),
    ).rejects.toThrow("finish_reason=length");
  });

  it("honors configured Pass1 max tokens above 1800", async () => {
    const previousPass1Max = process.env.EVAL_PASS1_MAX_TOKENS;
    process.env.EVAL_PASS1_MAX_TOKENS = "6000";
    resetEvaluationRuntimeConfigCacheForTests();

    let seenBudget = 0;
    const captureBudgetCompletion: CreateCompletionFn = async (params) => {
      seenBudget =
        typeof params.max_completion_tokens === "number"
          ? params.max_completion_tokens
          : typeof params.max_tokens === "number"
            ? params.max_tokens
            : 0;

      return {
        choices: [{ message: { content: JSON.stringify(makePass1Fixture()) }, finish_reason: "stop" }],
      };
    };

    try {
      const result = await runPass1({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: captureBudgetCompletion,
      });

      expect(result.criteria).toHaveLength(13);
      expect(seenBudget).toBe(6000);
      expect(seenBudget).toBeGreaterThan(1800);
    } finally {
      if (previousPass1Max === undefined) {
        delete process.env.EVAL_PASS1_MAX_TOKENS;
      } else {
        process.env.EVAL_PASS1_MAX_TOKENS = previousPass1Max;
      }
      resetEvaluationRuntimeConfigCacheForTests();
    }
  });

  it("retries once with a larger token budget after an empty length-limited response", async () => {
    const seenBudgets: number[] = [];
    let callCount = 0;

    const retryingCompletion: CreateCompletionFn = async (params) => {
      const budget =
        typeof params.max_completion_tokens === "number"
          ? params.max_completion_tokens
          : typeof params.max_tokens === "number"
            ? params.max_tokens
            : 0;
      seenBudgets.push(budget);

      if (callCount++ === 0) {
        return {
          choices: [{ message: { content: null }, finish_reason: "length" }],
          usage: { prompt_tokens: 700, completion_tokens: budget, total_tokens: 700 + budget },
        };
      }

      return {
        choices: [{ message: { content: JSON.stringify(makePass1Fixture()) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 700, completion_tokens: 1200, total_tokens: 1900 },
      };
    };

    const result = await runPass1({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: retryingCompletion,
    });

    expect(result.criteria).toHaveLength(13);
    expect(callCount).toBe(2);
    expect(seenBudgets).toHaveLength(2);
    expect(seenBudgets[1]).toBeGreaterThan(seenBudgets[0]);
  });

  it("propagates OpenAI errors", async () => {
    await expect(
      runPass1({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: throwingCompletion(new Error("Rate limit exceeded")),
      }),
    ).rejects.toThrow("Rate limit exceeded");
  });
});

// ── RCA-PASS1-TOKEN-001: Pass1 model routing and reachability regressions ──────
//
// These tests enforce that:
//   1. Production Pass1 always uses gpt-4o — model selection is not caller-controlled.
//   2. RunPass1Options intentionally has no `model` field; the type guard below prevents
//      that field from ever being re-introduced without a compile error.
//   3. When finish_reason=length produces empty content, Pass1 always throws — never
//      silently emits an empty artifact (the exact failure mode of job 6abcc20c).

describe("RCA-PASS1-TOKEN-001 — Pass1 model routing and PV115-class reachability", () => {
  const registry = loadCanonicalRegistry();

  it("E2E-04: production Pass1 always uses gpt-4o regardless of environment", async () => {
    let requestedModel: string | undefined;
    const captureModel: CreateCompletionFn = async (params) => {
      requestedModel = params.model;
      return { choices: [{ message: { content: JSON.stringify(makePass1Fixture()) } }] };
    };

    await runPass1({
      manuscriptText: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "Production routing test",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: captureModel,
    });

    expect(requestedModel).toBe(getCanonicalPipelineModel("gpt-4o"));
  });

  it("type-level: RunPass1Options must not accept a model override", () => {
    // Compile-time regression guard. If `model` is re-introduced to RunPass1Options
    // this @ts-expect-error will become an error and the build will fail.
    const _opts: import("@/lib/evaluation/pipeline/runPass1").RunPass1Options = {
      // @ts-expect-error model must not exist on RunPass1Options
      model: "o3",
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "guard",
      registry: loadCanonicalRegistry(),
    };
    expect(_opts).toBeDefined();
  });

  it("E2E-12: PV115-class Pass1 finish_reason=length with empty content always throws (never silently returns empty artifact)", async () => {
    // This is the exact failure mode of job 6abcc20c — o3 burns all output tokens
    // on reasoning and emits null/empty content with finish_reason=length.
    // Pass1 MUST throw in this case rather than returning a partial or empty result.
    const pv115ClassText = "a".repeat(40_000); // PV115-class input length

    await expect(
      runPass1({
        manuscriptText: pv115ClassText,
        workType: "literary_fiction",
        title: "PV115-class reachability test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: lengthLimitedEmptyCompletion(),
      }),
    ).rejects.toThrow("PASS1_LENGTH_RETRY_EXHAUSTED");
  });
});
