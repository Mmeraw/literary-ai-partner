/**
 * UI Display Contract for Job System
 *
 * This module defines the canonical way to display job status in the UI.
 * It ensures consistent presentation across all UI components.
 *
 * Key principles:
 * 1. `status` is the primary badge (complete, running, failed, queued) - CANON only
 * 2. `phase` + `phase_status` provide granular progress detail
 * 3. Progress bars use `completed_units / total_units`
 * 4. Invariant: phase_status="complete" never coexists with status="running"
 * 
 * Note: UI may derive display states (like "Canceled" or "Retrying") from
 * progress markers (canceled_at, next_retry_at) but DB status remains CANON.
 */

import type { Job, Phase, JobStatus, PhaseStatus } from "./types";

export type JobStatusBadge = JobStatus; // CANON only: queued, running, complete, failed

/**
 * Safe conversion of unknown values to display text.
 * Use this instead of inline String() for consistent null/undefined handling.
 */
export function toUiText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export type JobPhaseDetail = {
  phase: Phase | null;
  phase_status: PhaseStatus;
  display: string; // Human-readable: "Phase 1: Starting", "Phase 2: Complete"
};

export type JobProgressInfo = {
  completed: number;
  total: number;
  percentage: number; // 0-100
  display: string; // "3/5 units" or "Complete"
};

export type JobDisplayInfo = {
  badge: JobStatusBadge;
  badgeColor: "green" | "blue" | "red" | "gray" | "yellow";
  badgeLabel: string;
  phaseDetail: JobPhaseDetail;
  progress: JobProgressInfo;
  message: string; // Current processing message
  canRetry: boolean;
  canCancel: boolean;
};

/**
 * Get comprehensive display info for a job.
 * This is the single source of truth for UI presentation.
 */
export function getJobDisplayInfo(job: Job): JobDisplayInfo {
  const status = job.status;
  const progress = job.progress;
  const phase = progress?.phase ?? null;
  const phase_status = progress?.phase_status ?? null;
  const completed = (progress?.completed_units as number | undefined) ?? 0;
  const total = (progress?.total_units as number | undefined) ?? 0;
  const message = (progress?.message as string | undefined) ?? "";

  // Badge determination (CANON statuses only)
  const badge: JobStatusBadge = status;
  let badgeColor: "green" | "blue" | "red" | "gray";
  let badgeLabel: string;

  // Check for special display cases based on progress markers
  const isCanceled = status === "failed" && !!(progress?.canceled_at);
  const isRetrying = status === "failed" && !!(progress?.next_retry_at);

  if (isCanceled) {
    badgeColor = "gray";
    badgeLabel = "Canceled";
  } else if (isRetrying) {
    badgeColor = "gray";
    badgeLabel = "Retrying";
  } else {
    switch (status) {
      case "complete":
        badgeColor = "green";
        badgeLabel = "Complete";
        break;
      case "running":
        badgeColor = "blue";
        badgeLabel = "Running";
        break;
      case "failed":
        badgeColor = "red";
        badgeLabel = "Failed";
        break;
      case "queued":
      default:
        badgeColor = "gray";
        badgeLabel = "Queued";
        break;
    }
  }

  // Phase detail
  let phaseDisplay = "";
  if (phase && phase_status) {
    const phaseNum = phase === "phase_1" ? "1" : "2"; // Display only
    const statusLabel =
      phase_status === "complete"
        ? "Complete"
        : phase_status === "failed"
          ? "Failed"
          : phase_status === "running"
            ? "Running"
            : "Queued";
    phaseDisplay = `Phase ${phaseNum}: ${statusLabel}`;
  }

  const phaseDetail: JobPhaseDetail = {
    phase,
    phase_status,
    display: phaseDisplay,
  };

  // Progress info
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progressDisplay =
    status === "complete"
      ? "Complete"
      : total > 0
        ? `${completed}/${total} units`
        : "—";

  const progressInfo: JobProgressInfo = {
    completed,
    total,
    percentage,
    display: progressDisplay,
  };

  // Action availability (based on CANON statuses)
  const canRetry = status === "failed" && !isCanceled; // Can retry failed jobs unless canceled
  const canCancel = status === "running" || status === "queued"; // Can cancel active jobs only

  return {
    badge,
    badgeColor,
    badgeLabel,
    phaseDetail,
    progress: progressInfo,
    message,
    canRetry,
    canCancel,
  };
}

/**
 * Get a simple status badge for tables/lists.
 */
export function getJobStatusBadge(status: JobStatusBadge): {
  label: string;
  color: string;
  className: string;
} {
  const colorMap = {
    complete: { label: "Complete", color: "#10b981", className: "bg-green-100 text-green-800" },
    running: { label: "Running", color: "#3b82f6", className: "bg-blue-100 text-blue-800" },
    failed: { label: "Failed", color: "#ef4444", className: "bg-red-100 text-red-800" },
    queued: { label: "Queued", color: "#6b7280", className: "bg-gray-100 text-gray-800" },
  };

  return colorMap[status] || colorMap.queued;
}

/**
 * Validate job state invariants (for debugging/assertions).
 * Returns error message if invariant is violated, null otherwise.
 */
export function validateJobInvariants(job: Job): string | null {
  const progress = job.progress;
  const status = job.status;
  const phase_status = progress?.phase_status;
  const completed = (progress?.completed_units as number | undefined) ?? 0;
  const total = (progress?.total_units as number | undefined) ?? 0;

  // Invariant 1: phase_status="complete" should never coexist with status="running"
  if (phase_status === "complete" && status === "running") {
    return `INVARIANT VIOLATION: phase_status="complete" with status="running" for job ${job.id}`;
  }

  // Invariant 2: completed_units <= total_units
  if (completed > total && total > 0) {
    return `INVARIANT VIOLATION: completed_units (${completed}) > total_units (${total}) for job ${job.id}`;
  }

  // Invariant 3: If status="complete", phase_status should also be "complete"
  if (status === "complete" && phase_status && phase_status !== "complete") {
    return `INVARIANT VIOLATION: status="complete" but phase_status="${phase_status}" for job ${job.id}`;
  }

  // Invariant 4: Lease should be cleared when status="complete"
  if (status === "complete" && ((progress as any)?.lease_id || (progress as any)?.lease_expires_at)) {
    return `INVARIANT VIOLATION: status="complete" but lease not cleared for job ${job.id}`;
  }

  return null; // All invariants pass
}

/**
 * Format job for logging/monitoring.
 */
export function formatJobForLog(job: Job): Record<string, unknown> {
  return {
    job_id: job.id,
    status: job.status,
    phase: job.progress?.phase,
    phase_status: job.progress?.phase_status,
    completed_units: job.progress?.completed_units,
    total_units: job.progress?.total_units,
    lease_id: job.progress?.lease_id,
    lease_expires_at: job.progress?.lease_expires_at,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}
