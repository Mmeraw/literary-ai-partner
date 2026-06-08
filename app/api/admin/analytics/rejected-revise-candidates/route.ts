import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregateRejectedReviseCandidateAnalytics } from "@/lib/admin/rejectedReviseCandidateAnalytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RANGE_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const range = req.nextUrl.searchParams.get("range") ?? "7d";
  const now = Date.now();
  const since = range === "all"
    ? null
    : new Date(now - (RANGE_MS[range] ?? RANGE_MS["7d"])).toISOString();

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from("revision_events")
      .select("created_at, metadata")
      .eq("event_code", "REVISION_CANDIDATE_REJECTED");

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch rejected candidate telemetry",
          message: error.message,
        },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as Array<{ created_at?: string; metadata?: unknown }>;
    const aggregates = aggregateRejectedReviseCandidateAnalytics(rows);

    return NextResponse.json({
      success: true,
      data: aggregates,
      meta: {
        range,
        since,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Rejected analytics route failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
