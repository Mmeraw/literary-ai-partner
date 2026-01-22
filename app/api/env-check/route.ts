import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    has_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
