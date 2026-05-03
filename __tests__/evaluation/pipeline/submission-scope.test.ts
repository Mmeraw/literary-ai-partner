import { classifySubmissionScope } from "../../../lib/evaluation/pipeline/submissionScope";
import { computeScorableCount, scopePolicy } from "../../../lib/evaluation/signal/scopePolicy";

describe("PR-1: Submission scope governance", () => {
  describe("classifySubmissionScope", () => {
    it("throws for <200 words", () => {
      const shortText = Array(150).fill("word").join(" ");
      expect(() => classifySubmissionScope(shortText, 1, computeScorableCount)).toThrow(
        "SUBMISSION_TOO_SHORT_FOR_EVALUATION"
      );
    });

    it("classifies 200-749 as micro_excerpt", () => {
      const text = Array(500).fill("word").join(" ");
      const profile = classifySubmissionScope(text, 1, computeScorableCount);
      expect(profile.inputScale).toBe("micro_excerpt");
      expect(profile.confidenceCapSummary).toBe("LOW");
    });

    it("classifies 750-1999 as light_chapter (Chapter 11e at 1238 words)", () => {
      const text = Array(1238).fill("word").join(" ");
      const profile = classifySubmissionScope(text, 1, computeScorableCount);
      expect(profile.inputScale).toBe("light_chapter");
      expect(profile.confidenceCapSummary).toBe("MODERATE");
    });

    it("classifies 2000-5999 as standard_chapter", () => {
      const text = Array(3500).fill("word").join(" ");
      const profile = classifySubmissionScope(text, 1, computeScorableCount);
      expect(profile.inputScale).toBe("standard_chapter");
    });

    it("classifies 6000-24999 as multi_chapter", () => {
      const text = Array(10000).fill("word").join(" ");
      const profile = classifySubmissionScope(text, 1, computeScorableCount);
      expect(profile.inputScale).toBe("multi_chapter");
      expect(profile.confidenceCapSummary).toBe("HIGH");
    });

    it("classifies 25000+ as full_manuscript", () => {
      const text = Array(30000).fill("word").join(" ");
      const profile = classifySubmissionScope(text, 1, computeScorableCount);
      expect(profile.inputScale).toBe("full_manuscript");
      expect(profile.confidenceCapSummary).toBe("HIGH");
    });

    it("reports correct scopePolicyVersion", () => {
      const text = Array(500).fill("word").join(" ");
      const profile = classifySubmissionScope(text, 1, computeScorableCount);
      expect(profile.scopePolicyVersion).toBe("v1");
    });
  });

  describe("scopePolicy", () => {
    it("marks narrativeClosure as NA for micro_excerpt", () => {
      const result = scopePolicy("micro_excerpt", "narrativeClosure");
      expect(result.plan).toBe("NA");
    });

    it("marks marketability as NA for micro_excerpt", () => {
      const result = scopePolicy("micro_excerpt", "marketability");
      expect(result.plan).toBe("NA");
    });

    it("allows concept as R for micro_excerpt", () => {
      const result = scopePolicy("micro_excerpt", "concept");
      expect(result.plan).toBe("R");
    });

    it("allows full scoring for full_manuscript", () => {
      const closure = scopePolicy("full_manuscript", "narrativeClosure");
      const market = scopePolicy("full_manuscript", "marketability");
      expect(closure.plan).toBe("R");
      expect(market.plan).toBe("R");
    });
  });

  describe("computeScorableCount", () => {
    it("micro_excerpt has fewer scorable criteria than full_manuscript", () => {
      const micro = computeScorableCount("micro_excerpt");
      const full = computeScorableCount("full_manuscript");
      expect(micro).toBeLessThan(full);
      expect(full).toBe(13);
    });
  });
});
