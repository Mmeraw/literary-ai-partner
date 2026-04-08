// app/api/admin/jobs/[jobId]/run-phase2/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { processEvaluationJob } from "@/lib/evaluation/processor";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";

type Ok = { ok: true; job_id: string; phase2: "canonical_pipeline_complete" };
type Err = { ok: false; error: string; details?: string };

export async function POST(
  req: NextRequest,
  ctx: { params: { jobId: string } }
) {
  // 1) Admin gate: dev header actor (test-mode only) OR production auth
  const actor = getDevHeaderActor(req);
  if (actor?.isAdmin) {
    // Dev-only admin bypass: TEST_MODE + ALLOW_HEADER_USER_ID are both true
    // and actor has admin signal — continue to phase2 logic
  } else {
    // Production path: require real Supabase session + admin role
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  try {
    const supabase = createAdminClient();
    const jobId = ctx.params.jobId;
    const force = req.nextUrl.searchParams.get("force") === "1";

    const { data: jobRow, error: jobReadError } = await supabase
      .from("evaluation_jobs")
      .select("id,status,last_error")
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

    if (jobRow.status !== "queued") {
      if (!force) {
        const payload: Err = {
          ok: false,
          error: "Job must be queued to run canonical phase2",
          details: `Current status=${jobRow.status}. Re-run with ?force=1 to requeue and execute.`,
        };
        return NextResponse.json(payload, { status: 409 });
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
        const payload: Err = {
          ok: false,
          error: "Failed to requeue job",
          details: requeueError.message,
        };
        return NextResponse.json(payload, { status: 500 });
      }
    }

    const result = await processEvaluationJob(jobId);

    if (!result.success) {
      const payload: Err = {
        ok: false,
        error: "Failed to run canonical phase2",
        details: result.error,
      };
      return NextResponse.json(payload, { status: 500 });
    }

    const payload: Ok = {
      ok: true,
      job_id: jobId,
      phase2: "canonical_pipeline_complete",
    };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const payload: Err = {
      ok: false,
      error: "Failed to run phase2",
      details: err instanceof Error ? err.message : "Unknown error",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}
