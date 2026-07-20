export type HardStopCode =
  | 'POST_PHASE0_HANDOFF_TIMEOUT'
  | 'STATE_SPLIT_BRAIN_DETECTED'
  | 'PIPELINE_GLOBAL_SLA_EXCEEDED'
  | 'PROVIDER_BUDGET_EXCEEDED';

export type SplitBrainRecoveryAction =
  | 'repair_to_expected_handoff'
  | 'sync_progress_to_job_state'
  | 'halt_for_engineering_review';

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

export interface Phase1aSeedArtifactSnapshot {
  artifact_type?: string | null;
  content?: unknown;
}

export interface SupportAlertPayload {
  to: typeof REVISIONGRADE_SUPPORT_EMAIL;
  subject: string;
  severity: 'warning' | 'critical';
  body: string;
}

export interface HardStopDecision {
  code: HardStopCode;
  reason: string;
  internalReason?: string;
  recoveryKey?: string;
  recoveryAction?: SplitBrainRecoveryAction;
  notifySupport?: SupportAlertPayload;
}

export interface SplitBrainRecoveryDecision {
  state: 'none' | 'healable' | 'structural';
  action: SplitBrainRecoveryAction | 'none';
  recoveryKey: string | null;
  publicReason: string | null;
  internalReason: string | null;
  notifySupport: SupportAlertPayload | null;
}

export interface MaxAgeKillSwitchCandidate {
  id: string;
  status: string;
  phase_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  progress?: Record<string, unknown> | null;
}

export interface MaxAgeKillSwitchPartition {
  runningIds: string[];
  queuedEligibleIds: string[];
  queuedSkippedIds: string[];
}

export const REVISIONGRADE_SUPPORT_EMAIL = 'support@revisiongrade.com' as const;

export const HELD_RECOVERY_PROOF_HOLD_JSON_CONTAINMENT = JSON.stringify({
  held_recovery_proof_hold: true,
});
export const HELD_RECOVERY_PROOF_HOLD_ABSENT_POSTGREST_FILTER =
  `progress.is.null,progress.not.cs.${HELD_RECOVERY_PROOF_HOLD_JSON_CONTAINMENT}`;

export function isHeldRecoveryProofHoldProgress(progress: unknown): boolean {
  return (
    progress !== null &&
    typeof progress === 'object' &&
    !Array.isArray(progress) &&
    (progress as Record<string, unknown>).held_recovery_proof_hold === true
  );
}

export function isQueuedHardStopWatchdogCandidate(
  candidate: Pick<QueueHardStopCandidate, 'progress'>,
): boolean {
  return !isHeldRecoveryProofHoldProgress(candidate.progress);
}

const AUTHOR_SAFE_SYNC_MESSAGE =
  'Evaluation paused while synchronizing progress. Your writing and completed analysis have been preserved. Continue Evaluation will resume from the safest available checkpoint.';

const PHASE_ADVANCE_ORDER = [
  'phase_0',
  'seed_0_5a',
  'seed_0_5b',
  'phase_1a',
  'review_gate',
  'phase_2',
  'phase_3a',
  'phase_3',
  'phase_3b',
  'wave_revision',
  'phase_5',
] as const;

const PHASE_ALIASES: Readonly<Record<string, (typeof PHASE_ADVANCE_ORDER)[number]>> = {
  phase0: 'phase_0',
  pass0: 'phase_0',
  intake: 'phase_0',
  phase_0_5a: 'seed_0_5a',
  phase_05a: 'seed_0_5a',
  phase0_5a: 'seed_0_5a',
  phase05a: 'seed_0_5a',
  pass_0_5a: 'seed_0_5a',
  story_ledger: 'seed_0_5a',
  full_context_ledger: 'seed_0_5a',
  phase_0_5b: 'seed_0_5b',
  phase_05b: 'seed_0_5b',
  phase0_5b: 'seed_0_5b',
  phase05b: 'seed_0_5b',
  pass_0_5b: 'seed_0_5b',
  dream_seed: 'seed_0_5b',
  editorial_dream_seed: 'seed_0_5b',
  phase_1: 'phase_1a',
  phase1: 'phase_1a',
  pass1: 'phase_1a',
  pass_1: 'phase_1a',
  pass1a: 'phase_1a',
  pass_1a: 'phase_1a',
  phase1a: 'phase_1a',
  quality_gate: 'review_gate',
  phase2: 'phase_2',
  pass2: 'phase_2',
  pass_2: 'phase_2',
  phase3a: 'phase_3a',
  pass3a: 'phase_3a',
  pass_3a: 'phase_3a',
  independent_read: 'phase_3a',
  phase3: 'phase_3',
  pass3: 'phase_3',
  pass_3: 'phase_3',
  read_ahead: 'phase_3',
  phase3b: 'phase_3b',
  pass3b: 'phase_3b',
  pass_3b: 'phase_3b',
  dream_document: 'phase_3b',
  wave: 'wave_revision',
  wave_revision: 'wave_revision',
  phase5: 'phase_5',
  pass5: 'phase_5',
  pass_5: 'phase_5',
  revision_queue: 'phase_5',
};

const OPTIONAL_PHASE_HANDOFFS = new Set<string>([
  // Short-form evaluations do not run the long-form independent-read lane.
  'phase_2->phase_3',
  'pass_2->pass_3',
]);

function normalizePhaseKey(value: string | null): (typeof PHASE_ADVANCE_ORDER)[number] | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s.-]+/g, '_');
  if ((PHASE_ADVANCE_ORDER as readonly string[]).includes(normalized)) {
    return normalized as (typeof PHASE_ADVANCE_ORDER)[number];
  }
  return Object.hasOwn(PHASE_ALIASES, normalized) ? PHASE_ALIASES[normalized] : null;
}

// Short-form manuscripts skip certain phases. These are valid handoff pairs
// even though they are not strictly adjacent in PHASE_ADVANCE_ORDER.
const SHORT_FORM_SKIP_PAIRS: ReadonlySet<string> = new Set([
  'phase_1a->phase_2',   // short-form bypasses review_gate
  'phase_2->phase_3',    // short-form bypasses phase_3a (diagnosis)
]);

function buildSplitBrainInternalReason(job: QueueHardStopCandidate): string {
  const progress = job.progress ?? {};
  return `Split-brain state detected: job_id=${job.id}, status=${job.status}, phase=${job.phase ?? 'null'}, phase_status=${job.phase_status ?? 'null'}, progress.phase=${String(progress.phase ?? 'null')}, progress.phase_status=${String(progress.phase_status ?? 'null')}`;
}

function buildRecoveryKey(job: QueueHardStopCandidate, state: 'healable' | 'structural'): string {
  const progress = job.progress ?? {};
  return [
    'SPLIT_BRAIN',
    state.toUpperCase(),
    job.id,
    job.phase ?? 'null',
    job.phase_status ?? 'null',
    String(progress.phase ?? 'null'),
    String(progress.phase_status ?? 'null'),
  ].join(':');
}

function buildSupportAlert(job: QueueHardStopCandidate, args: {
  severity: 'warning' | 'critical';
  action: SplitBrainRecoveryAction;
  recoveryKey: string;
  internalReason: string;
}): SupportAlertPayload {
  return {
    to: REVISIONGRADE_SUPPORT_EMAIL,
    subject: `[RevisionGrade] ${args.severity === 'critical' ? 'Critical' : 'Warning'} evaluation state recovery: ${args.recoveryKey}`,
    severity: args.severity,
    body: [
      args.internalReason,
      `recovery_key=${args.recoveryKey}`,
      `recovery_action=${args.action}`,
      `created_at=${job.created_at ?? 'null'}`,
      `updated_at=${job.updated_at ?? 'null'}`,
      'Action required: inspect the phase transition writer that allowed job state and progress state to diverge.',
    ].join('\n'),
  };
}
function isExpectedQueuedPhaseHandoff(args: {
  jobStatus: string;
  jobPhase: string | null;
  jobPhaseStatus: string | null;
  progressPhase: string | null;
  progressPhaseStatus: string | null;
}): boolean {
  if (args.jobStatus !== 'queued') return false;
  if (args.jobPhaseStatus !== 'queued') return false;
  if (args.progressPhaseStatus !== 'complete') return false;

  const previousPhase = normalizePhaseKey(args.progressPhase);
  const nextPhase = normalizePhaseKey(args.jobPhase);
  if (!previousPhase || !nextPhase) return false;

  if (OPTIONAL_PHASE_HANDOFFS.has(`${args.progressPhase}->${args.jobPhase}`)) {
    return true;
  }
  if (OPTIONAL_PHASE_HANDOFFS.has(`${previousPhase}->${nextPhase}`)) {
    return true;
  }

  const previousIndex = PHASE_ADVANCE_ORDER.indexOf(previousPhase);
  const nextIndex = PHASE_ADVANCE_ORDER.indexOf(nextPhase);

  if (nextIndex === previousIndex + 1) return true;

  // Allow known short-form skip patterns where phases are non-adjacent but valid.
  return SHORT_FORM_SKIP_PAIRS.has(`${previousPhase}->${nextPhase}`);
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

function hasPersistedContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0) return false;
  return true;
}

export function hasCompletePhase1aSeedState(rows: readonly Phase1aSeedArtifactSnapshot[]): boolean {
  const byType = new Map<string, unknown>();
  for (const row of rows) {
    if (typeof row.artifact_type === 'string') {
      byType.set(row.artifact_type, row.content);
    }
  }

  const storySeed = byType.get('story_map_seed_v1');
  const evaluationSeed = byType.get('evaluation_seed_v1');
  const fitGapReport = byType.get('seed_fit_gap_report_v1');
  const fitGapStatus =
    fitGapReport && typeof fitGapReport === 'object'
      ? (fitGapReport as Record<string, unknown>).status
      : null;

  return (
    hasPersistedContent(storySeed) &&
    hasPersistedContent(evaluationSeed) &&
    hasPersistedContent(fitGapReport) &&
    fitGapStatus !== 'blocked'
  );
}

export function resolveEffectiveRuntimeStartMs(job: Pick<QueueHardStopCandidate, 'created_at' | 'updated_at' | 'progress'>): number | null {
  const progress = job.progress ?? {};
  const resumeAt = typeof progress.resume_requested_at === 'string' ? progress.resume_requested_at : null;
  const retryAt = typeof progress.retry_requested_at === 'string' ? progress.retry_requested_at : null;
  // FIX: sla_timer_reset_at is written on every SLA auto-requeue so the SLA
  // clock restarts from the requeue moment rather than from job creation.
  // This prevents cumulative time across requeue attempts from exhausting the
  // SLA budget before a worker has had a fair chance to complete the work.
  const slaResetAt = typeof progress.sla_timer_reset_at === 'string' ? progress.sla_timer_reset_at : null;

  // The row's updated_at is bumped by trg_evaluation_jobs_updated_at on every
  // state change (requeue, rescue, heartbeat). Use updated_at as the primary
  // freshness signal and fall back to created_at only when updated_at is absent.
  const candidates = [
    toIsoMs(job.updated_at ?? job.created_at),
    toIsoMs(resumeAt),
    toIsoMs(retryAt),
    toIsoMs(slaResetAt),
  ].filter((ms): ms is number => ms !== null);

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function isMaxAgeKillSwitchExpired(job: MaxAgeKillSwitchCandidate, args: {
  nowMs: number;
  maxAgeMs: number;
}): boolean {
  const startMs = resolveEffectiveRuntimeStartMs(job);
  if (startMs === null) return false;
  return args.nowMs - startMs >= args.maxAgeMs;
}

export function isSplitBrainState(job: QueueHardStopCandidate): boolean {
  return classifySplitBrain(job) !== 'none';
}

/**
 * Determine whether a state mismatch is recoverable or structurally unsafe.
 *
 * Healable:
 *   - only phase_status diverges; or
 *   - progress records the previous phase/pass as complete while the row is
 *     already queued for the next phase/pass. That is a normal handoff window
 *     and must not kill the user's evaluation.
 *
 * Structural:
 *   - phases diverge in any non-sequential, non-handoff shape.
 */
export function classifySplitBrain(job: QueueHardStopCandidate): 'healable' | 'structural' | 'none' {
  const progress = job.progress ?? {};
  const progressPhase = typeof progress.phase === 'string' ? progress.phase : null;
  const progressPhaseStatus = typeof progress.phase_status === 'string' ? progress.phase_status : null;

  if (progressPhase && job.phase && progressPhase !== job.phase) {
    if (
      isExpectedQueuedPhaseHandoff({
        jobStatus: job.status,
        jobPhase: job.phase,
        jobPhaseStatus: job.phase_status,
        progressPhase,
        progressPhaseStatus,
      })
    ) {
      return 'healable';
    }

    return 'structural';
  }

  if (progressPhaseStatus && job.phase_status && progressPhaseStatus !== job.phase_status) {
    return 'healable';
  }

  return 'none';
}

export function decideSplitBrainRecovery(job: QueueHardStopCandidate): SplitBrainRecoveryDecision {
  const state = classifySplitBrain(job);
  if (state === 'none') {
    return {
      state,
      action: 'none',
      recoveryKey: null,
      publicReason: null,
      internalReason: null,
      notifySupport: null,
    };
  }

  const internalReason = buildSplitBrainInternalReason(job);
  const recoveryKey = buildRecoveryKey(job, state);
  const action: SplitBrainRecoveryAction = state === 'healable'
    ? (job.progress?.phase !== job.phase ? 'repair_to_expected_handoff' : 'sync_progress_to_job_state')
    : 'halt_for_engineering_review';
  const severity = state === 'structural' ? 'critical' : 'warning';

  return {
    state,
    action,
    recoveryKey,
    publicReason: state === 'structural' ? AUTHOR_SAFE_SYNC_MESSAGE : null,
    internalReason,
    notifySupport: buildSupportAlert(job, { severity, action, recoveryKey, internalReason }),
  };
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

  const slaStartMs = resolveEffectiveRuntimeStartMs(job);
  if (slaStartMs === null) return false;

  const wordCount = Number.isFinite(job.manuscript_word_count as number)
    ? Number(job.manuscript_word_count)
    : 0;
  const slaMs = wordCount >= 25_000 ? args.longFormSlaMs : args.shortFormSlaMs;
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
  const splitBrainRecovery = decideSplitBrainRecovery(job);
  if (splitBrainRecovery.state === 'structural') {
    return {
      code: 'STATE_SPLIT_BRAIN_DETECTED',
      reason: splitBrainRecovery.publicReason ?? AUTHOR_SAFE_SYNC_MESSAGE,
      internalReason: splitBrainRecovery.internalReason ?? undefined,
      recoveryKey: splitBrainRecovery.recoveryKey ?? undefined,
      recoveryAction: splitBrainRecovery.action === 'none' ? undefined : splitBrainRecovery.action,
      notifySupport: splitBrainRecovery.notifySupport ?? undefined,
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
      reason: 'Evaluation delayed — recovery is in progress. Your writing and completed analysis have been preserved.',
      internalReason: `Global pipeline SLA exceeded for non-terminal job: created_at=${job.created_at ?? 'null'}, updated_at=${job.updated_at ?? 'null'}.`,
    };
  }

  return null;
}
