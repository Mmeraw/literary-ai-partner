/**
 * Job Cancellation Logic
 * 
 * Cancellation is a terminal state like complete/failed.
 * - status="canceled" is terminal
 * - Clears lease_id and lease_expires_at
 * - Preserves progress snapshot
 * - Only allowed from queued, running, or retry_pending states
 */

import { getJob, updateJob } from "./store";
import type { Job } from "./types";

export type CancelResult = 
  | { success: true; job: Job }
  | { success: false; error: string };

/**
 * Cancel a job. Terminal state - clears leases, preserves progress.
 */
export async function cancelJob(jobId: string): Promise<CancelResult> {
  const job = await getJob(jobId);
  
  if (!job) {
    return { success: false, error: "Job not found" };
  }

  // Only allow cancellation from non-terminal states
  const cancelableStatuses = ["queued", "running", "retry_pending"];
  if (!cancelableStatuses.includes(job.status)) {
    return { 
      success: false, 
      error: `Cannot cancel job in ${job.status} state. Already terminal.` 
    };
  }

  // Set to canceled, clear lease, preserve progress
  const now = new Date().toISOString();
  const updates = {
    status: "canceled" as const,
    progress: {
      ...job.progress,
      lease_id: null,
      lease_expires_at: null,
      canceled_at: now,
      canceled_reason: "User requested cancellation",
    },
    updated_at: now,
  };

  const updatedJob = await updateJob(jobId, updates);
  
  if (!updatedJob) {
    return { success: false, error: "Failed to update job" };
  }

  console.log("JobCanceled", {
    job_id: jobId,
    previous_status: job.status,
    phase: job.progress?.phase,
    timestamp: now,
  });

  return { success: true, job: updatedJob };
}

/**
 * Check if a job can be canceled.
 */
export function canCancelJob(job: Job): boolean {
  return ["queued", "running", "retry_pending"].includes(job.status);
}

/**
 * Check if job is canceled (for worker loops).
 */
export function isCanceled(job: Job): boolean {
  return job.status === "canceled";
}
