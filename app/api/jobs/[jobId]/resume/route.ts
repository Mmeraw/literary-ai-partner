import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isTerminalFailureCode, classifyFailureBucket } from '@/lib/evaluation/processor';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';

/** Short deployed git SHA — same pattern as processor.ts */
const RESUME_DEPLOYED_SHA: string =
  (process.env.VERCEL_GIT_COMMIT_SHA ?? '').substring(0, 7) || 'local';

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/resume
 *
 * USER-FACING: Resume a failed evaluation job from its last checkpoint.
 *
 * PR-E (chunk-level checkpointing): When a job fails mid-Pass1, each completed
 * chunk has been written to a pass1_chunk_cache_v1 evaluation_artifact row.
 * This endpoint requeues the job so the next worker invocation will:
 *   1. Load the chunk cache artifact
 *   2. Skip already-completed chunk indices
 *   3. Continue Pass1 from the first incomplete chunk
 *
 * The job is NOT cloned — the same job_id is reused. This preserves all
 * progress metadata, failure history, and checkpoint artifacts.
 *
 * Eligibility rules:
 *   - Job must be owned by the authenticated user
 *   - Job must have status='failed'
 *   - Job must not already be queued or running (idempotency guard)
 *   - attempt_count must be below max_attempts (3) OR operator override
 *
 * Response:
 *   { success: true, job_id, queued_at, has_checkpoint, cached_chunks } (202)
 *   { error: string } with status 400|401|403|404|409
 */
export async function POST(
  _request: NextRequest,
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
    // ── 1. Ownership + status check ──────────────────────────────────────────
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

    // Only failed jobs can be resumed.
    // Terminal failure codes (QG_*, governance, schema, auth) are not recoverable
    // by re-running — resuming would loop forever.  Surface a clear error.
    const jobRow = job as Record<string, unknown>;
    const jobFailureCode = jobRow.failure_code as string | null | undefined;
    const jobManuscriptId = jobRow.manuscript_id as number;

    if (isTerminalFailureCode(jobFailureCode)) {
      const deniedAt = new Date().toISOString();
      const bucket = classifyFailureBucket(jobFailureCode);

      // Write durable blocked-resume audit artifact — best-effort, non-fatal.
      // Lets operators trace why a user couldn't resume and what fix is needed.
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
        // Non-fatal — the 409 response is what matters
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

    // Only failed jobs can be resumed.
    if (job.status !== 'failed') {
      return NextResponse.json(
        {
          error: `Job cannot be resumed: status is '${job.status}'. Only failed jobs are resumable.`,
          current_status: job.status,
        },
        { status: 409 },
      );
    }

    // Guard: don't re-queue if already queued/running (shouldn't happen, but be safe).
    if (job.status === 'queued' || job.status === 'running') {
      return NextResponse.json(
        { error: 'Job is already active', current_status: job.status },
        { status: 409 },
      );
    }

    // ── 2. Check for checkpoint artifact ────────────────────────────────────
    // Surface checkpoint metadata in the response so the client can display
    // "Resuming from chunk N of M" vs. "Restarting from scratch".
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

    // Also check for a phase-split handoff artifact (Pass1+Pass2 complete, Pass3 pending).
    let hasPhase2Handoff = false;
    const { data: handoffRow } = await admin
      .from('evaluation_artifacts')
      .select('id')
      .eq('job_id', jobId)
      .eq('artifact_type', 'pass12_handoff_v1')
      .maybeSingle();

    if (handoffRow?.id) {
      hasPhase2Handoff = true;
    }

    // ── 3. Requeue the job ───────────────────────────────────────────────────
    // Reset status and phase_status back to 'queued' so the cron worker picks it up.
    // - If a phase-split handoff exists: route to phase_2 (skip Pass1+Pass2)
    // - If a chunk cache exists: route to phase_1 (resume Pass1 from checkpoint)
    // - Otherwise: route to phase_1 (full re-run — honest, no fake resilience claims)
    const now = new Date().toISOString();
    const targetPhase = hasPhase2Handoff ? 'phase_2' : 'phase_1';

    const existingProgress =
      job.progress && typeof job.progress === 'object'
        ? (job.progress as Record<string, unknown>)
        : {};

    const resumeProgress = {
      ...existingProgress,
      phase: targetPhase,
      phase_status: 'queued',
      // PR-E: surface resume context in progress so operators can trace it
      resume_requested_at: now,
      resume_has_checkpoint: hasCheckpoint,
      resume_cached_chunks: cachedChunks,
      resume_total_expected_chunks: totalExpectedChunks,
      resume_has_phase2_handoff: hasPhase2Handoff,
    };

    const { error: requeueError } = await admin
      .from('evaluation_jobs')
      .update({
        status: 'queued',
        phase: targetPhase,
        phase_status: 'queued',
        last_error: null,
        failure_envelope: null,
        updated_at: now,
        progress: resumeProgress,
      })
      .eq('id', jobId)
      .eq('status', 'failed'); // Idempotency: only update if still failed

    if (requeueError) {
      return NextResponse.json(
        { error: `Failed to requeue job: ${requeueError.message}` },
        { status: 500 },
      );
    }

    // ── 4. Respond with resume context ───────────────────────────────────────
    const resumeMode = hasPhase2Handoff
      ? 'phase2_handoff' // Fastest — only Pass3 needed
      : hasCheckpoint
      ? 'chunk_checkpoint' // Resume Pass1 from chunk N
      : 'full_restart'; // No checkpoint — honest full re-run

    return NextResponse.json(
      {
        success: true,
        job_id: jobId,
        queued_at: now,
        resume_mode: resumeMode,
        has_checkpoint: hasCheckpoint,
        cached_chunks: cachedChunks,
        total_expected_chunks: totalExpectedChunks,
        has_phase2_handoff: hasPhase2Handoff,
        target_phase: targetPhase,
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
