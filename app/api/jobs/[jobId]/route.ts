import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { getAuthenticatedUser } from "@/lib/supabase/server";

type Params = Promise<{ jobId: string }>;

/**
 * GET /api/jobs/[jobId]
 *
 * Canonical job status endpoint (per JOBCONTRACT_v1).
 *
 * Response (success):
 *   { ok: true, job: { id, status, progress, created_at, updated_at, last_error?, failure_code? } }
 *
 * Response (failure):
 *   { ok: false, error: string } with status 401|404|500
 *
 * Status values: "queued" | "running" | "complete" | "failed" (LOCKED)
 * Progress: percentage 0-100
 * last_error: present only when status === "failed"
 * failure_code: present only when status === "failed" and a code is available
 */
type CanonicalJobResponse = {
  id: string;
  status: "queued" | "running" | "complete" | "failed";
  progress: number; // 0-100
  created_at: string;
  updated_at: string;
  last_error?: string;
  failure_code?: string;
};

export async function GET(req: NextRequest, ctx: { params: Params }) {
  try {
    const { jobId } = await ctx.params;

    // 1) Resolve caller identity.
    // Production path: authenticated session user.
    // Evidence/test path: optional x-user-id header only when explicitly enabled.
    const devHeaderMode =
      process.env.TEST_MODE === "true" &&
      process.env.ALLOW_HEADER_USER_ID === "true";

    const headerOwnerId = devHeaderMode
      ? req.headers.get("x-user-id")?.trim() ?? null
      : null;

    const sessionUser = await getAuthenticatedUser();
    const ownerId = sessionUser?.id ?? headerOwnerId;

    if (!ownerId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const job = await getJob(jobId);

    // 2) Not found
    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // 3) Ownership enforcement: non-owner gets 404 (do NOT reveal existence)
    if (job.user_id !== ownerId) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // 4) Validate status is canonical (JOB_CONTRACT_v1)
    const canonicalStatuses = ["queued", "running", "complete", "failed"];
    if (!canonicalStatuses.includes(job.status)) {
      console.error(`Invalid status in DB: ${job.status} for job ${jobId}`);
      return NextResponse.json(
        { ok: false, error: "Invalid job state" },
        { status: 500 }
      );
    }

    // 5) Build minimal canonical response
    const response: { ok: true; job: CanonicalJobResponse } = {
      ok: true,
      job: {
        id: job.id,
        status: job.status as "queued" | "running" | "complete" | "failed",
        progress: calculateProgressPercentage(job),
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    };

    // 6) Include last_error only on failure
    if (job.status === "failed" && job.last_error) {
      response.job.last_error = job.last_error;
    }

    // 7) Include failure_code only on failure when available
    if (job.status === "failed" && job.failure_code) {
      response.job.failure_code = job.failure_code;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("GET /api/jobs/[jobId] error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}

/**
 * Calculate progress as a percentage (0-100) from job.progress.
 *
 * Expects: { total_units, completed_units, ... }
 * Returns: Math.round((completed / total) * 100) or 0 if not available
 */
function calculateProgressPercentage(job: Job): number {
  if (!job.progress) return 0;

  const { total_units, completed_units } = job.progress;

  if (
    typeof total_units === "number" &&
    typeof completed_units === "number" &&
    total_units > 0
  ) {
    return Math.round((completed_units / total_units) * 100);
  }

  return 0;
}
