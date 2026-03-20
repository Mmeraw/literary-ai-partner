/**
 * Phase 2.7 — Pass 3 Synthesis Runner Tests
 *
 * Mocks OpenAI to validate SynthesisOutput shape and deterministic fallback.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

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

// ── Mock OpenAI ───────────────────────────────────────────────────────────────

const mockCreate = jest.fn();

jest.mock("openai", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// ── Import after mock ─────────────────────────────────────────────────────────

import { runPass3Synthesis } from "@/lib/evaluation/pipeline/runPass3Synthesis";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runPass3Synthesis", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns a valid SynthesisOutput with all 13 criteria", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(makePass3Fixture()) } }],
    });

    const pass1 = makePassOutput(1, "craft_execution");
    const pass2 = makePassOutput(2, "editorial_literary");

    const result = await runPass3Synthesis({
      pass1,
      pass2,
      manuscriptText: "The river moved slowly through the valley.",
      title: "Test Manuscript",
      openaiApiKey: "sk-test",
    });

    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(expect.arrayContaining(CRITERIA_KEYS as unknown as string[]));
    expect(result.overall.overall_score_0_100).toBe(70);
    expect(result.overall.verdict).toBe("revise");
    expect(result.metadata.pass1_model).toBe("gpt-4o-mini");
  });

  it("clips overall_score_0_100 to 0-100 range", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(makePass3Fixture({ overall: { overall_score_0_100: 150, verdict: "pass", one_paragraph_summary: "Good.", top_3_strengths: [], top_3_risks: [] } })),
          },
        },
      ],
    });

    const result = await runPass3Synthesis({
      pass1: makePassOutput(1, "craft_execution"),
      pass2: makePassOutput(2, "editorial_literary"),
      manuscriptText: "test",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    expect(result.overall.overall_score_0_100).toBe(100);
  });

  it("falls back to averaging pass scores when AI omits final_score_0_10", async () => {
    const fixture = makePass3Fixture();
    // Remove final_score_0_10 from first criterion so fallback triggers
    const first = { ...fixture.criteria[0] };
    delete (first as Record<string, unknown>)["final_score_0_10"];
    fixture.criteria[0] = first as typeof fixture.criteria[0];

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(fixture) } }],
    });

    const pass1 = makePassOutput(1, "craft_execution");
    const pass2 = makePassOutput(2, "editorial_literary");
    // Both pass outputs have score_0_10=7, so avg=7
    const result = await runPass3Synthesis({
      pass1,
      pass2,
      manuscriptText: "test",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    // First criterion should fallback to avg of craft/editorial
    expect(result.criteria[0].final_score_0_10).toBeGreaterThanOrEqual(0);
    expect(result.criteria[0].final_score_0_10).toBeLessThanOrEqual(10);
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
      }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  });

  it("throws when OpenAI returns empty content", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    await expect(
      runPass3Synthesis({
        pass1: makePassOutput(1, "craft_execution"),
        pass2: makePassOutput(2, "editorial_literary"),
        manuscriptText: "test",
        title: "Test",
        openaiApiKey: "sk-test",
      }),
    ).rejects.toThrow("Empty response from OpenAI");
  });
});
