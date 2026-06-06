export type CancelEligibilityInput = {
  status?: string | null;
  lifecycle?: string | null;
  dashboardStatus?: string | null;
  phaseStatus?: string | null;
  progress?: Record<string, unknown> | null;
};

const ACTIVE_OR_RECOVERY_STATES = new Set([
  'queued',
  'running',
  'needs_attention',
  'recoverable',
  'failed_recoverable',
  'paused',
  'error',
]);

const HIDDEN_STATES = new Set(['complete', 'completed', 'failed', 'cancelled', 'canceled', 'archived']);

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isUserCancelled(progress: Record<string, unknown> | null | undefined): boolean {
  if (!progress || typeof progress !== 'object') return false;
  return Boolean(
    progress.cancelled_by_user
    || progress.canceled_at
    || progress.cancelled_at
    || progress.dashboard_status === 'cancelled'
    || progress.dashboard_status === 'canceled',
  );
}

export function canShowCancelEvaluation(input: CancelEligibilityInput): boolean {
  const status = normalize(input.status);
  const lifecycle = normalize(input.lifecycle);
  const dashboardStatus = normalize(input.dashboardStatus);
  const phaseStatus = normalize(input.phaseStatus);

  // Explicit terminal-state guard: never show cancel once the job is done/failed/cancelled.
  if (status === 'failed' || status === 'complete' || status === 'completed' || status === 'cancelled' || status === 'canceled') {
    return false;
  }

  if (
    HIDDEN_STATES.has(status)
    || HIDDEN_STATES.has(lifecycle)
    || HIDDEN_STATES.has(dashboardStatus)
    || HIDDEN_STATES.has(phaseStatus)
  ) {
    return false;
  }

  if (ACTIVE_OR_RECOVERY_STATES.has(status)) return true;
  if (ACTIVE_OR_RECOVERY_STATES.has(lifecycle)) return true;
  if (ACTIVE_OR_RECOVERY_STATES.has(dashboardStatus)) return true;
  if (ACTIVE_OR_RECOVERY_STATES.has(phaseStatus)) return true;

  return false;
}
