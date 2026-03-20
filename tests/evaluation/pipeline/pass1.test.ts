/**
 * Phase 2.7 — Pass 1 Runner Tests
 *
 * Mocks OpenAI to validate SinglePassOutput shape and error handling.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

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

import { runPass1 } from "@/lib/evaluation/pipeline/runPass1";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runPass1", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns a valid SinglePassOutput with all 13 criteria", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(makePass1Fixture()) } }],
    });

    const result = await runPass1({
      manuscriptText: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "Test Manuscript",
      openaiApiKey: "sk-test",
    });

    expect(result.pass).toBe(1);
    expect(result.axis).toBe("craft_execution");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.temperature).toBe(0.3);
    expect(result.criteria).toHaveLength(13);
    expect(result.criteria.map((c) => c.key)).toEqual(expect.arrayContaining(CRITERIA_KEYS as unknown as string[]));
  });

  it("clips scores to integer 0-10 range", async () => {
    const fixture = makePass1Fixture();
    fixture.criteria[0].score_0_10 = 15; // out of range
    fixture.criteria[1].score_0_10 = -3; // out of range

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(fixture) } }],
    });

    const result = await runPass1({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    expect(result.criteria[0].score_0_10).toBe(10);
    expect(result.criteria[1].score_0_10).toBe(0);
  });

  it("throws when OPENAI_API_KEY is not configured", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      runPass1({ manuscriptText: "test", workType: "literary_fiction", title: "Test" }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  });

  it("throws when OpenAI returns empty content", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    await expect(
      runPass1({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        openaiApiKey: "sk-test",
      }),
    ).rejects.toThrow("Empty response from OpenAI");
  });

  it("filters out criteria with unknown keys", async () => {
    const fixture = makePass1Fixture();
    // Inject an unknown key
    fixture.criteria.push({
      key: "FAKE_CRITERION" as never,
      score_0_10: 8,
      rationale: "This should be filtered.",
      evidence: [],
      recommendations: [],
    });

    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(fixture) } }],
    });

    const result = await runPass1({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    expect(result.criteria.every((c) => (CRITERIA_KEYS as readonly string[]).includes(c.key))).toBe(true);
  });
});
