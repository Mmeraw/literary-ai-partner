import {
  finalizeClaimedJobFailure,
  type GuardedFinalizeFailureResult,
} from '@/lib/jobs/finalizeJobFailureGuarded';

export class ProcessorLeaseLostError extends Error {
  readonly code = 'PROCESSOR_LEASE_LOST';
  readonly jobId: string;
  readonly failureCode: string;

  constructor(args: { jobId: string; failureCode: string }) {
    super(
      `Processor lease ownership changed for job ${args.jobId}; ` +
        `terminal failure write was skipped for failureCode=${args.failureCode}`,
    );
    this.name = 'ProcessorLeaseLostError';
    this.jobId = args.jobId;
    this.failureCode = args.failureCode;
  }
}

export function isProcessorLeaseLostError(error: unknown): error is ProcessorLeaseLostError {
  return error instanceof ProcessorLeaseLostError || (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'PROCESSOR_LEASE_LOST'
  );
}

export async function finalizeProcessorFailureWithLeaseGuard(input: {
  jobId: string;
  expectedLeaseToken: string;
  expectedClaimedBy: string;
  errorEnvelope: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}): Promise<GuardedFinalizeFailureResult> {
  const result = await finalizeClaimedJobFailure(input);

  if (result.outcome === 'lease_lost') {
    throw new ProcessorLeaseLostError({
      jobId: input.jobId,
      failureCode: input.errorEnvelope.code,
    });
  }

  return result;
}
