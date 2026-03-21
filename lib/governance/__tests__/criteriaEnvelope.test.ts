/**
 * Tests for criteriaEnvelope module.
 */

import { describe, it, expect } from "@jest/globals";
import {
  validateCriteriaEnvelope,
  validateCriterionScore,
  computeWeightedCompositeScore,
  CRITERION_SCORE_MIN,
  CRITERION_SCORE_MAX,
} from "../criteriaEnvelope";
import { GovernanceError } from "../errors";
import type { EvaluationEnvelope, CriterionScore } from "../types";

// Helper: create a valid envelope with all 13 criteria
function createValidEnvelope(overrides?: Partial<EvaluationEnvelope>): EvaluationEnvelope {
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

  const base: EvaluationEnvelope = {
    id: "test-envelope-1",
    criteria: canonicalKeys.map((key) => ({
      key: key as any,
      score: 5,
      reasoning: "Default score",
    })),
    weighted_composite_score: 5.0,
    ...overrides,
  };

  return base;
}

describe("criteriaEnvelope", () => {
  describe("validateCriteriaEnvelope", () => {
    it("should pass with valid envelope containing exactly 13 criteria", () => {
      const envelope = createValidEnvelope();
      expect(() => {
        validateCriteriaEnvelope(envelope);
      }).not.toThrow();
    });

    it("should throw if criteria array is missing", () => {
      const envelope = {
        id: "test",
      } as EvaluationEnvelope;

      expect(() => {
        validateCriteriaEnvelope(envelope);
      }).toThrow(GovernanceError);

      try {
        validateCriteriaEnvelope(envelope);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CRITERIA_SCHEMA_VIOLATION");
        }
      }
    });

    it("should throw if criteria is not an array", () => {
      const envelope = createValidEnvelope({
        criteria: "not-an-array" as any,
      });

      expect(() => {
        validateCriteriaEnvelope(envelope);
      }).toThrow(GovernanceError);
    });

    it("should throw if criteria count is wrong (less than 13)", () => {
      const envelope = createValidEnvelope({
        criteria: createValidEnvelope().criteria!.slice(0, 12),
      });

      expect(() => {
        validateCriteriaEnvelope(envelope);
      }).toThrow(GovernanceError);

      try {
        validateCriteriaEnvelope(envelope);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CRITERIA_SCHEMA_VIOLATION");
          const metadata = (err.metadata as Record<string, unknown> | undefined) ?? {};
          expect(metadata.expected).toBe(13);
          expect(metadata.actual).toBe(12);
        }
      }
    });

    it("should throw if criteria count is wrong (more than 13)", () => {
      const criteria = createValidEnvelope().criteria!;
      criteria.push({ key: "FAKE" as any, score: 5 });

      const envelope = createValidEnvelope({ criteria });

      expect(() => {
        validateCriteriaEnvelope(envelope);
      }).toThrow(GovernanceError);
    });

    it("should throw if required canonical criterion is missing", () => {
      const criteria = createValidEnvelope()
        .criteria!.filter((c) => c.key !== "CONCEPT");

      // Need to add a fake one to keep count at 13
      criteria.push({ key: "FAKE" as any, score: 5 });

      const envelope = createValidEnvelope({ criteria });

      expect(() => {
        validateCriteriaEnvelope(envelope);
      }).toThrow(GovernanceError);

      try {
        validateCriteriaEnvelope(envelope);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CRITERIA_SCHEMA_VIOLATION");
          const metadata = (err.metadata as Record<string, unknown> | undefined) ?? {};
          expect(metadata.missingKey).toBe("CONCEPT");
        }
      }
    });

    it("should throw if non-canonical criterion is provided", () => {
      const criteria = createValidEnvelope()
        .criteria!.filter((c) => c.key !== "MARKET");

      criteria.push({ key: "FAKE_CRITERION" as any, score: 5 });

      const envelope = createValidEnvelope({ criteria });

      expect(() => {
        validateCriteriaEnvelope(envelope);
      }).toThrow(GovernanceError);

      try {
        validateCriteriaEnvelope(envelope);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CRITERIA_SCHEMA_VIOLATION");
          const metadata = (err.metadata as Record<string, unknown> | undefined) ?? {};
          expect(metadata.missingKey).toBe("MARKET");
        }
      }
    });
  });

  describe("validateCriterionScore", () => {
    it("should pass for valid scores in [1..10]", () => {
      for (let score = CRITERION_SCORE_MIN; score <= CRITERION_SCORE_MAX; score++) {
        const criterion: CriterionScore = {
          key: "CONCEPT",
          score,
        };
        expect(() => {
          validateCriterionScore(criterion);
        }).not.toThrow();
      }
    });

    it("should throw if score is not a number", () => {
      const criterion: CriterionScore = {
        key: "CONCEPT",
        score: "five" as any,
      };

      expect(() => {
        validateCriterionScore(criterion);
      }).toThrow(GovernanceError);

      try {
        validateCriterionScore(criterion);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CRITERIA_SCHEMA_VIOLATION");
        }
      }
    });

    it("should throw if score is not an integer", () => {
      const criterion: CriterionScore = {
        key: "CONCEPT",
        score: 5.5,
      };

      expect(() => {
        validateCriterionScore(criterion);
      }).toThrow(GovernanceError);
    });

    it("should throw if score is below minimum", () => {
      const criterion: CriterionScore = {
        key: "CONCEPT",
        score: CRITERION_SCORE_MIN - 1,
      };

      expect(() => {
        validateCriterionScore(criterion);
      }).toThrow(GovernanceError);
    });

    it("should throw if score is above maximum", () => {
      const criterion: CriterionScore = {
        key: "CONCEPT",
        score: CRITERION_SCORE_MAX + 1,
      };

      expect(() => {
        validateCriterionScore(criterion);
      }).toThrow(GovernanceError);
    });
  });

  describe("computeWeightedCompositeScore", () => {
    it("should compute WCS for valid envelope", () => {
      const envelope = createValidEnvelope({
        criteria: createValidEnvelope()
          .criteria!.map((c) => ({
            ...c,
            score: 6,
          })),
      });

      const wcs = computeWeightedCompositeScore(envelope);
      expect(typeof wcs).toBe("number");
      expect(wcs).toBeGreaterThan(0);
      expect(wcs).toBeLessThanOrEqual(10);
    });

    it("should throw for invalid envelope", () => {
      const envelope = createValidEnvelope({
        criteria: createValidEnvelope()
          .criteria!.slice(0, 12),
      });

      expect(() => {
        computeWeightedCompositeScore(envelope);
      }).toThrow(GovernanceError);
    });

    it("WCS should be 5.0 when all criteria are score 5", () => {
      const envelope = createValidEnvelope({
        criteria: createValidEnvelope()
          .criteria!.map((c) => ({
            ...c,
            score: 5,
          })),
      });

      const wcs = computeWeightedCompositeScore(envelope);
      expect(wcs).toBeCloseTo(5.0, 1);
    });

    it("WCS should be 10.0 when all criteria are score 10", () => {
      const envelope = createValidEnvelope({
        criteria: createValidEnvelope()
          .criteria!.map((c) => ({
            ...c,
            score: 10,
          })),
      });

      const wcs = computeWeightedCompositeScore(envelope);
      expect(wcs).toBeCloseTo(10.0, 1);
    });

    it("WCS should be 1.0 when all criteria are score 1", () => {
      const envelope = createValidEnvelope({
        criteria: createValidEnvelope()
          .criteria!.map((c) => ({
            ...c,
            score: 1,
          })),
      });

      const wcs = computeWeightedCompositeScore(envelope);
      expect(wcs).toBeCloseTo(1.0, 1);
    });
  });
});
