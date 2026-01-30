import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/admin/dead-letter
 * 
 * Lists all failed jobs (dead-letter queue).
 * Service role only.
 * 
 * Governance:
 * - Only accessible with service role key
 * - Returns failed jobs with retry metadata
 * - Audit-grade: does not modify state
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function checkServiceRole(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const expectedKey = `Bearer ${supabaseServiceKey}`;
  
  return authHeader === expectedKey;
}

export async function GET(req: Request) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch all failed jobs with relevant metadata
    const { data: jobs, error } = await supabase
      .from("evaluation_jobs")
      .select(`
        id,
        manuscript_id,
        job_type,
        status,
        phase,
        phase_status,
        attempt_count,
        max_attempts,
        failed_at,
        next_attempt_at,
        last_error,
        created_at,
        updated_at,
        work_type,
        policy_family
      `)
      .eq("status", "failed")
      .order("failed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Admin Dead-Letter] Error fetching failed jobs:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch dead-letter jobs", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      jobs: jobs || [],
      count: jobs?.length || 0,
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
