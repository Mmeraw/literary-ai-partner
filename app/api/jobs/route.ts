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

function isRateLimited(
  result: RateLimitResult
): result is { allowed: false; reason: string; retryAfter?: number } {
  return result.allowed === false;
}

const ALLOWED_JOB_TYPES = new Set<string>(Object.values(JOB_TYPES));

export async function POST(req: Request) {
  try {
    // Layer 1: Rate limit check (IP + user-based)
    const rateLimitResult = await checkJobCreationRateLimit(req);
    if (isRateLimited(rateLimitResult)) {
      const { reason, retryAfter } = rateLimitResult;
      return NextResponse.json(
        {
          ok: false,
          error: reason,
          retry_after: retryAfter ?? null,
        },
        { status: 429 } // Too Many Requests
      );
    }

    const body = await req.json();

    const manuscript_id = body?.manuscript_id;
    const job_type = body?.job_type;
    const manuscript_size = body?.manuscript_size; // Size in bytes
    const user_tier = body?.user_tier as "free" | "premium" | "agent" | undefined;

    if (!manuscript_id || !job_type) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: manuscript_id, job_type" },
        { status: 400 }
      );
    }

    // GOVERNANCE: job_type must be canonical (no phantom/unknown job types)
    if (typeof job_type !== "string" || !ALLOWED_JOB_TYPES.has(job_type)) {
      return NextResponse.json(
        { ok: false, error: "Invalid job_type" },
        { status: 400 }
      );
    }

    // Type assertion after validation (safe because ALLOWED_JOB_TYPES matches JobType)
    const validatedJobType = job_type as JobType;

    // Layer 2: Manuscript size validation
    if (manuscript_size && typeof manuscript_size === "number") {
      const sizeCheck = validateManuscriptSize(manuscript_size);
      if (sizeCheck.allowed === false) {
        const { reason } = sizeCheck;
        return NextResponse.json({ ok: false, error: reason }, { status: 413 }); // Payload Too Large
      }
    }

    // Layer 3: Feature access control (auth + subscription tier)
    // GOVERNANCE: do not fabricate user_id; if absent, pass null and let policy decide.
    const userId = req.headers.get("x-user-id");
    const featureAccess = await checkFeatureAccess(userId, validatedJobType, user_tier);
    if (featureAccess.allowed === false) {
      const { reason } = featureAccess;
      return NextResponse.json({ ok: false, error: reason }, { status: 403 }); // Forbidden
    }

    const job = await createJob({ manuscript_id, job_type: validatedJobType });

    // Emit metrics
    metrics.onJobCreated(job.id, validatedJobType);

    return NextResponse.json(
      { ok: true, job_id: job.id, status: job.status },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/jobs error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  const jobs = await getAllJobs();
  return NextResponse.json({ jobs }, { status: 200 });
}
