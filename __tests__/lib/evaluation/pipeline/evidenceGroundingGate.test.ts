/**
 * Tests for the P0 Evidence Grounding Gate.
 *
 * Validates that anchor_snippet classification correctly distinguishes:
 * - verbatim_quote: text found in manuscript
 * - paraphrased_observation: partial/fuzzy match
 * - editorial_diagnosis: NOT found in manuscript (fabricated)
 */

import {
  classifyAnchor,
  runEvidenceGroundingGate,
  stampAnchorTypes,
  type AnchorType,
} from "@/lib/evaluation/pipeline/evidenceGroundingGate";

const SAMPLE_MANUSCRIPT = `Half an hour after Calvin's train arrived in Antwerp's Central Station, Belgium, he was standing at the curb in front of the tallest building in the city: The SkyNooz Complex—seventy-metre nouveau chic in a setting of Old World charm. On the top floor, his (finally) above-the-crowd friend, Monty.

"You are sooooo fucked!" Monty's voice boomed across the penthouse.

Calvin adjusted his jacket, glancing at the diamond-encrusted Breitling on Monty's wrist. "The diamond industry has lost its appeal. No more sparkle, so to speak."

"Cobalt, Calvin. That's where the money is now. The Congo. Cameroon. You want to live or just survive?"

During the one hour and fifteen train commute from Amsterdam's Central Station and the fifteen-minute taxi ride to his friend's place, he had taken in enough of The Netherlands and Belgium to know that the Old World still had its charms—but Monty was never satisfied with charm alone.`;

describe("classifyAnchor", () => {
  it("classifies an exact substring as verbatim_quote", () => {
    const result = classifyAnchor(
      "The diamond industry has lost its appeal",
      SAMPLE_MANUSCRIPT,
    );
    expect(result.anchor_type).toBe("verbatim_quote");
    expect(result.match_score).toBe(1.0);
  });

  it("classifies a near-verbatim quote as verbatim_quote", () => {
    // Slight variation (different quotes, minor punctuation)
    const result = classifyAnchor(
      "You are sooooo fucked! Monty's voice boomed across the penthouse",
      SAMPLE_MANUSCRIPT,
    );
    expect(result.anchor_type).toBe("verbatim_quote");
    expect(result.match_score).toBeGreaterThanOrEqual(0.85);
  });

  it("classifies a paraphrased observation as paraphrased_observation", () => {
    // Shares substantial key phrases but rearranges/rephrases them
    const result = classifyAnchor(
      "after Calvin's train arrived in Antwerp's Central Station he was standing at the curb",
      SAMPLE_MANUSCRIPT,
    );
    expect(result.anchor_type).toBe("paraphrased_observation");
    expect(result.match_score).toBeGreaterThanOrEqual(0.45);
    expect(result.match_score).toBeLessThan(0.85);
  });

  it("classifies fabricated diagnostic text as editorial_diagnosis", () => {
    const result = classifyAnchor(
      "Pacing stalls where a reflective passage delays the next external action trigger the scene needs to maintain momentum.",
      SAMPLE_MANUSCRIPT,
    );
    expect(result.anchor_type).toBe("editorial_diagnosis");
    expect(result.match_score).toBeLessThan(0.45);
  });

  it("classifies generic diagnostic as editorial_diagnosis", () => {
    const result = classifyAnchor(
      "Genre expectations are not established early enough, leaving the reader uncertain about the category of the work.",
      SAMPLE_MANUSCRIPT,
    );
    expect(result.anchor_type).toBe("editorial_diagnosis");
    expect(result.match_score).toBeLessThan(0.45);
  });

  it("classifies tonal diagnosis as editorial_diagnosis", () => {
    const result = classifyAnchor(
      "The tonal register shifts mid-passage without a clear trigger, disrupting the emotional continuity the reader expects.",
      SAMPLE_MANUSCRIPT,
    );
    expect(result.anchor_type).toBe("editorial_diagnosis");
    expect(result.match_score).toBeLessThan(0.45);
  });

  it("handles empty anchor gracefully", () => {
    const result = classifyAnchor("", SAMPLE_MANUSCRIPT);
    expect(result.anchor_type).toBe("editorial_diagnosis");
    expect(result.match_score).toBe(0);
  });

  it("handles missing manuscript gracefully (defaults to verbatim_quote)", () => {
    const result = classifyAnchor(
      "The diamond industry has lost its appeal",
      "",
    );
    // Without manuscript to compare, we assume good faith
    expect(result.anchor_type).toBe("verbatim_quote");
  });

  it("handles very short anchor as editorial_diagnosis", () => {
    const result = classifyAnchor("ok", SAMPLE_MANUSCRIPT);
    expect(result.anchor_type).toBe("editorial_diagnosis");
  });
});

describe("runEvidenceGroundingGate", () => {
  it("produces a full grounding report", () => {
    const criteria = [
      {
        key: "voice",
        recommendations: [
          { anchor_snippet: "The diamond industry has lost its appeal. No more sparkle, so to speak." },
        ],
      },
      {
        key: "pacing",
        recommendations: [
          { anchor_snippet: "Pacing stalls where a reflective passage delays the next external action trigger." },
        ],
      },
      {
        key: "character",
        recommendations: [
          { anchor_snippet: "Cobalt, Calvin. That's where the money is now." },
        ],
      },
    ];

    const report = runEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);

    expect(report.total_recommendations).toBe(3);
    expect(report.verbatim_count).toBeGreaterThanOrEqual(2);
    expect(report.diagnosis_count).toBeGreaterThanOrEqual(1);
    expect(report.fully_grounded).toBe(false);
    expect(report.ungrounded.length).toBeGreaterThanOrEqual(1);
    expect(report.ungrounded[0]?.criterion_key).toBe("pacing");
  });

  it("reports fully_grounded when all anchors match", () => {
    const criteria = [
      {
        key: "voice",
        recommendations: [
          { anchor_snippet: "The diamond industry has lost its appeal" },
        ],
      },
      {
        key: "dialogue",
        recommendations: [
          { anchor_snippet: "Cobalt, Calvin. That's where the money is now." },
        ],
      },
    ];

    const report = runEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);
    expect(report.fully_grounded).toBe(true);
    expect(report.diagnosis_count).toBe(0);
  });
});

describe("stampAnchorTypes", () => {
  it("mutates recommendations with anchor_type field", () => {
    const criteria = [
      {
        key: "voice",
        recommendations: [
          { anchor_snippet: "The diamond industry has lost its appeal", anchor_type: undefined as AnchorType | undefined },
        ],
      },
      {
        key: "pacing",
        recommendations: [
          { anchor_snippet: "Pacing stalls where a reflective passage delays the next external action trigger.", anchor_type: undefined as AnchorType | undefined },
        ],
      },
    ];

    stampAnchorTypes(criteria, SAMPLE_MANUSCRIPT);

    expect(criteria[0].recommendations[0].anchor_type).toBe("verbatim_quote");
    expect(criteria[1].recommendations[0].anchor_type).toBe("editorial_diagnosis");
  });
});

describe("grounding_skipped — manuscriptText absent", () => {
  const CRITERIA_WITH_RECS = [
    {
      key: "pacing",
      recommendations: [
        { anchor_snippet: "The diamond industry has lost its appeal" },
        { anchor_snippet: "Cobalt, Calvin. That's where the money is now." },
      ],
    },
  ];

  it("runEvidenceGroundingGate: grounding_skipped is NOT set when manuscript is present", () => {
    const report = runEvidenceGroundingGate(CRITERIA_WITH_RECS, SAMPLE_MANUSCRIPT);
    expect(report.grounding_skipped).toBeFalsy();
    expect(report.total_recommendations).toBe(2);
  });

  it("runEvidenceGroundingGate: grounding_skipped is NOT set when there are no recommendations (empty criteria)", () => {
    const report = runEvidenceGroundingGate([], SAMPLE_MANUSCRIPT);
    expect(report.grounding_skipped).toBeFalsy();
    expect(report.total_recommendations).toBe(0);
  });

  it("stampAnchorTypes: grounding_skipped is NOT set when manuscript is present", () => {
    const criteria = [
      {
        key: "voice",
        recommendations: [
          { anchor_snippet: "The diamond industry has lost its appeal", anchor_type: undefined as AnchorType | undefined },
        ],
      },
    ];
    const report = stampAnchorTypes(criteria, SAMPLE_MANUSCRIPT);
    expect(report.grounding_skipped).toBeFalsy();
    // Gate ran — anchor should be classified
    expect(criteria[0].recommendations[0].anchor_type).toBe("verbatim_quote");
  });
});
