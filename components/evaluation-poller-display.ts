import type { JobState } from "@/components/EvaluationPoller";

export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
  /**
   * "amber"  → Review Gate hard stop, awaiting author approval
   * "red"    → Review Gate blocked, narrative conflicts detected
   * "blue"   → normal running state
   * "green"  → complete
   */
  color: "blue" | "amber" | "red" | "green";
  /** When true the bar must not advance until backend transitions past review_gate. */
  hardStop: boolean;
} | null;

type PhaseInputs = {
  status: "queued" | "running" | "complete" | "failed";
  phase?: string | null;
  phase_status?: string | null;
  cross_check_status?: string | null;
  phase_unit_fraction?: number | null;
  /** Surfaced from jobs API via progress JSONB — true when ledger hard-fails block Phase 2 */
  hard_fail_present?: boolean | null;
};

export function getProgressDisplay(
  job: PhaseInputs,
  _now: Date = new Date(),
): ProgressDisplay {
  if (job.status === "failed") return null;

  if (job.status === "complete") {
    return {
      label: "Evaluation complete!",
      valueLabel: "100%",
      helperText: "Your evaluation report is ready.",
      indeterminate: false,
      percentage: 100,
      color: "green",
      hardStop: false,
    };
  }

  if (job.phase === "review_gate") {
    const hasHardFail = !!job.hard_fail_present;
    return {
      label: hasHardFail
        ? "Story Layer Blocked: Narrative conflicts detected"
        : "Awaiting Story Layer Approval",
      valueLabel: "50%",
      helperText: hasHardFail
        ? "The story layer could not be approved automatically. Review the Story Ledger to resolve narrative conflicts before Phase 2 can begin."
        : "Phase 1A is complete. Review your Story Ledger and approve to continue to Phase 2.",
      indeterminate: false,
      percentage: 50,
      color: hasHardFail ? "red" : "amber",
      hardStop: true,
    };
  }

  if (job.phase === 'phase_3' && job.status === 'queued') {
    return {
      label: "Assembling evaluation matrix...",
      valueLabel: "86%",
      helperText: "Building the final evaluation matrix and diagnosis.",
      indeterminate: false,
      percentage: 86,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === 'phase_2' && job.status === 'queued') {
    return {
      label: "Running deep structural craft diagnostics...",
      valueLabel: "67%",
      helperText: "Performing deep craft analysis across all evaluation criteria.",
      indeterminate: false,
      percentage: 67,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === 'phase_1a' && job.status === 'queued') {
    const fraction = job.phase_unit_fraction ?? 1;
    const isEarly = fraction < 0.5;
    return {
      label: isEarly ? "Ingesting manuscript..." : "Extracting core narrative...",
      valueLabel: isEarly ? "15%" : "35%",
      percentage: isEarly ? 15 : 35,
      color: "blue",
      hardStop: false,
      indeterminate: false,
      helperText: "Analyzing manuscript structure..."
    };
  }

  if (job.phase === 'phase_0' && job.status === 'queued') {
    return {
      label: "Preparing evaluation environment",
      valueLabel: "5%",
      percentage: 5,
      color: "blue",
      hardStop: false,
      indeterminate: false,
      helperText: "Your manuscript has been received. RevisionGrade is loading scoring rules, benchmark standards, and routing information before the manuscript is analyzed.",
    };
  }

  if (job.status === "queued") {
    return {
      label: "Waiting in queue",
      valueLabel: "2%",
      helperText: "Your manuscript has been received and is waiting for an evaluator worker.",
      indeterminate: false,
      percentage: 2,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.status !== "running") return null;

  if (job.cross_check_status === "running" || job.cross_check_status === "queued") {
    return {
      label: "Running final structural cross-checks...",
      valueLabel: "97%",
      helperText: "Verifying evaluation integrity before report assembly.",
      indeterminate: false,
      percentage: 97,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === "phase_3") {
    return {
      label: "Assembling evaluation matrix...",
      valueLabel: "86%",
      helperText: "Building the final evaluation matrix and diagnosis.",
      indeterminate: false,
      percentage: 86,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === "phase_2") {
    return {
      label: "Running deep structural craft diagnostics...",
      valueLabel: "67%",
      helperText: "Performing deep craft analysis across all evaluation criteria.",
      indeterminate: false,
      percentage: 67,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === "phase_1a" && job.phase_status === "running") {
    const fraction = job.phase_unit_fraction ?? 1;
    const isEarly = fraction < 0.5;
    return {
      label: isEarly
        ? "Ingesting manuscript & mapping chapters..."
        : "Extracting core narrative footprint...",
      valueLabel: isEarly ? "15%" : "35%",
      helperText: isEarly
        ? "Loading manuscript and identifying chapter structure."
        : "Mapping characters, relationships, and narrative structure.",
      indeterminate: false,
      percentage: isEarly ? 15 : 35,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === "phase_1a") {
    return {
      label: "Ingesting manuscript & mapping chapters...",
      valueLabel: "15%",
      helperText: "Loading manuscript for analysis.",
      indeterminate: false,
      percentage: 15,
      color: "blue",
      hardStop: false,
    };
  }

  if (job.phase === 'phase_0') {
    return {
      label: "Preparing evaluation environment",
      valueLabel: "5%",
      helperText: "RevisionGrade is loading scoring rules, benchmark standards, and routing information before the manuscript is analyzed.",
      indeterminate: false,
      percentage: 5,
      color: "blue",
      hardStop: false,
    };
  }

  return {
    label: "Preparing evaluation environment",
    valueLabel: "5%",
    helperText: "Initializing evaluation pipeline.",
    indeterminate: false,
    percentage: 5,
    color: "blue",
    hardStop: false,
  };
}

export function getStageLabelFromPhase(
  phase: string | null | undefined,
  phaseStatus: string | null | undefined,
  crossCheckStatus: string | null | undefined,
): string | null {
  const pd = getProgressDisplay({
    status: "running",
    phase: phase ?? null,
    phase_status: phaseStatus ?? null,
    cross_check_status: crossCheckStatus ?? null,
  });
  return pd?.label ?? null;
}

export const __testing__ = {
  getProgressDisplay,
  getStageLabelFromPhase,
};
