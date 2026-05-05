import { describe, expect, test } from "@jest/globals";
import { computeCriterionConfidence } from "@/lib/evaluation/pipeline/criterionConfidence";

describe("score-confidence reconciliation", () => {
  test("upgrades evidence-supported high-score criteria out of low confidence", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      score_0_10: 8,
      final_rationale:
        "Prose syntax generally controls sentence cadence.",
      evidence: [
        {
          snippet:
            "The chapter is effective prose with sentence cadence and a controlled line of pressure.",
        },
      ],
      recommendations: [
        {
          action:
            "Revise the paragraph-level syntax so the strongest cadence carries through the full scene turn.",
          anchor_snippet:
            "The chapter is effective prose with sentence cadence and a controlled line of pressure.",
        },
      ],
    });

    expect(result.confidence_level).toBe("moderate");
    expect(result.confidence_score_0_100).toBeGreaterThanOrEqual(60);
    expect(result.confidence_reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Score-confidence reconciled to moderate/i),
      ]),
    );
  });

  test("preserves unsupported high-score low-confidence contradictions for QualityGateV2", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      score_0_10: 8,
      final_rationale: "Prose works well overall.",
      evidence: [],
      recommendations: [{ action: "Improve the prose." }],
    });

    expect(result.confidence_level).toBe("low");
    expect(result.confidence_reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/contradiction preserved for QualityGateV2/i),
      ]),
    );
  });
});
