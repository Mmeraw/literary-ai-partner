import 'server-only';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { approveLedgerAction, rejectLedgerAction } from './actions';
import { StoryLedgerShell } from '@/components/ledger/StoryLedgerShell';

// ─── Types ───────────────────────────────────────────────────────────────────

type LedgerJob = {
  id: string;
  user_id?: string | null;
  manuscript_id?: number | null;
  status?: string | null;
  phase?: string | null;
  phase_status?: string | null;
  ledger_approved_at?: string | null;
  evaluation_project_id?: string | null;
  manuscripts?:
    | { user_id?: string | null; title?: string | null }
    | Array<{ user_id?: string | null; title?: string | null }>
    | null;
};

type StoryLayerContent = {
  layers?: Record<string, Record<string, unknown>>;
  layer_completion_summary?: {
    total_layers: number;
    populated_layers: number;
    empty_layers?: string[];
    degraded_layers?: string[];
  };
};

type AcceptedLedgerContent = {
  approval?: {
    status?: string;
    approved_by_user_id?: string;
    approved_by_role?: string;
    approved_at?: string;
    blocking_failures_resolved?: boolean;
    approval_notes?: string;
  };
  governance?: {
    gate_status?: string;
    warnings?: Array<{
      warning_id?: string;
      severity?: 'info' | 'soft_fail' | 'hard_fail';
      affected_layer?: string;
      affected_character_or_object?: string | null;
      evidence_location?: string[];
      reason?: string;
      suggested_resolution?: string;
      blocking_status?: boolean;
    }>;
  };
  story_layer?: Record<string, Record<string, unknown>>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relationTitle(job: LedgerJob): string {
  const relation = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  return relation?.title?.trim() || 'Untitled manuscript';
}

function relationOwner(job: LedgerJob): string | null {
  const relation = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  return job.user_id ?? relation?.user_id ?? null;
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getLedgerContext(jobId: string, userId: string) {
  const supabase = createAdminClient();

  const { data: job, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select(
      'id, user_id, manuscript_id, status, phase, phase_status, ledger_approved_at, evaluation_project_id, manuscripts(user_id,title)',
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) return null;

  const typedJob = job as LedgerJob;
  if (relationOwner(typedJob) !== userId) return null;

  // ── pass1a_story_layer_v1 (Module 1 data)
  const { data: storyLayerArtifact } = await supabase
    .from('evaluation_artifacts')
    .select('id, content, created_at, source_hash')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_story_layer_v1')
    .maybeSingle();

  // ── pass1a_character_ledger_v1 (legacy — used for hard_fail_triggers)
  const { data: characterArtifact } = await supabase
    .from('evaluation_artifacts')
    .select('id, content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_character_ledger_v1')
    .maybeSingle();

  // ── accepted_story_ledger_v1 (Module 3 data)
  const { data: acceptedLedgerArtifact } = await supabase
    .from('evaluation_artifacts')
    .select('id, content, created_at')
    .eq('job_id', jobId)
    .eq('artifact_type', 'accepted_story_ledger_v1')
    .maybeSingle();

  return {
    job: typedJob,
    storyLayerContent: (storyLayerArtifact?.content ?? null) as StoryLayerContent | null,
    characterContent: characterArtifact?.content ?? null,
    acceptedLedgerContent: (acceptedLedgerArtifact?.content ?? null) as AcceptedLedgerContent | null,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StoryLedgerPage({
  params,
  searchParams,
}: {
  params: { jobId: string };
  searchParams?: { approved?: string; rejected?: string };
}) {
  const user = await getAuthenticatedUser();
  if (!user) notFound();

  const context = await getLedgerContext(params.jobId, user.id);
  if (!context) notFound();

  const { job, storyLayerContent, characterContent, acceptedLedgerContent } = context;

  // ── Gate / approval state
  const atReviewGate =
    job.phase === 'review_gate' && job.phase_status === 'awaiting_approval';
  const approved = Boolean(job.ledger_approved_at) || job.phase === 'phase_2';
  const justApproved = searchParams?.approved === '1';
  const justRejected = searchParams?.rejected === '1';

  // ── Story layers (Module 1)
  const storyLayers = storyLayerContent?.layers ?? null;
  const layerCompletionSummary = storyLayerContent?.layer_completion_summary ?? null;

  // ── Hard fails (from legacy character ledger, for Module 2 blocking alert)
  type CharContent = { ledger_v1?: { coverage_summary?: { hard_fail_triggers?: string[] } } };
  const charContent = characterContent as CharContent | null;
  const hardFails = charContent?.ledger_v1?.coverage_summary?.hard_fail_triggers ?? [];
  const hasHardFails = hardFails.length > 0;

  // ── Accepted ledger (Module 3)
  const acceptedLedger = acceptedLedgerContent
    ? {
        approved_at: acceptedLedgerContent.approval?.approved_at ?? null,
        approved_by_role: acceptedLedgerContent.approval?.approved_by_role ?? null,
        approval_status: acceptedLedgerContent.approval?.status ?? null,
        governance_warnings: acceptedLedgerContent.governance?.warnings ?? [],
        layer_count: acceptedLedgerContent.story_layer
          ? Object.keys(acceptedLedgerContent.story_layer).length
          : 8,
      }
    : null;

  const manuscriptTitle = (() => {
    const rel = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
    return rel?.title?.trim() || 'Untitled manuscript';
  })();

  return (
    <StoryLedgerShell
      jobId={job.id}
      manuscriptTitle={manuscriptTitle}
      atReviewGate={atReviewGate}
      approved={approved}
      justApproved={justApproved}
      justRejected={justRejected}
      storyLayers={storyLayers}
      layerCompletionSummary={layerCompletionSummary}
      hardFails={hardFails}
      hasHardFails={hasHardFails}
      acceptedLedger={acceptedLedger}
      approveLedgerAction={approveLedgerAction}
      rejectLedgerAction={rejectLedgerAction}
    />
  );
}
