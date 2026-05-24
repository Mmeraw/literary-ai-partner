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

/**
 * Deterministic UX translation map.
 *
 * Drives 100% from backend phase/phase_status/status — never from elapsed time
 * or client-side interpolation. Labels are human-facing; no backend jargon.
 *
 * Canonical table (from session context, locked):
 *
 * | Backend state                                            | Label                                         | % | Color  |
 * |----------------------------------------------------------|-----------------------------------------------|---|--------|
 * | status=queued / initial                                  | Calibrating benchmark models...               | 10| blue   |
 * | phase=phase_1a, phase_status=running (early)             | Ingesting manuscript & mapping chapters...    | 25| blue   |
 * | phase=phase_1a, phase_status=running (late)              | Extracting core narrative footprint...        | 45| blue   |
 * | phase=review_gate, phase_status=awaiting_approval        | Awaiting Story Layer Approval                 | 60| amber  | HARD STOP
 * | phase=review_gate + hard_fail_present=true               | Story Layer Blocked: Narrative conflicts...   | 60| red    | HARD STOP
 * | phase=phase_2                                            | Running deep structural craft diagnostics...  | 80| blue   |
 * | phase=phase_3 or synthesis                               | Assembling evaluation matrix...               | 90| blue   |
 * | cross_check / final QA                                   | Running final structural cross-checks...      | 95| blue   |
 * | status=complete                                          | Evaluation complete!                          |100| green  |
 *
 * "Early" vs "late" phase_1a/running is determined by completed_units/total_units
 * when available in the progress payload. If not available, defaults to "late" (45%).
 */

type PhaseInputs = {
  status: "queued" | "running" | "complete" | "failed";
  phase?: string | null;
  phase_status?: string | null;
  cross_check_status?: string | null;
  /**
   * Fraction 0..1 of units completed within current phase.
   * Used to distinguish phase_1a early (< 0.5) vs late (>= 0.5).
   * Optional — falls back to "late" position when absent.
   */
  phase_unit_fraction?: number | null;
  /**
   * Whether a hard-fail artifact is present at the review gate.
   * When true → "red" hard stop instead of amber.
   */
  hard_fail_present?: boolean;
};

export function getProgressDisplay(
  job: PhaseInputs,
  // `now` kept for API compatibility — no longer used for interpolation
  _now: Date = new Date(),
): ProgressDisplay {
  // ── Terminal: failed ──────────────────────────────────────────────────────
  if (job.status === "failed") {
    return null;
  }

  // ── Terminal: complete ────────────────────────────────────────────────────
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

  // ── Review Gate: hard stop ────────────────────────────────────────────────
  // Matches regardless of job.status (status stays 'queued' while at gate).
  if (job.phase === "review_gate") {
    const hasHardFail = !!job.hard_fail_present;
    return {
      label: hasHardFail
        ? "Story Layer Blocked: Narrative conflicts detected"
        : "Awaiting Story Layer Approval",
      valueLabel: "60%",
      helperText: hasHardFail
        ? "The story layer could not be approved automatically. Review the Story Ledger to resolve narrative conflicts before Phase 2 can begin."
        : "Phase 1A is complete. Review your Story Ledger and approve to continue to Phase 2.",
      indeterminate: false,
      percentage: 60,
      color: hasHardFail ? "red" : "amber",
      hardStop: true,
    };
  }

  // ── Queued (not yet running, not at gate) ─────────────────────────────────
  if (job.status === "queued") {
    return {
      label: "Calibrating benchmark models...",
      valueLabel: "10%",
      helperText: "Your job is queued. A worker will begin automatically.",
      indeterminate: false,
      percentage: 10,
      color: "blue",
      hardStop: false,
    };
  }

  // ── Running ───────────────────────────────────────────────────────────────
  if (job.status !== "running") {
    return null;
  }

  // cross_check / final QA
  if (
    job.cross_check_status === "running" ||
    job.cross_check_status === "queued"
  ) {
    return {
      label: "Running final structural cross-checks...",
      valueLabel: "95%",
      helperText: "Verifying evaluation integrity before report assembly.",
      indeterminate: false,
      percentage: 95,
      color: "blue",
      hardStop: false,
    };
  }

  // Phase 3 or synthesis
  if (job.phase === "phase_3") {
    return {
      label: "Assembling evaluation matrix...",
      valueLabel: "90%",
      helperText: "Building the final evaluation matrix and diagnosis.",
      indeterminate: false,
      percentage: 90,
      color: "blue",
      hardStop: false,
    };
  }

  // Phase 2
  if (job.phase === "phase_2") {
    return {
      label: "Running deep structural craft diagnostics...",
      valueLabel: "80%",
      helperText: "Performing deep craft analysis across all evaluation criteria.",
      indeterminate: false,
      percentage: 80,
      color: "blue",
      hardStop: false,
    };
  }

  // Phase 1A running — early vs late based on unit fraction
  if (job.phase === "phase_1a" && job.phase_status === "running") {
    const fraction = job.phase_unit_fraction ?? 1; // default to late
    const isEarly = fraction < 0.5;
    return {
      label: isEarly
        ? "Ingesting manuscript & mapping chapters..."
        : "Extracting core narrative footprint...",
      valueLabel: isEarly ? "25%" : "45%",
      helperText: isEarly
        ? "Loading manuscript and identifying chapter structure."
        : "Mapping characters, relationships, and narrative structure.",
      indeterminate: false,
      percentage: isEarly ? 25 : 45,
      color: "blue",
      hardStop: false,
    };
  }

  // Phase 1A queued / any other running state
  if (job.phase === "phase_1a") {
    return {
      label: "Ingesting manuscript & mapping chapters...",
      valueLabel: "25%",
      helperText: "Loading manuscript for analysis.",
      indeterminate: false,
      percentage: 25,
      color: "blue",
      hardStop: false,
    };
  }

  // Phase 0 — gold standard warm-up (evaluator internalizes criteria)
  if (job.phase === 'phase_0') {
    return {
      label: "Calibrating benchmark models...",
      valueLabel: "5%",
      helperText: "Evaluator is internalizing scoring standards before reading your manuscript.",
      indeterminate: false,
      percentage: 5,
      color: "blue",
      hardStop: false,
    };
  }

  // Unknown running state — fallback
  return {
    label: "Calibrating benchmark models...",
    valueLabel: "10%",
    helperText: "Initializing evaluation pipeline.",
    indeterminate: false,
    percentage: 10,
    color: "blue",
    hardStop: false,
  };
}

/**
 * Convenience helper for callers that only need the stage label string.
 * Returns null for terminal/failed states.
 */
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

// Exported for unit tests.
export const __testing__ = {
  getProgressDisplay,
  getStageLabelFromPhase,
};
