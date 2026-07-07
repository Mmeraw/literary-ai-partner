/**
 * Tests for G4 Criteria Evidence Grounding Gate (U2-004)
 *
 * Validates that criteria[].evidence[].snippet is correctly classified
 * against manuscript text using the same logic as recommendation anchors.
 * Advisory-only: passed=true always, no job failure.
 */

import {
  runCriteriaEvidenceGroundingGate,
  type CriteriaEvidenceGroundingReport,
} from "@/lib/evaluation/pipeline/evidenceGroundingGate";

const SAMPLE_MANUSCRIPT = `Half an hour after Calvin's train arrived in Antwerp's Central Station, Belgium, he was standing at the curb in front of the tallest building in the city: The SkyNooz Complex—seventy-metre nouveau chic in a setting of Old World charm. On the top floor, his (finally) above-the-crowd friend, Monty.

"You are sooooo fucked!" Monty's voice boomed across the penthouse.

Calvin adjusted his jacket, glancing at the diamond-encrusted Breitling on Monty's wrist. "The diamond industry has lost its appeal. No more sparkle, so to speak."

"Cobalt, Calvin. That's where the money is now. The Congo. Cameroon. You want to live or just survive?"

During the one hour and fifteen train commute from Amsterdam's Central Station and the fifteen-minute taxi ride to his friend's place, he had taken in enough of The Netherlands and Belgium to know that the Old World still had its charms—but Monty was never satisfied with charm alone.`;

function makeCriterion(key: string, snippets: string[]) {
  return {
    key,
    evidence: snippets.map((snippet) => ({ snippet })),
  };
}

describe("runCriteriaEvidenceGroundingGate", () => {
  describe("manuscript available", () => {
    it("classifies verbatim manuscript text as grounded", () => {
      const criteria = [
        makeCriterion("dialogue", [
          "The diamond industry has lost its appeal. No more sparkle, so to speak.",
        ]),
      ];

      const report = runCriteriaEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);

      expect(report.grounding_skipped).toBeFalsy();
      expect(report.total_snippets).toBe(1);
      expect(report.verbatim_count).toBe(1);
      expect(report.grounded_count).toBe(1);
      expect(report.diagnosis_count).toBe(0);
      expect(report.ungrounded).toHaveLength(0);
    });

    it("classifies near-verbatim text as grounded (paraphrased)", () => {
      const criteria = [
        makeCriterion("proseControl", [
          "Calvin adjusted his jacket glancing at the diamond Breitling on Monty's wrist",
        ]),
      ];

      const report = runCriteriaEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);

      expect(report.grounded_count).toBe(1);
      expect(report.diagnosis_count).toBe(0);
    });

    it("classifies fabricated diagnostic text as editorial_diagnosis (ungrounded)", () => {
      const criteria = [
        makeCriterion("pacing", [
          "The scene transition lacks sufficient tension buildup before the confrontation sequence, disrupting reader engagement.",
        ]),
      ];

      const report = runCriteriaEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);

      expect(report.diagnosis_count).toBe(1);
      expect(report.grounded_count).toBe(0);
      expect(report.ungrounded).toHaveLength(1);
      expect(report.ungrounded[0].criterion_key).toBe("pacing");
    });

    it("handles mixed grounded and ungrounded snippets in same criterion", () => {
      const criteria = [
        makeCriterion("character", [
          "Cobalt, Calvin. That's where the money is now. The Congo. Cameroon.", // verbatim
          "The protagonist's arc lacks clear internal motivation throughout the narrative.", // fabricated
        ]),
      ];

      const report = runCriteriaEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);

      expect(report.total_snippets).toBe(2);
      expect(report.grounded_count).toBe(1);
      expect(report.diagnosis_count).toBe(1);
    });

    it("handles multiple criteria with mixed results", () => {
      const criteria = [
        makeCriterion("dialogue", [
          "You are sooooo fucked! Monty's voice boomed across the penthouse.", // verbatim
        ]),
        makeCriterion("tone", [
          "The tonal register shifts abruptly mid-chapter creating reader disorientation.", // fabricated
        ]),
        makeCriterion("narrativeDrive", [
          "Calvin adjusted his jacket, glancing at the diamond-encrusted Breitling", // near-verbatim
        ]),
      ];

      const report = runCriteriaEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);

      expect(report.total_snippets).toBe(3);
      expect(report.grounded_count).toBe(2);
      expect(report.diagnosis_count).toBe(1);
      expect(report.ungrounded[0].criterion_key).toBe("tone");
    });

    it("handles criteria with empty evidence arrays without error", () => {
      const criteria = [
        makeCriterion("theme", []),
        makeCriterion("worldbuilding", []),
      ];

      const report = runCriteriaEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);

      expect(report.total_snippets).toBe(0);
      expect(report.grounded_count).toBe(0);
      expect(report.diagnosis_count).toBe(0);
      expect(report.grounding_skipped).toBeFalsy();
    });

    it("handles empty criteria array", () => {
      const report = runCriteriaEvidenceGroundingGate([], SAMPLE_MANUSCRIPT);

      expect(report.total_snippets).toBe(0);
      expect(report.grounded_count).toBe(0);
      expect(report.grounding_skipped).toBeFalsy();
    });
  });

  describe("manuscript absent", () => {
    it("sets grounding_skipped=true when manuscriptText is undefined", () => {
      const criteria = [makeCriterion("pacing", ["some evidence snippet"])];
      const report = runCriteriaEvidenceGroundingGate(criteria, undefined);

      expect(report.grounding_skipped).toBe(true);
      expect(report.total_snippets).toBe(1);
      expect(report.grounded_count).toBe(0);
      expect(report.diagnosis_count).toBe(0);
    });

    it("sets grounding_skipped=true when manuscriptText is empty string", () => {
      const criteria = [makeCriterion("pacing", ["some evidence snippet"])];
      const report = runCriteriaEvidenceGroundingGate(criteria, "");

      expect(report.grounding_skipped).toBe(true);
    });

    it("sets grounding_skipped=true when manuscriptText is whitespace-only", () => {
      const criteria = [makeCriterion("pacing", ["some evidence snippet"])];
      const report = runCriteriaEvidenceGroundingGate(criteria, "   ");

      expect(report.grounding_skipped).toBe(true);
    });
  });

  describe("grounded_count correctness", () => {
    it("grounded_count = verbatim_count + paraphrased_count", () => {
      const criteria = [
        makeCriterion("dialogue", [
          "You are sooooo fucked! Monty's voice boomed across the penthouse.", // verbatim
          "Calvin adjusted his jacket glancing at the Breitling on Monty's wrist", // paraphrased
          "The emotional resonance of this exchange creates thematic coherence through subtext dynamics.", // fabricated
        ]),
      ];

      const report = runCriteriaEvidenceGroundingGate(criteria, SAMPLE_MANUSCRIPT);

      expect(report.grounded_count).toBe(report.verbatim_count + report.paraphrased_count);
      expect(report.grounded_count + report.diagnosis_count).toBe(report.total_snippets);
    });
  });
});
