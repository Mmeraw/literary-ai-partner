export {};

const createClientMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

jest.mock('@/lib/evaluation/processorLeaseFailureFinalizer', () => {
  class ProcessorLeaseLostError extends Error {
    readonly code = 'PROCESSOR_LEASE_LOST';
    readonly jobId: string;
    readonly failureCode: string;

    constructor(args: { jobId: string; failureCode: string }) {
      super(`Processor local guard result for job ${args.jobId}`);
      this.name = 'ProcessorLeaseLostError';
      this.jobId = args.jobId;
      this.failureCode = args.failureCode;
    }
  }

  return {
    ProcessorLeaseLostError,
    finalizeProcessorFailureWithLeaseGuard: jest.fn(),
    isProcessorLeaseLostError: (error: unknown) => Boolean(
      error &&
        typeof error === 'object' &&
        (error as { code?: unknown }).code === 'PROCESSOR_LEASE_LOST',
    ),
  };
});

describe('processEvaluationJob guarded finalizer integration', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.EVAL_PASS_TIMEOUT_MS = '180000';
    process.env.EVAL_OPENAI_TIMEOUT_MS = '180000';
    process.env.EVAL_EXTERNAL_ADJUDICATION_MODE = 'optional';
  });

  test('does not write failed payload after processor-local guard result', async () => {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 5 * 60_000).toISOString();
    const jobId = 'job-guarded-finalizer-regression';
    const claimedJob = {
      id: jobId,
      manuscript_id: 42,
      job_type: 'evaluate_full',
      status: 'running',
      phase: 'phase_1a',
      phase_status: 'running',
      claimed_by: 'test-worker',
      worker_id: 'test-worker',
      lease_token: 'test-token',
      lease_until: leaseUntil,
      lease_expires_at: leaseUntil,
      heartbeat_at: now.toISOString(),
      started_at: now.toISOString(),
      progress: {
        phase: 'phase_1a',
        phase_status: 'running',
      },
      created_at: now.toISOString(),
    };

    const updateMock = jest.fn(() => ({
      eq: () => ({ error: null }),
    }));

    const supabaseStub = {
      from(table: string) {
        if (table === 'evaluation_jobs') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: claimedJob, error: null }),
              }),
            }),
            update: updateMock,
          };
        }

        if (table === 'manuscripts') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: 'missing manuscript' } }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table access: ${table}`);
      },
    };

    createClientMock.mockReturnValue(supabaseStub);

    const finalizer = await import('@/lib/evaluation/processorLeaseFailureFinalizer');
    const localError = new finalizer.ProcessorLeaseLostError({
      jobId,
      failureCode: 'EVALUATION_FAILED',
    });
    (finalizer.finalizeProcessorFailureWithLeaseGuard as jest.Mock).mockRejectedValueOnce(localError);

    const { processEvaluationJob } = await import('../../../lib/evaluation/processor');
    const result = await processEvaluationJob(jobId);

    expect(result.success).toBe(false);
    expect(finalizer.finalizeProcessorFailureWithLeaseGuard).toHaveBeenCalledTimes(1);

    const updatePayloads = updateMock.mock.calls.map((call) => call[0]);
    expect(updatePayloads).toEqual([
      expect.objectContaining({
        phase: 'phase_1a',
        phase_status: 'running',
      }),
    ]);
    expect(updatePayloads).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase_status: 'failed',
        }),
      ]),
    );
    expect(updatePayloads).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          failure_code: expect.any(String),
        }),
      ]),
    );
  });
});
