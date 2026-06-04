import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/support
 *
 * Lists all evaluations with active (non-expired, non-revoked)
 * support access grants. Admin-only.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const supabase = createAdminClient();

  // Fetch active grants with job + manuscript metadata
  const { data: grants, error } = await supabase
    .from("evaluation_support_access_grants")
    .select(`
      id,
      evaluation_job_id,
      owner_user_id,
      scope,
      expires_at,
      created_at
    `)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[admin/support] grants error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch grants" }, { status: 500 });
  }

  if (!grants || grants.length === 0) {
    return NextResponse.json({ ok: true, grants: [] });
  }

  // Batch-fetch job metadata
  const jobIds = [...new Set(grants.map((g) => g.evaluation_job_id))];
  const { data: jobs } = await supabase
    .from("evaluation_jobs")
    .select("id, status, phase, manuscript_id")
    .in("id", jobIds);

  const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));

  // Batch-fetch manuscript titles
  const manuscriptIds = [...new Set((jobs ?? []).map((j) => j.manuscript_id).filter(Boolean))];
  const { data: manuscripts } = manuscriptIds.length > 0
    ? await supabase
        .from("manuscripts")
        .select("id, title")
        .in("id", manuscriptIds)
    : { data: [] };

  const msMap = new Map((manuscripts ?? []).map((m) => [m.id, m.title]));

  // Batch-fetch user emails
  const userIds = [...new Set(grants.map((g) => g.owner_user_id))];
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const userMap = new Map((users ?? []).map((u) => [u.id, u.email ?? null]));

  const result = grants.map((g) => {
    const job = jobMap.get(g.evaluation_job_id);
    return {
      grantId: g.id,
      jobId: g.evaluation_job_id,
      scope: g.scope,
      expiresAt: g.expires_at,
      createdAt: g.created_at,
      jobStatus: job?.status ?? "unknown",
      jobPhase: job?.phase ?? null,
      manuscriptTitle: (job?.manuscript_id ? msMap.get(job.manuscript_id) : null) ?? "Unknown",
      ownerEmail: userMap.get(g.owner_user_id) ?? null,
    };
  });

  return NextResponse.json({ ok: true, grants: result });
}
