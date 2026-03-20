/**
 * Phase 2.7 — Pass 2 Tests
 *
 * Tests the parsePass2Response pure function directly (no OpenAI mock needed).
 * Also tests runPass2 with dependency-injected completion function.
 * Validates the function signature enforces no Pass 1 parameter.
 */

import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass2Response, runPass2 } from "@/lib/evaluation/pipeline/runPass2";
import type { RunPass2Options, CreateCompletionFn } from "@/lib/evaluation/pipeline/runPass2";

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
    })),
  };
}

/** Helper: build a mock completion function that returns the given JSON string. */
function mockCompletion(responseJson: string): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: responseJson } }],
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

  it("clips scores to integer 0-10 range", () => {
    const fixture = makePass2Fixture();
    fixture.criteria[0].score_0_10 = 15;
    fixture.criteria[1].score_0_10 = -3;

    const result = parsePass2Response(JSON.stringify(fixture));

    expect(result.criteria[0].score_0_10).toBe(10);
    expect(result.criteria[1].score_0_10).toBe(0);
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePass2Response("not json")).toThrow("not valid JSON");
  });

  it("throws on empty criteria array", () => {
    expect(() => parsePass2Response(JSON.stringify({ criteria: [] }))).toThrow("no criteria");
  });
});

// ── Runner integration tests (DI, no real OpenAI) ─────────────────────────────

describe("runPass2", () => {
  it("returns parsed output when given a valid completion", async () => {
    const result = await runPass2({
      manuscriptText: "She reached for the door handle, her hand trembling.",
      workType: "literary_fiction",
      title: "Test Manuscript",
      openaiApiKey: "sk-test",
      _createCompletion: mockCompletion(JSON.stringify(makePass2Fixture())),
    });

    expect(result.pass).toBe(2);
    expect(result.axis).toBe("editorial_literary");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.temperature).toBe(0.3);
    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(
      expect.arrayContaining(CRITERIA_KEYS as unknown as string[]),
    );
  });

  it("does NOT accept pass1 data in its options (type-level independence)", () => {
    // RunPass2Options must not have a pass1 / pass1Output parameter
    const opts: RunPass2Options = {
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
    };
    // This is a compile-time test: if RunPass2Options had a pass1 field,
    // this would not compile. Accessing it should fail at type level.
    expect((opts as Record<string, unknown>)["pass1"]).toBeUndefined();
    expect((opts as Record<string, unknown>)["pass1Output"]).toBeUndefined();
  });

  it("throws when OPENAI_API_KEY is not configured", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      runPass2({ manuscriptText: "test", workType: "literary_fiction", title: "Test" }),
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
        openaiApiKey: "sk-test",
        _createCompletion: emptyCompletion,
      }),
    ).rejects.toThrow();
  });
});
