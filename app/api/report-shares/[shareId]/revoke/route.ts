/**
 * Gate A7 — Revoke Report Share
 * 
 * POST /api/report-shares/[shareId]/revoke
 * 
 * Revokes a share link immediately.
 * 
 * Security:
 * - Requires authentication
 * - Enforces ownership of share
 * - Fail-closed: never reveals share existence to non-owners
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _: Request,
  { params }: { params: { shareId: string } }
) {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 1. Require authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const shareId = params.shareId;

  // 2. Ownership check (fail-closed)
  const { data: share } = await supabase
    .from("report_shares")
    .select("id, created_by")
    .eq("id", shareId)
    .maybeSingle();

  if (!share || share.created_by !== user.id) {
    // Never reveal whether share exists
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 3. Revoke (set revoked_at timestamp)
  const { data: updated, error } = await admin
    .from("report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .select("id, revoked_at")
    .maybeSingle();

  if (error || !updated) {
    return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    share_id: updated.id,
    revoked_at: updated.revoked_at,
  });
}
