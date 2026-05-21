import { POST } from '@/app/api/internal/jobs/route';
import { createJob } from '@/lib/jobs/store';

jest.mock('@/lib/jobs/store', () => ({
  createJob: jest.fn(),
  getAllJobs: jest.fn(),
}));

jest.mock('@/lib/jobs/metrics', () => ({
  onJobCreated: jest.fn(),
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

const mockCreateJob = createJob as jest.MockedFunction<typeof createJob>;
const originalFetch = global.fetch;

describe('POST /api/internal/jobs kickoff behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(process.env, { NODE_ENV: 'development' });
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.CRON_SECRET = 'cron-secret';
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('attempts worker kickoff after successful internal job creation', async () => {
    mockCreateJob.mockResolvedValue({
      id: 'job-internal-1',
      status: 'queued',
      manuscript_id: 123,
      user_id: 'user-1',
      job_type: 'evaluate_full',
      created_at: new Date().toISOString(),
    } as never);

    const req = new Request('https://example.test/api/internal/jobs', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer service-role-key',
      },
      body: JSON.stringify({ manuscript_id: 123, job_type: 'evaluate_full', user_id: 'user-1' }),
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/api/workers/process-evaluations',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({
          Authorization: 'Bearer cron-secret',
          'x-trigger-source': 'api.internal.jobs.create',
          'x-job-id': 'job-internal-1',
          'x-trace-id': 'trace-1',
        }),
      }),
    );
  });
});
