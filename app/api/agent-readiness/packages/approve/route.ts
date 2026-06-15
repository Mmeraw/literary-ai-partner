import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { buildPersistedCreatorApprovalV1 } from '@/lib/agent-readiness/packagePersistence';
import type { CreatorApprovalState } from '@/lib/agent-readiness/creatorApprovalGate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ApprovePackageRequest = {
  packageHash: string;
  approvalState: CreatorApprovalState;
};

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ApprovePackageRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.packageHash || !['pending', 'approved', 'rejected'].includes(body.approvalState)) {
    return NextResponse.json({ error: 'packageHash and canonical approvalState are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: packageRow, error: packageError } = await admin
    .from('agent_readiness_packages')
    .select('id, manuscript_id, evaluation_job_id, package_hash')
    .eq('user_id', user.id)
    .eq('package_hash', body.packageHash)
    .single();

  if (packageError || !packageRow) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  const decidedAt = new Date().toISOString();
  const approval = buildPersistedCreatorApprovalV1({
    manuscriptId: packageRow.manuscript_id,
    evaluationJobId: packageRow.evaluation_job_id,
    packageHash: packageRow.package_hash,
    approvalState: body.approvalState,
    decidedBy: user.id,
    decidedAt,
  });

  const { data, error } = await admin
    .from('agent_readiness_creator_approvals')
    .insert({
      package_id: packageRow.id,
      user_id: user.id,
      manuscript_id: Number(approval.manuscript_id),
      evaluation_job_id: approval.evaluation_job_id,
      package_hash: approval.package_hash,
      artifact_type: approval.artifact_type,
      artifact_version: approval.artifact_version,
      approval_state: approval.approval_state,
      approved: approval.approved,
      decided_by: user.id,
      decided_at: decidedAt,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[AgentReadiness] Failed to persist creator approval:', error?.message);
    return NextResponse.json({ error: 'Failed to persist creator approval' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, approvalId: data.id, approval });
}
