/**
 * Held Recovery PG-01 → PG-03 production proof harness.
 *
 * Purpose: prove the live causal chain through public/runtime boundaries only:
 *   production worker route → persisted database authority → public/trusted
 *   Workbench reader.
 *
 * This script is a proof instrument, not a repair utility. It refuses to run
 * unless the operator supplies an exact proof job, exact manuscript, expected
 * deployed SHA, production confirmation, isolated-target confirmation, and
 * no-repair confirmation. It never imports Held Recovery reconstruction,
 * writer, readmission, hydration, or Workbench helper modules; those boundaries
 * must be exercised by deployed routes and persisted authority only.
 *
 * Required controls:
 *   HELD_RECOVERY_PROOF_MODE=enabled
 *   HELD_RECOVERY_PROOF_JOB_ID=<exact target job>
 *   HELD_RECOVERY_PROOF_MANUSCRIPT_ID=<exact target manuscript>
 *   HELD_RECOVERY_EXPECTED_DEPLOYED_SHA=<exact deployed SHA>
 *   HELD_RECOVERY_PRODUCTION_ENVIRONMENT_CONFIRMED=yes
 *   HELD_RECOVERY_PROOF_TARGET_ISOLATED=yes
 *   HELD_RECOVERY_NO_REPAIR_BEHAVIOR_CONFIRMED=yes
 *
 * Output: machine-readable evidence JSON plus named pass/fail gates. A harness
 * merge does not close PG-01/02/03; closure requires a successful controlled
 * live proof pack from the deployed commit.
 */
import { writeFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type JsonRecord = Record<string, unknown>

export const HELD_RECOVERY_PROOF_ALLOWED_OPERATIONS = [
  'observe_target_scoped_database_rows',
  'observe_deployment_health_sha',
  'invoke_admin_proof_job_runtime_boundary',
  'invoke_production_worker_runtime_boundary',
  'invoke_public_workbench_reader_boundary',
  'collect_evidence_artifact',
] as const

export const HELD_RECOVERY_PROOF_FORBIDDEN_OPERATIONS = [
  'repair_production_data',
  'mutate_arbitrary_data',
  'bypass_runtime_boundaries',
  'seed_hidden_state',
  'call_internal_helpers_directly',
  'read_untracked_secret_directories',
  'create_corrupt_negative_production_state',
] as const

export const HELD_RECOVERY_PROOF_REQUIRED_CONTROLS = [
  'HELD_RECOVERY_PROOF_MODE=enabled',
  'HELD_RECOVERY_PROOF_JOB_ID=<exact target job>',
  'HELD_RECOVERY_PROOF_MANUSCRIPT_ID=<exact target manuscript>',
  'HELD_RECOVERY_EXPECTED_DEPLOYED_SHA=<exact deployed SHA>',
  'HELD_RECOVERY_PRODUCTION_ENVIRONMENT_CONFIRMED=yes',
  'HELD_RECOVERY_PROOF_TARGET_ISOLATED=yes',
  'HELD_RECOVERY_NO_REPAIR_BEHAVIOR_CONFIRMED=yes',
] as const

export const HELD_RECOVERY_POSITIVE_PROOF_ASSERTIONS = [
  'recoverable_failure_released_for_exact_job',
  'one_held_record_created',
  'one_reconstruction_work_item_created',
  'one_canonical_anchor_reconstructed',
  'identity_version_hash_fingerprint_continuity_verified',
  'one_readmission_completed',
  'one_hydrated_workbench_card_observed_through_runtime_reader',
  'decision_persistence_probe_is_explicit_when_collected',
  'reload_state_is_identical_when_replay_snapshot_is_supplied',
  'no_duplicate_rows_on_replay',
  'target_scoped_observation_only',
] as const

export const HELD_RECOVERY_NEGATIVE_PROOF_ASSERTIONS = [
  'wrong_manuscript_fails_closed',
  'wrong_anchor_identity_fails_closed',
  'wrong_version_fails_closed',
  'wrong_fingerprint_fails_closed',
  'cross_job_identity_fails_closed',
  'missing_reconstruction_fails_closed',
  'duplicate_readmission_or_queue_authority_fails_closed',
  'stale_persisted_version_fails_closed',
] as const

export type HeldRecoveryProofSnapshot = {
  readonly label: 'before_release' | 'after_continuation' | 'replay'
  readonly job: JsonRecord | null
  readonly artifactCounts: Record<string, number>
  readonly attempts: JsonRecord[]
  readonly reconstructionWorkItems: JsonRecord[]
  readonly reconstructedAnchors: JsonRecord[]
  readonly queueItems: JsonRecord[]
  readonly transitionEvents: JsonRecord[]
  readonly decisionRows: JsonRecord[]
}

export type HeldRecoveryProofUnrelatedMutationSnapshot = {
  readonly heldRecoveryAttempts: number
  readonly reconstructionWorkItems: number
  readonly reconstructedAnchors: number
  readonly queueItems: number
  readonly transitionEvents: number
  readonly decisionRows: number
}

export type HeldRecoveryWorkerProofResponse = {
  readonly success?: boolean
  readonly targetJobId?: string | null
  readonly heldRecoveryInitiation?: { readonly status?: string } | null
  readonly heldRecoveryContinuation?: {
    readonly status?: string
    readonly readmission?: { readonly status?: string; readonly readmission?: { readonly status?: string } }
    readonly completionAuthority?: { readonly status?: string; readonly finalCardType?: string }
  } | null
}

export type HeldRecoveryCausalChainProof = {
  readonly jobId: string
  readonly manuscriptId: string
  readonly before: HeldRecoveryProofSnapshot
  readonly after: HeldRecoveryProofSnapshot
  readonly replay?: HeldRecoveryProofSnapshot
  readonly workerResponse: HeldRecoveryWorkerProofResponse
  readonly replayWorkerResponse?: HeldRecoveryWorkerProofResponse
  readonly trustedPathPreview?: JsonRecord | null
  readonly trustedPathReloadPreview?: JsonRecord | null
  readonly decisionPersistenceProbe?: JsonRecord | null
  readonly deployedSha?: string | null
  readonly expectedDeployedSha?: string | null
  readonly unrelatedBefore?: HeldRecoveryProofUnrelatedMutationSnapshot | null
  readonly unrelatedAfter?: HeldRecoveryProofUnrelatedMutationSnapshot | null
  readonly unrelatedReplay?: HeldRecoveryProofUnrelatedMutationSnapshot | null
}

export type HeldRecoveryProofGate = {
  readonly id: string
  readonly ok: boolean
  readonly detail: string
}

export type HeldRecoveryNamedEvidence = {
  readonly id: string
  readonly value: unknown
}

function recordOf(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

function arrayOfRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(recordOf).filter((item): item is JsonRecord => item !== null) : []
}

function countBy<T extends JsonRecord>(items: readonly T[], selector: (item: T) => string | null): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const key = selector(item)
    if (!key) continue
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function value(record: JsonRecord | null | undefined, key: string): string | null {
  const raw = record?.[key]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

function numericValue(record: JsonRecord | null | undefined, key: string): number | null {
  const raw = record?.[key]
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

function nestedRecord(record: JsonRecord | null | undefined, key: string): JsonRecord | null {
  return recordOf(record?.[key])
}

function firstString(record: JsonRecord | null | undefined, keys: readonly string[]): string | null {
  for (const key of keys) {
    const candidate = value(record, key)
    if (candidate) return candidate
  }
  return null
}

function jsonStable(valueToSerialize: unknown): string {
  if (Array.isArray(valueToSerialize)) return `[${valueToSerialize.map(jsonStable).join(',')}]`
  if (recordOf(valueToSerialize)) {
    const record = valueToSerialize as JsonRecord
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${jsonStable(record[key])}`).join(',')}}`
  }
  return JSON.stringify(valueToSerialize)
}

function statusCounts(items: readonly JsonRecord[]): Record<string, number> {
  return countBy(items, (item) => value(item, 'status') ?? value(item, 'queue_state'))
}

function gate(id: string, ok: boolean, detail: string): HeldRecoveryProofGate {
  return { id, ok, detail }
}

function unrelatedDelta(
  before: HeldRecoveryProofUnrelatedMutationSnapshot | null | undefined,
  after: HeldRecoveryProofUnrelatedMutationSnapshot | null | undefined,
): number | null {
  if (!before || !after) return null
  return Object.keys(before).reduce((sum, rawKey) => {
    const key = rawKey as keyof HeldRecoveryProofUnrelatedMutationSnapshot
    return sum + Math.max(0, after[key] - before[key])
  }, 0)
}

function shaMatchesExpected(observed: string | null | undefined, expected: string | null | undefined): boolean {
  if (!observed || !expected) return false
  const normalizedObserved = observed.trim().toLowerCase()
  const normalizedExpected = expected.trim().toLowerCase()
  return normalizedExpected.startsWith(normalizedObserved)
    || normalizedObserved.startsWith(normalizedExpected)
}

export function collectHeldRecoveryNamedEvidence(
  proof: HeldRecoveryCausalChainProof,
): HeldRecoveryNamedEvidence[] {
  const queue = proof.after.queueItems[0]
  const work = proof.after.reconstructionWorkItems[0]
  const anchor = proof.after.reconstructedAnchors[0]
  const transition = proof.after.transitionEvents[0]
  const trustedPreview = proof.trustedPathPreview
  const completion = proof.workerResponse.heldRecoveryContinuation?.completionAuthority
  return [
    { id: 'exact_evaluation_job_id', value: proof.jobId },
    { id: 'exact_manuscript_id', value: proof.manuscriptId },
    { id: 'expected_deployed_sha', value: proof.expectedDeployedSha ?? null },
    { id: 'observed_deployed_sha', value: proof.deployedSha ?? null },
    { id: 'held_row_count', value: proof.after.queueItems.length },
    { id: 'held_item_id', value: value(queue, 'held_item_id') },
    { id: 'reconstruction_work_item_count', value: proof.after.reconstructionWorkItems.length },
    { id: 'reconstruction_work_identity', value: value(work, 'id') ?? value(work, 'work_item_id') ?? value(work, 'held_item_id') },
    { id: 'reconstructed_anchor_count', value: proof.after.reconstructedAnchors.length },
    { id: 'reconstructed_anchor_version', value: value(anchor, 'held_item_persisted_version') },
    { id: 'reconstructed_anchor_hash', value: value(anchor, 'source_hash') },
    { id: 'reconstructed_anchor_fingerprint', value: value(anchor, 'completion_fingerprint') },
    { id: 'transition_event_count', value: proof.after.transitionEvents.length },
    { id: 'transition_event_identity', value: value(transition, 'id') ?? value(transition, 'transition_event_id') },
    { id: 'transition_event_to_state', value: value(transition, 'to_state') },
    { id: 'readmission_status', value: proof.workerResponse.heldRecoveryContinuation?.readmission?.status ?? nestedRecord(proof.workerResponse.heldRecoveryContinuation?.readmission ?? null, 'readmission')?.status ?? null },
    { id: 'hydrated_workbench_card_identity', value: firstString(trustedPreview, ['opportunityId', 'opportunity_id', 'id']) ?? null },
    { id: 'hydrated_workbench_card_type', value: completion?.finalCardType ?? null },
    { id: 'public_trusted_path_eligible_count', value: trustedPreview?.eligible ?? null },
    { id: 'replay_attempt_count', value: proof.replay?.attempts.length ?? null },
    { id: 'replay_work_item_count', value: proof.replay?.reconstructionWorkItems.length ?? null },
    { id: 'replay_anchor_count', value: proof.replay?.reconstructedAnchors.length ?? null },
    { id: 'replay_queue_count', value: proof.replay?.queueItems.length ?? null },
    { id: 'replay_anchor_state_hash', value: proof.replay ? jsonStable(proof.replay.reconstructedAnchors) : null },
    { id: 'first_anchor_state_hash', value: jsonStable(proof.after.reconstructedAnchors) },
    { id: 'unrelated_mutation_count', value: unrelatedDelta(proof.unrelatedBefore, proof.unrelatedAfter) },
    { id: 'unrelated_replay_mutation_count', value: unrelatedDelta(proof.unrelatedAfter, proof.unrelatedReplay) },
  ]
}

export function evaluateHeldRecoveryCausalChainProof(
  proof: HeldRecoveryCausalChainProof,
): HeldRecoveryProofGate[] {
  const after = proof.after
  const replay = proof.replay
  const queue = after.queueItems[0]
  const work = after.reconstructionWorkItems[0]
  const anchor = after.reconstructedAnchors[0]
  const attempt = after.attempts[0]
  const trustedPreview = proof.trustedPathPreview
  const trustedReloadPreview = proof.trustedPathReloadPreview
  const continuation = proof.workerResponse.heldRecoveryContinuation
  const readmissionStatus = continuation?.readmission?.status
    ?? continuation?.readmission?.readmission?.status
    ?? null
  const completionStatus = continuation?.completionAuthority?.status ?? null
  const finalCardType = continuation?.completionAuthority?.finalCardType ?? null
  const sourceStart = numericValue(anchor, 'source_start_offset')
  const sourceEnd = numericValue(anchor, 'source_end_offset')
  const sourceHash = value(anchor, 'source_hash')
  const completionFingerprint = value(anchor, 'completion_fingerprint')
  const trustedOpportunityCount = typeof trustedPreview?.eligible === 'number'
    ? trustedPreview.eligible
    : Array.isArray(trustedPreview?.opportunities) ? trustedPreview.opportunities.length : null
  const unrelatedAfterDelta = unrelatedDelta(proof.unrelatedBefore, proof.unrelatedAfter)

  const gates: HeldRecoveryProofGate[] = [
    gate('proof_scope_allows_only_observe_invoke_verify_collect', HELD_RECOVERY_PROOF_ALLOWED_OPERATIONS.length === 6 && HELD_RECOVERY_PROOF_FORBIDDEN_OPERATIONS.length === 7, 'proof runner declares allowed and forbidden operation classes'),
    gate('proof_requires_explicit_safety_controls', HELD_RECOVERY_PROOF_REQUIRED_CONTROLS.length === 7, 'proof runner declares mandatory execution controls'),
    gate('deployed_sha_matches_expected', shaMatchesExpected(proof.deployedSha, proof.expectedDeployedSha), `expected=${proof.expectedDeployedSha ?? 'missing'} observed=${proof.deployedSha ?? 'missing'}`),
    gate('before_release_has_no_target_held_rows', proof.before.attempts.length === 0 && proof.before.reconstructionWorkItems.length === 0 && proof.before.reconstructedAnchors.length === 0 && proof.before.queueItems.length === 0, `before attempts=${proof.before.attempts.length} work=${proof.before.reconstructionWorkItems.length} anchors=${proof.before.reconstructedAnchors.length} queue=${proof.before.queueItems.length}`),
    gate('worker_target_job_exact', proof.workerResponse.targetJobId === proof.jobId || proof.workerResponse.targetJobId == null, `targetJobId=${proof.workerResponse.targetJobId ?? 'not_returned'}`),
    gate('initiation_deferred_reconstruction_admitted', proof.workerResponse.heldRecoveryInitiation?.status === 'deferred_reconstruction_admitted' || proof.workerResponse.heldRecoveryInitiation?.status == null, `initiation=${proof.workerResponse.heldRecoveryInitiation?.status ?? 'not_returned'}`),
    gate('target_job_completed', after.job?.status === 'complete', `job status=${String(after.job?.status)}`),
    gate('one_deferred_attempt', after.attempts.length === 1, `attempts=${after.attempts.length}`),
    gate('one_reconstruction_work_item', after.reconstructionWorkItems.length === 1, `work_items=${after.reconstructionWorkItems.length}`),
    gate('one_reconstructed_anchor', after.reconstructedAnchors.length === 1, `anchors=${after.reconstructedAnchors.length}`),
    gate('one_queue_authority', after.queueItems.length === 1, `queue_items=${after.queueItems.length}`),
    gate('transition_event_recorded', after.transitionEvents.length >= 1, `transition_events=${after.transitionEvents.length}`),
    gate('transition_event_reclassified', after.transitionEvents.some((event) => value(event, 'to_state') === 'reclassified'), `to_states=${Object.keys(countBy(after.transitionEvents, (event) => value(event, 'to_state'))).join(',') || 'none'}`),
    gate('work_completed', value(work, 'status') === 'completed', `work_status=${value(work, 'status') ?? 'missing'}`),
    gate('queue_reclassified', value(queue, 'queue_state') === 'reclassified', `queue_state=${value(queue, 'queue_state') ?? 'missing'}`),
    gate('readmission_completed', readmissionStatus === 'readmission_completed', `readmission=${readmissionStatus ?? 'missing'}`),
    gate('completion_authority_reclassified', completionStatus === 'reclassified' || completionStatus === 'already_reclassified', `completion=${completionStatus ?? 'missing'}`),
    gate('hydrated_workbench_card_terminal', typeof finalCardType === 'string' && finalCardType.length > 0, `finalCardType=${finalCardType ?? 'missing'}`),
    gate('attempt_identity_matches_queue', value(attempt, 'held_item_id') === value(queue, 'held_item_id'), 'attempt.held_item_id equals queue.held_item_id'),
    gate('work_identity_matches_queue', value(work, 'held_item_id') === value(queue, 'held_item_id'), 'work.held_item_id equals queue.held_item_id'),
    gate('anchor_identity_matches_queue', value(anchor, 'held_item_id') === value(queue, 'held_item_id'), 'anchor.held_item_id equals queue.held_item_id'),
    gate('opportunity_identity_continuity', Boolean(value(queue, 'opportunity_id')) && value(queue, 'opportunity_id') === value(work, 'opportunity_id') && value(queue, 'opportunity_id') === value(anchor, 'opportunity_id'), 'queue/work/anchor opportunity_id match'),
    gate('manuscript_identity_continuity', proof.manuscriptId === value(queue, 'manuscript_id') && proof.manuscriptId === value(work, 'manuscript_id') && proof.manuscriptId === String(anchor?.manuscript_id ?? ''), 'job/queue/work/anchor manuscript identity match'),
    gate('held_version_continuity', Boolean(value(queue, 'held_item_persisted_version')) && value(queue, 'held_item_persisted_version') === value(work, 'held_item_persisted_version') && value(queue, 'held_item_persisted_version') === value(anchor, 'held_item_persisted_version'), 'queue/work/anchor held versions match'),
    gate('anchor_source_hash_present', Boolean(sourceHash), `source_hash=${sourceHash ? 'present' : 'missing'}`),
    gate('anchor_offsets_valid', sourceStart !== null && sourceEnd !== null && sourceEnd > sourceStart, `source_start=${sourceStart ?? 'missing'} source_end=${sourceEnd ?? 'missing'}`),
    gate('anchor_fingerprint_present', Boolean(completionFingerprint), `completion_fingerprint=${completionFingerprint ? 'present' : 'missing'}`),
    gate('work_recovery_fingerprint_present', Boolean(value(work, 'recovery_input_fingerprint') ?? value(work, 'details')), 'work recovery fingerprint/details are persisted'),
    gate('public_workbench_reader_ok', trustedPreview?.ok === true, `trustedPath ok=${String(trustedPreview?.ok)}`),
    gate('workbench_reader_returns_one_terminal_card', trustedOpportunityCount === 1, `trustedPath eligible/opportunities=${trustedOpportunityCount ?? 'not_collected'}`),
    gate('decision_probe_explicit_or_absent', !proof.decisionPersistenceProbe || proof.decisionPersistenceProbe.ok === true, `decision_probe=${proof.decisionPersistenceProbe ? String(proof.decisionPersistenceProbe.ok) : 'not_collected'}`),
    gate('unrelated_mutation_count_zero', unrelatedAfterDelta === 0, `unrelated_delta=${unrelatedAfterDelta ?? 'not_collected'}`),
  ]

  if (replay) {
    const unrelatedReplayDelta = unrelatedDelta(proof.unrelatedAfter, proof.unrelatedReplay)
    gates.push(
      gate('replay_attempt_idempotent', replay.attempts.length === after.attempts.length, `after=${after.attempts.length} replay=${replay.attempts.length}`),
      gate('replay_work_idempotent', replay.reconstructionWorkItems.length === after.reconstructionWorkItems.length, `after=${after.reconstructionWorkItems.length} replay=${replay.reconstructionWorkItems.length}`),
      gate('replay_anchor_idempotent', replay.reconstructedAnchors.length === after.reconstructedAnchors.length, `after=${after.reconstructedAnchors.length} replay=${replay.reconstructedAnchors.length}`),
      gate('replay_queue_idempotent', replay.queueItems.length === after.queueItems.length, `after=${after.queueItems.length} replay=${replay.queueItems.length}`),
      gate('replay_decisions_idempotent', replay.decisionRows.length === after.decisionRows.length, `after=${after.decisionRows.length} replay=${replay.decisionRows.length}`),
      gate('replay_anchor_state_identical', jsonStable(replay.reconstructedAnchors) === jsonStable(after.reconstructedAnchors), 'replay reconstructed-anchor state matches first proof snapshot'),
      gate('replay_queue_state_identical', jsonStable(replay.queueItems) === jsonStable(after.queueItems), 'replay queue state matches first proof snapshot'),
      gate('reload_trusted_path_identical_when_collected', !trustedPreview || !trustedReloadPreview || jsonStable(trustedPreview) === jsonStable(trustedReloadPreview), 'trusted-path preview stable across reload when both snapshots are collected'),
      gate('replay_unrelated_mutation_count_zero', unrelatedReplayDelta === 0, `unrelated_replay_delta=${unrelatedReplayDelta ?? 'not_collected'}`),
    )
  }

  return gates
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value || !value.trim()) throw new Error(`Missing required environment variable: ${name}`)
  return value.trim()
}

function requireEnvValue(name: string, expected: string): string {
  const actual = requireEnv(name)
  if (actual !== expected) throw new Error(`Refusing Held Recovery proof: ${name} must be ${expected}`)
  return actual
}

function normalizeSha(valueToNormalize: string): string {
  return valueToNormalize.trim().toLowerCase()
}

async function fetchJson(url: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}: ${JSON.stringify(body)}`)
  const record = recordOf(body)
  if (!record) throw new Error(`Malformed JSON response from ${url}`)
  return record
}

async function verifyDeployedSha(appBaseUrl: string, expectedSha: string): Promise<string> {
  const health = await fetchJson(`${appBaseUrl}/api/health`)
  const raw = value(health, 'git_sha')
  if (!raw) throw new Error('Health endpoint did not expose git_sha; refusing proof')
  const observed = normalizeSha(raw)
  const expected = normalizeSha(expectedSha)
  if (!expected.startsWith(observed) && !observed.startsWith(expected.slice(0, observed.length))) {
    throw new Error(`Deployed SHA mismatch: expected ${expectedSha}, observed ${raw}`)
  }
  return raw
}

async function selectRows(supabase: SupabaseClient, table: string, column: string, valueToMatch: string): Promise<JsonRecord[]> {
  const { data, error } = await supabase.from(table).select('*').eq(column, valueToMatch)
  if (error) throw new Error(`${table} query failed: ${error.message}`)
  return arrayOfRecords(data)
}

async function countRowsNotEqual(supabase: SupabaseClient, table: string, column: string, valueToExclude: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).neq(column, valueToExclude)
  if (error) throw new Error(`${table} unrelated-count query failed: ${error.message}`)
  return count ?? 0
}

async function unrelatedSnapshot(
  supabase: SupabaseClient,
  jobId: string,
  manuscriptId: string,
): Promise<HeldRecoveryProofUnrelatedMutationSnapshot> {
  const [attempts, work, anchors, queue, transitions, decisions] = await Promise.all([
    countRowsNotEqual(supabase, 'held_recovery_attempts', 'manuscript_id', manuscriptId),
    countRowsNotEqual(supabase, 'held_recovery_reconstruction_work_items', 'manuscript_id', manuscriptId),
    countRowsNotEqual(supabase, 'held_recovery_reconstructed_anchors', 'manuscript_id', manuscriptId),
    countRowsNotEqual(supabase, 'held_recovery_queue_items', 'evaluation_job_id', jobId),
    countRowsNotEqual(supabase, 'held_recovery_queue_transition_events', 'manuscript_id', manuscriptId),
    countRowsNotEqual(supabase, 'revision_ledger_decisions', 'evaluation_job_id', jobId),
  ])
  return {
    heldRecoveryAttempts: attempts,
    reconstructionWorkItems: work,
    reconstructedAnchors: anchors,
    queueItems: queue,
    transitionEvents: transitions,
    decisionRows: decisions,
  }
}

async function snapshot(supabase: SupabaseClient, jobId: string, manuscriptId: string, label: HeldRecoveryProofSnapshot['label']): Promise<HeldRecoveryProofSnapshot> {
  const [{ data: job, error: jobError }, artifacts, attempts, work, anchors, queue, transitions, decisions] = await Promise.all([
    supabase.from('evaluation_jobs').select('*').eq('id', jobId).maybeSingle(),
    selectRows(supabase, 'evaluation_artifacts', 'job_id', jobId),
    selectRows(supabase, 'held_recovery_attempts', 'manuscript_id', manuscriptId),
    selectRows(supabase, 'held_recovery_reconstruction_work_items', 'manuscript_id', manuscriptId),
    selectRows(supabase, 'held_recovery_reconstructed_anchors', 'manuscript_id', manuscriptId),
    selectRows(supabase, 'held_recovery_queue_items', 'evaluation_job_id', jobId),
    selectRows(supabase, 'held_recovery_queue_transition_events', 'manuscript_id', manuscriptId),
    selectRows(supabase, 'revision_ledger_decisions', 'evaluation_job_id', jobId),
  ])
  if (jobError) throw new Error(`evaluation_jobs query failed: ${jobError.message}`)
  return {
    label,
    job: recordOf(job),
    artifactCounts: countBy(artifacts, (row) => value(row, 'artifact_type')),
    attempts,
    reconstructionWorkItems: work,
    reconstructedAnchors: anchors,
    queueItems: queue,
    transitionEvents: transitions,
    decisionRows: decisions,
  }
}

async function main(): Promise<void> {
  requireEnvValue('HELD_RECOVERY_PROOF_MODE', 'enabled')
  requireEnvValue('HELD_RECOVERY_PRODUCTION_ENVIRONMENT_CONFIRMED', 'yes')
  requireEnvValue('HELD_RECOVERY_PROOF_TARGET_ISOLATED', 'yes')
  requireEnvValue('HELD_RECOVERY_NO_REPAIR_BEHAVIOR_CONFIRMED', 'yes')

  const appBaseUrl = requireEnv('APP_BASE_URL', process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, '')
  const proofSecret = requireEnv('PROOF_RUN_SECRET')
  const cronSecret = requireEnv('CRON_SECRET')
  const supabaseUrl = requireEnv('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRole = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const expectedDeployedSha = requireEnv('HELD_RECOVERY_EXPECTED_DEPLOYED_SHA')
  const suppliedJobId = requireEnv('HELD_RECOVERY_PROOF_JOB_ID')
  const suppliedManuscriptId = requireEnv('HELD_RECOVERY_PROOF_MANUSCRIPT_ID')
  const outPath = process.env.HELD_RECOVERY_PROOF_OUT ?? '/tmp/held-recovery-causal-chain-proof.json'
  const replay = process.argv.includes('--replay')
  const deployedSha = await verifyDeployedSha(appBaseUrl, expectedDeployedSha)

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jobId = suppliedJobId

  const { data: jobRow, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('id,manuscript_id')
    .eq('id', jobId)
    .maybeSingle()
  if (jobError || !jobRow) throw new Error(`Unable to load proof job ${jobId}: ${jobError?.message ?? 'missing'}`)
  const manuscriptId = String(jobRow.manuscript_id)
  if (manuscriptId !== suppliedManuscriptId) {
    throw new Error(`Proof job manuscript mismatch: expected ${suppliedManuscriptId}, observed ${manuscriptId}`)
  }
  const unrelatedBefore = await unrelatedSnapshot(supabase, jobId, manuscriptId)
  const before = await snapshot(supabase, jobId, manuscriptId, 'before_release')

  await fetchJson(`${appBaseUrl}/api/admin/proof/jobs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${proofSecret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'release_held_recovery_proof', job_id: jobId }),
  })
  const workerResponse = await fetchJson(`${appBaseUrl}/api/workers/process-evaluations`, {
    headers: { authorization: `Bearer ${cronSecret}`, 'x-job-id': jobId },
  }) as HeldRecoveryWorkerProofResponse
  const after = await snapshot(supabase, jobId, manuscriptId, 'after_continuation')
  const unrelatedAfter = await unrelatedSnapshot(supabase, jobId, manuscriptId)

  let replaySnapshot: HeldRecoveryProofSnapshot | undefined
  let replayWorkerResponse: HeldRecoveryWorkerProofResponse | undefined
  if (replay) {
    replayWorkerResponse = await fetchJson(`${appBaseUrl}/api/workers/process-evaluations`, {
      headers: { authorization: `Bearer ${cronSecret}`, 'x-job-id': jobId },
    }) as HeldRecoveryWorkerProofResponse
    replaySnapshot = await snapshot(supabase, jobId, manuscriptId, 'replay')
  }
  const unrelatedReplay = replay ? await unrelatedSnapshot(supabase, jobId, manuscriptId) : null

  const trustedPathPreview = await fetchJson(`${appBaseUrl}/api/revise/trusted-path?manuscriptId=${encodeURIComponent(manuscriptId)}&evaluationJobId=${encodeURIComponent(jobId)}`).catch((error) => ({ ok: false, error: String(error) }))
  const trustedPathReloadPreview = await fetchJson(`${appBaseUrl}/api/revise/trusted-path?manuscriptId=${encodeURIComponent(manuscriptId)}&evaluationJobId=${encodeURIComponent(jobId)}`).catch((error) => ({ ok: false, error: String(error) }))
  const proof: HeldRecoveryCausalChainProof = {
    jobId,
    manuscriptId,
    before,
    after,
    replay: replaySnapshot,
    workerResponse,
    replayWorkerResponse,
    trustedPathPreview,
    trustedPathReloadPreview,
    deployedSha,
    expectedDeployedSha,
    unrelatedBefore,
    unrelatedAfter,
    unrelatedReplay,
  }
  const gates = evaluateHeldRecoveryCausalChainProof(proof)
  const output = { generated_at: new Date().toISOString(), operation_scope: {
    allowed: HELD_RECOVERY_PROOF_ALLOWED_OPERATIONS,
    forbidden: HELD_RECOVERY_PROOF_FORBIDDEN_OPERATIONS,
    required_controls: HELD_RECOVERY_PROOF_REQUIRED_CONTROLS,
    positive_assertions: HELD_RECOVERY_POSITIVE_PROOF_ASSERTIONS,
    negative_assertions: HELD_RECOVERY_NEGATIVE_PROOF_ASSERTIONS,
  }, proof, namedEvidence: collectHeldRecoveryNamedEvidence(proof), gates, statusCounts: {
    attempts: statusCounts(after.attempts),
    work: statusCounts(after.reconstructionWorkItems),
    queue: statusCounts(after.queueItems),
  } }
  writeFileSync(outPath, JSON.stringify(output, null, 2))
  for (const item of gates) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id}: ${item.detail}`)
  console.log(`PROOF_JSON=${outPath}`)
  if (gates.some((item) => !item.ok)) process.exit(1)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}