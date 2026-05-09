import type { JobState } from "@/components/EvaluationPoller";

export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
} | null;

function getStageLabel(percentage: number): string {
  if (percentage >= 100) return "Report ready";
  if (percentage >= 80) return "Preparing report";
  if (percentage >= 60) return "Reviewing for consistency";
  if (percentage >= 40) return "Building diagnosis";
  if (percentage >= 20) return "Reading manuscript";
  return "Preparing manuscript";
}

export function getProgressDisplay(
  job: Pick<JobState, "status" | "progress">
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
    const percentage = Math.max(0, Math.min(100, job.progress));
    const stageLabel = getStageLabel(percentage);

    return {
      label: stageLabel,
      valueLabel: `${percentage}%`,
      helperText: "This page refreshes automatically while your evaluation is running.",
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