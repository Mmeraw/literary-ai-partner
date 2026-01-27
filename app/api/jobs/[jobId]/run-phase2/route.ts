import { NextRequest, NextResponse } from "next/server";
import { runPhase2 } from "@/lib/jobs/phase2";
import { getJob, canRunPhase } from "@/lib/jobs/store";
import { checkServiceRoleAuth } from "@/lib/auth/api";
import { PHASES } from "@/lib/jobs/types";

type Params = { jobId: string };

/**
 * POST /api/jobs/[jobId]/run-phase2
 * INTERNAL ONLY: Service role auth required
 */
export async function POST(req: NextRequest, ctx: { params: Params }) {
  // GOVERNANCE: Service role only (internal/daemon use)
  if (!checkServiceRoleAuth(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = ctx.params;

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const eligibility = canRunPhase(job, PHASES.PHASE_2);
  if (!eligibility.ok) {
    return NextResponse.json({ ok: false, error: eligibility.reason }, { status: 409 });
  }

  console.log("Phase2Started", { job_id: jobId });

  // Fire-and-forget - worker will atomically handle the running state via lease acquisition
  setTimeout(() => {
    void runPhase2(jobId);
  }, 0);

  // GOVERNANCE: return DB truth only (no fabricated status)
  return NextResponse.json(
    { ok: true, job_id: jobId, status: job.status },
    { status: 202 }
  );
}
