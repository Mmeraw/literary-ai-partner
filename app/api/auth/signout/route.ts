import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // best-effort: still clear and redirect
  }
  const url = new URL("/", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
