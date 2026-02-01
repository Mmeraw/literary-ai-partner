import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/requireAdmin";

/**
 * GET /api/admin/dead-letter
 * 
 * Lists all dead-lettered jobs (dead-letter queue) with filtering and pagination.
 * 
 * **Auth:** Requires x-admin-key header (Phase A.5)
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
 * - Uses admin_list_jobs RPC with status='dead_lettered'
 * - Keyset pagination for stable results
 * - Audit-grade: does not modify state
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type PaginationCursor = {
  failed_at: string | null;
  created_at: string;
  id: string;
};

export async function GET(req: NextRequest) {
  // PHASE A.5: Admin authentication
  const denied = requireAdmin(req);
  if (denied) return denied;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = req.nextUrl;

  // Parse filters (status is hardcoded to 'dead_lettered')
  const job_type = searchParams.get("job_type");
  const phase = searchParams.get("phase");
  const policy_family = searchParams.get("policy_family");
  const failed_after = searchParams.get("failed_after");
  const failed_before = searchParams.get("failed_before");
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

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
    // Call admin_list_jobs RPC with status='dead_lettered'
    const { data: jobs, error } = await supabase.rpc("admin_list_jobs", {
      p_status: "dead_lettered",
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
    const resultJobs = jobs || [];

    // Generate next cursor from last job
    let nextCursor: string | null = null;
    if (has_more && resultJobs.length > 0) {
      const lastJob = resultJobs[resultJobs.length - 1];
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
