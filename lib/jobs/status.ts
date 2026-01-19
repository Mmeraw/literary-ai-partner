export const JOB_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  RETRY_PENDING: "retry_pending",
  FAILED: "failed",
  COMPLETE: "complete",
  CANCELED: "canceled",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export function isActiveStatus(status: JobStatus): boolean {
  return status === JOB_STATUS.QUEUED || status === JOB_STATUS.RUNNING || status === JOB_STATUS.RETRY_PENDING;
}
