import { Job, JobStatus } from "./types";

/**
 * Central JobStatus transition table.
 * All status changes must be validated against this.
 */
const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["running", "failed"],
  running: ["complete", "failed", "retry_pending"],
  retry_pending: ["running", "failed"],
  failed: [],
  complete: [],
  canceled: [],
};

/**
 * Pure function to check if a transition is allowed.
 */
export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  const allowedNext = ALLOWED_TRANSITIONS[from];
  return Array.isArray(allowedNext) ? allowedNext.includes(to) : false;
}

/**
 * Throws if a transition is not allowed.
 * Use this in any code path that mutates job.status.
 */
export function assertValidTransition(job: Job, nextStatus: JobStatus): void {
  if (!isValidTransition(job.status, nextStatus)) {
    throw new Error(`Invalid status transition: ${job.status} -> ${nextStatus}`);
  }
}
