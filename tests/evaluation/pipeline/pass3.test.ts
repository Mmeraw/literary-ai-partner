/**
 * Phase 2.7 — Pass 3 Synthesis Tests
 *
 * Tests the parsePass3Response pure function directly (no OpenAI mock needed).
 * Also tests runPass3Synthesis with dependency-injected completion function.
 */

import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { parsePass3Response, runPass3Synthesis } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { CreateCompletionFn } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

function makePass3Fixture(overrides: Record<string, unknown> = {}) {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 6,
      final_score_0_10: 7,
      delta_explanation: undefined,
      final_rationale: `Synthesized analysis for ${key} combining both axes.`,
      evidence: [{ snippet: "The river moved slowly." }],
      recommendations: [
        {
          priority: "medium",
          action: `Refine the ${key} dimension to achieve stronger integration between craft and editorial goals.`,
          expected_impact: "Elevates overall quality.",
          anchor_snippet: '"slowly"',
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "This manuscript shows strong potential but needs targeted revision before submission.",
      top_3_strengths: ["Strong voice", "Clear arc", "Vivid imagery"],
      top_3_risks: ["Pacing gaps", "Thin character motivation", "Weak world-building"],
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
    },
    ...overrides,
  };
}

/** Helper: build a mock completion function that returns the given JSON string. */
function mockCompletion(responseJson: string): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: responseJson } }],
  });
}

/** Helper: build a mock completion function that returns null content. */
function nullCompletion(): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: null } }],
  });
}

/** Helper: build a mock completion function that returns content parts rather than a flat string. */
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

/** Helper: build a mock completion function that returns an empty response with finish metadata. */
function lengthLimitedEmptyCompletion(): CreateCompletionFn {
  return async () => ({
    choices: [{ message: { content: null }, finish_reason: "length" }],
    usage: { prompt_tokens: 1234, completion_tokens: 8000, total_tokens: 9234 },
  });
}

// ── Pure parser tests ─────────────────────────────────────────────────────────

describe("parsePass3Response", () => {
  const pass1 = makePassOutput(1, "craft_execution");
  const pass2 = makePassOutput(2, "editorial_literary");

  it("returns a valid SynthesisOutput with all 13 criteria", () => {
    const result = parsePass3Response(JSON.stringify(makePass3Fixture()), pass1, pass2);

    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(
      expect.arrayContaining(CRITERIA_KEYS as unknown as string[]),
    );
    expect(result.overall.overall_score_0_100).toBe(70);
    expect(result.overall.verdict).toBe("revise");
    expect(result.metadata.pass1_model).toBe("gpt-4o-mini");
  });

  it("clips overall_score_0_100 to 0-100 range", () => {
    const fixture = makePass3Fixture({
      overall: {
        overall_score_0_100: 150,
        verdict: "pass",
        one_paragraph_summary: "Good.",
        top_3_strengths: [],
        top_3_risks: [],
      },
    });

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    expect(result.overall.overall_score_0_100).toBe(100);
  });

  it("falls back to averaging pass scores when AI omits final_score_0_10", () => {
    const fixture = makePass3Fixture();
    // Remove final_score_0_10 from first criterion so fallback triggers
    const first = { ...fixture.criteria[0] };
    delete (first as Record<string, unknown>)["final_score_0_10"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    // First criterion should fallback to avg of craft/editorial
    expect(result.criteria[0].final_score_0_10).toBeGreaterThanOrEqual(0);
    expect(result.criteria[0].final_score_0_10).toBeLessThanOrEqual(10);
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePass3Response("not json", pass1, pass2)).toThrow("not valid JSON");
  });

  it("provides delta_explanation when score_delta > 2", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0].craft_score = 9;
    fixture.criteria[0].editorial_score = 3;
    fixture.criteria[0].delta_explanation = "Craft is strong but editorial insight is weak.";

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);

    expect(result.criteria[0].score_delta).toBe(6);
    expect(result.criteria[0].delta_explanation).toBeDefined();
  });
});

// ── Runner integration tests (DI, no real OpenAI) ─────────────────────────────

describe("runPass3Synthesis", () => {
  const registry = loadCanonicalRegistry();

  it("returns parsed synthesis when given a valid completion", async () => {
    const pass1 = makePassOutput(1, "craft_execution");
    const pass2 = makePassOutput(2, "editorial_literary");

    const result = await runPass3Synthesis({
      pass1,
      pass2,
      manuscriptText: "The river moved slowly through the valley.",
      title: "Test Manuscript",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: mockCompletion(JSON.stringify(makePass3Fixture())),
    });

    expect(result.criteria).toHaveLength(13);
    expect(result.overall.overall_score_0_100).toBe(70);
    expect(result.overall.verdict).toBe("revise");
  });

  it("throws when OPENAI_API_KEY is not configured", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      runPass3Synthesis({
        pass1: makePassOutput(1, "craft_execution"),
        pass2: makePassOutput(2, "editorial_literary"),
        manuscriptText: "test",
        title: "Test",
        registry,
      }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  });

  it("throws when OpenAI returns empty content", async () => {
    await expect(
      runPass3Synthesis({
        pass1: makePassOutput(1, "craft_execution"),
        pass2: makePassOutput(2, "editorial_literary"),
        manuscriptText: "test",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: nullCompletion(),
      }),
    ).rejects.toThrow("Empty response from OpenAI");
  });

  it("accepts content-part arrays when the provider returns structured content", async () => {
    const result = await runPass3Synthesis({
      pass1: makePassOutput(1, "craft_execution"),
      pass2: makePassOutput(2, "editorial_literary"),
      manuscriptText: "test",
      title: "Test",
      registry,
      openaiApiKey: "sk-test",
      _createCompletion: arrayContentCompletion(JSON.stringify(makePass3Fixture())),
    });

    expect(result.criteria).toHaveLength(13);
    expect(result.overall.verdict).toBe("revise");
  });

  it("surfaces finish_reason and token metadata when the response is empty", async () => {
    await expect(
      runPass3Synthesis({
        pass1: makePassOutput(1, "craft_execution"),
        pass2: makePassOutput(2, "editorial_literary"),
        manuscriptText: "test",
        title: "Test",
        registry,
        openaiApiKey: "sk-test",
        _createCompletion: lengthLimitedEmptyCompletion(),
      }),
    ).rejects.toThrow("finish_reason=length");
  });
});

// ── Consequence tracking contract tests ──────────────────────────────────────

describe("consequence tracking contract", () => {
  const pass1 = makePassOutput(1, "craft_execution");
  const pass2 = makePassOutput(2, "editorial_literary");

  it("extracts AI-provided pressure_points and decision_points", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      pressure_points: ["Tension builds through repeated failures.", "Stakes escalate in final confrontation."],
      decision_points: ["Character commits despite withdrawal option."],
      consequence_status: "landed",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    const first = result.criteria[0];

    expect(first.pressure_points).toEqual([
      "Tension builds through repeated failures.",
      "Stakes escalate in final confrontation.",
    ]);
    expect(first.decision_points).toEqual(["Character commits despite withdrawal option."]);
  });

  it("passes through 'landed' consequence_status and leaves deferred_consequence_risk undefined", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      pressure_points: ["Mild tension."],
      decision_points: ["Resolved cleanly."],
      consequence_status: "landed",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("landed");
    expect(result.criteria[0].deferred_consequence_risk).toBeUndefined();
  });

  it("passes through 'deferred' and uses AI-provided deferred_consequence_risk", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      pressure_points: ["Unresolved tension lingers."],
      decision_points: ["No resolution reached."],
      consequence_status: "deferred",
      deferred_consequence_risk: "Risk: unresolved arc may undermine final chapter payoff.",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("deferred");
    expect(result.criteria[0].deferred_consequence_risk).toBe(
      "Risk: unresolved arc may undermine final chapter payoff.",
    );
  });

  it("auto-fills deferred_consequence_risk when AI sets status to 'deferred' but omits the risk field", () => {
    const fixture = makePass3Fixture();
    const first = { ...fixture.criteria[0], consequence_status: "deferred" };
    delete (first as Record<string, unknown>)["deferred_consequence_risk"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("deferred");
    expect(result.criteria[0].deferred_consequence_risk).toBeDefined();
    expect(result.criteria[0].deferred_consequence_risk!.length).toBeGreaterThan(0);
  });

  it("passes through 'dissipated' and clears deferred_consequence_risk", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      pressure_points: ["Pressure arose but was neutralized."],
      decision_points: ["Tension dispersed without payoff."],
      consequence_status: "dissipated",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("dissipated");
    expect(result.criteria[0].deferred_consequence_risk).toBeUndefined();
  });

  it("falls back to heuristic 'deferred' when score_delta >= 3 and consequence_status is unrecognized", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      craft_score: 9,
      editorial_score: 5,
      final_score_0_10: 7,
      consequence_status: "unknown_value",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].score_delta).toBeGreaterThanOrEqual(3);
    expect(result.criteria[0].consequence_status).toBe("deferred");
    expect(result.criteria[0].deferred_consequence_risk).toBeDefined();
  });

  it("falls back to heuristic 'dissipated' when final_score <= 4 and consequence_status is unrecognized", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      craft_score: 4,
      editorial_score: 4,
      final_score_0_10: 3,
      consequence_status: "",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("dissipated");
    expect(result.criteria[0].deferred_consequence_risk).toBeUndefined();
  });

  it("falls back to heuristic 'landed' when score is healthy and consequence_status is unrecognized", () => {
    const fixture = makePass3Fixture();
    fixture.criteria[0] = {
      ...fixture.criteria[0],
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      consequence_status: "INVALID",
    } as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].consequence_status).toBe("landed");
    expect(result.criteria[0].deferred_consequence_risk).toBeUndefined();
  });

  it("generates fallback pressure_points when AI omits them", () => {
    const fixture = makePass3Fixture();
    const first = { ...fixture.criteria[0] };
    delete (first as Record<string, unknown>)["pressure_points"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].pressure_points).toHaveLength(1);
    expect(result.criteria[0].pressure_points[0].length).toBeGreaterThan(0);
  });

  it("generates fallback decision_points when AI omits them", () => {
    const fixture = makePass3Fixture();
    const first = { ...fixture.criteria[0] };
    delete (first as Record<string, unknown>)["decision_points"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    const result = parsePass3Response(JSON.stringify(fixture), pass1, pass2);
    expect(result.criteria[0].decision_points).toHaveLength(1);
    expect(result.criteria[0].decision_points[0].length).toBeGreaterThan(0);
  });
});
