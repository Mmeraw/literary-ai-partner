import { finalizeJob, type FinalizerStorage } from "@/lib/jobs/finalize";
import { describe, expect, jest, test } from "@jest/globals";
import type {
  ConvergenceArtifact,
  EvaluationJob,
  PassArtifact,
} from "@/lib/jobs/finalize.types";

function makePass(passId: "pass1" | "pass2" | "pass3", id: string): PassArtifact {
  return {
    id,
    job_id: "job-1",
    pass_id: passId,
    schema_version: "pass-artifact-v1",
    manuscript_revision_id: "rev-1",
    generated_at: new Date().toISOString(),
    summary: `${passId} summary`,
    criteria: [
      {
        criterion_id: "structure",
        score_0_10: 8,
        rationale: "Supported by evidence.",
        confidence_0_1: 0.8,
        evidence: [
          {
            anchor_id: `${id}-a1`,
            source_type: "manuscript_chunk",
            source_ref: "chunk-1",
            start_offset: 10,
            end_offset: 25,
            excerpt: "Example excerpt",
          },
        ],
        warnings: [],
      },
    ],
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

function makeConvergence(): ConvergenceArtifact {
  return {
    id: "conv-1",
    job_id: "job-1",
    schema_version: "convergence-artifact-v1",
    generated_at: new Date().toISOString(),
    inputs: {
      pass1_artifact_id: "p1",
      pass2_artifact_id: "p2",
      pass3_artifact_id: "p3",
    },
    merged_criteria: [
      {
        criterion_id: "structure",
        score_0_10: 8,
        rationale: "Merged rationale.",
        confidence_0_1: 0.85,
        evidence: [
          {
            anchor_id: "conv-a1",
            source_type: "manuscript_chunk",
            source_ref: "chunk-1",
            start_offset: 10,
            end_offset: 25,
            excerpt: "Merged excerpt",
          },
        ],
        warnings: [],
      },
    ],
    overview_summary: "Overall convergence summary.",
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

function makeJob(): EvaluationJob {
  return {
    id: "job-1",
    user_id: "user-1",
    status: "running",
    phase: "finalizer",
    progress_percent: 95,
    submission_idempotency_key: "idem-1",
    claimed_by: "worker-1",
    lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    attempt_count: 0,
    next_retry_at: null,
    failure_code: null,
    last_error: null,
    pass1_artifact_id: "p1",
    pass2_artifact_id: "p2",
    pass3_artifact_id: "p3",
    convergence_artifact_id: "conv-1",
    canonical_artifact_id: null,
    summary_artifact_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    terminal_at: null,
  };
}

function makeStorage(
  completionImpl?: jest.MockedFunction<
    FinalizerStorage["persistCanonicalAndSummaryAndCompleteJob"]
  >,
): jest.Mocked<FinalizerStorage> {
  const pass1 = makePass("pass1", "p1");
  const pass2 = makePass("pass2", "p2");
  const pass3 = makePass("pass3", "p3");

  return {
    getJob: jest.fn(async () => makeJob()),
    getPassArtifact: jest.fn(async (id: string) => {
      if (id === "p1") return pass1;
      if (id === "p2") return pass2;
      if (id === "p3") return pass3;
      return null;
    }),
    getConvergenceArtifact: jest.fn(async () => makeConvergence()),
    persistCanonicalAndSummaryAndCompleteJob:
      completionImpl
      ?? jest.fn(async () => ({ canonical_artifact_id: "canon-1", summary_artifact_id: "sum-1" })),
    markJobFailed: jest.fn(async () => undefined),
  };
}

describe("finalize persistence authority", () => {
  test("completes atomically when canonical + summary + job update all succeed", async () => {
    const storage = makeStorage();

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
    expect(storage.persistCanonicalAndSummaryAndCompleteJob).toHaveBeenCalledTimes(1);
    expect(storage.markJobFailed).not.toHaveBeenCalled();
  });

  test("fails closed when canonical artifact write fails", async () => {
    const storage = makeStorage(
      jest.fn(async () => {
        throw new Error("canonical insert failed");
      }),
    );

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result.ok).toBe(false);
    expect(storage.markJobFailed).toHaveBeenCalledTimes(1);
  });

  test("fails closed when summary projection write fails", async () => {
    const storage = makeStorage(
      jest.fn(async () => {
        throw new Error("summary insert failed");
      }),
    );

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result.ok).toBe(false);
    expect(storage.markJobFailed).toHaveBeenCalledTimes(1);
  });

  test("fails closed when completion update authority check fails", async () => {
    const storage = makeStorage(
      jest.fn(async () => {
        throw new Error("FINALIZER_AUTHORITY_VIOLATION: claim mismatch");
      }),
    );

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result.ok).toBe(false);
    expect(storage.markJobFailed).toHaveBeenCalledTimes(1);
  });

  test("does not allow duplicate canonical artifact completion", async () => {
    const storage = makeStorage(
      jest.fn(async () => {
        throw new Error("duplicate key value violates unique constraint");
      }),
    );

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result.ok).toBe(false);
    expect(storage.markJobFailed).toHaveBeenCalledTimes(1);
  });

  test("does not leave partial-complete state on any intermediate failure", async () => {
    const storage = makeStorage(
      jest.fn(async () => {
        throw new Error("atomic boundary aborted");
      }),
    );

    const result = await finalizeJob(
      {
        job_id: "job-1",
        worker_id: "worker-1",
        expected_status: "running",
        expected_phase: "finalizer",
      },
      storage,
    );

    expect(result.ok).toBe(false);
    expect(storage.persistCanonicalAndSummaryAndCompleteJob).toHaveBeenCalledTimes(1);
    expect(storage.markJobFailed).toHaveBeenCalledTimes(1);
  });

  test("fails if job is already terminal", async () => {
    const storage = makeStorage();
    storage.getJob.mockResolvedValueOnce({
      ...makeJob(),
      status: "complete",
      terminal_at: new Date().toISOString(),
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

    expect(result.ok).toBe(false);
    expect(storage.persistCanonicalAndSummaryAndCompleteJob).not.toHaveBeenCalled();
    expect(storage.markJobFailed).not.toHaveBeenCalled();
  });

  test("does not attempt failure write when authority was never established", async () => {
    const storage = makeStorage();
    storage.getJob.mockResolvedValueOnce({
      ...makeJob(),
      claimed_by: "other-worker",
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

    expect(result.ok).toBe(false);
    expect(storage.persistCanonicalAndSummaryAndCompleteJob).not.toHaveBeenCalled();
    expect(storage.markJobFailed).not.toHaveBeenCalled();
  });
});
