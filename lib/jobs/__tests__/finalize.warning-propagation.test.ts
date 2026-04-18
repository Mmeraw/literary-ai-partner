import { describe, expect, it } from "@jest/globals";
import { countPass1UnresolvedWarnings } from "../finalize";
import type {
  ConvergenceArtifact,
  CriterionAssessment,
  EvaluationJob,
  PassArtifact,
} from "../finalize.types";

function makeCriterion(overrides: Partial<CriterionAssessment> = {}): CriterionAssessment {
  return {
    criterion_id: overrides.criterion_id ?? "openingHook",
    score_0_10: overrides.score_0_10 ?? 7,
    rationale: overrides.rationale ?? "Rationale",
    confidence_0_1: overrides.confidence_0_1 ?? 0.8,
    evidence: overrides.evidence ?? [
      {
        anchor_id: "a1",
        source_type: "manuscript_chunk",
        source_ref: "chunk-1",
        start_offset: 0,
        end_offset: 42,
        excerpt: "Excerpt",
      },
    ],
    warnings: overrides.warnings ?? [],
    quality_warnings: overrides.quality_warnings ?? [],
    propagated_warnings: overrides.propagated_warnings ?? [],
  };
}

function makePassArtifact(criteria: CriterionAssessment[]): PassArtifact {
  return {
    id: "pass1-artifact",
    job_id: "job-1",
    pass_id: "pass1",
    schema_version: "1.0.0",
    manuscript_revision_id: "rev-1",
    generated_at: new Date().toISOString(),
    summary: "summary",
    criteria,
    provenance: {
      evaluator_version: "eval-v1",
      prompt_pack_version: "pack-v1",
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

function makeConvergenceArtifact(criteria: CriterionAssessment[]): ConvergenceArtifact {
  return {
    id: "conv-1",
    job_id: "job-1",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    inputs: {
      pass1_artifact_id: "pass1-artifact",
      pass2_artifact_id: "pass2-artifact",
      pass3_artifact_id: "pass3-artifact",
    },
    merged_criteria: criteria,
    overview_summary: "overview",
    convergence_notes: [],
    conflicts_detected: [],
    conflicts_resolved: [],
    validations: {
      schema_valid: true,
      pass_separation_preserved: true,
      all_required_passes_present: true,
      anchor_contract_valid: true,
    },
  };
}

describe("countPass1UnresolvedWarnings", () => {
  it("counts unresolved pass1 quality_warnings from structured pass state", () => {
    const pass1 = makePassArtifact([
      makeCriterion({
        quality_warnings: [
          {
            warning_code: "pass1_incomplete_evidence",
            message: "Needs more evidence",
            source_pass: "pass1",
            resolution_status: "unresolved",
          },
          {
            warning_code: "pass1_soft_warning",
            message: "Already handled",
            source_pass: "pass1",
            resolution_status: "resolved",
          },
        ],
      }),
    ]);

    const result = countPass1UnresolvedWarnings({ pass1 });

    expect(result.pass1_unresolved_warning_count).toBe(1);
    expect(result.used_fallback).toBe(false);
  });

  it("counts unresolved propagated_warnings from convergence state without counting pass2", () => {
    const pass1 = makePassArtifact([makeCriterion()]);
    const convergence = makeConvergenceArtifact([
      makeCriterion({
        propagated_warnings: [
          {
            warning_code: "pass1_missing_anchor",
            message: "Missing anchor",
            source_pass: "pass1",
            resolution_status: "unresolved",
          },
          {
            warning_code: "pass2_style_note",
            message: "Pass 2 warning should not count",
            source_pass: "pass2",
            resolution_status: "unresolved",
          },
          {
            warning_code: "pass1_resolved_warning",
            message: "Resolved warning should not count",
            source_pass: "pass1",
            resolution_status: "resolved",
          },
        ],
      }),
    ]);

    const result = countPass1UnresolvedWarnings({ pass1, convergence });

    expect(result.pass1_unresolved_warning_count).toBe(1);
    expect(result.used_fallback).toBe(false);
  });

  it("falls back to legacy warnings strings only when structured warning state is absent", () => {
    const pass1 = makePassArtifact([
      makeCriterion({ warnings: ["legacy-warning-1", "legacy-warning-2"] }),
    ]);

    const result = countPass1UnresolvedWarnings({ pass1 });

    expect(result.pass1_unresolved_warning_count).toBe(2);
    expect(result.used_fallback).toBe(true);
  });

  it("falls back for pass1 when only non-pass1 structured warnings are present during rollout", () => {
    const pass1 = makePassArtifact([
      makeCriterion({ warnings: ["legacy-pass1-warning"] }),
    ]);
    const convergence = makeConvergenceArtifact([
      makeCriterion({
        propagated_warnings: [
          {
            warning_code: "pass2_style_note",
            message: "Pass 2 warning only",
            source_pass: "pass2",
            resolution_status: "unresolved",
          },
        ],
      }),
    ]);

    const result = countPass1UnresolvedWarnings({ pass1, convergence });

    expect(result.pass1_unresolved_warning_count).toBe(1);
    expect(result.used_fallback).toBe(true);
  });
});
