// app/api/admin/jobs/[jobId]/run-phase2/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";

type Err = { ok: false; error: string; details?: string };

export async function POST(
  req: NextRequest,
  ctx: { params: { jobId: string } }
) {
  // Admin gate: dev header actor OR production auth
  const actor = getDevHeaderActor(req);
  if (!actor?.isAdmin) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  try {
    const supabase = createAdminClient();
    const jobId = ctx.params.jobId;
    const force = req.nextUrl.searchParams.get("force") === "1";

    const { data: jobRow, error: jobReadError } = await supabase
      .from("evaluation_jobs")
      .select("id,status,phase,phase_status,progress,last_error")
      .eq("id", jobId)
      .single();

    if (jobReadError || !jobRow) {
      const payload: Err = {
        ok: false,
        error: "Job not found",
        details: jobReadError?.message,
      };
      return NextResponse.json(payload, { status: 404 });
    }

    const progress =
      jobRow.progress && typeof jobRow.progress === "object"
        ? (jobRow.progress as Record<string, unknown>)
        : {};

    const isPhase1CompleteHandoff =
      jobRow.status === "running" &&
      (jobRow.phase === "phase_1" || progress.phase === "phase_1") &&
      (jobRow.phase_status === "complete" || progress.phase_status === "complete");

    const isQueued = jobRow.status === "queued";

    if (!isQueued && !isPhase1CompleteHandoff && !force) {
      const payload: Err = {
        ok: false,
        error: "Job is not eligible for Phase 2 trigger",
        details: `status=${jobRow.status}, phase=${jobRow.phase}, phase_status=${jobRow.phase_status}`,
      };
      return NextResponse.json(payload, { status: 409 });
    }

    const now = new Date().toISOString();

    const updatePayload = {
      status: "queued",
      phase: "phase_2",
      phase_status: "triggered",
      last_error: null,
      updated_at: now,
    };

    const { error: updateError } = await supabase
      .from("evaluation_jobs")
      .update(updatePayload)
      .eq("id", jobId);

    if (updateError) {
      const payload: Err = {
        ok: false,
        error: "Failed to queue job for worker execution",
        details: updateError.message,
      };
      return NextResponse.json(payload, { status: 500 });
    }

    console.log("AdminPhase2Triggered", {
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
  } catch (err) {
    const payload: Err = {
      ok: false,
      error: "Failed to trigger phase2",
      details: err instanceof Error ? err.message : "Unknown error",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}