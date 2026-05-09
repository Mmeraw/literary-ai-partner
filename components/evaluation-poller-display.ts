import type { JobState } from "@/components/EvaluationPoller";

export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
} | null;

function clampProgress(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getProgressDisplay(
  job: Pick<JobState, "status" | "progress">
): ProgressDisplay {
  if (job.status === "queued") {
    return {
      label: "Queue status",
      valueLabel: "Waiting to start",
      helperText:
        "Your job is queued. Progress details will appear here as soon as processing begins.",
      indeterminate: true,
      percentage: 0,
    };
  }

  if (job.status === "running") {
    const percentage = clampProgress(job.progress);

    if (percentage === null || percentage <= 0) {
      return {
        label: "Evaluation running",
        valueLabel: "Working…",
        helperText:
          "Your evaluation is running. The page polls live status and will switch to measured progress when the worker publishes reliable unit counts.",
        indeterminate: true,
        percentage: 0,
      };
    }

    return {
      label: "Progress",
      valueLabel: `${percentage}%`,
      helperText: "This page refreshes automatically while your evaluation is running.",
      indeterminate: false,
      percentage,
    };
  }

  return null;
}
