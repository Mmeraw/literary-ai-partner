import type { JobState } from "@/components/EvaluationPoller";

export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
} | null;

const STAGE_ROADMAP =
  "Stages: Preparing manuscript → Analyzing manuscript → Building diagnosis → Reconciling passes → Final QA checks → Preparing report → Finalizing report.";

/**
 * Canonical user-facing progress model.
 *
 * The progress bar is intentionally driven by the seven visible evaluation
 * stages, not by legacy `total_units/completed_units` counters. Those counters
 * can remain stale while the backend has already advanced to a later phase,
 * which is how the UI previously showed misleading percentages.
 *
 * Contract:
 *   - The label is resolved from authoritative backend phase fields.
 *   - The percentage is the active stage's 1-based index over seven stages.
 *   - Running jobs are capped below 100%; only `status === "complete"` renders 100%.
 *   - Timing fields are used only for helpful elapsed copy, never as the source
 *     of truth for the bar width.
 */

type StageId =
  | "preparing_manuscript"
  | "analyzing_manuscript"
  | "building_diagnosis"
  | "reconciling_passes"
  | "final_qa_checks"
  | "preparing_report"
  | "finalizing_report";

interface StageDefinition {
  id: StageId;
  label: string;
  /** 1-based user-facing stage index. */
  index: number;
}

const STAGES: readonly StageDefinition[] = [
  {
    id: "preparing_manuscript",
    label: "Preparing manuscript",
    index: 1,
  },
  {
    id: "analyzing_manuscript",
    label: "Analyzing manuscript",
    index: 2,
  },
  {
    id: "building_diagnosis",
    label: "Building diagnosis",
    index: 3,
  },
  {
    id: "reconciling_passes",
    label: "Reconciling passes",
    index: 4,
  },
  {
    id: "final_qa_checks",
    label: "Final QA checks",
    index: 5,
  },
  {
    id: "preparing_report",
    label: "Preparing report",
    index: 6,
  },
  {
    id: "finalizing_report",
    label: "Finalizing report",
    index: 7,
  },
];

const STAGE_COUNT = STAGES.length;

const STAGE_BY_ID: Record<StageId, StageDefinition> = STAGES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<StageId, StageDefinition>,
);

type StageInputs = {
  phase?: string | null;
  phase_status?: string | null;
  cross_check_status?: string | null;
};

/**
 * Map authoritative backend state to a stage id. Returns null when the
 * caller has not provided enough state to pick a stage.
 */
function resolveStageId(inputs: StageInputs): StageId | null {
  const cc = inputs.cross_check_status;
  if (cc === "complete" || cc === "cross_check_completed") return "preparing_report";
  if (cc === "running") return "final_qa_checks";

  if (!inputs.phase) return null;

  if (inputs.phase === "phase_0") {
    return "preparing_manuscript";
  }

  if (inputs.phase === "phase_1a") {
    if (inputs.phase_status === "queued") return "preparing_manuscript";
    if (inputs.phase_status === "running") return "analyzing_manuscript";
    if (inputs.phase_status === "complete") return "building_diagnosis";
    return null;
  }

  if (inputs.phase === "phase_2") {
    if (inputs.phase_status === "queued") return "building_diagnosis";
    if (inputs.phase_status === "running") return "reconciling_passes";
    if (inputs.phase_status === "complete") return "final_qa_checks";
    return null;
  }

  if (inputs.phase === "phase_3") {
    if (inputs.phase_status === "queued") return "final_qa_checks";
    if (inputs.phase_status === "running") return "preparing_report";
    if (inputs.phase_status === "complete") return "finalizing_report";
    return null;
  }

  if (inputs.phase === "wave_revision") {
    return "finalizing_report";
  }

  return null;
}

type TimingFields = {
  created_at?: string | null;
  phase1_started_at?: string | null;
  phase1_completed_at?: string | null;
  phase2_started_at?: string | null;
  phase2_completed_at?: string | null;
  pass3_started_at?: string | null;
  pass3_completed_at?: string | null;
};

/**
 * Pick the most reliable "stage started at" timestamp for elapsed copy.
 * Returns ISO string or null if we have no timestamp.
 */
function getStageStartedAt(
  stageId: StageId,
  job: TimingFields,
): string | null {
  switch (stageId) {
    case "preparing_manuscript":
      return job.created_at ?? null;
    case "analyzing_manuscript":
      return job.phase1_started_at ?? job.created_at ?? null;
    case "building_diagnosis":
      return job.phase1_completed_at ?? job.phase2_started_at ?? null;
    case "reconciling_passes":
      return job.phase2_started_at ?? null;
    case "final_qa_checks":
      return job.phase2_completed_at ?? job.pass3_started_at ?? null;
    case "preparing_report":
      return job.pass3_started_at ?? job.pass3_completed_at ?? null;
    case "finalizing_report":
      return job.pass3_completed_at ?? null;
  }
}

function getStagePercentage(stage: StageDefinition): number {
  return Math.min(99, Math.round((stage.index / STAGE_COUNT) * 100));
}

type ProgressDisplayInput = Pick<JobState, "status"> & TimingFields & StageInputs;

/** Format an ISO duration delta as "Xm Ys" or "Ys". */
function formatElapsed(startedAt: string | null, nowMs: number): string | null {
  if (!startedAt) return null;
  const t = Date.parse(startedAt);
  if (!Number.isFinite(t)) return null;
  const sec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/**
 * Authoritative label, exposed for callers that just want the stage name.
 * Returns null for queued / unknown so callers can render their own copy.
 */
export function getStageLabelFromPhase(
  phase: string | null | undefined,
  phaseStatus: string | null | undefined,
  crossCheckStatus: string | null | undefined,
): string | null {
  const stageId = resolveStageId({
    phase,
    phase_status: phaseStatus,
    cross_check_status: crossCheckStatus,
  });
  return stageId ? STAGE_BY_ID[stageId].label : null;
}

/**
 * Compute the progress display for a job using the canonical seven-stage model.
 */
export function getProgressDisplay(
  job: ProgressDisplayInput,
  now: Date = new Date(),
): ProgressDisplay {
  if (job.status === "queued") {
    return {
      label: "Waiting in queue",
      valueLabel: "Waiting in queue",
      helperText:
        "Your job is queued. We'll begin automatically as soon as a worker is available.",
      indeterminate: true,
      percentage: 0,
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

  if (job.status !== "running") {
    return null;
  }

  const stageId = resolveStageId(job);
  if (!stageId) {
    return {
      label: "Preparing manuscript",
      valueLabel: "Starting",
      helperText: `Worker is initializing. ${STAGE_ROADMAP}`,
      indeterminate: true,
      percentage: 0,
    };
  }

  const stage = STAGE_BY_ID[stageId];
  const startedAt = getStageStartedAt(stageId, job);
  const nowMs = now.getTime();
  const percentage = getStagePercentage(stage);
  const elapsed = formatElapsed(startedAt, nowMs);

  const helperParts: string[] = [
    `Stage ${stage.index} of ${STAGE_COUNT}.`,
  ];
  if (elapsed) {
    helperParts.push(`Elapsed in this stage: ${elapsed}.`);
  }
  helperParts.push(
    "Progress follows the seven canonical evaluation stages and does not use stale unit counters.",
    STAGE_ROADMAP,
  );

  return {
    label: stage.label,
    valueLabel: `${percentage}%`,
    helperText: helperParts.join(" "),
    indeterminate: false,
    percentage,
  };
}

// Exported for unit tests (stable seven-stage invariants).
export const __testing__ = {
  STAGES,
  STAGE_COUNT,
  STAGE_BY_ID,
  resolveStageId,
  getStageStartedAt,
  getStagePercentage,
  formatElapsed,
};
