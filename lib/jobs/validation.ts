import { Job } from "./types";

/**
 * Progress validation errors that require immediate job failure.
 */
export type ProgressValidationError =
  | "phase_unknown"
  | "phase_status_mismatch"
  | "counters_missing"
  | "counters_invalid";

/**
 * Validate progress shape for current phase.
 * Returns null if valid, or a specific error code if invalid.
 */
export function validateProgressForPhase(
  job: Job,
): ProgressValidationError | null {
  const { phase, phase_status } = job.progress || {};

  // Unknown or missing phase
  if (!phase || !["phase_1", "phase_2"].includes(phase)) {
    return "phase_unknown";
  }

  if (phase === "phase_1") {
    return validatePhase1Progress(job);
  }

  if (phase === "phase_2") {
    return validatePhase2Progress(job);
  }

  return null;
}

function validatePhase1Progress(job: Job): ProgressValidationError | null {
  const {
    phase_status,
    total_units,
    completed_units,
    phase1_last_processed_index,
  } = job.progress || {};

  // During Phase 1 execution
  if (phase_status === "running") {
    // Allow missing counters during initialization (not_started/pending phases)
    const isInitializing = phase_status === "pending" || !total_units;
    
    // Must have total units set and > 0 (unless still initializing)
    if (!isInitializing && (!Number.isFinite(total_units) || total_units <= 0)) {
      return "counters_missing";
    }
    // Processed must be >= 0 and <= total (only validate if total_units is set)
    if (
      Number.isFinite(total_units) &&
      (!Number.isFinite(completed_units) ||
        completed_units < 0 ||
        completed_units > total_units)
    ) {
      return "counters_invalid";
    }
  }

  // After Phase 1 completion
  if (phase_status === "complete") {
    if (Number.isFinite(total_units) && total_units > 0) {
      if (
        !Number.isFinite(completed_units) ||
        completed_units !== total_units
      ) {
        return "counters_invalid";
      }
    }
    // Optional: last_processed_index should match completed_units - 1
    if (
      Number.isFinite(completed_units) &&
      completed_units > 0 &&
      Number.isFinite(phase1_last_processed_index) &&
      phase1_last_processed_index !== completed_units - 1
    ) {
      return "counters_invalid";
    }
  }

  return null;
}

function validatePhase2Progress(job: Job): ProgressValidationError | null {
  const {
    phase_status,
    total_units,
    completed_units,
    phase2_last_processed_index,
  } = job.progress || {};

  // During Phase 2 execution
  if (phase_status === "starting" || phase_status === "running") {
    // Must have total units set (>= 0)
    if (!Number.isFinite(total_units) || total_units < 0) {
      return "counters_missing";
    }
    // Processed must be >= 0 and <= total
    if (
      !Number.isFinite(completed_units) ||
      completed_units < 0 ||
      completed_units > total_units
    ) {
      return "counters_invalid";
    }
  }

  // After Phase 2 completion
  if (phase_status === "complete") {
    if (Number.isFinite(total_units) && total_units > 0) {
      if (
        !Number.isFinite(completed_units) ||
        completed_units !== total_units
      ) {
        return "counters_invalid";
      }
    }
    // Optional: last_processed_index should match completed_units - 1
    if (
      Number.isFinite(completed_units) &&
      completed_units > 0 &&
      Number.isFinite(phase2_last_processed_index) &&
      phase2_last_processed_index !== completed_units - 1
    ) {
      return "counters_invalid";
    }
  }

  return null;
}

/**
 * Check if Phase 2 can start (Phase 1 must be complete).
 */
export function canStartPhase2(job: Job): boolean {
  const {
    phase,
    phase_status,
    total_units,
    completed_units,
  } = job.progress || {};

  // Phase 1 must be complete
  if (phase !== "phase_1" || phase_status !== "complete") {
    return false;
  }

  // If Phase 1 had units, they must all be processed
  if (Number.isFinite(total_units) && total_units > 0) {
    if (
      !Number.isFinite(completed_units) ||
      completed_units !== total_units
    ) {
      return false;
    }
  }

  return true;
}
