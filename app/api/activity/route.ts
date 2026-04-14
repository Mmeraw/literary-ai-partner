import { NextResponse } from "next/server";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

type ActivityRow = {
  id: string;
  event_type: string;
  detail: string | null;
  route: string | null;
  href: string | null;
  link_label: string | null;
  created_at: string;
};

function sanitizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function mapRow(row: ActivityRow) {
  return {
    id: row.id,
    timestamp: row.created_at,
    event: row.event_type,
    ...(row.detail ? { detail: row.detail } : {}),
    ...(row.route ? { route: row.route } : {}),
    ...(row.href ? { href: row.href } : {}),
    ...(row.link_label ? { linkLabel: row.link_label } : {}),
  };
}

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "200", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 300) : 200;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_activity_events")
      .select("id, event_type, detail, route, href, link_label, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to load activity", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      items: (data ?? []).map((row) => mapRow(row as ActivityRow)),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const eventType = sanitizeText(body.event, 120);
    if (!eventType) {
      return NextResponse.json({ ok: false, error: "event is required" }, { status: 400 });
    }

    const detail = sanitizeText(body.detail, 1000);
    const route = sanitizeText(body.route, 300);
    const href = sanitizeText(body.href, 500);
    const linkLabel = sanitizeText(body.linkLabel, 120);

    const supabase = await createClient();

    const { error } = await supabase.from("user_activity_events").insert({
      user_id: user.id,
      event_type: eventType,
      detail,
      route,
      href,
      link_label: linkLabel,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to write activity", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const user = await getAuthenticatedUser();
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from("user_activity_events").delete().eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to clear activity", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unexpected error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
