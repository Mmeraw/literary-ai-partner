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

  if (!isPhase1CompleteHandoff && !force) {
    const eligibility = canRunPhase(job, PHASES.PHASE_2);
    if (!eligibility.ok) {
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
  }

  const now = new Date().toISOString();

  const nextProgress = {
    ...progress,
    phase: "phase_2",
    phase_status: "queued",
    message: "Phase 2 queued",
  };

  const updatePayload = {
    status: "queued",
    phase: "phase_2",
    phase_status: "queued",
    progress: nextProgress,
    last_error: null,
    updated_at: now,
  };

  let updateQuery = supabase
    .from("evaluation_jobs")
    .update(updatePayload)
    .eq("id", jobId)
    .select("id");

  if (!force) {
    updateQuery = updateQuery
      .eq("status", "running")
      .eq("phase", "phase_1")
      .eq("phase_status", "complete")
      .filter("progress->>phase", "eq", "phase_1")
      .filter("progress->>phase_status", "eq", "complete");
  }

  const { data, error } = await updateQuery;

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Queue failed: ${error.message}` },
      { status: 500 }
    );
  }

  if (!data || data.length !== 1) {
    return NextResponse.json(
      {
        ok: false,
        error: force
          ? "Phase 2 trigger failed: job row was not updated."
          : "Phase 2 trigger lost race or job state changed before update.",
      },
      { status: 409 }
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
