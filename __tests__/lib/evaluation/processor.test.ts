const {
  normalizeCriteria,
  normalizeOverviewFromAIResult,
  normalizeRecommendationsFromAIResult,
} = require("../../../lib/evaluation/processor");
const { CRITERIA_KEYS } = require("../../../schemas/criteria-keys");

function buildCriterion(key: string, score: number) {
  return {
    key,
    score_0_10: score,
    rationale: `Rationale for ${key}`,
    evidence: [
      {
        snippet: `Evidence for ${key}`,
      },
    ],
    recommendations: [
      {
        priority: "medium",
        action: `Improve ${key}`,
        expected_impact: "Better quality",
      },
    ],
  };
}

describe("normalizeCriteria", () => {
  test("normalizes object keyed by canonical criteria into ordered 13-item array", () => {
    const input = Object.fromEntries(
      [...CRITERIA_KEYS].reverse().map((key, idx) => [
        key,
        {
          score_0_10: (idx % 10) + 1,
          rationale: `Object rationale ${key}`,
          evidence: [{ snippet: `Object evidence ${key}` }],
          recommendations: [
            {
              priority: "high",
              action: `Object action ${key}`,
              expected_impact: "Object impact",
            },
          ],
        },
      ])
    );

    const output = normalizeCriteria(input);

    expect(output).toHaveLength(13);
    expect(output.map((c: any) => c.key)).toEqual(CRITERIA_KEYS);
    expect(output[0].score_0_10).toBeGreaterThan(0);
  });

  test("normalizes shuffled array order into canonical CRITERIA_KEYS order", () => {
    const shuffled = [...CRITERIA_KEYS]
      .slice()
      .reverse()
      .map((key, idx) => buildCriterion(key, (idx % 10) + 1));

    const output = normalizeCriteria(shuffled);

    expect(output).toHaveLength(13);
    expect(output.map((c: any) => c.key)).toEqual(CRITERIA_KEYS);
  });

  test("returns [] when any canonical key is missing (fail-closed)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    const incomplete = Object.fromEntries(
      CRITERIA_KEYS.filter((key: string) => key !== "tone").map((key: string, idx: number) => [
        key,
        {
          score_0_10: (idx % 10) + 1,
          rationale: `Rationale ${key}`,
        },
      ])
    );

    const output = normalizeCriteria(incomplete);

    expect(output).toEqual([]);

    warn.mockRestore();
  });

  test("accepts legacy score field as number string and normalizes to score_0_10", () => {
    const input = Object.fromEntries(
      CRITERIA_KEYS.map((key: string) => [
        key,
        {
          score: "7/10",
          rationale: `Rationale ${key}`,
          evidence: [{ snippet: `Evidence ${key}` }],
          recommendations: [
            {
              priority: "medium",
              action: `Action ${key}`,
              expected_impact: `Impact ${key}`,
            },
          ],
        },
      ])
    );

    const output = normalizeCriteria(input);

    expect(output).toHaveLength(13);
    expect(output.every((c: any) => c.score_0_10 === 7)).toBe(true);
  });

  test("clamps out-of-range criterion scores", () => {
    const input = Object.fromEntries(
      CRITERIA_KEYS.map((key: string, idx: number) => [
        key,
        {
          score_0_10: idx % 2 === 0 ? 999 : -8,
          rationale: `Rationale ${key}`,
        },
      ])
    );

    const output = normalizeCriteria(input);

    expect(output).toHaveLength(13);
    expect(output.every((c: any) => c.score_0_10 >= 0 && c.score_0_10 <= 10)).toBe(true);
  });
});

describe("normalizeOverviewFromAIResult", () => {
  test("supports top-level legacy shape and string overview", () => {
    const output = normalizeOverviewFromAIResult({
      verdict: "PASS",
      overall_score_0_100: "88",
      overview: "Strong narrative voice with commercial upside.",
      strengths: ["Voice", "Premise", "Pacing"],
      risks: ["Ending"],
    });

    expect(output.verdict).toBe("pass");
    expect(output.overall_score_0_100).toBe(88);
    expect(output.one_paragraph_summary).toMatch(/Strong narrative voice/);
    expect(output.top_3_strengths).toEqual(["Voice", "Premise", "Pacing"]);
    expect(output.top_3_risks).toEqual(["Ending"]);
  });

  test("falls back safely when overview fields are missing", () => {
    const output = normalizeOverviewFromAIResult({});

    expect(output.verdict).toBe("revise");
    expect(output.overall_score_0_100).toBe(70);
    expect(output.one_paragraph_summary).toBe("No summary available.");
  });
});

describe("normalizeRecommendationsFromAIResult", () => {
  test("maps suggestion/reason legacy fields to action/why", () => {
    const output = normalizeRecommendationsFromAIResult({
      recommendations: {
        quick_wins: [
          {
            suggestion: "Trim opening by 10%",
            reason: "Improves hook density",
            effort: "low",
            impact: "high",
          },
        ],
        strategic_revisions: [
          {
            action: "Reframe midpoint reversal",
            why: "Sharper causality",
            effort: "medium",
            impact: "high",
          },
        ],
      },
    });

    expect(output.quick_wins).toHaveLength(1);
    expect(output.quick_wins[0]).toEqual({
      action: "Trim opening by 10%",
      why: "Improves hook density",
      effort: "low",
      impact: "high",
    });
    expect(output.strategic_revisions).toHaveLength(1);
  });
});
