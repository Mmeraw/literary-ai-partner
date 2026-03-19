/**
 * Polling configuration and logic - single source of truth
 * Shared between hooks and tests to prevent drift
 */

import type { EvaluationJobRow } from "../db/schema";

/**
 * Polling interval constants (milliseconds)
 * These define the adaptive backoff strategy for 100k-user scale
 */
export const POLLING_INTERVALS = {
  /** 0-30s: Fast feedback for new jobs */
  FAST: 2000,
  /** 30s-2min: Reduce load as job matures */
  MEDIUM: 5000,
  /** 2min-10min: Minimize calls for long jobs */
  SLOW: 10000,
  /** 10min+: Very slow polling for stuck/long jobs */
  SLOWEST: 30000,
} as const;

/**
 * Time thresholds (seconds) for transitioning between polling intervals
 */
export const POLLING_THRESHOLDS = {
  /** Transition from FAST to MEDIUM at 30 seconds */
  FAST_MEDIUM: 30,
  /** Transition from MEDIUM to SLOW at 2 minutes */
  MEDIUM_SLOW: 120,
  /** Transition from SLOW to SLOWEST at 10 minutes */
  SLOW_SLOWEST: 600,
} as const;

/**
 * Terminal job statuses per JOB_CONTRACT_v1 Section 3.2
 * These jobs require no further polling
 */
const TERMINAL_STATUSES = ["complete", "failed"] as const;

/**
 * Check if a job status is terminal (no further processing)
 * @param status Job status to check
 * @returns true if status is terminal per JOB_CONTRACT_v1
 */
function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as any);
}

/**
 * Determine polling interval based on oldest active job's age
 * Returns the appropriate interval to reduce server load while maintaining UX
 *
 * @param jobs Array of evaluation job rows
 * @returns Polling interval in milliseconds
 */
export function getPollingInterval(jobs: EvaluationJobRow[]): number {
  // Filter out terminal jobs - only active jobs affect polling interval
  const activeJobs = jobs.filter((job) => !isTerminalStatus(job.status));

  // Fast polling when no active work (quick UI refresh, then settle)
  if (activeJobs.length === 0) return POLLING_INTERVALS.FAST;

  // Find the oldest active job to determine appropriate backoff
  const now = Date.now();
  const oldestAge = Math.max(
    ...activeJobs.map((job) => {
      const created = job.created_at ? new Date(job.created_at).getTime() : now;
      return now - created;
    })
  );

  const ageSeconds = oldestAge / 1000;

  // Adaptive backoff based on job age
  if (ageSeconds < POLLING_THRESHOLDS.FAST_MEDIUM)
    return POLLING_INTERVALS.FAST;
  if (ageSeconds < POLLING_THRESHOLDS.MEDIUM_SLOW)
    return POLLING_INTERVALS.MEDIUM;
  if (ageSeconds < POLLING_THRESHOLDS.SLOW_SLOWEST)
    return POLLING_INTERVALS.SLOW;
  return POLLING_INTERVALS.SLOWEST;
}
