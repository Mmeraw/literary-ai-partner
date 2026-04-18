import { describe, it, expect } from "@jest/globals";
import {
  buildConfidenceInputs,
  buildCanonicalArtifact,
  deriveValidityStatus,
} from "../finalize";
import { CONFIDENCE_DERIVATION_VERSION } from "../../governance/confidenceDerivation";
import { CRITERIA_KEYS } from "../../../schemas/criteria-keys";
import type {
  PassArtifact,
  ConvergenceArtifact,
  EvaluationJob,
} from "../finalize.types";

// === Fixture Helpers ===

function makeCriterion(overrides: Partial<{ criterion_id: string; score_0_10: number; confidence_0_1: number }> = {}) {
  return {
    criterion_id: overrides.criterion_id ?? CRITERIA_KEYS[0],
    score_0_10: overrides.score_0_10 ?? 7,
    rationale: "test rationale",
    confidence_0_1: overrides.confidence_0_1 ?? 0.85,
    evidence: [{
      anchor_id: "a1",
      source_type: "manuscript_chunk" as const,
      source_ref: "ref1",
      start_offset: 0,
      end_offset: 100,
      excerpt: "test excerpt",
    }],
    warnings: [],
  };
}

function makePassArtifact(passId: "pass1" | "pass2" | "pass3", criteria = [makeCriterion()]): PassArtifact {
  return {
    id: `${passId}-artifact-id`,
    job_id: "job-1",
    pass_id: passId,
    schema_version: "1.0.0",
    manuscript_revision_id: "rev-1",
    generated_at: new Date().toISOString(),
    summary: "test summary",
    criteria,
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

function makeConvergenceArtifact(overrides: Partial<ConvergenceArtifact> = {}): ConvergenceArtifact {
  return {
    id: "conv-artifact-id",
    job_id: "job-1",
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    inputs: {
      pass1_artifact_id: "pass1-artifact-id",
      pass2_artifact_id: "pass2-artifact-id",
      pass3_artifact_id: "pass3-artifact-id",
    },
    merged_criteria: [makeCriterion()],
    overview_summary: "test overview",
    convergence_notes: [],
    conflicts_detected: [],
    conflicts_resolved: [],
    validations: {
      schema_valid: true,
      pass_separation_preserved: true,
      all_required_passes_present: true,
      anchor_contract_valid: true,
    },
    ...overrides,
  };
}

function makeJob(): EvaluationJob {
  return {
    id: "job-1",
    user_id: "user-1",
    status: "running",
    phase: "finalizer",
    progress_percent: 90,
    submission_idempotency_key: null,
    claimed_by: "worker-1",
    lease_expires_at: null,
    attempt_count: 1,
    next_retry_at: null,
    failure_code: null,
    last_error: null,
    pass1_artifact_id: "pass1-artifact-id",
    pass2_artifact_id: "pass2-artifact-id",
    pass3_artifact_id: "pass3-artifact-id",
    convergence_artifact_id: "conv-artifact-id",
    canonical_artifact_id: null,
    summary_artifact_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    terminal_at: null,
  };
}

// === Tests ===

describe("buildConfidenceInputs", () => {
  it("happy path: all signals clean => high confidence inputs", () => {
    const pass1 = makePassArtifact("pass1");
    const pass2 = makePassArtifact("pass2");
    const pass3 = makePassArtifact("pass3");
    const convergence = makeConvergenceArtifact();

    const inputs = buildConfidenceInputs({ pass1, pass2, pass3, convergence });

    expect(inputs.criterionCompletenessPassed).toBe(true);
    expect(inputs.anchorIntegrityPassed).toBe(true);
    expect(inputs.governancePassed).toBe(true);
    expect(inputs.passConvergencePassed).toBe(true);
    expect(inputs.hasMaterialPassDisagreement).toBe(false);
    expect(inputs.evidenceCoverage).toBe("strong");
    expect(inputs.usedFallbackPath).toBe(false);
    expect(inputs.executionDegraded).toBe(false);
    expect(inputs.invalidOutput).toBe(false);
    expect(inputs.quarantinedOutput).toBe(false);
  });

  it("material disagreement: >3pt spread triggers flag", () => {
    const pass1 = makePassArtifact("pass1", [makeCriterion({ score_0_10: 9 })]);
    const pass2 = makePassArtifact("pass2", [makeCriterion({ score_0_10: 5 })]);
    const pass3 = makePassArtifact("pass3", [makeCriterion({ score_0_10: 7 })]);
    const convergence = makeConvergenceArtifact();

    const inputs = buildConfidenceInputs({ pass1, pass2, pass3, convergence });

    expect(inputs.hasMaterialPassDisagreement).toBe(true);
  });

  it("thin evidence: no passes have evidence_nonempty", () => {
    const pass1 = makePassArtifact("pass1");
    pass1.validations.evidence_nonempty = false;
    const pass2 = makePassArtifact("pass2");
    pass2.validations.evidence_nonempty = false;
    const pass3 = makePassArtifact("pass3");
    pass3.validations.evidence_nonempty = false;
    const convergence = makeConvergenceArtifact();

    const inputs = buildConfidenceInputs({ pass1, pass2, pass3, convergence });

    expect(inputs.evidenceCoverage).toBe("thin");
  });

  it("partial evidence: mixed evidence_nonempty", () => {
    const pass1 = makePassArtifact("pass1");
    const pass2 = makePassArtifact("pass2");
    pass2.validations.evidence_nonempty = false;
    const pass3 = makePassArtifact("pass3");
    const convergence = makeConvergenceArtifact();

    const inputs = buildConfidenceInputs({ pass1, pass2, pass3, convergence });

    expect(inputs.evidenceCoverage).toBe("partial");
  });
});

describe("buildCanonicalArtifact confidence wiring", () => {
  it("happy path: canonical artifact includes confidence_label, confidence_reasons, confidence_derivation_version", () => {
    const job = makeJob();
    const pass1 = makePassArtifact("pass1");
    const pass2 = makePassArtifact("pass2");
    const pass3 = makePassArtifact("pass3");
    const convergence = makeConvergenceArtifact();

    const canonical = buildCanonicalArtifact({ job, pass1, pass2, pass3, convergence });

    expect(canonical.governance.confidence_label).toBeDefined();
    expect(["high", "medium", "low", "withheld"]).toContain(canonical.governance.confidence_label);
    expect(Array.isArray(canonical.governance.confidence_reasons)).toBe(true);
    expect(canonical.governance.confidence_derivation_version).toBe(
      CONFIDENCE_DERIVATION_VERSION,
    );
  });

  it("degraded signals: confidence_label reflects lower confidence", () => {
    const job = makeJob();
    const pass1 = makePassArtifact("pass1", [makeCriterion({ score_0_10: 9 })]);
    const pass2 = makePassArtifact("pass2", [makeCriterion({ score_0_10: 3 })]);
    const pass3 = makePassArtifact("pass3", [makeCriterion({ score_0_10: 7 })]);
    pass1.validations.evidence_nonempty = false;
    pass2.validations.evidence_nonempty = false;
    const convergence = makeConvergenceArtifact();

    const canonical = buildCanonicalArtifact({ job, pass1, pass2, pass3, convergence });

    // With material disagreement + partial evidence, should not be "high"
    expect(canonical.governance.confidence_label).not.toBe("high");
    expect(canonical.governance.confidence_reasons!.length).toBeGreaterThan(0);
  });
});

describe("deriveValidityStatus", () => {
  it("returns valid when no issues", () => {
    expect(deriveValidityStatus([])).toBe("valid");
  });

  it("returns invalid when issues are present", () => {
    const issues = [
      {
        criterion_id: "__artifact__",
        code: "MISSING_EVIDENCE" as const,
        detail: "criteria missing",
      },
    ];
    expect(deriveValidityStatus(issues)).toBe("invalid");
  });
});
