import type { SupabaseClient } from '@supabase/supabase-js';

export type EvaluationProjectStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'waiting_for_user'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type EvaluationStageKey =
  | 'ledger'
  | 'criteria_pack'
  | 'consensus'
  | 'wave_revision_guide'
  | 'trustedpath_apply'
  | 'final_report';

export type EvaluationStageStatus =
  | 'not_started'
  | 'blocked'
  | 'queued'
  | 'running'
  | 'complete'
  | 'waiting_for_user'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'skipped';

export type EvaluationEventType =
  | 'project_created'
  | 'stage_started'
  | 'artifact_written'
  | 'stage_completed'
  | 'stage_failed'
  | 'stage_retried'
  | 'stage_approved'
  | 'ledger_approved';

type JsonRecord = Record<string, unknown>;

function stableIdempotencyKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => String(part ?? 'none').trim().replace(/\s+/g, '_'))
    .join(':');
}

export async function recordEvaluationEvent(params: {
  supabase: SupabaseClient;
  projectId: string;
  stageRunId?: string | null;
  eventType: EvaluationEventType;
  payload?: JsonRecord;
}): Promise<string | null> {
  const { data, error } = await params.supabase
    .from('evaluation_events')
    .insert({
      project_id: params.projectId,
      stage_run_id: params.stageRunId ?? null,
      event_type: params.eventType,
      payload: params.payload ?? {},
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`[workflow] recordEvaluationEvent failed: ${error.message}`);
  }

  return typeof data?.id === 'string' ? data.id : null;
}

export async function createEvaluationProject(params: {
  supabase: SupabaseClient;
  manuscriptId: number;
  userId: string;
  manuscriptVersionHash: string;
  currentStageKey?: EvaluationStageKey | null;
  status?: EvaluationProjectStatus;
}): Promise<string> {
  const { data, error } = await params.supabase
    .from('evaluation_projects')
    .insert({
      manuscript_id: params.manuscriptId,
      user_id: params.userId,
      status: params.status ?? 'queued',
      current_stage_key: params.currentStageKey ?? null,
      manuscript_version_hash: params.manuscriptVersionHash,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(`[workflow] createEvaluationProject failed: ${error?.message ?? 'missing id'}`);
  }

  await recordEvaluationEvent({
    supabase: params.supabase,
    projectId: data.id as string,
    eventType: 'project_created',
    payload: {
      manuscript_id: params.manuscriptId,
      current_stage_key: params.currentStageKey ?? null,
    },
  });

  return data.id as string;
}

export async function createStageRun(params: {
  supabase: SupabaseClient;
  projectId: string;
  stageKey: EvaluationStageKey;
  stagePartitionKey?: string;
  status?: EvaluationStageStatus;
  idempotencyKey?: string;
  maxAttempts?: number;
  inputArtifactIds?: string[];
  checkpoint?: JsonRecord;
}): Promise<string> {
  const stagePartitionKey = params.stagePartitionKey ?? 'default';
  const idempotencyKey = params.idempotencyKey ?? stableIdempotencyKey([
    params.projectId,
    params.stageKey,
    stagePartitionKey,
  ]);

  const { data, error } = await params.supabase
    .from('evaluation_stage_runs')
    .upsert(
      {
        project_id: params.projectId,
        stage_key: params.stageKey,
        stage_partition_key: stagePartitionKey,
        status: params.status ?? 'queued',
        idempotency_key: idempotencyKey,
        max_attempts: params.maxAttempts ?? 3,
        input_artifact_ids: params.inputArtifactIds ?? [],
        checkpoint: params.checkpoint ?? {},
      },
      {
        onConflict: 'project_id,stage_key,stage_partition_key,idempotency_key',
        ignoreDuplicates: false,
      },
    )
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(`[workflow] createStageRun failed: ${error?.message ?? 'missing id'}`);
  }

  return data.id as string;
}

export async function markStageStarted(params: {
  supabase: SupabaseClient;
  projectId: string;
  stageRunId: string;
  payload?: JsonRecord;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await params.supabase
    .from('evaluation_stage_runs')
    .update({
      status: 'running',
      started_at: now,
      updated_at: now,
      last_heartbeat_at: now,
    })
    .eq('id', params.stageRunId);

  if (error) throw new Error(`[workflow] markStageStarted failed: ${error.message}`);

  await recordEvaluationEvent({
    supabase: params.supabase,
    projectId: params.projectId,
    stageRunId: params.stageRunId,
    eventType: 'stage_started',
    payload: params.payload,
  });
}

export async function markStageCompleted(params: {
  supabase: SupabaseClient;
  projectId: string;
  stageRunId: string;
  outputArtifactIds?: string[];
  payload?: JsonRecord;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await params.supabase
    .from('evaluation_stage_runs')
    .update({
      status: 'complete',
      output_artifact_ids: params.outputArtifactIds ?? [],
      completed_at: now,
      updated_at: now,
    })
    .eq('id', params.stageRunId);

  if (error) throw new Error(`[workflow] markStageCompleted failed: ${error.message}`);

  await recordEvaluationEvent({
    supabase: params.supabase,
    projectId: params.projectId,
    stageRunId: params.stageRunId,
    eventType: 'stage_completed',
    payload: params.payload,
  });
}

export async function markStageFailed(params: {
  supabase: SupabaseClient;
  projectId: string;
  stageRunId: string;
  retryable: boolean;
  failureCode: string;
  lastError: string;
  payload?: JsonRecord;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await params.supabase
    .from('evaluation_stage_runs')
    .update({
      status: params.retryable ? 'failed_retryable' : 'failed_terminal',
      failure_code: params.failureCode,
      last_error: params.lastError,
      updated_at: now,
    })
    .eq('id', params.stageRunId);

  if (error) throw new Error(`[workflow] markStageFailed failed: ${error.message}`);

  await recordEvaluationEvent({
    supabase: params.supabase,
    projectId: params.projectId,
    stageRunId: params.stageRunId,
    eventType: 'stage_failed',
    payload: {
      retryable: params.retryable,
      failure_code: params.failureCode,
      last_error: params.lastError,
      ...(params.payload ?? {}),
    },
  });
}
