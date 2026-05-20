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
 * Truthful, stage-weighted progress model.
 *
 * Each stage owns a contiguous slice of the 0..100 bar. The slice widths are
 * proportional to the median time each stage takes in real pipeline runs:
 *
 *   Preparing manuscript  | 0 →  2%   (phase_1 / queued)
 *   Analyzing manuscript  | 2 → 64%   (phase_1 / running — heaviest stage)
 *   Building diagnosis    | 64 → 65%  (phase_1 / complete — transient handoff)
 *   Reconciling passes    | 65 → 83%  (phase_2 / running)
 *   Final QA checks       | 83 → 97%  (phase_2 / complete  +  cross_check running)
 *   Preparing report      | 97 → 99%  (cross_check_status = complete)
 *   Finalizing report     | 99 → 100% (status = complete)
 *
 * Inside a stage the bar advances by `elapsed / median_duration` of that
 * stage, clamped to `stage_end - 1%` so the bar never "finishes" a stage
 * before the backend says the stage is done. The remaining 1% closes when
 * the backend transitions to the next stage.
 *
 * Trade-off acknowledged: the slice widths are heuristic, calibrated from
 * observed run history. The label IS authoritative (phase-driven). When the
 * percent can't be sub-stage estimated (no elapsed timing fields available),
 * the bar parks at the stage's start boundary and shows an indeterminate
 * shimmer rather than inventing fake forward motion.
 */

type StageId =
  | "preparing_manuscript"
  | "analyzing_manuscript"
  | "building_diagnosis"
  | "reconciling_passes"
  | "final_qa_checks"
  | "preparing_report"
  | "finalizing_report";

interface StageBudget {
  id: StageId;
  label: string;
  /** Bar start (inclusive) for this stage's slice. */
  start: number;
  /** Bar end (exclusive) for this stage's slice; next stage starts here. */
  end: number;
  /** Median real-world duration in seconds; used to interpolate within the slice. */
  medianSeconds: number;
}

// Medians calibrated from long-form (50k+ word) pipeline runs.
// Re-tune if pipeline stage time-shares shift materially.
const STAGE_BUDGETS: readonly StageBudget[] = [
  {
    id: "preparing_manuscript",
    label: "Preparing manuscript",
    start: 0,
    end: 2,
    medianSeconds: 8,
  },
  {
    id: "analyzing_manuscript",
    label: "Analyzing manuscript",
    start: 2,
    end: 64,
    medianSeconds: 420, // ~7 min on a 127k-word, 37-chunk run
  },
  {
    id: "building_diagnosis",
    label: "Building diagnosis",
    start: 64,
    end: 65,
    medianSeconds: 5,
  },
  {
    id: "reconciling_passes",
    label: "Reconciling passes",
    start: 65,
    end: 83,
    medianSeconds: 120,
  },
  {
    id: "final_qa_checks",
    label: "Final QA checks",
    start: 83,
    end: 97,
    medianSeconds: 90,
  },
  {
    id: "preparing_report",
    label: "Preparing report",
    start: 97,
    end: 99,
    medianSeconds: 6,
  },
  {
    id: "finalizing_report",
    label: "Finalizing report",
    start: 99,
    end: 100,
    medianSeconds: 3,
  },
];

const STAGE_BY_ID: Record<StageId, StageBudget> = STAGE_BUDGETS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<StageId, StageBudget>,
);

type StageInputs = {
  phase?: string | null;
  phase_status?: string | null;
  cross_check_status?: string | null;
};

/**
 * Map authoritative backend state to a stage id. Returns null when the
 * caller has not provided enough state to pick a stage (queued, unknown).
 */
function resolveStageId(inputs: StageInputs): StageId | null {
  const cc = inputs.cross_check_status;
  if (cc === "complete") return "preparing_report";
  if (cc === "running") return "final_qa_checks";

  if (!inputs.phase) return null;

  if (inputs.phase === "phase_1" || inputs.phase === "phase_1a") {
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

/**
 * Pick the most reliable "stage started at" timestamp for the active stage.
 * Returns ISO string or null if we have no timestamp to interpolate from.
 */
function getStageStartedAt(
  stageId: StageId,
  job: TimingFields,
): string | null {
  switch (stageId) {
    case "preparing_manuscript":
      // Use job created_at as the start of the queued/preparing stage.
      return job.created_at ?? null;
    case "analyzing_manuscript":
      return job.phase1_started_at ?? job.created_at ?? null;
    case "building_diagnosis":
      return job.phase1_completed_at ?? job.phase2_started_at ?? null;
    case "reconciling_passes":
      return job.phase2_started_at ?? null;
    case "final_qa_checks":
      // Either phase_2 just completed (cross-check queued) OR cross-check is
      // actively running. Both share the same bar slice; phase2_completed_at
      // is the earliest timestamp we can latch onto.
      return job.phase2_completed_at ?? job.pass3_started_at ?? null;
    case "preparing_report":
      // Cross-check just completed; nothing more granular until "complete".
      return job.pass3_completed_at ?? null;
    case "finalizing_report":
      return job.pass3_completed_at ?? null;
  }
}

/**
 * Compute the bar percentage from stage + elapsed time within stage.
 * Clamps to `stage_end - 1` so the bar can never visually finish a stage
 * before the backend reports the stage transition.
 */
function interpolateWithinStage(
  stage: StageBudget,
  startedAt: string | null,
  nowMs: number,
): number {
  const sliceWidth = stage.end - stage.start;
  const ceiling = stage.end - 1; // reserve last 1% for the stage-complete signal
  if (!startedAt) return stage.start;

  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return stage.start;

  const elapsedSec = Math.max(0, (nowMs - startedMs) / 1000);
  const fraction = Math.min(1, elapsedSec / Math.max(1, stage.medianSeconds));
  const within = stage.start + fraction * sliceWidth;
  return Math.min(ceiling, Math.max(stage.start, within));
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
 * Compute the truthful progress display for a job.
 *
 * Truth contract:
 *   1. Label is phase-driven; never derived from the bar percentage.
 *   2. Percent is stage-weighted by real median durations; never invented.
 *   3. Inside a stage the bar advances at elapsed/median, capped 1% below
 *      the stage's end boundary. Only a real stage transition can move the
 *      bar past that ceiling.
 *   4. When timing data is missing the bar is indeterminate (shimmer)
 *      rather than showing a fake stationary number.
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
    // Running but no canonical phase yet — show the bar as indeterminate.
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
  const percentage = Math.round(interpolateWithinStage(stage, startedAt, nowMs));
  const elapsed = formatElapsed(startedAt, nowMs);

  const helperParts: string[] = [
    "Progress is weighted by measured stage durations from real pipeline runs.",
  ];
  if (elapsed) {
    helperParts.push(`Elapsed in this stage: ${elapsed}.`);
  }
  helperParts.push(STAGE_ROADMAP);

  return {
    label: stage.label,
    valueLabel: `${percentage}%`,
    helperText: helperParts.join(" "),
    indeterminate: startedAt === null, // shimmer when we can't interpolate
    percentage,
  };
}

// Exported for unit tests (stable, stage-weight invariants).
export const __testing__ = {
  STAGE_BUDGETS,
  STAGE_BY_ID,
  resolveStageId,
  getStageStartedAt,
  interpolateWithinStage,
  formatElapsed,
};
