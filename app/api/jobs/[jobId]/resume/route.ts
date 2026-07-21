import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isTerminalFailureCode, classifyFailureBucket } from '@/lib/evaluation/processor';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';
import { selectResumeCheckpoint } from '@/lib/evaluation/phase-architecture-v2/checklistRuntimeWiring';
import { triggerEvaluationWorker, isTriggerWorkerFailure } from '@/lib/jobs/triggerWorker';
import { logger } from '@/lib/observability/logger';

/** Short deployed git SHA — same pattern as processor.ts */
const RESUME_DEPLOYED_SHA: string =
  (process.env.VERCEL_GIT_COMMIT_SHA ?? '').substring(0, 7) || 'local';

type Params = Promise<{ jobId: string }>;

function triggerResumeWorkerBestEffort(params: {
  request: NextRequest;
  jobId: string;
  source: string;
  kickoffDispatchStartedAt?: string;
}): void {
  const traceId = RESUME_DEPLOYED_SHA;
  const requestId = RESUME_DEPLOYED_SHA;

  void triggerEvaluationWorker({
    req: params.request,
    jobId: params.jobId,
    trace_id: traceId,
    request_id: requestId,
    source: params.source,
    kickoffDispatchStartedAt: params.kickoffDispatchStartedAt,
  }).then((kickoffResult) => {
    const targetClaimFailed = kickoffResult.ok && kickoffResult.targetClaimed === false;
    const noJobsClaimed = kickoffResult.ok && kickoffResult.claimed !== null && kickoffResult.claimed < 1;

    if (!kickoffResult.ok || targetClaimFailed || noJobsClaimed) {
      const reason = isTriggerWorkerFailure(kickoffResult)
        ? (kickoffResult.error ?? kickoffResult.reason)
        : targetClaimFailed
          ? 'worker_did_not_claim_resumed_job'
          : 'worker_returned_zero_claims';

      logger.warn('Worker kickoff failed after evaluation resume request', {
        event: 'api.jobs.resume.worker_kickoff_failed_async',
        job_id: params.jobId,
        source: params.source,
        trace_id: traceId,
        request_id: requestId,
        reason,
        pickup_fallback: 'cron_or_worker_queue',
        worker_body: kickoffResult.ok ? kickoffResult.body : kickoffResult.body,
      });
      return;
    }

    logger.info('Worker kickoff accepted resumed evaluation asynchronously', {
      event: 'api.jobs.resume.worker_kickoff_async_ok',
      job_id: params.jobId,
      source: params.source,
      trace_id: traceId,
      request_id: requestId,
    });
  }).catch((error) => {
    logger.warn('Worker kickoff threw after evaluation resume request', {
      event: 'api.jobs.resume.worker_kickoff_async_exception',
      job_id: params.jobId,
      source: params.source,
      trace_id: traceId,
      request_id: requestId,
      pickup_fallback: 'cron_or_worker_queue',
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

function includesShortFormInternalProcessLeak(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('SHORT_FORM_INTERNAL_PROCESS_LEAK');
  if (!value || typeof value !== 'object') return false;

  try {
    return JSON.stringify(value).includes('SHORT_FORM_INTERNAL_PROCESS_LEAK');
  } catch {
    return false;
  }
}

function isRecoverableLegacyShortFormLeakFailure(params: {
  failureCode: string | null | undefined;
  lastError: unknown;
  failureEnvelope: unknown;
  progress: Record<string, unknown>;
}): boolean {
  if (params.failureCode !== 'QG_FAILED') return false;

  return (
    includesShortFormInternalProcessLeak(params.lastError) ||
    includesShortFormInternalProcessLeak(params.failureEnvelope) ||
    includesShortFormInternalProcessLeak(params.progress)
  );
}

function isPhase0Failure(params: {
  phase: unknown;
  progress: Record<string, unknown>;
}): boolean {
  if (params.phase === 'phase_0') return true;
  return params.progress.phase === 'phase_0';
}

/**
 * POST /api/jobs/[jobId]/resume
 *
 * USER-FACING: Resume a failed evaluation job from its last checkpoint.
 *
 * Resume selection is checklist-aware:
 *   1. Prefer the last schema-valid + semantically usable + resume-safe artifact.
 *   2. Fall back to legacy phase handoff/chunk checkpoint only when no checklist-safe artifact exists.
 *   3. Use full restart only when no valid checkpoint exists.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: 'Missing job ID' }, { status: 400 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const { data: job, error: jobError } = await admin
      .from('evaluation_jobs')
      .select(
        'id, manuscript_id, status, phase, phase_status, attempt_count, max_attempts, progress, failure_code, last_error, failure_envelope, manuscripts!inner(user_id)',
      )
      .eq('id', jobId)
      .eq('manuscripts.user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or not owned by user' },
        { status: 404 },
      );
    }

    const jobRow = job as Record<string, unknown>;
    const jobFailureCode = jobRow.failure_code as string | null | undefined;
    const jobManuscriptId = jobRow.manuscript_id as number;
    const jobProgress =
      jobRow.progress && typeof jobRow.progress === 'object' && !Array.isArray(jobRow.progress)
        ? (jobRow.progress as Record<string, unknown>)
        : {};
    const recoverableLegacyShortFormLeakFailure = isRecoverableLegacyShortFormLeakFailure({
      failureCode: jobFailureCode,
      lastError: jobRow.last_error,
      failureEnvelope: jobRow.failure_envelope,
      progress: jobProgress,
    });

    const cancelledByUser =
      jobFailureCode === 'USER_CANCELLED'
      || jobProgress.cancelled_by_user === true
      || typeof jobProgress.cancelled_at === 'string'
      || typeof jobProgress.canceled_at === 'string'
      || jobProgress.dashboard_status === 'cancelled'
      || jobProgress.dashboard_status === 'canceled';

    if (cancelledByUser) {
      return NextResponse.json(
        {
          error: 'This evaluation was cancelled and cannot be resumed. Start a new evaluation to continue.',
          failure_code: jobFailureCode ?? 'USER_CANCELLED',
          resumable: false,
        },
        { status: 409 },
      );
    }

    const phase0Failure = isPhase0Failure({
      phase: jobRow.phase,
      progress: jobProgress,
    });

    if (isTerminalFailureCode(jobFailureCode) && !recoverableLegacyShortFormLeakFailure && phase0Failure) {
      const deniedAt = new Date().toISOString();
      const bucket = classifyFailureBucket(jobFailureCode);

      try {
        await upsertEvaluationArtifact({
          supabase: admin,
          jobId,
          manuscriptId: jobManuscriptId,
          artifactType: 'resume_blocked_v1',
          content: {
            event: 'resume_blocked',
            reason: 'terminal_failure_code',
            failure_code: jobFailureCode,
            bucket,
            deployed_sha: RESUME_DEPLOYED_SHA,
            attempt_count: (jobRow.attempt_count as number | null) ?? 0,
            max_attempts: (jobRow.max_attempts as number | null) ?? 3,
            phase: (jobRow.phase as string | null) ?? 'unknown',
            denied_at: deniedAt,
            operator_action_needed: bucket === 'app_logic'
              ? 'Code or governance fix required before this job can be re-run'
              : bucket === 'supabase_contract'
              ? 'Schema migration or contract fix required'
              : bucket === 'perplexity_adjudication'
              ? 'Pass 4 adjudication contract must be restored'
              : 'Review failure code and deployment state',
          },
          sourceHash: `resume_blocked_${jobId}_${deniedAt}`,
          artifactVersion: 'resume_blocked_v1',
        });
      } catch (artifactErr) {
        console.warn('[JobResume] resume_blocked_v1 artifact write failed (non-fatal):', jobId,
          artifactErr instanceof Error ? artifactErr.message : String(artifactErr));
      }

      return NextResponse.json(
        {
          error: `Job cannot be resumed: failure code '${jobFailureCode}' is a Phase 0 terminal error. Start a new evaluation to rebuild prerequisites.`,
          failure_code: jobFailureCode,
          bucket,
          resumable: false,
        },
        { status: 409 },
      );
    }

    if (job.status === 'running') {
      return NextResponse.json(
        {
          success: true,
          job_id: jobId,
          current_status: job.status,
          message: 'Evaluation is already running.',
        },
        { status: 202 },
      );
    }

    if (job.status === 'queued') {
      logger.info('Evaluation resume request accepted for already queued job', {
        event: 'api.jobs.resume.accepted_existing_queued',
        job_id: jobId,
        trace_id: RESUME_DEPLOYED_SHA,
        request_id: RESUME_DEPLOYED_SHA,
        pickup_fallback: 'cron_or_worker_queue',
      });

      triggerResumeWorkerBestEffort({
        request,
        jobId,
        source: 'api.jobs.resume.active_queued',
      });

      return NextResponse.json(
        {
          success: true,
          job_id: jobId,
          current_status: job.status,
          message: 'Evaluation recovery is queued. The worker/cron path will pick it up shortly.',
        },
        { status: 202 },
      );
    }

    if (job.status !== 'failed') {
      return NextResponse.json(
        {
          error: `Job cannot be resumed: status is '${job.status}'. Only failed or queued jobs are resumable.`,
          current_status: job.status,
        },
        { status: 409 },
      );
    }

    let hasCheckpoint = false;
    let cachedChunks = 0;
    let totalExpectedChunks = 0;

    const { data: cacheRow } = await admin
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'pass1_chunk_cache_v1')
      .maybeSingle();

    if (cacheRow?.content) {
      const cacheArtifact = cacheRow.content as {
        chunks?: Record<string, unknown>;
        total_expected?: number;
      };
      const chunkCount = Object.keys(cacheArtifact.chunks ?? {}).length;
      if (chunkCount > 0) {
        hasCheckpoint = true;
        cachedChunks = chunkCount;
        totalExpectedChunks = cacheArtifact.total_expected ?? 0;
      }
    }

    const { data: artifactRows } = await admin
      .from('evaluation_artifacts')
      .select('id, artifact_type, content, source_hash, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    const hasPhase2Handoff = (artifactRows ?? []).some(
      (row) => row.artifact_type === 'pass12_handoff_v1',
    );

    const checkpointDecision = selectResumeCheckpoint({
      rows: artifactRows ?? [],
      hasLegacyPhase2Handoff: hasPhase2Handoff,
      hasLegacyChunkCheckpoint: hasCheckpoint,
    });

    const now = new Date().toISOString();
    const targetPhase = checkpointDecision.target_phase;

    const existingProgress =
      job.progress && typeof job.progress === 'object'
        ? (job.progress as Record<string, unknown>)
        : {};

    const resumeProgress = {
      ...existingProgress,
      phase: targetPhase,
      phase_status: 'queued',
      resume_requested_at: now,
      resume_mode: checkpointDecision.resume_mode,
      resume_checkpoint_artifact_type: checkpointDecision.checkpoint_artifact_type ?? null,
      resume_checkpoint_artifact_id: checkpointDecision.checkpoint_artifact_id ?? null,
      resume_has_checkpoint: hasCheckpoint,
      resume_cached_chunks: cachedChunks,
      resume_total_expected_chunks: totalExpectedChunks,
      resume_has_phase2_handoff: hasPhase2Handoff,
      resume_selected_by: checkpointDecision.resume_mode === 'checklist_resume_safe'
        ? 'checklist_enforcer'
        : 'legacy_checkpoint_fallback',
    };

    const { data: requeuedJob, error: requeueError } = await admin
      .from('evaluation_jobs')
      .update({
        status: 'queued',
        phase: targetPhase,
        phase_status: 'queued',
        last_error: null,
        failure_code: null,
        failure_envelope: null,
        failed_at: null,
        claimed_by: null,
        claimed_at: null,
        lease_token: null,
        lease_until: null,
        last_heartbeat_at: null,
        worker_pulse_at: null,
        updated_at: now,
        progress: resumeProgress,
      })
      .eq('id', jobId)
      .eq('status', 'failed')
      .select('id, status')
      .maybeSingle();

    if (requeueError) {
      return NextResponse.json(
        { error: `Failed to requeue job: ${requeueError.message}` },
        { status: 500 },
      );
    }

    if (!requeuedJob) {
      return NextResponse.json(
        {
          error: 'Job could not be resumed because its status changed. Refresh and try again if it is still recoverable.',
          current_status: job.status,
        },
        { status: 409 },
      );
    }

    logger.info('Evaluation resume request accepted after durable requeue', {
      event: 'api.jobs.resume.accepted_requeued',
      job_id: jobId,
      status: 'queued',
      target_phase: targetPhase,
      resume_mode: checkpointDecision.resume_mode,
      checkpoint_artifact_type: checkpointDecision.checkpoint_artifact_type ?? null,
      checkpoint_artifact_id: checkpointDecision.checkpoint_artifact_id ?? null,
      trace_id: RESUME_DEPLOYED_SHA,
      request_id: RESUME_DEPLOYED_SHA,
      pickup_fallback: 'cron_or_worker_queue',
    });

    triggerResumeWorkerBestEffort({
      request,
      jobId,
      source: 'api.jobs.resume',
      kickoffDispatchStartedAt: now,
    });

    return NextResponse.json(
      {
        success: true,
        job_id: jobId,
        queued_at: now,
        resume_mode: checkpointDecision.resume_mode,
        has_checkpoint: hasCheckpoint,
        cached_chunks: cachedChunks,
        total_expected_chunks: totalExpectedChunks,
        has_phase2_handoff: hasPhase2Handoff,
        target_phase: targetPhase,
        checkpoint_artifact_type: checkpointDecision.checkpoint_artifact_type ?? null,
        checkpoint_artifact_id: checkpointDecision.checkpoint_artifact_id ?? null,
        message: 'Evaluation recovery has been queued. The worker/cron path will pick it up shortly.',
      },
      { status: 202 },
    );
  } catch (err) {
    console.error('[JobResume] Unexpected error', {
      job_id: jobId,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
