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

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const range = req.nextUrl.searchParams.get("range") ?? "7d";
  const since = new Date(Date.now() - (RANGE_MS[range] ?? RANGE_MS["7d"])).toISOString();
  const includeAdmin = req.nextUrl.searchParams.get("include_admin") === "1";

  try {
    const supabase = createAdminClient();

    let sessionsQuery = supabase
      .from("site_analytics_sessions")
      .select("id, anonymous_id, user_email, started_at, last_seen_at, ended_at, landing_path, country, region, city, device_type, browser, os, is_admin_traffic, is_bot")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(5000);

    let eventsQuery = supabase
      .from("site_analytics_events")
      .select("id, session_id, anonymous_id, event_name, path, target, occurred_at, duration_ms, metadata, is_admin_traffic, is_bot")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(10000);

    if (!includeAdmin) {
      sessionsQuery = sessionsQuery.eq("is_admin_traffic", false);
      eventsQuery = eventsQuery.eq("is_admin_traffic", false);
    }

    sessionsQuery = sessionsQuery.eq("is_bot", false);
    eventsQuery = eventsQuery.eq("is_bot", false);

    const [{ data: sessions, error: sessionsError }, { data: events, error: eventsError }] = await Promise.all([
      sessionsQuery,
      eventsQuery,
    ]);

    if (sessionsError || eventsError) {
      const message = sessionsError?.message ?? eventsError?.message ?? "Unknown analytics query error";
      return NextResponse.json({ ok: false, setupRequired: true, error: message }, { status: 200 });
    }

    const sessionRows = (sessions ?? []) as any[];
    const eventRows = (events ?? []) as any[];
    const uniqueVisitors = new Set(sessionRows.map((s) => s.anonymous_id)).size;
    const pageViews = eventRows.filter((e) => e.event_name === "page_view").length;
    const reviseStarts = eventRows.filter((e) => e.event_name === "revise_example_started").length;
    const reviseCompletions = eventRows.filter((e) => e.event_name === "revise_example_completed").length;
    const evaluationStarts = eventRows.filter((e) => e.event_name === "evaluation_upload_started" || e.event_name === "evaluation_job_created").length;
    const reportViews = eventRows.filter((e) => e.event_name === "evaluation_report_viewed").length;

    const sessionDurations = sessionRows.map((s) => {
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at ?? s.last_seen_at ?? s.started_at).getTime();
      return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
    });

    const sessionsById = new Map<string, any>();
    for (const s of sessionRows) sessionsById.set(s.id, s);
    const pageViewsBySession = new Map<string, number>();
    for (const e of eventRows) {
      if (e.event_name === "page_view" && e.session_id) {
        pageViewsBySession.set(e.session_id, (pageViewsBySession.get(e.session_id) ?? 0) + 1);
      }
    }
    const bounces = sessionRows.filter((s) => (pageViewsBySession.get(s.id) ?? 0) <= 1).length;

    const topPages = Object.values(eventRows.filter((e) => e.event_name === "page_view").reduce((acc: Record<string, any>, e) => {
      const path = e.path || "/";
      acc[path] ??= { path, views: 0, uniqueVisitors: new Set(), avgDurationMs: 0, durations: [] as number[] };
      acc[path].views += 1;
      acc[path].uniqueVisitors.add(e.anonymous_id);
      if (typeof e.duration_ms === "number") acc[path].durations.push(e.duration_ms);
      return acc;
    }, {})).map((row: any) => ({ ...row, uniqueVisitors: row.uniqueVisitors.size, avgDurationMs: avg(row.durations) })).sort((a: any, b: any) => b.views - a.views).slice(0, 20);

    const topClicks = Object.values(eventRows.filter((e) => ["cta_click", "link_click", "download_click", "external_link_click"].includes(e.event_name)).reduce((acc: Record<string, any>, e) => {
      const key = `${e.path}::${e.target ?? e.event_name}`;
      acc[key] ??= { path: e.path, target: e.target ?? e.event_name, clicks: 0, uniqueSessions: new Set() };
      acc[key].clicks += 1;
      if (e.session_id) acc[key].uniqueSessions.add(e.session_id);
      return acc;
    }, {})).map((row: any) => ({ ...row, uniqueSessions: row.uniqueSessions.size })).sort((a: any, b: any) => b.clicks - a.clicks).slice(0, 20);

    const geography = Object.values(sessionRows.reduce((acc: Record<string, any>, s) => {
      const key = [s.country, s.region, s.city].filter(Boolean).join(" · ") || "Unknown";
      acc[key] ??= { location: key, sessions: 0, pageViews: 0, conversions: 0 };
      acc[key].sessions += 1;
      return acc;
    }, {})).map((row: any) => {
      const matchingSessions = new Set(sessionRows.filter((s) => ([s.country, s.region, s.city].filter(Boolean).join(" · ") || "Unknown") === row.location).map((s) => s.id));
      row.pageViews = eventRows.filter((e) => e.event_name === "page_view" && matchingSessions.has(e.session_id)).length;
      row.conversions = eventRows.filter((e) => ["evaluation_job_created", "revise_example_started", "word_download_clicked", "pdf_download_clicked"].includes(e.event_name) && matchingSessions.has(e.session_id)).length;
      return row;
    }).sort((a: any, b: any) => b.sessions - a.sessions).slice(0, 20);

    const reviseSteps = [
      "revise_example_viewed",
      "revise_example_started",
      "revise_example_item_opened",
      "revise_example_filter_used",
      "revise_example_option_selected",
      "revise_example_accept_clicked",
      "revise_example_completed",
    ].map((eventName) => ({ eventName, count: eventRows.filter((e) => e.event_name === eventName).length }));

    const conversionSteps = [
      "page_view",
      "evaluate_page_viewed",
      "evaluation_upload_started",
      "evaluation_job_created",
      "evaluation_report_viewed",
      "word_download_clicked",
      "pdf_download_clicked",
      "agent_readiness_viewed",
      "revise_dashboard_viewed",
    ].map((eventName) => ({ eventName, count: eventRows.filter((e) => e.event_name === eventName).length }));

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      range,
      includeAdmin,
      overview: {
        uniqueVisitors,
        sessions: sessionRows.length,
        pageViews,
        avgSessionDurationMs: avg(sessionDurations),
        bounceRate: pct(bounces, sessionRows.length),
        reviseStarts,
        reviseCompletions,
        reviseCompletionRate: pct(reviseCompletions, reviseStarts),
        evaluationStarts,
        reportViews,
      },
      recentEvents: eventRows.slice(0, 50),
      topPages,
      topClicks,
      geography,
      reviseSteps,
      conversionSteps,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, setupRequired: true, error: err instanceof Error ? err.message : String(err) }, { status: 200 });
  }
}
