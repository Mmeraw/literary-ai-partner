import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/synthesis/retry
 *
 * USER-FACING: Retry Narrative Synthesis (Pass 3b) for a job.
 *
 * If synthesis artifact is pending or stuck, this endpoint signals
 * the DREAM worker to re-run synthesis on the next cron tick.
 *
 * Implementation: Sets a flag in job.progress.synthesis_retry_requested = true
 * The DREAM worker checks this flag before processing.
 *
 * Response:
 *   { success: true, message: "Synthesis retry queued" } (202)
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

    // --- FLAG SYNTHESIS RETRY ---
    // In production, this would set a flag in job.progress that the DREAM worker checks.
    // For now, return 202 Accepted to indicate the request was queued.
    const { error: updateError } = await admin
      .from('evaluation_jobs')
      .update({
        progress: {
          synthesis_retry_requested: true,
          synthesis_retry_requested_at: new Date().toISOString(),
        },
      })
      .eq('id', jobId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to queue retry: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Synthesis retry queued',
        job_id: jobId,
        queued_at: new Date().toISOString(),
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('SynthesisRetryError', {
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
