/**
 * Runtime Invariant Checks — RevisionGrade Phase 1
 *
 * These invariants MUST block execution. They are not warnings.
 * Violation = immediate failure with classified error.
 */
import type {
  EvaluationJob,
  PassArtifact,
  ConvergenceArtifact,
  CanonicalEvaluationArtifact,
} from "./finalize.types";
import type { FailureCode } from "./failures";
import { CRITERIA_KEYS } from "../../schemas/criteria-keys";

export class InvariantViolation extends Error {
  constructor(
    public readonly failureCode: FailureCode,
    message: string,
  ) {
    super(`[INVARIANT:${failureCode}] ${message}`);
    this.name = "InvariantViolation";
  }
}

// === Finalizer Authority ===

export function assertFinalizerAuthority(
  job: EvaluationJob,
  workerId: string,
): void {
  if (job.status !== "running") {
    throw new InvariantViolation(
      "STATE_TRANSITION_INVALID",
      `Job ${job.id} status is '${job.status}', expected 'running'`,
    );
  }
  if (job.phase !== "finalizer") {
    throw new InvariantViolation(
      "STATE_TRANSITION_INVALID",
      `Job ${job.id} phase is '${job.phase}', expected 'finalizer'`,
    );
  }
  if (job.claimed_by !== workerId) {
    throw new InvariantViolation(
      "LEASE_EXPIRED",
      `Job ${job.id} claimed by '${job.claimed_by}', worker is '${workerId}'`,
    );
  }
  if (job.lease_expires_at && new Date(job.lease_expires_at) < new Date()) {
    throw new InvariantViolation(
      "LEASE_EXPIRED",
      `Job ${job.id} lease expired at ${job.lease_expires_at}`,
    );
  }
}

// === Pass Artifact Presence ===

export function assertRequiredArtifactsPresent(job: EvaluationJob): {
  pass1_artifact_id: string;
  pass2_artifact_id: string;
  pass3_artifact_id: string;
  convergence_artifact_id: string;
} {
  if (!job.pass1_artifact_id) {
    throw new InvariantViolation("MISSING_PASS_ARTIFACT", `Job ${job.id}: pass1 artifact missing`);
  }
  if (!job.pass2_artifact_id) {
    throw new InvariantViolation("MISSING_PASS_ARTIFACT", `Job ${job.id}: pass2 artifact missing`);
  }
  if (!job.pass3_artifact_id) {
    throw new InvariantViolation("MISSING_PASS_ARTIFACT", `Job ${job.id}: pass3 artifact missing`);
  }
  if (!job.convergence_artifact_id) {
    throw new InvariantViolation("PASS_CONVERGENCE_FAILURE", `Job ${job.id}: convergence artifact missing`);
  }
  return {
    pass1_artifact_id: job.pass1_artifact_id,
    pass2_artifact_id: job.pass2_artifact_id,
    pass3_artifact_id: job.pass3_artifact_id,
    convergence_artifact_id: job.convergence_artifact_id,
  };
}

// === Pass Separation ===

export function enforcePassSeparation(
  pass1: PassArtifact,
  pass2: PassArtifact,
  pass3: PassArtifact,
  convergence: ConvergenceArtifact,
): void {
  const ids = [pass1.id, pass2.id, pass3.id];
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== 3) {
    throw new InvariantViolation(
      "PASS_CONVERGENCE_FAILURE",
      `Pass artifact IDs are not distinct: ${ids.join(", ")}`,
    );
  }
  // Verify convergence references correct pass artifacts
  if (
    convergence.inputs.pass1_artifact_id !== pass1.id ||
    convergence.inputs.pass2_artifact_id !== pass2.id ||
    convergence.inputs.pass3_artifact_id !== pass3.id
  ) {
    throw new InvariantViolation(
      "PASS_CONVERGENCE_FAILURE",
      `Convergence inputs do not match loaded pass artifacts`,
    );
  }
}

// === Criterion Completeness (Item #8 Validity Gate) ===

export function enforceCriterionCompleteness(
  pass1: PassArtifact,
  pass2: PassArtifact,
  pass3: PassArtifact,
): void {
  const requiredKeys = new Set<string>(CRITERIA_KEYS);
  const allArtifacts = [
    { label: "pass1", artifact: pass1 },
    { label: "pass2", artifact: pass2 },
    { label: "pass3", artifact: pass3 },
  ];

  for (const { label, artifact } of allArtifacts) {
    // Check for non-canonical or duplicate criterion IDs
    const seen = new Set<string>();
    for (const criterion of artifact.criteria) {
      if (!requiredKeys.has(criterion.criterion_id)) {
        throw new InvariantViolation(
          "CRITERION_COMPLETENESS_FAILED",
          `${label}: non-canonical criterion id "${criterion.criterion_id}"`,
        );
      }
      if (seen.has(criterion.criterion_id)) {
        throw new InvariantViolation(
          "CRITERION_COMPLETENESS_FAILED",
          `${label}: duplicate criterion id "${criterion.criterion_id}"`,
        );
      }
      seen.add(criterion.criterion_id);
    }

    // Check all 13 criteria are present (exactly once, after uniqueness pass)
    const missing: string[] = [];
    for (const key of requiredKeys) {
      if (!seen.has(key)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new InvariantViolation(
        "CRITERION_COMPLETENESS_FAILED",
        `${label}: missing criteria [${missing.join(", ")}]`,
      );
    }

    // Check each criterion has score, rationale, and evidence
    for (const criterion of artifact.criteria) {
      if (
        typeof criterion.score_0_10 !== "number" ||
        !Number.isFinite(criterion.score_0_10) ||
        criterion.score_0_10 < 0 ||
        criterion.score_0_10 > 10
      ) {
        throw new InvariantViolation(
          "CRITERION_COMPLETENESS_FAILED",
          `${label} criterion ${criterion.criterion_id}: invalid score (${criterion.score_0_10})`,
        );
      }
      if (!criterion.rationale || criterion.rationale.trim().length === 0) {
        throw new InvariantViolation(
          "CRITERION_COMPLETENESS_FAILED",
          `${label} criterion ${criterion.criterion_id}: empty rationale`,
        );
      }
      if (!criterion.evidence || criterion.evidence.length === 0) {
        throw new InvariantViolation(
          "CRITERION_COMPLETENESS_FAILED",
          `${label} criterion ${criterion.criterion_id}: no evidence anchors`,
        );
      }
    }
  }
}

// === Anchor Integrity ===

export function enforceAnchorIntegrity(
  pass1: PassArtifact,
  pass2: PassArtifact,
  pass3: PassArtifact,
  convergence: ConvergenceArtifact,
): void {
  const allArtifacts = [pass1, pass2, pass3];
  for (const artifact of allArtifacts) {
    for (const criterion of artifact.criteria) {
      if (criterion.evidence.length === 0 && criterion.rationale.length > 0) {
        throw new InvariantViolation(
          "ANCHOR_CONTRACT_VIOLATION",
          `Pass ${artifact.pass_id} criterion ${criterion.criterion_id}: rationale without evidence`,
        );
      }
      for (const anchor of criterion.evidence) {
        if (!anchor.anchor_id || !anchor.source_ref) {
          throw new InvariantViolation(
            "ANCHOR_CONTRACT_VIOLATION",
            `Pass ${artifact.pass_id} criterion ${criterion.criterion_id}: phantom anchor`,
          );
        }
        if (
          anchor.start_offset !== null
          && anchor.end_offset !== null
          && anchor.end_offset < anchor.start_offset
        ) {
          throw new InvariantViolation(
            "ANCHOR_CONTRACT_VIOLATION",
            `Pass ${artifact.pass_id} criterion ${criterion.criterion_id}: invalid anchor offsets`,
          );
        }
      }
    }
  }
}

// === A6 Credibility ===

export function enforceA6Credibility(
  pass1: PassArtifact,
  pass2: PassArtifact,
  pass3: PassArtifact,
  convergence: ConvergenceArtifact,
): void {
  const allArtifacts = [pass1, pass2, pass3];
  for (const artifact of allArtifacts) {
    if (!artifact.validations.orphan_reasoning_absent) {
      throw new InvariantViolation(
        "GOVERNANCE_BLOCK",
        `Pass ${artifact.pass_id}: orphan reasoning detected`,
      );
    }
    if (!artifact.provenance.evaluator_version || !artifact.provenance.run_id) {
      throw new InvariantViolation(
        "GOVERNANCE_BLOCK",
        `Pass ${artifact.pass_id}: missing provenance trace`,
      );
    }
  }
}

// === Pre-Completion Invariants ===

export function assertPreCompletionInvariants(args: {
  job_id: string;
  canonical_artifact_id: string;
  summary_artifact_id: string;
  worker_id: string;
}): void {
  if (!args.canonical_artifact_id) {
    throw new InvariantViolation(
      "CANONICAL_ARTIFACT_WRITE_FAILED",
      `Job ${args.job_id}: canonical artifact ID is empty`,
    );
  }
  if (!args.summary_artifact_id) {
    throw new InvariantViolation(
      "SUMMARY_PROJECTION_FAILED",
      `Job ${args.job_id}: summary artifact ID is empty`,
    );
  }
}
