// app/api/jobs/[jobId]/artifacts/route.ts
// User-facing artifact endpoint with authentication
import { NextResponse } from "next/server";
import { canReleaseEvaluationRead } from "@/lib/jobs/readReleaseGate";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, { params }: Params) {
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
    .maybeSingle();

  if (jobError) {
    return NextResponse.json({ ok: false, error: jobError.message }, { status: 500 });
  }

  if (!job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const ownerId =
    typeof (job as { user_id?: unknown }).user_id === "string"
      ? ((job as { user_id?: string }).user_id ?? null)
      : null;
  const manuscriptOwnerId =
    (job as { manuscripts?: { user_id?: string } | Array<{ user_id?: string }> }).manuscripts &&
    !Array.isArray((job as { manuscripts?: unknown }).manuscripts)
      ? ((job as { manuscripts?: { user_id?: string } }).manuscripts?.user_id ?? null)
      : Array.isArray((job as { manuscripts?: Array<{ user_id?: string }> }).manuscripts)
        ? ((job as { manuscripts?: Array<{ user_id?: string }> }).manuscripts?.[0]?.user_id ?? null)
        : null;

  if (ownerId !== user.id && manuscriptOwnerId !== user.id) {
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    artifact: artifact ?? null,
  });
}
