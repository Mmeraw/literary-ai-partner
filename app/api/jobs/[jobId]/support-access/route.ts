import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getJob } from "@/lib/jobs/store";

type Params = Promise<{ jobId: string }>;

/**
 * GET /api/jobs/[jobId]/support-access
 *
 * Returns the current support access grant status for this evaluation.
 * Only the evaluation owner can check this.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { jobId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const job = await getJob(jobId);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: grants, error } = await admin
    .from("evaluation_support_access_grants")
    .select("id, scope, reason, expires_at, revoked_at, created_at")
    .eq("evaluation_job_id", jobId)
    .eq("owner_user_id", user.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[support-access/GET] Error:", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  const activeGrant = grants && grants.length > 0 ? grants[0] : null;

  return NextResponse.json({
    ok: true,
    granted: !!activeGrant,
    grant: activeGrant,
  });
}

/**
 * POST /api/jobs/[jobId]/support-access
 *
 * Author grants support access for this evaluation.
 * Creates a new grant with 7-day expiration.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Params }
) {
  const { jobId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const job = await getJob(jobId);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  let reason: string | null = null;
  try {
    const body = await req.json();
    reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;
  } catch {
    // No body or invalid JSON is fine — reason is optional
  }

  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: grant, error } = await admin
    .from("evaluation_support_access_grants")
    .insert({
      evaluation_job_id: jobId,
      owner_user_id: user.id,
      granted_by_user_id: user.id,
      scope: "evaluation_telemetry",
      reason,
      expires_at: expiresAt,
    })
    .select("id, scope, expires_at, created_at")
    .single();

  if (error) {
    console.error("[support-access/POST] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create grant" }, { status: 500 });
  }

  // Audit log: grant_created
  await admin.from("evaluation_support_access_log").insert({
    evaluation_job_id: jobId,
    viewer_user_id: user.id,
    grant_id: grant.id,
    action: "grant_created",
  });

  return NextResponse.json({ ok: true, grant });
}

/**
 * DELETE /api/jobs/[jobId]/support-access
 *
 * Author revokes all active support access grants for this evaluation.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Params }
) {
  const { jobId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const job = await getJob(jobId);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Revoke all active grants
  const { data: revoked, error } = await admin
    .from("evaluation_support_access_grants")
    .update({ revoked_at: now, updated_at: now })
    .eq("evaluation_job_id", jobId)
    .eq("owner_user_id", user.id)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    console.error("[support-access/DELETE] Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to revoke" }, { status: 500 });
  }

  // Audit log: grant_revoked for each revoked grant
  if (revoked && revoked.length > 0) {
    const logEntries = revoked.map((g: { id: string }) => ({
      evaluation_job_id: jobId,
      viewer_user_id: user.id,
      grant_id: g.id,
      action: "grant_revoked" as const,
    }));
    await admin.from("evaluation_support_access_log").insert(logEntries);
  }

  return NextResponse.json({ ok: true, revoked_count: revoked?.length ?? 0 });
}
