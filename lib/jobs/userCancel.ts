import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'node:crypto';

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

function buildFailureEnvelope(args: {
  cancelMessage: string;
  jobPhase: unknown;
  nowIso: string;
  reason: CancelReason;
}) {
  return {
    error_code: 'USER_CANCELLED',
    code: 'USER_CANCELLED',
    message: args.cancelMessage,
    retryable: false,
    phase: args.jobPhase ?? null,
    provider: null,
    occurred_at: args.nowIso,
    context: {
      reason: args.reason,
      cancelled_by_user: true,
    },
  };
}

function buildTerminalCancellationUpdate(args: {
  cancelMessage: string;
  nextProgress: Record<string, unknown>;
  nowIso: string;
  reason: CancelReason;
  jobPhase: unknown;
}) {
  return {
    status: 'failed',
    phase_status: 'failed',
    progress: args.nextProgress,
    last_error: args.cancelMessage,
    failure_code: 'USER_CANCELLED',
    failure_envelope: buildFailureEnvelope({
      cancelMessage: args.cancelMessage,
      jobPhase: args.jobPhase,
      nowIso: args.nowIso,
      reason: args.reason,
    }),
    claimed_by: null,
    claimed_at: null,
    lease_token: null,
    lease_until: null,
    last_heartbeat_at: null,
    last_heartbeat: null,
    worker_pulse_at: null,
    failed_at: args.nowIso,
    updated_at: args.nowIso,
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
    console.error('UserCancelJobFetchError', { jobId: args.jobId, message: (jobError as {message?: string}).message, code: (jobError as {code?: string}).code, details: (jobError as {details?: string}).details });
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

  if (job.status === 'failed') {
    return {
      ok: false,
      code: 'conflict',
      message: 'This evaluation has already failed and can no longer be cancelled.',
      status: 409,
      jobStatus: job.status,
    };
  }

  if (!['queued', 'running'].includes(job.status)) {
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
  const terminalUpdate = buildTerminalCancellationUpdate({
    cancelMessage,
    nextProgress,
    nowIso,
    reason,
    jobPhase: job.phase,
  });

  if (job.status === 'queued') {
    if (job.phase_status === 'awaiting_approval') {
      const { error: normalizeError } = await admin
        .from('evaluation_jobs')
        .update({
          phase_status: 'queued',
          updated_at: nowIso,
        })
        .eq('id', args.jobId)
        .eq('status', 'queued')
        .eq('phase_status', 'awaiting_approval');

      if (normalizeError) {
        console.error('UserCancelNormalizeError', { jobId: args.jobId, message: (normalizeError as {message?: string}).message, code: (normalizeError as {code?: string}).code, details: (normalizeError as {details?: string}).details });
        return {
          ok: false,
          code: 'internal',
          message: 'Cancellation could not prepare this evaluation for a safe stop. Please refresh and try again.',
          status: 500,
        };
      }
    }

    const cancellationClaimId = `user-cancel:${args.userId}`;
    const cancellationLeaseToken = randomUUID();
    const cancellationLeaseUntil = new Date(Date.parse(nowIso) + 60_000).toISOString();
    const { data: claimedForCancellation, error: claimError } = await admin
      .from('evaluation_jobs')
      .update({
        status: 'running',
        phase_status: 'running',
        claimed_by: cancellationClaimId,
        worker_id: cancellationClaimId,
        claimed_at: nowIso,
        lease_token: cancellationLeaseToken,
        lease_until: cancellationLeaseUntil,
        last_heartbeat_at: nowIso,
        last_heartbeat: nowIso,
        worker_pulse_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', args.jobId)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error('UserCancelClaimError', { jobId: args.jobId, message: (claimError as {message?: string}).message, code: (claimError as {code?: string}).code, details: (claimError as {details?: string}).details });
      return {
        ok: false,
        code: 'internal',
        message: 'Cancellation could not safely claim this queued evaluation. Please refresh and try again.',
        status: 500,
      };
    }

    if (!claimedForCancellation) {
      return {
        ok: false,
        code: 'conflict',
        message: 'This evaluation is no longer queued. Please refresh for the latest status.',
        status: 409,
      };
    }

    const { data: cancelledClaimedJob, error: claimedCancelError } = await admin
      .from('evaluation_jobs')
      .update(terminalUpdate)
      .eq('id', args.jobId)
      .eq('status', 'running')
      .eq('lease_token', cancellationLeaseToken)
      .select('id, status, progress, updated_at')
      .maybeSingle();

    if (claimedCancelError) {
      console.error('UserCancelFinalizeError', { jobId: args.jobId, message: (claimedCancelError as {message?: string}).message, code: (claimedCancelError as {code?: string}).code, details: (claimedCancelError as {details?: string}).details });
      return {
        ok: false,
        code: 'internal',
        message: 'Cancellation could not be saved. Please refresh and try again.',
        status: 500,
      };
    }

    if (!cancelledClaimedJob) {
      return {
        ok: false,
        code: 'conflict',
        message: 'This evaluation changed while cancellation was being saved. Please refresh for the latest status.',
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

  const { data: cancelledJob, error: cancelError } = await admin
    .from('evaluation_jobs')
    .update(terminalUpdate)
    .eq('id', args.jobId)
    .eq('status', 'running')
    .select('id, status, progress, updated_at')
    .maybeSingle();

  if (cancelError) {
    console.error('UserCancelTerminalError', { jobId: args.jobId, message: (cancelError as {message?: string}).message, code: (cancelError as {code?: string}).code, details: (cancelError as {details?: string}).details });
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
