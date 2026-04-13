import { NextResponse } from "next/server";
import { createJob, getAllJobs } from "@/lib/jobs/store";
import * as metrics from "@/lib/jobs/metrics";
import { PHASES } from "@/lib/jobs/types";

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
  const serviceRoleHeader = req.headers.get("x-service-role");
  const expectedKey = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  const expectedServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return authHeader === expectedKey || serviceRoleHeader === expectedServiceRole;
}

export function selectEligibleJobs(allJobs: Awaited<ReturnType<typeof getAllJobs>>) {
  const phase1Candidates = allJobs.filter(
    (j) =>
      j.status === "queued" &&
      j.progress?.phase === PHASES.PHASE_1 &&
      (j.progress?.phase_status === "queued" || j.progress?.phase_status === "triggered"),
  );

  const phase2Candidates = allJobs.filter(
    (j) =>
      j.status === "running" &&
      j.progress?.phase === PHASES.PHASE_1 &&
      j.progress?.phase_status === "complete", // Must match PHASE_1_STATES.COMPLETED
  );

  return {
    phase1Candidates,
    phase2Candidates,
  };
}

export async function GET(req: Request) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 }
    );
  }

  try {
    const allJobs = await getAllJobs();
    const { phase1Candidates, phase2Candidates } = selectEligibleJobs(allJobs);

    return NextResponse.json(
      { 
        ok: true, 
        phase1_candidates: phase1Candidates,
        phase2_candidates: phase2Candidates,
        summary: {
          total: allJobs.length,
          phase1_eligible: phase1Candidates.length,
          phase2_eligible: phase2Candidates.length
        }
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
    const user_id =
      body?.user_id ??
      req.headers.get("x-user-id") ??
      "00000000-0000-0000-0000-000000000001";

    if (!manuscript_id || !job_type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: manuscript_id, job_type" },
        { status: 400 }
      );
    }

    // Create job directly (bypass rate limiting and auth checks)
    const job = await createJob({ manuscript_id, job_type, user_id });

    // Emit metrics
    metrics.onJobCreated(job.id, job_type);

    return NextResponse.json(
      { 
        ok: true, 
        job: {
          id: job.id,
          status: job.status,
          manuscript_id: job.manuscript_id,
          user_id: job.user_id,
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
