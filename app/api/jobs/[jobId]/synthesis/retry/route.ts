import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/synthesis/retry
 *
 * USER-FACING: Recover Narrative Synthesis (Pass 3b) without restarting the
 * completed evaluation. The retry resumes from the durable Evidence Review
 * boundary: the certified evaluation result, manuscript chunks, and persisted
 * artifacts already stored for the job.
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

  try {
    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin
      .from('evaluation_jobs')
      .select('id, status, progress, manuscript_id, manuscripts!inner(user_id)')
      .eq('id', jobId)
      .eq('manuscripts.user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or not owned by user' },
        { status: 404 },
      );
    }

    if (job.status !== 'complete') {
      return NextResponse.json(
        { error: 'Evidence Review is not complete yet; Narrative Synthesis cannot be recovered.' },
        { status: 409 },
      );
    }

    const { data: existingArtifact, error: artifactError } = await admin
      .from('evaluation_artifacts')
      .select('id, content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'longform_document_v1')
      .maybeSingle();

    if (artifactError) {
      return NextResponse.json(
        { error: `Could not verify synthesis state: ${artifactError.message}` },
        { status: 500 },
      );
    }

    const artifactContent = existingArtifact?.content as
      | { longform_document?: unknown }
      | null
      | undefined;
    if (artifactContent?.longform_document) {
      return NextResponse.json(
        {
          success: true,
          already_complete: true,
          message: 'Narrative Synthesis is already complete. Reloading is not required.',
          job_id: jobId,
        },
        { status: 200 },
      );
    }

    const existingProgress =
      job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
        ? (job.progress as Record<string, unknown>)
        : {};
    const queuedAt = new Date().toISOString();
    const resumeAnchor = existingProgress.pass3_completed_at
      ? 'pass3_completed_at'
      : existingProgress.final_external_audit_completed_at
        ? 'final_external_audit_completed_at'
        : 'completed_evidence_review';

    const { error: updateError } = await admin
      .from('evaluation_jobs')
      .update({
        last_error: null,
        progress: {
          ...existingProgress,
          synthesis_retry_requested: true,
          synthesis_retry_requested_at: queuedAt,
          synthesis_retry_resume_anchor: resumeAnchor,
          synthesis_retry_mode: 'resume_from_persisted_evidence_review',
        },
      })
      .eq('id', jobId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to queue recovery: ${updateError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Narrative Synthesis recovery queued from the completed Evidence Review anchor.',
        job_id: jobId,
        queued_at: queuedAt,
        resume_from: resumeAnchor,
        restarts_evaluation: false,
      },
      { status: 202 },
    );
  } catch (err) {
    console.error('SynthesisRetryError', {
      job_id: jobId,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
