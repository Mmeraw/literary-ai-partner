import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/jobs/[jobId]/retry
 * 
 * Retry a failed job by resetting its state to queued.
 * 
 * **Auth:** Requires admin session (Phase A.5)
 * **Rate limit:** 5 retries per minute per IP
 * 
 * Governance:
 * - Validates job is in 'failed' status before retrying
 * - Preserves attempt_count (does NOT reset it)
 * - Sets next_attempt_at to NOW() (immediate retry)
 * - Clears failed_at
 * - Logs action to admin_actions audit table
 * - Returns error if job state is invalid
 */

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  // PHASE A.5: Admin authentication
  const denied = await requireAdmin(req);
  if (denied) return denied;

  // PHASE A.5: Rate limiting (prevent retry spam)
  const ip = getClientIp(req.headers);
  if (!rateLimit(`admin-retry:${ip}`, 5, 60_000)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many retry requests. Please wait before retrying again.",
        code: "rate_limited",
        retryAfter: 60,
      },
      { status: 429 }
    );
  }

  const { jobId } = await context.params;

  const supabase = createAdminClient();

  try {
    // Parse optional request body (reason for retry)
    let reason: string | null = null;
    try {
      const body = await req.json();
      reason = body.reason || null;
    } catch {
      // Body is optional
    }

    // A5: Atomic retry via RPC (no read→decide→write race)
    const { data, error: rpcError } = await supabase.rpc("admin_retry_job", {
      p_job_id: jobId,
    });

    if (rpcError) {
      console.error(`[Admin Retry] RPC error for job ${jobId}:`, rpcError);
      return NextResponse.json(
        { ok: false, error: "Failed to retry job", details: rpcError.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Job not found" },
        { status: 404 }
      );
    }

    const result = data[0];
    const changed = result.changed === true;

    // If not changed, return no-op (idempotent)
    if (!changed) {
      return NextResponse.json(
        {
          ok: false,
          changed: false,
          error: `Job is not retryable (current status: ${result.status})`,
          job_id: result.job_id,
          status: result.status,
        },
        { status: 409 }
      );
    }

    // Success: job was retried
    // Optionally log to audit table (non-blocking)
    const now = new Date().toISOString();
    const { error: auditError } = await supabase.from("admin_actions").insert({
      action_type: "retry_job",
      job_id: jobId,
      performed_by: null, // TODO: Extract admin user ID from JWT if available
      performed_at: now,
      before_status: "failed", // Inferred (RPC only acts on failed/dead_lettered)
      after_status: "queued",
      reason,
    });

    if (auditError) {
      console.error(
        `[Admin Retry] Error logging audit for job ${jobId}:`,
        auditError
      );
      // Don't fail the request; job was already updated
    }

    return NextResponse.json({
      ok: true,
      changed: true,
      job_id: result.job_id,
      status: result.status,
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
