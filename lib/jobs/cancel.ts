import { getJob, updateJob } from "./store";
import { JOB_STATUS, JobRecord } from "./types";

/**
 * CANON CANCEL:
 * - We do NOT introduce a non-canon terminal status ("canceled").
 * - We express cancellation as:
 *   - status: "failed" (terminal, canon)
 *   - progress.canceled_at / progress.canceled_reason (signals it was user-canceled)
 */
export async function cancelJob(
  jobId: string,
  reason: string = "User canceled"
): Promise<{ success: boolean; error?: string }> {
  const job = await getJob(jobId);
  if (!job) return { success: false, error: "Job not found" };

  // Only allow cancellation from non-terminal states (CANON: queued, running only)
  if (job.status !== JOB_STATUS.QUEUED && job.status !== JOB_STATUS.RUNNING) {
    return {
      success: false,
      error: `Cannot cancel job in ${job.status} state. Already terminal.`,
    };
  }

  const now = new Date().toISOString();

  const updates: Partial<JobRecord> = {
    status: JOB_STATUS.FAILED,
    progress: {
      ...job.progress,
      canceled_at: now,
      canceled_reason: reason,
      // keep lease info if present; do not fabricate types
      lease_id: (job.progress as any)?.lease_id ?? null,
      lease_expires_at: (job.progress as any)?.lease_expires_at ?? null,
      // ensure minimum canon keys still exist
      phase: job.progress.phase ?? null,
      phase_status: job.progress.phase_status ?? null,
      total_units: job.progress.total_units ?? null,
      completed_units: job.progress.completed_units ?? null,
    },
    updated_at: now,
  };

  const updatedJob = await updateJob(jobId, updates);
  if (!updatedJob) {
    return { success: false, error: "Failed to update job" };
  }

  return { success: true };
}

export function isJobCancelable(job: JobRecord): boolean {
  return job.status === JOB_STATUS.QUEUED || job.status === JOB_STATUS.RUNNING;
}
