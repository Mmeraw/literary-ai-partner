import type { SupabaseClient } from '@supabase/supabase-js';
import { assertWorkerPhaseEntry, type RuntimeArtifactRow } from './checklistRuntimeWiring';
import type { ChecklistPhaseId } from './checklistMatrix';

type WorkerPhase = 'phase_1a' | 'phase_2';

export type WorkerChecklistCandidate = {
  id: string;
  phase: WorkerPhase | string | null;
  status: string | null;
  progress?: Record<string, unknown> | null;
};

export type WorkerChecklistBlock = {
  job_id: string;
  phase: WorkerPhase;
  code: string;
  reason: string;
};

export type WorkerChecklistGateResult = {
  checked: number;
  blocked: WorkerChecklistBlock[];
};

export type ProcessQueuedJobsLike = (options: {
  workerId: string;
  batchSize: number;
  leaseMs: number;
}) => Promise<{
  claimed: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{
    jobId: string;
    error: string;
  }>;
  [key: string]: unknown;
}>;

function toChecklistPhaseId(phase: WorkerChecklistCandidate['phase']): ChecklistPhaseId | null {
  if (phase === 'phase_1a') return 'phase_1a';
  if (phase === 'phase_2') return 'phase_2';
  return null;
}

export function evaluateWorkerChecklistEntry(params: {
  candidate: WorkerChecklistCandidate;
  artifacts: RuntimeArtifactRow[];
}): WorkerChecklistBlock | null {
  const checklistPhaseId = toChecklistPhaseId(params.candidate.phase);
  if (!checklistPhaseId) return null;

  const decision = assertWorkerPhaseEntry(checklistPhaseId, params.artifacts);
  if (decision.ok) return null;

  return {
    job_id: params.candidate.id,
    phase: params.candidate.phase as WorkerPhase,
    code: decision.code,
    reason: decision.reason,
  };
}

async function fetchChecklistCandidateArtifacts(params: {
  supabase: SupabaseClient;
  jobId: string;
}): Promise<RuntimeArtifactRow[]> {
  const { data, error } = await params.supabase
    .from('evaluation_artifacts')
    .select('id, artifact_type, content, source_hash, created_at')
    .eq('job_id', params.jobId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`WORKER_CHECKLIST_ARTIFACT_READ_FAILED: ${error.message}`);
  }

  return (data ?? []) as RuntimeArtifactRow[];
}

async function failBlockedCandidate(params: {
  supabase: SupabaseClient;
  candidate: WorkerChecklistCandidate;
  block: WorkerChecklistBlock;
}): Promise<void> {
  const now = new Date().toISOString();
  const progress = params.candidate.progress && typeof params.candidate.progress === 'object'
    ? params.candidate.progress
    : {};

  const { error } = await params.supabase
    .from('evaluation_jobs')
    .update({
      status: 'failed',
      phase: params.block.phase,
      phase_status: 'failed',
      failure_code: params.block.code,
      last_error: params.block.reason,
      updated_at: now,
      progress: {
        ...progress,
        phase: params.block.phase,
        phase_status: 'failed',
        checklist_entry_gate: 'blocked',
        checklist_entry_gate_code: params.block.code,
        checklist_entry_gate_reason: params.block.reason,
        checklist_entry_gate_blocked_at: now,
      },
    })
    .eq('id', params.candidate.id)
    .in('status', ['queued', 'running']);

  if (error) {
    throw new Error(`WORKER_CHECKLIST_BLOCK_WRITE_FAILED: ${error.message}`);
  }
}

export async function enforceWorkerChecklistEntryGate(params: {
  supabase: SupabaseClient;
  batchSize: number;
}): Promise<WorkerChecklistGateResult> {
  const { data, error } = await params.supabase
    .from('evaluation_jobs')
    .select('id, phase, status, progress')
    .in('status', ['queued', 'running'])
    .in('phase', ['phase_1a', 'phase_2'])
    .order('updated_at', { ascending: true })
    .limit(params.batchSize);

  if (error) {
    throw new Error(`WORKER_CHECKLIST_CANDIDATE_READ_FAILED: ${error.message}`);
  }

  const candidates = (data ?? []) as WorkerChecklistCandidate[];
  const blocked: WorkerChecklistBlock[] = [];

  for (const candidate of candidates) {
    const artifacts = await fetchChecklistCandidateArtifacts({
      supabase: params.supabase,
      jobId: candidate.id,
    });
    const block = evaluateWorkerChecklistEntry({ candidate, artifacts });
    if (!block) continue;

    await failBlockedCandidate({ supabase: params.supabase, candidate, block });
    blocked.push(block);
  }

  return {
    checked: candidates.length,
    blocked,
  };
}

export async function processQueuedJobsWithChecklistEntryGate(params: {
  supabase: SupabaseClient;
  workerId: string;
  batchSize: number;
  leaseMs: number;
  processQueuedJobs: ProcessQueuedJobsLike;
}): Promise<Awaited<ReturnType<ProcessQueuedJobsLike>> & { checklistGate: WorkerChecklistGateResult }> {
  const checklistGate = await enforceWorkerChecklistEntryGate({
    supabase: params.supabase,
    batchSize: params.batchSize,
  });

  const results = await params.processQueuedJobs({
    workerId: params.workerId,
    batchSize: params.batchSize,
    leaseMs: params.leaseMs,
  });

  return {
    ...results,
    checklistGate,
  };
}
