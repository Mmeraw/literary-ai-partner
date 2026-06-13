import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { buildAccessLogEventV1, type AccessLogActionType } from '@/lib/storygate/storygatePersistence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AccessBody =
  | { action: 'request_access'; listingId: string; verificationState: 'verified' | 'unverified' }
  | { action: 'grant_access'; requestId: string; allowedArtifacts: string[] }
  | { action: 'revoke_access'; grantId: string };

async function writeAudit(input: {
  actionType: AccessLogActionType;
  actorUserId: string;
  listingId?: string | null;
  requesterId?: string | null;
  verificationState?: 'verified' | 'unverified' | null;
  failureCodes?: string[];
}) {
  const admin = createAdminClient();
  const audit = buildAccessLogEventV1({
    eventId: crypto.randomUUID(),
    actionType: input.actionType,
    actorUserId: input.actorUserId,
    listingId: input.listingId ?? null,
    requesterId: input.requesterId ?? null,
    verificationState: input.verificationState ?? null,
    validatorsRun: ['storygate_access_control_v1'],
    failureCodes: input.failureCodes ?? [],
  });

  const { error } = await admin
    .from('storygate_access_audit_events')
    .insert({
      id: audit.event_id,
      action_type: audit.action_type,
      listing_id: audit.listing_id,
      requester_id: audit.requester_id,
      actor_user_id: audit.actor_user_id,
      validators_run: audit.validators_run,
      failure_codes: audit.failure_codes,
      verification_state: audit.verification_state,
      canon_hash: audit.canon_hash,
    });

  if (error) throw error;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: AccessBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (body.action === 'request_access') {
    if (body.verificationState !== 'verified') {
      await writeAudit({ actionType: 'request_access', actorUserId: user.id, listingId: body.listingId, requesterId: user.id, verificationState: body.verificationState, failureCodes: ['UNVERIFIED_INDUSTRY_USER'] });
      return NextResponse.json({ error: 'Verified publishing-professional status is required before requesting access' }, { status: 403 });
    }

    const { data, error } = await admin
      .from('storygate_access_requests')
      .insert({ listing_id: body.listingId, requester_id: user.id, verification_state: body.verificationState, decision: 'requested' })
      .select('id, listing_id, requester_id')
      .single();

    if (error || !data) {
      console.error('[Storygate] Failed to persist access request:', error?.message);
      return NextResponse.json({ error: 'Failed to persist access request' }, { status: 500 });
    }

    await writeAudit({ actionType: 'request_access', actorUserId: user.id, listingId: data.listing_id, requesterId: data.requester_id, verificationState: body.verificationState });
    return NextResponse.json({ ok: true, requestId: data.id });
  }

  if (body.action === 'grant_access') {
    const { data: requestRow, error: requestError } = await admin
      .from('storygate_access_requests')
      .select('id, listing_id, requester_id, storygate_project_listings!inner(creator_user_id)')
      .eq('id', body.requestId)
      .single();

    const requestListing = (requestRow as { storygate_project_listings?: { creator_user_id?: string } | Array<{ creator_user_id?: string }> } | null)?.storygate_project_listings;
    const creatorUserId = Array.isArray(requestListing)
      ? requestListing[0]?.creator_user_id
      : requestListing?.creator_user_id;

    if (requestError || !requestRow || creatorUserId !== user.id) {
      return NextResponse.json({ error: 'Only the listing creator may grant access' }, { status: 403 });
    }

    const allowedArtifacts = body.allowedArtifacts.filter((artifact) => typeof artifact === 'string' && artifact.trim().length > 0);
    if (allowedArtifacts.length === 0) {
      return NextResponse.json({ error: 'allowedArtifacts is required' }, { status: 400 });
    }

    const { data: grantRow, error: grantError } = await admin
      .from('storygate_access_grants')
      .insert({
        request_id: requestRow.id,
        listing_id: requestRow.listing_id,
        requester_id: requestRow.requester_id,
        granted_by: user.id,
        allowed_artifacts: allowedArtifacts,
      })
      .select('id')
      .single();

    if (grantError || !grantRow) {
      console.error('[Storygate] Failed to persist access grant:', grantError?.message);
      return NextResponse.json({ error: 'Failed to persist access grant' }, { status: 500 });
    }

    const { error: decisionError } = await admin
      .from('storygate_access_requests')
      .update({ decision: 'approved', decided_by: user.id, decided_at: new Date().toISOString() })
      .eq('id', requestRow.id);

    if (decisionError) {
      console.error('[Storygate] Failed to persist access decision:', decisionError.message);
      return NextResponse.json({ error: 'Failed to persist access decision' }, { status: 500 });
    }

    await writeAudit({ actionType: 'grant_access', actorUserId: user.id, listingId: requestRow.listing_id, requesterId: requestRow.requester_id, verificationState: 'verified' });
    return NextResponse.json({ ok: true, grantId: grantRow.id });
  }

  if (body.action === 'revoke_access') {
    const { data: grantRow, error: grantLookupError } = await admin
      .from('storygate_access_grants')
      .select('id, listing_id, requester_id, storygate_project_listings!inner(creator_user_id)')
      .eq('id', body.grantId)
      .single();

    const grantListing = (grantRow as { storygate_project_listings?: { creator_user_id?: string } | Array<{ creator_user_id?: string }> } | null)?.storygate_project_listings;
    const creatorUserId = Array.isArray(grantListing)
      ? grantListing[0]?.creator_user_id
      : grantListing?.creator_user_id;

    if (grantLookupError || !grantRow || creatorUserId !== user.id) {
      return NextResponse.json({ error: 'Only the listing creator may revoke access' }, { status: 403 });
    }

    const { error: revokeError } = await admin
      .from('storygate_access_grants')
      .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
      .eq('id', grantRow.id)
      .is('revoked_at', null);

    if (revokeError) {
      console.error('[Storygate] Failed to persist access revocation:', revokeError.message);
      return NextResponse.json({ error: 'Failed to persist access revocation' }, { status: 500 });
    }

    await writeAudit({ actionType: 'revoke_access', actorUserId: user.id, listingId: grantRow.listing_id, requesterId: grantRow.requester_id, verificationState: 'verified' });
    return NextResponse.json({ ok: true, grantId: grantRow.id, revoked: true });
  }

  return NextResponse.json({ error: 'Unsupported access action' }, { status: 400 });
}
