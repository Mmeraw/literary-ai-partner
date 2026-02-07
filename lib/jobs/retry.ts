/**
 * Retry Logic with Exponential Backoff + Jitter
 * 
 * Implements production-grade retry logic:
 * - Exponential backoff with cap
 * - Jitter to prevent thundering herd
 * - Top-level fields (not in progress JSON)
 * - Respects max_retries
 */

import { getJob, updateJob } from "./store";
import { JOB_STATUS, PHASES } from "./types";
import type { Job } from "./types";
import * as metrics from "./metrics";

const DEFAULT_BASE_DELAY_MS = 1000; // 1 second
const DEFAULT_MAX_DELAY_MS = 60000; // 60 seconds
const DEFAULT_MAX_RETRIES = 3;

export type RetryConfig = {
  base_delay_ms?: number;
  max_delay_ms?: number;
  max_retries?: number;
};

/**
 * Calculate next retry delay with exponential backoff + jitter.
 */
export function calculateRetryDelay(
  retry_count: number,
  config: RetryConfig = {}
): number {
  const base = config.base_delay_ms ?? DEFAULT_BASE_DELAY_MS;
  const max = config.max_delay_ms ?? DEFAULT_MAX_DELAY_MS;

  // Exponential backoff with cap
  let delay = Math.min(max, base * Math.pow(2, retry_count));

  // Add jitter: random between 0.8x and 1.2x
  const jitter = 0.8 + Math.random() * 0.4;
  delay = Math.floor(delay * jitter);

  return delay;
}

/**
 * Schedule a job for retry.
 * Keeps status=failed (canonical) and sets next_retry_at marker.
 */
export async function scheduleRetry(
  jobId: string,
  error: string,
  config: RetryConfig = {}
): Promise<{ success: boolean; next_retry_at?: string; error?: string }> {
  const job = await getJob(jobId);
  
  if (!job) {
    return { success: false, error: "Job not found" };
  }

  const prevRetryRaw = job.progress?.retry_count;
  const prevRetry =
    typeof prevRetryRaw === "number" && Number.isFinite(prevRetryRaw) ? prevRetryRaw : 0;

  const retry_count = prevRetry + 1;
  const max_retries = config.max_retries ?? DEFAULT_MAX_RETRIES;

  // Check if max retries exceeded
  if (retry_count > max_retries) {
    console.log("MaxRetriesExceeded", {
      job_id: jobId,
      retry_count,
      max_retries,
    });

    await updateJob(jobId, {
      status: "failed",
      progress: {
        ...job.progress,
        error_code: "max_retries_exceeded",
        last_error: `Max retries exceeded (${max_retries}): ${error}`,
        retry_count,
      },
      updated_at: new Date().toISOString(),
    });

    return { 
      success: false, 
      error: `Max retries exceeded (${max_retries})` 
    };
  }

  // Calculate next retry time
  const delay_ms = calculateRetryDelay(retry_count, config);
  const next_retry_at = new Date(Date.now() + delay_ms).toISOString();

  // Keep status as failed (CANON) but mark with next_retry_at for daemon pickup
  const updated = await updateJob(jobId, {
    status: JOB_STATUS.FAILED,
    progress: {
      ...job.progress,
      retry_count,
      next_retry_at,
      last_error: error,
      retry_phase: job.progress?.phase || PHASES.PHASE_1,
      lease_id: null, // Clear lease when retrying
      lease_expires_at: null,
    },
    updated_at: new Date().toISOString(),
  });

  if (!updated) {
    return { success: false, error: "Failed to update job" };
  }

  console.log("JobScheduledForRetry", {
    job_id: jobId,
    retry_count,
    next_retry_at,
    delay_ms,
  });

  return { success: true, next_retry_at };
}

/**
 * Check if a job is eligible for retry.
 * Jobs are retry-eligible when status=failed with next_retry_at marker.
 */
export function canRetryNow(job: Job): boolean {
  if (job.status !== JOB_STATUS.FAILED || !job.progress?.next_retry_at) {
    return false;
  }

  const nextRetryAt = job.progress.next_retry_at;
  if (typeof nextRetryAt !== 'string') {
    return false;
  }

  return new Date(nextRetryAt) <= new Date();
}

/**
 * Get all jobs eligible for retry.
 */
export async function getRetryableJobs(): Promise<Job[]> {
    const { getAllJobs } = await import("./store");
  const allJobs = await getAllJobs();
  
  return allJobs.filter(canRetryNow);
}
