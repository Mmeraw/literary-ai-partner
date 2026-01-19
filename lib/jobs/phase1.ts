export const PHASE_1_STATES = {
  NOT_STARTED: "not_started",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type Phase1State =
  (typeof PHASE_1_STATES)[keyof typeof PHASE_1_STATES];

const ALLOWED_TRANSITIONS: Record<Phase1State, Phase1State[]> = {
  not_started: ["running"],
  running: ["completed", "failed"],
  failed: ["running"],
  completed: [],
};

export function canTransitionPhase1(from: Phase1State, to: Phase1State): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canRetryPhase1(options: {
  phase_1_status: Phase1State;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string | null;
  now?: Date;
}): boolean {
  const {
    phase_1_status,
    retry_count,
    max_retries,
    next_retry_at,
    now = new Date(),
  } = options;

  if (phase_1_status !== PHASE_1_STATES.FAILED) return false;
  if (retry_count >= max_retries) return false;

  if (!next_retry_at) return true;

  const scheduled = new Date(next_retry_at);
  if (Number.isNaN(scheduled.getTime())) return true;

  return scheduled.getTime() <= now.getTime();
}
