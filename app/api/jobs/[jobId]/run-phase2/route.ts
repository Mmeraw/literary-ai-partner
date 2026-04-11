import { NextRequest, NextResponse } from "next/server";
import { getJob, canRunPhase } from "@/lib/jobs/store";
import { checkServiceRoleAuth } from "@/lib/auth/api";
import { PHASES } from "@/lib/jobs/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { processEvaluationJob } from "@/lib/evaluation/processor";

type Params = Promise<{ jobId: string }>;

/**
 * POST /api/jobs/[jobId]/run-phase2
 * INTERNAL ONLY: Service role auth required.
 *
 * ─────────────────────────────────────────────────────────────────────
 * EXECUTION BOUNDARY CONTRACT
 * ─────────────────────────────────────────────────────────────────────
 *
 * This route is a TRIGGER SURFACE only. It does NOT execute the
 * evaluation pipeline synchronously inside the HTTP request.
 *
 * Responsibilities of this route:
 *   1. Auth gate (service role only)
 *   2. Job existence + eligibility guard
 *   3. Optional requeue on force=1
 *   4. Claim the job (status=running, trigger metadata written)
 *   5. Fire processEvaluationJob() in a detached async context
 *   6. Return {ok: true, status: "triggered"} immediately
 *
 * Responsibilities that belong ONLY to processEvaluationJob():
 *   - All AI execution (Pass 1/2/3/4)
 *   - Artifact persistence
 *   - status=complete or status=failed writes
 *
 * Rationale: Binding deep AI work to the HTTP request lifecycle means
 * any Vercel timeout or crash before artifact persistence leaves the
 * job in a dark state. Decoupling ensures durable truth is written
 * by the processor regardless of HTTP lifecycle events.
 * ─────────────────────────────────────────────────────────────────────
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

  if (job.status !== "queued") {
    if (!force) {
      const eligibility = canRunPhase(job, PHASES.PHASE_2);
      return NextResponse.json(
        {
          ok: false,
          error:
            eligibility.reason ||
            `Job must be queued for canonical execution. Current status=${job.status}`,
        },
        { status: 409 }
      );
    }

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

  // Claim the job: write trigger metadata before firing processor.
  // This ensures durable truth exists even if the detached path fails
  // before processEvaluationJob() writes its first status update.
  const triggerTime = new Date().toISOString();
  const { error: claimError } = await supabase
    .from("evaluation_jobs")
    .update({
      phase: "phase_1",
      phase_status: "triggered",
      last_error: null,
      updated_at: triggerTime,
    })
    .eq("id", jobId)
    .eq("status", "queued"); // idempotent guard: only claim if still queued

  if (claimError) {
    return NextResponse.json(
      { ok: false, error: `Failed to claim job for execution: ${claimError.message}` },
      { status: 500 }
    );
  }

  console.log("Phase2Triggered", { job_id: jobId, trigger_time: triggerTime });

  // ── Fire and detach ───────────────────────────────────────────────────
  // processEvaluationJob() owns all execution state from here.
  // The HTTP response does NOT wait for completion.
  // Any unhandled error in the detached path is caught and logged;
  // the processor's internal markFailed() handles job state writes.
  processEvaluationJob(jobId).catch((unexpectedError) => {
    // This catch is a last-resort safety net for unexpected throws
    // that escape the processor's own try/catch. The processor
    // already writes failed state internally, so this is observability only.
    console.error("Phase2UnexpectedError", {
      job_id: jobId,
      error: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
    });
  });

  // GOVERNANCE: return trigger acknowledgment, NOT completion truth.
  // Callers must poll job status to determine completion.
  return NextResponse.json(
    {
      ok: true,
      job_id: jobId,
      status: "triggered",
      phase2: "canonical_pipeline_triggered",
      message: "Evaluation pipeline started. Poll job status for completion.",
    },
    { status: 202 }
  );
}
