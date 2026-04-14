const {
  normalizeCriteria,
  normalizeOverviewFromAIResult,
  normalizeRecommendationsFromAIResult,
  isManuscriptTextLongEnough,
  getCalibrationProfile,
  assessEvaluationQuality,
  getValidatedWorkerBatchSize,
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

function buildCriteriaSet(scoreByIndex?: (idx: number) => number, withEvidence = true) {
  return CRITERIA_KEYS.map((key: string, idx: number) => ({
    key,
    score_0_10: scoreByIndex ? scoreByIndex(idx) : 7,
    rationale: `Rationale ${key}`,
    evidence: withEvidence
      ? [{ snippet: `Concrete evidence snippet for ${key} with enough detail.` }]
      : [],
    recommendations: [
      {
        priority: "medium",
        action: `Improve ${key}`,
        expected_impact: "Improves quality",
      },
    ],
  }));
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

  test("aggregates diagnostics for legacy/missing/clamped score handling", () => {
    const diagnostics = {
      usedLegacyScoreCount: 0,
      missingScoreCount: 0,
      clampedScoreCount: 0,
      overviewFallbackUsed: false,
      recommendationsFallbackUsed: false,
    };

    const input = Object.fromEntries(
      CRITERIA_KEYS.map((key: string, idx: number) => {
        if (idx < 5) {
          return [
            key,
            {
              score: "7/10",
              rationale: `Rationale ${key}`,
            },
          ];
        }

        if (idx < 9) {
          return [
            key,
            {
              score_0_10: 42,
              rationale: `Rationale ${key}`,
            },
          ];
        }

        return [
          key,
          {
            rationale: `Rationale ${key}`,
          },
        ];
      })
    );

    const output = normalizeCriteria(input, diagnostics);

    expect(output).toHaveLength(13);
    expect(diagnostics.usedLegacyScoreCount).toBe(5);
    expect(diagnostics.clampedScoreCount).toBe(4);
    expect(diagnostics.missingScoreCount).toBe(4);
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
    const diagnostics = {
      usedLegacyScoreCount: 0,
      missingScoreCount: 0,
      clampedScoreCount: 0,
      overviewFallbackUsed: false,
      recommendationsFallbackUsed: false,
    };
    const output = normalizeOverviewFromAIResult({}, diagnostics);

    expect(output.verdict).toBe("revise");
    expect(output.overall_score_0_100).toBe(70);
    expect(output.one_paragraph_summary).toBe("No summary available.");
    expect(diagnostics.overviewFallbackUsed).toBe(true);
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

  test("flags recommendation fallback when nothing usable is present", () => {
    const diagnostics = {
      usedLegacyScoreCount: 0,
      missingScoreCount: 0,
      clampedScoreCount: 0,
      overviewFallbackUsed: false,
      recommendationsFallbackUsed: false,
    };

    const output = normalizeRecommendationsFromAIResult({}, diagnostics);

    expect(output.quick_wins).toEqual([]);
    expect(output.strategic_revisions).toEqual([]);
    expect(diagnostics.recommendationsFallbackUsed).toBe(true);
  });
});

describe("isManuscriptTextLongEnough", () => {
  test("returns false for short text and true at threshold", () => {
    expect(isManuscriptTextLongEnough("one two three", 5)).toBe(false);
    expect(isManuscriptTextLongEnough("one two three four five", 5)).toBe(true);
    expect(isManuscriptTextLongEnough("  one   two   three   four   five  ", 5)).toBe(true);
  });
});

describe("getCalibrationProfile", () => {
  test("returns memoir profile for memoir work type", () => {
    const profile = getCalibrationProfile("Memoir");
    expect(profile.policyFamily).toBe("memoir");
    expect(profile.guidance.toLowerCase()).toContain("memoir");
  });

  test("returns poetry profile for poetry work type", () => {
    const profile = getCalibrationProfile("poetry");
    expect(profile.policyFamily).toBe("poetry");
  });

  test("falls back to standard profile", () => {
    const profile = getCalibrationProfile("novel");
    expect(profile.policyFamily).toBe("standard");
  });
});

describe("assessEvaluationQuality", () => {
  test("flags low-evidence and uniform-score patterns with confidence penalty", () => {
    const criteria = buildCriteriaSet(() => 7, false);
    const quality = assessEvaluationQuality(criteria);

    expect(quality.hasUniformScores).toBe(true);
    expect(quality.evidenceCoverageRatio).toBe(0);
    expect(quality.confidencePenalty).toBeGreaterThan(0);
    expect(quality.warnings.length).toBeGreaterThan(0);
  });

  test("keeps penalty near zero for healthy evidence and score spread", () => {
    const criteria = buildCriteriaSet((idx: number) => 3 + (idx % 6), true);
    const quality = assessEvaluationQuality(criteria);

    expect(quality.hasUniformScores).toBe(false);
    expect(quality.scoreSpread).toBeGreaterThan(1.5);
    expect(quality.evidenceCoverageRatio).toBe(1);
    expect(quality.confidencePenalty).toBe(0);
  });
});

describe("getValidatedWorkerBatchSize", () => {
  test("clamps invalid values to fallback", () => {
    expect(getValidatedWorkerBatchSize(undefined, 1)).toBe(1);
    expect(getValidatedWorkerBatchSize("0", 2)).toBe(2);
    expect(getValidatedWorkerBatchSize("999", 2)).toBe(2);
    expect(getValidatedWorkerBatchSize("not-a-number", 3)).toBe(3);
  });

  test("accepts bounded integer values", () => {
    expect(getValidatedWorkerBatchSize(1, 3)).toBe(1);
    expect(getValidatedWorkerBatchSize("5", 1)).toBe(5);
    expect(getValidatedWorkerBatchSize(3.9, 1)).toBe(3);
  });
});
