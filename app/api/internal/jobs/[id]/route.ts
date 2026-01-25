import { NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/store";

/**
 * Internal job status endpoint
 * GET /api/internal/jobs/[id]
 * 
 * Used by staging smoke tests to check job status without user auth.
 */

function checkServiceRole(req: Request): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  
  const authHeader = req.headers.get("authorization");
  const expectedKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  
  return authHeader === expectedKey;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 }
    );
  }

  try {
    const jobId = params.id;

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
