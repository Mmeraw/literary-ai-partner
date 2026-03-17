/**
 * Tests for enforcementHooks module.
 */

import { describe, it, expect } from "@jest/globals";
import {
  beforePersistEvaluationArtifacts,
  beforeAllowRefinement,
  checkMarketReviewEligibility,
  auditGovernanceDecision,
} from "../enforcementHooks";
import { GovernanceError } from "../errors";
import type { EvaluationEnvelope } from "../types";

// Helper: create a valid envelope with all 13 criteria and given scores
function createEnvelopeWithScores(
  scores: Record<string, number> = {}
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
    id: "test-envelope-123",
    evaluation_run_id: "eval-run-456",
    criteria: canonicalKeys.map((key) => ({
      key: key as any,
      score: scores[key] !== undefined ? scores[key] : 6,
    })),
  };
}

describe("enforcementHooks", () => {
  describe("beforePersistEvaluationArtifacts", () => {
    it("should augment envelope with eligibility_gate and readiness_state", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 7])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);

      expect(augmented.eligibility_gate).toBeDefined();
      expect(augmented.readiness_state).toBeDefined();
      expect(augmented.eligibility_gate).toMatch(/^(PASS|BLOCK)$/);
      expect(augmented.readiness_state).toMatch(
        /^(FOUNDATIONAL|DEVELOPING|REFINEMENT_ELIGIBLE|AGENT_READY)$/
      );
    });

    it("should preserve original envelope fields", () => {
      const envelope = createEnvelopeWithScores();
      const augmented = beforePersistEvaluationArtifacts(envelope);

      expect(augmented.id).toBe(envelope.id);
      expect(augmented.evaluation_run_id).toBe(envelope.evaluation_run_id);
      expect(augmented.criteria).toEqual(envelope.criteria);
    });

    it("should set eligibility_gate to PASS for high WCS", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 8])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);
      expect(augmented.eligibility_gate).toBe("PASS");
    });

    it("should set eligibility_gate to BLOCK for low WCS", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 3])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);
      expect(augmented.eligibility_gate).toBe("BLOCK");
    });

    it("should throw GovernanceError for invalid envelope", () => {
      const envelope = {
        id: "test",
        criteria: [],
      } as EvaluationEnvelope;

      expect(() => {
        beforePersistEvaluationArtifacts(envelope);
      }).toThrow(GovernanceError);
    });
  });

  describe("beforeAllowRefinement", () => {
    it("should not throw for envelope with eligibility_gate PASS", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 8])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);

      expect(() => {
        beforeAllowRefinement(augmented);
      }).not.toThrow();
    });

    it("should throw GovernanceError for envelope with eligibility_gate BLOCK", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 3])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);

      expect(() => {
        beforeAllowRefinement(augmented);
      }).toThrow(GovernanceError);

      try {
        beforeAllowRefinement(augmented);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("REFINEMENT_BLOCKED_BY_GATE");
        }
      }
    });

    it("should throw GovernanceError if eligibility_gate is not set", () => {
      const envelope = createEnvelopeWithScores();

      expect(() => {
        beforeAllowRefinement(envelope);
      }).toThrow(GovernanceError);

      try {
        beforeAllowRefinement(envelope);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("REFINEMENT_BLOCKED_BY_GATE");
        }
      }
    });

    it("should include readiness_state in error details", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 3])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);

      try {
        beforeAllowRefinement(augmented);
      } catch (err) {
        if (err instanceof GovernanceError) {
          const details = err.details as Record<string, unknown>;
          expect(details.eligibilityGate).toBe("BLOCK");
        }
      }
    });
  });

  describe("checkMarketReviewEligibility", () => {
    it("should permit for eligibility_gate PASS", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 8])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);
      const result = checkMarketReviewEligibility(augmented);

      expect(result.permitted).toBe(true);
      expect(result.message).toBeDefined();
    });

    it("should deny for eligibility_gate BLOCK", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 3])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);
      const result = checkMarketReviewEligibility(augmented);

      expect(result.permitted).toBe(false);
      expect(result.message).toContain("blocked");
    });

    it("should deny if eligibility_gate is not set", () => {
      const envelope = createEnvelopeWithScores();
      const result = checkMarketReviewEligibility(envelope);

      expect(result.permitted).toBe(false);
      expect(result.message).toContain("not been evaluated");
    });
  });

  describe("auditGovernanceDecision", () => {
    it("should return audit record with all required fields", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 7])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);
      const audit = auditGovernanceDecision(augmented);

      expect(audit.envelopeId).toBeDefined();
      expect(audit.eligibilityGate).toBeDefined();
      expect(audit.readinessState).toBeDefined();
      expect(audit.decision).toMatch(/^(ELIGIBLE_FOR_REFINEMENT|BLOCKED_FROM_REFINEMENT)$/);
      expect(audit.timestamp).toBeDefined();
    });

    it("should set decision to ELIGIBLE_FOR_REFINEMENT when gate is PASS", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 8])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);
      const audit = auditGovernanceDecision(augmented);

      expect(audit.decision).toBe("ELIGIBLE_FOR_REFINEMENT");
    });

    it("should set decision to BLOCKED_FROM_REFINEMENT when gate is BLOCK", () => {
      const envelope = createEnvelopeWithScores(
        Object.fromEntries(
          [
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
          ].map((k) => [k, 3])
        )
      );

      const augmented = beforePersistEvaluationArtifacts(envelope);
      const audit = auditGovernanceDecision(augmented);

      expect(audit.decision).toBe("BLOCKED_FROM_REFINEMENT");
    });

    it("should include envelope ID in audit record", () => {
      const envelope = createEnvelopeWithScores();
      const augmented = beforePersistEvaluationArtifacts(envelope);
      const audit = auditGovernanceDecision(augmented);

      expect(audit.envelopeId).toBe(envelope.id);
    });

    it("should include readable timestamp in ISO format", () => {
      const envelope = createEnvelopeWithScores();
      const augmented = beforePersistEvaluationArtifacts(envelope);
      const audit = auditGovernanceDecision(augmented);

      // Should be valid ISO string
      expect(() => new Date(audit.timestamp)).not.toThrow();
      const date = new Date(audit.timestamp);
      expect(date.getFullYear()).toBeGreaterThan(2020);
    });
  });
});
