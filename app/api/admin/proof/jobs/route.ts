import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJob } from "@/lib/jobs/store";
import { JOB_TYPES, type JobType } from "@/lib/jobs/types";
import { generateTraceId, jobLogger, logger } from "@/lib/observability/logger";
import { emitLatencyTrace } from "@/lib/observability/latencyTrace";
import { triggerEvaluationWorker } from "@/lib/jobs/triggerWorker";

const ALLOWED_JOB_TYPES = new Set<string>(Object.values(JOB_TYPES));

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isAuthorizedProofRequest(req: Request): boolean {
  const configuredSecret = process.env.PROOF_RUN_SECRET;
  if (!configuredSecret) {
    return false;
  }

  const presentedSecret = bearerToken(req);
  return presentedSecret === configuredSecret;
}

export async function POST(req: Request) {
  const trace_id = generateTraceId();
  const request_id = generateTraceId();

  if (process.env.NODE_ENV === "production" && process.env.USE_SUPABASE_JOBS !== "true") {
    logger.error("Proof job creation blocked: Supabase jobs disabled in production", {
      trace_id,
      request_id,
      event: "api.admin.proof.jobs.production_memory_store_blocked",
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Server misconfiguration: USE_SUPABASE_JOBS must be true in production.",
        trace_id,
      },
      { status: 503 },
    );
  }

  if (!isAuthorizedProofRequest(req)) {
    logger.warn("Proof job creation blocked: missing or invalid proof secret", {
      trace_id,
      request_id,
      event: "api.admin.proof.jobs.auth_failed",
    });

    return NextResponse.json(
      { ok: false, error: "Unauthorized proof job request", trace_id },
      { status: 401 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const manuscriptText = typeof body?.manuscript_text === "string" ? body.manuscript_text.trim() : "";
    const manuscriptTitle =
      typeof body?.manuscript_title === "string" && body.manuscript_title.trim()
        ? body.manuscript_title.trim()
        : "U2 Proof Manuscript";
    const requestedJobType = typeof body?.job_type === "string" ? body.job_type : JOB_TYPES.EVALUATE_FULL;
    const proofUserId =
      typeof body?.proof_user_id === "string" && body.proof_user_id.trim()
        ? body.proof_user_id.trim()
        : process.env.PROOF_RUN_USER_ID ?? null;

    if (!proofUserId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing proof user id: provide proof_user_id or configure PROOF_RUN_USER_ID.",
          trace_id,
        },
        { status: 400 },
      );
    }

    if (!manuscriptText) {
      return NextResponse.json(
        { ok: false, error: "manuscript_text is required", trace_id },
        { status: 400 },
      );
    }

    if (!ALLOWED_JOB_TYPES.has(requestedJobType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid job_type", trace_id },
        { status: 400 },
      );
    }

    const jobType = requestedJobType as JobType;
    const fileSize = new TextEncoder().encode(manuscriptText).length;
    const wordCount = manuscriptText.split(/\s+/).filter(Boolean).length;
    const fileUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(manuscriptText)}`;

    const supabaseAdmin = createAdminClient();
    const { data: manuscript, error: manuscriptError } = await supabaseAdmin
      .from("manuscripts")
      .insert({
        title: manuscriptTitle,
        user_id: proofUserId,
        created_by: proofUserId,
        file_url: fileUrl,
        file_size: fileSize,
        work_type: "novel",
        tone_context: "neutral",
        mood_context: "calm",
        voice_mode: "balanced",
        storygate_linked: false,
        allow_industry_discovery: false,
        is_final: false,
        source: "proof_admin",
        english_variant: "us",
        word_count: wordCount,
      })
      .select("id")
      .single();

    if (manuscriptError || !manuscript) {
      logger.error("Proof job manuscript insert failed", {
        trace_id,
        request_id,
        event: "api.admin.proof.jobs.manuscript_error",
        error: manuscriptError?.message,
      });

      return NextResponse.json(
        { ok: false, error: "Failed to create proof manuscript", trace_id },
        { status: 500 },
      );
    }

    const job = await createJob({
      manuscript_id: manuscript.id,
      user_id: proofUserId,
      job_type: jobType,
    });

    const jobAcceptedAt = new Date().toISOString();
    emitLatencyTrace({
      job_id: job.id,
      stage: "job_create",
      state: "accepted",
      started_at: jobAcceptedAt,
      metadata: {
        source: "api.admin.proof.jobs.create",
        job_type: jobType,
      },
    });

    jobLogger.created(job.id, jobType, {
      trace_id,
      request_id,
      manuscript_id: manuscript.id,
      user_id: proofUserId,
      proof_run: true,
    });

    const kickoffDispatchStartedAt = new Date().toISOString();
    emitLatencyTrace({
      job_id: job.id,
      stage: "worker_kickoff",
      state: "dispatch_started",
      started_at: kickoffDispatchStartedAt,
      metadata: {
        source: "api.admin.proof.jobs.create",
      },
    });

    void triggerEvaluationWorker({
      req,
      jobId: job.id,
      trace_id,
      request_id,
      source: "api.admin.proof.jobs.create",
      kickoffDispatchStartedAt,
    });

    logger.info("Proof job created successfully", {
      trace_id,
      request_id,
      event: "api.admin.proof.jobs.success",
      job_id: job.id,
      manuscript_id: manuscript.id,
      job_type: jobType,
    });

    return NextResponse.json(
      {
        ok: true,
        job_id: job.id,
        manuscript_id: manuscript.id,
        status: job.status,
        trace_id,
      },
      { status: 201 },
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    logger.error("Proof job creation error", {
      trace_id,
      request_id,
      event: "api.admin.proof.jobs.error",
      error: details,
    });

    return NextResponse.json(
      { ok: false, error: "Failed to create proof job", details, trace_id },
      { status: 500 },
    );
  }
}
