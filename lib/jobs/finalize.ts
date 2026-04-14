/**
 * Finalizer — RevisionGrade Phase 1
 * 
 * The sole truth gate between execution and canonical artifact publication.
 * 
 * Rules:
 * - No code path sets job.status = "complete" outside this module
 * - No report renders without Finalizer-approved canonical artifact
 * - No missing pass artifact tolerated
 * - No partial-complete states
 * - All decisions reconstructable from logs and persisted state
 * 
 * Architecture:
 * Layer 1 — Pure domain logic (validate, enforce, build)
 * Layer 2 — Side effects (fetch, persist, update)
 */

import type {
  EvaluationJob,
  PassArtifact,
  ConvergenceArtifact,
  CanonicalEvaluationArtifact,
  ReportSummaryProjection,
  FinalizeJobInput,
  FinalizeJobResult,
  PersistCanonicalAndSummaryAndCompleteArgs,
  PersistCanonicalAndSummaryAndCompleteResult,
  MarkJobFailedArgs,
} from "./finalize.types";
import type { FailureCode } from "./failures";
import {
  InvariantViolation,
  assertFinalizerAuthority,
  assertRequiredArtifactsPresent,
  enforcePassSeparation,
  enforceAnchorIntegrity,
  enforceA6Credibility,
  assertPreCompletionInvariants,
} from "./invariants";

// === Finalizer Version ===
export const FINALIZER_VERSION = "1.0.0";

// === Storage Interface (injected) ===

export interface FinalizerStorage {
  getJob(jobId: string): Promise<EvaluationJob | null>;
  getPassArtifact(artifactId: string): Promise<PassArtifact | null>;
  getConvergenceArtifact(artifactId: string): Promise<ConvergenceArtifact | null>;
  persistCanonicalAndSummaryAndCompleteJob(
    args: PersistCanonicalAndSummaryAndCompleteArgs,
  ): Promise<PersistCanonicalAndSummaryAndCompleteResult>;
  markJobFailed(args: MarkJobFailedArgs): Promise<void>;
}

// === Layer 1: Pure Domain Logic ===

export function buildCanonicalArtifact(args: {
  job: EvaluationJob;
  pass1: PassArtifact;
  pass2: PassArtifact;
  pass3: PassArtifact;
  convergence: ConvergenceArtifact;
}): CanonicalEvaluationArtifact {
  const { job, pass1, pass2, pass3, convergence } = args;

  // Compute overall score from convergence merged criteria
  const scores = convergence.merged_criteria.map((c) => c.score_0_10);
  const avgScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10)
    : 0;

  // Compute confidence from pass artifacts
  const confidences = [
    ...pass1.criteria.map((c) => c.confidence_0_1),
    ...pass2.criteria.map((c) => c.confidence_0_1),
    ...pass3.criteria.map((c) => c.confidence_0_1),
  ];
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  const allWarnings = [
    ...pass1.criteria.flatMap((c) => c.warnings),
    ...pass2.criteria.flatMap((c) => c.warnings),
    ...pass3.criteria.flatMap((c) => c.warnings),
  ];

  return {
    id: "", // Set by persistence layer
    job_id: job.id,
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    source: {
      pass1_artifact_id: pass1.id,
      pass2_artifact_id: pass2.id,
      pass3_artifact_id: pass3.id,
      convergence_artifact_id: convergence.id,
    },
    overview: {
      overall_score_0_100: avgScore,
      verdict: avgScore >= 70 ? "Pass" : "Needs Revision",
      one_paragraph_summary: convergence.overview_summary,
      top_strengths: [],
      top_risks: [],
    },
    criteria: convergence.merged_criteria,
    governance: {
      confidence_0_1: Math.round(avgConfidence * 100) / 100,
      warnings: allWarnings,
      limitations: [],
      transparency_passed: true,
      anchor_contract_passed: convergence.validations.anchor_contract_valid,
      canonical_ready: convergence.validations.schema_valid
        && convergence.validations.pass_separation_preserved
        && convergence.validations.all_required_passes_present
        && convergence.validations.anchor_contract_valid,
    },
    eligibility: {
      structural_pass: avgScore >= 50,
      refinement_unlocked: avgScore >= 40,
      wave_unlocked: avgScore >= 70,
      submission_packaging_unlocked: avgScore >= 80,
      reason: null,
    },
    provenance: {
      evaluator_version: pass1.provenance.evaluator_version,
      prompt_pack_version: pass1.provenance.prompt_pack_version,
      run_id: pass1.provenance.run_id,
      finalizer_version: FINALIZER_VERSION,
    },
  };
}

export function buildReportSummaryProjection(
  job: EvaluationJob,
  canonical: CanonicalEvaluationArtifact,
  canonicalArtifactId: string,
): ReportSummaryProjection {
  return {
    id: "", // Set by persistence layer
    job_id: job.id,
    user_id: job.user_id,
    canonical_artifact_id: canonicalArtifactId,
    generated_at: new Date().toISOString(),
    overall_score_0_100: canonical.overview.overall_score_0_100,
    verdict: canonical.overview.verdict,
    one_paragraph_summary: canonical.overview.one_paragraph_summary,
    top_3_strengths: canonical.overview.top_strengths.slice(0, 3),
    top_3_risks: canonical.overview.top_risks.slice(0, 3),
    confidence_0_1: canonical.governance.confidence_0_1,
    warnings_count: canonical.governance.warnings.length,
    structural_pass: canonical.eligibility.structural_pass,
    refinement_unlocked: canonical.eligibility.refinement_unlocked,
    wave_unlocked: canonical.eligibility.wave_unlocked,
    submission_packaging_unlocked: canonical.eligibility.submission_packaging_unlocked,
  };
}

function validateCanonicalArtifact(canonical: CanonicalEvaluationArtifact): void {
  if (!canonical.governance.canonical_ready) {
    throw new InvariantViolation(
      "SCHEMA_ERROR",
      `Canonical artifact not marked as ready`,
    );
  }
  if (!canonical.schema_version) {
    throw new InvariantViolation(
      "SCHEMA_ERROR",
      `Canonical artifact missing schema_version`,
    );
  }
}

// === Layer 2: Side Effects (Finalizer Entry Point) ===

export async function finalizeJob(
  input: FinalizeJobInput,
  storage: FinalizerStorage,
): Promise<FinalizeJobResult> {
  let failureWriteAuthorized = false;

  try {
    // Step 1: Acquire and verify authority
    const job = await storage.getJob(input.job_id);
    if (!job) {
      return failResult(input.job_id, "VALIDATION_ERROR", `Job ${input.job_id} not found`);
    }
    assertFinalizerAuthority(job, input.worker_id);
    failureWriteAuthorized = true;

    // Step 2: Verify pass artifact presence
    const refs = assertRequiredArtifactsPresent(job);

    // Step 3: Load all artifacts
    const pass1 = await storage.getPassArtifact(refs.pass1_artifact_id);
    const pass2 = await storage.getPassArtifact(refs.pass2_artifact_id);
    const pass3 = await storage.getPassArtifact(refs.pass3_artifact_id);
    const convergence = await storage.getConvergenceArtifact(refs.convergence_artifact_id);

    if (!pass1 || !pass2 || !pass3) {
      const missing = [!pass1 && "pass1", !pass2 && "pass2", !pass3 && "pass3"].filter(Boolean);
      return failResult(input.job_id, "MISSING_PASS_ARTIFACT", `Missing artifacts: ${missing.join(", ")}`);
    }
    if (!convergence) {
      return failResult(input.job_id, "PASS_CONVERGENCE_FAILURE", "Convergence artifact not found");
    }

    // Step 5: Pass separation enforcement
    enforcePassSeparation(pass1, pass2, pass3, convergence);

    // Step 6: Anchor integrity
    enforceAnchorIntegrity(pass1, pass2, pass3, convergence);

    // Step 7: A6 credibility
    enforceA6Credibility(pass1, pass2, pass3, convergence);

    // Step 8: Build canonical artifact
    const canonical = buildCanonicalArtifact({ job, pass1, pass2, pass3, convergence });

    // Step 9: Validate canonical artifact
    validateCanonicalArtifact(canonical);

    // Step 10: Build summary projection candidate (IDs finalized in write authority)
    const summaryCandidate = buildReportSummaryProjection(job, canonical, "pending");

    // Step 11: Terminal atomic write authority
    const completion = await storage.persistCanonicalAndSummaryAndCompleteJob({
      job,
      worker_id: input.worker_id,
      canonical,
      summary: summaryCandidate,
    });

    // Step 12: Pre-completion invariants (post-write IDs)
    assertPreCompletionInvariants({
      job_id: job.id,
      canonical_artifact_id: completion.canonical_artifact_id,
      summary_artifact_id: completion.summary_artifact_id,
      worker_id: input.worker_id,
    });

    return {
      ok: true,
      job_id: job.id,
      canonical_artifact_id: completion.canonical_artifact_id,
      summary_artifact_id: completion.summary_artifact_id,
      final_status: "complete",
    };
  } catch (error) {
    if (error instanceof InvariantViolation) {
      if (failureWriteAuthorized) {
        await storage.markJobFailed({
          job_id: input.job_id,
          worker_id: input.worker_id,
          failure_code: error.failureCode,
          last_error: error.message,
        });
      }
      return failResult(input.job_id, error.failureCode, error.message);
    }
    // Unknown error — classify as validation error, do not retry
    const message = error instanceof Error ? error.message : String(error);
    if (failureWriteAuthorized) {
      await storage.markJobFailed({
        job_id: input.job_id,
        worker_id: input.worker_id,
        failure_code: "VALIDATION_ERROR",
        last_error: message,
      });
    }
    return failResult(input.job_id, "VALIDATION_ERROR", message);
  }
}

function failResult(
  jobId: string,
  failureCode: FailureCode,
  reason: string,
): FinalizeJobResult {
  return {
    ok: false,
    job_id: jobId,
    failure_code: failureCode,
    final_status: "failed",
    reason,
  };
}
