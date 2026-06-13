import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { AGENT_READINESS_REQUIRED_SECTION_TYPES } from '@/lib/agent-readiness/packagePersistence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ApproveSectionRequest = {
  manuscriptId: number | string;
  evaluationJobId: string;
  sectionType: string;
};

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ApproveSectionRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const manuscriptId = Number(body.manuscriptId);
  if (!Number.isFinite(manuscriptId) || !body.evaluationJobId || !body.sectionType) {
    return NextResponse.json({ error: 'manuscriptId, evaluationJobId, and sectionType are required' }, { status: 400 });
  }

  if (!AGENT_READINESS_REQUIRED_SECTION_TYPES.includes(body.sectionType as typeof AGENT_READINESS_REQUIRED_SECTION_TYPES[number])) {
    return NextResponse.json({ error: `Invalid sectionType: ${body.sectionType}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const approvedAt = new Date().toISOString();
  const { data, error } = await admin
    .from('agent_readiness_sections')
    .update({
      status: 'approved',
      approved_at: approvedAt,
      updated_at: approvedAt,
    })
    .eq('user_id', user.id)
    .eq('manuscript_id', manuscriptId)
    .eq('evaluation_job_id', body.evaluationJobId)
    .eq('section_type', body.sectionType)
    .select('section_type, status, approved_at')
    .single();

  if (error) {
    console.error('[AgentReadiness] Failed to approve section:', error.message);
    return NextResponse.json({ error: 'Failed to approve section' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 });
  }

  const { error: auditError } = await admin
    .from('agent_readiness_author_review_decisions')
    .insert({
      user_id: user.id,
      manuscript_id: manuscriptId,
      evaluation_job_id: body.evaluationJobId,
      section_type: body.sectionType,
      decision: 'approved',
      decided_at: approvedAt,
    });

  if (auditError) {
    console.error('[AgentReadiness] Failed to persist author review decision:', auditError.message);
    return NextResponse.json({ error: 'Failed to persist author review decision' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sectionType: data.section_type, status: data.status, approvedAt: data.approved_at });
}
