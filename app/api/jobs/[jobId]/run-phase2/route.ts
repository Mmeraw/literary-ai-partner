import { NextRequest, NextResponse } from "next/server";
import { getJob, canRunPhase } from "@/lib/jobs/store";
import { checkServiceRoleAuth } from "@/lib/auth/api";
import { PHASES } from "@/lib/jobs/types";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ jobId: string }>;

/**
 * Phase 2 trigger route
 * HARD RULE: This route NEVER executes the pipeline.
 * It ONLY queues work for the worker.
 */
export async function POST(req: NextRequest, ctx: { params: Params }) {
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

  const progress =
    job.progress && typeof job.progress === "object"
      ? (job.progress as Record<string, unknown>)
      : {};

  const isPhase1CompleteHandoff =
    job.status === "running" &&
    progress.phase === "phase_1" &&
    progress.phase_status === "complete";

  const isQueued = job.status === "queued";

  if (!isQueued && !isPhase1CompleteHandoff && !force) {
    const eligibility = canRunPhase(job, PHASES.PHASE_2);
    return NextResponse.json(
      {
        ok: false,
        error:
          eligibility.reason ||
          `Not eligible. status=${job.status}, phase=${progress.phase}, phase_status=${progress.phase_status}`,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  const updatePayload = {
    status: "queued",
    phase: "phase_2",
    phase_status: "triggered",
    last_error: null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("evaluation_jobs")
    .update(updatePayload)
    .eq("id", jobId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Queue failed: ${error.message}` },
      { status: 500 }
    );
  }

  console.log("Phase2Triggered", {
    job_id: jobId,
    trigger_time: now,
    force,
  });

  return NextResponse.json(
    {
      ok: true,
      job_id: jobId,
      status: "queued",
      phase2: "canonical_pipeline_queued",
    },
    { status: 202 }
  );
}