/**
 * Tests for evaluationBridge module.
 *
 * Proves that EvaluationResultV1 criterion keys are correctly mapped
 * to canonical governance keys, and that unknown keys are rejected (fail-closed).
 */

import { describe, it, expect } from "@jest/globals";
import {
  mapEvaluationResultToGovernanceEnvelope,
  applyGovernanceEnforcement,
  checkRefinementEligibility,
} from "../evaluationBridge";
import { GovernanceError } from "../errors";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";

/**
 * Helper: create a valid EvaluationResultV1 with all 13 criteria.
 *
 * Uses the real EvaluationResultV1 criterion keys (lowercase camelCase):
 * concept, narrativeDrive, character, voice, sceneConstruction, dialogue,
 * theme, worldbuilding, pacing, proseControl, tone, narrativeClosure, marketability
 */
function createValidEvaluation(
  overrides?: Partial<EvaluationResultV1>
): EvaluationResultV1 {
  const base: EvaluationResultV1 = {
    schema_version: "evaluation_result_v1",
    ids: {
      evaluation_run_id: "eval-run-test-001",
      job_id: "job-test-001",
      manuscript_id: 1,
      user_id: "user-test-001",
    },
    generated_at: new Date().toISOString(),
    artifacts: [],
    engine: {
      model: "gpt-4o",
      provider: "openai",
      prompt_version: "v1",
    },
    overview: {
      verdict: "pass",
      overall_score_0_100: 75,
      one_paragraph_summary: "Test evaluation summary",
      top_3_strengths: ["s1", "s2", "s3"],
      top_3_risks: ["r1", "r2", "r3"],
    },
    criteria: [
      {
        key: "concept",
        score_0_10: 7,
        rationale: "Good concept",
        evidence: [],
        recommendations: [],
      },
      {
        key: "narrativeDrive",
        score_0_10: 6,
        rationale: "Adequate narrative drive",
        evidence: [],
        recommendations: [],
      },
      {
        key: "character",
        score_0_10: 7,
        rationale: "Strong characters",
        evidence: [],
        recommendations: [],
      },
      {
        key: "voice",
        score_0_10: 6,
        rationale: "Consistent voice",
        evidence: [],
        recommendations: [],
      },
      {
        key: "sceneConstruction",
        score_0_10: 7,
        rationale: "Well-constructed scenes",
        evidence: [],
        recommendations: [],
      },
      {
        key: "dialogue",
        score_0_10: 6,
        rationale: "Natural dialogue",
        evidence: [],
        recommendations: [],
      },
      {
        key: "theme",
        score_0_10: 7,
        rationale: "Clear theme",
        evidence: [],
        recommendations: [],
      },
      {
        key: "worldbuilding",
        score_0_10: 6,
        rationale: "Good worldbuilding",
        evidence: [],
        recommendations: [],
      },
      {
        key: "pacing",
        score_0_10: 7,
        rationale: "Good pacing",
        evidence: [],
        recommendations: [],
      },
      {
        key: "proseControl",
        score_0_10: 6,
        rationale: "Decent prose",
        evidence: [],
        recommendations: [],
      },
      {
        key: "tone",
        score_0_10: 7,
        rationale: "Appropriate tone",
        evidence: [],
        recommendations: [],
      },
      {
        key: "narrativeClosure",
        score_0_10: 6,
        rationale: "Satisfying closure",
        evidence: [],
        recommendations: [],
      },
      {
        key: "marketability",
        score_0_10: 7,
        rationale: "Market appeal",
        evidence: [],
        recommendations: [],
      },
    ],
    recommendations: {
      quick_wins: [],
      strategic_revisions: [],
    },
    metrics: {
      manuscript: {},
      processing: {},
    },
    governance: {
      confidence: 0.9,
      warnings: [],
      limitations: [],
      policy_family: "standard",
    },
  };

  return {
    ...base,
    ...overrides,
  };
}

describe("evaluationBridge", () => {
  describe("Criterion key mapping (EvaluationResultV1 → Governance)", () => {
    it("should map narrativeDrive → MOMENTUM", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      const momentumCriterion = envelope.criteria.find((c) => c.key === "MOMENTUM");
      expect(momentumCriterion).toBeDefined();
      expect(momentumCriterion?.score).toBe(6);
    });

    it("should map voice → POVVOICE", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      const povvoiceCriterion = envelope.criteria.find((c) => c.key === "POVVOICE");
      expect(povvoiceCriterion).toBeDefined();
      expect(povvoiceCriterion?.score).toBe(6);
    });

    it("should map sceneConstruction → SCENE", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      const sceneCriterion = envelope.criteria.find((c) => c.key === "SCENE");
      expect(sceneCriterion).toBeDefined();
      expect(sceneCriterion?.score).toBe(7);
    });

    it("should map worldbuilding → WORLD", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      const worldCriterion = envelope.criteria.find((c) => c.key === "WORLD");
      expect(worldCriterion).toBeDefined();
      expect(worldCriterion?.score).toBe(6);
    });

    it("should map proseControl → PROSE", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      const proseCriterion = envelope.criteria.find((c) => c.key === "PROSE");
      expect(proseCriterion).toBeDefined();
      expect(proseCriterion?.score).toBe(6);
    });

    it("should map narrativeClosure → CLOSURE", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      const closureCriterion = envelope.criteria.find((c) => c.key === "CLOSURE");
      expect(closureCriterion).toBeDefined();
      expect(closureCriterion?.score).toBe(6);
    });

    it("should map marketability → MARKET", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      const marketCriterion = envelope.criteria.find((c) => c.key === "MARKET");
      expect(marketCriterion).toBeDefined();
      expect(marketCriterion?.score).toBe(7);
    });

    it("should preserve direct matches (concept → CONCEPT, character → CHARACTER, etc.)", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      expect(envelope.criteria.find((c) => c.key === "CONCEPT")).toBeDefined();
      expect(envelope.criteria.find((c) => c.key === "CHARACTER")).toBeDefined();
      expect(envelope.criteria.find((c) => c.key === "DIALOGUE")).toBeDefined();
      expect(envelope.criteria.find((c) => c.key === "THEME")).toBeDefined();
      expect(envelope.criteria.find((c) => c.key === "PACING")).toBeDefined();
      expect(envelope.criteria.find((c) => c.key === "TONE")).toBeDefined();
    });

    it("should result in exactly 13 criteria after mapping", () => {
      const evaluation = createValidEvaluation();
      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);

      expect(envelope.criteria.length).toBe(13);
    });

    it("should reject unknown criterion keys (fail-closed)", () => {
      const evaluation = createValidEvaluation({
        criteria: [
          {
            key: "unknownCriterion" as any,
            score_0_10: 5,
            rationale: "Test",
            evidence: [],
            recommendations: [],
          },
          ...createValidEvaluation().criteria.slice(1),
        ],
      });

      expect(() => {
        mapEvaluationResultToGovernanceEnvelope(evaluation);
      }).toThrow(GovernanceError);

      try {
        mapEvaluationResultToGovernanceEnvelope(evaluation);  
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CRITERIA_SCHEMA_VIOLATION");
          expect(err.message).toContain("unknownCriterion");
          expect(err.metadata?.unknownKey).toBe("unknownCriterion");
        }
      }
    });
  });

  describe("Score conversion (0-10 → 1-10)", () => {
    it("should convert score 0 to 1", () => {
      const evaluation = createValidEvaluation({
        criteria: createValidEvaluation().criteria.map((c, i) =>
          i === 0 ? { ...c, score_0_10: 0 } : c
        ),
      });

      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);
      const firstCriterion = envelope.criteria[0];

      expect(firstCriterion.score).toBe(1);
    });

    it("should preserve score 10", () => {
      const evaluation = createValidEvaluation({
        criteria: createValidEvaluation().criteria.map((c, i) =>
          i === 0 ? { ...c, score_0_10: 10 } : c
        ),
      });

      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);
      const firstCriterion = envelope.criteria[0];

      expect(firstCriterion.score).toBe(10);
    });

    it("should round intermediate scores", () => {
      const evaluation = createValidEvaluation({
        criteria: createValidEvaluation().criteria.map((c, i) =>
          i === 0 ? { ...c, score_0_10: 5.7 } : c
        ),
      });

      const envelope = mapEvaluationResultToGovernanceEnvelope(evaluation);
      const firstCriterion = envelope.criteria[0];

      // 5.7 rounds to 6
      expect(firstCriterion.score).toBe(6);
    });
  });

  describe("Integration: applyGovernanceEnforcement", () => {
    it("should successfully enforce governance on valid evaluation with correct key mapping", () => {
      const evaluation = createValidEvaluation();

      expect(() => {
        applyGovernanceEnforcement(evaluation);
      }).not.toThrow();
    });

    it("should reject evaluation with unknown criterion key", () => {
      const evaluation = createValidEvaluation({
        criteria: [
          {
            key: "invalidKeyName" as any,
            score_0_10: 5,
            rationale: "Test",
            evidence: [],
            recommendations: [],
          },
          ...createValidEvaluation().criteria.slice(1),
        ],
      });

      expect(() => {
        applyGovernanceEnforcement(evaluation);
      }).toThrow(GovernanceError);
    });
  });

  describe("Fail-closed behavior", () => {
    it("should throw if criterion key is not a string", () => {
      const evaluation = createValidEvaluation({
        criteria: [
          {
            key: 123 as any,
            score_0_10: 5,
            rationale: "Test",
            evidence: [],
            recommendations: [],
          },
          ...createValidEvaluation().criteria.slice(1),
        ],
      });

      expect(() => {
        mapEvaluationResultToGovernanceEnvelope(evaluation);
      }).toThrow(GovernanceError);

      try {
        mapEvaluationResultToGovernanceEnvelope(evaluation);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CRITERIA_SCHEMA_VIOLATION");
          expect(err.metadata?.receivedType).toBe("number");
        }
      }
    });

    it("should throw if criterion key is null or undefined", () => {
      const evaluation = createValidEvaluation({
        criteria: [
          {
            key: null as any,
            score_0_10: 5,
            rationale: "Test",
            evidence: [],
            recommendations: [],
          },
          ...createValidEvaluation().criteria.slice(1),
        ],
      });

      expect(() => {
        mapEvaluationResultToGovernanceEnvelope(evaluation);
      }).toThrow(GovernanceError);
    });
  });
});
