import { describe, expect, test } from "@jest/globals";
import {
  LOW_CONFIDENCE_SCORE_RECONCILIATION_REASON,
  normalizeCriterion,
  reconcileLowConfidenceScore,
} from "@/lib/evaluation/signal/criterionObservability";

describe("reconcileLowConfidenceScore", () => {
  test("caps SCORABLE low-confidence score above 5", () => {
    const result = reconcileLowConfidenceScore({
      status: "SCORABLE",
      confidence_level: "low",
      score_0_10: 7,
    });

    expect(result).toEqual({
      score_0_10: 5,
      reconciled: true,
    });
  });

  test("does not cap high-confidence score", () => {
    const result = reconcileLowConfidenceScore({
      status: "SCORABLE",
      confidence_level: "high",
      score_0_10: 8,
    });

    expect(result).toEqual({
      score_0_10: 8,
      reconciled: false,
    });
  });

  test("does not alter low-confidence score at cap boundary", () => {
    const result = reconcileLowConfidenceScore({
      status: "SCORABLE",
      confidence_level: "low",
      score_0_10: 5,
    });

    expect(result).toEqual({
      score_0_10: 5,
      reconciled: false,
    });
  });
});

describe("normalizeCriterion low-confidence reconciliation", () => {
  test("reconciles low-confidence SCORABLE score and records reason", () => {
    const normalized = normalizeCriterion(
      {
        key: "proseControl",
        score_0_10: 8,
        rationale:
          "This criterion has enough text for a score but confidence is constrained by thin support.",
        evidence: [
          {
            snippet: "Brief evidence anchor.",
          },
        ],
      },
      {
        confidenceCaps: {
          proseControl: "LOW",
        },
      },
    );

    expect(normalized.status).toBe("SCORABLE");
    expect(normalized.confidence_level).toBe("low");
    expect(normalized.score_0_10).toBe(5);
    expect(normalized.confidence_reasons).toContain(
      LOW_CONFIDENCE_SCORE_RECONCILIATION_REASON,
    );
  });

  test("does not reconcile when confidence is high", () => {
    const normalized = normalizeCriterion({
      key: "voice",
      score_0_10: 8,
      rationale:
        "Voice diction and cadence are consistently controlled and evidenced across the passage.",
      evidence: [
        {
          snippet: "The river remembers everything, even when we forget.",
          location: { char_start: 5, char_end: 60 },
        },
        {
          snippet: "Glass towers caught fire in the dusk.",
          location: { char_start: 320, char_end: 358 },
        },
        {
          snippet: "Sentences breathed in the cadence of tide.",
          location: { char_start: 650, char_end: 692 },
        },
      ],
      signal_strength: "STRONG",
    });

    expect(normalized.status).toBe("SCORABLE");
    expect(normalized.score_0_10).toBe(8);
    expect(normalized.confidence_level).not.toBe("low");
    expect(normalized.confidence_reasons).not.toContain(
      LOW_CONFIDENCE_SCORE_RECONCILIATION_REASON,
    );
  });
});
