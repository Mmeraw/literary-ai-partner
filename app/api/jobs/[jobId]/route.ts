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
 *   { ok: true, job: { id, status, progress, created_at, updated_at,
 *                       phase?, phase_status?, last_error?, failure_code? } }
 *
 * Response (failure):
 *   { ok: false, error: string } with status 401|404|500
 *
 * Status values: "queued" | "running" | "complete" | "failed" (LOCKED)
 * Progress: percentage 0-100
 * phase / phase_status: canonical pipeline-stage signal, sourced from
 *   job.progress.{phase, phase_status}. Additive and may be null when the
 *   worker has not yet emitted a canonical phase. Consumers MUST treat
 *   both as optional.
 * last_error: present only when status === "failed"
 * failure_code: present only when status === "failed" and a code is available
 */
type CanonicalPhase = "phase_0" | "phase_1" | "phase_2";
type CanonicalPhaseStatus = "queued" | "running" | "complete" | "failed";

type CanonicalJobResponse = {
  id: string;
  user_id: string;
  status: "queued" | "running" | "complete" | "failed";
  progress: number; // 0-100
  created_at: string;
  updated_at: string;
  phase?: CanonicalPhase | null;
  phase_status?: CanonicalPhaseStatus | null;
  last_error?: string;
  failure_code?: string;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

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
      return jsonNoStore(
        { ok: false, error: "Unauthorized" },
        401
      );
    }

    const job = await getJob(jobId);

    // 2) Not found
    if (!job) {
      return jsonNoStore(
        { ok: false, error: "Job not found" },
        404
      );
    }

    // 3) Ownership enforcement: non-owner gets 404 (do NOT reveal existence)
    if (job.user_id !== ownerId) {
      return jsonNoStore(
        { ok: false, error: "Job not found" },
        404
      );
    }

    // 4) Validate status is canonical (JOB_CONTRACT_v1)
    const canonicalStatuses = ["queued", "running", "complete", "failed"];
    if (!canonicalStatuses.includes(job.status)) {
      console.error(`Invalid status in DB: ${job.status} for job ${jobId}`);
      return jsonNoStore(
        { ok: false, error: "Invalid job state" },
        500
      );
    }

    // 5) Build minimal canonical response
    const response: { ok: true; job: CanonicalJobResponse } = {
      ok: true,
      job: {
        id: job.id,
        user_id: job.user_id,
        status: job.status as "queued" | "running" | "complete" | "failed",
        progress: calculateProgressPercentage(job),
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
    };

    // 6) Surface canonical phase signal additively when present.
    // Sourced from job.progress (JOB_CONTRACT_v1). Both fields are optional in
    // the response so existing consumers that ignore them continue to work.
    const canonicalPhase = extractCanonicalPhase(job);
    if (canonicalPhase.phase !== undefined) {
      response.job.phase = canonicalPhase.phase;
    }
    if (canonicalPhase.phase_status !== undefined) {
      response.job.phase_status = canonicalPhase.phase_status;
    }

    // 7) Include last_error only on failure
    if (job.status === "failed" && job.last_error) {
      response.job.last_error = job.last_error;
    }

    // 8) Include failure_code only on failure when available
    if (job.status === "failed" && job.failure_code) {
      response.job.failure_code = job.failure_code;
    }

    return jsonNoStore(response);
  } catch (err) {
    console.error("GET /api/jobs/[jobId] error:", err);
    return jsonNoStore(
      { ok: false, error: "Server error" },
      500
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

/**
 * Extract the canonical pipeline-stage signal (phase, phase_status) from the
 * job's progress payload without widening the response contract.
 *
 * Validates values against the canonical enums and returns `null` for missing
 * or non-canonical inputs so the UI never surfaces stale or invented stages.
 * Returns `undefined` for a field when the payload has nothing to say, so the
 * caller can omit the key entirely from the response.
 */
const CANONICAL_PHASES: ReadonlyArray<CanonicalPhase> = [
  "phase_0",
  "phase_1",
  "phase_2",
];
const CANONICAL_PHASE_STATUSES: ReadonlyArray<CanonicalPhaseStatus> = [
  "queued",
  "running",
  "complete",
  "failed",
];

function extractCanonicalPhase(job: Job): {
  phase?: CanonicalPhase | null;
  phase_status?: CanonicalPhaseStatus | null;
} {
  if (!job.progress) return {};

  const rawPhase = (job.progress as { phase?: unknown }).phase;
  const rawPhaseStatus = (job.progress as { phase_status?: unknown }).phase_status;

  let phase: CanonicalPhase | null | undefined;
  if (typeof rawPhase === "string" && (CANONICAL_PHASES as readonly string[]).includes(rawPhase)) {
    phase = rawPhase as CanonicalPhase;
  } else if (rawPhase === null) {
    phase = null;
  } else {
    phase = undefined;
  }

  let phase_status: CanonicalPhaseStatus | null | undefined;
  if (
    typeof rawPhaseStatus === "string" &&
    (CANONICAL_PHASE_STATUSES as readonly string[]).includes(rawPhaseStatus)
  ) {
    phase_status = rawPhaseStatus as CanonicalPhaseStatus;
  } else if (rawPhaseStatus === null) {
    phase_status = null;
  } else {
    phase_status = undefined;
  }

  return { phase, phase_status };
}
