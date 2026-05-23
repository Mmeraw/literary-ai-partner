import { createAdminClient } from "@/lib/supabase/admin";

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
  status: "lease_lost";
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

function isRetryableFailure(error: { code: string; message?: string }): boolean {
  const code = error.code || "";

  const nonRetryablePrefixes = [
    "PASS3_FAILED",
    "LLR_PRE_ARTIFACT_GENERATION_BLOCK",
    "QG_",
    "SCHEMA_INVALID",
    "SCHEMA_VIOLATION",
    "EVALUATION_INVALID",
    "MANUSCRIPT_NOT_FOUND",
    "CHUNK_MISSING",
    "AUTH_FAILED",
    "INVALID_INPUT",
    "QUOTA_EXCEEDED",
  ];

  if (nonRetryablePrefixes.some((prefix) => code.startsWith(prefix))) {
    return false;
  }

  const retryableSignals = [
    "NETWORK_ERROR",
    "TIMEOUT",
    "RATE_LIMIT",
    "SERVICE_UNAVAILABLE",
    "PROVIDER_ERROR",
  ];

  return retryableSignals.some((signal) => code.includes(signal));
}

export async function finalizeClaimedJobFailure(
  input: GuardedFinalizeFailureInput,
): Promise<GuardedFinalizeFailureResult> {
  const retryable =
    typeof input.errorEnvelope.retryable === "boolean"
      ? input.errorEnvelope.retryable
      : isRetryableFailure(input.errorEnvelope);

  const supabase = createAdminClient();
  if (!supabase) {
    throw new Error("[finalizeClaimedJobFailure] Supabase unavailable");
  }

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
      status: "lease_lost",
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
