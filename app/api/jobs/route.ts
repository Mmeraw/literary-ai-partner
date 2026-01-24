import { NextResponse } from "next/server";
import { createJob, getAllJobs } from "@/lib/jobs/store";
import * as metrics from "@/lib/jobs/metrics";
import { checkJobCreationRateLimit, checkFeatureAccess, validateManuscriptSize, type RateLimitResult } from "@/lib/jobs/rateLimiter";
import "@/lib/jobs/config"; // Enforce production fail-safe on module load

function isRateLimited(
  result: RateLimitResult
): result is { allowed: false; reason: string; retryAfter?: number } {
  return result.allowed === false;
}

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

    // Layer 2: Manuscript size validation
    if (manuscript_size && typeof manuscript_size === "number") {
      const sizeCheck = validateManuscriptSize(manuscript_size);
      if (sizeCheck.allowed === false) {
        const { reason } = sizeCheck;
        return NextResponse.json(
          { ok: false, error: reason },
          { status: 413 } // Payload Too Large
        );
      }
    }

    // Layer 3: Feature access control (auth + subscription tier)
    // Extract user_id from request (to be implemented with proper auth)
    const userId = req.headers.get("x-user-id"); // Placeholder
    const featureAccess = await checkFeatureAccess(userId, job_type, user_tier);
    if (featureAccess.allowed === false) {
      const { reason } = featureAccess;
      return NextResponse.json(
        { ok: false, error: reason },
        { status: 403 } // Forbidden
      );
    }

    const job = await createJob({ manuscript_id, job_type });

    // Emit metrics
    metrics.onJobCreated(job.id, job_type);

    return NextResponse.json(
      { ok: true, job_id: job.id, status: job.status },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/jobs error:", err);
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}

export async function GET() {
  const jobs = await getAllJobs();
  return NextResponse.json({ jobs }, { status: 200 });
}
