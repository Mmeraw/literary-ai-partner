import { randomUUID } from 'node:crypto';
import { sendEvaluationFailureSupportAlert } from '@/lib/evaluation/recoverySupportAlertMailer';

type SupabaseLike = {
  from(table: string): any;
};

export type TerminalJobFailureInput = {
  supabase: SupabaseLike;
  jobId: string;
  failureCode: string;
  message: string;
  source: string;
};

function buildProgressPatch(args: {
  existingProgress: Record<string, unknown>;
  nowIso: string;
  failureCode: string;
  message: string;
  source: string;
}) {
  const phaseLog = Array.isArray(args.existingProgress.phase_log)
    ? [...args.existingProgress.phase_log]
    : [];

  phaseLog.push({
    event: 'job_terminal_failure',
    at: args.nowIso,
    failure_code: args.failureCode,
    message: args.message,
    source: args.source,
  });

  return {
    ...args.existingProgress,
    phase_status: 'failed',
    message: args.message,
    error_code: args.failureCode,
    dashboard_status: 'failed',
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

function terminalFailurePayload(args: {
  progress: Record<string, unknown>;
  nowIso: string;
  failureCode: string;
  message: string;
  source: string;
}) {
  return {
    status: 'failed',
    phase_status: 'failed',
    progress: args.progress,
    last_error: args.message,
    failure_code: args.failureCode,
    failure_envelope: {
      error_code: args.failureCode,
      code: args.failureCode,
      message: args.message,
      retryable: false,
      provider: null,
      occurred_at: args.nowIso,
      context: { source: args.source },
    },
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

export async function failEvaluationJobTerminally(args: TerminalJobFailureInput): Promise<{
  ok: boolean;
  status?: string;
  error?: unknown;
}> {
  const { data: job, error: readError } = await args.supabase
    .from('evaluation_jobs')
    .select('id,status,phase,phase_status,progress')
    .eq('id', args.jobId)
    .maybeSingle();

  if (readError) {
    console.error('TerminalJobFailureReadError', {
      jobId: args.jobId,
      failureCode: args.failureCode,
      message: (readError as { message?: string }).message,
      code: (readError as { code?: string }).code,
      details: (readError as { details?: string }).details,
    });
    return { ok: false, error: readError };
  }

  if (!job) return { ok: true, status: 'missing' };
  if (job.status === 'failed' || job.status === 'complete') {
    return { ok: true, status: job.status };
  }

  const nowIso = new Date().toISOString();
  const existingProgress =
    job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
      ? (job.progress as Record<string, unknown>)
      : {};
  const progress = buildProgressPatch({
    existingProgress,
    nowIso,
    failureCode: args.failureCode,
    message: args.message,
    source: args.source,
  });
  const payload = terminalFailurePayload({
    progress,
    nowIso,
    failureCode: args.failureCode,
    message: args.message,
    source: args.source,
  });

  let expectedLeaseToken: string | null = null;
  if (job.status === 'queued') {
    expectedLeaseToken = randomUUID();
    const { data: promoted, error: promoteError } = await args.supabase
      .from('evaluation_jobs')
      .update({
        status: 'running',
        phase_status: 'running',
        claimed_by: args.source,
        worker_id: args.source,
        claimed_at: nowIso,
        lease_token: expectedLeaseToken,
        lease_until: new Date(Date.parse(nowIso) + 60_000).toISOString(),
        last_heartbeat_at: nowIso,
        last_heartbeat: nowIso,
        worker_pulse_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', args.jobId)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();

    if (promoteError) {
      console.error('TerminalJobFailurePromoteError', {
        jobId: args.jobId,
        failureCode: args.failureCode,
        message: (promoteError as { message?: string }).message,
        code: (promoteError as { code?: string }).code,
        details: (promoteError as { details?: string }).details,
      });
      return { ok: false, error: promoteError };
    }

    if (!promoted) return { ok: false, status: 'state_changed_before_promote' };
  }

  let update = args.supabase
    .from('evaluation_jobs')
    .update(payload)
    .eq('id', args.jobId)
    .eq('status', 'running');

  if (expectedLeaseToken) {
    update = update.eq('lease_token', expectedLeaseToken);
  }

  const { data: failed, error: failError } = await update
    .select('id,status,phase_status,failure_code')
    .maybeSingle();

  if (failError) {
    console.error('TerminalJobFailureFinalizeError', {
      jobId: args.jobId,
      failureCode: args.failureCode,
      message: (failError as { message?: string }).message,
      code: (failError as { code?: string }).code,
      details: (failError as { details?: string }).details,
    });
    return { ok: false, error: failError };
  }

  if (failed) {
    const alertResult = await sendEvaluationFailureSupportAlert({
      job_id: args.jobId,
      failure_code: args.failureCode,
      failure_message: args.message,
      source: args.source,
      phase: typeof job.phase === 'string' ? job.phase : null,
      phase_status: 'failed',
      progress_phase: typeof (progress as Record<string, unknown>).phase === 'string' ? (progress as Record<string, unknown>).phase as string : null,
      progress_phase_status: 'failed',
      retry_eligible: false,
      updated_at: nowIso,
    });

    if (!alertResult.sent) {
      console.warn('TerminalJobFailureSupportAlertNotSent', {
        jobId: args.jobId,
        failureCode: args.failureCode,
        attempted: alertResult.attempted,
        error: alertResult.error ?? null,
      });
    }
  }

  return { ok: Boolean(failed), status: failed?.status ?? 'not_finalized' };
}
