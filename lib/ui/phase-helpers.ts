/**
 * Track C: Phase-specific messaging
 * Makes progress feel intentional, not stuck
 */

export type PhaseInfo = {
  phase: "phase1" | "phase2" | null;
  displayCopy: string;
  description: string;
};

/**
 * Get phase-specific copy that explains what's happening
 */
export function getPhaseSpecificCopy(
  phase: "phase1" | "phase2" | null,
  phaseStatus: string | null
): PhaseInfo {
  if (!phase || !phaseStatus) {
    return {
      phase: null,
      displayCopy: "Preparing evaluation…",
      description: "Your manuscript is being queued for analysis",
    };
  }

  if (phase === "phase1") {
    return {
      phase: "phase1",
      displayCopy: "Analyzing structure and craft…",
      description: "Examining narrative elements, pacing, and technical execution",
    };
  }

  if (phase === "phase2") {
    return {
      phase: "phase2",
      displayCopy: "Generating revision guidance…",
      description: "Creating actionable feedback and recommendations",
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
  return status === "complete" || status === "failed" || status === "canceled";
}
