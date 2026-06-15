import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTestManuscript, TEST_MANUSCRIPT_ID_MIN } from "@/lib/manuscripts/testRange";

/**
 * GET /api/admin/jobs
 *
 * Admin source of truth for job dashboards. This route intentionally reads the
 * canonical evaluation_jobs table directly instead of relying on the legacy
 * admin_list_jobs RPC, because older RPC status filtering only matched the
 * top-level status field and could hide active jobs whose running state lives
 * in progress.phase_status / lifecycle-era fields.
 *
 * Query parameters:
 * - status: all|queued|running|complete|failed
 * - job_type, phase, policy_family
 * - created_after, created_before, failed_after, failed_before
 * - limit: max 500, default 500
 * - show_test: defaults to true; pass 0/false/no to hide manuscript_id >= 9000
 */

type JobRow = Record<string, unknown>;

function lower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function progressOf(job: JobRow): Record<string, unknown> {
  const progress = job.progress;
  return progress && typeof progress === "object" && !Array.isArray(progress)
    ? (progress as Record<string, unknown>)
    : {};
}

function errorCodeOf(job: JobRow): string | null {
  const direct = job.error_code ?? job.failure_code;
  if (typeof direct === "string" && direct.trim()) return direct;

  const lastError = job.last_error;
  if (lastError && typeof lastError === "object" && !Array.isArray(lastError)) {
    const e = lastError as Record<string, unknown>;
    const code = e.error_code ?? e.failure_code ?? e.code;
    if (typeof code === "string" && code.trim()) return code;
  }

  return null;
}

function semanticStatus(job: JobRow): string {
  const progress = progressOf(job);
  const status = lower(job.status);
  const lifecycle = lower(job.lifecycle);
  const phaseStatus = lower(job.phase_status ?? progress.phase_status);
  const validity = lower(job.validity);

  if ([status, lifecycle, phaseStatus, validity].some((v) => ["failed", "error", "errored"].includes(v))) {
    return "failed";
  }
  if ([status, lifecycle, phaseStatus].some((v) => ["complete", "completed", "done", "succeeded", "success"].includes(v))) {
    return "complete";
  }
  if ([status, lifecycle, phaseStatus].some((v) => ["running", "processing", "in_progress", "active", "executing"].includes(v))) {
    return "running";
  }
  if ([status, lifecycle, phaseStatus].some((v) => ["queued", "pending", "scheduled", "retrying"].includes(v))) {
    return "queued";
  }

  return status || lifecycle || phaseStatus || "unknown";
}

function matchesStatus(job: JobRow, requested: string | null): boolean {
  if (!requested || requested === "all") return true;
  return semanticStatus(job) === requested.toLowerCase();
}

function normalizeJob(job: JobRow): JobRow {
  const progress = progressOf(job);
  const computedStatus = semanticStatus(job);
  const failureCode = errorCodeOf(job);

  return {
    ...job,
    status: computedStatus,
    raw_status: job.status ?? null,
    phase_status: job.phase_status ?? progress.phase_status ?? null,
    failure_code: failureCode,
    error_code: failureCode,
    progress,
  };
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  const { searchParams } = req.nextUrl;

  const status = searchParams.get("status");
  const jobType = searchParams.get("job_type");
  const phase = searchParams.get("phase");
  const policyFamily = searchParams.get("policy_family");
  const createdAfter = searchParams.get("created_after");
  const createdBefore = searchParams.get("created_before");
  const failedAfter = searchParams.get("failed_after");
  const failedBefore = searchParams.get("failed_before");
  const limitParam = searchParams.get("limit");

  const requestedLimit = limitParam ? Number.parseInt(limitParam, 10) : 500;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 500)
    : 500;

  const showTestParam = (searchParams.get("show_test") ?? "").toLowerCase();
  const showTestManuscripts = !(showTestParam === "0" || showTestParam === "false" || showTestParam === "no");

  try {
    let query = supabase
      .from("evaluation_jobs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (jobType) query = query.eq("job_type", jobType);
    if (phase) query = query.eq("phase", phase);
    if (policyFamily) query = query.eq("policy_family", policyFamily);
    if (createdAfter) query = query.gte("created_at", createdAfter);
    if (createdBefore) query = query.lte("created_at", createdBefore);
    if (failedAfter) query = query.gte("failed_at", failedAfter);
    if (failedBefore) query = query.lte("failed_at", failedBefore);

    const { data, error } = await query;

    if (error) {
      console.error("[Admin Jobs] table query error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch jobs", details: error.message },
        { status: 500 }
      );
    }

    const rawJobs = (Array.isArray(data) ? data : []) as JobRow[];
    const jobs = rawJobs
      .filter((job) => showTestManuscripts || !isTestManuscript(job.manuscript_id as number | string))
      .map(normalizeJob)
      .filter((job) => matchesStatus(job, status))
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      jobs,
      pagination: {
        count: jobs.length,
        limit,
        has_more: rawJobs.length >= 500,
        next_cursor: null,
      },
      filters: {
        requestedStatus: status ?? "all",
        showTestManuscripts,
        testManuscriptIdMin: TEST_MANUSCRIPT_ID_MIN,
        source: "evaluation_jobs",
        statusMode: "semantic_status_includes_progress_phase_status",
      },
    });
  } catch (err) {
    console.error("[Admin Jobs] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
