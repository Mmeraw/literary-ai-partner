import { EvaluationRunnerFatalError } from './runnerHeartbeat';

export enum FatalErrorCategory {
  LEASE_LOST = 'LEASE_LOST_FATAL',
  LEASE_OWNED = 'LEASE_STILL_OWNED_FATAL',
  NON_FATAL = 'NON_FATAL_PIPELINE_ERROR',
}

const LEASE_LOSS_PATTERNS = [
  /lease ownership changed/i,
  /lease ownership validation failed/i,
  /lease extension affected no rows/i,
  /lease ownership likely changed/i,
  /guarded evaluation job update blocked/i,
  /ghost write/i,
  /write attempt blocked/i,
  /lost running state/i,
  /job .* was cancelled externally/i,
];

export function categorizeProcessorError(error: unknown): FatalErrorCategory {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof EvaluationRunnerFatalError) {
    return LEASE_LOSS_PATTERNS.some((pattern) => pattern.test(message))
      ? FatalErrorCategory.LEASE_LOST
      : FatalErrorCategory.LEASE_OWNED;
  }

  return LEASE_LOSS_PATTERNS.some((pattern) => pattern.test(message))
    ? FatalErrorCategory.LEASE_LOST
    : FatalErrorCategory.NON_FATAL;
}

export function isLeaseLostFatal(error: unknown): boolean {
  return categorizeProcessorError(error) === FatalErrorCategory.LEASE_LOST;
}
