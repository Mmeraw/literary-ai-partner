/**
 * Finalizer Types — RevisionGrade Phase 1
 * 
 * The Finalizer is the sole truth gate between execution and canonical
 * artifact publication. No code path may set job.status = "complete"
 * outside the Finalizer.
 */

import { type JobStatus } from "./types";
import { type FailureCode } from "./failures";

// === Pass & Phase Enums ===

export type PassId = "pass1" | "pass2" | "pass3";

export type JobPhase =
  | "submit"
  | "pass1"
  | "pass2"
  | "pass3"
  | "convergence"
  | "finalizer"
  | "report"
  | "done";

// === Evidence & Assessment ===

export interface EvidenceAnchor {
  anchor_id: string;
  source_type: "manuscript_chunk" | "manuscript_span" | "criterion_note";
  source_ref: string;
  start_offset: number | null;
  end_offset: number | null;
  excerpt: string | null;
}

export interface CriterionAssessment {
  criterion_id: string;
  score_0_10: number;
  rationale: string;
  confidence_0_1: number;
  evidence: EvidenceAnchor[];
  warnings: string[];
}

// === Pass Artifact ===

export interface PassArtifact {
  id: string;
  job_id: string;
  pass_id: PassId;
  schema_version: string;
  manuscript_revision_id: string;
  generated_at: string;
  summary: string;
  criteria: CriterionAssessment[];
  provenance: {
    evaluator_version: string;
    prompt_pack_version: string | null;
    run_id: string;
  };
  validations: {
    schema_valid: boolean;
    anchor_contract_valid: boolean;
    evidence_nonempty: boolean;
    orphan_reasoning_absent: boolean;
  };
}

// === Convergence Artifact ===

export interface ConvergenceArtifact {
  id: string;
  job_id: string;
  schema_version: string;
  generated_at: string;
  inputs: {
    pass1_artifact_id: string;
    pass2_artifact_id: string;
    pass3_artifact_id: string;
  };
  merged_criteria: CriterionAssessment[];
  overview_summary: string;
  convergence_notes: string[];
  conflicts_detected: string[];
  conflicts_resolved: string[];
  validations: {
    schema_valid: boolean;
    pass_separation_preserved: boolean;
    all_required_passes_present: boolean;
    anchor_contract_valid: boolean;
  };
}

// === Canonical Evaluation Artifact ===

export interface EligibilityBlock {
  structural_pass: boolean;
  refinement_unlocked: boolean;
  wave_unlocked: boolean;
  submission_packaging_unlocked: boolean;
  reason: string | null;
}

export interface CanonicalEvaluationArtifact {
  id: string;
  job_id: string;
  schema_version: string;
  generated_at: string;
  source: {
    pass1_artifact_id: string;
    pass2_artifact_id: string;
    pass3_artifact_id: string;
    convergence_artifact_id: string;
  };
  overview: {
    overall_score_0_100: number;
    verdict: string;
    one_paragraph_summary: string;
    top_strengths: string[];
    top_risks: string[];
  };
  criteria: CriterionAssessment[];
  governance: {
    confidence_0_1: number;
    warnings: string[];
    limitations: string[];
    transparency_passed: boolean;
    anchor_contract_passed: boolean;
    canonical_ready: boolean;
  };
  eligibility: EligibilityBlock;
  provenance: {
    evaluator_version: string;
    prompt_pack_version: string | null;
    run_id: string;
    finalizer_version: string;
  };
}

// === Report Summary Projection ===

export interface ReportSummaryProjection {
  id: string;
  job_id: string;
  user_id: string;
  canonical_artifact_id: string;
  generated_at: string;
  overall_score_0_100: number;
  verdict: string;
  one_paragraph_summary: string;
  top_3_strengths: string[];
  top_3_risks: string[];
  confidence_0_1: number;
  warnings_count: number;
  structural_pass: boolean;
  refinement_unlocked: boolean;
  wave_unlocked: boolean;
  submission_packaging_unlocked: boolean;
}

// === Finalizer I/O Contracts ===

export interface FinalizeJobInput {
  job_id: string;
  worker_id: string;
  expected_status: "running";
  expected_phase: "finalizer";
}

export type FinalizeJobResult =
  | {
      ok: true;
      job_id: string;
      canonical_artifact_id: string;
      summary_artifact_id: string;
      final_status: "complete";
    }
  | {
      ok: false;
      job_id: string;
      failure_code: FailureCode;
      final_status: "failed";
      reason: string;
    };

// === Evaluation Job (extended with Finalizer fields) ===

export interface EvaluationJob {
  id: string;
  user_id: string;
  status: JobStatus;
  phase: JobPhase;
  progress_percent: number;
  submission_idempotency_key: string | null;
  claimed_by: string | null;
  lease_expires_at: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  failure_code: FailureCode | null;
  last_error: string | null;
  pass1_artifact_id: string | null;
  pass2_artifact_id: string | null;
  pass3_artifact_id: string | null;
  convergence_artifact_id: string | null;
  canonical_artifact_id: string | null;
  summary_artifact_id: string | null;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
}

// === Audit Events ===

export interface JobAuditEvent {
  id: string;
  job_id: string;
  event_type:
    | "job_created"
    | "lease_acquired"
    | "pass_completed"
    | "convergence_completed"
    | "finalizer_started"
    | "finalizer_failed"
    | "canonical_artifact_persisted"
    | "summary_persisted"
    | "job_completed";
  actor_id: string | null;
  failure_code: FailureCode | null;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
