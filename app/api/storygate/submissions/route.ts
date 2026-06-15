import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { buildStorygateSubmissionRequestV1, buildAccessLogEventV1 } from '@/lib/storygate/storygatePersistence';
import type { CreatorApprovalV1 } from '@/lib/agent-readiness/creatorApprovalGate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StorygateSubmissionBody = {
  manuscriptId: number | string;
  evaluationJobId: string;
  packageHash: string;
  projectTitle: string;
  primaryGenre: string;
  creatorName: string;
  creatorEmail: string;
  packageFields: Record<string, unknown>;
  readinessScore?: number | null;
  qualifiedProfessionalEquivalent?: boolean;
  requestedScopeText?: string | null;
};

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: StorygateSubmissionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const manuscriptId = Number(body.manuscriptId);
  if (!Number.isFinite(manuscriptId) || !body.evaluationJobId || !body.packageHash || !body.projectTitle || !body.creatorEmail) {
    return NextResponse.json({ error: 'manuscriptId, evaluationJobId, packageHash, projectTitle, and creatorEmail are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: approvalRow, error: approvalError } = await admin
    .from('agent_readiness_creator_approvals')
    .select('approval_state, approved, manuscript_id, evaluation_job_id, package_hash, decided_by, decided_at')
    .eq('user_id', user.id)
    .eq('manuscript_id', manuscriptId)
    .eq('evaluation_job_id', body.evaluationJobId)
    .eq('package_hash', body.packageHash)
    .eq('approval_state', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvalError) {
    console.error('[Storygate] Failed to load creator approval:', approvalError.message);
    return NextResponse.json({ error: 'Failed to load creator approval' }, { status: 500 });
  }

  if (!approvalRow) {
    return NextResponse.json({ error: 'Approved creator_approval_v1 is required before Storygate submission' }, { status: 422 });
  }

  const creatorApproval: CreatorApprovalV1 = {
    artifact_type: 'creator_approval_v1',
    artifact_version: 'creator_approval_v1',
    approval_state: approvalRow.approval_state,
    approved: approvalRow.approved,
    manuscript_id: String(approvalRow.manuscript_id),
    evaluation_job_id: approvalRow.evaluation_job_id,
    package_hash: approvalRow.package_hash,
    decided_by: approvalRow.decided_by,
    decided_at: approvalRow.decided_at,
  };

  const submission = buildStorygateSubmissionRequestV1({
    manuscriptId,
    evaluationJobId: body.evaluationJobId,
    packageHash: body.packageHash,
    creatorUserId: user.id,
    projectTitle: body.projectTitle,
    primaryGenre: body.primaryGenre,
    creatorName: body.creatorName,
    creatorEmail: body.creatorEmail,
    packageFields: body.packageFields ?? {},
    creatorApproval,
    readinessScore: body.readinessScore ?? null,
    qualifiedProfessionalEquivalent: body.qualifiedProfessionalEquivalent ?? false,
    requestedScopeText: body.requestedScopeText ?? null,
  });

  if (!submission.validation_result.valid) {
    return NextResponse.json({ error: 'Storygate submission validation failed', validation: submission.validation_result }, { status: 422 });
  }

  const { data: submissionRow, error: submissionError } = await admin
    .from('storygate_submissions')
    .insert({
      creator_user_id: user.id,
      manuscript_id: manuscriptId,
      evaluation_job_id: body.evaluationJobId,
      package_hash: body.packageHash,
      submission_hash: submission.submission_hash,
      artifact_type: submission.artifact_type,
      artifact_version: submission.artifact_version,
      project_title: submission.project_title,
      primary_genre: submission.primary_genre,
      creator_name: submission.creator_name,
      creator_email: submission.creator_email,
      package_fields: submission.package_fields,
      readiness_score: submission.readiness_score,
      qualified_professional_equivalent: submission.qualified_professional_equivalent,
      status: submission.status,
      validation_result: submission.validation_result,
    })
    .select('id')
    .single();

  if (submissionError || !submissionRow) {
    console.error('[Storygate] Failed to persist submission:', submissionError?.message);
    return NextResponse.json({ error: 'Failed to persist Storygate submission' }, { status: 500 });
  }

  const { data: listingRow, error: listingError } = await admin
    .from('storygate_project_listings')
    .insert({
      submission_id: submissionRow.id,
      creator_user_id: user.id,
      manuscript_id: manuscriptId,
      creator_email: body.creatorEmail,
      visibility: 'private',
      access_requires_approval: true,
    })
    .select('id')
    .single();

  if (listingError || !listingRow) {
    console.error('[Storygate] Failed to persist private listing:', listingError?.message);
    return NextResponse.json({ error: 'Failed to persist Storygate listing' }, { status: 500 });
  }

  const audit = buildAccessLogEventV1({
    eventId: crypto.randomUUID(),
    actionType: 'listing_created',
    actorUserId: user.id,
    listingId: listingRow.id,
    requesterId: null,
    verificationState: null,
    validatorsRun: ['storygate_submission_validator_v1'],
    failureCodes: submission.validation_result.failureCodes,
  });

  const { error: auditError } = await admin
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

  if (auditError) {
    console.error('[Storygate] Failed to persist listing audit event:', auditError.message);
    return NextResponse.json({ error: 'Failed to persist Storygate audit event' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, submissionId: submissionRow.id, listingId: listingRow.id, submissionHash: submission.submission_hash });
}
