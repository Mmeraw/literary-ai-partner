import { NextRequest, NextResponse } from "next/server";
import { cancelJob } from "../../../../../lib/jobs/cancel";
import { checkServiceRoleAuth } from "@/lib/auth/api";
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { cancelEvaluationAsUser } from '@/lib/jobs/userCancel';

/**
 * POST /api/jobs/[jobId]/cancel
 *
 * INTERNAL ONLY: Service role auth required
 * Cancel a running or queued job.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json(
      { error: "Missing job id in URL" },
      { status: 400 },
    );
  }

  try {
    // Internal daemon/service-role callers retain direct access.
    if (checkServiceRoleAuth(request)) {
      const result = await cancelJob(jobId);

      if (!result.success) {
        return NextResponse.json(
          { error: "error" in result ? result.error : "Failed to cancel job" },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: "Job canceled successfully",
          status: 'cancelled',
          dashboard_status: 'cancelled',
        },
        { status: 200 },
      );
    }

    // User callers: owner-authenticated cancel path.
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { reason?: string };
    const result = await cancelEvaluationAsUser({
      jobId,
      userId: user.id,
      reason: body?.reason,
    });

    if (result.ok === false) {
      return NextResponse.json(
        {
          error: result.message,
          status: result.jobStatus ?? 'unknown',
        },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.alreadyCancelled ? 'Evaluation already cancelled' : 'Evaluation cancelled by user',
        status: 'cancelled',
        cancelled_at: result.cancelledAt,
        dashboard_status: 'cancelled',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("CancelJobError", {
      job_id: jobId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to cancel job" },
      { status: 500 },
    );
  }
}
