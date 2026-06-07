import { POST } from '@/app/api/jobs/[jobId]/resume/route';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { triggerEvaluationWorker } from '@/lib/jobs/triggerWorker';

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

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockTriggerEvaluationWorker = triggerEvaluationWorker as jest.MockedFunction<typeof triggerEvaluationWorker>;

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

function makeAdminMock(job: Record<string, unknown>) {
  const updateEq = jest.fn().mockReturnThis();
  const updateChain = { eq: updateEq, error: null };
  const update = jest.fn(() => updateChain);

  const admin = {
    update,
    updateEq,
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

  test('queued recovery request kicks the worker instead of returning a dead already-active conflict', async () => {
    const admin = makeAdminMock(makeJob({ status: 'queued', phase_status: 'queued', failure_code: null }));
    mockCreateAdminClient.mockReturnValue(admin as never);

    const response = await POST(makeRequest() as never, { params: Promise.resolve({ jobId: 'job-resume-1' }) });
    const json = (await response.json()) as { success: boolean; message: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.message).toBe('Evaluation recovery has been restarted.');
    expect(mockTriggerEvaluationWorker).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-resume-1',
      source: 'api.jobs.resume.active_queued',
    }));
  });

  test('keeps resumed job queued when worker does not claim exact job immediately', async () => {
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
    const json = (await response.json()) as { success: boolean; worker_kickoff_warning: string; message: string };

    expect(response.status).toBe(202);
    expect(json.success).toBe(true);
    expect(json.worker_kickoff_warning).toBe('worker_did_not_claim_resumed_job');
    expect(json.message).toContain('queued job remains recoverable');

    const updatePayload = firstUpdatePayload(admin);
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'queued',
      failure_code: null,
      last_error: null,
    }));
  });
});
