export type EvaluationPhaseStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'complete'
  | 'completed'
  | 'failed'
  | 'degraded'
  | 'cancelled';

export const EVALUATION_PHASE_STATUS_TRANSITIONS: Record<EvaluationPhaseStatus, readonly EvaluationPhaseStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['awaiting_approval', 'complete', 'completed', 'failed', 'degraded', 'queued', 'cancelled'],
  awaiting_approval: ['queued', 'complete', 'completed', 'cancelled'],
  complete: [],
  completed: [],
  failed: [],
  degraded: [],
  cancelled: [],
} as const;

export function isEvaluationPhaseStatus(value: string): value is EvaluationPhaseStatus {
  return Object.prototype.hasOwnProperty.call(EVALUATION_PHASE_STATUS_TRANSITIONS, value);
}

export function validateEvaluationPhaseStatusTransition(
  current: EvaluationPhaseStatus,
  next: EvaluationPhaseStatus,
): void {
  if (current === next) return;

  const allowed = EVALUATION_PHASE_STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(
      `[APPLICATION_STATE_VIOLATION] Illegal evaluation phase_status transition from '${current}' to '${next}' detected.`,
    );
  }
}

export function assertEvaluationPhaseStatusTransition(current: string, next: string): void {
  if (!isEvaluationPhaseStatus(current)) {
    throw new Error(`[APPLICATION_STATE_VIOLATION] Unknown current phase_status '${current}'.`);
  }
  if (!isEvaluationPhaseStatus(next)) {
    throw new Error(`[APPLICATION_STATE_VIOLATION] Unknown next phase_status '${next}'.`);
  }

  validateEvaluationPhaseStatusTransition(current, next);
}
