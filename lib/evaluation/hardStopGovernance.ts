export type HardStopCode =
  | 'POST_PHASE0_HANDOFF_TIMEOUT'
  | 'STATE_SPLIT_BRAIN_DETECTED'
  | 'PIPELINE_GLOBAL_SLA_EXCEEDED'
  | 'PROVIDER_BUDGET_EXCEEDED';

export interface QueueHardStopCandidate {
  id: string;
  status: string;
  phase: string | null;
  phase_status: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  phase0_completed_at?: string | null;
  manuscript_word_count?: number | null;
  progress?: Record<string, unknown> | null;
}

export interface HardStopDecision {
  code: HardStopCode;
  reason: string;
}

export interface MaxAgeKillSwitchCandidate {
  id: string;
  status: string;
  phase_status?: string | null;
}

export interface MaxAgeKillSwitchPartition {
  runningIds: string[];
  queuedEligibleIds: string[];
  queuedSkippedIds: string[];
}

/**
 * Partition max-age kill-switch candidates into legally writable transition sets.
 *
 * DB lifecycle trigger forbids queued -> failed for phase_status. To terminalize a
 * queued row safely, workers must first promote queued -> running (legal), then
 * running -> failed (legal). Rows queued with non-queued phase_status (e.g.
 * awaiting_approval) are intentionally skipped by the max-age kill switch.
 */
export function partitionMaxAgeKillSwitchCandidates(
  rows: MaxAgeKillSwitchCandidate[],
): MaxAgeKillSwitchPartition {
  const runningIds: string[] = [];
  const queuedEligibleIds: string[] = [];
  const queuedSkippedIds: string[] = [];

  for (const row of rows) {
    if (row.status === 'running') {
      runningIds.push(row.id);
      continue;
    }

    if (row.status === 'queued') {
      if ((row.phase_status ?? null) === 'queued') {
        queuedEligibleIds.push(row.id);
      } else {
        queuedSkippedIds.push(row.id);
      }
    }
  }

  return { runningIds, queuedEligibleIds, queuedSkippedIds };
}

function toIsoMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSplitBrainState(job: QueueHardStopCandidate): boolean {
  const progress = job.progress ?? {};
  const progressPhase = typeof progress.phase === 'string' ? progress.phase : null;
  const progressPhaseStatus = typeof progress.phase_status === 'string' ? progress.phase_status : null;

  if (progressPhase && job.phase && progressPhase !== job.phase) {
    return true;
  }

  if (progressPhaseStatus && job.phase_status && progressPhaseStatus !== job.phase_status) {
    return true;
  }

  return false;
}

/**
 * Determine if a split-brain state is auto-healable (only progress.phase_status
 * diverges from the column) vs structural (phase itself diverges).
 *
 * Auto-healable: column is source of truth — just sync progress to match.
 * Structural: phases disagree — requires full investigation / failure.
 */
export function classifySplitBrain(job: QueueHardStopCandidate): 'healable' | 'structural' | 'none' {
  const progress = job.progress ?? {};
  const progressPhase = typeof progress.phase === 'string' ? progress.phase : null;
  const progressPhaseStatus = typeof progress.phase_status === 'string' ? progress.phase_status : null;

  // Phase divergence = structural (can't auto-heal)
  if (progressPhase && job.phase && progressPhase !== job.phase) {
    return 'structural';
  }

  // Only phase_status diverges = auto-healable (column is authoritative)
  if (progressPhaseStatus && job.phase_status && progressPhaseStatus !== job.phase_status) {
    return 'healable';
  }

  return 'none';
}

export function isPostPhase0HandoffLimbo(job: QueueHardStopCandidate, args: {
  nowMs: number;
  graceMs: number;
  hasSeedArtifacts: boolean;
}): boolean {
  if (job.status !== 'queued') return false;
  if (job.phase !== 'phase_1a') return false;
  if (job.phase_status !== 'queued') return false;
  if (!job.phase0_completed_at) return false;
  if (args.hasSeedArtifacts) return false;

  const updatedAtMs = toIsoMs(job.updated_at ?? job.created_at);
  if (updatedAtMs === null) return false;

  return args.nowMs - updatedAtMs >= args.graceMs;
}

export function isGlobalSlaExceeded(job: QueueHardStopCandidate, args: {
  nowMs: number;
  shortFormSlaMs: number;
  longFormSlaMs: number;
}): boolean {
  if (job.status === 'complete' || job.status === 'failed') return false;
  if (job.phase === 'review_gate' && job.phase_status === 'awaiting_approval') return false;

  // SLA clock resets on resume/retry — use the most recent of created_at,
  // resume_requested_at, or retry_requested_at as the effective start time.
  const progress = job.progress ?? {};
  const resumeAt = typeof progress.resume_requested_at === 'string' ? progress.resume_requested_at : null;
  const retryAt = typeof progress.retry_requested_at === 'string' ? progress.retry_requested_at : null;

  const candidates = [
    toIsoMs(job.created_at ?? job.updated_at),
    toIsoMs(resumeAt),
    toIsoMs(retryAt),
  ].filter((ms): ms is number => ms !== null);

  const slaStartMs = candidates.length > 0 ? Math.max(...candidates) : null;
  if (slaStartMs === null) return false;

  const wordCount = Number.isFinite(job.manuscript_word_count as number)
    ? Number(job.manuscript_word_count)
    : 0;
  const slaMs = wordCount >= 12_000 ? args.longFormSlaMs : args.shortFormSlaMs;
  return args.nowMs - slaStartMs >= slaMs;
}

export function resolveProviderBudget(args: {
  chunkCount: number;
  manuscriptWordCount: number;
}): { maxCalls: number; maxEstimatedTokens: number } {
  const safeChunkCount = Number.isFinite(args.chunkCount) ? Math.max(1, Math.floor(args.chunkCount)) : 1;
  const safeWordCount = Number.isFinite(args.manuscriptWordCount) ? Math.max(0, Math.floor(args.manuscriptWordCount)) : 0;

  const chunkBand = Math.ceil(safeChunkCount / 18);
  const wordBand = Math.ceil(safeWordCount / 12_000);

  const maxCalls = Math.min(12, Math.max(4, 3 + chunkBand + wordBand));
  const estimatedTokensPerCall = safeWordCount >= 12_000 ? 80_000 : 30_000;
  const maxEstimatedTokens = Math.min(1_500_000, maxCalls * estimatedTokensPerCall);

  return { maxCalls, maxEstimatedTokens };
}

export function classifyQueuedHardStop(job: QueueHardStopCandidate, args: {
  nowMs: number;
  graceMs: number;
  shortFormSlaMs: number;
  longFormSlaMs: number;
  hasSeedArtifacts: boolean;
}): HardStopDecision | null {
  if (isSplitBrainState(job)) {
    return {
      code: 'STATE_SPLIT_BRAIN_DETECTED',
      reason: `Split-brain state detected: phase=${job.phase ?? 'null'}, phase_status=${job.phase_status ?? 'null'}, progress.phase=${String(job.progress?.phase ?? 'null')}, progress.phase_status=${String(job.progress?.phase_status ?? 'null')}`,
    };
  }

  if (isPostPhase0HandoffLimbo(job, args)) {
    return {
      code: 'POST_PHASE0_HANDOFF_TIMEOUT',
      reason: `Post-Phase-0 handoff timeout: phase0_completed_at present but no seed artifacts persisted within ${Math.round(args.graceMs / 1000)}s.`,
    };
  }

  if (isGlobalSlaExceeded(job, args)) {
    return {
      code: 'PIPELINE_GLOBAL_SLA_EXCEEDED',
      reason: `Global pipeline SLA exceeded for non-terminal job: created_at=${job.created_at ?? 'null'}.`,
    };
  }

  return null;
}
