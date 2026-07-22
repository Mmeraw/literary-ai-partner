// app/api/evaluations/[jobId]/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";
import { getEvaluationReleaseDecision } from "@/lib/jobs/readReleaseGate";
import { getAuthorExposureDecision, publicAuthorExposureBlockDetail } from "@/lib/evaluation/authorExposureCertification";
import { enforceApiRateLimit } from "@/lib/security/apiRateLimit";
import { requireUser } from "@/lib/security/apiGuards";

type Ok = {
  ok: true;
  job_id: string;
  status: string;
  evaluation_result: unknown;
  source: "artifact" | "inline_job_result";
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
    const rateLimitDenied = enforceApiRateLimit(req, {
      bucket: "evaluation_read",
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimitDenied) return rateLimitDenied;

    // 1) Auth: dev header actor (test-mode only) OR production session
    const actor = getDevHeaderActor(req);
    let userId: string | null = null;

    if (actor) {
      // Dev-only user identity from x-user-id header
      userId = actor.userId;
    } else {
      const auth = await requireUser();
      if (auth.ok === false) return auth.response;
      userId = auth.user.id;
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
      .select("id,user_id,status,validity_status,evaluation_result,manuscripts(user_id)")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      const payload: Err = {
        ok: false,
        error: "Failed to load job",
      };
      return NextResponse.json(payload, { status: 500 });
    }

    if (!job) {
      const payload: Err = { ok: false, error: "Job not found" };
      return NextResponse.json(payload, { status: 404 });
    }

    // 3) Ownership enforcement (service-role bypasses RLS; enforce explicitly)
    const ownerUserId =
      (job as any)?.user_id ??
      ((job as any)?.manuscripts?.user_id ??
        (Array.isArray((job as any)?.manuscripts)
          ? (job as any).manuscripts[0]?.user_id
          : null));

    if (!ownerUserId || ownerUserId !== userId) {
      const payload: Err = { ok: false, error: "Job not found" };
      return NextResponse.json(payload, { status: 404 });
    }

    // 4) Fail-closed release gate (complete + valid + confidence policy)
    const releaseDecision = getEvaluationReleaseDecision(job);
    if (releaseDecision.releasable === false) {
      const payload: Err = {
        ok: false,
        error: "Evaluation not releasable",
        details: releaseDecision.reason,
      };
      return NextResponse.json(payload, { status: 409 });
    }

    const exposureDecision = await getAuthorExposureDecision(supabase, jobId);
    if (exposureDecision.exposable === false) {
      const isSystemError = exposureDecision.reason === 'db_error';
      const payload: Err = {
        ok: false,
        error: isSystemError ? 'System error checking author exposure certification' : 'Evaluation not releasable',
        details: publicAuthorExposureBlockDetail(exposureDecision),
      };
      return NextResponse.json(payload, { status: isSystemError ? 500 : 409 });
    }

    // 5) Read from evaluation_artifacts (canonical source)
    // Try evaluation_result_v2 first (current pipeline), then one_page_summary (legacy)
    let artifactContent: unknown = null;

    for (const artifactType of ["evaluation_result_v2", "one_page_summary"] as const) {
      const { data: artifact, error: err } = await supabase
        .from("evaluation_artifacts")
        .select("content")
        .eq("job_id", jobId)
        .eq("artifact_type", artifactType)
        .maybeSingle();

      if (err) {
        console.warn(`[evaluations/${jobId}] artifact lookup error (${artifactType}):`, err.message);
        continue;
      }

      if (artifact?.content) {
        artifactContent = artifact.content;
        break;
      }
    }

    // 6) Fall back to evaluation_result on evaluation_jobs if no artifact found
    const fromArtifact = !!artifactContent;
    const evaluationResult = fromArtifact
      ? artifactContent
      : (job.evaluation_result ?? null);
    const source: "artifact" | "inline_job_result" = fromArtifact
      ? "artifact"
      : "inline_job_result";

    if (!evaluationResult) {
      const payload: Err = {
        ok: false,
        error: "Evaluation result not found",
      };
      return NextResponse.json(payload, { status: 404 });
    }

    const payload: Ok = {
      ok: true,
      job_id: job.id,
      status: job.status,
      evaluation_result: evaluationResult,
      source,
    };
    return NextResponse.json(payload, { status: 200 });
  } catch {
    const payload: Err = {
      ok: false,
      error: "Unexpected error",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}
