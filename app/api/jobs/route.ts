import { NextResponse } from "next/server";
import { createJob, getAllJobs } from "@/lib/jobs/store";
import * as metrics from "@/lib/jobs/metrics";
import {
  checkJobCreationRateLimit,
  checkFeatureAccess,
  validateManuscriptSize,
  type RateLimitResult,
} from "@/lib/jobs/rateLimiter";
import { JOB_TYPES, isEvaluationJobType, type JobType } from "@/lib/jobs/types";
import { generateTraceId, logger, jobLogger } from "@/lib/observability/logger";
import { emitLatencyTrace } from "@/lib/observability/latencyTrace";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { backpressureGuard } from "@/lib/jobs/backpressure";
import { triggerEvaluationWorker } from "@/lib/jobs/triggerWorker";

function isRateLimited(
  result: RateLimitResult
): result is { allowed: false; reason: string; retryAfter?: number } {
  return result.allowed === false;
}

const ALLOWED_JOB_TYPES = new Set<string>(Object.values(JOB_TYPES));
const SHORT_FORM_PHASE0_FAST_TRACK_WORDS = 25_000;

function normalizeWordCountCandidate(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

async function readOwnedManuscriptWordCount(params: {
  manuscriptId: number;
  userId: string;
  trace_id: string;
  request_id: string;
}): Promise<number | null> {
  try {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("manuscripts")
      .select("word_count")
      .eq("id", params.manuscriptId)
      .eq("user_id", params.userId)
      .maybeSingle();

    if (error) {
      logger.warn("Failed to read manuscript word count for evaluation intake", {
        trace_id: params.trace_id,
        request_id: params.request_id,
        event: "api.jobs.create.manuscript_word_count_lookup_failed",
        manuscript_id: params.manuscriptId,
        error: error.message,
      });
      return null;
    }

    return normalizeWordCountCandidate(data?.word_count);
  } catch (error) {
    logger.warn("Failed to read manuscript word count for evaluation intake", {
      trace_id: params.trace_id,
      request_id: params.request_id,
      event: "api.jobs.create.manuscript_word_count_lookup_exception",
      manuscript_id: params.manuscriptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function seedJobIntakeProgress(params: {
  job: { id: string; progress?: Record<string, unknown> | null };
  manuscriptWordCount: number | null;
  fastTrackPhase0: boolean;
  trace_id: string;
  request_id: string;
  manuscript_id: number | string;
}): Promise<void> {
  if (params.manuscriptWordCount === null && !params.fastTrackPhase0) return;

  const supabaseAdmin = createAdminClient();
  const now = new Date().toISOString();
  const existingProgress = (params.job.progress ?? {}) as Record<string, unknown>;
  const existingChunkRoutingRaw = existingProgress["chunk_routing"];
  const existingChunkRouting =
    existingChunkRoutingRaw && typeof existingChunkRoutingRaw === "object"
      ? (existingChunkRoutingRaw as Record<string, unknown>)
      : {};

  const nextProgress: Record<string, unknown> = {
    ...existingProgress,
    ...(params.manuscriptWordCount !== null
      ? {
          manuscript_word_count: params.manuscriptWordCount,
          chunk_routing: {
            ...existingChunkRouting,
            manuscript_words: params.manuscriptWordCount,
            source_manuscript_words: params.manuscriptWordCount,
          },
        }
      : {}),
  };

  const updatePayload: Record<string, unknown> = {
    progress: nextProgress,
    updated_at: now,
  };

  if (params.fastTrackPhase0) {
    Object.assign(nextProgress, {
      phase: "phase_1a",
      phase_status: "queued",
      message: "Short-form evaluation queued — using short-form criteria policy fast path",
      phase0_fast_track: true,
      phase0_fast_track_reason: "short_form_under_25000_words",
      phase0_started_at: now,
      phase0_completed_at: now,
      phase0_total_duration_ms: 0,
      phase0_measured_duration_ms: 0,
      phase0_llm_duration_ms: 0,
      phase0_dwell_duration_ms: 0,
      phase0_calibration_word_count: params.manuscriptWordCount ?? null,
      phase0_proof_normalized: true,
      total_units: 100,
      completed_units: 8,
    });

    Object.assign(updatePayload, {
      phase: "phase_1a",
      phase_status: "queued",
    });
  }

  const { error } = await supabaseAdmin
    .from("evaluation_jobs")
    .update(updatePayload)
    .eq("id", params.job.id);

  if (error) {
    logger.warn("Failed to seed evaluation job intake progress", {
      trace_id: params.trace_id,
      request_id: params.request_id,
      event: "api.jobs.create.intake_progress_seed_failed",
      job_id: params.job.id,
      manuscript_id: params.manuscript_id,
      manuscript_word_count: params.manuscriptWordCount,
      fast_track_phase0: params.fastTrackPhase0,
      error: error.message,
    });
    return;
  }

  if (params.fastTrackPhase0) {
    logger.info("Short-form evaluation fast-tracked past Phase 0", {
      trace_id: params.trace_id,
      request_id: params.request_id,
      event: "api.jobs.create.phase0_fast_track",
      job_id: params.job.id,
      manuscript_id: params.manuscript_id,
      manuscript_word_count: params.manuscriptWordCount,
    });
  }
}

export async function POST(req: Request) {
  const trace_id = generateTraceId();
  const request_id = generateTraceId();

  if (process.env.NODE_ENV === "production" && process.env.USE_SUPABASE_JOBS !== "true") {
    logger.error("Production misconfiguration: memory store disabled", {
      trace_id,
      request_id,
      event: "api.jobs.create.production_memory_store_blocked",
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          "Server misconfiguration: USE_SUPABASE_JOBS must be true in production.",
        trace_id,
      },
      { status: 503 }
    );
  }

  logger.info("Job creation request received", {
    trace_id,
    request_id,
    event: "api.jobs.create.start",
  });

  try {
    // Layer 1: Rate limit check (IP + user-based)
    const rateLimitResult = await checkJobCreationRateLimit(req);
    if (isRateLimited(rateLimitResult)) {
      const { reason, retryAfter } = rateLimitResult;

      logger.warn("Job creation rate limited", {
        trace_id,
        request_id,
        event: "api.jobs.create.rate_limited",
        reason,
      });

      return NextResponse.json(
        {
          ok: false,
          error: reason,
          retry_after: retryAfter ?? null,
          trace_id,
        },
        { status: 429 } // Too Many Requests
      );
    }

    const body = await req.json();
    const processing_terms_accepted = body?.processing_terms_accepted;

    let manuscript_id = body?.manuscript_id;
    const job_type = body?.job_type;
    const manuscript_text = body?.manuscript_text;
    const manuscript_title = body?.manuscript_title;
    const manuscript_size = body?.manuscript_size; // Size in bytes
    const user_tier = body?.user_tier as "free" | "premium" | "agent" | undefined;
    let immediateManuscriptWordCount: number | null = null;
    let resolvedManuscriptWordCount: number | null = null;

    if (!manuscript_id && !manuscript_text) {
      logger.warn("Job creation validation failed", {
        trace_id,
        request_id,
        event: "api.jobs.create.validation_failed",
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: manuscript_id or manuscript_text",
          trace_id,
        },
        { status: 400 }
      );
    }

    // Reject ambiguous input: both manuscript_id and manuscript_text together creates
    // a silent staleness hazard — the existing row would be used and the submitted text
    // ignored without any error, causing the wrong manuscript to be evaluated.
    if (
      manuscript_id !== undefined &&
      manuscript_id !== null &&
      typeof manuscript_text === "string" &&
      manuscript_text.trim().length > 0
    ) {
      logger.warn("Job creation validation failed: ambiguous manuscript input", {
        trace_id,
        request_id,
        event: "api.jobs.create.ambiguous_manuscript_input",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "Ambiguous manuscript source: provide either manuscript_id or manuscript_text, not both.",
          trace_id,
        },
        { status: 400 }
      );
    }

    if (!job_type) {
      logger.warn("Job creation validation failed", {
        trace_id,
        request_id,
        event: "api.jobs.create.validation_failed",
      });

      return NextResponse.json(
        { ok: false, error: "Missing required fields: job_type", trace_id },
        { status: 400 }
      );
    }

    // GOVERNANCE: job_type must be canonical (no phantom/unknown job types)
    if (typeof job_type !== "string" || !ALLOWED_JOB_TYPES.has(job_type)) {
      logger.warn("Invalid job_type", {
        trace_id,
        request_id,
        event: "api.jobs.create.invalid_job_type",
        job_type,
      });

      return NextResponse.json(
        { ok: false, error: "Invalid job_type", trace_id },
        { status: 400 }
      );
    }

    const validatedJobType = job_type as JobType;

    if (isEvaluationJobType(validatedJobType) && processing_terms_accepted !== true) {
      logger.warn("Job creation validation failed: processing terms acknowledgement missing", {
        trace_id,
        request_id,
        event: "api.jobs.create.processing_terms_ack_missing",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "Please acknowledge that RevisionGrade evaluations are custom digital services and that processing begins after submission.",
          trace_id,
        },
        { status: 400 }
      );
    }

    const resolvedManuscriptSize =
      typeof manuscript_size === "number"
        ? manuscript_size
        : typeof manuscript_text === "string"
        ? new TextEncoder().encode(manuscript_text).length
        : undefined;

    // Layer 2: Manuscript size validation
    if (resolvedManuscriptSize && typeof resolvedManuscriptSize === "number") {
      const sizeCheck = validateManuscriptSize(resolvedManuscriptSize);
      if (sizeCheck.allowed === false) {
        const { reason } = sizeCheck;
        logger.warn("Manuscript size validation failed", {
          trace_id,
          request_id,
          event: "api.jobs.create.size_validation_failed",
          manuscript_size: resolvedManuscriptSize,
          reason,
        });
        return NextResponse.json({ ok: false, error: reason, trace_id }, { status: 413 }); // Payload Too Large
      }
    }

    // Layer 3: Feature access control (auth + subscription tier)
    const authenticatedUser = await getAuthenticatedUser();
    const userId =
      authenticatedUser?.id ??
      (process.env.ALLOW_HEADER_USER_ID === "true"
        ? req.headers.get("x-user-id")
        : null);

    if (!userId) {
      logger.warn("Job creation blocked: missing authenticated user", {
        trace_id,
        request_id,
        event: "api.jobs.create.auth_missing",
      });

      return NextResponse.json(
        { ok: false, error: "Authentication required for this feature.", trace_id },
        { status: 401 }
      );
    }

    if (!manuscript_id && typeof manuscript_text === "string") {
      const trimmedText = manuscript_text.trim();
      if (trimmedText.length === 0) {
        return NextResponse.json(
          { ok: false, error: "manuscript_text cannot be empty", trace_id },
          { status: 400 }
        );
      }

      const encodedText = encodeURIComponent(trimmedText);
      const fileUrl = `data:text/plain;charset=utf-8,${encodedText}`;
      const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;
      immediateManuscriptWordCount = wordCount;
      resolvedManuscriptWordCount = wordCount;
      const fileSize = new TextEncoder().encode(trimmedText).length;

      const supabaseAdmin = createAdminClient();
      const { data: manuscript, error: manuscriptError } = await supabaseAdmin
        .from("manuscripts")
        .insert({
          title:
            typeof manuscript_title === "string" && manuscript_title.trim()
              ? manuscript_title.trim()
              : "Untitled Manuscript",
          user_id: userId,
          created_by: userId,
          file_url: fileUrl,
          file_size: fileSize,
          work_type: "novel",
          tone_context: "neutral",
          mood_context: "calm",
          voice_mode: "balanced",
          storygate_linked: false,
          allow_industry_discovery: false,
          is_final: false,
          source: "paste",
          english_variant: "us",
          word_count: wordCount,
        })
        .select("id")
        .single();

      if (manuscriptError || !manuscript) {
        logger.error("Failed to create manuscript", {
          trace_id,
          request_id,
          event: "api.jobs.create.manuscript_error",
          error: manuscriptError?.message,
        });

        return NextResponse.json(
          { ok: false, error: "Failed to create manuscript", trace_id },
          { status: 500 }
        );
      }

      manuscript_id = manuscript.id;
    }

    if (typeof manuscript_id === "string") {
      const trimmedId = manuscript_id.trim();
      const parsedId = Number.parseInt(trimmedId, 10);
      if (Number.isNaN(parsedId) || String(parsedId) !== trimmedId) {
        return NextResponse.json(
          { ok: false, error: "Invalid manuscript_id: must be numeric", trace_id },
          { status: 400 }
        );
      }
      manuscript_id = parsedId;
    }

    if (resolvedManuscriptWordCount === null && typeof manuscript_id === "number") {
      resolvedManuscriptWordCount = await readOwnedManuscriptWordCount({
        manuscriptId: manuscript_id,
        userId,
        trace_id,
        request_id,
      });
    }

    const featureAccess = await checkFeatureAccess(userId, validatedJobType, user_tier);

    if (featureAccess.allowed === false) {
      const { reason } = featureAccess;
      logger.warn("Feature access denied", {
        trace_id,
        request_id,
        event: "api.jobs.create.access_denied",
        user_id: userId,
        job_type: validatedJobType,
        reason,
      });
      return NextResponse.json({ ok: false, error: reason, trace_id }, { status: 403 }); // Forbidden
    }

    // Layer 4: Backpressure check (Day 2 A5)
    const backpressureBlock = await backpressureGuard();
    if (backpressureBlock) {
      logger.warn("Job creation blocked by backpressure", {
        trace_id,
        request_id,
        event: "api.jobs.create.backpressure_blocked",
        queue_depth: backpressureBlock.queueDepth,
      });
      return NextResponse.json(
        {
          ok: false,
          error: backpressureBlock.error,
          code: backpressureBlock.code,
          retry_after: backpressureBlock.retryAfter,
          trace_id,
        },
        {
          status: 503, // Service Unavailable
          headers: { "retry-after": String(backpressureBlock.retryAfter) },
        }
      );
    }

    const job = await createJob({
      manuscript_id,
      user_id: userId,
      job_type: validatedJobType,
    });

    const shouldFastTrackPhase0 =
      isEvaluationJobType(validatedJobType) &&
      resolvedManuscriptWordCount !== null &&
      resolvedManuscriptWordCount < SHORT_FORM_PHASE0_FAST_TRACK_WORDS;

    await seedJobIntakeProgress({
      job,
      manuscriptWordCount: resolvedManuscriptWordCount ?? immediateManuscriptWordCount,
      fastTrackPhase0: shouldFastTrackPhase0,
      trace_id,
      request_id,
      manuscript_id,
    });

    const jobAcceptedAt = new Date().toISOString();
    emitLatencyTrace({
      job_id: job.id,
      stage: "job_create",
      state: "accepted",
      started_at: jobAcceptedAt,
      metadata: {
        source: "api.jobs.create",
        job_type: validatedJobType,
        manuscript_word_count: resolvedManuscriptWordCount,
        phase0_fast_track: shouldFastTrackPhase0,
      },
    });

    // Emit observability events
    jobLogger.created(job.id, validatedJobType, {
      trace_id,
      request_id,
      manuscript_id,
      user_id: userId,
    });

    // Emit metrics
    metrics.onJobCreated(job.id, validatedJobType);

    // Belt-and-suspenders dispatch: cron remains the recovery path, while this
    // immediate kickoff prevents preview/local orphaned queued jobs.
    const kickoffDispatchStartedAt = new Date().toISOString();
    emitLatencyTrace({
      job_id: job.id,
      stage: "worker_kickoff",
      state: "dispatch_started",
      started_at: kickoffDispatchStartedAt,
      metadata: {
        source: "api.jobs.create",
        phase0_fast_track: shouldFastTrackPhase0,
      },
    });
    void triggerEvaluationWorker({
      req,
      jobId: job.id,
      trace_id,
      request_id,
      source: "api.jobs.create",
      kickoffDispatchStartedAt,
    });

    logger.info("Job created successfully", {
      trace_id,
      request_id,
      event: "api.jobs.create.success",
      job_id: job.id,
      job_type: validatedJobType,
      manuscript_word_count: resolvedManuscriptWordCount,
      phase0_fast_track: shouldFastTrackPhase0,
    });

    return NextResponse.json(
      {
        ok: true,
        job_id: job.id,
        status: job.status,
        manuscript_word_count: resolvedManuscriptWordCount,
        phase0_fast_track: shouldFastTrackPhase0,
        trace_id,
      },
      { status: 201 }
    );
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    const looksLikeJsonParseError =
      err instanceof SyntaxError || /json/i.test(details);
    const looksLikeDuplicateActiveJobConflict =
      /duplicate key value violates unique constraint/i.test(details) &&
      /uq_eval_jobs_active_phase1(_worktype)?/i.test(details);

    logger.error("Job creation error", {
      trace_id,
      request_id,
      event: "api.jobs.create.error",
      error: details,
      error_type: looksLikeJsonParseError
        ? "client_json"
        : looksLikeDuplicateActiveJobConflict
        ? "active_job_conflict"
        : "system",
    });

    console.error("POST /api/jobs error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: looksLikeJsonParseError
          ? "Invalid JSON body"
          : looksLikeDuplicateActiveJobConflict
          ? "An evaluation is already running or queued for this manuscript. Please wait for it to finish or use a different manuscript."
          : "Failed to create job",
        details,
        trace_id,
      },
      {
        status: looksLikeJsonParseError
          ? 400
          : looksLikeDuplicateActiveJobConflict
          ? 409
          : 500,
      }
    );
  }
}

export async function GET() {
  const trace_id = generateTraceId();
  const request_id = crypto.randomUUID();

  if (process.env.NODE_ENV === "production" && process.env.USE_SUPABASE_JOBS !== "true") {
    logger.error("Production misconfiguration: memory store disabled", {
      trace_id,
      request_id,
      event: "api.jobs.list.production_memory_store_blocked",
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          "Server misconfiguration: USE_SUPABASE_JOBS must be true in production.",
        trace_id,
      },
      { status: 503 }
    );
  }

  // Auth gate — only return jobs belonging to the authenticated user
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    logger.info("GET /api/jobs request received", {
      trace_id,
      request_id,
      event: "api.jobs.list.request",
      user_id: userId,
    });

    const jobs = await getAllJobs(userId);

    logger.info("Jobs retrieved", {
      trace_id,
      request_id,
      event: "api.jobs.list.success",
      job_count: jobs.length,
    });

    return NextResponse.json({ jobs, trace_id }, { status: 200 });
  } catch (err) {
    logger.error("GET /api/jobs error", {
      trace_id,
      request_id,
      event: "api.jobs.list.error",
      error: err instanceof Error ? err.message : String(err),
    });

    console.error("GET /api/jobs error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Jobs endpoint failure",
        details: err instanceof Error ? err.message : String(err),
        trace_id,
      },
      { status: 500 }
    );
  }
}
