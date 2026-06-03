import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RANGE_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(headers: string[], rows: Array<Record<string, unknown>>): string {
  return [headers.map(cell).join(","), ...rows.map((row) => headers.map((header) => cell(row[header])).join(","))].join("\n");
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const range = req.nextUrl.searchParams.get("range") ?? "7d";
  const kind = req.nextUrl.searchParams.get("kind") ?? "events";
  const includeAdmin = req.nextUrl.searchParams.get("include_admin") === "1";
  const since = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS["7d"])).toISOString();

  try {
    const supabase = createAdminClient();

    if (kind === "sessions") {
      let query = supabase
        .from("site_analytics_sessions")
        .select("id, anonymous_id, started_at, last_seen_at, ended_at, landing_path, referrer, utm_source, utm_medium, utm_campaign, country, region, city, timezone, is_admin_traffic, is_bot")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(10000);

      if (!includeAdmin) query = query.eq("is_admin_traffic", false);
      query = query.eq("is_bot", false);

      const { data, error } = await query;
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });

      const headers = ["id", "anonymous_id", "started_at", "last_seen_at", "ended_at", "landing_path", "referrer", "utm_source", "utm_medium", "utm_campaign", "country", "region", "city", "timezone", "is_admin_traffic", "is_bot"];
      return new NextResponse(csv(headers, (data ?? []) as any[]), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="revisiongrade-analytics-sessions-${range}.csv"`,
        },
      });
    }

    let query = supabase
      .from("site_analytics_events")
      .select("id, session_id, anonymous_id, event_name, path, page_title, target, occurred_at, duration_ms, metadata, is_admin_traffic, is_bot")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(20000);

    if (!includeAdmin) query = query.eq("is_admin_traffic", false);
    query = query.eq("is_bot", false);

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });

    const headers = ["id", "session_id", "anonymous_id", "event_name", "path", "page_title", "target", "occurred_at", "duration_ms", "metadata", "is_admin_traffic", "is_bot"];
    return new NextResponse(csv(headers, (data ?? []) as any[]), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="revisiongrade-analytics-events-${range}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 200 });
  }
}
