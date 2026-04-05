import { finalizeJob, type FinalizerStorage } from '@/lib/jobs/finalize';
import type {
  ConvergenceArtifact,
  EvaluationJob,
  PassArtifact,
} from '@/lib/jobs/finalize.types';

function makePass(passId: 'pass1' | 'pass2' | 'pass3', id: string): PassArtifact {
  return {
    id,
    job_id: 'job-1',
    pass_id: passId,
    schema_version: 'pass-artifact-v1',
    manuscript_revision_id: 'rev-1',
    generated_at: new Date().toISOString(),
    summary: `${passId} summary`,
    criteria: [
      {
        criterion_id: 'structure',
        score_0_10: 8,
        rationale: 'Supported by evidence.',
        confidence_0_1: 0.8,
        evidence: [
          {
            anchor_id: `${id}-a1`,
            source_type: 'manuscript_chunk',
            source_ref: 'chunk-1',
            start_offset: 10,
            end_offset: 25,
            excerpt: 'Example excerpt',
          },
        ],
        warnings: [],
      },
    ],
    provenance: {
      evaluator_version: 'eval-v1',
      prompt_pack_version: 'pack-v1',
      run_id: 'run-1',
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
    id: 'conv-1',
    job_id: 'job-1',
    schema_version: 'convergence-artifact-v1',
    generated_at: new Date().toISOString(),
    inputs: {
      pass1_artifact_id: 'p1',
      pass2_artifact_id: 'p2',
      pass3_artifact_id: 'p3',
    },
    merged_criteria: [
      {
        criterion_id: 'structure',
        score_0_10: 8,
        rationale: 'Merged rationale.',
        confidence_0_1: 0.85,
        evidence: [
          {
            anchor_id: 'conv-a1',
            source_type: 'manuscript_chunk',
            source_ref: 'chunk-1',
            start_offset: 10,
            end_offset: 25,
            excerpt: 'Merged excerpt',
          },
        ],
        warnings: [],
      },
    ],
    overview_summary: 'Overall convergence summary.',
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
    id: 'job-1',
    user_id: 'user-1',
    status: 'running',
    phase: 'finalizer',
    progress_percent: 95,
    submission_idempotency_key: 'idem-1',
    claimed_by: 'worker-1',
    lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    attempt_count: 0,
    next_retry_at: null,
    failure_code: null,
    last_error: null,
    pass1_artifact_id: 'p1',
    pass2_artifact_id: 'p2',
    pass3_artifact_id: 'p3',
    convergence_artifact_id: 'conv-1',
    canonical_artifact_id: null,
    summary_artifact_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    terminal_at: null,
  };
}

function makeStorage(): jest.Mocked<FinalizerStorage> {
  const pass1 = makePass('pass1', 'p1');
  const pass2 = makePass('pass2', 'p2');
  const pass3 = makePass('pass3', 'p3');
  const convergence = makeConvergence();

  return {
    getJob: jest.fn(async () => makeJob()),
    getPassArtifact: jest.fn(async (id: string) => {
      if (id === 'p1') return pass1;
      if (id === 'p2') return pass2;
      if (id === 'p3') return pass3;
      return null;
    }),
    getConvergenceArtifact: jest.fn(async () => convergence),
    persistCanonicalArtifact: jest.fn(async () => 'canon-1'),
    persistSummaryProjection: jest.fn(async () => 'summary-1'),
    markJobComplete: jest.fn(async () => undefined),
    markJobFailed: jest.fn(async () => undefined),
  };
}

describe('finalizeJob', () => {
  test('completes a valid finalizer path', async () => {
    const storage = makeStorage();

    const result = await finalizeJob(
      {
        job_id: 'job-1',
        worker_id: 'worker-1',
        expected_status: 'running',
        expected_phase: 'finalizer',
      },
      storage,
    );

    expect(result.ok).toBe(true);
    expect(storage.persistCanonicalArtifact).toHaveBeenCalledTimes(1);
    expect(storage.persistSummaryProjection).toHaveBeenCalledTimes(1);
    expect(storage.markJobComplete).toHaveBeenCalledTimes(1);
    expect(storage.markJobFailed).not.toHaveBeenCalled();
  });

  test('fails closed when a required pass artifact reference is missing', async () => {
    const storage = makeStorage();
    storage.getJob.mockResolvedValueOnce({
      ...makeJob(),
      pass2_artifact_id: null,
    });

    const result = await finalizeJob(
      {
        job_id: 'job-1',
        worker_id: 'worker-1',
        expected_status: 'running',
        expected_phase: 'finalizer',
      },
      storage,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure_code).toBe('MISSING_PASS_ARTIFACT');
    }
    expect(storage.markJobFailed).toHaveBeenCalledTimes(1);
  });

  test('fails closed when pass artifacts collapse', async () => {
    const storage = makeStorage();
    storage.getConvergenceArtifact.mockResolvedValueOnce({
      ...makeConvergence(),
      inputs: {
        pass1_artifact_id: 'p1',
        pass2_artifact_id: 'p1',
        pass3_artifact_id: 'p3',
      },
    });

    const result = await finalizeJob(
      {
        job_id: 'job-1',
        worker_id: 'worker-1',
        expected_status: 'running',
        expected_phase: 'finalizer',
      },
      storage,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure_code).toBe('PASS_CONVERGENCE_FAILURE');
    }
  });

  test('fails closed on anchor violation', async () => {
    const storage = makeStorage();
    const badPass = makePass('pass1', 'p1');
    badPass.criteria[0].evidence[0].start_offset = 30;
    badPass.criteria[0].evidence[0].end_offset = 20;

    storage.getPassArtifact.mockImplementation(async (id: string) => {
      if (id === 'p1') return badPass;
      if (id === 'p2') return makePass('pass2', 'p2');
      if (id === 'p3') return makePass('pass3', 'p3');
      return null;
    });

    const result = await finalizeJob(
      {
        job_id: 'job-1',
        worker_id: 'worker-1',
        expected_status: 'running',
        expected_phase: 'finalizer',
      },
      storage,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure_code).toBe('ANCHOR_CONTRACT_VIOLATION');
    }
  });

  test('fails closed on orphan reasoning', async () => {
    const storage = makeStorage();
    const badPass = makePass('pass1', 'p1');
    badPass.validations.orphan_reasoning_absent = false;

    storage.getPassArtifact.mockImplementation(async (id: string) => {
      if (id === 'p1') return badPass;
      if (id === 'p2') return makePass('pass2', 'p2');
      if (id === 'p3') return makePass('pass3', 'p3');
      return null;
    });

    const result = await finalizeJob(
      {
        job_id: 'job-1',
        worker_id: 'worker-1',
        expected_status: 'running',
        expected_phase: 'finalizer',
      },
      storage,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure_code).toBe('GOVERNANCE_BLOCK');
    }
  });
});
