import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

const CANONICAL_STATUSES = ["queued", "running", "complete", "failed"] as const;

function isCanonicalStatus(value: unknown): value is (typeof CANONICAL_STATUSES)[number] {
  return (
    typeof value === "string" &&
    (CANONICAL_STATUSES as readonly string[]).includes(value)
  );
}

export async function GET(req: NextRequest, context: RouteContext) {
  // Admin gate: dev header actor (test-mode only) OR production admin session
  const actor = getDevHeaderActor(req);
  if (!actor?.isAdmin) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  try {
    const { jobId } = await context.params;
    const includeArtifactContent = req.nextUrl.searchParams.get("include_artifact_content") === "1";
    const includeInlineResult = req.nextUrl.searchParams.get("include_inline_result") === "1";

    const supabase = createAdminClient();

    const { data: job, error: jobError } = await supabase
      .from("evaluation_jobs")
      .select(
        "id,user_id,manuscript_id,job_type,status,phase,phase_status,progress,total_units,completed_units,failed_units,last_error,failure_code,created_at,updated_at,evaluation_result"
      )
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      console.error(`[Admin Job Detail] job query error for ${jobId}:`, jobError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch job", details: jobError.message },
        { status: 500 }
      );
    }

    if (!job) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    if (!isCanonicalStatus(job.status)) {
      console.error(`[Admin Job Detail] Non-canonical status detected for ${jobId}:`, job.status);
      return NextResponse.json(
        { ok: false, error: "Invalid job state" },
        { status: 500 }
      );
    }

    const artifactSelect = includeArtifactContent
      ? "id,job_id,artifact_type,content,created_at"
      : "id,job_id,artifact_type,created_at";

    const { data: artifacts, error: artifactError } = await supabase
      .from("evaluation_artifacts")
      .select(artifactSelect)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (artifactError) {
      console.error(`[Admin Job Detail] artifact query error for ${jobId}:`, artifactError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch job artifacts", details: artifactError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        user_id: job.user_id,
        manuscript_id: job.manuscript_id,
        job_type: job.job_type,
        status: job.status,
        phase: job.phase,
        phase_status: job.phase_status,
        progress: job.progress,
        total_units: job.total_units,
        completed_units: job.completed_units,
        failed_units: job.failed_units,
        last_error: job.last_error,
        failure_code: job.failure_code,
        created_at: job.created_at,
        updated_at: job.updated_at,
        ...(includeInlineResult ? { evaluation_result: job.evaluation_result } : {}),
      },
      artifacts: artifacts ?? [],
      observability: {
        include_artifact_content: includeArtifactContent,
        include_inline_result: includeInlineResult,
      },
    });
  } catch (err) {
    console.error("[Admin Job Detail] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}