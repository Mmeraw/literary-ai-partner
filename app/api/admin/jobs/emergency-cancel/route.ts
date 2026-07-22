import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { PIPELINE_HEALTH_ADMIN_EMAIL } from '@/lib/admin/pipelineHealthAllowlist';
import {
  cancelAllActiveEvaluationsAsOwner,
  OWNER_EMERGENCY_CANCEL_CONFIRMATION,
} from '@/lib/jobs/ownerEmergencyCancel';
import { getClientIp, rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/jobs/emergency-cancel
 *
 * Owner-only break-glass control. It cancels a bounded snapshot of queued and
 * running evaluations via the canonical guarded cancellation state machine.
 * It never deletes records or cancels completed/failed evaluations.
 */
export async function POST(req: NextRequest) {
  const actor = await getAuthenticatedUser();
  if (!actor) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  if (actor.email?.trim().toLowerCase() !== PIPELINE_HEALTH_ADMIN_EMAIL) {
    return NextResponse.json({ ok: false, error: 'Owner emergency access required.' }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  if (!rateLimit(`owner-emergency-cancel:${actor.id}:${ip}`, 1, 60_000)) {
    return NextResponse.json(
      { ok: false, error: 'Emergency cancellation was already requested. Wait one minute before trying again.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null) as { confirmation?: unknown } | null;
  const confirmation = typeof body?.confirmation === 'string' ? body.confirmation : '';
  if (confirmation !== OWNER_EMERGENCY_CANCEL_CONFIRMATION) {
    return NextResponse.json(
      { ok: false, error: 'Type the exact emergency confirmation to continue.' },
      { status: 400 },
    );
  }

  try {
    const result = await cancelAllActiveEvaluationsAsOwner({ actorId: actor.id, confirmation });
    return NextResponse.json({ ok: result.ok, ...result }, { status: result.ok ? 200 : 207 });
  } catch (error) {
    console.error('[owner-emergency-cancel] failed', {
      actorId: actor.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: 'Emergency cancellation could not be completed.' }, { status: 500 });
  }
}
