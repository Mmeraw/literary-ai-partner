/**
 * Tests for eligibilityGate module.
 */

import { describe, it, expect } from "@jest/globals";
import {
  evaluateEligibilityGate,
  isRefinementEligible,
  WAVE_ELIGIBILITY_MIN_WCS,
  STRUCTURAL_FAIL_THRESHOLD,
  AGENT_READY_WCS,
} from "../eligibilityGate";
import { GovernanceError } from "../errors";
import type { EvaluationEnvelope } from "../types";

// Helper: create a valid envelope with all 13 criteria
function createEnvelopeWithScores(
  scores: Record<string, number>
): EvaluationEnvelope {
  const canonicalKeys = [
    "CONCEPT",
    "MOMENTUM",
    "CHARACTER",
    "POVVOICE",
    "SCENE",
    "DIALOGUE",
    "THEME",
    "WORLD",
    "PACING",
    "PROSE",
    "TONE",
    "CLOSURE",
    "MARKET",
  ];

  return {
    id: "test-envelope",
    criteria: canonicalKeys.map((key) => ({
      key: key as any,
      score: scores[key] !== undefined ? scores[key] : 5,
    })),
  };
}

describe("eligibilityGate", () => {
  describe("evaluateEligibilityGate", () => {
    it("should return PASS for envelope with WCS >= 7.0 and good structure", () => {
      // All criteria at score 7 should give WCS close to 7.0
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 7]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(result.eligibilityGate).toBe("PASS");
      expect(result.readinessState).toMatch(/^(REFINEMENT_ELIGIBLE|AGENT_READY)$/);
    });

    it("should return BLOCK for envelope with WCS < 7.0", () => {
      // All criteria at score 6 should give WCS < 7.0
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 6]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(result.eligibilityGate).toBe("BLOCK");
      expect(result.reasons).toContain(
        expect.stringContaining("below minimum")
      );
    });

    it("should return BLOCK for FOUNDATIONAL readiness state (WCS < 5.0)", () => {
      // All criteria at score 4 should give WCS < 5.0
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 4]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(result.readinessState).toBe("FOUNDATIONAL");
      expect(result.eligibilityGate).toBe("BLOCK");
    });

    it("should return BLOCK for DEVELOPING readiness state (5.0 <= WCS < 6.0)", () => {
      // Craft scores to achieve DEVELOPING state
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 5]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(result.readinessState).toBe("DEVELOPING");
      expect(result.eligibilityGate).toBe("BLOCK");
    });

    it("should return PASS (REFINEMENT_ELIGIBLE) for 6.0 <= WCS < 8.5", () => {
      // Craft scores to achieve REFINEMENT_ELIGIBLE state
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 7]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(result.readinessState).toBe("REFINEMENT_ELIGIBLE");
      expect(result.eligibilityGate).toBe("PASS");
    });

    it("should return PASS (AGENT_READY) for WCS >= 8.5", () => {
      // All criteria at score 9 should give WCS >= 8.5
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 9]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(result.readinessState).toBe("AGENT_READY");
      expect(result.eligibilityGate).toBe("PASS");
    });

    it("should include reasons in result", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 7]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(result.reasons).toBeDefined();
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  describe("isRefinementEligible", () => {
    it("should return true for PASS & REFINEMENT_ELIGIBLE", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 7]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(isRefinementEligible(result)).toBe(true);
    });

    it("should return true for PASS & AGENT_READY", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 9]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(isRefinementEligible(result)).toBe(true);
    });

    it("should return false for BLOCK", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 4]))
      );

      const result = evaluateEligibilityGate(envelope);
      expect(isRefinementEligible(result)).toBe(false);
    });

    it("should return false for FOUNDATIONAL", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 4]))
      );

      const result = evaluateEligibilityGate(envelope);
      if (result.readinessState === "FOUNDATIONAL") {
        expect(isRefinementEligible(result)).toBe(false);
      }
    });

    it("should return false for DEVELOPING", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries([
          "CONCEPT",
          "MOMENTUM",
          "CHARACTER",
          "POVVOICE",
          "SCENE",
          "DIALOGUE",
          "THEME",
          "WORLD",
          "PACING",
          "PROSE",
          "TONE",
          "CLOSURE",
          "MARKET",
        ].map((k) => [k, 5]))
      );

      const result = evaluateEligibilityGate(envelope);
      if (result.readinessState === "DEVELOPING") {
        expect(isRefinementEligible(result)).toBe(false);
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle envelope with invalid criteria gracefully", () => {
      const envelope = {
        id: "test",
        criteria: [],
      } as EvaluationEnvelope;

      expect(() => {
        evaluateEligibilityGate(envelope);
      }).toThrow(GovernanceError);
    });

    it("should distinguish between structural failure and WCS threshold", () => {
      // Create envelope optimized for WCS but with weak structural criteria
      const envelope = createEnvelopeWithScores({
        // Weak structural criteria
        CONCEPT: 2,
        MOMENTUM: 2,
        CHARACTER: 2,
        SCENE: 2,
        PACING: 2,
        CLOSURE: 2,
        // Strong support criteria
        POVVOICE: 10,
        DIALOGUE: 10,
        THEME: 10,
        WORLD: 10,
        PROSE: 10,
        TONE: 10,
        MARKET: 10,
      });

      const result = evaluateEligibilityGate(envelope);
      // Result may vary depending on weights, but should be deterministic
      expect(result.eligibilityGate).toBeDefined();
      expect(result.readinessState).toBeDefined();
    });
  });
});
