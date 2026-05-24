import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('@/lib/supabase/admin');

const mockCreateAdminClient = require('@/lib/supabase/admin')
  .createAdminClient as jest.Mock;

type RpcRow = {
  attempt_count: number;
  max_attempts: number;
  notified_at: string | null;
};

type SupabaseRpcResponse =
  | { data: RpcRow[]; error: null }
  | { data: null; error: { message: string } };

type RpcMock = jest.MockedFunction<
  (fn: string, args: Record<string, unknown>) => Promise<SupabaseRpcResponse>
>;

const rpcMock = jest.fn() as RpcMock;

const supabaseMock = {
  rpc: rpcMock,
};

const guarded = require('@/lib/jobs/finalizeJobFailureGuarded') as typeof import('@/lib/jobs/finalizeJobFailureGuarded');

describe('finalizeClaimedJobFailure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpcMock.mockReset();
    mockCreateAdminClient.mockReturnValue(supabaseMock);
  });

  test('passes expected lease owner metadata to the atomic RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ attempt_count: 1, max_attempts: 3, notified_at: null }],
      error: null,
    });

    const result = await guarded.finalizeClaimedJobFailure({
      jobId: 'job-claimed',
      expectedLeaseToken: 'lease-token-1',
      expectedClaimedBy: 'worker-1',
      errorEnvelope: {
        code: 'PASS3_FAILED',
        message: 'Token starvation',
      },
    });

    expect(rpcMock).toHaveBeenCalledWith('finalize_job_failure_atomic', {
      p_job_id: 'job-claimed',
      p_failure_code: 'PASS3_FAILED',
      p_error_message: 'Token starvation',
      p_retryable: false,
      p_expected_lease_token: 'lease-token-1',
      p_expected_claimed_by: 'worker-1',
    });
    expect(result).toEqual({
      outcome: 'written',
      status: 'failed',
      terminalWriteSkipped: false,
      retryEligible: false,
      retryExhausted: false,
      attemptCount: 1,
      maxAttempts: 3,
      shouldNotify: true,
      failureCode: 'PASS3_FAILED',
    });
  });

  test('returns lease_lost outcome while preserving canonical failed status when guarded RPC updates zero rows', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    const result = await guarded.finalizeClaimedJobFailure({
      jobId: 'job-stolen',
      expectedLeaseToken: 'old-token',
      expectedClaimedBy: 'old-worker',
      errorEnvelope: {
        code: 'TIMEOUT',
        message: 'Worker exceeded budget after losing lease',
      },
    });

    expect(result).toEqual({
      outcome: 'lease_lost',
      status: 'failed',
      terminalWriteSkipped: true,
      retryEligible: false,
      retryExhausted: false,
      attemptCount: 0,
      maxAttempts: 0,
      shouldNotify: false,
      failureCode: 'TIMEOUT',
    });
  });

  test('uses shared retryability policy for transient legacy runtime codes', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ attempt_count: 1, max_attempts: 3, notified_at: '2026-05-23T00:00:00Z' }],
      error: null,
    });

    const result = await guarded.finalizeClaimedJobFailure({
      jobId: 'job-timeout',
      expectedLeaseToken: 'lease-token',
      expectedClaimedBy: 'worker-id',
      errorEnvelope: {
        code: 'TIMEOUT',
        message: 'Provider timed out',
      },
    });

    expect(rpcMock).toHaveBeenCalledWith(
      'finalize_job_failure_atomic',
      expect.objectContaining({ p_retryable: true }),
    );
    expect(result.retryEligible).toBe(true);
  });

  test('throws on RPC errors', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database unavailable' },
    });

    await expect(
      guarded.finalizeClaimedJobFailure({
        jobId: 'job-rpc-error',
        expectedLeaseToken: 'lease-token',
        expectedClaimedBy: 'worker-id',
        errorEnvelope: {
          code: 'TIMEOUT',
          message: 'Provider timed out',
        },
      }),
    ).rejects.toThrow(/Atomic guarded update failed/);
  });
});
