import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/store";
import { checkServiceRoleAuth } from "@/lib/auth/api";
import type { NextRequest } from "next/server";

/**
 * Internal job status endpoint
 * GET /api/internal/jobs/[id]
 * 
 * Used by staging smoke tests to check job status without user auth.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!checkServiceRoleAuth(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 }
    );
  }

  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: "Job ID required" },
        { status: 400 }
      );
    }

    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, job });
  } catch (err) {
    console.error("GET /api/internal/jobs/[id] error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}
