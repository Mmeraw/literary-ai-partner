/**
 * Track C: Phase-specific messaging
 * Makes progress feel intentional, not stuck
 */

import { Phase, PHASES } from "@/lib/jobs/types";

export type PhaseInfo = {
  phase: Phase | null;
  displayCopy: string;
  description: string;
};

/**
 * Get phase-specific copy that explains what's happening.
 * Storage values stay canonical; this helper only translates to user-facing copy.
 */
export function getPhaseSpecificCopy(
  phase: Phase | null,
  phaseStatus: string | null
): PhaseInfo {
  if (!phase || !phaseStatus) {
    return {
      phase: null,
      displayCopy: "Preparing evaluation…",
      description: "Your manuscript is being queued for analysis",
    };
  }

  if (phase === PHASES.PHASE_1A) {
    return {
      phase: PHASES.PHASE_1A,
      displayCopy: "Building evidence ledger…",
      description: "Reading character continuity and preflight evidence before scoring begins",
    };
  }

  if (phase === PHASES.PHASE_2) {
    return {
      phase: PHASES.PHASE_2,
      displayCopy: "Scoring and diagnosing craft…",
      description: "Running independent craft and editorial passes, then preparing the handoff",
    };
  }

  if (phase === PHASES.PHASE_3) {
    return {
      phase: PHASES.PHASE_3,
      displayCopy: "Writing the final report…",
      description: "Synthesizing the evaluation, running quality checks, and preparing report artifacts",
    };
  }

  if (phase === PHASES.WAVE_REVISION) {
    return {
      phase: PHASES.WAVE_REVISION,
      displayCopy: "Preparing WAVE revision plan…",
      description: "Building the post-report revision plan when the manuscript meets the structural gate",
    };
  }

  return {
    phase: null,
    displayCopy: "Processing…",
    description: "Evaluation in progress",
  };
}

/**
 * Check if job status is terminal (no more updates expected)
 */
export function isTerminalStatus(status: string): boolean {
  return status === "complete" || status === "failed";
}
