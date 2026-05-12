import type { JobState } from "@/components/EvaluationPoller";

export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
} | null;

const STAGE_ROADMAP =
  "Stages: Preparing manuscript → Reading manuscript → Building diagnosis → Reconciling passes → Final QA checks → Validating report → Finalizing report.";

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

function getStageLabel(percentage: number): string {
  if (percentage >= 100) return "Report ready";
  if (percentage >= 95) return "Finalizing report";
  if (percentage >= 80) return "Validating report";
  if (percentage >= 65) return "Final QA checks";
  if (percentage >= 45) return "Reconciling passes";
  if (percentage >= 25) return "Building diagnosis";
  if (percentage >= 15) return "Reading manuscript";
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
    const percentage = toApproxRunningPercentage(job.progress);
    const stageLabel = getStageLabel(percentage);

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