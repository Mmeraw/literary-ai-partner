import { NextRequest, NextResponse } from "next/server";
import { cancelJob } from "../../../../../lib/jobs/cancel";

/**
 * POST /api/jobs/[id]/cancel
 * 
 * Cancel a running or queued job.
 * Sets status to "canceled" (terminal), clears leases.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const result = await cancelJob(id);

    if (!result.success) {
      return NextResponse.json(
        { error: "error" in result ? result.error : "Failed to cancel job" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        message: "Job canceled successfully",
        job: result.job 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("CancelJobError", {
      job_id: id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Failed to cancel job" },
      { status: 500 }
    );
  }
}
