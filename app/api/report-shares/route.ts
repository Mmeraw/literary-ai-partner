/**
 * Gate A7 — Create Report Share
 * 
 * POST /api/report-shares
 * 
 * Creates a shareable link for an evaluation report.
 * 
 * Security:
 * - Requires authentication
 * - Enforces job ownership
 * - Stores only hashed tokens
 * - Fail-closed: never reveals job existence to non-owners
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateShareToken, hashShareToken } from "@/lib/security/shareTokens";

const DEFAULT_EXPIRES_DAYS = 14;
const DEFAULT_ARTIFACT_TYPE = "one_page_summary";

export async function POST(req: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  // 1. Require authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse request
  const body = await req.json().catch(() => ({}));
  const job_id = String(body.job_id || "");
  const artifact_type = String(body.artifact_type || DEFAULT_ARTIFACT_TYPE);
  const expires_days = Number.isFinite(body.expires_days)
    ? Number(body.expires_days)
    : DEFAULT_EXPIRES_DAYS;

  if (!job_id) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // 3. Ownership check (fail-closed, no leakage)
  const { data: job } = await supabase
    .from("evaluation_jobs")
    .select("id, user_id")
    .eq("id", job_id)
    .maybeSingle();

  if (!job || job.user_id !== user.id) {
    // Never reveal whether job exists
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 4. Generate token and hash
  const token = generateShareToken(32);
  const token_hash = hashShareToken(token);

  // 5. Calculate expiration
  const expires_at =
    expires_days > 0
      ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  // 6. Insert share (use admin to avoid RLS surprises)
  const { data: inserted, error: insErr } = await admin
    .from("report_shares")
    .insert({
      job_id,
      artifact_type,
      token_hash,
      created_by: user.id,
      expires_at,
    })
    .select("id, expires_at")
    .maybeSingle();

  if (insErr || !inserted) {
    // If unique active share constraint triggers, could return existing share
    // For now, fail-closed
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  // 7. Return share URL (token is in URL, never stored)
  const share_url = `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}`;

  return NextResponse.json({
    share_id: inserted.id,
    job_id,
    artifact_type,
    expires_at: inserted.expires_at,
    share_url,
  });
}
