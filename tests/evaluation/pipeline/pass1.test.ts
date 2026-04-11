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
    expect(() => parsePass1Response("not json")).toThrow("not valid JSON");
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
    expect(result.model).toBe(getCanonicalPipelineModel("o3"));
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

  it("throws when OPENAI_API_KEY is not configured", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      runPass1({ manuscriptText: "test", workType: "literary_fiction", title: "Test", registry }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
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
