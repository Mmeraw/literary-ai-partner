import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../lib/supabase";

export async function GET() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("evaluation_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/jobs error", error);
    return NextResponse.json(
      { error: "failed_to_fetch_jobs" },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobs: data ?? [] });
}
