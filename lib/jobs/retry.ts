/**
 * Retry Logic with Exponential Backoff + Jitter
 *
 * Implements production-grade retry logic:
 * - Exponential backoff with cap
 * - Jitter to prevent thundering herd
 * - Status remains FAILED until retry pickup
 * - Respects max_retries
 * - Blocks non-retryable governance failures
 */

import { getJob, updateJob } from "./store";
import { JOB_STATUS, PHASES } from "./types";
import type { Job, JobProgress } from "./types";
import {
  calculateNextAttemptAt,
  getBackoffDelay,
  hasExhaustedRetries,
} from "./retryBackoff";
import {
  assertValidFailureCode,
  isTransientFailure,
  type FailureCode,
} from "./failures";

const DEFAULT_MAX_RETRIES = 3;

export type RetryConfig = {
  base_delay_ms?: number;
  max_delay_ms?: number;
  max_retries?: number;
};

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeRetryCount(value: unknown): number {
  const count = asFiniteNumber(value, 0);
  return count >= 0 ? Math.floor(count) : 0;
}

function getFailureCode(job: Job): FailureCode | undefined {
  const progress = (job.progress ?? {}) as Record<string, unknown>;

  const rawFailureCode =
    typeof progress.failure_code === "string"
      ? progress.failure_code
      : typeof progress.error_code === "string"
        ? progress.error_code
        : undefined;

  if (!rawFailureCode) return undefined;

  try {
    assertValidFailureCode(rawFailureCode);
    return rawFailureCode;
  } catch {
    return undefined;
  }
}

function isRetryableFailureCode(code: FailureCode | undefined): boolean {
  if (!code) return true;
  return isTransientFailure(code);
}

function msToWholeSeconds(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value / 1000));
}

/**
 * Calculate next retry delay with exponential backoff + jitter.
 * Kept for external consumers; delegates to retryBackoff.
 */
export function calculateRetryDelay(
  retry_count: number,
  config: RetryConfig = {}
): number {
  const baseDelaySeconds = msToWholeSeconds(config.base_delay_ms) ?? 30;
  const maxDelaySeconds = msToWholeSeconds(config.max_delay_ms) ?? 1800;
  const rawDelay = getBackoffDelay(retry_count, baseDelaySeconds);
  return Math.min(maxDelaySeconds, rawDelay) * 1000;
}

/**
 * Schedule a job for retry.
 * Keeps status=failed (canonical) and sets next_retry_at marker.
 */
export async function scheduleRetry(
  jobId: string,
  error: string,
  config: RetryConfig = {},
): Promise<{ success: boolean; next_retry_at?: string; error?: string }> {
  const job = await getJob(jobId);

  if (!job) {
    return { success: false, error: "Job not found" };
  }

  const failureCode = getFailureCode(job);
  if (!isRetryableFailureCode(failureCode)) {
    console.log("RetryBlockedNonRetryableFailure", {
      job_id: jobId,
      failure_code: failureCode,
    });
    return {
      success: false,
      error: `Non-retryable failure: ${failureCode}`,
    };
  }

  const currentRetryCount = normalizeRetryCount(
    (job.progress as Record<string, unknown> | undefined)?.retry_count,
  );
  const retryCount = currentRetryCount + 1;
  const maxRetries = Math.max(0, Math.floor(config.max_retries ?? DEFAULT_MAX_RETRIES));

  if (hasExhaustedRetries(retryCount, maxRetries)) {
    console.log("MaxRetriesExceeded", {
      job_id: jobId,
      retry_count: retryCount,
      max_retries: maxRetries,
    });

    const updated = await updateJob(jobId, {
      status: JOB_STATUS.FAILED,
      progress: {
        ...(job.progress),
        error_code: "MAX_RETRIES_EXCEEDED",
        last_error: `Max retries exceeded (${maxRetries}): ${error}`,
        retry_count: retryCount,
        next_retry_at: null,
        retry_phase:
          ((job.progress as Record<string, unknown> | undefined)?.phase as string | undefined) ||
          PHASES.PHASE_1,
        lease_id: null,
        lease_expires_at: null,
      } as JobProgress,
      updated_at: new Date().toISOString(),
    });

    if (!updated) {
      return { success: false, error: "Failed to update job after max retries exceeded" };
    }

    return {
      success: false,
      error: `Max retries exceeded (${maxRetries})`,
    };
  }

  const baseDelaySeconds = msToWholeSeconds(config.base_delay_ms);
  const maxDelaySeconds = msToWholeSeconds(config.max_delay_ms);

  const nextRetryAt = calculateNextAttemptAt(
    retryCount,
    baseDelaySeconds,
    maxDelaySeconds,
  );

  const delaySeconds = getBackoffDelay(retryCount, baseDelaySeconds);

  const updated = await updateJob(jobId, {
    status: JOB_STATUS.FAILED,
    progress: {
      ...(job.progress),
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
      last_error: error,
      retry_phase:
        ((job.progress as Record<string, unknown> | undefined)?.phase as string | undefined) ||
        PHASES.PHASE_1,
      lease_id: null,
      lease_expires_at: null,
    } as JobProgress,
    updated_at: new Date().toISOString(),
  });

  if (!updated) {
    return { success: false, error: "Failed to update job" };
  }

  console.log("JobScheduledForRetry", {
    job_id: jobId,
    retry_count: retryCount,
    next_retry_at: nextRetryAt,
    delay_seconds: delaySeconds,
    failure_code: failureCode ?? null,
  });

  return { success: true, next_retry_at: nextRetryAt };
}

/**
 * Check if a job is eligible for retry.
 * Jobs are retry-eligible when status=failed with next_retry_at marker.
 */
export function canRetryNow(job: Job): boolean {
  if (job.status !== JOB_STATUS.FAILED) {
    return false;
  }

  const failureCode = getFailureCode(job);
  if (!isRetryableFailureCode(failureCode)) {
    return false;
  }

  const progress = (job.progress ?? {}) as Record<string, unknown>;
  const nextRetryAtRaw = progress.next_retry_at;

  if (typeof nextRetryAtRaw !== "string" || nextRetryAtRaw.length === 0) {
    return false;
  }

  const nextRetryAtMs = new Date(nextRetryAtRaw).getTime();
  if (!Number.isFinite(nextRetryAtMs)) {
    return false;
  }

  return nextRetryAtMs <= Date.now();
}

/**
 * Get all jobs eligible for retry.
 */
export async function getRetryableJobs(): Promise<Job[]> {
  const { getAllJobs } = await import("./store");
  const allJobs = await getAllJobs();
  return allJobs.filter(canRetryNow);
}
