import { describe, expect, test } from "@jest/globals";
import { computeCriterionConfidence } from "@/lib/evaluation/pipeline/criterionConfidence";

describe("computeCriterionConfidence — canonical field recognition", () => {
  test("recognizes canonical evidence[].snippet field", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 7,
      final_rationale:
        "Sentence cadence and imagery sustain reader immersion across the opening.",
      evidence: [{ snippet: "The river turned, and with it, the light." }],
    });

    expect(result.confidence_score_0_100).toBeGreaterThan(0);
    expect(result.scorability_status).not.toBe("non_scorable");
  });

  test("recognizes canonical recommendations[].anchor_snippet field", () => {
    const withAnchor = computeCriterionConfidence({
      key: "narrativeDrive",
      final_score_0_10: 6,
      final_rationale:
        "Momentum drags because scene goals are not clearly escalated for the reader.",
      evidence: [{ snippet: "She watched the water for a long time." }],
      recommendations: [
        {
          action:
            "Give the narrator a concrete scene goal in the opening that fails by page three.",
          anchor_snippet: "She watched the water for a long time.",
        },
      ],
    });

    const withoutAnchor = computeCriterionConfidence({
      key: "narrativeDrive",
      final_score_0_10: 6,
      final_rationale:
        "Momentum drags because scene goals are not clearly escalated for the reader.",
      evidence: [{ snippet: "She watched the water for a long time." }],
      recommendations: [{ action: "Improve the writing." }],
    });

    expect(withAnchor.confidence_score_0_100).toBeGreaterThan(
      withoutAnchor.confidence_score_0_100,
    );
  });
});

describe("computeCriterionConfidence — bucket boundaries", () => {
  test("0 anchors -> low confidence", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 8,
      final_rationale: "Strong imagery and rhythm.",
      evidence: [],
    });

    expect(result.confidence_level).toBe("low");
    expect(result.confidence_score_0_100).toBeLessThan(60);
  });

  test("1 weak anchor stays below high", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 7,
      final_rationale: "Prose works well overall.",
      evidence: [{ snippet: "The chapter is effective." }],
    });

    expect(result.confidence_level).not.toBe("high");
    expect(result.confidence_score_0_100).toBeLessThan(85);
  });

  test("2 strong anchors can reach high confidence", () => {
    const sourceText =
      "The river remembers everything, even when we forget. Glass towers caught fire in the dusk.";

    const result = computeCriterionConfidence(
      {
        key: "voice",
        final_score_0_10: 8,
        final_rationale:
          "Voice diction and cadence sustain consistent register and improve reader immersion.",
        evidence: [
          { snippet: "The river remembers everything, even when we forget." },
          { snippet: "Glass towers caught fire in the dusk." },
        ],
        recommendations: [
          {
            action:
              "Keep this cadence in tense scenes and trim decorative qualifiers where urgency drops.",
            anchor_snippet: "Glass towers caught fire in the dusk.",
          },
        ],
      },
      sourceText,
    );

    expect(result.confidence_level).toBe("high");
  });
});

describe("computeCriterionConfidence — quality signals", () => {
  test("source-matched anchors do not reduce confidence", () => {
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

  test("duplicate anchors do not inflate confidence", () => {
    const unique = computeCriterionConfidence({
      key: "dialogue",
      final_score_0_10: 6,
      final_rationale:
        "Dialogue subtext carries thematic weight through compressed exchanges.",
      evidence: [
        { snippet: "When the river takes, he said, it gives elsewhere." },
        { snippet: "That's balance. Not mercy." },
      ],
    });

    const duplicated = computeCriterionConfidence({
      key: "dialogue",
      final_score_0_10: 6,
      final_rationale:
        "Dialogue subtext carries thematic weight through compressed exchanges.",
      evidence: [
        { snippet: "When the river takes, he said, it gives elsewhere." },
        { snippet: "When the river takes, he said, it gives elsewhere." },
        { snippet: "When the river takes, he said, it gives elsewhere." },
      ],
    });

    expect(duplicated.confidence_score_0_100).toBeLessThanOrEqual(
      unique.confidence_score_0_100,
    );
  });

  test("generic anchors do not outperform strong source-matched anchors", () => {
    const sourceText =
      "When the river takes, he said, it gives elsewhere. That's balance. Not mercy.";

    const generic = computeCriterionConfidence({
      key: "dialogue",
      final_score_0_10: 6,
      final_rationale: "Dialogue is effective overall.",
      evidence: [
        { snippet: "The chapter is effective." },
        { snippet: "Strong writing throughout." },
        { snippet: "Shows promise." },
      ],
    });

    const specific = computeCriterionConfidence(
      {
        key: "dialogue",
        final_score_0_10: 7,
        final_rationale:
          "Dialogue subtext compresses thematic exchange into reader-facing tension.",
        evidence: [
          { snippet: "When the river takes, he said, it gives elsewhere." },
          { snippet: "That's balance. Not mercy." },
        ],
      },
      sourceText,
    );

    expect(specific.confidence_score_0_100).toBeGreaterThan(
      generic.confidence_score_0_100,
    );
  });

  test("anchor count alone cannot force high confidence", () => {
    const result = computeCriterionConfidence({
      key: "dialogue",
      final_score_0_10: 6,
      final_rationale: "Dialogue works well.",
      evidence: [
        { snippet: "Good writing." },
        { snippet: "Good writing." },
        { snippet: "Good writing." },
      ],
    });

    expect(result.confidence_level).not.toBe("high");
  });
});

describe("computeCriterionConfidence — scorability semantics", () => {
  test("low confidence does not erase score", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 8,
      final_rationale: "Prose works well.",
      evidence: [],
    });

    expect(result.scorability_status).toBe("scorable_low_confidence");
    expect(result.confidence_level).toBe("low");
  });

  test("meta artifact does not force non_scorable — Prose Control regression", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 7,
      final_rationale:
        "Prose imagery is precise with occasional rhythmic awkwardness.",
      evidence: [
        {
          snippet:
            "The syntax flows with cadence. <ChatGPT note: check rhythm here>",
        },
      ],
      meta_artifacts: ["ChatGPT editing note in evidence snippet"],
    });

    expect(result.scorability_status).not.toBe("non_scorable");
    expect(result.confidence_reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Artifact hygiene issues were detected/i),
      ]),
    );
  });

  test("truly empty criterion returns non_scorable", () => {
    const result = computeCriterionConfidence({
      key: "narrativeClosure",
      final_score_0_10: null,
      final_rationale: "N/A",
      evidence: [],
      recommendations: [],
    });

    expect(result.scorability_status).toBe("non_scorable");
  });

  test("confidence_score_0_100 is bounded 0..100", () => {
    const result = computeCriterionConfidence({
      key: "proseControl",
      final_score_0_10: 8,
      final_rationale:
        "Prose imagery, syntax, cadence, and diction sustain reader immersion.",
      evidence: [
        { snippet: "The river turned, and with it, the light." },
        { snippet: "Glass towers caught fire in the dusk." },
        { snippet: "Sentences breathed in the cadence of tide." },
      ],
    });

    expect(result.confidence_score_0_100).toBeGreaterThanOrEqual(0);
    expect(result.confidence_score_0_100).toBeLessThanOrEqual(100);
  });
});
