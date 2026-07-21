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

  afterEach(() => {
    jest.useRealTimers();
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

    await triggerEvaluationWorker({
      req: new Request('https://untrusted.example/api/jobs'),
      jobId: 'job-1',
      trace_id: 'trace-1',
      request_id: 'request-1',
      source: 'api.jobs.create',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.revisiongrade.com/api/workers/process-evaluations',
      expect.objectContaining({
        method: 'GET',
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          Authorization: 'Bearer cron-secret',
          'x-trigger-source': 'api.jobs.create',
          'x-job-id': 'job-1',
          'x-trace-id': 'trace-1',
        }),
      }),
    );
  });

  test('uses VERCEL_URL as trusted base URL in production', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
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
        signal: expect.any(AbortSignal),
        headers: expect.objectContaining({
          Authorization: 'Bearer cron-secret',
          'x-trigger-source': 'api.jobs.create',
          'x-job-id': 'job-2',
          'x-trace-id': 'trace-2',
        }),
      }),
    );
  });

  test('aborts worker kickoff after timeout and resolves as network_or_timeout', async () => {
    jest.useFakeTimers();
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.VERCEL_URL = 'literary-ai-partner.vercel.app';

    global.fetch = jest.fn((_url, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!(signal instanceof AbortSignal)) {
        reject(new Error('missing abort signal'));
        return;
      }
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as typeof fetch;

    const resultPromise = triggerEvaluationWorker({
      req: new Request('https://ignored.example/api/jobs'),
      jobId: 'job-timeout',
      trace_id: 'trace-timeout',
      request_id: 'request-timeout',
      source: 'api.jobs.create',
    });

    await jest.advanceTimersByTimeAsync(5_000);
    const result = await resultPromise;

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      reason: 'network_or_timeout',
    }));
    expect(logger.warn).toHaveBeenCalledWith(
      'Worker kickoff failed (network/timeout)',
      expect.objectContaining({
        event: 'worker.kickoff.failed',
        job_id: 'job-timeout',
      }),
    );
  });
});
