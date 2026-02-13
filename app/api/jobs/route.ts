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

    const manuscript_id = body?.manuscript_id;
    const job_type = body?.job_type;
    const manuscript_size = body?.manuscript_size; // Size in bytes
    const user_tier = body?.user_tier as
      | "free"
      | "premium"
      | "agent"
      | undefined;

    if (!manuscript_id || !job_type) {
      logger.warn("Job creation validation failed", {
        trace_id,
        request_id,
        event: "api.jobs.create.validation_failed",
      });

      return NextResponse.json(
        { ok: false, error: "Missing required fields: manuscript_id, job_type", trace_id },
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

    // Layer 2: Manuscript size validation
    if (manuscript_size && typeof manuscript_size === "number") {
      const sizeCheck = validateManuscriptSize(manuscript_size);
      if (sizeCheck.allowed === false) {
        const { reason } = sizeCheck;
        logger.warn("Manuscript size validation failed", {
          trace_id,
          request_id,
          event: "api.jobs.create.size_validation_failed",
          manuscript_size,
          reason,
        });
        return NextResponse.json(
          { ok: false, error: reason, trace_id },
          { status: 413 } // Payload Too Large
        );
      }
    }

    // Layer 3: Feature access control (auth + subscription tier)
    const userId = req.headers.get("x-user-id");
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
