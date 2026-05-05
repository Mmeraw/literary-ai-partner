import { describe, expect, test } from "@jest/globals";
import { computeCriterionConfidence } from "@/lib/evaluation/pipeline/criterionConfidence";

describe("score-confidence reconciliation", () => {
  test("upgrades evidence-supported high-score criteria out of low confidence", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      score_0_10: 8,
      final_rationale:
        "Prose syntax and cadence control reader immersion through concrete sentence-level rhythm.",
      evidence: [
        {
          snippet:
            "The sentence cadence narrows into a controlled line of river imagery and pressure.",
        },
      ],
      recommendations: [
        {
          action:
            "Revise the paragraph-level syntax so the strongest cadence carries through the full scene turn.",
          anchor_snippet:
            "The sentence cadence narrows into a controlled line of river imagery and pressure.",
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
