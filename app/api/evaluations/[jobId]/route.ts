// app/api/evaluations/[jobId]/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";

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
    // 1) Auth: dev header actor (test-mode only) OR production session
    const actor = getDevHeaderActor(req);
    let userId: string | null = null;

    if (actor) {
      // Dev-only user identity from x-user-id header
      userId = actor.userId;
    } else {
      // Production path: Supabase session cookie
      const user = await getAuthenticatedUser();
      userId = user?.id ?? null;
    }

    if (!userId) {
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
    if (job.created_by !== userId) {
      const payload: Err = { ok: false, error: "Forbidden" };
      return NextResponse.json(payload, { status: 403 });
    }

    // 4) Completion enforcement
    if (job.status !== "complete") {
      const payload: Err = { ok: false, error: "Evaluation not completed" };
      return NextResponse.json(payload, { status: 409 });
    }

    // 5) Read from evaluation_artifacts (canonical source for Flow 1)
    const { data: artifact, error: artifactError } = await supabase
      .from("evaluation_artifacts")
      .select("content")
      .eq("job_id", jobId)
      .eq("artifact_type", "one_page_summary")
      .maybeSingle();

    if (artifactError) {
      console.warn(`[evaluations/${jobId}] artifact lookup error:`, artifactError.message);
    }


    // 6) Fall back to evaluation_result on evaluation_jobs if no artifact found
    const evaluationResult = artifact?.content ?? job.evaluation_result ?? null;

    if (!evaluationResult) {
      const payload: Err = {
        ok: false,
        error: "Evaluation result not found",
        details: "Job completed but no evaluation result or artifact is available.",
      };
      return NextResponse.json(payload, { status: 404 });
    }

    const payload: Ok = {
      ok: true,
      job_id: job.id,
      status: job.status,
      evaluation_result: evaluationResult,
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
