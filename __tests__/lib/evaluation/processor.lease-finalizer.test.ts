import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('@/lib/jobs/finalizeJobFailureGuarded', () => ({
  finalizeClaimedJobFailure: jest.fn(),
}));

const guarded = require('@/lib/jobs/finalizeJobFailureGuarded') as {
  finalizeClaimedJobFailure: jest.Mock;
};

const {
  finalizeProcessorFailureWithLeaseGuard,
  ProcessorLeaseLostError,
} = require('@/lib/evaluation/processorLeaseFailureFinalizer') as typeof import('@/lib/evaluation/processorLeaseFailureFinalizer');

describe('processor lease-owner guarded failure finalizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('passes claimed lease metadata to guarded finalizer', async () => {
    guarded.finalizeClaimedJobFailure.mockResolvedValueOnce({
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

    const result = await finalizeProcessorFailureWithLeaseGuard({
      jobId: 'job-1',
      expectedLeaseToken: 'lease-token-1',
      expectedClaimedBy: 'worker-1',
      errorEnvelope: {
        code: 'PASS3_FAILED',
        message: 'failure',
        retryable: false,
      },
    });

    expect(guarded.finalizeClaimedJobFailure).toHaveBeenCalledWith({
      jobId: 'job-1',
      expectedLeaseToken: 'lease-token-1',
      expectedClaimedBy: 'worker-1',
      errorEnvelope: {
        code: 'PASS3_FAILED',
        message: 'failure',
        retryable: false,
      },
    });
    expect(result.outcome).toBe('written');
  });

  test('maps lease_lost to ProcessorLeaseLostError', async () => {
    guarded.finalizeClaimedJobFailure.mockResolvedValueOnce({
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

    await expect(
      finalizeProcessorFailureWithLeaseGuard({
        jobId: 'job-lost',
        expectedLeaseToken: 'old-token',
        expectedClaimedBy: 'old-worker',
        errorEnvelope: {
          code: 'TIMEOUT',
          message: 'worker timed out after ownership changed',
        },
      }),
    ).rejects.toThrow(ProcessorLeaseLostError);
  });

  test('bubbles guarded RPC errors', async () => {
    guarded.finalizeClaimedJobFailure.mockRejectedValueOnce(
      new Error('owner guard requires both expected lease token and claimant'),
    );

    await expect(
      finalizeProcessorFailureWithLeaseGuard({
        jobId: 'job-partial',
        expectedLeaseToken: 'lease-token-only',
        expectedClaimedBy: undefined as unknown as string,
        errorEnvelope: {
          code: 'PROCESSOR_UNCAUGHT_ERROR',
          message: 'partial metadata',
        },
      }),
    ).rejects.toThrow(/owner guard requires both/);
  });
});
