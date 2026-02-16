/**
 * A4.2 — Structured Lifecycle Transition Logs for Evaluation Jobs
 *
 * Emit structured, invariant-friendly logs for all meaningful job state
 * transitions so operators can diagnose behavior without querying the database.
 *
 * Logged lifecycle transitions:
 *   queued -> running
 *   running -> completed
 *   running -> failed
 *   lease_expired -> requeued
 *   retry_requested -> queued
 *
 * Required log fields:
 *   job_id, from_status, to_status, worker_id, attempt_count,
 *   lease_until, phase, work_type, reason
 *
 * Invariant-supporting signals:
 *   - Warning if claiming a job already running with non-expired lease
 *   - Warning on unexpected or invalid state transitions
 *
 * Closes #6
 */

import { logger } from "./logger";

// ── Types ──────────────────────────────────────────────────────

export interface TransitionLogFields {
  job_id: string;
  from_status: string;
  to_status: string;
  worker_id?: string;
  attempt_count?: number;
  lease_until?: string | null;
  phase?: string | null;
  work_type?: string;
  reason?: string;
  [key: string]: unknown;
}

type LifecycleEvent =
  | "job.transition"
  | "job.transition.invalid"
  | "job.lease_claim_conflict"
  | "job.lease_expired"
  | "job.retry_requested";

// ── Core transition logger ─────────────────────────────────────

/**
 * Log a valid lifecycle transition.
 * All fields are structured JSON for Vercel log search.
 */
export function logTransition(fields: TransitionLogFields): void {
  const event: LifecycleEvent = "job.transition";
  logger.info(
    `Lifecycle: ${fields.from_status} -> ${fields.to_status}`,
    {
      event,
      ...fields,
      timestamp: new Date().toISOString(),
    } as Record<string, unknown>,
  );
}

// ── Specific transition helpers ────────────────────────────────

export function logQueuedToRunning(fields: Omit<TransitionLogFields, "from_status" | "to_status">): void {
  logTransition({ ...fields, from_status: "queued", to_status: "running" });
}

export function logRunningToCompleted(fields: Omit<TransitionLogFields, "from_status" | "to_status">): void {
  logTransition({ ...fields, from_status: "running", to_status: "completed" });
}

export function logRunningToFailed(fields: Omit<TransitionLogFields, "from_status" | "to_status">): void {
  logTransition({ ...fields, from_status: "running", to_status: "failed" });
}

export function logLeaseExpiredToRequeued(fields: Omit<TransitionLogFields, "from_status" | "to_status">): void {
  logTransition({ ...fields, from_status: "lease_expired", to_status: "requeued" });
  logger.info("Lifecycle: lease_expired -> requeued", {
    event: "job.lease_expired" as LifecycleEvent,
    ...fields,
    timestamp: new Date().toISOString(),
  } as Record<string, unknown>);
}

export function logRetryRequestedToQueued(fields: Omit<TransitionLogFields, "from_status" | "to_status">): void {
  logTransition({ ...fields, from_status: "retry_requested", to_status: "queued" });
  logger.info("Lifecycle: retry_requested -> queued", {
    event: "job.retry_requested" as LifecycleEvent,
    ...fields,
    timestamp: new Date().toISOString(),
  } as Record<string, unknown>);
}

// ── Invariant-supporting signals ───────────────────────────────

/**
 * Emit warning/error log if a worker attempts to claim a job
 * already running with a non-expired lease owned by another worker.
 */
export function logLeaseClaimConflict(fields: {
  job_id: string;
  existing_worker_id?: string;
  requesting_worker_id?: string;
  lease_until?: string | null;
  phase?: string | null;
}): void {
  logger.warn("Invariant signal: lease claim conflict", {
    event: "job.lease_claim_conflict" as LifecycleEvent,
    ...fields,
    timestamp: new Date().toISOString(),
  } as Record<string, unknown>);
}

/**
 * Emit error log on unexpected or invalid state transition attempt.
 */
export function logInvalidTransition(fields: TransitionLogFields & { error?: string }): void {
  logger.error(
    `Invalid transition: ${fields.from_status} -> ${fields.to_status}`,
    {
      event: "job.transition.invalid" as LifecycleEvent,
      ...fields,
      timestamp: new Date().toISOString(),
    } as Record<string, unknown>,
  );
}

// ── Exported event names for dashboard queries ─────────────────

export const LIFECYCLE_EVENTS = [
  "job.transition",
  "job.transition.invalid",
  "job.lease_claim_conflict",
  "job.lease_expired",
  "job.retry_requested",
] as const;
