import { POST } from '@/app/api/admin/proof/jobs/route';
import { createAdminClient } from '@/lib/supabase/admin';
import { createJob } from '@/lib/jobs/store';
import { failEvaluationJobTerminally } from '@/lib/jobs/failJobTerminal';

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/jobs/store', () => ({
  createJob: jest.fn(),
}));

jest.mock('@/lib/jobs/failJobTerminal', () => ({
  failEvaluationJobTerminally: jest.fn(async () => ({ ok: true, jobId: 'job-proof-1' })),
}));

jest.mock('@/lib/observability/logger', () => ({
  generateTraceId: jest.fn(() => 'trace-1'),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  jobLogger: {
    created: jest.fn(),
  },
}));

jest.mock('@/lib/observability/latencyTrace', () => ({
  emitLatencyTrace: jest.fn(),
  startLatencyStage: jest.fn(() => '2026-01-01T00:00:00.000Z'),
  finishLatencyStage: jest.fn(),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockCreateJob = createJob as jest.MockedFunction<typeof createJob>;
const mockFailEvaluationJobTerminally = failEvaluationJobTerminally as jest.MockedFunction<typeof failEvaluationJobTerminally>;
const originalFetch = global.fetch;

function buildAdminClientMock() {
  return {
    from: jest.fn((table: string) => {
      if (table !== 'manuscripts') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(async () => ({ data: { id: 456 }, error: null })),
          })),
        })),
      };
    }),
  };
}

function buildRequest() {
  return new Request('https://example.test/api/admin/proof/jobs', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer proof-secret',
    },
    body: JSON.stringify({
      manuscript_text: 'The first chapter opened with rain and ended with a door left unlocked.',
      proof_user_id: 'proof-user-1',
      job_type: 'evaluate_full',
    }),
  });
}

describe('POST /api/admin/proof/jobs kickoff behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.PROOF_RUN_SECRET = 'proof-secret';
    process.env.CRON_SECRET = 'cron-secret';
    mockCreateAdminClient.mockReturnValue(buildAdminClientMock() as never);
    mockCreateJob.mockResolvedValue({
      id: 'job-proof-1',
      status: 'queued',
      manuscript_id: 456,
      user_id: 'proof-user-1',
      job_type: 'evaluate_full',
    } as never);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, claimed: 1, processed: 1, targetClaimed: true }),
    } as Response) as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('kicks off worker with exact proof job id after successful proof job creation', async () => {
    const response = await POST(buildRequest());
    const json = (await response.json()) as { ok: boolean; job_id: string };

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.job_id).toBe('job-proof-1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/api/workers/process-evaluations',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({
          Authorization: 'Bearer cron-secret',
          'x-trigger-source': 'api.admin.proof.jobs.create',
          'x-job-id': 'job-proof-1',
          'x-trace-id': 'trace-1',
        }),
      }),
    );
  });

  test('fails closed and terminalizes when proof worker does not claim the created job', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, claimed: 1, processed: 1, targetClaimed: false }),
    } as Response) as typeof fetch;

    const response = await POST(buildRequest());
    const json = (await response.json()) as { ok: boolean; code: string };

    expect(response.status).toBe(503);
    expect(json.ok).toBe(false);
    expect(json.code).toBe('WORKER_KICKOFF_FAILED');
    expect(mockFailEvaluationJobTerminally).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-proof-1',
        failureCode: 'WORKER_KICKOFF_FAILED',
        source: 'api.admin.proof.jobs.worker_kickoff_guard',
      }),
    );
  });
});
