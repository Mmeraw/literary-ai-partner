import { NextRequest, NextResponse } from "next/server";
import { cancelJob } from "../../../../../lib/jobs/cancel";
import { checkServiceRoleAuth } from "@/lib/auth/api";

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
  // GOVERNANCE: Service role only (internal/daemon use)
  if (!checkServiceRoleAuth(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json(
      { error: "Missing job id in URL" },
      { status: 400 },
    );
  }

  try {
    const result = await cancelJob(jobId);

    if (!result.success) {
      return NextResponse.json(
        { error: "error" in result ? result.error : "Failed to cancel job" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        message: "Job canceled successfully",
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
