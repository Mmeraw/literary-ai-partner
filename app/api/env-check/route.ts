import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * GET /api/env-check
 *
 * Reports whether essential environment variables are configured.
 * Blocked in production to prevent information disclosure.
 * Requires CRON_SECRET Bearer token in non-production environments.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not available" }, { status: 404 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!cronSecret || !bearer) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const aHash = crypto.createHash("sha256").update(bearer, "utf8").digest();
  const bHash = crypto.createHash("sha256").update(cronSecret, "utf8").digest();
  if (!crypto.timingSafeEqual(aHash, bHash)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    has_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
