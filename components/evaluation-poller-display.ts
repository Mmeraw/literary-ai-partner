import type { JobState } from "@/components/EvaluationPoller";

export type ProgressTone = "processing" | "action_required" | "blocked" | "success";

export type ProgressDisplay = {
  label: string;
  valueLabel: string;
  helperText: string;
  indeterminate: boolean;
  percentage: number;
  tone: ProgressTone;
} | null;

const USER_FACING_ROADMAP =
  "Progress follows verified backend milestones: calibration, manuscript ingest, narrative extraction, review approval, deep diagnostics, report assembly, and final cross-checks.";

type UxStageId =
  | "queued"
  | "initializing"
  | "calibration"
  | "manuscript_ingest"
  | "story_layer_build"
  | "review_gate"
  | "story_layer_blocked"
  | "approval_normalizer"
  | "phase2_diagnostics"
  | "report_assembly"
  | "final_cross_checks"
  | "complete";

interface UxMilestone {
  id: UxStageId;
  label: string;
  percentage: number;
  tone: ProgressTone;
  helperText: string;
  indeterminate?: boolean;
}

const UX_MILESTONES: Record<UxStageId, UxMilestone> = {
  queued: {
    id: "queued",
    label: "Waiting in queue",
    percentage: 0,
    tone: "processing",
    helperText: "Your manuscript is queued. We will begin automatically as soon as a worker is available.",
    indeterminate: true,
  },
  initializing: {
    id: "initializing",
    label: "Preparing manuscript...",
    percentage: 0,
    tone: "processing",
    helperText: `The evaluation worker is initializing. ${USER_FACING_ROADMAP}`,
    indeterminate: true,
  },
  calibration: {
    id: "calibration",
    label: "Calibrating benchmark models...",
    percentage: 10,
    tone: "processing",
    helperText: "RevisionGrade is warming up the benchmark standard before manuscript-specific analysis begins.",
  },
  manuscript_ingest: {
    id: "manuscript_ingest",
    label: "Ingesting manuscript & mapping chapters...",
    percentage: 25,
    tone: "processing",
    helperText: "RevisionGrade is reading the manuscript structure and organizing chapter-level evidence.",
  },
  story_layer_build: {
    id: "story_layer_build",
    label: "Extracting core narrative footprint...",
    percentage: 45,
    tone: "processing",
    helperText: "RevisionGrade is building the factual story map that later diagnostics will rely on.",
  },
  review_gate: {
    id: "review_gate",
    label: "Awaiting Story Layer Approval",
    percentage: 60,
    tone: "action_required",
    helperText: "The progress bar is intentionally paused until the Story Layer is reviewed and approved.",
  },
  story_layer_blocked: {
    id: "story_layer_blocked",
    label: "Story Layer Blocked: Narrative conflicts detected",
    percentage: 60,
    tone: "blocked",
    helperText: "RevisionGrade found blocking Story Layer conflicts that must be resolved before deeper evaluation can proceed.",
  },
  approval_normalizer: {
    id: "approval_normalizer",
    label: "Freezing approved narrative matrix...",
    percentage: 65,
    tone: "processing",
    helperText: "RevisionGrade is turning the approved Story Layer into the stable reference used by deeper diagnostics.",
  },
  phase2_diagnostics: {
    id: "phase2_diagnostics",
    label: "Running deep structural craft diagnostics...",
    percentage: 80,
    tone: "processing",
    helperText: "RevisionGrade is evaluating structure, evidence, and craft against the approved narrative map.",
  },
  report_assembly: {
    id: "report_assembly",
    label: "Assembling evaluation matrix...",
    percentage: 90,
    tone: "processing",
    helperText: "RevisionGrade is assembling the diagnostic report from the completed analysis.",
  },
  final_cross_checks: {
    id: "final_cross_checks",
    label: "Running final structural cross-checks...",
    percentage: 95,
    tone: "processing",
    helperText: "RevisionGrade is checking the report for consistency before release.",
  },
  complete: {
    id: "complete",
    label: "Evaluation complete!",
    percentage: 100,
    tone: "success",
    helperText: "Your evaluation report is ready.",
  },
};

type StageInputs = {
  phase?: string | null;
  phase_status?: string | null;
  cross_check_status?: string | null;
  current_stage?: string | null;
  latest_artifact_emitted?: string | null;
  is_blocked_by_gate?: boolean | null;
};

type ProgressDisplayInput = Pick<JobState, "status"> & StageInputs;

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function stageFromArtifact(artifactType: string | null | undefined): UxStageId | null {
  switch (artifactType) {
    case "dream_calibration_packet_v1":
      return "calibration";
    case "pass1a_story_layer_v1":
      return "story_layer_build";
    case "ledger_quality_report_v1":
      return "review_gate";
    case "ledger_user_feedback_v1":
      return "approval_normalizer";
    case "accepted_story_ledger_v1":
    case "story_shape_signal_map_v1":
    case "manuscript_signal_appendix_v1":
      return "phase2_diagnostics";
    case "phase2_evaluation_packet_v1":
      return "report_assembly";
    case "evaluation_result_v2":
      return "final_cross_checks";
    default:
      return null;
  }
}

function stageFromCurrentStage(currentStage: string | null | undefined): UxStageId | null {
  const stage = normalizeToken(currentStage);
  if (!stage) return null;

  if (stage.includes("review_gate") || stage.includes("review gate")) return "review_gate";
  if (stage.includes("approval_normalizer") || stage.includes("approval normalizer")) return "approval_normalizer";
  if (stage.includes("phase_4") || stage.includes("cross_check") || stage.includes("qa")) return "final_cross_checks";
  if (stage.includes("phase_3") || stage.includes("pass3") || stage.includes("synthesis")) return "report_assembly";
  if (stage.includes("phase_2") || stage.includes("pass2") || stage.includes("diagnostic")) return "phase2_diagnostics";
  if (stage.includes("phase_1a") || stage.includes("story_layer") || stage.includes("story layer")) return "story_layer_build";
  if (stage.includes("phase_1") || stage.includes("pass1") || stage.includes("ingest")) return "manuscript_ingest";
  if (stage.includes("phase_0") || stage.includes("warmup") || stage.includes("calibration")) return "calibration";

  return null;
}

/**
 * Map authoritative backend state to an author-facing UX milestone.
 *
 * This is intentionally not a technical phase label. The UI listens to backend
 * phase/artifact truth, then translates it into editorial language. Percentages
 * are fixed milestones, not client-side elapsed-time estimates, so the bar never
 * drifts past Review Gate or any other hard stop before the backend advances.
 */
function resolveUxStageId(inputs: StageInputs): UxStageId | null {
  if (inputs.is_blocked_by_gate === true) return "story_layer_blocked";

  const artifactStage = stageFromArtifact(inputs.latest_artifact_emitted);
  if (artifactStage) return artifactStage;

  const currentStage = stageFromCurrentStage(inputs.current_stage);
  if (currentStage) return currentStage;

  const cc = normalizeToken(inputs.cross_check_status);
  if (cc === "running" || cc === "complete" || cc === "cross_check_completed") {
    return "final_cross_checks";
  }

  const phase = normalizeToken(inputs.phase);
  const phaseStatus = normalizeToken(inputs.phase_status);

  if (phase === "phase_0") return "calibration";
  if (phase === "phase_1" || phase === "pass_1" || phase === "pass1") return "manuscript_ingest";
  if (phase === "phase_1a") {
    return phaseStatus === "complete" ? "review_gate" : "story_layer_build";
  }
  if (phase === "review_gate") return "review_gate";
  if (phase === "approval_normalizer") return "approval_normalizer";
  if (phase === "phase_2") return "phase2_diagnostics";
  if (phase === "phase_3") return "report_assembly";
  if (phase === "phase_4" || phase === "wave_revision") return "final_cross_checks";

  return null;
}

/**
 * Author-facing label for callers that only need display copy.
 */
export function getStageLabelFromPhase(
  phase: string | null | undefined,
  phaseStatus: string | null | undefined,
  crossCheckStatus: string | null | undefined,
): string | null {
  const stageId = resolveUxStageId({
    phase,
    phase_status: phaseStatus,
    cross_check_status: crossCheckStatus,
  });
  return stageId ? UX_MILESTONES[stageId].label : null;
}

/**
 * Compute deterministic progress display for a job.
 *
 * Truth contract:
 *   1. Backend phase/artifact state is authoritative.
 *   2. The UI never exposes raw phase/pass/artifact names to authors.
 *   3. Percentages are fixed milestone widths, not client-side timers.
 *   4. Review Gate and blocked states are hard stops; the bar never creeps
 *      forward until backend state advances.
 */
export function getProgressDisplay(job: ProgressDisplayInput): ProgressDisplay {
  if (job.status === "queued") {
    return milestoneDisplay("queued");
  }

  if (job.status === "complete") {
    return milestoneDisplay("complete");
  }

  if (job.status === "failed") {
    return null;
  }

  if (job.status !== "running") {
    return null;
  }

  const stageId = resolveUxStageId(job) ?? "initializing";
  return milestoneDisplay(stageId);
}

function milestoneDisplay(stageId: UxStageId): Exclude<ProgressDisplay, null> {
  const milestone = UX_MILESTONES[stageId];
  return {
    label: milestone.label,
    valueLabel: `${milestone.percentage}%`,
    helperText: milestone.helperText,
    indeterminate: milestone.indeterminate ?? false,
    percentage: milestone.percentage,
    tone: milestone.tone,
  };
}

export const __testing__ = {
  UX_MILESTONES,
  resolveUxStageId,
  stageFromArtifact,
  stageFromCurrentStage,
};
