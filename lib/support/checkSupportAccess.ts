import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

type SupportAccessScope = 'evaluation_telemetry' | 'revision_data' | 'full';

type ActiveGrant = {
  grantId: string;
  expiresAt: string;
  scope: SupportAccessScope;
};

/**
 * Check whether an active, non-expired support access grant exists
 * for a given evaluation job.
 *
 * Returns the grant ID if access is active, null otherwise.
 * This does NOT check viewer role — the caller must verify the
 * viewer is admin/support before calling.
 *
 * When `requiredScope` is specified, only grants with that scope
 * or 'full' scope are considered active.
 */
export async function hasActiveSupportGrant(
  evaluationJobId: string,
  requiredScope?: SupportAccessScope,
): Promise<ActiveGrant | null> {
  const admin = createAdminClient({ nullable: true });
  if (!admin) return null;

  let query = admin
    .from("evaluation_support_access_grants")
    .select("id, expires_at, scope")
    .eq("evaluation_job_id", evaluationJobId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (requiredScope && requiredScope !== 'full') {
    query = query.in("scope", [requiredScope, "full"]);
  }

  const { data, error } = await query.limit(1);

  if (error || !data || data.length === 0) return null;

  return {
    grantId: data[0].id,
    expiresAt: data[0].expires_at,
    scope: data[0].scope as SupportAccessScope,
  };
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
