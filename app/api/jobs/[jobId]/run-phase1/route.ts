import { NextRequest, NextResponse } from "next/server";
import { getJob, canRunPhase } from "@/lib/jobs/store";
import { runPhase1 } from "@/lib/jobs/phase1";
import { checkServiceRoleAuth } from "@/lib/auth/api";
import { PHASES } from "@/lib/jobs/types";
import { assertJobNotCancelled } from "@/lib/jobs/cancellationCheck";

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/run-phase1
 * INTERNAL ONLY: Service role auth required
 */
export async function POST(req: NextRequest, ctx: { params: Params }) {
  // GOVERNANCE: Service role only (internal/daemon use)
  if (!checkServiceRoleAuth(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await ctx.params;

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const eligibility = canRunPhase(job, PHASES.PHASE_1A);
  if (!eligibility.ok) {
    return NextResponse.json({ ok: false, error: eligibility.reason }, { status: 409 });
  }

  console.log("Phase1Started", { job_id: jobId });

  // GOVERNANCE: Check if job is cancelled before starting
  const cancellation = await assertJobNotCancelled(jobId, "run_phase1_check");
  if (cancellation.cancelled) {
    return NextResponse.json(
      { ok: false, error: "Job has been cancelled", cancelled_at: cancellation.cancelled_at },
      { status: 410 }
    );
  }

  // Fire-and-forget - worker will atomically transition queued→running via lease acquisition
  setTimeout(async () => {
    try {
      await runPhase1(jobId);
    } catch (err) {
      console.error(`[Phase1Route] FATAL ERROR for job ${jobId}:`, err);
      console.error(`[Phase1Route] Error stack:`, err instanceof Error ? err.stack : "no stack");
    }
  }, 0);

  // GOVERNANCE: return DB truth only (no fabricated status)
  return NextResponse.json(
    { ok: true, job_id: jobId, status: job.status },
    { status: 202 }
  );
}
