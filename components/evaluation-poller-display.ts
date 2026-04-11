import type { JobState } from "@/components/EvaluationPoller";

export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
} | null;

export function getProgressDisplay(
  job: Pick<JobState, "status" | "progress">
): ProgressDisplay {
  if (job.status === "queued") {
    return {
      label: "Queue status",
      valueLabel: "Waiting to start",
      helperText: "Your job is queued. Progress details will appear here as soon as processing begins.",
      indeterminate: true,
      percentage: 0,
    };
  }

  if (job.status === "running") {
    const percentage = Math.max(0, Math.min(100, job.progress));

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