import 'server-only';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { approveLedgerAction, rejectLedgerAction } from './actions';
import { StoryLedgerShell } from '@/components/ledger/StoryLedgerShell';
import LedgerDownloadButton from '@/components/ledger/LedgerDownloadButton';

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

function relationTitle(job: LedgerJob): string {
  const relation = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  return relation?.title?.trim() || 'Untitled manuscript';
}

function relationOwner(job: LedgerJob): string | null {
  const relation = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  return job.user_id ?? relation?.user_id ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCanonicalIdentityLayer(
  layer: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!layer || Object.keys(layer).length === 0) return layer;

  const rawGroups = Array.isArray(layer.identity_groups)
    ? layer.identity_groups
    : Array.isArray(layer.canonical_identity_group)
      ? layer.canonical_identity_group
      : [];

  if (rawGroups.length === 0) return layer;

  const canonicalIdentityGroup = rawGroups.filter(isRecord).map((group) => {
    const existingAnchors = Array.isArray(group.evidence_anchors) ? group.evidence_anchors : [];
    const firstAppearance = group.first_appearance ? String(group.first_appearance) : null;
    const lastAppearance = group.last_appearance ? String(group.last_appearance) : null;
    const evidenceAnchors = existingAnchors.length > 0
      ? existingAnchors
      : [firstAppearance, lastAppearance].filter(Boolean);

    return {
      ...group,
      role: group.role ?? group.narrative_role,
      legal_name_states: group.legal_name_states ?? group.name_history,
      post_resolution_name_states: group.post_resolution_name_states ?? group.final_status,
      evidence_anchors: evidenceAnchors,
    };
  });

  return {
    ...layer,
    canonical_identity_group: canonicalIdentityGroup,
    identity_group_count:
      typeof layer.identity_group_count === 'number'
        ? layer.identity_group_count
        : canonicalIdentityGroup.length,
  };
}

const RELATIONSHIP_LABEL_ONLY_TERMS = new Set([
  'canadian',
  'driver',
  'driver from highway',
  'foreigner',
  'unnamed',
  'unknown',
  'unknown character',
  'unnamed character',
  'passenger',
  'stranger',
  'man',
  'woman',
  'boy',
  'girl',
  'old man',
  'old woman',
  'guard',
  'soldier',
]);

function normalizeRelationshipName(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (!trimmed || RELATIONSHIP_LABEL_ONLY_TERMS.has(normalized)) return value;

  if (trimmed === normalized && normalized.includes(' ')) {
    return trimmed.replace(/\b[\p{L}]/gu, (char) => char.toLocaleUpperCase());
  }

  return value;
}

function normalizeRelationshipPair(pair: unknown): unknown {
  if (!isRecord(pair)) return pair;

  return {
    ...pair,
    ...(Object.prototype.hasOwnProperty.call(pair, 'character_a')
      ? { character_a: normalizeRelationshipName(pair.character_a) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(pair, 'character_b')
      ? { character_b: normalizeRelationshipName(pair.character_b) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(pair, 'from')
      ? { from: normalizeRelationshipName(pair.from) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(pair, 'to')
      ? { to: normalizeRelationshipName(pair.to) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(pair, 'a')
      ? { a: normalizeRelationshipName(pair.a) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(pair, 'b')
      ? { b: normalizeRelationshipName(pair.b) }
      : {}),
  };
}

function normalizeRelationshipNetworkLayer(
  layer: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!layer || Object.keys(layer).length === 0) return layer;

  const normalizeArrayField = (key: string) =>
    Array.isArray(layer[key])
      ? { [key]: (layer[key] as unknown[]).map(normalizeRelationshipPair) }
      : {};

  return {
    ...layer,
    ...normalizeArrayField('relationship_pairs'),
    ...normalizeArrayField('pairs'),
    ...normalizeArrayField('relationships'),
  };
}

function normalizeStoryLayersForUi(
  layers: Record<string, Record<string, unknown>> | null,
): Record<string, Record<string, unknown>> | null {
  if (!layers) return null;

  const canonicalIdentityLayer = normalizeCanonicalIdentityLayer(layers.canonical_identity_layer);
  const relationshipNetworkLayer = normalizeRelationshipNetworkLayer(layers.relationship_network_layer);

  return {
    ...layers,
    ...(canonicalIdentityLayer ? { canonical_identity_layer: canonicalIdentityLayer } : {}),
    ...(relationshipNetworkLayer ? { relationship_network_layer: relationshipNetworkLayer } : {}),
  };
}

async function getLedgerContext(jobId: string, userId: string) {
  const supabase = createAdminClient();

  const { data: job, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('id, user_id, manuscript_id, status, phase, phase_status, ledger_approved_at, evaluation_project_id, manuscripts(user_id,title)')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) return null;

  const typedJob = job as LedgerJob;
  if (relationOwner(typedJob) !== userId) return null;

  const { data: storyLayerArtifact } = await supabase
    .from('evaluation_artifacts')
    .select('id, content, created_at, source_hash')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_story_layer_v1')
    .maybeSingle();

  const { data: characterArtifact } = await supabase
    .from('evaluation_artifacts')
    .select('id, content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_character_ledger_v1')
    .maybeSingle();

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

  const atReviewGate = job.phase === 'review_gate' && job.phase_status === 'awaiting_approval';
  const approved = Boolean(job.ledger_approved_at) || job.phase === 'phase_2';
  const justApproved = searchParams?.approved === '1';
  const justRejected = searchParams?.rejected === '1';

  const rawStoryLayers = storyLayerContent?.layers ?? null;
  const storyLayers = normalizeStoryLayersForUi(rawStoryLayers);
  const layerCompletionSummary = storyLayerContent?.layer_completion_summary ?? null;

  type CharContent = { ledger_v1?: { coverage_summary?: { hard_fail_triggers?: string[] } } };
  const charContent = characterContent as CharContent | null;
  const hardFails = charContent?.ledger_v1?.coverage_summary?.hard_fail_triggers ?? [];
  const hasHardFails = hardFails.length > 0;

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

  const manuscriptTitle = relationTitle(job);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.5rem 0' }}>
        <LedgerDownloadButton jobId={job.id} />
      </div>
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
    </>
  );
}
