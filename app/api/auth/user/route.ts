import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { enforceApiRateLimit } from "@/lib/security/apiRateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimitDenied = enforceApiRateLimit(request, {
    bucket: "auth_user",
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (rateLimitDenied) return rateLimitDenied;

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json(
      { user: { id: user.id, email: user.email ?? null } },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
