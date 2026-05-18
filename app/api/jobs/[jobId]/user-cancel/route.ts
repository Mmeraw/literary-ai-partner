import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelJob } from '@/lib/jobs/cancel';

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/user-cancel
 *
 * USER-FACING: Authenticated user can cancel their own evaluation job.
 *
 * Ownership check: user_id must match the manuscript owner via:
 *   evaluation_jobs.manuscript_id -> manuscripts.user_id
 *
 * Reason: One of 'wrong_file' | 'wrong_mode' | 'user_cancelled' | 'other'
 *
 * Response:
 *   { success: true, message: "Evaluation cancelled by user" } (202)
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
    // --- PARSE REASON ---
    const body = (await request.json()) as { reason?: string };
    const reason = body?.reason || 'user_cancelled';

    // --- OWNERSHIP CHECK: job belongs to this user ---
    const admin = createAdminClient();
    const { data: job, error: jobError } = await admin
      .from('evaluation_jobs')
      .select('id, status, manuscript_id, manuscripts!inner(user_id)')
      .eq('id', jobId)
      .eq('manuscripts.user_id', user.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or not owned by user' },
        { status: 404 }
      );
    }

    // --- CANCELLATION: delegate to canonical cancelJob ---
    const result = await cancelJob(
      jobId,
      `User cancelled: ${reason}`
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to cancel job' },
        { status: 400 }
      );
    }

    // --- SUCCESS: Return 202 Accepted ---
    return NextResponse.json(
      {
        success: true,
        message: 'Evaluation cancelled by user',
        job_id: jobId,
        cancelled_at: new Date().toISOString(),
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('UserCancelJobError', {
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
