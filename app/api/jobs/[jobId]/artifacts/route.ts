// app/api/jobs/[jobId]/artifacts/route.ts
// User-facing artifact endpoint with authentication
import { NextResponse } from "next/server";
import { canReleaseEvaluationRead } from "@/lib/jobs/readReleaseGate";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ jobId: string }> };
type ManuscriptOwner = { user_id: string | null };
type EvaluationJobOwnerRow = {
  id: string;
  user_id: string | null;
  status: string;
  validity_status: string | null;
  evaluation_result: unknown;
  manuscripts?: ManuscriptOwner | ManuscriptOwner[] | null;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ ok: false, error: "Missing jobId" }, { status: 400 });
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Ownership check
    const { data: job, error: jobError } = await admin
      .from("evaluation_jobs")
      .select("id, user_id, status, validity_status, evaluation_result, manuscripts!inner(user_id)")
      .eq("id", jobId)
      .maybeSingle<EvaluationJobOwnerRow>();

    if (jobError) {
      console.error("[artifacts.GET] Failed to fetch job ownership context", {
        jobId,
        code: jobError.code,
        message: jobError.message,
      });
      return NextResponse.json(
        { ok: false, error: "Failed to fetch job context" },
        { status: 500 },
      );
    }

    if (!job) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    const manuscriptOwner = Array.isArray(job.manuscripts)
      ? (job.manuscripts[0] ?? null)
      : (job.manuscripts ?? null);
    const manuscriptOwnerId = manuscriptOwner?.user_id ?? null;
    const ownerUserId = job.user_id ?? manuscriptOwnerId;

    if (ownerUserId !== user.id && manuscriptOwnerId !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    if (!canReleaseEvaluationRead(job)) {
      return NextResponse.json({ ok: false, error: "Job not releasable" }, { status: 404 });
    }

    // Fetch latest artifact
    const { data: artifact, error } = await admin
      .from("evaluation_artifacts")
      .select("id, job_id, artifact_type, content, created_at")
      .eq("job_id", jobId)
      // .eq("artifact_type", "evaluation_result_v1") // enable if needed
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[artifacts.GET] Failed to fetch artifact", {
        jobId,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ ok: false, error: "Failed to fetch artifact" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      artifact: artifact ?? null,
    });
  } catch (error) {
    console.error("[artifacts.GET] Unexpected failure", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
