import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasActiveSupportGrant, logSupportView } from "@/lib/support/checkSupportAccess";
import { getAuthenticatedUser } from "@/lib/supabase/server";

type Params = Promise<{ jobId: string }>;

/**
 * GET /api/admin/support/[jobId]
 *
 * Returns diagnostic findings, revision options, and user decisions
 * for a given evaluation job. Requires admin role AND an active
 * support access grant from the evaluation owner.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Params },
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { jobId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Verify active support access grant exists (any scope)
  const grant = await hasActiveSupportGrant(jobId);
  if (!grant) {
    return NextResponse.json(
      { ok: false, error: "No active support access grant for this evaluation. The author must enable the Support Access toggle." },
      { status: 403 },
    );
  }

  const supabase = createAdminClient();

  // Fetch job metadata
  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, user_id, status, manuscript_id, created_at, completed_at, phase, job_type, last_error, metadata")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  // Fetch manuscript title
  const { data: manuscript } = await supabase
    .from("manuscripts")
    .select("id, title")
    .eq("id", job.manuscript_id)
    .single();

  // Fetch diagnostic findings
  const { data: findings, error: findingsError } = await supabase
    .from("diagnostic_findings")
    .select("id, criterion_key, finding_type, severity, location_ref, diagnosis, recommendation, evidence_excerpt, original_text, action_hint, status, created_at")
    .eq("evaluation_job_id", jobId)
    .order("created_at", { ascending: true });

  if (findingsError) {
    console.error("[admin/support] findings error:", findingsError);
  }

  // Fetch revision ledger decisions
  const { data: decisions, error: decisionsError } = await supabase
    .from("revision_ledger_decisions")
    .select("id, opportunity_id, opportunity_title, decision, selected_option, custom_text, selected_text, source_excerpt, source_location, metadata, created_at, is_undo")
    .eq("evaluation_job_id", jobId)
    .order("created_at", { ascending: true });

  if (decisionsError) {
    console.error("[admin/support] decisions error:", decisionsError);
  }

  // Fetch revision sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from("revision_sessions")
    .select("id, status, findings_count, actionable_findings_count, proposals_created_count, failure_code, failure_message, created_at, last_transition_at")
    .eq("evaluation_run_id", jobId)
    .order("created_at", { ascending: false });

  if (sessionsError) {
    console.error("[admin/support] sessions error:", sessionsError);
  }

  // Log the support view
  await logSupportView(jobId, user.id, grant.grantId, req);

  return NextResponse.json({
    ok: true,
    grant: {
      scope: grant.scope,
      expiresAt: grant.expiresAt,
    },
    job: {
      id: job.id,
      status: job.status,
      phase: job.phase,
      jobType: job.job_type,
      manuscriptId: job.manuscript_id,
      manuscriptTitle: manuscript?.title ?? "Unknown",
      createdAt: job.created_at,
      completedAt: job.completed_at,
      lastError: job.last_error,
    },
    findings: findings ?? [],
    decisions: decisions ?? [],
    sessions: sessions ?? [],
    totals: {
      findings: findings?.length ?? 0,
      decisions: decisions?.length ?? 0,
      sessions: sessions?.length ?? 0,
    },
  });
}
