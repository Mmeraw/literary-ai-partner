import { triggerEvaluationWorkflow } from '@/lib/jobs/triggerWorkflow';

jest.mock('@/lib/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { logger } = jest.requireMock('@/lib/observability/logger') as {
  logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
};

describe('triggerEvaluationWorkflow trusted origin behavior', () => {
  const originalFetch = global.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCronSecret = process.env.CRON_SECRET;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalVercelUrl = process.env.VERCEL_URL;
  const originalKickoffBase = process.env.WORKER_KICKOFF_BASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;
    process.env.CRON_SECRET = 'cron-secret';
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.WORKER_KICKOFF_BASE_URL;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    Object.assign(process.env, { NODE_ENV: originalNodeEnv });
    process.env.CRON_SECRET = originalCronSecret;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    process.env.VERCEL_URL = originalVercelUrl;
    process.env.WORKER_KICKOFF_BASE_URL = originalKickoffBase;
  });

  test('uses canonical production base URL when trusted configured base URL is missing', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });

    await triggerEvaluationWorkflow({
      req: new Request('https://untrusted.example/api/jobs'),
      jobId: 'job-1',
      trace_id: 'trace-1',
      request_id: 'request-1',
      source: 'api.jobs.create',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.revisiongrade.com/api/workflows/evaluate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer cron-secret',
          'x-trigger-source': 'api.jobs.create',
          'x-job-id': 'job-1',
          'x-trace-id': 'trace-1',
        }),
      }),
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      'Workflow kickoff skipped: no trusted app base URL in production',
      expect.anything(),
    );
  });

  test('uses VERCEL_URL as trusted base URL in production', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.VERCEL_URL = 'literary-ai-partner.vercel.app';

    await triggerEvaluationWorkflow({
      req: new Request('https://ignored.example/api/jobs'),
      jobId: 'job-2',
      trace_id: 'trace-2',
      request_id: 'request-2',
      source: 'api.jobs.create',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://literary-ai-partner.vercel.app/api/workflows/evaluate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer cron-secret',
          'x-trigger-source': 'api.jobs.create',
          'x-job-id': 'job-2',
          'x-trace-id': 'trace-2',
        }),
      }),
    );
  });
});
