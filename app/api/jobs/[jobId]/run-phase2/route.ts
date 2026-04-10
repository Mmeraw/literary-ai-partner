import { NextRequest, NextResponse } from "next/server";
import { getJob, canRunPhase } from "@/lib/jobs/store";
import { checkServiceRoleAuth } from "@/lib/auth/api";
import { PHASES } from "@/lib/jobs/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { processEvaluationJob } from "@/lib/evaluation/processor";

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/run-phase2
 * INTERNAL ONLY: Service role auth required
 */
export async function POST(req: NextRequest, ctx: { params: Params }) {
  // GOVERNANCE: Service role only (internal/daemon use)
  if (!checkServiceRoleAuth(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await ctx.params;
  const force = req.nextUrl.searchParams.get("force") === "1";
  const supabase = createAdminClient();

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  // FIX(a): Accept canonical Phase 1-complete handoff state for Phase 2 entry
  // Root cause: candidate filter expects status=running + phase1 complete,
  // but execution gate expected status=queued. These are contradictory.
  // See CANON_CODE_RECONCILIATION_MATRIX.md § ROOT CAUSE IDENTIFIED.
  const progress = job.progress && typeof job.progress === 'object' ? job.progress as Record<string, unknown> : {};
  const isPhase1Complete =
    job.status === "running" &&
    (job.phase === "phase_1" || progress.phase === "phase_1") &&
    (job.phase_status === "complete" || progress.phase_status === "complete");

  if (job.status !== "queued" && !isPhase1Complete) {
    if (!force) {
      const eligibility = canRunPhase(job, PHASES.PHASE_2);
      return NextResponse.json(
        {
          ok: false,
          error:
            eligibility.reason ||
            `Job must be queued or Phase 1 complete for Phase 2 execution. Current status=${job.status}`,
        },
        { status: 409 }
      );
    }
  }

  // Requeue to 'queued' if not already queued (handles both force and canonical handoff)
  if (job.status !== "queued") {

    const { error: requeueError } = await supabase
      .from("evaluation_jobs")
      .update({
        status: "queued",
        phase: "phase_1",
        phase_status: "queued",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (requeueError) {
      return NextResponse.json(
        { ok: false, error: `Failed to requeue job: ${requeueError.message}` },
        { status: 500 }
      );
    }
  }

  console.log("Phase2Started", { job_id: jobId });

  const result = await processEvaluationJob(jobId);
  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: result.error || "Canonical phase2 execution failed" },
      { status: 500 }
    );
  }

  // GOVERNANCE: return explicit canonical completion truth
  return NextResponse.json(
    { ok: true, job_id: jobId, status: "complete", phase2: "canonical_pipeline_complete" },
    { status: 200 }
  );
}
