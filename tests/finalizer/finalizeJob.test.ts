import { describe, expect, jest, test } from "@jest/globals";
import { finalizeJob, type FinalizerStorage } from "@/lib/jobs/finalize";
import type {
  EvaluationJob,
  PassArtifact,
  ConvergenceArtifact,
  CanonicalEvaluationArtifact,
  ReportSummaryProjection,
} from "@/lib/jobs/finalize.types";

function baseJob(overrides: Partial<EvaluationJob> = {}): EvaluationJob {
  return {
    id: "job-1",
    user_id: "user-1",
    status: "running",
    phase: "finalizer",
    progress_percent: 90,
    submission_idempotency_key: null,
    claimed_by: "worker-1",
    lease_expires_at: "2099-01-01T00:00:00.000Z",
    attempt_count: 1,
    next_retry_at: null,
    failure_code: null,
    last_error: null,
    pass1_artifact_id: "p1",
    pass2_artifact_id: "p2",
    pass3_artifact_id: "p3",
    convergence_artifact_id: "conv-1",
    canonical_artifact_id: null,
    summary_artifact_id: null,
    created_at: "2026-04-04T00:00:00.000Z",
    updated_at: "2026-04-04T00:00:00.000Z",
    terminal_at: null,
    ...overrides,
  };
}

function basePass(pass_id: "pass1" | "pass2" | "pass3", id: string): PassArtifact {
  return {
    id,
    job_id: "job-1",
    pass_id,
    schema_version: "1.0.0",
    manuscript_revision_id: "rev-1",
    generated_at: "2026-04-04T00:00:00.000Z",
    summary: "summary",
    criteria: [
      {
        criterion_id: "clarity",
        score_0_10: 8,
        rationale: "Strong clarity",
        confidence_0_1: 0.9,
        evidence: [
          {
            anchor_id: `${id}-a1`,
            source_type: "manuscript_chunk",
            source_ref: "chunk-1",
            start_offset: 0,
            end_offset: 10,
            excerpt: "example",
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

function baseConvergence(): ConvergenceArtifact {
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
    merged_criteria: [
      {
        criterion_id: "clarity",
        score_0_10: 8,
        rationale: "Merged rationale",
        confidence_0_1: 0.88,
        evidence: [
          {
            anchor_id: "conv-a1",
            source_type: "manuscript_span",
            source_ref: "span-1",
            start_offset: 0,
            end_offset: 12,
            excerpt: "span",
          },
        ],
        warnings: [],
      },
    ],
    overview_summary: "Converged summary",
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

function storageWith(overrides: Partial<FinalizerStorage> = {}): FinalizerStorage {
  const canonical = async (_artifact: CanonicalEvaluationArtifact) => "canon-1";
  const summary = async (_summary: ReportSummaryProjection) => "summary-1";

  return {
    getJob: async () => baseJob(),
    getPassArtifact: async (artifactId: string) => {
      if (artifactId === "p1") return basePass("pass1", "p1");
      if (artifactId === "p2") return basePass("pass2", "p2");
      if (artifactId === "p3") return basePass("pass3", "p3");
      return null;
    },
    getConvergenceArtifact: async () => baseConvergence(),
    persistCanonicalArtifact: canonical,
    persistSummaryProjection: summary,
    markJobComplete: async () => undefined,
    markJobFailed: async () => undefined,
    ...overrides,
  };
}

describe("finalizeJob", () => {
  test("completes successfully with canonical + summary artifact IDs", async () => {
    const markJobComplete = jest.fn(async (_args: any) => undefined);
    const markJobFailed = jest.fn(async (_args: any) => undefined);

    const storage = storageWith({ markJobComplete, markJobFailed });

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.final_status).toBe("complete");
      expect(result.canonical_artifact_id).toBe("canon-1");
      expect(result.summary_artifact_id).toBe("summary-1");
    }

    expect(markJobComplete).toHaveBeenCalledTimes(1);
    expect(markJobFailed).not.toHaveBeenCalled();
  });

  test("fails closed with MISSING_PASS_ARTIFACT when required pass reference is absent", async () => {
    const markJobFailed = jest.fn(async (_args: any) => undefined);

    const storage = storageWith({
      getJob: async () => baseJob({ pass3_artifact_id: null }),
      markJobFailed,
    });

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result).toMatchObject({
      ok: false,
      final_status: "failed",
      failure_code: "MISSING_PASS_ARTIFACT",
    });

    expect(markJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({ failure_code: "MISSING_PASS_ARTIFACT" }),
    );
  });

  test("fails closed with LEASE_EXPIRED on worker mismatch", async () => {
    const markJobFailed = jest.fn(async (_args: any) => undefined);

    const storage = storageWith({
      getJob: async () => baseJob({ claimed_by: "different-worker" }),
      markJobFailed,
    });

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result).toMatchObject({
      ok: false,
      final_status: "failed",
      failure_code: "LEASE_EXPIRED",
    });

    expect(markJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({ failure_code: "LEASE_EXPIRED" }),
    );
  });

  test("unknown storage errors are classified as VALIDATION_ERROR", async () => {
    const markJobFailed = jest.fn(async (_args: any) => undefined);

    const storage = storageWith({
      persistCanonicalArtifact: async () => {
        throw new Error("db write exploded");
      },
      markJobFailed,
    });

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result).toMatchObject({
      ok: false,
      final_status: "failed",
      failure_code: "VALIDATION_ERROR",
    });

    expect(markJobFailed).toHaveBeenCalledWith(
      expect.objectContaining({ failure_code: "VALIDATION_ERROR" }),
    );
  });
});
