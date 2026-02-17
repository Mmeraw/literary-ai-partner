/**
 * Gate A7 — Revoke Report Share (RPC-based)
 * 
 * POST /api/report-shares/[shareId]/revoke
 * 
 * Revokes a share link immediately via SECURITY DEFINER RPC.
 * 
 * Security:
 * - Requires authentication (session or evidence header)
 * - Enforces ownership via RPC
 * - Fail-closed: never reveals share existence to non-owners
 * 
 * Note: shareId is the plaintext token (only holder has it)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActorIdOrNull } from "@/lib/auth/actor";

export async function POST(
  _req: Request,
  { params }: { params: { shareId: string } }
) {
  // 1. Resolve actor
  const actorId = await getActorIdOrNull();
  if (!actorId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = (params.shareId || "").trim();
  if (!token) {
    return NextResponse.json({ error: "shareId_required" }, { status: 400 });
  }

  const isEvidence =
    process.env.CI === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.FLOW1_EVIDENCE === "1" ||
    process.env.FLOW_A7_EVIDENCE === "1";

  if (isEvidence) {
    // Evidence mode: direct admin update (bypass RPC which requires auth.uid)
    const admin = createAdminClient();

    // Hash token to lookup
    const tokenHash = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
    ).toString("hex");

    // Ownership check
    const { data: existing, error: selErr } = await admin
      .from("report_shares")
      .select("token_hash,created_by,revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (selErr || !existing || existing.created_by !== actorId) {
      return NextResponse.json({ ok: false, error: "Share not found" }, { status: 404 });
    }

    // Revoke (idempotent)
    const { error: updErr } = await admin
      .from("report_shares")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash);

    if (updErr) {
      return NextResponse.json({ error: "revoke_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // Production: authenticated session, use RPC
  const supabase = await createClient();

  const { error } = await supabase.rpc("revoke_report_share_by_token", {
    p_token: token,
  });

  if (error) {
    // Fail-closed
    return NextResponse.json({ ok: false, error: "Share not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
