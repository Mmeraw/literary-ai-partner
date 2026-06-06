import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { cancelEvaluationAsUser } from '@/lib/jobs/userCancel';

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/user-cancel
 *
 * USER-FACING: Authenticated user can cancel their own queued/running evaluation job.
 *
 * Cancellation is stored using the canonical terminal lifecycle status:
 *   - status: "failed"
 *   - phase_status: "failed"
 *   - progress.canceled_at / progress.canceled_reason / progress.cancelled_by_user
 *   - last_error / failure_envelope = USER_CANCELLED
 *
 * The route is idempotent for already-cancelled jobs so the UI can show a clear
 * success state instead of leaving the user wondering whether the job is still active.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
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
    const body = await request.json().catch(() => ({})) as { reason?: string };
    const result = await cancelEvaluationAsUser({
      jobId,
      userId: user.id,
      reason: body?.reason,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.message,
          job_id: jobId,
          status: result.jobStatus ?? 'unknown',
        },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.alreadyCancelled ? 'Evaluation already cancelled' : 'Evaluation cancelled by user',
        job_id: jobId,
        status: 'cancelled',
        cancelled_at: result.cancelledAt,
        dashboard_status: 'cancelled',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('UserCancelJobError', {
      job_id: jobId,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: 'Cancellation failed before it could be saved. Please refresh and try again.' },
      { status: 500 }
    );
  }
}
