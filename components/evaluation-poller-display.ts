import type { JobState } from "@/components/EvaluationPoller";

export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
} | null;

const STAGE_ROADMAP =
  "Stages: Preparing manuscript → Reading manuscript → Building diagnosis → Reconciling passes → Final QA checks → Preparing report → Finalizing report.";

function toApproxRunningPercentage(rawProgress: number): number {
  // Negative or zero → clamp to 0.
  if (rawProgress <= 0) return 0;
  const raw = Math.min(100, rawProgress);
  // Full completion reached.
  if (raw >= 100) return 100;

  // Approximation curve for coarse backend counters (e.g., 1/3, 2/3)
  // 0..33   ->  5..35
  // 33..66  -> 35..75
  // 66..100 -> 75..99
  if (raw <= 33) {
    return Math.round(5 + (raw / 33) * 30);
  }

  if (raw <= 66) {
    return Math.round(35 + ((raw - 33) / 33) * 40);
  }

  return Math.round(75 + ((raw - 66) / 34) * 24);
}

/**
 * Heuristic stage label derived from the smoothly-animated display percentage.
 *
 * Retained as a fallback for cases where the backend has not yet emitted a
 * canonical `phase` / `phase_status` (older jobs, transient API gaps, queued).
 * Authoritative stage label resolution should prefer `getStageLabelFromPhase`.
 */
function getStageLabel(percentage: number): string {
  if (percentage >= 100) return "Report ready";
  if (percentage >= 95) return "Finalizing report";
  if (percentage >= 80) return "Preparing report";
  if (percentage >= 65) return "Final QA checks";
  if (percentage >= 45) return "Reconciling passes";
  if (percentage >= 25) return "Building diagnosis";
  if (percentage >= 15) return "Reading manuscript";
  return "Preparing manuscript";
}

/**
 * Authoritative stage label derived from the canonical job state surfaced by
 * the worker: phase + phase_status (+ optional cross_check_status).
 *
 * Returns null if there is not enough authoritative data to label the stage,
 * letting callers fall back to the percentage-driven heuristic.
 *
 * Mapping (truth-first, decoupled from the visual bar):
 *   phase_1 / running    → "Reading manuscript"
 *   phase_1 / complete   → "Building diagnosis"  (transient handoff)
 *   phase_2 / running    → "Reconciling passes"
 *   phase_2 / complete   → "Final QA checks"     (cross-check pending)
 *   cross_check_status == "running"   → "Final QA checks"
 *   cross_check_status == "complete"  → "Preparing report"
 *   cross_check_status == "failed"    → "Final QA checks"
 *   queued (any phase)   → "Preparing manuscript"
 *   failed (any phase)   → null  (failure UI is handled elsewhere)
 */
export function getStageLabelFromPhase(
  phase: string | null | undefined,
  phaseStatus: string | null | undefined,
  crossCheckStatus: string | null | undefined,
): string | null {
  // Cross-check is the terminal QA gate and outranks phase signals when active.
  if (crossCheckStatus === "running") return "Final QA checks";
  if (crossCheckStatus === "complete") return "Preparing report";

  if (!phase) return null;

  if (phase === "phase_1") {
    if (phaseStatus === "queued") return "Preparing manuscript";
    if (phaseStatus === "running") return "Reading manuscript";
    if (phaseStatus === "complete") return "Building diagnosis";
    return null;
  }

  if (phase === "phase_2") {
    if (phaseStatus === "queued") return "Building diagnosis";
    if (phaseStatus === "running") return "Reconciling passes";
    if (phaseStatus === "complete") return "Final QA checks";
    return null;
  }

  return null;
}

type ProgressDisplayInput = Pick<JobState, "status" | "progress"> & {
  phase?: string | null;
  phase_status?: string | null;
  cross_check_status?: string | null;
};

export function getProgressDisplay(
  job: ProgressDisplayInput,
): ProgressDisplay {
  if (job.status === "queued") {
    return {
      label: "Waiting in queue",
      valueLabel: "Waiting in queue",
      helperText: "Your job is queued. We'll begin automatically as soon as a worker is available.",
      indeterminate: true,
      percentage: 0,
    };
  }

  if (job.status === "running") {
    const percentage = toApproxRunningPercentage(job.progress);
    // Prefer the authoritative phase-derived label when available.
    // Fall back to the percentage heuristic for backward compatibility
    // (e.g., when phase fields are absent from the API response).
    const phaseLabel = getStageLabelFromPhase(
      job.phase ?? null,
      job.phase_status ?? null,
      job.cross_check_status ?? null,
    );
    const stageLabel = phaseLabel ?? getStageLabel(percentage);

    return {
      label: stageLabel,
      valueLabel: `~${percentage}%`,
      helperText:
        `Approximate progress based on completed pipeline stages. ${STAGE_ROADMAP}`,
      indeterminate: false,
      percentage,
    };
  }

  if (job.status === "complete") {
    return {
      label: "Report ready",
      valueLabel: "100%",
      helperText: "Your report is ready.",
      indeterminate: false,
      percentage: 100,
    };
  }

  return null;
}
