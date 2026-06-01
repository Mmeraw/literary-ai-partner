import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = Promise<{ jobId: string }>;

type CancelReason = 'wrong_file' | 'wrong_mode' | 'user_cancelled' | 'other';

const ALLOWED_REASONS = new Set<CancelReason>([
  'wrong_file',
  'wrong_mode',
  'user_cancelled',
  'other',
]);

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
    const requestedReason = typeof body?.reason === 'string' ? body.reason : 'user_cancelled';
    const reason: CancelReason = ALLOWED_REASONS.has(requestedReason as CancelReason)
      ? (requestedReason as CancelReason)
      : 'user_cancelled';

    const admin = createAdminClient();

    const { data: job, error: jobError } = await admin
      .from('evaluation_jobs')
      .select('id, status, phase, phase_status, progress, manuscript_id, manuscripts!inner(user_id)')
      .eq('id', jobId)
      .eq('manuscripts.user_id', user.id)
      .maybeSingle();

    if (jobError) {
      console.error('UserCancelJobLookupError', {
        job_id: jobId,
        user_id: user.id,
        error: jobError.message,
      });
      return NextResponse.json(
        { error: 'Unable to verify this evaluation before cancelling it.' },
        { status: 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found or not owned by user' },
        { status: 404 }
      );
    }

    const existingProgress =
      job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
        ? (job.progress as Record<string, unknown>)
        : {};

    // Idempotent success: a retry or double-click after successful cancellation
    // should still tell the user the cancellation went through.
    if (job.status === 'failed' && existingProgress.canceled_at) {
      return NextResponse.json(
        {
          success: true,
          message: 'Evaluation already cancelled',
          job_id: jobId,
          status: 'cancelled',
          cancelled_at: existingProgress.canceled_at,
          dashboard_status: 'cancelled',
        },
        { status: 200 }
      );
    }

    if (job.status === 'complete') {
      return NextResponse.json(
        {
          error: 'This evaluation has already completed and can no longer be cancelled.',
          job_id: jobId,
          status: 'complete',
        },
        { status: 409 }
      );
    }

    if (job.status !== 'queued' && job.status !== 'running') {
      return NextResponse.json(
        {
          error: `This evaluation is already ${job.status} and is no longer active.`,
          job_id: jobId,
          status: job.status,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const cancelMessage = `User cancelled evaluation: ${reason}`;
    const nextProgress = {
      ...existingProgress,
      phase: job.phase ?? existingProgress.phase ?? null,
      phase_status: 'failed',
      message: 'Evaluation cancelled by user',
      canceled_at: now,
      canceled_reason: reason,
      cancelled_by_user: true,
      error_code: 'USER_CANCELLED',
      finished_at: now,
      lease_id: null,
      lease_expires_at: null,
    };

    const { data: cancelledJob, error: cancelError } = await admin
      .from('evaluation_jobs')
      .update({
        status: 'failed',
        phase_status: 'failed',
        progress: nextProgress,
        last_error: cancelMessage,
        failure_envelope: {
          error_code: 'USER_CANCELLED',
          code: 'USER_CANCELLED',
          message: cancelMessage,
          retryable: false,
          phase: job.phase ?? existingProgress.phase ?? null,
          provider: null,
          occurred_at: now,
          context: {
            reason,
            cancelled_by_user: true,
          },
        },
        failed_at: now,
        updated_at: now,
      })
      .eq('id', jobId)
      .in('status', ['queued', 'running'])
      .select('id, status, progress, updated_at')
      .maybeSingle();

    if (cancelError) {
      console.error('UserCancelJobUpdateError', {
        job_id: jobId,
        user_id: user.id,
        error: cancelError.message,
      });
      return NextResponse.json(
        { error: 'Cancellation could not be saved. Please refresh and try again.' },
        { status: 500 }
      );
    }

    if (!cancelledJob) {
      // Race-safe verification: if a worker changed the job between read and update,
      // return the truth instead of a vague internal error.
      const { data: currentJob } = await admin
        .from('evaluation_jobs')
        .select('id, status, progress, updated_at')
        .eq('id', jobId)
        .maybeSingle();

      const currentProgress =
        currentJob?.progress && typeof currentJob.progress === 'object' && !Array.isArray(currentJob.progress)
          ? (currentJob.progress as Record<string, unknown>)
          : {};

      if (currentJob?.status === 'failed' && currentProgress.canceled_at) {
        return NextResponse.json(
          {
            success: true,
            message: 'Evaluation cancelled by user',
            job_id: jobId,
            status: 'cancelled',
            cancelled_at: currentProgress.canceled_at,
            dashboard_status: 'cancelled',
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          error: currentJob?.status === 'complete'
            ? 'This evaluation completed before the cancellation could be applied.'
            : 'This evaluation is no longer in a cancellable state. Please refresh for the latest status.',
          job_id: jobId,
          status: currentJob?.status ?? 'unknown',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Evaluation cancelled by user',
        job_id: jobId,
        status: 'cancelled',
        cancelled_at: now,
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
