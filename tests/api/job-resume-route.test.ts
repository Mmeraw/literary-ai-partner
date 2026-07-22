import { POST } from '@/app/api/jobs/[jobId]/resume/route';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isTerminalFailureCode } from '@/lib/evaluation/processor';
import { triggerEvaluationWorker } from '@/lib/jobs/triggerWorker';
import { logger } from '@/lib/observability/logger';

jest.mock('@/lib/supabase/server', () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/evaluation/processor', () => ({
  isTerminalFailureCode: jest.fn((code: string | null | undefined) => code === 'USER_CANCELLED'),
  classifyFailureBucket: jest.fn(() => 'vercel_platform'),
}));

jest.mock('@/lib/evaluation/artifactPersistence', () => ({
  upsertEvaluationArtifact: jest.fn(async () => ({ ok: true })),
}));

jest.mock('@/lib/evaluation/phase-architecture-v2/checklistRuntimeWiring', () => ({
  selectResumeCheckpoint: jest.fn(() => ({
    resume_mode: 'chunk_checkpoint',
    target_phase: 'phase_3',
    checkpoint_artifact_type: 'pass12_handoff_v1',
    checkpoint_artifact_id: 'artifact-1',
  })),
}));

jest.mock('@/lib/jobs/triggerWorker', () => ({
  triggerEvaluationWorker: jest.fn(async () => ({
    ok: true,
    workerStatus: 200,
    claimed: 1,
    processed: 1,
    targetClaimed: true,
    body: { success: true },
  })),
  isTriggerWorkerFailure: jest.fn((result: { ok: boolean }) => !result.ok),
}));

jest.mock('@/lib/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockTriggerEvaluationWorker = triggerEvaluationWorker as jest.MockedFunction<typeof triggerEvaluationWorker>;
const mockIsTerminalFailureCode = isTerminalFailureCode as jest.MockedFunction<typeof isTerminalFailureCode>;
const mockLogger = logger as jest.Mocked<typeof logger>;

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-resume-1',
    manuscript_id: 7499,
    status: 'failed',
    phase: 'phase_3',
    phase_status: 'failed',
    attempt_count: 2,
    max_attempts: 11,
    failure_code: 'PROCESSOR_UNCAUGHT_ERROR',
    progress: { phase: 'phase_3', phase_status: 'failed' },
    manuscripts: { user_id: 'user-1' },
    ...overrides,
  };
}

function makeAdminMock(
  job: Record<string, unknown>,
  options: { requeueData?: Record<string, unknown> | null; requeueError?: { message: string } | null } = {},
) {
  const requeueData = options.requeueData === undefined
    ? { id: job.id, status: 'queued' }
    : options.requeueData;
  const requeueError = options.requeueError ?? null;
  const updateEq = jest.fn().mockReturnThis();
  const updateChain = {
    eq: updateEq,
    select: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({ data: requeueData, error: requeueError })),
  };
  const update = jest.fn(() => updateChain);

  const admin = {
    update,
    updateEq,
    updateChain,
    from: jest.fn((table: string) => {
      if (table === 'evaluation_jobs') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(async () => ({ data: job, error: null })),
          })),
          update,
        };
      }

      if (table === 'evaluation_artifacts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({
              data: { content: { chunks: { a: {} }, total_expected: 1 } },
              error: null,
            })),
            order: jest.fn(async () => ({
              data: [{ id: 'artifact-1', artifact_type: 'pass12_handoff_v1', content: {}, source_hash: 'h', created_at: '2026-06-07T01:00:00.000Z' }],
              error: null,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return admin;
}

async function flushDetachedWorkerLogs() {
  await Promise.resolve();
  await Promise.resolve();
}

function makeRequest() {
  return new Request('https://example.test/api/jobs/job-resume-1/resume', { method: 'POST' });
}

function firstUpdatePayload(admin: ReturnType<typeof makeAdminMock>): Record<string, unknown> {
  const payload = (admin.update as jest.Mock).mock.calls[0]?.[0] as Record<string, unknown> | undefined;
  if (!payload) {
    throw new Error('Expected evaluation_jobs update payload');
  }
  return payload;
}

describe('POST /api/jobs/[jobId]/resume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTerminalFailureCode.mockImplementation((code: string | null | undefined) => code === 'USER_CANCELLED');
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'writer@example.com' } as never);
    process.env.CRON_SECRET = 'cron-secret';
  });

  test('requeues failed recoverable job, clears terminal fields, and kicks worker best-effort', async () => {
    const admin = makeAdminMock(makeJob());
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; job_id: string; target_phase: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.job_id).toBe('job-resume-1');
    expect(json.target_phase).toBe('phase_3');

    const updatePayload = firstUpdatePayload(admin);
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'queued',
      phase: 'phase_3',
      phase_status: 'queued',
      last_error: null,
      failure_code: null,
      failure_envelope: null,
      failed_at: null,
      claimed_by: null,
      claimed_at: null,
      lease_token: null,
      lease_until: null,
      last_heartbeat_at: null,
      worker_pulse_at: null,
    }));
    expect(mockTriggerEvaluationWorker).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-resume-1',
      source: 'api.jobs.resume',
    }));
    expect(admin.updateEq.mock.calls).toEqual([
      ['id', 'job-resume-1'],
      ['status', 'failed'],
    ]);
    expect(admin.updateChain.select).toHaveBeenCalledWith('id, status');
    expect(admin.updateChain.maybeSingle).toHaveBeenCalledTimes(1);
    expect(admin.updateEq).toHaveBeenCalledWith('status', 'failed');
    expect(admin.updateEq).not.toHaveBeenCalledWith('status', 'recoverable');

    await flushDetachedWorkerLogs();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Evaluation resume request accepted after durable requeue',
      expect.objectContaining({
        event: 'api.jobs.resume.accepted_requeued',
        job_id: 'job-resume-1',
        status: 'queued',
        pickup_fallback: 'cron_or_worker_queue',
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Worker kickoff accepted resumed evaluation asynchronously',
      expect.objectContaining({
        event: 'api.jobs.resume.worker_kickoff_async_ok',
        job_id: 'job-resume-1',
      }),
    );
  });

  test('requeues max-age kill-switch job from selected checkpoint instead of requiring re-upload', async () => {
    const admin = makeAdminMock(makeJob({
      failure_code: 'MAX_AGE_KILL_SWITCH',
      last_error: 'KILL_SWITCH: Job exceeded maximum age of 2 hours',
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as {
      success: boolean;
      target_phase: string;
      checkpoint_artifact_type: string | null;
      checkpoint_artifact_id: string | null;
    };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.target_phase).toBe('phase_3');
    expect(json.checkpoint_artifact_type).toBe('pass12_handoff_v1');
    expect(json.checkpoint_artifact_id).toBe('artifact-1');

    const updatePayload = firstUpdatePayload(admin);
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'queued',
      phase: 'phase_3',
      phase_status: 'queued',
      last_error: null,
      failure_code: null,
    }));
    expect(updatePayload.progress).toEqual(expect.objectContaining({
      resume_mode: 'chunk_checkpoint',
      resume_checkpoint_artifact_type: 'pass12_handoff_v1',
      resume_checkpoint_artifact_id: 'artifact-1',
    }));
  });

  test('requeues legacy QG_FAILED when the saved failure is the fixed short-form internal-process leak', async () => {
    mockIsTerminalFailureCode.mockImplementation(
      (code: string | null | undefined) => code === 'USER_CANCELLED' || code === 'QG_FAILED',
    );
    const admin = makeAdminMock(makeJob({
      failure_code: 'QG_FAILED',
      last_error: '[ShortFormFinalSanityCheck] SHORT_FORM_INTERNAL_PROCESS_LEAK',
      failure_envelope: {
        code: 'QG_FAILED',
        message: '[ShortFormFinalSanityCheck] SHORT_FORM_INTERNAL_PROCESS_LEAK',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; target_phase: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.target_phase).toBe('phase_3');

    const updatePayload = firstUpdatePayload(admin);
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'queued',
      phase_status: 'queued',
      last_error: null,
      failure_code: null,
      failure_envelope: null,
    }));
    expect(mockTriggerEvaluationWorker).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-resume-1',
      source: 'api.jobs.resume',
    }));
  });

  test('allows generic QG_FAILED resume when failure is after phase_0', async () => {
    mockIsTerminalFailureCode.mockImplementation(
      (code: string | null | undefined) => code === 'USER_CANCELLED' || code === 'QG_FAILED',
    );
    const admin = makeAdminMock(makeJob({
      failure_code: 'QG_FAILED',
      last_error: '[QualityGate] QG_FAILED: evidence anchors missing',
      failure_envelope: {
        code: 'QG_FAILED',
        message: '[QualityGate] QG_FAILED: evidence anchors missing',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; target_phase: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.target_phase).toBe('phase_3');

    const updatePayload = firstUpdatePayload(admin);
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'queued',
      phase_status: 'queued',
      last_error: null,
      failure_code: null,
      failure_envelope: null,
    }));
    expect(mockTriggerEvaluationWorker).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-resume-1',
      source: 'api.jobs.resume',
    }));
  });

  test('keeps terminal block for phase_0 failures', async () => {
    mockIsTerminalFailureCode.mockImplementation(
      (code: string | null | undefined) => code === 'USER_CANCELLED' || code === 'QG_FAILED',
    );
    const admin = makeAdminMock(makeJob({
      phase: 'phase_0',
      failure_code: 'QG_FAILED',
      last_error: '[QualityGate] QG_FAILED at phase_0',
      progress: { phase: 'phase_0', phase_status: 'failed' },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { resumable: boolean; failure_code: string };

    expect(response.status).toBe(409);
    expect(json.resumable).toBe(false);
    expect(json.failure_code).toBe('QG_FAILED');
    expect(admin.update).not.toHaveBeenCalled();
    expect(mockTriggerEvaluationWorker).not.toHaveBeenCalled();
  });

  test('queued recovery request returns idempotent accepted response without requeueing', async () => {
    const admin = makeAdminMock(makeJob({ status: 'queued', phase_status: 'queued', failure_code: null }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; message: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.message).toBe('Evaluation recovery is queued. The worker/cron path will pick it up shortly.');
    expect(admin.update).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Evaluation resume request accepted for already queued job',
      expect.objectContaining({
        event: 'api.jobs.resume.accepted_existing_queued',
        job_id: 'job-resume-1',
        pickup_fallback: 'cron_or_worker_queue',
      }),
    );
    expect(mockTriggerEvaluationWorker).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-resume-1',
      source: 'api.jobs.resume.active_queued',
    }));
  });

  test('running recovery request is accepted idempotently without requeueing or worker kickoff', async () => {
    const admin = makeAdminMock(makeJob({ status: 'running', phase_status: 'running', failure_code: null }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; current_status: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.current_status).toBe('running');
    expect(admin.update).not.toHaveBeenCalled();
    expect(mockTriggerEvaluationWorker).not.toHaveBeenCalled();
  });

  test('returns conflict when atomic failed-status requeue updates zero rows', async () => {
    const admin = makeAdminMock(makeJob(), { requeueData: null });
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { error: string; current_status: string };

    expect(response.status).toBe(409);
    expect(json.error).toContain('status changed');
    expect(json.current_status).toBe('failed');
    expect(admin.updateEq).toHaveBeenCalledWith('status', 'failed');
    expect(mockTriggerEvaluationWorker).not.toHaveBeenCalled();
  });

  test('returns accepted response even when async worker kickoff never resolves', async () => {
    const admin = makeAdminMock(makeJob());
    mockCreateAdminClient.mockReturnValue(admin as never);
    mockTriggerEvaluationWorker.mockReturnValueOnce(new Promise(() => {}) as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; message: string; worker_kickoff_warning?: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.message).toBe('Evaluation recovery has been queued. The worker/cron path will pick it up shortly.');
    expect(json.worker_kickoff_warning).toBeUndefined();
    expect(mockTriggerEvaluationWorker).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-resume-1',
      source: 'api.jobs.resume',
    }));
  });

  test('keeps resumed job queued when async worker does not claim exact job immediately', async () => {
    const admin = makeAdminMock(makeJob());
    mockCreateAdminClient.mockReturnValue(admin as never);
    mockTriggerEvaluationWorker.mockResolvedValueOnce({
      ok: true,
      workerStatus: 200,
      claimed: 1,
      processed: 1,
      targetClaimed: false,
      body: { success: true },
    });

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; worker_kickoff_warning?: string; message: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.worker_kickoff_warning).toBeUndefined();
    expect(json.message).toBe('Evaluation recovery has been queued. The worker/cron path will pick it up shortly.');

    await flushDetachedWorkerLogs();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Worker kickoff failed after evaluation resume request',
      expect.objectContaining({
        event: 'api.jobs.resume.worker_kickoff_failed_async',
        job_id: 'job-resume-1',
        reason: 'worker_did_not_claim_resumed_job',
        pickup_fallback: 'cron_or_worker_queue',
      }),
    );

    const updatePayload = firstUpdatePayload(admin);
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'queued',
      failure_code: null,
      last_error: null,
    }));
  });

  test('allows resume for a job halted by the owner emergency control (ADMIN_EMERGENCY_CANCELLED / cancelled_by_admin)', async () => {
    // Emergency halt persists failure_code=ADMIN_EMERGENCY_CANCELLED, cancelled_by_admin=true,
    // resume_eligible=true. The resume route must allow these through instead of blocking with 409.
    const admin = makeAdminMock(makeJob({
      failure_code: 'ADMIN_EMERGENCY_CANCELLED',
      status: 'failed',
      phase: 'phase_3',
      progress: {
        phase: 'phase_3',
        phase_status: 'failed',
        cancelled_by_user: false,
        cancelled_by_admin: true,
        resume_eligible: true,
        resume_policy: 'checkpoint_restart_required',
        cancellation_actor_kind: 'owner_emergency',
        dashboard_status: 'cancelled',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; job_id: string; target_phase: string };

    // Must not be blocked with 409; must be accepted for resume.
    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.job_id).toBe('job-resume-1');

    const updatePayload = firstUpdatePayload(admin);
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'queued',
      failure_code: null,
      last_error: null,
      failure_envelope: null,
    }));
    expect(mockTriggerEvaluationWorker).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-resume-1',
      source: 'api.jobs.resume',
    }));
  });

  test('still blocks resume for ordinary user-cancelled jobs (cancelled_by_user=true)', async () => {
    const admin = makeAdminMock(makeJob({
      failure_code: 'USER_CANCELLED',
      status: 'failed',
      progress: {
        cancelled_by_user: true,
        cancelled_at: '2026-07-22T00:00:00.000Z',
        dashboard_status: 'cancelled',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { resumable: boolean; failure_code: string };

    expect(response.status).toBe(409);
    expect(json.resumable).toBe(false);
    expect(json.failure_code).toBe('USER_CANCELLED');
    expect(admin.update).not.toHaveBeenCalled();
  });

  // ── Negative conjunction tests: each incomplete combination must still block ──────────────
  // A single-field or two-field match must NOT bypass the user-cancellation gate.
  // Only all three fields together constitute a genuine owner-emergency halt.

  test('blocks resume when only failure_code=ADMIN_EMERGENCY_CANCELLED without the other markers', async () => {
    const admin = makeAdminMock(makeJob({
      failure_code: 'ADMIN_EMERGENCY_CANCELLED',
      status: 'failed',
      progress: {
        // cancelled_by_admin and resume_eligible absent — incomplete emergency identity
        cancelled_by_user: false,
        dashboard_status: 'cancelled',
        cancelled_at: '2026-07-22T00:00:00.000Z',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { resumable: boolean };

    expect(response.status).toBe(409);
    expect(json.resumable).toBe(false);
    expect(admin.update).not.toHaveBeenCalled();
  });

  test('blocks resume when only cancelled_by_admin=true without the other markers', async () => {
    const admin = makeAdminMock(makeJob({
      failure_code: 'USER_CANCELLED',
      status: 'failed',
      progress: {
        cancelled_by_admin: true,
        // failure_code is USER_CANCELLED and resume_eligible absent
        cancelled_by_user: false,
        dashboard_status: 'cancelled',
        cancelled_at: '2026-07-22T00:00:00.000Z',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { resumable: boolean };

    expect(response.status).toBe(409);
    expect(json.resumable).toBe(false);
    expect(admin.update).not.toHaveBeenCalled();
  });

  test('blocks resume when only resume_eligible=true without the other markers', async () => {
    const admin = makeAdminMock(makeJob({
      failure_code: 'USER_CANCELLED',
      status: 'failed',
      progress: {
        resume_eligible: true,
        // failure_code is USER_CANCELLED and cancelled_by_admin absent
        cancelled_by_user: false,
        dashboard_status: 'cancelled',
        cancelled_at: '2026-07-22T00:00:00.000Z',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { resumable: boolean };

    expect(response.status).toBe(409);
    expect(json.resumable).toBe(false);
    expect(admin.update).not.toHaveBeenCalled();
  });

  test('blocks resume when failure_code + cancelled_by_admin but not resume_eligible', async () => {
    const admin = makeAdminMock(makeJob({
      failure_code: 'ADMIN_EMERGENCY_CANCELLED',
      status: 'failed',
      progress: {
        cancelled_by_admin: true,
        // resume_eligible absent — incomplete conjunction
        cancelled_by_user: false,
        dashboard_status: 'cancelled',
        cancelled_at: '2026-07-22T00:00:00.000Z',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { resumable: boolean };

    expect(response.status).toBe(409);
    expect(json.resumable).toBe(false);
    expect(admin.update).not.toHaveBeenCalled();
  });

  test('blocks resume when failure_code + resume_eligible but not cancelled_by_admin', async () => {
    const admin = makeAdminMock(makeJob({
      failure_code: 'ADMIN_EMERGENCY_CANCELLED',
      status: 'failed',
      progress: {
        resume_eligible: true,
        // cancelled_by_admin absent — incomplete conjunction
        cancelled_by_user: false,
        dashboard_status: 'cancelled',
        cancelled_at: '2026-07-22T00:00:00.000Z',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { resumable: boolean };

    expect(response.status).toBe(409);
    expect(json.resumable).toBe(false);
    expect(admin.update).not.toHaveBeenCalled();
  });

  test('blocks resume when cancelled_by_admin + resume_eligible but wrong failure_code', async () => {
    const admin = makeAdminMock(makeJob({
      failure_code: 'USER_CANCELLED',
      status: 'failed',
      progress: {
        cancelled_by_admin: true,
        resume_eligible: true,
        // failure_code is USER_CANCELLED — incomplete conjunction
        cancelled_by_user: false,
        dashboard_status: 'cancelled',
        cancelled_at: '2026-07-22T00:00:00.000Z',
      },
    }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { resumable: boolean };

    expect(response.status).toBe(409);
    expect(json.resumable).toBe(false);
    expect(admin.update).not.toHaveBeenCalled();
  });
});
