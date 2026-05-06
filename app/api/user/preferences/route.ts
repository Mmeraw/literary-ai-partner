/**
 * User preferences endpoint — timezone preference only.
 *
 * GET  /api/user/preferences  → { timezone: string | null }
 * PATCH /api/user/preferences  body: { timezone: string | null }
 *                              → { timezone: string | null }
 *
 * Reads and writes `public.user_preferences.timezone` via the authenticated
 * user's own RLS context (no admin client). The canonical storage layer
 * (evaluation timestamps, audit trails) is unaffected.
 *
 * Fails safely:
 * - Unauthenticated requests → 401
 * - Malformed body / invalid timezone format → 400
 * - Database errors are returned as 500 (not masked as 400)
 */

import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Matches the same pattern as the DB constraint */
const IANA_TZ_RE = /^[A-Za-z_]+([/+][A-Za-z0-9_+.-]+)*$/;

// ============================================================================
// GET — read timezone preference
// ============================================================================

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[user/preferences GET] DB error:', error.message);
    return NextResponse.json({ error: 'Failed to read preferences' }, { status: 500 });
  }

  return NextResponse.json(
    { timezone: data?.timezone ?? null },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}

// ============================================================================
// PATCH — upsert timezone preference
// ============================================================================

export async function PATCH(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || !('timezone' in body)) {
    return NextResponse.json({ error: 'Missing timezone field' }, { status: 400 });
  }

  const { timezone } = body as { timezone: unknown };

  if (timezone !== null && (typeof timezone !== 'string' || !IANA_TZ_RE.test(timezone))) {
    return NextResponse.json({ error: 'Invalid timezone format' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, timezone }, { onConflict: 'user_id' })
    .select('timezone')
    .single();

  if (error) {
    console.error('[user/preferences PATCH] DB error:', error.message);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }

  return NextResponse.json(
    { timezone: data?.timezone ?? null },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
