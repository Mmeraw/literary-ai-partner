import { createAdminClient } from "@/lib/supabase/admin";
import { isRetryableFailureCode } from "@/lib/jobs/failures";

export interface GuardedFinalizeFailureInput {
  jobId: string;
  expectedLeaseToken: string;
  expectedClaimedBy: string;
  errorEnvelope: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}

export interface GuardedFinalizeFailureWrittenResult {
  outcome: "written";
  status: "failed";
  terminalWriteSkipped: false;
  retryEligible: boolean;
  retryExhausted: boolean;
  attemptCount: number;
  maxAttempts: number;
  shouldNotify: boolean;
  failureCode: string;
}

export interface GuardedFinalizeFailureSkippedResult {
  outcome: "lease_lost";
  status: "failed";
  terminalWriteSkipped: true;
  retryEligible: false;
  retryExhausted: false;
  attemptCount: 0;
  maxAttempts: 0;
  shouldNotify: false;
  failureCode: string;
}

export type GuardedFinalizeFailureResult =
  | GuardedFinalizeFailureWrittenResult
  | GuardedFinalizeFailureSkippedResult;

export async function finalizeClaimedJobFailure(
  input: GuardedFinalizeFailureInput,
): Promise<GuardedFinalizeFailureResult> {
  const retryable =
    typeof input.errorEnvelope.retryable === "boolean"
      ? input.errorEnvelope.retryable
      : isRetryableFailureCode(input.errorEnvelope.code);

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("finalize_job_failure_atomic", {
    p_job_id: input.jobId,
    p_failure_code: input.errorEnvelope.code,
    p_error_message: input.errorEnvelope.message,
    p_retryable: retryable,
    p_expected_lease_token: input.expectedLeaseToken,
    p_expected_claimed_by: input.expectedClaimedBy,
  });

  if (error) {
    throw new Error(
      `[finalizeClaimedJobFailure] Atomic guarded update failed for job ${input.jobId}: ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    return {
      outcome: "lease_lost",
      status: "failed",
      terminalWriteSkipped: true,
      retryEligible: false,
      retryExhausted: false,
      attemptCount: 0,
      maxAttempts: 0,
      shouldNotify: false,
      failureCode: input.errorEnvelope.code,
    };
  }

  const row = data[0];
  const attemptCount = Number(row.attempt_count ?? 0);
  const maxAttempts = Number(row.max_attempts ?? 0);
  const retryExhausted = attemptCount >= maxAttempts;
  const retryEligible = retryable && !retryExhausted;
  const shouldNotify =
    (row.notified_at === null && attemptCount === 1) || retryExhausted;

  return {
    outcome: "written",
    status: "failed",
    terminalWriteSkipped: false,
    retryEligible,
    retryExhausted,
    attemptCount,
    maxAttempts,
    shouldNotify,
    failureCode: input.errorEnvelope.code,
  };
}
