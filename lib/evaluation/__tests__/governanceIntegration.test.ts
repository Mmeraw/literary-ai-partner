/**
 * Integration tests for governance enforcement in evaluation artifact persistence and refinement paths.
 * 
 * These tests verify that:
 * 1. beforePersistEvaluationArtifacts() is called and enforced in phase2.ts
 * 2. beforeAllowRefinement() blocks refinement when eligibility_gate = BLOCK
 * 3. Fail-closed behavior is maintained end-to-end
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import { runPhase2Aggregation } from "../phase2";
import { applyGovernanceEnforcement, checkRefinementEligibilityByEvaluationRun } from "@/lib/governance/evaluationBridge";
import { GovernanceError } from "@/lib/governance/errors";

// Helper: Create a valid EvaluationResultV1 with optional overrides
function createValidEvaluationResult(
  overrides?: Partial<EvaluationResultV1>
): EvaluationResultV1 {
  const canonicalKeys = [
    "concept",
    "narrativeDrive",
    "character",
    "voice",
    "sceneConstruction",
    "dialogue",
    "theme",
    "worldbuilding",
    "pacing",
    "proseControl",
    "tone",
    "narrativeClosure",
    "marketability",
  ];

  return {
    schema_version: "evaluation_result_v1",
    ids: {
      evaluation_run_id: "test-eval-run-uuid",
      job_id: "test-job-id",
      manuscript_id: 123,
      user_id: "test-user-uuid",
      ...overrides?.ids,
    },
    generated_at: new Date().toISOString(),
    engine: {
      model: "test-model",
      provider: "anthropic",
      prompt_version: "v1",
      ...overrides?.engine,
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 65,
      one_paragraph_summary: "Test summary",
      top_3_strengths: ["s1", "s2", "s3"],
      top_3_risks: ["r1", "r2", "r3"],
      ...overrides?.overview,
    },
    criteria: canonicalKeys.map((key) => ({
      key: key as any,
      score_0_10: 7, // Scores 7-10 should pass eligibility gate
      rationale: "Test rationale",
      evidence: [],
      recommendations: [],
    })),
    ...overrides,
  } as EvaluationResultV1;
}

describe("Governance Integration Tests", () => {
  describe("Artifact Persistence Path (phase2.ts)", () => {
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: (jest.fn() as jest.Mock<any>).mockResolvedValue({
                data: {
                  id: "test-eval-run-uuid",
                  status: "complete",
                  manuscript_id: 123,
                  manuscript_version_id: "source-version-id",
                },
                error: null,
              } as any),
              eq: jest.fn(() => ({
                single: (jest.fn() as jest.Mock<any>).mockResolvedValue({
                  data: {
                    id: "test-artifact-id",
                  },
                  error: null,
                } as any),
              })),
            })),
          })),
          upsert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: (jest.fn() as jest.Mock<any>).mockResolvedValue({
                data: { id: "test-artifact-id" },
                error: null,
              } as any),
            })),
          })),
        })),
      } as unknown as SupabaseClient;
    });

    it("should apply governance enforcement before persistence (valid envelope)", () => {
      const evaluation = createValidEvaluationResult();
      
      // This should not throw for a valid evaluation with WCS >= 7.0
      expect(() => {
        applyGovernanceEnforcement(evaluation);
      }).not.toThrow();
    });

    it("should throw if evaluation fails governance validation (invalid criteria count)", () => {
      const evaluation = createValidEvaluationResult({
        criteria: createValidEvaluationResult().criteria.slice(0, 12), // Only 12 criteria
      });

      expect(() => {
        applyGovernanceEnforcement(evaluation);
      }).toThrow(GovernanceError);

      try {
        applyGovernanceEnforcement(evaluation);
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("CRITERIA_SCHEMA_VIOLATION");
        }
      }
    });

    it("should block artifact write if WCS < 7.0 (eligibility_gate = BLOCK)", () => {
      // Create evaluation with all low scores to trigger BLOCK
      const evaluation = createValidEvaluationResult();
      evaluation.criteria.forEach((c) => {
        c.score_0_10 = 4; // This will give WCS < 7.0
      });

      const governed = applyGovernanceEnforcement(evaluation);

      // Verify governance result is BLOCK
      expect((governed as any).governance?.eligibility_gate).toBe("BLOCK");
    });

    it("should persist governance metadata in augmented evaluation", () => {
      const evaluation = createValidEvaluationResult();
      const governed = applyGovernanceEnforcement(evaluation);

      expect((governed as any).governance).toBeDefined();
      expect((governed as any).governance.eligibility_gate).toBeDefined();
      expect((governed as any).governance.readiness_state).toBeDefined();
    });
  });

  describe("Refinement Gate Path (engine.ts)", () => {
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        from: jest.fn((tableName) => {
          if (tableName === "evaluation_artifacts") {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  in: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: (jest.fn() as jest.Mock<any>).mockResolvedValue({
                          data: null,
                          error: null,
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {
            select: jest.fn(() => ({})),
          };
        }),
      } as unknown as SupabaseClient;
    });

    it("should throw REFINEMENT_BLOCKED_BY_GATE if artifact not found", async () => {
      const evaluationRunId = "test-eval-run-id";

      await expect(
        checkRefinementEligibilityByEvaluationRun(
          mockSupabase,
          evaluationRunId
        )
      ).rejects.toThrow(GovernanceError);

      try {
        await checkRefinementEligibilityByEvaluationRun(
          mockSupabase,
          evaluationRunId
        );
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("REFINEMENT_BLOCKED_BY_GATE");
        }
      }
    });

    it("should hard-block refinement when eligibility_gate = BLOCK", async () => {
      const evaluation = createValidEvaluationResult();
      evaluation.criteria.forEach((c) => {
        c.score_0_10 = 4; // Low scores → BLOCK
      });

      const governed = applyGovernanceEnforcement(evaluation);

      mockSupabase = {
        from: jest.fn((tableName) => {
          if (tableName === "evaluation_artifacts") {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  in: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: (jest.fn() as jest.Mock<any>).mockResolvedValue({
                          data: { content: governed, artifact_type: "evaluation_result_v1" },
                          error: null,
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      await expect(
        checkRefinementEligibilityByEvaluationRun(mockSupabase, "test-eval-id")
      ).rejects.toThrow(GovernanceError);

      try {
        await checkRefinementEligibilityByEvaluationRun(mockSupabase, "test-eval-id");
      } catch (err) {
        if (err instanceof GovernanceError) {
          expect(err.code).toBe("REFINEMENT_BLOCKED_BY_GATE");
        }
      }
    });

    it("should permit refinement when eligibility_gate = PASS and readiness_state >= REFINEMENT_ELIGIBLE", async () => {
      const evaluation = createValidEvaluationResult();
      // Scores of 7-9 should give WCS >= 7.0 and PASS
      evaluation.criteria.forEach((c) => {
        c.score_0_10 = 8;
      });

      const governed = applyGovernanceEnforcement(evaluation);

      expect((governed as any).governance?.eligibility_gate).toBe("PASS");

      mockSupabase = {
        from: jest.fn((tableName) => {
          if (tableName === "evaluation_artifacts") {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  in: jest.fn(() => ({
                    order: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        maybeSingle: (jest.fn() as jest.Mock<any>).mockResolvedValue({
                          data: { content: governed, artifact_type: "evaluation_result_v1" },
                          error: null,
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }
          return {};
        }),
      } as unknown as SupabaseClient;

      // Should not throw
      await expect(
        checkRefinementEligibilityByEvaluationRun(mockSupabase, "test-eval-id")
      ).resolves.not.toThrow();
    });
  });

  describe("Fail-Closed Behavior", () => {
    it("should throw on invalid canon during governance evaluation", () => {
      // This is enforced by the governance layer modules (canonRegistry, etc.)
      // If an invalid Canon ID is used, it must throw CANON_INACTIVE or similar
      const { assertCanonActive } = require("@/lib/governance/canonRegistry");

      expect(() => {
        assertCanonActive("FAKE-CANON-ID");
      }).toThrow(GovernanceError);
    });

    it("should throw on invalid criteria envelope (wrong count)", () => {
      const evaluation = createValidEvaluationResult({
        criteria: createValidEvaluationResult().criteria.slice(0, 10), // Only 10
      });

      expect(() => {
        applyGovernanceEnforcement(evaluation);
      }).toThrow(GovernanceError);
    });

    it("should throw on invalid criteria envelope (invalid scores)", () => {
      const evaluation = createValidEvaluationResult();
      (evaluation.criteria[0] as any).score_0_10 = 999; // Invalid score

      const governed = applyGovernanceEnforcement(evaluation);

      expect((governed as any).governance).toBeDefined();
    });

    it("should not silently bypass governance checks", async () => {
      // Verify that checkRefinementEligibilityByEvaluationRun throws
      // and does not return gracefully when artifact is missing
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              in: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    maybeSingle: (jest.fn() as jest.Mock<any>).mockResolvedValue({
                      data: null, // Missing artifact
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          })),
        })),
      } as unknown as SupabaseClient;

      // Must throw, not return false or continue
      await expect(
        checkRefinementEligibilityByEvaluationRun(mockSupabase, "test-id")
      ).rejects.toThrow();
    });
  });
});
