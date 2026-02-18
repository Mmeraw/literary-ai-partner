// app/api/evaluations/[jobId]/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

type Ok = {
  ok: true;
  job_id: string;
  status: string;
  evaluation_result: unknown;
};

type Err = {
  ok: false;
  error: string;
  details?: string;
};

export async function GET(
  req: Request,
  ctx: { params: { jobId: string } }
) {
  try {
    // 1) Auth (cookie/session) — MUST be first for 401 vs 403 truth
    const user = await getAuthenticatedUser();
    if (!user) {
      const payload: Err = { ok: false, error: "Unauthorized" };
      return NextResponse.json(payload, { status: 401 });
    }

    // 2) Trusted DB read (service role)
    const supabase = createAdminClient();
    const jobId = ctx.params.jobId;

    const { data: job, error } = await supabase
      .from("evaluation_jobs")
      .select("id,status,created_by,evaluation_result")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      const payload: Err = {
        ok: false,
        error: "Failed to load job",
        details: error.message,
      };
      return NextResponse.json(payload, { status: 500 });
    }

    if (!job) {
      const payload: Err = { ok: false, error: "Job not found" };
      return NextResponse.json(payload, { status: 404 });
    }

    // 3) Ownership enforcement
    if (job.created_by !== user.id) {
      const payload: Err = { ok: false, error: "Forbidden" };
      return NextResponse.json(payload, { status: 403 });
    }

    // 4) Completion enforcement
    if (job.status !== "completed") {
      const payload: Err = { ok: false, error: "Evaluation not completed" };
      return NextResponse.json(payload, { status: 409 });
    }

    const payload: Ok = {
      ok: true,
      job_id: job.id,
      status: job.status,
      evaluation_result: job.evaluation_result,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const payload: Err = {
      ok: false,
      error: "Unexpected error",
      details: err instanceof Error ? err.message : "Unknown error",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}
