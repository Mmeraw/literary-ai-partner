/**
 * Invariant Definitions - Phase A.4
 *
 * Each invariant is a named check that runs against job data
 * and returns pass/fail with optional violation details.
 */

import { JOB_STATUS } from "@/lib/jobs/types";

export interface InvariantCheckResult {
  name: string;
  status: "pass" | "fail" | "error";
  detail: string;
  violations: string[];
}

export interface InvariantDefinition {
  name: string;
  description: string;
  check: (jobs: any[]) => InvariantCheckResult;
}

// Canonical status values from the job system
const VALID_STATUSES = new Set(Object.values(JOB_STATUS));
const VALID_PHASES = new Set(["phase_1", "phase_2", "phase_3"]);

/**
 * INV-001: No job should have a non-canonical status value
 */
const canonicalStatusCheck: InvariantDefinition = {
  name: "canonical_status",
  description: "All jobs must have canonical status values",
  check: (jobs) => {
    const violations: string[] = [];
    for (const job of jobs) {
      if (!VALID_STATUSES.has(job.status)) {
        violations.push(`Job ${job.id}: invalid status "${job.status}"`);
      }
    }
    return {
      name: "canonical_status",
      status: violations.length === 0 ? "pass" : "fail",
      detail: violations.length === 0
        ? `All ${jobs.length} jobs have valid statuses`
        : `${violations.length} job(s) with invalid status`,
      violations,
    };
  },
};

/**
 * INV-002: No job should have a non-canonical phase value
 */
const canonicalPhaseCheck: InvariantDefinition = {
  name: "canonical_phase",
  description: "All job progress.phase values must be canonical",
  check: (jobs) => {
    const violations: string[] = [];
    for (const job of jobs) {
      const phase = job.progress?.phase;
      if (phase && !VALID_PHASES.has(phase)) {
        violations.push(`Job ${job.id}: invalid phase "${phase}"`);
      }
    }
    return {
      name: "canonical_phase",
      status: violations.length === 0 ? "pass" : "fail",
      detail: violations.length === 0
        ? `All phases are canonical`
        : `${violations.length} job(s) with non-canonical phase`,
      violations,
    };
  },
};

/**
 * INV-003: Running jobs must have a recent heartbeat (< 10 min)
 */
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

const staleRunningCheck: InvariantDefinition = {
  name: "stale_running_jobs",
  description: "Running jobs should have a heartbeat within 10 minutes",
  check: (jobs) => {
    const now = Date.now();
    const violations: string[] = [];
    const runningJobs = jobs.filter((j) => j.status === "running");

    for (const job of runningJobs) {
      const hb = job.last_heartbeat || job.updated_at;
      if (hb) {
        const age = now - new Date(hb).getTime();
        if (age > STALE_THRESHOLD_MS) {
          const mins = Math.round(age / 60000);
          violations.push(`Job ${job.id}: last heartbeat ${mins}m ago`);
        }
      } else {
        violations.push(`Job ${job.id}: no heartbeat timestamp`);
      }
    }
    return {
      name: "stale_running_jobs",
      status: violations.length === 0 ? "pass" : "fail",
      detail: violations.length === 0
        ? `${runningJobs.length} running job(s), all have recent heartbeats`
        : `${violations.length} of ${runningJobs.length} running job(s) are stale`,
      violations,
    };
  },
};

/**
 * INV-004: Failed jobs should have a last_error field
 */
const failedJobErrorCheck: InvariantDefinition = {
  name: "failed_jobs_have_error",
  description: "Failed jobs must have a last_error field for diagnostics",
  check: (jobs) => {
    const violations: string[] = [];
    const failedJobs = jobs.filter((j) => j.status === "failed");

    for (const job of failedJobs) {
      if (!job.last_error && !job.progress?.error_code) {
        violations.push(`Job ${job.id}: failed with no error details`);
      }
    }
    return {
      name: "failed_jobs_have_error",
      status: violations.length === 0 ? "pass" : "fail",
      detail: violations.length === 0
        ? `${failedJobs.length} failed job(s), all have error info`
        : `${violations.length} failed job(s) missing error details`,
      violations,
    };
  },
};

/**
 * INV-005: No orphaned running jobs (running > 30 min with no progress change)
 */
const ORPHAN_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

const orphanedRunningCheck: InvariantDefinition = {
  name: "orphaned_running_jobs",
  description: "No running jobs should be stuck for > 30 minutes without updates",
  check: (jobs) => {
    const now = Date.now();
    const violations: string[] = [];
    const runningJobs = jobs.filter((j) => j.status === "running");

    for (const job of runningJobs) {
      const updated = job.updated_at ? new Date(job.updated_at).getTime() : 0;
      const age = now - updated;
      if (age > ORPHAN_THRESHOLD_MS) {
        const mins = Math.round(age / 60000);
        violations.push(`Job ${job.id}: running for ${mins}m with no update`);
      }
    }
    return {
      name: "orphaned_running_jobs",
      status: violations.length === 0 ? "pass" : "fail",
      detail: violations.length === 0
        ? `No orphaned running jobs detected`
        : `${violations.length} potentially orphaned running job(s)`,
      violations,
    };
  },
};

/**
 * INV-006: Queued jobs should not be older than 1 hour
 */
const QUEUE_AGE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

const staleQueuedCheck: InvariantDefinition = {
  name: "stale_queued_jobs",
  description: "Queued jobs should not be waiting longer than 1 hour",
  check: (jobs) => {
    const now = Date.now();
    const violations: string[] = [];
    const queuedJobs = jobs.filter((j) => j.status === "queued");

    for (const job of queuedJobs) {
      const created = job.created_at ? new Date(job.created_at).getTime() : 0;
      const age = now - created;
      if (age > QUEUE_AGE_THRESHOLD_MS) {
        const mins = Math.round(age / 60000);
        violations.push(`Job ${job.id}: queued for ${mins}m`);
      }
    }
    return {
      name: "stale_queued_jobs",
      status: violations.length === 0 ? "pass" : "fail",
      detail: violations.length === 0
        ? `${queuedJobs.length} queued job(s), none stale`
        : `${violations.length} queued job(s) waiting > 1 hour`,
      violations,
    };
  },
};

/** All registered invariant definitions */
export const INVARIANT_DEFINITIONS: InvariantDefinition[] = [
  canonicalStatusCheck,
  canonicalPhaseCheck,
  staleRunningCheck,
  failedJobErrorCheck,
  orphanedRunningCheck,
  staleQueuedCheck,
];
