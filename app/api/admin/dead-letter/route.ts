import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTestManuscript, TEST_MANUSCRIPT_ID_MIN } from "@/lib/manuscripts/testRange";

/**
 * GET /api/admin/dead-letter
 * 
 * Lists all failed jobs (the canonical failure state) with filtering and pagination.
 * 
 * **Auth:** Requires admin session (Phase A.5)
 * 
 * **Status semantics:** The codebase canonicalized failure to a single
 * status='failed' state (see finalizeJobFailure in lib/jobs/jobStore.supabase.ts).
 * The legacy 'dead_lettered' status is no longer written by any code path, so
 * this route now queries for 'failed'. The route slug and UI title still say
 * "dead-letter" for URL/bookmark stability; the meaning is "failed jobs".
 * 
 * Query parameters (same as /api/admin/jobs):
 * - job_type: Filter by job type
 * - phase: Filter by phase
 * - policy_family: Filter by policy family
 * - failed_after: Filter failed_at >= ISO timestamp
 * - failed_before: Filter failed_at <= ISO timestamp
 * - cursor: Pagination cursor (base64 JSON)
 * - limit: Page size (max 100, default 50)
 * 
 * Governance:
 * - Uses admin_list_jobs RPC with status='failed' (canonical failure state)
 * - Keyset pagination for stable results
 * - Audit-grade: does not modify state
 */

type PaginationCursor = {
  failed_at: string | null;
  created_at: string;
  id: string;
};

export async function GET(req: NextRequest) {
  // PHASE A.5: Admin authentication
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const supabase = createAdminClient();
  const { searchParams } = req.nextUrl;

  // Parse filters (status is hardcoded to 'failed' — canonical failure state)
  const job_type = searchParams.get("job_type");
  const phase = searchParams.get("phase");
  const policy_family = searchParams.get("policy_family");
  const failed_after = searchParams.get("failed_after");
  const failed_before = searchParams.get("failed_before");
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  // Test manuscripts (id >= 9000) are hidden by default. Opt in with
  // `?show_test=1` (or "true"). See OPERATIONS.md "Test manuscript range".
  const showTestParam = (searchParams.get("show_test") ?? "").toLowerCase();
  const showTestManuscripts = showTestParam === "1" || showTestParam === "true";

  // Parse pagination
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;
  
  let cursor: PaginationCursor | null = null;
  if (cursorParam) {
    try {
      cursor = JSON.parse(Buffer.from(cursorParam, "base64").toString("utf-8"));
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: "Invalid cursor format" },
        { status: 400 }
      );
    }
  }

  try {
    // Call admin_list_jobs RPC with status='failed' (canonical failure state;
    // 'dead_lettered' is legacy and no longer written by any code path).
    const { data: jobs, error } = await supabase.rpc("admin_list_jobs", {
      p_status: "failed",
      p_job_type: job_type,
      p_phase: phase,
      p_policy_family: policy_family,
      p_created_after: null,
      p_created_before: null,
      p_failed_after: failed_after,
      p_failed_before: failed_before,
      p_cursor_failed_at: cursor?.failed_at || null,
      p_cursor_created_at: cursor?.created_at || null,
      p_cursor_id: cursor?.id || null,
      p_limit: limit,
    });

    if (error) {
      console.error("[Admin Dead-Letter] RPC error:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch dead-letter jobs", details: error.message },
        { status: 500 }
      );
    }

    // Extract has_more flag and actual jobs
    const has_more = jobs && jobs.length > 0 ? jobs[0].has_more : false;
    const rawJobs: Array<Record<string, unknown>> = jobs || [];

    // Test-manuscript filter — post-RPC (admin_list_jobs has no manuscript_id
    // filter parameter). See OPERATIONS.md.
    const resultJobs = showTestManuscripts
      ? rawJobs
      : rawJobs.filter((j) => {
          const id = j.manuscript_id;
          if (id === null || id === undefined) return true;
          return !isTestManuscript(id as number | string);
        });

    // Generate next cursor from last job
    let nextCursor: string | null = null;
    if (has_more && resultJobs.length > 0) {
      const lastJob = resultJobs[resultJobs.length - 1] as {
        failed_at: string | null;
        created_at: string;
        id: string;
      };
      const cursorObj: PaginationCursor = {
        failed_at: lastJob.failed_at,
        created_at: lastJob.created_at,
        id: lastJob.id,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString("base64");
    }

    return NextResponse.json({
      ok: true,
      jobs: resultJobs,
      pagination: {
        count: resultJobs.length,
        limit,
        has_more,
        next_cursor: nextCursor,
      },
      filters: {
        showTestManuscripts,
        testManuscriptIdMin: TEST_MANUSCRIPT_ID_MIN,
      },
    });
  } catch (err) {
    console.error("[Admin Dead-Letter] Unexpected error:", err);
    return NextResponse.json(
      { 
        ok: false, 
        error: "Internal server error", 
        details: err instanceof Error ? err.message : String(err)
      },
      { status: 500 }
    );
  }
}
