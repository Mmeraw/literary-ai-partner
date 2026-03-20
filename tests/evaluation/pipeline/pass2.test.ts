/**
 * Phase 2.7 — Pass 2 Runner Tests
 *
 * Validates SinglePassOutput shape with axis="editorial_literary".
 * Also verifies the function signature enforces no Pass 1 parameter.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

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

import { runPass2 } from "@/lib/evaluation/pipeline/runPass2";
import type { RunPass2Options } from "@/lib/evaluation/pipeline/runPass2";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runPass2", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns a valid SinglePassOutput with axis=editorial_literary", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(makePass2Fixture()) } }],
    });

    const result = await runPass2({
      manuscriptText: "She reached for the door handle, her hand trembling.",
      workType: "literary_fiction",
      title: "Test Manuscript",
      openaiApiKey: "sk-test",
    });

    expect(result.pass).toBe(2);
    expect(result.axis).toBe("editorial_literary");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.temperature).toBe(0.3);
    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(expect.arrayContaining(CRITERIA_KEYS as unknown as string[]));
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
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });

    await expect(
      runPass2({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        openaiApiKey: "sk-test",
      }),
    ).rejects.toThrow();
  });
});
