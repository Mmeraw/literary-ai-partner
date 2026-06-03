import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAllowlist";
import { sanitizeDurationMs, sanitizeEventName, sanitizeMetadata, sanitizePageTitle, sanitizePath, sanitizeTarget } from "@/lib/analytics/sanitizer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length >= 8 && cleaned.length <= 128 ? cleaned : null;
}

function campaign(path: string) {
  const q = path.indexOf("?");
  if (q < 0) return { utm_source: null, utm_medium: null, utm_campaign: null };
  const params = new URLSearchParams(path.slice(q + 1));
  return {
    utm_source: sanitizeTarget(params.get("utm_source")),
    utm_medium: sanitizeTarget(params.get("utm_medium")),
    utm_campaign: sanitizeTarget(params.get("utm_campaign")),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const anonymousId = safeId(body?.anonymousId);
    if (!anonymousId) return NextResponse.json({ ok: true, ignored: true }, { status: 202 });

    const now = new Date().toISOString();
    const eventName = sanitizeEventName(body?.eventName);
    const path = sanitizePath(body?.path);
    const sessionId = safeId(body?.sessionId);
    const utm = campaign(path);
    const user = await getAuthenticatedUser();
    const isAdminTraffic = isPipelineHealthAdminEmail(user?.email ?? null);
    const supabase = createAdminClient();

    let resolvedSessionId = sessionId;
    if (!resolvedSessionId || eventName === "session_start") {
      const { data, error } = await supabase
        .from("site_analytics_sessions")
        .insert({
          anonymous_id: anonymousId,
          user_id: user?.id ?? null,
          started_at: now,
          last_seen_at: now,
          landing_path: sanitizePath(body?.landingPath ?? path),
          referrer: sanitizeTarget(body?.referrer),
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          timezone: sanitizeTarget(body?.timezone),
          is_admin_traffic: isAdminTraffic,
          is_bot: false,
        })
        .select("id")
        .single();

      if (error) return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
      resolvedSessionId = data?.id ?? null;
    } else {
      await supabase
        .from("site_analytics_sessions")
        .update({
          last_seen_at: now,
          ended_at: eventName === "session_end" ? now : null,
          user_id: user?.id ?? null,
          is_admin_traffic: isAdminTraffic,
        })
        .eq("id", resolvedSessionId);
    }

    if (resolvedSessionId) {
      await supabase.from("site_analytics_events").insert({
        session_id: resolvedSessionId,
        anonymous_id: anonymousId,
        user_id: user?.id ?? null,
        event_name: eventName,
        path,
        page_title: sanitizePageTitle(body?.pageTitle),
        occurred_at: now,
        duration_ms: sanitizeDurationMs(body?.durationMs),
        target: sanitizeTarget(body?.target),
        metadata: sanitizeMetadata(body?.metadata),
        is_admin_traffic: isAdminTraffic,
        is_bot: false,
      });
    }

    return NextResponse.json({ ok: true, sessionId: resolvedSessionId }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
  }
}
