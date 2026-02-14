import { NextResponse } from "next/server";
import { createJob, getAllJobs } from "@/lib/jobs/store";
import * as metrics from "@/lib/jobs/metrics";
import {
  checkJobCreationRateLimit,
  checkFeatureAccess,
  validateManuscriptSize,
  type RateLimitResult,
} from "@/lib/jobs/rateLimiter";
import { JOB_TYPES, type JobType } from "@/lib/jobs/types";
import { generateTraceId, logger, jobLogger } from "@/lib/observability/logger";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isRateLimited(
  result: RateLimitResult
): result is { allowed: false; reason: string; retryAfter?: number } {
  return result.allowed === false;
}

const ALLOWED_JOB_TYPES = new Set<string>(Object.values(JOB_TYPES));

export async function POST(req: Request) {
  const trace_id = generateTraceId();
  const request_id = generateTraceId();

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

    let manuscript_id = body?.manuscript_id;
    const job_type = body?.job_type;
    const manuscript_text = body?.manuscript_text;
    const manuscript_title = body?.manuscript_title;
    const manuscript_size = body?.manuscript_size; // Size in bytes
    const user_tier = body?.user_tier as
      | "free"
      | "premium"
      | "agent"
      | undefined;

    if (!manuscript_id && !manuscript_text) {
      logger.warn("Job creation validation failed", {
        trace_id,
        request_id,
        event: "api.jobs.create.validation_failed",
      });

      return NextResponse.json(
        { ok: false, error: "Missing required fields: manuscript_id or manuscript_text", trace_id },
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
        return NextResponse.json(
          { ok: false, error: reason, trace_id },
          { status: 413 } // Payload Too Large
        );
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
      const fileSize = new TextEncoder().encode(trimmedText).length;

      const supabaseAdmin = createAdminClient();
      const { data: manuscript, error: manuscriptError } = await supabaseAdmin
        .from("manuscripts")
        .insert({
          title: typeof manuscript_title === "string" && manuscript_title.trim()
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
    }
    const featureAccess = await checkFeatureAccess(
      userId,
      validatedJobType,
      user_tier
    );

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
      return NextResponse.json(
        { ok: false, error: reason, trace_id },
        { status: 403 } // Forbidden
      );
    }

    const job = await createJob({
      manuscript_id,
      user_id: userId,
      job_type: validatedJobType,
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

    logger.info("Job created successfully", {
      trace_id,
      request_id,
      event: "api.jobs.create.success",
      job_id: job.id,
      job_type: validatedJobType,
    });

    return NextResponse.json(
      { ok: true, job_id: job.id, status: job.status, trace_id },
      { status: 201 }
    );
  } catch (err) {
    logger.error("Job creation error", {
      trace_id,
      request_id,
      event: "api.jobs.create.error",
      error: err instanceof Error ? err.message : String(err),
    });

    console.error("POST /api/jobs error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body",
        details: err instanceof Error ? err.message : String(err),
        trace_id,
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  const trace_id = generateTraceId();
  const request_id = crypto.randomUUID();

  try {
    logger.info("GET /api/jobs request received", {
      trace_id,
      request_id,
      event: "api.jobs.list.request",
    });

    const jobs = await getAllJobs();

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
