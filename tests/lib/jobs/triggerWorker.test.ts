import { triggerEvaluationWorker } from '@/lib/jobs/triggerWorker';

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

describe('triggerEvaluationWorker trusted origin behavior', () => {
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
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CRON_SECRET = originalCronSecret;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    process.env.VERCEL_URL = originalVercelUrl;
    process.env.WORKER_KICKOFF_BASE_URL = originalKickoffBase;
  });

  test('skips kickoff in production without trusted configured base URL', async () => {
    process.env.NODE_ENV = 'production';

    await triggerEvaluationWorker({
      req: new Request('https://untrusted.example/api/jobs'),
      jobId: 'job-1',
      trace_id: 'trace-1',
      request_id: 'request-1',
      source: 'api.jobs.create',
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Worker kickoff skipped: no trusted app base URL in production',
      expect.objectContaining({
        event: 'worker.kickoff.skipped.no_trusted_base_url',
        job_id: 'job-1',
      }),
    );
  });

  test('uses VERCEL_URL as trusted base URL in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_URL = 'literary-ai-partner.vercel.app';

    await triggerEvaluationWorker({
      req: new Request('https://ignored.example/api/jobs'),
      jobId: 'job-2',
      trace_id: 'trace-2',
      request_id: 'request-2',
      source: 'api.jobs.create',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://literary-ai-partner.vercel.app/api/workers/process-evaluations',
      expect.objectContaining({
        method: 'GET',
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
