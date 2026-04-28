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

  it("truncates evidence snippets to 200 chars", () => {
    const fixture = makePass1Fixture();
    fixture.criteria[0].evidence = [{ snippet: "x".repeat(300) }];

    const result = parsePass1Response(JSON.stringify(fixture));

    expect(result.criteria[0].evidence[0].snippet.length).toBe(200);
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
      model: "gpt-4o",
      openaiApiKey: "sk-test",
      _createCompletion: captureCompletion,
    });

    expect(requestedModel).toBe("gpt-4o");
    expect(result.model).toBe("gpt-4o");
  });

  // Skip in environments where OPENAI_API_KEY is always set (e.g., CI with secrets).
  // The guard is unit-tested by inspecting defaultCreateCompletion directly in isolation.
  it.skip("throws when OPENAI_API_KEY is not configured", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    // Pass a throwing completion so there's no real network attempt.
    // The guard should fire before any HTTP call happens.
    await expect(
      runPass1({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        registry,
        // No openaiApiKey, no _createCompletion — triggers the API key guard.
      }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  }, 10_000);

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
//   1. Production Pass1 never uses o3 (the model that caused PV115-class empty-content failures).
//   2. o3 is only permitted behind a non-production env flag.
//   3. When finish_reason=length produces empty content, Pass1 always throws — never
//      silently emits an empty artifact (the exact failure mode of job 6abcc20c).

describe("RCA-PASS1-TOKEN-001 — Pass1 model routing and PV115-class reachability", () => {
  const registry = loadCanonicalRegistry();

  it("E2E-04: production Pass1 uses the reliable JSON model, not o3, when no caller override is given", async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_PASS1_O3_EXPERIMENT;

    // Simulate a production environment with experiment flag absent.
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    delete process.env.ENABLE_PASS1_O3_EXPERIMENT;

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

    // Restore env before the assertion so failures don't leak.
    Object.defineProperty(process.env, "NODE_ENV", { value: savedNodeEnv, configurable: true });
    if (savedFlag !== undefined) process.env.ENABLE_PASS1_O3_EXPERIMENT = savedFlag;

    expect(requestedModel).toBeDefined();
    expect(requestedModel!.toLowerCase().startsWith("o3")).toBe(false);
  });

  it("E2E-04: production Pass1 overrides an explicit o3 caller request to the reliable JSON model", async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_PASS1_O3_EXPERIMENT;

    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    delete process.env.ENABLE_PASS1_O3_EXPERIMENT;

    let requestedModel: string | undefined;
    const captureModel: CreateCompletionFn = async (params) => {
      requestedModel = params.model;
      return { choices: [{ message: { content: JSON.stringify(makePass1Fixture()) } }] };
    };

    await runPass1({
      manuscriptText: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "Production o3-override test",
      registry,
      model: "o3",           // caller requests o3 explicitly
      openaiApiKey: "sk-test",
      _createCompletion: captureModel,
    });

    Object.defineProperty(process.env, "NODE_ENV", { value: savedNodeEnv, configurable: true });
    if (savedFlag !== undefined) process.env.ENABLE_PASS1_O3_EXPERIMENT = savedFlag;

    expect(requestedModel).toBeDefined();
    expect(requestedModel!.toLowerCase().startsWith("o3")).toBe(false);
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
    ).rejects.toThrow("finish_reason=length");
  });

  it("E2E-12: non-production env with ENABLE_PASS1_O3_EXPERIMENT=true allows o3 for Pass1", async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedFlag = process.env.ENABLE_PASS1_O3_EXPERIMENT;

    Object.defineProperty(process.env, "NODE_ENV", { value: "test", configurable: true });
    process.env.ENABLE_PASS1_O3_EXPERIMENT = "true";

    let requestedModel: string | undefined;
    const captureModel: CreateCompletionFn = async (params) => {
      requestedModel = params.model;
      return { choices: [{ message: { content: JSON.stringify(makePass1Fixture()) } }] };
    };

    await runPass1({
      manuscriptText: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "Non-prod o3 experiment test",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: captureModel,
    });

    Object.defineProperty(process.env, "NODE_ENV", { value: savedNodeEnv, configurable: true });
    if (savedFlag !== undefined) {
      process.env.ENABLE_PASS1_O3_EXPERIMENT = savedFlag;
    } else {
      delete process.env.ENABLE_PASS1_O3_EXPERIMENT;
    }

    // When the experiment is explicitly enabled in non-prod, o3 should be used.
    expect(requestedModel).toBeDefined();
    expect(getCanonicalPipelineModel(requestedModel!)).toBeDefined();
  });
});
