import { NextRequest, NextResponse } from "next/server";

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

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    has_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
