import { NextResponse } from "next/server";
import { createJob, getAllJobs } from "@/lib/jobs/store";
import * as metrics from "@/lib/jobs/metrics";

/**
 * Internal jobs endpoint
 * GET  /api/internal/jobs - List all jobs (for worker daemon)
 * POST /api/internal/jobs - Create job (for tests)
 * 
 * Used by staging smoke tests and worker daemon.
 * 
 * Guards:
 * - Requires service role key
 * - Only available in non-production environments
 * 
 * DO NOT use this in production user flows.
 */

function checkServiceRole(req: Request): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  
  const authHeader = req.headers.get("authorization");
  const expectedKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  
  return authHeader === expectedKey;
}

export async function GET(req: Request) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 }
    );
  }

  try {
    const jobs = await getAllJobs();

    return NextResponse.json(
      { 
        ok: true, 
        jobs,
        count: jobs.length
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/internal/jobs error:", err);
    return NextResponse.json(
      { 
        ok: false, 
        error: "Failed to fetch jobs", 
        details: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { manuscript_id, job_type } = body;

    if (!manuscript_id || !job_type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: manuscript_id, job_type" },
        { status: 400 }
      );
    }

    // Create job directly (bypass rate limiting and auth checks)
    const job = await createJob({ manuscript_id, job_type });

    // Emit metrics
    metrics.onJobCreated(job.id, job_type);

    return NextResponse.json(
      { 
        ok: true, 
        job: {
          id: job.id,
          status: job.status,
          manuscript_id: job.manuscript_id,
          job_type: job.job_type,
          created_at: job.created_at
        }
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/internal/jobs error:", err);
    return NextResponse.json(
      { 
        ok: false, 
        error: "Failed to create job", 
        details: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}
