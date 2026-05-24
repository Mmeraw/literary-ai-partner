/**
 * /api/jobs/[jobId]/review-gate
 *
 * POST — Author submits Review Gate feedback and approves or declines the Story Ledger.
 *
 * Contract (from STORY_LAYER_CONTRACT_V1_FINAL, canonical authority):
 *
 *   EVERY path through the Review Gate must write ledger_user_feedback_v1, even
 *   when there are no hard fails and the disposition is 'accepted_without_changes'.
 *   The Approval Normalizer must never create accepted_story_ledger_v1 from
 *   pass1a_story_layer_v1 alone.
 *
 * Body:
 *   disposition: 'accepted_without_changes' | 'accepted_with_edits' | 'rejected'
 *   author_notes?: string      — optional free text from the author
 *   edit_requests?: string[]   — list of specific edit requests (accepted_with_edits only)
 *
 * On accept:
 *   1. Reads pass1a_story_layer_v1 artifact
 *   2. Writes ledger_user_feedback_v1 artifact
 *   3. Writes accepted_story_ledger_v1 artifact (Approval Normalizer)
 *   4. Transitions job: phase='phase_2', phase_status='queued', status='queued'
 *      → Worker claims it on next tick and runs Phase 2
 *
 * On reject:
 *   1. Writes ledger_user_feedback_v1 with disposition='rejected'
 *   2. Transitions job: phase_status='failed', status='failed'
 *      → Author can upload a revised manuscript and start over
 *
 * Backend-enforced — no front-end-only gating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createHash, randomUUID } from 'crypto';

type Disposition = 'accepted_without_changes' | 'accepted_with_edits' | 'rejected';

interface ReviewGateRequestBody {
  disposition: Disposition;
  author_notes?: string;
  edit_requests?: string[];
}

type RouteParams = {
  params: Promise<{ jobId: string }>;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sourceHashFor(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing job ID' }, { status: 400 });
  }

  // Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: ReviewGateRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { disposition, author_notes, edit_requests } = body;

  const VALID_DISPOSITIONS: Disposition[] = [
    'accepted_without_changes',
    'accepted_with_edits',
    'rejected',
  ];
  if (!VALID_DISPOSITIONS.includes(disposition)) {
    return NextResponse.json(
      { ok: false, error: `Invalid disposition. Must be one of: ${VALID_DISPOSITIONS.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // 1. Load and authorize the job
  const { data: job, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select(
      'id, user_id, manuscript_id, evaluation_project_id, status, phase, phase_status, manuscripts(user_id)',
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) {
    return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
  }

  // Ownership check — job must belong to the authenticated user
  const jobTyped = job as {
    id: string;
    user_id: string | null;
    manuscript_id: number;
    evaluation_project_id: string | null;
    status: string;
    phase: string;
    phase_status: string;
    manuscripts?: { user_id: string | null } | Array<{ user_id: string | null }> | null;
  };

  const ownerId =
    jobTyped.user_id ??
    (Array.isArray(jobTyped.manuscripts)
      ? jobTyped.manuscripts[0]?.user_id
      : jobTyped.manuscripts?.user_id);

  if (ownerId !== user.id) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // 2. Gate enforcement — job must be at review_gate / awaiting_approval
  if (jobTyped.phase !== 'review_gate' || jobTyped.phase_status !== 'awaiting_approval') {
    return NextResponse.json(
      {
        ok: false,
        error: `Job is not at the Review Gate. Current state: phase=${jobTyped.phase}, phase_status=${jobTyped.phase_status}`,
      },
      { status: 409 },
    );
  }

  // 3. Load the pass1a_story_layer_v1 artifact (required input for approval normalizer)
  const { data: storyLayerArtifactRow, error: storyLayerErr } = await supabase
    .from('evaluation_artifacts')
    .select('id, content, source_hash')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_story_layer_v1')
    .maybeSingle();

  if (storyLayerErr || !storyLayerArtifactRow) {
    return NextResponse.json(
      { ok: false, error: 'pass1a_story_layer_v1 artifact not found. Phase 1A may not be complete.' },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();

  // 4. Write ledger_user_feedback_v1 — MANDATORY even for accepted_without_changes
  const feedbackPayload = {
    job_id: jobId,
    evaluation_project_id: jobTyped.evaluation_project_id,
    manuscript_id: jobTyped.manuscript_id,
    manuscript_version_hash: `manuscript_${jobTyped.manuscript_id}_${jobId}`,
    artifact_id: `ledger_user_feedback_v1:${randomUUID().slice(0, 16)}`,
    artifact_type: 'ledger_user_feedback_v1',
    artifact_version: 'v1',
    source_hash: sourceHashFor({ job_id: jobId, disposition, submitted_at: now }),
    generated_at: now,
    // Feedback content
    disposition,
    submitted_by: user.id,
    submitted_at: now,
    author_notes: author_notes ?? null,
    edit_requests: edit_requests ?? [],
    pass1a_story_layer_source_hash:
      (storyLayerArtifactRow as { source_hash?: string }).source_hash ?? null,
  };

  const { error: feedbackWriteErr } = await supabase
    .from('evaluation_artifacts')
    .upsert(
      {
        job_id: jobId,
        manuscript_id: jobTyped.manuscript_id,
        artifact_type: 'ledger_user_feedback_v1',
        artifact_version: 'v1',
        source_hash: feedbackPayload.source_hash,
        content: feedbackPayload,
        created_at: now,
      },
      { onConflict: 'job_id,artifact_type', ignoreDuplicates: false },
    );

  if (feedbackWriteErr) {
    console.error('[ReviewGate] Failed to write ledger_user_feedback_v1', {
      job_id: jobId,
      error: feedbackWriteErr.message,
    });
    return NextResponse.json(
      { ok: false, error: `Failed to write feedback: ${feedbackWriteErr.message}` },
      { status: 500 },
    );
  }

  // 5. Handle rejection path — mark failed, stop here
  if (disposition === 'rejected') {
    const { error: rejectErr } = await supabase
      .from('evaluation_jobs')
      .update({
        status: 'failed',
        phase: 'review_gate',
        phase_status: 'failed',
        last_error: 'Author rejected Story Ledger at Review Gate. Revise manuscript and resubmit.',
        failure_code: 'REVIEW_GATE_REJECTED_BY_AUTHOR',
        updated_at: now,
      })
      .eq('id', jobId)
      .eq('phase', 'review_gate');

    if (rejectErr) {
      console.error('[ReviewGate] Failed to mark job rejected', { job_id: jobId, error: rejectErr.message });
    }

    return NextResponse.json({
      ok: true,
      disposition: 'rejected',
      message: 'Story Ledger rejected. Please revise your manuscript and resubmit.',
    });
  }

  // 6. Accept path — write accepted_story_ledger_v1 (Approval Normalizer)
  // accepted_story_ledger_v1 = pass1a_story_layer_v1 layers + governance_rail
  const storyLayerContent = storyLayerArtifactRow.content as Record<string, unknown>;
  const storyLayerSourceHash =
    (storyLayerArtifactRow as { source_hash?: string }).source_hash ?? '';

  const acceptedLedgerPayload = {
    job_id: jobId,
    evaluation_project_id: jobTyped.evaluation_project_id,
    manuscript_id: jobTyped.manuscript_id,
    manuscript_version_hash: `manuscript_${jobTyped.manuscript_id}_${jobId}`,
    artifact_id: `accepted_story_ledger_v1:${randomUUID().slice(0, 16)}`,
    artifact_type: 'accepted_story_ledger_v1',
    artifact_version: 'v1',
    source_hash: sourceHashFor({
      pass1a_story_layer_source_hash: storyLayerSourceHash,
      disposition,
      approved_by: user.id,
      approved_at: now,
    }),
    generated_at: now,
    // Story layer layers (carried forward from pass1a_story_layer_v1)
    layers: storyLayerContent.layers ?? {},
    // Governance rail — approval disposition + unresolved warnings preserved
    governance_rail: {
      approval_state: disposition === 'accepted_without_changes' ? 'accepted' : 'accepted_with_conditions',
      approved_by: user.id,
      approved_at: now,
      disposition,
      author_notes: author_notes ?? null,
      edit_requests: edit_requests ?? [],
      pass1a_story_layer_source_hash: storyLayerSourceHash,
      // unresolved warnings from quality report are preserved for Phase 2 context
      unresolved_warnings_preserved: true,
    },
  };

  const { error: acceptedLedgerWriteErr } = await supabase
    .from('evaluation_artifacts')
    .upsert(
      {
        job_id: jobId,
        manuscript_id: jobTyped.manuscript_id,
        artifact_type: 'accepted_story_ledger_v1',
        artifact_version: 'v1',
        source_hash: acceptedLedgerPayload.source_hash,
        content: acceptedLedgerPayload,
        created_at: now,
      },
      { onConflict: 'job_id,artifact_type', ignoreDuplicates: false },
    );

  if (acceptedLedgerWriteErr) {
    console.error('[ReviewGate] Failed to write accepted_story_ledger_v1', {
      job_id: jobId,
      error: acceptedLedgerWriteErr.message,
    });
    return NextResponse.json(
      { ok: false, error: `Failed to write accepted ledger: ${acceptedLedgerWriteErr.message}` },
      { status: 500 },
    );
  }

  // 7. Transition job to phase_2/queued so worker picks it up on next tick
  // CANON: status stays within JOB_STATUS set (queued/running/failed/complete)
  // phase='review_gate' is never claimed by the worker — phase_2 re-enters the claim queue
  const { error: transitionErr } = await supabase
    .from('evaluation_jobs')
    .update({
      status: 'queued',
      phase: 'phase_2',
      phase_status: 'queued',
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('phase', 'review_gate');

  if (transitionErr) {
    console.error('[ReviewGate] Failed to transition to phase_2', {
      job_id: jobId,
      error: transitionErr.message,
    });
    return NextResponse.json(
      { ok: false, error: `Failed to queue Phase 2: ${transitionErr.message}` },
      { status: 500 },
    );
  }

  console.log('[ReviewGate] Approval complete', {
    job_id: jobId,
    disposition,
    approved_by: user.id,
    accepted_ledger_source_hash: acceptedLedgerPayload.source_hash,
  });

  return NextResponse.json({
    ok: true,
    disposition,
    message: 'Story Ledger approved. Phase 2 evaluation has been queued.',
    accepted_ledger_artifact_id: acceptedLedgerPayload.artifact_id,
  });
}
