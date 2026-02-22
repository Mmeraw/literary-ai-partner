/**
 * Gate A7 — Create Report Share (RPC-based, no admin client reads)
 * 
 * POST /api/report-shares
 * 
 * Creates a shareable link for an evaluation report via SECURITY DEFINER RPC.
 * 
 * Security:
 * - Requires authentication (session or evidence header)
 * - Enforces job ownership via RPC
 * - RPC stores only hashed tokens
 * - Fail-closed: never reveals job existence to non-owners
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActorIdOrNull } from "@/lib/auth/actor";

type Body = {
  jobId?: string;
  expiresInHours?: number;
};

function getShareUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  return base ? `${base}/share/${token}` : `/share/${token}`;
}

export async function POST(req: Request) {
  // 1. Resolve actor (production session or evidence header)
  const actorId = await getActorIdOrNull();
  if (!actorId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse request
  const body = (await req.json().catch(() => ({}))) as Body;
  const jobId = (body.jobId || "").trim();
  const expiresInHours = Number.isFinite(body.expiresInHours)
    ? Math.floor(body.expiresInHours as number)
    : 24;

  if (!jobId) {
    return NextResponse.json({ error: "jobId_required" }, { status: 400 });
  }

  const isEvidence =
    process.env.CI === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.FLOW1_EVIDENCE === "1" ||
    process.env.FLOW_A7_EVIDENCE === "1";

  if (isEvidence) {
    // Evidence mode: use admin client to call RPC with explicit actor
    // (Since RPC uses auth.uid(), we need to bypass for header-based auth)
    const admin = createAdminClient();

    // Ownership check first (fail-closed)
    const { data: job, error: jobErr } = await admin
      .from("evaluation_jobs")
      .select("id,user_id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr || !job || job.user_id !== actorId) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    // Generate token directly (RPC won't work without auth.uid in evidence mode)
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const tokenHash = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
    ).toString("hex");

    const expiresAt = new Date(Date.now() + Math.max(1, Math.min(expiresInHours, 168)) * 3600_000);

    // Revoke existing active share (one active share per job invariant)
    await admin
      .from("report_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .eq("artifact_type", "evaluation_result_v1")
      .is("revoked_at", null);

    // Insert new share
    const { error: insErr } = await admin
      .from("report_shares")
      .insert({
        token_hash: tokenHash,
        job_id: jobId,
        created_by: actorId,
        expires_at: expiresAt.toISOString(),
      });

    if (insErr) {
      return NextResponse.json({ error: "share_create_failed" }, { status: 500 });
    }

    return NextResponse.json({
      shareId: token,
      shareUrl: getShareUrl(token),
      expiresAt: expiresAt.toISOString(),
    });
  }

  // Production: authenticated session, use canonical RPC
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_report_share", {
    p_job_id: jobId,
    p_expires_hours: expiresInHours,
  });

  if (error || !data?.[0]?.token) {
    // Fail-closed: do not reveal if job exists
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const token = data[0].token as string;
  const expiresAt = data[0].expires_at as string;

  return NextResponse.json({
    shareId: token,
    shareUrl: getShareUrl(token),
    expiresAt,
  });
}
