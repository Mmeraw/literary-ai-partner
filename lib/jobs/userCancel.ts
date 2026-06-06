import { createAdminClient } from '@/lib/supabase/admin';

type CancelReason = 'wrong_file' | 'wrong_mode' | 'user_cancelled' | 'other';

const ALLOWED_REASONS = new Set<CancelReason>([
  'wrong_file',
  'wrong_mode',
  'user_cancelled',
  'other',
]);

export type UserCancelResult =
  | {
      ok: true;
      jobId: string;
      status: 'cancelled';
      cancelledAt: string;
      alreadyCancelled?: boolean;
    }
  | {
      ok: false;
      code: 'not_found' | 'conflict' | 'forbidden' | 'internal';
      message: string;
      status: number;
      jobStatus?: string;
    };

function normalizeReason(value: unknown): CancelReason {
  if (typeof value !== 'string') return 'user_cancelled';
  return ALLOWED_REASONS.has(value as CancelReason)
    ? (value as CancelReason)
    : 'user_cancelled';
}

function buildPhaseLogEntry(args: {
  nowIso: string;
  reason: CancelReason;
  fromStatus: string;
  fromPhase: string | null;
  fromPhaseStatus: string | null;
}) {
  return {
    event: 'user_cancelled',
    at: args.nowIso,
    reason: args.reason,
    from_status: args.fromStatus,
    from_phase: args.fromPhase,
    from_phase_status: args.fromPhaseStatus,
  };
}

function buildCancelledProgress(args: {
  existingProgress: Record<string, unknown>;
  nowIso: string;
  reason: CancelReason;
  fromStatus: string;
  fromPhase: string | null;
  fromPhaseStatus: string | null;
}): Record<string, unknown> {
  const phaseLog = Array.isArray(args.existingProgress.phase_log)
    ? [...args.existingProgress.phase_log]
    : [];

  phaseLog.push(
    buildPhaseLogEntry({
      nowIso: args.nowIso,
      reason: args.reason,
      fromStatus: args.fromStatus,
      fromPhase: args.fromPhase,
      fromPhaseStatus: args.fromPhaseStatus,
    }),
  );

  return {
    ...args.existingProgress,
    phase: args.fromPhase,
    phase_status: 'failed',
    message: 'Evaluation cancelled by user',
    canceled_at: args.nowIso,
    cancelled_at: args.nowIso,
    canceled_reason: args.reason,
    cancelled_by_user: true,
    dashboard_status: 'cancelled',
    error_code: 'USER_CANCELLED',
    finished_at: args.nowIso,
    retry_requested_at: null,
    resume_requested_at: null,
    retry_eligible: false,
    resume_eligible: false,
    recoverable: false,
    lease_id: null,
    lease_expires_at: null,
    phase_log: phaseLog,
  };
}

export async function cancelEvaluationAsUser(args: {
  jobId: string;
  userId: string;
  reason?: string;
}): Promise<UserCancelResult> {
  const reason = normalizeReason(args.reason);
  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin
    .from('evaluation_jobs')
    .select('id, status, phase, phase_status, progress, manuscript_id, manuscripts!inner(user_id)')
    .eq('id', args.jobId)
    .eq('manuscripts.user_id', args.userId)
    .maybeSingle();

  if (jobError) {
    return {
      ok: false,
      code: 'internal',
      message: 'Unable to verify this evaluation before cancelling it.',
      status: 500,
    };
  }

  if (!job) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Job not found or not owned by user',
      status: 404,
    };
  }

  const existingProgress =
    job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
      ? (job.progress as Record<string, unknown>)
      : {};

  const alreadyCancelled =
    job.status === 'failed' &&
    Boolean(
      existingProgress.canceled_at
      || existingProgress.cancelled_at
      || existingProgress.cancelled_by_user
      || existingProgress.dashboard_status === 'cancelled',
    );

  if (alreadyCancelled) {
    const cancelledAt =
      (typeof existingProgress.canceled_at === 'string' ? existingProgress.canceled_at : null)
      ?? (typeof existingProgress.cancelled_at === 'string' ? existingProgress.cancelled_at : null)
      ?? new Date().toISOString();

    return {
      ok: true,
      jobId: args.jobId,
      status: 'cancelled',
      cancelledAt,
      alreadyCancelled: true,
    };
  }

  if (job.status === 'complete') {
    return {
      ok: false,
      code: 'conflict',
      message: 'This evaluation has already completed and can no longer be cancelled.',
      status: 409,
      jobStatus: job.status,
    };
  }

  if (!['queued', 'running', 'failed'].includes(job.status)) {
    return {
      ok: false,
      code: 'conflict',
      message: `This evaluation is already ${job.status} and is no longer active.`,
      status: 409,
      jobStatus: job.status,
    };
  }

  const nowIso = new Date().toISOString();
  const cancelMessage = `User cancelled evaluation: ${reason}`;
  const nextProgress = buildCancelledProgress({
    existingProgress,
    nowIso,
    reason,
    fromStatus: job.status,
    fromPhase: typeof job.phase === 'string' ? job.phase : null,
    fromPhaseStatus: typeof job.phase_status === 'string' ? job.phase_status : null,
  });

  const { data: cancelledJob, error: cancelError } = await admin
    .from('evaluation_jobs')
    .update({
      status: 'failed',
      phase_status: 'failed',
      progress: nextProgress,
      last_error: cancelMessage,
      failure_code: 'USER_CANCELLED',
      failure_envelope: {
        error_code: 'USER_CANCELLED',
        code: 'USER_CANCELLED',
        message: cancelMessage,
        retryable: false,
        phase: job.phase ?? null,
        provider: null,
        occurred_at: nowIso,
        context: {
          reason,
          cancelled_by_user: true,
        },
      },
      claimed_by: null,
      claimed_at: null,
      lease_token: null,
      lease_until: null,
      last_heartbeat_at: null,
      last_heartbeat: null,
      worker_pulse_at: null,
      failed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', args.jobId)
    .in('status', ['queued', 'running', 'failed'])
    .select('id, status, progress, updated_at')
    .maybeSingle();

  if (cancelError) {
    return {
      ok: false,
      code: 'internal',
      message: 'Cancellation could not be saved. Please refresh and try again.',
      status: 500,
    };
  }

  if (!cancelledJob) {
    return {
      ok: false,
      code: 'conflict',
      message: 'This evaluation is no longer in a cancellable state. Please refresh for the latest status.',
      status: 409,
    };
  }

  return {
    ok: true,
    jobId: args.jobId,
    status: 'cancelled',
    cancelledAt: nowIso,
  };
}
