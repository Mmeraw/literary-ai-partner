import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isTerminalFailureCode, classifyFailureBucket } from '@/lib/evaluation/processor';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';
import { selectResumeCheckpoint } from '@/lib/evaluation/phase-architecture-v2/checklistRuntimeWiring';
import { triggerEvaluationWorker, isTriggerWorkerFailure, type TriggerWorkerResult } from '@/lib/jobs/triggerWorker';
import { failEvaluationJobTerminally } from '@/lib/jobs/failJobTerminal';

/** Short deployed git SHA — same pattern as processor.ts */
const RESUME_DEPLOYED_SHA: string =
  (process.env.VERCEL_GIT_COMMIT_SHA ?? '').substring(0, 7) || 'local';

type Params = Promise<{ jobId: string }>;

function workerDidNotAcceptJob(result: TriggerWorkerResult): boolean {
  if (isTriggerWorkerFailure(result)) return true;
  if (result.targetClaimed === false) return true;
  return result.claimed !== null && result.claimed < 1;
}

function workerFailureReason(result: TriggerWorkerResult): string {
  if (isTriggerWorkerFailure(result)) return result.reason;
  if (result.targetClaimed === false) return 'worker_did_not_claim_resumed_job';
  if (result.claimed !== null && result.claimed < 1) return 'worker_returned_zero_claims';
  return 'unknown_worker_resume_failure';
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
        'id, manuscript_id, status, phase, phase_status, attempt_count, max_attempts, progress, failure_code, manuscripts!inner(user_id)',
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

    if (isTerminalFailureCode(jobFailureCode)) {
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
          error: `Job cannot be resumed: failure code '${jobFailureCode}' is a terminal error that cannot be recovered by retrying. Review the evaluation report for details.`,
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
      const activeKickoff = await triggerEvaluationWorker({
        req: request,
        jobId,
        trace_id: RESUME_DEPLOYED_SHA,
        request_id: RESUME_DEPLOYED_SHA,
        source: 'api.jobs.resume.active_queued',
      });

      if (workerDidNotAcceptJob(activeKickoff)) {
        return NextResponse.json(
          {
            error: 'Evaluation recovery is queued, but the worker is temporarily unavailable. Please try again shortly.',
            code: 'WORKER_KICKOFF_FAILED',
            reason: workerFailureReason(activeKickoff),
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          job_id: jobId,
          current_status: job.status,
          message: 'Evaluation recovery has been restarted.',
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

    const { error: requeueError } = await admin
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
      .eq('status', 'failed');

    if (requeueError) {
      return NextResponse.json(
        { error: `Failed to requeue job: ${requeueError.message}` },
        { status: 500 },
      );
    }

    const kickoffResult = await triggerEvaluationWorker({
      req: request,
      jobId,
      trace_id: RESUME_DEPLOYED_SHA,
      request_id: RESUME_DEPLOYED_SHA,
      source: 'api.jobs.resume',
      kickoffDispatchStartedAt: now,
    });

    if (workerDidNotAcceptJob(kickoffResult)) {
      const reason = workerFailureReason(kickoffResult);
      await failEvaluationJobTerminally({
        supabase: admin,
        jobId,
        failureCode: 'WORKER_KICKOFF_FAILED',
        message: `Evaluation worker did not accept resumed job: ${reason}`,
        source: 'api.jobs.resume.worker_kickoff_guard',
      });

      return NextResponse.json(
        {
          error: 'Evaluation recovery could not start because the worker is temporarily unavailable. Please try again shortly.',
          code: 'WORKER_KICKOFF_FAILED',
          reason,
        },
        { status: 503 },
      );
    }

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
