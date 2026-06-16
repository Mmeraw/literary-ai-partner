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
      displayCopy: "Queued…",
      description: "Your writing is being queued for analysis",
    };
  }

  if (phase === PHASES.PHASE_0) {
    return {
      phase: PHASES.PHASE_0,
      displayCopy: "Phase 0 calibrating…",
      description: "Calibrating evaluation parameters, routing chunks, and preparing manuscript",
    };
  }

  if (phase === PHASES.PHASE_1A) {
    return {
      phase: PHASES.PHASE_1A,
      displayCopy: "Phase 1A Story Layer reading…",
      description: "Reading character continuity and building the preflight evidence ledger",
    };
  }

  if (phase === PHASES.REVIEW_GATE) {
    return {
      phase: PHASES.REVIEW_GATE,
      displayCopy: "Review Gate…",
      description: "Story Layer quality review before scoring begins",
    };
  }

  if (phase === PHASES.PHASE_2) {
    return {
      phase: PHASES.PHASE_2,
      displayCopy: "Phase 2 Criteria Analysis…",
      description: "Running independent craft and editorial scoring across all 13 criteria",
    };
  }

  if (phase === PHASES.PHASE_3) {
    return {
      phase: PHASES.PHASE_3,
      displayCopy: "Phase 3B Synthesis…",
      description: "Synthesizing the final report, running quality gates, and preparing artifacts",
    };
  }

  if (phase === PHASES.WAVE_REVISION) {
    return {
      phase: PHASES.WAVE_REVISION,
      displayCopy: "WAVE Revision…",
      description: "Building the post-evaluation readiness and revision-planning analysis",
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
