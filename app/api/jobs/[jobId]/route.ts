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
 *   both as optional. Legacy phase_1/phase1/p1 values are read-time
 *   normalized to phase_1a and are never returned to clients.
 * last_error: present only when status === "failed"
 * failure_code: present only when status === "failed" and a code is available
 */
type CanonicalPhase = "phase_0" | "phase_1a" | "phase_2" | "phase_3" | "wave_revision";
type CanonicalPhaseStatus = "queued" | "running" | "complete" | "failed";
type CrossCheckStatus =
  | "queued"
  | "running"
  | "complete"
  | "failed"
  | "failed_soft"
  | "failed_blocking"
  | "cross_check_completed"
  | "skipped";

type CanonicalJobResponse = {
  id: string;
  user_id: string;
  status: "queued" | "running" | "complete" | "failed";
  progress: number; // 0-100 (legacy unit-counter shape; kept for backward compat)
  created_at: string;
  updated_at: string;
  phase?: CanonicalPhase | null;
  phase_status?: CanonicalPhaseStatus | null;
  /**
   * Additive: cross-check / Pass 4 status surfaced from progress so the
   * truthful progress bar can advance into "Final QA checks" and
   * "Preparing report" stages without relying on inference.
   */
  cross_check_status?: CrossCheckStatus | null;
  /**
   * Additive: raw unit counters so the UI can compute the true within-phase
   * fraction (e.g. early vs late phase_1a) without parsing the numeric
   * progress percentage back into a fraction.
   */
  total_units?: number | null;
  completed_units?: number | null;
  /**
   * Additive: per-stage timestamps used by the client to compute truthful,
   * stage-weighted progress percentages. All fields are optional ISO strings.
   * Older jobs that pre-date a given stage timestamp simply omit it; the
   * client falls back to indeterminate display for that stage.
   */
  phase1_started_at?: string | null;
  phase1_completed_at?: string | null;
  phase2_started_at?: string | null;
  phase2_completed_at?: string | null;
  pass3_started_at?: string | null;
  pass3_completed_at?: string | null;
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

    // 6b) Surface raw unit counters so the UI can compute the within-phase
    //     fraction without re-parsing the rolled-up percentage.
    const rawTotalUnits = (job.progress as { total_units?: unknown } | null)?.total_units;
    const rawCompletedUnits = (job.progress as { completed_units?: unknown } | null)?.completed_units;
    if (typeof rawTotalUnits === "number") {
      response.job.total_units = rawTotalUnits;
    }
    if (typeof rawCompletedUnits === "number") {
      response.job.completed_units = rawCompletedUnits;
    }

    // 6c) Surface cross-check status and per-stage timestamps additively so
    //     the client can render the truthful, stage-weighted progress bar.
    //     All fields are optional and validated. Missing/invalid values are
    //     omitted rather than defaulted, so consumers that ignore them stay
    //     unaffected.
    const stageTiming = extractStageTiming(job);
    if (stageTiming.cross_check_status !== undefined) {
      response.job.cross_check_status = stageTiming.cross_check_status;
    }
    if (stageTiming.phase1_started_at !== undefined) {
      response.job.phase1_started_at = stageTiming.phase1_started_at;
    }
    if (stageTiming.phase1_completed_at !== undefined) {
      response.job.phase1_completed_at = stageTiming.phase1_completed_at;
    }
    if (stageTiming.phase2_started_at !== undefined) {
      response.job.phase2_started_at = stageTiming.phase2_started_at;
    }
    if (stageTiming.phase2_completed_at !== undefined) {
      response.job.phase2_completed_at = stageTiming.phase2_completed_at;
    }
    if (stageTiming.pass3_started_at !== undefined) {
      response.job.pass3_started_at = stageTiming.pass3_started_at;
    }
    if (stageTiming.pass3_completed_at !== undefined) {
      response.job.pass3_completed_at = stageTiming.pass3_completed_at;
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
  "phase_1a",
  "phase_2",
  "phase_3",
  "wave_revision",
];
const LEGACY_PHASE_ALIASES: Readonly<Record<string, CanonicalPhase>> = {
  phase_1: "phase_1a",
  phase1: "phase_1a",
  p1: "phase_1a",
};
const CANONICAL_PHASE_STATUSES: ReadonlyArray<CanonicalPhaseStatus> = [
  "queued",
  "running",
  "complete",
  "failed",
];

function normalizePhaseForResponse(rawPhase: unknown): CanonicalPhase | null | undefined {
  if (rawPhase === null) return null;
  if (typeof rawPhase !== "string") return undefined;
  if ((CANONICAL_PHASES as readonly string[]).includes(rawPhase)) {
    return rawPhase as CanonicalPhase;
  }
  return LEGACY_PHASE_ALIASES[rawPhase];
}

function extractCanonicalPhase(job: Job): {
  phase?: CanonicalPhase | null;
  phase_status?: CanonicalPhaseStatus | null;
} {
  if (!job.progress) return {};

  const rawPhase = (job.progress as { phase?: unknown }).phase;
  const rawPhaseStatus = (job.progress as { phase_status?: unknown }).phase_status;

  const phase = normalizePhaseForResponse(rawPhase);

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

/**
 * Extract cross-check status + per-stage timestamps from job.progress without
 * widening the response contract beyond what CanonicalJobResponse documents.
 *
 * Each field is validated independently:
 *   - cross_check_status must be one of the canonical enum values
 *   - timestamps must be strings (clients parse them as ISO; non-strings rejected)
 *   - missing keys return `undefined` so the GET handler omits them entirely
 *   - explicit `null` is preserved so a "known absent" signal stays distinct
 *     from "never written"
 */
const CROSS_CHECK_STATUSES: ReadonlyArray<CrossCheckStatus> = [
  "queued",
  "running",
  "complete",
  "failed",
  "failed_soft",
  "failed_blocking",
  "cross_check_completed",
  "skipped",
];

function pickTimestamp(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  if (typeof raw === "string" && raw.length > 0) return raw;
  return undefined;
}

function extractStageTiming(job: Job): {
  cross_check_status?: CrossCheckStatus | null;
  phase1_started_at?: string | null;
  phase1_completed_at?: string | null;
  phase2_started_at?: string | null;
  phase2_completed_at?: string | null;
  pass3_started_at?: string | null;
  pass3_completed_at?: string | null;
} {
  if (!job.progress) return {};

  const p = job.progress as Record<string, unknown>;

  let cross_check_status: CrossCheckStatus | null | undefined;
  const rawCc = p.cross_check_status;
  if (
    typeof rawCc === "string" &&
    (CROSS_CHECK_STATUSES as readonly string[]).includes(rawCc)
  ) {
    cross_check_status = rawCc as CrossCheckStatus;
  } else if (rawCc === null) {
    cross_check_status = null;
  } else {
    cross_check_status = undefined;
  }

  return {
    cross_check_status,
    phase1_started_at: pickTimestamp(p.phase1_started_at),
    phase1_completed_at: pickTimestamp(p.phase1_completed_at),
    phase2_started_at: pickTimestamp(p.phase2_started_at),
    phase2_completed_at: pickTimestamp(p.phase2_completed_at),
    pass3_started_at: pickTimestamp(p.pass3_started_at),
    pass3_completed_at: pickTimestamp(p.pass3_completed_at),
  };
}
