/**
 * Job Queue Backpressure
 *
 * Monitors queue depth and enforces backpressure thresholds.
 * Prevents queue overload by rejecting new jobs when the system
 * is under pressure.
 *
 * Thresholds are configurable via environment variables:
 * - BACKPRESSURE_QUEUE_WARN: Warning threshold (default: 50)
 * - BACKPRESSURE_QUEUE_HARD: Hard limit — reject new jobs (default: 100)
 * - BACKPRESSURE_OLDEST_AGE_MS: Max age for oldest queued job (default: 5min)
 *
 * @module lib/jobs/backpressure
 * @see docs/PHASE_A5_DAY2_BACKPRESSURE_COST.md
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ─── Configuration ──────────────────────────────────────────────────

export interface BackpressureConfig {
  /** Queue depth warning threshold */
  queueWarnThreshold: number;
  /** Queue depth hard limit — rejects new jobs above this */
  queueHardLimit: number;
  /** Maximum age (ms) for the oldest queued job before triggering alert */
  oldestAgeAlertMs: number;
}

/**
 * Load backpressure config from environment with safe defaults
 */
export function getBackpressureConfig(): BackpressureConfig {
  return {
    queueWarnThreshold: parseInt(
      process.env.BACKPRESSURE_QUEUE_WARN ?? "50",
      10
    ),
    queueHardLimit: parseInt(
      process.env.BACKPRESSURE_QUEUE_HARD ?? "100",
      10
    ),
    oldestAgeAlertMs: parseInt(
      process.env.BACKPRESSURE_OLDEST_AGE_MS ?? String(5 * 60 * 1000),
      10
    ),
  };
}

// ─── Types ──────────────────────────────────────────────────────────

export type BackpressureLevel = "ok" | "warn" | "critical";

export interface BackpressureStatus {
  /** Current backpressure level */
  level: BackpressureLevel;
  /** Number of jobs currently queued */
  queueDepth: number;
  /** Number of jobs currently running */
  runningCount: number;
  /** Age of the oldest queued job in milliseconds (null if queue empty) */
  oldestQueuedAgeMs: number | null;
  /** Whether new jobs should be accepted */
  acceptingNewJobs: boolean;
  /** Human-readable reason if not accepting */
  reason: string | null;
  /** Active thresholds */
  thresholds: BackpressureConfig;
  /** Timestamp of check */
  checkedAt: string;
}

export interface QueueDepthSnapshot {
  queued: number;
  running: number;
  failed: number;
  total: number;
  oldestQueuedAt: string | null;
}

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Get current queue depth snapshot
 *
 * Read-only query against evaluation_jobs table.
 */
export async function getQueueDepth(): Promise<QueueDepthSnapshot> {
  const supabase = createAdminClient();

  const { data: jobs, error } = await supabase
    .from("evaluation_jobs")
    .select("status, created_at")
    .in("status", ["queued", "running", "failed"]);

  if (error) {
    console.error("[backpressure] Error fetching queue depth:", error);
    throw error;
  }

  const rows = jobs ?? [];
  const queued = rows.filter((j) => j.status === "queued");
  const running = rows.filter((j) => j.status === "running");
  const failed = rows.filter((j) => j.status === "failed");

  // Find oldest queued job
  let oldestQueuedAt: string | null = null;
  if (queued.length > 0) {
    const sorted = queued
      .map((j) => j.created_at)
      .sort();
    oldestQueuedAt = sorted[0];
  }

  return {
    queued: queued.length,
    running: running.length,
    failed: failed.length,
    total: rows.length,
    oldestQueuedAt,
  };
}

/**
 * Check backpressure status
 *
 * Returns the current pressure level and whether new jobs
 * should be accepted. This is the primary entry point for
 * job submission endpoints to call before enqueueing.
 */
export async function checkBackpressure(): Promise<BackpressureStatus> {
  const config = getBackpressureConfig();
  const snapshot = await getQueueDepth();
  const now = new Date();

  // Calculate oldest job age
  let oldestQueuedAgeMs: number | null = null;
  if (snapshot.oldestQueuedAt) {
    oldestQueuedAgeMs =
      now.getTime() - new Date(snapshot.oldestQueuedAt).getTime();
  }

  // Determine level
  let level: BackpressureLevel = "ok";
  let acceptingNewJobs = true;
  let reason: string | null = null;

  if (snapshot.queued >= config.queueHardLimit) {
    level = "critical";
    acceptingNewJobs = false;
    reason = `Queue depth (${snapshot.queued}) exceeds hard limit (${config.queueHardLimit})`;
  } else if (snapshot.queued >= config.queueWarnThreshold) {
    level = "warn";
    acceptingNewJobs = true; // Still accept, but warn
    reason = `Queue depth (${snapshot.queued}) exceeds warning threshold (${config.queueWarnThreshold})`;
  }

  // Also check oldest age
  if (
    oldestQueuedAgeMs !== null &&
    oldestQueuedAgeMs > config.oldestAgeAlertMs
  ) {
    if (level === "ok") {
      level = "warn";
    }
    const ageMinutes = Math.round(oldestQueuedAgeMs / 60_000);
    const thresholdMinutes = Math.round(config.oldestAgeAlertMs / 60_000);
    reason =
      (reason ? reason + "; " : "") +
      `Oldest queued job is ${ageMinutes}min old (threshold: ${thresholdMinutes}min)`;
  }

  // Log warnings
  if (level === "warn") {
    console.warn(`[backpressure] WARNING: ${reason}`);
  } else if (level === "critical") {
    console.error(`[backpressure] CRITICAL: ${reason}`);
  }

  return {
    level,
    queueDepth: snapshot.queued,
    runningCount: snapshot.running,
    oldestQueuedAgeMs,
    acceptingNewJobs,
    reason,
    thresholds: config,
    checkedAt: now.toISOString(),
  };
}

/**
 * Guard function for job submission endpoints
 *
 * Call before enqueueing a new job. Returns null if OK,
 * or an error object if backpressure rejects the submission.
 *
 * Usage:
 *   const blocked = await backpressureGuard();
 *   if (blocked) return NextResponse.json(blocked, { status: 503 });
 */
export async function backpressureGuard(): Promise<{
  error: string;
  code: string;
  retryAfter: number;
  queueDepth: number;
} | null> {
  const status = await checkBackpressure();

  if (!status.acceptingNewJobs) {
    return {
      error: "System is under backpressure. Please try again later.",
      code: "backpressure_exceeded",
      retryAfter: 30,
      queueDepth: status.queueDepth,
    };
  }

  return null;
}
