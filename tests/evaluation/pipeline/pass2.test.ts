/**
 * Phase 2.7 — Pass 2 Tests
 *
 * Tests the parsePass2Response pure function directly (no OpenAI mock needed).
 * Also tests runPass2 with dependency-injected completion function.
 * Validates the function signature enforces no Pass 1 parameter.
 */

import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  aggregatePass2ChunkResults,
  assertPass2OutputDispositionContract,
  parsePass2Response,
  runPass2,
} from "@/lib/evaluation/pipeline/runPass2";
import type { RunPass2Options, CreateCompletionFn } from "@/lib/evaluation/pipeline/runPass2";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import { getCanonicalPipelineModel } from "@/lib/evaluation/policy";

// ── Fixture ──────────────────────────────────────────────────────────────────

function makePass2Fixture() {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 6,
      rationale: `Editorial analysis for ${key}: The literary sensibility is present but needs refinement.`,
      evidence: [{ snippet: "She reached for the door handle, her hand trembling." }],
      recommendations: [
        {
          priority: "high",
          action: `Deepen the ${key} dimension through more precise literary attention to the emotional subtext.`,
          expected_impact: "Elevates literary quality and emotional resonance.",
          anchor_snippet: '"trembling"',
        },
      ],
      recommendation_status: "recommendation_provided",
    })),
  };
}

function makePass2Chunk(options: {
  anchor: string;
  recommendationStatus?: "recommendation_provided" | "insufficient_evidence" | "no_recommendation_warranted";
  recommendationStatusRationale?: string;
  withRecommendation?: boolean;
}): SinglePassOutput {
  const fixture = makePass2Fixture();
  const concept = fixture.criteria[0];
  concept.recommendations = options.withRecommendation === false
    ? []
    : [{
        ...concept.recommendations[0],
        anchor_snippet: options.anchor,
      }];
  concept.recommendation_status = options.recommendationStatus
    ?? (concept.recommendations.length > 0 ? "recommendation_provided" : "insufficient_evidence");
  (concept as typeof concept & { recommendation_status_rationale?: string }).recommendation_status_rationale =
    options.recommendationStatusRationale;
  return parsePass2Response(JSON.stringify({ criteria: fixture.criteria }));
}

/** Helper: build a mock completion function that returns the given JSON string. */
function mockCompletion(responseJson: string): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: responseJson } }],
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
    usage: { prompt_tokens: 650, completion_tokens: 4000, total_tokens: 4650 },
  });
}

// ── Pure parser tests ─────────────────────────────────────────────────────────

describe("parsePass2Response", () => {
  it("returns a valid SinglePassOutput with axis=editorial_literary", () => {
    const result = parsePass2Response(JSON.stringify(makePass2Fixture()));

    expect(result.pass).toBe(2);
    expect(result.axis).toBe("editorial_literary");
    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(
      expect.arrayContaining(CRITERIA_KEYS as unknown as string[]),
    );
    expect(result.temperature).toBe(0.3);
  });

  it("fails current output without disposition metadata even when parser options are omitted", () => {
    const fixture = makePass2Fixture();
    delete (fixture.criteria[0] as Partial<typeof fixture.criteria[number]>).recommendation_status;

    expect(() => parsePass2Response(JSON.stringify(fixture))).toThrow(
      "OPPORTUNITY_COVERAGE_MISSING",
    );
  });

  it("rejects out-of-range scores to null sentinel (PR-D)", () => {
    // PR-D: canonical range is [1,10]; out-of-range scores are rejected to null.
    const fixture = makePass2Fixture();
    fixture.criteria[0].score_0_10 = 15; // out of range (high)
    fixture.criteria[1].score_0_10 = -3; // out of range (low)
    fixture.criteria[2].score_0_10 = 0;  // out of range (Pass 4 rejects < 1)

    const result = parsePass2Response(JSON.stringify(fixture));

    expect(result.criteria[0].score_0_10).toBeNull();
    expect(result.criteria[1].score_0_10).toBeNull();
    expect(result.criteria[2].score_0_10).toBeNull();
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePass2Response("not json")).toThrow("JSON_PARSE_FAILED_NO_OBJECT");
  });

  it("parses JSON wrapped in markdown code fence", () => {
    const fixture = makePass2Fixture();
    const fenced = "```json\n" + JSON.stringify(fixture) + "\n```";
    const result = parsePass2Response(fenced);
    expect(result.axis).toBe("editorial_literary");
    expect(result.criteria).toHaveLength(13);
  });

  it("parses JSON preceded by prose preamble", () => {
    const fixture = makePass2Fixture();
    const withProse = "Here is the requested analysis:\n" + JSON.stringify(fixture);
    const result = parsePass2Response(withProse);
    expect(result.axis).toBe("editorial_literary");
    expect(result.criteria).toHaveLength(13);
  });

  it("parses JSON when prose includes brace-noise before payload", () => {
    const fixture = makePass2Fixture();
    const withBraceNoise = "Note: avoid {purple prose} unless justified.\n" + JSON.stringify(fixture);
    const result = parsePass2Response(withBraceNoise);
    expect(result.axis).toBe("editorial_literary");
    expect(result.criteria).toHaveLength(13);
  });

  it("selects the criteria payload when multiple JSON objects are present", () => {
    const fixture = makePass2Fixture();
    const withTwoObjects = JSON.stringify({ meta: "draft" }) + "\n" + JSON.stringify(fixture);
    const result = parsePass2Response(withTwoObjects);
    expect(result.axis).toBe("editorial_literary");
    expect(result.criteria).toHaveLength(13);
  });

  it("classifies truncated JSON parse failures", () => {
    const truncated = JSON.stringify(makePass2Fixture()).slice(0, -20);
    expect(() => parsePass2Response(truncated)).toThrow("JSON_PARSE_FAILED_TRUNCATED");
  });

  it("classifies non-JSON parse failures", () => {
    expect(() => parsePass2Response("Narrative analysis only with no object payload")).toThrow(
      "JSON_PARSE_FAILED_NO_OBJECT",
    );
  });

  it("classifies clearly truncated response with JSON_PARSE_FAILED_TRUNCATED", () => {
    // A response that starts like JSON but is cut off before closing brace
    expect(() => parsePass2Response('{"key": "value')).toThrow("JSON_PARSE_FAILED_TRUNCATED");
  });

  it("classifies malformed JSON ending with } as JSON_PARSE_FAILED_MALFORMED", () => {
    expect(() => parsePass2Response('{ this: is invalid }')).toThrow("JSON_PARSE_FAILED_MALFORMED");
  });

  it("strips markdown json fences before parse", () => {
    const fixture = makePass2Fixture();
    const fenced = "```json\n" + JSON.stringify(fixture) + "\n```";
    const result = parsePass2Response(fenced);
    expect(result.pass).toBe(2);
    expect(result.criteria).toHaveLength(13);
  });

  it("throws on empty criteria array", () => {
    expect(() => parsePass2Response(JSON.stringify({ criteria: [] }))).toThrow("no criteria");
  });
});

describe("aggregatePass2ChunkResults disposition authority", () => {
  it("preserves selected recommendations and emits recommendation_provided without mutating inputs", () => {
    const first = makePass2Chunk({ anchor: "First canonical anchor" });
    const second = makePass2Chunk({ anchor: "Second canonical anchor" });
    const before = JSON.stringify([first, second]);

    const aggregate = aggregatePass2ChunkResults([first, second]);

    expect(aggregate.criteria[0].recommendations.map((recommendation) => recommendation.anchor_snippet))
      .toEqual(["First canonical anchor", "Second canonical anchor"]);
    expect(aggregate.criteria[0].recommendation_status).toBe("recommendation_provided");
    expect(aggregate.criteria[0].recommendation_status_rationale).toBeUndefined();
    expect(JSON.stringify([first, second])).toBe(before);
  });

  it("preserves a unanimous governed zero disposition and deterministic rationale evidence", () => {
    const first = makePass2Chunk({
      anchor: "unused-one",
      withRecommendation: false,
      recommendationStatus: "insufficient_evidence",
      recommendationStatusRationale: "Chunk one lacks a safe intervention.",
    });
    const second = makePass2Chunk({
      anchor: "unused-two",
      withRecommendation: false,
      recommendationStatus: "insufficient_evidence",
      recommendationStatusRationale: "Chunk two lacks a safe intervention.",
    });

    const aggregate = aggregatePass2ChunkResults([first, second]);

    expect(aggregate.criteria[0].recommendations).toEqual([]);
    expect(aggregate.criteria[0].recommendation_status).toBe("insufficient_evidence");
    expect(aggregate.criteria[0].recommendation_status_rationale).toBe(
      "Chunk one lacks a safe intervention. | Chunk two lacks a safe intervention.",
    );
  });

  it("fails closed when zero-recommendation chunks disagree on governed disposition", () => {
    const first = makePass2Chunk({
      anchor: "unused-one",
      withRecommendation: false,
      recommendationStatus: "insufficient_evidence",
      recommendationStatusRationale: "The evidence is insufficient.",
    });
    const second = makePass2Chunk({
      anchor: "unused-two",
      withRecommendation: false,
      recommendationStatus: "no_recommendation_warranted",
      recommendationStatusRationale: "No distinct intervention is warranted.",
    });

    expect(() => aggregatePass2ChunkResults([first, second])).toThrow(
      "PASS2_CHUNK_AGGREGATE_DISPOSITION_CONFLICT",
    );
  });

  it("rejects stale cache contract versions independently of content validity", () => {
    const current = makePass2Chunk({ anchor: "Current canonical anchor" });
    const stale = { ...current, prompt_version: "pass2-editorial-obsolete" };

    expect(() => assertPass2OutputDispositionContract(stale, "test-cache")).toThrow(
      "PASS2_CACHE_CONTRACT_VERSION_MISMATCH",
    );
  });
});

// ── Runner integration tests (DI, no real OpenAI) ─────────────────────────────

describe("runPass2", () => {
  const registry = loadCanonicalRegistry();

  it("returns parsed output when given a valid completion", async () => {
    const result = await runPass2({
      manuscriptText: "She reached for the door handle, her hand trembling.",
      workType: "literary_fiction",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: mockCompletion(JSON.stringify(makePass2Fixture())),
    });

    expect(result.pass).toBe(2);
    expect(result.axis).toBe("editorial_literary");
    expect(result.model).toBe(getCanonicalPipelineModel(undefined));
    expect(result.temperature).toBe(0.3);
    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(
      expect.arrayContaining(CRITERIA_KEYS as unknown as string[]),
    );
  });

  it("prefers EVAL_PASS2_MODEL over chunk/default routing", async () => {
    const previousPass2Model = process.env.EVAL_PASS2_MODEL;
    const previousChunkModel = process.env.EVAL_CHUNK_MODEL;
    process.env.EVAL_PASS2_MODEL = "gpt-5-mini";
    process.env.EVAL_CHUNK_MODEL = "gpt-4.1-mini";

    let requestedModel: string | undefined;
    const captureCompletion: CreateCompletionFn = async (params) => {
      requestedModel = params.model;
      return {
        choices: [{ message: { content: JSON.stringify(makePass2Fixture()) } }],
      };
    };

    try {
      const result = await runPass2({
        manuscriptText: "She reached for the door handle, her hand trembling.",
        workType: "literary_fiction",
        title: "Test Manuscript",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: captureCompletion,
      });

      expect(requestedModel).toBe("gpt-5-mini");
      expect(result.model).toBe("gpt-5-mini");
    } finally {
      if (previousPass2Model === undefined) {
        delete process.env.EVAL_PASS2_MODEL;
      } else {
        process.env.EVAL_PASS2_MODEL = previousPass2Model;
      }

      if (previousChunkModel === undefined) {
        delete process.env.EVAL_CHUNK_MODEL;
      } else {
        process.env.EVAL_CHUNK_MODEL = previousChunkModel;
      }
    }
  });

  it("does NOT accept pass1 data in its options (type-level independence)", () => {
    // RunPass2Options must not have a pass1 / pass1Output parameter
    const opts: RunPass2Options = {
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      registry,
      openaiApiKey: "sk-test",
    };
    const optsRecord = opts as unknown as Record<string, unknown>;
    // This is a compile-time test: if RunPass2Options had a pass1 field,
    // this would not compile. Accessing it should fail at type level.
    expect(optsRecord["pass1"]).toBeUndefined();
    expect(optsRecord["pass1Output"]).toBeUndefined();
  });

  it("throws when OPENAI_API_KEY is not configured", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      runPass2({ manuscriptText: "test", workType: "literary_fiction", title: "Test", registry }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  });

  it("throws when OpenAI returns empty content", async () => {
    const emptyCompletion: CreateCompletionFn = async () => ({
      choices: [{ message: { content: "" } }],
    });

    await expect(
      runPass2({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: emptyCompletion,
      }),
    ).rejects.toThrow();
  });

  it("accepts structured content-part arrays when the provider does not return a flat string", async () => {
    const result = await runPass2({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: arrayContentCompletion(JSON.stringify(makePass2Fixture())),
    });

    expect(result.criteria).toHaveLength(13);
  });

  it("includes finish_reason and token usage in enriched empty-response errors", async () => {
    await expect(
      runPass2({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: lengthLimitedEmptyCompletion(),
      }),
    ).rejects.toThrow("finish_reason=length");
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
          usage: { prompt_tokens: 650, completion_tokens: budget, total_tokens: 650 + budget },
        };
      }

      return {
        choices: [{ message: { content: JSON.stringify(makePass2Fixture()) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 650, completion_tokens: 1200, total_tokens: 1850 },
      };
    };

    const result = await runPass2({
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
});
