import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/jobs/[jobId]/retry
 * 
 * Retry a failed job by resetting its state to queued.
 * Service role only.
 * 
 * Governance:
 * - Validates job is in 'failed' status before retrying
 * - Preserves attempt_count (does NOT reset it)
 * - Sets next_attempt_at to NOW() (immediate retry)
 * - Clears failed_at
 * - Logs action to admin_actions audit table
 * - Returns error if job state is invalid
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function checkServiceRole(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const expectedKey = `Bearer ${supabaseServiceKey}`;
  
  return authHeader === expectedKey;
}

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  if (!checkServiceRole(req)) {
    return NextResponse.json(
      { ok: false, error: "Service role authentication required" },
      { status: 401 }
    );
  }

  const { jobId } = await context.params;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse optional request body (reason for retry)
    let reason: string | null = null;
    try {
      const body = await req.json();
      reason = body.reason || null;
    } catch {
      // Body is optional
    }

    // 1. Fetch current job state
    const { data: job, error: fetchError } = await supabase
      .from("evaluation_jobs")
      .select("id, status, attempt_count, failed_at, next_attempt_at")
      .eq("id", jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // 2. Validate job is in 'failed' status
    if (job.status !== "failed") {
      return NextResponse.json(
        { 
          ok: false, 
          error: `Job status is '${job.status}', not 'failed'. Cannot retry.`,
          current_status: job.status
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 3. Update job to queued state (preserve attempt_count)
    const { error: updateError } = await supabase
      .from("evaluation_jobs")
      .update({
        status: "queued",
        failed_at: null,
        next_attempt_at: now, // Immediate retry
        updated_at: now,
      })
      .eq("id", jobId);

    if (updateError) {
      console.error(`[Admin Retry] Error updating job ${jobId}:`, updateError);
      return NextResponse.json(
        { ok: false, error: "Failed to update job", details: updateError.message },
        { status: 500 }
      );
    }

    // 4. Log admin action to audit table
    const { error: auditError } = await supabase
      .from("admin_actions")
      .insert({
        action_type: "retry_job",
        job_id: jobId,
        performed_by: null, // TODO: Extract admin user ID from JWT if available
        performed_at: now,
        before_status: job.status,
        before_attempt_count: job.attempt_count,
        before_failed_at: job.failed_at,
        before_next_attempt_at: job.next_attempt_at,
        after_status: "queued",
        after_attempt_count: job.attempt_count, // Preserved
        after_failed_at: null,
        after_next_attempt_at: now,
        reason,
      });

    if (auditError) {
      console.error(`[Admin Retry] Error logging audit for job ${jobId}:`, auditError);
      // Don't fail the request; job was already updated
    }

    return NextResponse.json({
      ok: true,
      job_id: jobId,
      before_status: job.status,
      after_status: "queued",
      attempt_count: job.attempt_count,
      next_attempt_at: now,
    });
  } catch (err) {
    console.error(`[Admin Retry] Unexpected error for job ${jobId}:`, err);
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
