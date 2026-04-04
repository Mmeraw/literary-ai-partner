import { describe, expect, test } from "@jest/globals";
import { validatePassArtifact } from "@/schemas/pass-artifact-v1";
import { validateConvergenceArtifact } from "@/schemas/convergence-artifact-v1";
import { validateCanonicalEvaluationArtifact } from "@/schemas/canonical-evaluation-artifact-v1";
import { validateReportSummary } from "@/schemas/report-summary-v1";

function validPassArtifact() {
  return {
    id: "p1",
    job_id: "job-1",
    pass_id: "pass1",
    schema_version: "1.0.0",
    manuscript_revision_id: "rev-1",
    generated_at: "2026-04-04T00:00:00.000Z",
    summary: "summary",
    criteria: [
      {
        criterion_id: "clarity",
        score_0_10: 8,
        rationale: "rationale",
        confidence_0_1: 0.8,
        evidence: [
          {
            anchor_id: "a1",
            source_type: "manuscript_chunk",
            source_ref: "chunk-1",
            start_offset: 0,
            end_offset: 10,
            excerpt: "text",
          },
        ],
        warnings: [],
      },
    ],
    provenance: {
      evaluator_version: "eval-v1",
      prompt_pack_version: "prompt-v1",
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

function validConvergenceArtifact() {
  return {
    id: "conv-1",
    job_id: "job-1",
    schema_version: "1.0.0",
    generated_at: "2026-04-04T00:00:00.000Z",
    inputs: {
      pass1_artifact_id: "p1",
      pass2_artifact_id: "p2",
      pass3_artifact_id: "p3",
    },
    merged_criteria: validPassArtifact().criteria,
    overview_summary: "summary",
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

function validCanonicalEvaluationArtifact() {
  return {
    id: "canon-1",
    job_id: "job-1",
    schema_version: "1.0.0",
    generated_at: "2026-04-04T00:00:00.000Z",
    source: {
      pass1_artifact_id: "p1",
      pass2_artifact_id: "p2",
      pass3_artifact_id: "p3",
      convergence_artifact_id: "conv-1",
    },
    overview: {
      overall_score_0_100: 80,
      verdict: "Pass",
      one_paragraph_summary: "summary",
      top_strengths: ["s1"],
      top_risks: ["r1"],
    },
    criteria: validPassArtifact().criteria,
    governance: {
      confidence_0_1: 0.8,
      warnings: [],
      limitations: [],
      transparency_passed: true,
      anchor_contract_passed: true,
      canonical_ready: true,
    },
    eligibility: {
      structural_pass: true,
      refinement_unlocked: true,
      wave_unlocked: true,
      submission_packaging_unlocked: true,
      reason: null,
    },
    provenance: {
      evaluator_version: "eval-v1",
      prompt_pack_version: "prompt-v1",
      run_id: "run-1",
      finalizer_version: "1.0.0",
    },
  };
}

function validSummary() {
  return {
    id: "sum-1",
    job_id: "job-1",
    user_id: "user-1",
    canonical_artifact_id: "canon-1",
    generated_at: "2026-04-04T00:00:00.000Z",
    overall_score_0_100: 80,
    verdict: "Pass",
    one_paragraph_summary: "summary",
    top_3_strengths: ["s1"],
    top_3_risks: ["r1"],
    confidence_0_1: 0.8,
    warnings_count: 0,
    structural_pass: true,
    refinement_unlocked: true,
    wave_unlocked: true,
    submission_packaging_unlocked: true,
  };
}

describe("Finalizer schema validators", () => {
  test("accepts valid pass artifact", () => {
    expect(validatePassArtifact(validPassArtifact()).id).toBe("p1");
  });

  test("accepts valid convergence artifact", () => {
    expect(validateConvergenceArtifact(validConvergenceArtifact()).id).toBe("conv-1");
  });

  test("accepts valid canonical evaluation artifact", () => {
    expect(validateCanonicalEvaluationArtifact(validCanonicalEvaluationArtifact()).id).toBe("canon-1");
  });

  test("accepts valid report summary", () => {
    expect(validateReportSummary(validSummary()).id).toBe("sum-1");
  });

  test("rejects invalid pass artifact confidence > 1", () => {
    const bad = validPassArtifact();
    bad.criteria[0].confidence_0_1 = 1.2;

    expect(() => validatePassArtifact(bad)).toThrow(/confidence_0_1/i);
  });

  test("rejects invalid convergence boolean flag type", () => {
    const bad = validConvergenceArtifact() as any;
    bad.validations.anchor_contract_valid = "true";

    expect(() => validateConvergenceArtifact(bad)).toThrow(/anchor_contract_valid/i);
  });

  test("rejects invalid canonical score out of range", () => {
    const bad = validCanonicalEvaluationArtifact();
    bad.overview.overall_score_0_100 = 200;

    expect(() => validateCanonicalEvaluationArtifact(bad)).toThrow(/overall_score_0_100/i);
  });

  test("rejects invalid summary warnings_count", () => {
    const bad = validSummary() as any;
    bad.warnings_count = -1;

    expect(() => validateReportSummary(bad)).toThrow(/warnings_count/i);
  });
});
