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
  CanonicalValidationIssue,
  CanonicalValidityStatus,
  ReportSummaryProjection,
  FinalizeJobInput,
  FinalizeJobResult,
  PersistCanonicalAndSummaryAndCompleteArgs,
  PersistCanonicalAndSummaryAndCompleteResult,
  PersistInvalidCanonicalArgs,
  PersistInvalidCanonicalResult,
  MarkJobInvalidArgs,
  MarkJobFailedArgs,
} from "./finalize.types";
import type { FailureCode } from "./failures";
import {
  InvariantViolation,
  assertFinalizerAuthority,
  assertRequiredArtifactsPresent,
  enforcePassSeparation,
  enforceCriterionCompleteness,
  enforceAnchorIntegrity,
  enforceA6Credibility,
  assertPreCompletionInvariants,
} from "./invariants";
import {
  deriveConfidence,
  CONFIDENCE_DERIVATION_VERSION,
  type ConfidenceInputs,
} from "../governance/confidenceDerivation";
import { CRITERIA_KEYS } from "../../schemas/criteria-keys";

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
  persistInvalidCanonicalArtifact(
    args: PersistInvalidCanonicalArgs,
  ): Promise<PersistInvalidCanonicalResult>;
  markJobInvalid(args: MarkJobInvalidArgs): Promise<void>;
  markJobFailed(args: MarkJobFailedArgs): Promise<void>;
}

// === U1.1: Build ConfidenceInputs from finalizer scope ===
export function buildConfidenceInputs(args: {
  pass1: PassArtifact;
  pass2: PassArtifact;
  pass3: PassArtifact;
  convergence: ConvergenceArtifact;
}): ConfidenceInputs {
  const { pass1, pass2, pass3, convergence } = args;

  // Criterion completeness: all 3 passes have criteria and convergence merged them
  const criterionCompletenessPassed =
    pass1.criteria.length > 0 &&
    pass2.criteria.length > 0 &&
    pass3.criteria.length > 0 &&
    convergence.merged_criteria.length > 0;

  // Anchor integrity from convergence validations
  const anchorIntegrityPassed = convergence.validations.anchor_contract_valid;

  // Governance: schema valid across all inputs
  const governancePassed =
    pass1.validations.schema_valid &&
    pass2.validations.schema_valid &&
    pass3.validations.schema_valid &&
    convergence.validations.schema_valid;

  // Pass convergence
  const passConvergencePassed =
    convergence.validations.all_required_passes_present &&
    convergence.validations.pass_separation_preserved;

  // Material pass disagreement: check if any criterion has >3pt spread across passes
  const hasMaterialPassDisagreement = pass1.criteria.some((c1) => {
    const c2 = pass2.criteria.find((c) => c.criterion_id === c1.criterion_id);
    const c3 = pass3.criteria.find((c) => c.criterion_id === c1.criterion_id);
    if (!c2 || !c3) return false;
    const scores = [c1.score_0_10, c2.score_0_10, c3.score_0_10];
    return Math.max(...scores) - Math.min(...scores) > 3;
  });

  // U2.1: unresolved Pass 1 incompleteness after downstream convergence.
  // We count only criteria still absent from the convergence artifact, not raw Pass 1 gaps
  // that were later recovered/resolved downstream.
  const pass1CriterionIds = new Set(pass1.criteria.map((c) => c.criterion_id));
  const convergenceCriterionIds = new Set(
    convergence.merged_criteria.map((c) => c.criterion_id),
  );
  const pass1IncompleteCount = CRITERIA_KEYS.filter(
    (criterionId) =>
      !pass1CriterionIds.has(criterionId) &&
      !convergenceCriterionIds.has(criterionId),
  ).length;

  // Evidence coverage: strong if all passes report evidence_nonempty, partial if mixed
  const evidenceFlags = [pass1, pass2, pass3].map((p) => p.validations.evidence_nonempty);
  const evidenceCoverage: ConfidenceInputs["evidenceCoverage"] =
    evidenceFlags.every(Boolean)
      ? "strong"
      : evidenceFlags.some(Boolean)
        ? "partial"
        : "thin";

  return {
    criterionCompletenessPassed,
    anchorIntegrityPassed,
    governancePassed,
    passConvergencePassed,
    hasMaterialPassDisagreement,
    pass1IncompleteCount,
    usedFallbackPath: false,
    executionDegraded: false,
    invalidOutput: false,
    quarantinedOutput: false,
    evidenceCoverage,
  };
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
  const avgScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10)
      : 0;

  // Compute confidence from pass artifacts
  const confidences = [
    ...pass1.criteria.map((c) => c.confidence_0_1),
    ...pass2.criteria.map((c) => c.confidence_0_1),
    ...pass3.criteria.map((c) => c.confidence_0_1),
  ];
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  const allWarnings = [
    ...pass1.criteria.flatMap((c) => c.warnings),
    ...pass2.criteria.flatMap((c) => c.warnings),
    ...pass3.criteria.flatMap((c) => c.warnings),
  ];

  // U1.1: Derive confidence label from structured signals
  const confidenceInputs = buildConfidenceInputs({ pass1, pass2, pass3, convergence });
  const confidenceResult = deriveConfidence(confidenceInputs);

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
      canonical_ready:
        convergence.validations.schema_valid &&
        convergence.validations.pass_separation_preserved &&
        convergence.validations.all_required_passes_present &&
        convergence.validations.anchor_contract_valid,
      validity_status: "valid",
      validation_issues: [],
      release_blocked: false,
      // U1.1 wiring
      confidence_label: confidenceResult.confidence,
      confidence_reasons: confidenceResult.reasons,
      confidence_derivation_version: CONFIDENCE_DERIVATION_VERSION,
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

export function deriveValidityStatus(
  issues: CanonicalValidationIssue[],
): CanonicalValidityStatus {
  return issues.length === 0 ? "valid" : "invalid";
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

export function validateCanonicalArtifact(
  canonical: CanonicalEvaluationArtifact,
): CanonicalValidationIssue[] {
  const issues: CanonicalValidationIssue[] = [];
  const requiredKeys = new Set<string>(CRITERIA_KEYS);
  const seen = new Set<string>();

  if (!canonical.schema_version) {
    issues.push({
      criterion_id: "__artifact__",
      code: "NON_CANONICAL_CRITERION",
      detail: "Canonical artifact missing schema_version",
    });
  }

  if (!canonical.governance.canonical_ready) {
    issues.push({
      criterion_id: "__artifact__",
      code: "NON_CANONICAL_CRITERION",
      detail: "Canonical artifact not marked canonical_ready",
    });
  }

  for (const criterion of canonical.criteria) {
    if (!requiredKeys.has(criterion.criterion_id)) {
      issues.push({
        criterion_id: criterion.criterion_id,
        code: "NON_CANONICAL_CRITERION",
        detail: `Non-canonical criterion id \"${criterion.criterion_id}\"`,
      });
      continue;
    }

    if (seen.has(criterion.criterion_id)) {
      issues.push({
        criterion_id: criterion.criterion_id,
        code: "DUPLICATE_CRITERION",
        detail: `Duplicate criterion \"${criterion.criterion_id}\"`,
      });
      continue;
    }

    seen.add(criterion.criterion_id);

    if (
      typeof criterion.score_0_10 !== "number" ||
      !Number.isFinite(criterion.score_0_10) ||
      criterion.score_0_10 < 0 ||
      criterion.score_0_10 > 10
    ) {
      issues.push({
        criterion_id: criterion.criterion_id,
        code: "INVALID_SCORE",
        detail: `Invalid score (${criterion.score_0_10})`,
      });
    }

    if (!criterion.rationale || criterion.rationale.trim().length === 0) {
      issues.push({
        criterion_id: criterion.criterion_id,
        code: "MISSING_REASONING",
        detail: "Reasoning/rationale is empty",
      });
    }

    if (!criterion.evidence || criterion.evidence.length === 0) {
      issues.push({
        criterion_id: criterion.criterion_id,
        code: "MISSING_EVIDENCE",
        detail: "Evidence anchors are empty",
      });
    }
  }

  for (const key of requiredKeys) {
    if (!seen.has(key)) {
      issues.push({
        criterion_id: key,
        code: "MISSING_CRITERION",
        detail: `Missing canonical criterion \"${key}\"`,
      });
    }
  }

  return issues;
}

// === Layer 2: Side Effects (Finalizer Entry Point) ===

export async function finalizeJob(
  input: FinalizeJobInput,
  storage: FinalizerStorage,
): Promise<FinalizeJobResult> {
  let failureWriteAuthorized = false;
  let criterionCompletenessViolation: InvariantViolation | null = null;

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

    // Step 5.5: Criterion completeness gate (Item #8)
    try {
      enforceCriterionCompleteness(pass1, pass2, pass3);
    } catch (error) {
      if (
        error instanceof InvariantViolation
        && error.failureCode === "CRITERION_COMPLETENESS_FAILED"
      ) {
        criterionCompletenessViolation = error;
      } else {
        throw error;
      }
    }

    // Step 6: Anchor integrity
    if (!criterionCompletenessViolation) {
      enforceAnchorIntegrity(pass1, pass2, pass3, convergence);
    }

    // Step 7: A6 credibility
    if (!criterionCompletenessViolation) {
      enforceA6Credibility(pass1, pass2, pass3, convergence);
    }

    // Step 8: Build canonical artifact (includes U1.1 confidence derivation)
    const canonical = buildCanonicalArtifact({ job, pass1, pass2, pass3, convergence });

    // Step 9: Validate canonical artifact
    const validationIssues = validateCanonicalArtifact(canonical);
    if (criterionCompletenessViolation) {
      validationIssues.push({
        criterion_id: "__artifact__",
        code: "MISSING_CRITERION",
        detail: criterionCompletenessViolation.message,
      });
    }

    // Step 9.5: Derive validity and route invalid outputs to blocked-release path
    const validityStatus = deriveValidityStatus(validationIssues);
    canonical.governance.validity_status = validityStatus;
    canonical.governance.validation_issues = validationIssues;
    canonical.governance.release_blocked = validityStatus === "invalid";

    if (validityStatus === "invalid") {
      canonical.overview.overall_score_0_100 = 0;
      canonical.overview.verdict = "Invalid";
      canonical.eligibility = {
        structural_pass: false,
        refinement_unlocked: false,
        wave_unlocked: false,
        submission_packaging_unlocked: false,
        reason: "Evaluation invalid: canonical completeness contract failed",
      };
      canonical.governance.confidence_label = "withheld";

      const invalidWrite = await storage.persistInvalidCanonicalArtifact({
        job,
        worker_id: input.worker_id,
        canonical,
      });

      await storage.markJobInvalid({
        job_id: job.id,
        worker_id: input.worker_id,
        canonical_artifact_id: invalidWrite.canonical_artifact_id,
        last_error: `Canonical validation failed: ${validationIssues
          .map((issue) => `${issue.criterion_id}:${issue.code}`)
          .join(", ")}`,
      });

      return {
        ok: false,
        job_id: job.id,
        canonical_artifact_id: invalidWrite.canonical_artifact_id,
        final_status: "invalid",
        reason: "Canonical validation failed",
        validation_issues: validationIssues,
      };
    }

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
