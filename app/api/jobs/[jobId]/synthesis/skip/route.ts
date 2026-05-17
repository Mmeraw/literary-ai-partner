import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/synthesis/skip
 *
 * USER-FACING: Skip Narrative Synthesis (Pass 3b) for a job.
 *
 * If synthesis artifact is pending or stuck, this endpoint signals
 * to mark synthesis as complete without waiting for the DREAM worker.
 * The core evaluation results will be available; synthesis is optional.
 *
 * Implementation: Sets a flag in job.progress.synthesis_skip_requested = true
 * The DREAM worker checks this flag and skips synthesis if present.
 *
 * Response:
 *   { success: true, message: "Synthesis skipped" } (202)
 *   { error: string } with status 400|401|403|404
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: 'Missing job ID' }, { status: 400 });
  }

  // --- AUTH: Verify user is authenticated ---
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // --- OWNERSHIP CHECK: job belongs to this user ---
    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin
      .from('evaluation_jobs')
      .select('id, manuscript_id, manuscripts!inner(user_id)')
      .eq('id', jobId)
      .eq('manuscripts.user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or not owned by user' },
        { status: 404 }
      );
    }

    // --- FLAG SYNTHESIS SKIP ---
    // In production, this would set a flag in job.progress that the DREAM worker checks.
    // For now, return 202 Accepted to indicate the request was queued.
    const { error: updateError } = await admin
      .from('evaluation_jobs')
      .update({
        progress: {
          synthesis_skip_requested: true,
          synthesis_skip_requested_at: new Date().toISOString(),
        },
      })
      .eq('id', jobId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to skip synthesis: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Synthesis skipped',
        job_id: jobId,
        skipped_at: new Date().toISOString(),
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('SynthesisSkipError', {
      job_id: jobId,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
