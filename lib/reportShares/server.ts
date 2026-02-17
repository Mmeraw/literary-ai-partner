/**
 * Gate A7 — Report Share Server Logic
 * 
 * Server-side share token validation and lookup.
 * Uses admin client to bypass RLS (controlled access).
 * 
 * Fail-closed design:
 * - Invalid token → { ok: false }
 * - Revoked → { ok: false }
 * - Expired → { ok: false }
 * - Missing → { ok: false }
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { hashShareToken } from "@/lib/security/shareTokens";

export type ShareLookupResult =
  | { ok: true; jobId: string; artifactType: string; shareId: string }
  | { ok: false };

/**
 * Look up a share by token (server-side only, uses admin client).
 * 
 * Validates:
 * - Share exists
 * - Not revoked
 * - Not expired
 * 
 * @param token - plaintext share token from URL
 * @returns ShareLookupResult with job details or failure
 */
export async function lookupShareByToken(token: string): Promise<ShareLookupResult> {
  const supabase = createAdminClient();
  const tokenHash = hashShareToken(token);

  const { data: share, error } = await supabase
    .from("report_shares")
    .select("id, job_id, artifact_type, revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  // Not found or error
  if (error || !share) {
    return { ok: false };
  }

  // Revoked
  if (share.revoked_at) {
    return { ok: false };
  }

  // Expired
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return { ok: false };
  }

  return {
    ok: true,
    shareId: share.id,
    jobId: share.job_id,
    artifactType: share.artifact_type,
  };
}
