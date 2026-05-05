import { describe, expect, test } from "@jest/globals";
import { computeCriterionConfidence } from "@/lib/evaluation/pipeline/criterionConfidence";

// ...unchanged above...

describe("computeCriterionConfidence — quality signals", () => {
  test("source-matched anchors increase confidence", () => {
    const sourceText =
      "The river remembers everything, even when we forget. Glass towers caught fire in the dusk.";

    const input = {
      key: "voice" as const,
      final_score_0_10: 7,
      final_rationale:
        "Voice diction and cadence sustain consistent register for the reader.",
      evidence: [{ snippet: "The river remembers everything." }],
    };

    const withSource = computeCriterionConfidence(input, sourceText);
    const withoutSource = computeCriterionConfidence(input);

    expect(withSource.confidence_score_0_100).toBeGreaterThanOrEqual(
      withoutSource.confidence_score_0_100,
    );
  });

  // rest unchanged
});
