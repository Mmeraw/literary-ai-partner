'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { recordEvaluationEvent } from '@/lib/evaluation/workflow/events';
import { upsertEvaluationArtifact } from '@/lib/evaluation/artifactPersistence';

const LEDGER_ACTIONS = [
  'merge',
  'split',
  'rename',
  'flag_antagonist',
  'reassign_pov',
  'acknowledge_warning',
  'no_change',
] as const;

type LedgerCorrectionAction = typeof LEDGER_ACTIONS[number];
type LedgerTrustScore = 'high' | 'medium' | 'low';

type LedgerUserFeedback = {
  schema_version: 'ledger_user_feedback_v1';
  jobId: string;
  ledgerArtifactId: string;
  lastSavedAt: string;
  lastSavedBy: string;
  characterCorrections: Array<{
    characterId: string;
    action: LedgerCorrectionAction;
    targetCharacterId?: string;
    replacementName?: string;
    operatorNote?: string;
  }>;
  aliasOverrides: Array<{
    canonical: string;
    aliases: string[];
  }>;
  povOwnerOverrides: string[];
  symbolObjectNotes: string;
  antagonistFlagsAdded: string[];
  globalComments: string;
  warningsAcknowledged: string[];
  ledgerTrustScore: LedgerTrustScore;
};

type AcceptedStoryLedger = {
  schema_version: 'accepted_story_ledger_v1';
  jobId: string;
  baseLedgerArtifactId: string;
  userFeedbackArtifactId: string;
  approvedAt: string;
  approvedBy: string;
  acceptedInputBundle: {
    baseLedger: 'pass1a_character_ledger_v1';
    userFeedback: 'ledger_user_feedback_v1';
  };
  normalizedUserCorrections: LedgerUserFeedback;
  ledgerTrustScore: LedgerTrustScore;
};

async function assertOwnedJob(jobId: string, userId: string) {
  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('evaluation_jobs')
    .select('id, user_id, manuscript_id, evaluation_project_id, progress, manuscripts(user_id,title)')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) {
    throw new Error('Unable to load evaluation job.');
  }

  const ownerId =
    (job as { user_id?: string | null }).user_id ??
    ((job as { manuscripts?: { user_id?: string | null } | Array<{ user_id?: string | null }> }).manuscripts &&
      (Array.isArray((job as { manuscripts?: Array<{ user_id?: string | null }> }).manuscripts)
        ? (job as { manuscripts?: Array<{ user_id?: string | null }> }).manuscripts?.[0]?.user_id
        : ((job as { manuscripts?: { user_id?: string | null } }).manuscripts)?.user_id));

  if (ownerId !== userId) {
    throw new Error('Evaluation job is not accessible to this account.');
  }

  return job as {
    id: string;
    manuscript_id: number;
    evaluation_project_id?: string | null;
    progress?: Record<string, unknown> | null;
  };
}

async function loadLedgerArtifact(supabase: ReturnType<typeof createAdminClient>, jobId: string) {
  const { data: ledgerArtifact, error: ledgerError } = await supabase
    .from('evaluation_artifacts')
    .select('id')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_character_ledger_v1')
    .maybeSingle();

  if (ledgerError || !ledgerArtifact?.id) {
    throw new Error('Story Ledger is not ready yet.');
  }

  return ledgerArtifact as { id: string };
}

function stringValue(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function stringArray(formData: FormData, key: string): string[] {
  const values = formData
    .getAll(key)
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);

  const csvValues = stringValue(formData, key)
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set([...values, ...csvValues]));
}

function parseJsonArray(value: string): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeAction(value: unknown): LedgerCorrectionAction {
  const candidate = String(value ?? '').trim();
  return LEDGER_ACTIONS.includes(candidate as LedgerCorrectionAction)
    ? (candidate as LedgerCorrectionAction)
    : 'no_change';
}

function parseCharacterCorrections(formData: FormData): LedgerUserFeedback['characterCorrections'] {
  const raw = stringValue(formData, 'characterCorrections');
  const parsed = parseJsonArray(raw);
  return parsed
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      characterId: String(item.characterId ?? '').trim(),
      action: normalizeAction(item.action),
      targetCharacterId: String(item.targetCharacterId ?? '').trim() || undefined,
      replacementName: String(item.replacementName ?? '').trim() || undefined,
      operatorNote: String(item.operatorNote ?? '').trim() || undefined,
    }))
    .filter((item) => item.characterId.length > 0);
}

function parseAliasOverrides(formData: FormData): LedgerUserFeedback['aliasOverrides'] {
  const raw = stringValue(formData, 'aliasOverrides');
  const parsed = parseJsonArray(raw);
  return parsed
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      canonical: String(item.canonical ?? '').trim(),
      aliases: Array.isArray(item.aliases)
        ? item.aliases.map((alias) => String(alias ?? '').trim()).filter(Boolean)
        : [],
    }))
    .filter((item) => item.canonical.length > 0 && item.aliases.length > 0);
}

function deriveLedgerTrustScore(feedback: Omit<LedgerUserFeedback, 'ledgerTrustScore'>): LedgerTrustScore {
  const structuralCorrectionCount = feedback.characterCorrections.filter((correction) =>
    correction.action === 'merge' ||
    correction.action === 'split' ||
    correction.action === 'rename' ||
    correction.action === 'flag_antagonist' ||
    correction.action === 'reassign_pov'
  ).length;
  const overrideCount =
    structuralCorrectionCount +
    feedback.aliasOverrides.length +
    feedback.povOwnerOverrides.length +
    feedback.antagonistFlagsAdded.length;

  if (overrideCount >= 6) return 'low';
  if (overrideCount >= 2 || feedback.globalComments.length >= 500) return 'medium';
  return 'high';
}

function buildLedgerUserFeedback(args: {
  formData: FormData;
  jobId: string;
  ledgerArtifactId: string;
  userId: string;
  savedAt: string;
}): LedgerUserFeedback {
  const feedbackWithoutTrust: Omit<LedgerUserFeedback, 'ledgerTrustScore'> = {
    schema_version: 'ledger_user_feedback_v1',
    jobId: args.jobId,
    ledgerArtifactId: args.ledgerArtifactId,
    lastSavedAt: args.savedAt,
    lastSavedBy: args.userId,
    characterCorrections: parseCharacterCorrections(args.formData),
    aliasOverrides: parseAliasOverrides(args.formData),
    povOwnerOverrides: stringArray(args.formData, 'povOwnerOverrides'),
    symbolObjectNotes: stringValue(args.formData, 'symbolObjectNotes'),
    antagonistFlagsAdded: stringArray(args.formData, 'antagonistFlagsAdded'),
    globalComments: stringValue(args.formData, 'globalComments'),
    warningsAcknowledged: stringArray(args.formData, 'warningsAcknowledged'),
  };

  return {
    ...feedbackWithoutTrust,
    ledgerTrustScore: deriveLedgerTrustScore(feedbackWithoutTrust),
  };
}

async function persistLedgerUserFeedback(args: {
  supabase: ReturnType<typeof createAdminClient>;
  jobId: string;
  manuscriptId: number;
  ledgerArtifactId: string;
  userId: string;
  formData: FormData;
  savedAt: string;
}): Promise<{ artifactId: string; feedback: LedgerUserFeedback }> {
  const feedback = buildLedgerUserFeedback({
    formData: args.formData,
    jobId: args.jobId,
    ledgerArtifactId: args.ledgerArtifactId,
    userId: args.userId,
    savedAt: args.savedAt,
  });

  const artifactId = await upsertEvaluationArtifact({
    supabase: args.supabase,
    jobId: args.jobId,
    manuscriptId: args.manuscriptId,
    artifactType: 'ledger_user_feedback_v1',
    content: feedback,
    sourceHash: `ledger_user_feedback_v1_${args.jobId}`,
    artifactVersion: 'ledger_user_feedback_v1',
  });

  return { artifactId, feedback };
}

async function persistAcceptedStoryLedger(args: {
  supabase: ReturnType<typeof createAdminClient>;
  jobId: string;
  manuscriptId: number;
  baseLedgerArtifactId: string;
  feedbackArtifactId: string;
  feedback: LedgerUserFeedback;
  userId: string;
  approvedAt: string;
}): Promise<string> {
  const acceptedLedger: AcceptedStoryLedger = {
    schema_version: 'accepted_story_ledger_v1',
    jobId: args.jobId,
    baseLedgerArtifactId: args.baseLedgerArtifactId,
    userFeedbackArtifactId: args.feedbackArtifactId,
    approvedAt: args.approvedAt,
    approvedBy: args.userId,
    acceptedInputBundle: {
      baseLedger: 'pass1a_character_ledger_v1',
      userFeedback: 'ledger_user_feedback_v1',
    },
    normalizedUserCorrections: args.feedback,
    ledgerTrustScore: args.feedback.ledgerTrustScore,
  };

  return upsertEvaluationArtifact({
    supabase: args.supabase,
    jobId: args.jobId,
    manuscriptId: args.manuscriptId,
    artifactType: 'accepted_story_ledger_v1',
    content: acceptedLedger,
    sourceHash: `accepted_story_ledger_v1_${args.jobId}`,
    artifactVersion: 'accepted_story_ledger_v1',
  });
}

export async function submitLedgerFeedbackAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get('jobId') ?? '').trim();
  if (!jobId) throw new Error('Missing job id.');

  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Please sign in to submit ledger feedback.');

  const supabase = createAdminClient();
  const job = await assertOwnedJob(jobId, user.id);
  const ledgerArtifact = await loadLedgerArtifact(supabase, jobId);
  const submittedAt = new Date().toISOString();

  const { artifactId: feedbackArtifactId } = await persistLedgerUserFeedback({
    supabase,
    jobId,
    manuscriptId: Number(job.manuscript_id),
    ledgerArtifactId: ledgerArtifact.id,
    userId: user.id,
    formData,
    savedAt: submittedAt,
  });

  const existingProgress = job.progress && typeof job.progress === 'object' ? job.progress : {};
  await supabase
    .from('evaluation_jobs')
    .update({
      guided_full_novel_stage: 'ledger_feedback_submitted',
      progress: {
        ...existingProgress,
        guided_full_novel_stage: 'ledger_feedback_submitted',
        ledger_user_feedback_id: feedbackArtifactId,
        message: 'Story Ledger feedback saved — awaiting approval',
      },
      updated_at: submittedAt,
    })
    .eq('id', jobId);

  if (job.evaluation_project_id) {
    await recordEvaluationEvent({
      supabase,
      projectId: job.evaluation_project_id,
      eventType: 'stage_approved',
      payload: {
        stage_key: 'ledger',
        job_id: jobId,
        artifact_id: ledgerArtifact.id,
        user_feedback_artifact_id: feedbackArtifactId,
        submitted_by: user.id,
        submitted_at: submittedAt,
        approval_state: 'feedback_submitted_not_approved',
      },
    }).catch((eventError) => {
      console.warn('[submitLedgerFeedbackAction] feedback event failed', eventError);
    });
  }

  redirect(`/evaluate/${jobId}/ledger?feedback=1`);
}

export async function approveLedgerAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get('jobId') ?? '').trim();
  if (!jobId) throw new Error('Missing job id.');

  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Please sign in to approve the ledger.');

  const supabase = createAdminClient();
  const job = await assertOwnedJob(jobId, user.id);
  const ledgerArtifact = await loadLedgerArtifact(supabase, jobId);
  const approvedAt = new Date().toISOString();

  const existingAccepted = await supabase
    .from('evaluation_artifacts')
    .select('id')
    .eq('job_id', jobId)
    .eq('artifact_type', 'accepted_story_ledger_v1')
    .maybeSingle();

  let acceptedStoryLedgerId = existingAccepted.data?.id ? String(existingAccepted.data.id) : null;
  let feedbackArtifactId: string | null = null;

  if (!acceptedStoryLedgerId) {
    const feedbackResult = await persistLedgerUserFeedback({
      supabase,
      jobId,
      manuscriptId: Number(job.manuscript_id),
      ledgerArtifactId: ledgerArtifact.id,
      userId: user.id,
      formData,
      savedAt: approvedAt,
    });
    feedbackArtifactId = feedbackResult.artifactId;

    acceptedStoryLedgerId = await persistAcceptedStoryLedger({
      supabase,
      jobId,
      manuscriptId: Number(job.manuscript_id),
      baseLedgerArtifactId: ledgerArtifact.id,
      feedbackArtifactId: feedbackResult.artifactId,
      feedback: feedbackResult.feedback,
      userId: user.id,
      approvedAt,
    });
  }

  const existingProgress = job.progress && typeof job.progress === 'object' ? job.progress : {};
  const { error: updateError } = await supabase
    .from('evaluation_jobs')
    .update({
      status: 'queued',
      phase: 'phase_2',
      phase_status: 'queued',
      ledger_approved_at: approvedAt,
      ledger_approved_by: user.id,
      guided_full_novel_stage: 'ledger_approved',
      claimed_by: null,
      claimed_at: null,
      lease_token: null,
      lease_until: null,
      progress: {
        ...existingProgress,
        phase: 'phase_2',
        phase_status: 'queued',
        guided_full_novel_stage: 'ledger_approved',
        ledger_approved_at: approvedAt,
        ledger_approved_by: user.id,
        ...(feedbackArtifactId ? { ledger_user_feedback_id: feedbackArtifactId } : {}),
        accepted_story_ledger_id: acceptedStoryLedgerId,
        message: 'Story Ledger approved — accepted story ledger written and Stage 2 queued',
      },
      updated_at: approvedAt,
    })
    .eq('id', jobId);

  if (updateError) {
    throw new Error(`Unable to approve ledger: ${updateError.message}`);
  }

  if (job.evaluation_project_id) {
    await recordEvaluationEvent({
      supabase,
      projectId: job.evaluation_project_id,
      eventType: 'ledger_approved',
      payload: {
        job_id: jobId,
        artifact_id: ledgerArtifact.id,
        user_feedback_artifact_id: feedbackArtifactId,
        accepted_story_ledger_id: acceptedStoryLedgerId,
        approved_by: user.id,
        approved_at: approvedAt,
        next_phase: 'phase_2',
      },
    }).catch((eventError) => {
      console.warn('[approveLedgerAction] ledger approval event failed', eventError);
    });
  }

  redirect(`/evaluate/${jobId}/ledger?approved=1`);
}
