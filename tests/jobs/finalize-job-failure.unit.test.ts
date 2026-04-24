import { describe, expect, jest, test, beforeEach } from '@jest/globals';

jest.mock('@/lib/supabase/admin');

const mockCreateAdminClient = require('@/lib/supabase/admin')
  .createAdminClient as jest.Mock;

const supabaseMock = {
  rpc: jest.fn(),
};

const jobStore = require('@/lib/jobs/jobStore.supabase') as typeof import('@/lib/jobs/jobStore.supabase');

describe('finalizeJobFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseMock.rpc.mockReset();
    mockCreateAdminClient.mockReturnValue(supabaseMock);
  });

  test('passes deterministic failures to RPC as non-retryable', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ attempt_count: 1, max_attempts: 3, notified_at: null }],
      error: null,
    });

    const result = await jobStore.finalizeJobFailure({
      jobId: 'job-1',
      errorEnvelope: {
        code: 'PASS3_FAILED',
        message: 'Token starvation',
      },
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('finalize_job_failure_atomic', {
      p_job_id: 'job-1',
      p_failure_code: 'PASS3_FAILED',
      p_error_message: 'Token starvation',
      p_retryable: false,
    });
    expect(result).toEqual({
      status: 'failed',
      retryEligible: false,
      retryExhausted: false,
      attemptCount: 1,
      maxAttempts: 3,
      shouldNotify: true,
      failureCode: 'PASS3_FAILED',
    });
  });

  test('passes transient failures to RPC as retryable', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ attempt_count: 1, max_attempts: 3, notified_at: '2026-04-24T00:00:00Z' }],
      error: null,
    });

    const result = await jobStore.finalizeJobFailure({
      jobId: 'job-2',
      errorEnvelope: {
        code: 'TIMEOUT',
        message: 'Provider timed out',
      },
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('finalize_job_failure_atomic', {
      p_job_id: 'job-2',
      p_failure_code: 'TIMEOUT',
      p_error_message: 'Provider timed out',
      p_retryable: true,
    });
    expect(result).toEqual({
      status: 'failed',
      retryEligible: true,
      retryExhausted: false,
      attemptCount: 1,
      maxAttempts: 3,
      shouldNotify: false,
      failureCode: 'TIMEOUT',
    });
  });

  test('honors explicit retryable override from caller', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ attempt_count: 2, max_attempts: 3, notified_at: null }],
      error: null,
    });

    const result = await jobStore.finalizeJobFailure({
      jobId: 'job-override',
      errorEnvelope: {
        code: 'TIMEOUT',
        message: 'Caller marks terminal failure',
        retryable: false,
      },
    });

    expect(supabaseMock.rpc).toHaveBeenCalledWith('finalize_job_failure_atomic', {
      p_job_id: 'job-override',
      p_failure_code: 'TIMEOUT',
      p_error_message: 'Caller marks terminal failure',
      p_retryable: false,
    });

    expect(result.retryEligible).toBe(false);
  });

  test('marks retryable failures as exhausted when attempts reach max', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ attempt_count: 3, max_attempts: 3, notified_at: null }],
      error: null,
    });

    const result = await jobStore.finalizeJobFailure({
      jobId: 'job-3',
      errorEnvelope: {
        code: 'RATE_LIMIT',
        message: 'Retries exhausted',
      },
    });

    expect(result).toEqual({
      status: 'failed',
      retryEligible: false,
      retryExhausted: true,
      attemptCount: 3,
      maxAttempts: 3,
      shouldNotify: true,
      failureCode: 'RATE_LIMIT',
    });
  });

  test('throws when RPC fails', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database exploded politely' },
    });

    await expect(
      jobStore.finalizeJobFailure({
        jobId: 'job-4',
        errorEnvelope: {
          code: 'TIMEOUT',
          message: 'Network wobble',
        },
      }),
    ).rejects.toThrow(/Atomic update failed/);
  });

  test('throws when RPC returns no rows', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await expect(
      jobStore.finalizeJobFailure({
        jobId: 'job-5',
        errorEnvelope: {
          code: 'TIMEOUT',
          message: 'No row returned',
        },
      }),
    ).rejects.toThrow(/RPC returned no rows/);
  });

  test('always returns canonical failed status', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ attempt_count: 2, max_attempts: 5, notified_at: '2026-04-24T00:00:00Z' }],
      error: null,
    });

    const result = await jobStore.finalizeJobFailure({
      jobId: 'job-6',
      errorEnvelope: {
        code: 'QG_FAILED',
        message: 'Quality gate rejected output',
      },
    });

    expect(result.status).toBe('failed');
  });
});
