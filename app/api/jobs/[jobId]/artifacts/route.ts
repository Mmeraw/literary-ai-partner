// app/api/jobs/[jobId]/artifacts/route.ts
// User-facing artifact endpoint with authentication
import { NextResponse } from "next/server";
import { canReleaseEvaluationRead } from "@/lib/jobs/readReleaseGate";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthorExposureDecision } from "@/lib/evaluation/authorExposureCertification";

type Params = { params: Promise<{ jobId: string }> };
type ManuscriptOwner = { user_id: string | null };
type EvaluationJobOwnerRow = {
  id: string;
  user_id: string | null;
  status: string;
  validity_status: string | null;
  last_error: string | null;
  progress: Record<string, unknown> | null;
  evaluation_result: unknown;
  manuscripts?: ManuscriptOwner | ManuscriptOwner[] | null;
};

// synthesis_status values surfaced to the client poller:
//   'complete' — longform_document_v1 artifact exists and contains longform_document
//   'failed'   — DreamWorker recorded a fatal error; no artifact written
//   'skipped'  — worker disabled, stub present, or skip explicitly requested
//   'pending'  — worker is enabled and still running
type SynthesisStatus = "pending" | "complete" | "skipped" | "failed";

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
      .select("id, user_id, status, validity_status, last_error, progress, evaluation_result, manuscripts!inner(user_id)")
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

    const exposureDecision = await getAuthorExposureDecision(admin, jobId);
    if (exposureDecision.exposable === false) {
      if (exposureDecision.reason === 'db_error') {
        console.error("[artifacts.GET] author_exposure DB error", {
          jobId,
          details: exposureDecision.details,
        });
        return NextResponse.json(
          { ok: false, error: "System error checking author exposure certification" },
          { status: 500 },
        );
      }
      return NextResponse.json({ ok: false, error: "Job not releasable" }, { status: 404 });
    }

    // Fetch the longform_document_v1 artifact for this specific job.
    // ISOLATION: We filter by both job_id AND artifact_type so that concurrent
    // evaluations from the same user never bleed into each other. Do NOT use
    // "latest by created_at" across all types — a user may have two jobs in
    // flight and the ordering across different artifact types is not meaningful.
    const { data: artifact, error } = await admin
      .from("evaluation_artifacts")
      .select("id, job_id, artifact_type, content, created_at")
      .eq("job_id", jobId)
      .eq("artifact_type", "longform_document_v1")
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

    // Verify the artifact actually contains a real document (not just a stub row).
    let artifactContent = artifact?.content as Record<string, unknown> | null | undefined;
    if (typeof artifactContent === "string") {
      try { artifactContent = JSON.parse(artifactContent); } catch { artifactContent = null; }
    }
    const hasLongformDocument =
      !!artifactContent &&
      typeof artifactContent === "object" &&
      typeof artifactContent.longform_document === "object" &&
      artifactContent.longform_document !== null;
    const isSkippedStub = artifactContent?._skipped === true;
    const skipRequested = job.progress?.synthesis_skip_requested === true;
    const workerDisabled = process.env.DREAM_WORKER_ENABLED === "false";
    const synthesisFailed =
      !hasLongformDocument &&
      typeof job.last_error === "string" &&
      /\[DreamWorker\]|preflight:/i.test(job.last_error);

    const synthesisStatus: SynthesisStatus = hasLongformDocument
      ? "complete"
      : synthesisFailed
      ? "failed"
      : isSkippedStub || skipRequested || workerDisabled
      ? "skipped"
      : "pending";

    return NextResponse.json({
      ok: true,
      artifact: hasLongformDocument ? artifact : null,
      synthesis_status: synthesisStatus,
    });
  } catch (error) {
    console.error("[artifacts.GET] Unexpected failure", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
