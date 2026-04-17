import { enforceCriterionCompleteness } from "../../../lib/jobs/invariants";
import { InvariantViolation } from "../../../lib/jobs/invariants";
import { CRITERIA_KEYS } from "../../../schemas/criteria-keys";
import type { PassArtifact } from "../../../lib/jobs/finalize.types";

// Helper to build a valid pass artifact with all 13 criteria
function buildValidPass(passId: "pass1" | "pass2" | "pass3"): PassArtifact {
  return {
    id: `artifact-${passId}`,
    job_id: "job-1",
    pass_id: passId,
    schema_version: "1.0.0",
    manuscript_revision_id: "rev-1",
    generated_at: new Date().toISOString(),
    summary: "Test summary",
    criteria: CRITERIA_KEYS.map((key) => ({
      criterion_id: key,
      score_0_10: 7,
      rationale: `Rationale for ${key}`,
      confidence_0_1: 0.8,
      evidence: [
        {
          anchor_id: `anchor-${key}`,
          source_type: "manuscript_chunk" as const,
          source_ref: `chunk-${key}`,
          start_offset: 0,
          end_offset: 100,
          excerpt: `Evidence for ${key}`,
        },
      ],
      warnings: [],
    })),
    provenance: {
      evaluator_version: "1.0.0",
      prompt_pack_version: "1.0.0",
      run_id: "run-1",
    },
    validations: {
      schema_valid: true,
      anchor_contract_valid: true,
      evidence_nonempty: true,
      orphan_reasoning_absent: true,
    },
  };
}

describe("enforceCriterionCompleteness", () => {
  it("passes with all 13 criteria present and valid", () => {
    const p1 = buildValidPass("pass1");
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).not.toThrow();
  });

  it("rejects pass missing a criterion", () => {
    const p1 = buildValidPass("pass1");
    p1.criteria = p1.criteria.filter((c) => c.criterion_id !== "concept");
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(InvariantViolation);
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(/missing criteria.*concept/);
  });

  it("rejects criterion with empty rationale", () => {
    const p1 = buildValidPass("pass1");
    p1.criteria[0].rationale = "";
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(/empty rationale/);
  });

  it("rejects criterion with no evidence", () => {
    const p1 = buildValidPass("pass1");
    p1.criteria[0].evidence = [];
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(/no evidence anchors/);
  });

  it("rejects criterion with out-of-range score", () => {
    const p1 = buildValidPass("pass1");
    p1.criteria[0].score_0_10 = 11;
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(/invalid score/);
  });

  it("uses CRITERION_COMPLETENESS_FAILED failure code", () => {
    const p1 = buildValidPass("pass1");
    p1.criteria = [];
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    try {
      enforceCriterionCompleteness(p1, p2, p3);
      fail("Expected InvariantViolation");
    } catch (e) {
      expect(e).toBeInstanceOf(InvariantViolation);
      expect((e as InvariantViolation).failureCode).toBe("CRITERION_COMPLETENESS_FAILED");
    }
  });

  it("rejects duplicate criterion ids", () => {
    const p1 = buildValidPass("pass1");
    // Duplicate the first criterion
    p1.criteria.push({ ...p1.criteria[0] });
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(InvariantViolation);
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(/duplicate criterion id/);
  });

  it("rejects non-canonical criterion ids", () => {
    const p1 = buildValidPass("pass1");
    // Replace one criterion with an invented key
    p1.criteria[0] = { ...p1.criteria[0], criterion_id: "fakeAxis" };
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(InvariantViolation);
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(/non-canonical criterion id/);
  });

  it("rejects non-finite scores (NaN, Infinity)", () => {
    const p1 = buildValidPass("pass1");
    p1.criteria[0].score_0_10 = NaN;
    const p2 = buildValidPass("pass2");
    const p3 = buildValidPass("pass3");
    expect(() => enforceCriterionCompleteness(p1, p2, p3)).toThrow(/invalid score/);
  });
});
