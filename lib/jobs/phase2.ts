export const PHASE_2_STATES = {
  NOT_STARTED: "not_started",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type Phase2State =
  (typeof PHASE_2_STATES)[keyof typeof PHASE_2_STATES];

const ALLOWED_TRANSITIONS: Record<Phase2State, Phase2State[]> = {
  not_started: ["running"],
  running: ["completed", "failed"],
  failed: ["running"],
  completed: [],
};

export function canTransitionPhase2(from: Phase2State, to: Phase2State): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransitionPhase2(from: Phase2State, to: Phase2State): void {
  if (!canTransitionPhase2(from, to)) {
    throw new Error(`Invalid Phase 2 transition: ${from} -> ${to}`);
  }
}
