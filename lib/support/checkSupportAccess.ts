import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

/**
 * Check whether an active, non-expired support access grant exists
 * for a given evaluation job.
 *
 * Returns the grant ID if access is active, null otherwise.
 * This does NOT check viewer role — the caller must verify the
 * viewer is admin/support before calling.
 */
export async function hasActiveSupportGrant(
  evaluationJobId: string
): Promise<{ grantId: string; expiresAt: string } | null> {
  const admin = createAdminClient({ nullable: true });
  if (!admin) return null;

  const { data, error } = await admin
    .from("evaluation_support_access_grants")
    .select("id, expires_at")
    .eq("evaluation_job_id", evaluationJobId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  return { grantId: data[0].id, expiresAt: data[0].expires_at };
}

/**
 * Log a support/admin view of evaluation data to the audit table.
 */
export async function logSupportView(
  evaluationJobId: string,
  viewerUserId: string,
  grantId: string,
  request?: Request
): Promise<void> {
  const admin = createAdminClient({ nullable: true });
  if (!admin) return;

  const rawForwardedIp = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ipHash = rawForwardedIp
    ? createHash("sha256").update(rawForwardedIp, "utf8").digest("hex")
    : null;

  await admin.from("evaluation_support_access_log").insert({
    evaluation_job_id: evaluationJobId,
    viewer_user_id: viewerUserId,
    grant_id: grantId,
    action: "view",
    ip_hash: ipHash,
    user_agent: request?.headers?.get("user-agent")?.slice(0, 256) ?? null,
  });
}
