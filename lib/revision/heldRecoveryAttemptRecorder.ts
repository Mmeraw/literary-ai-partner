/**
 * Held Recovery Attempt Recorder
 *
 * Durable recovery-attempt recording boundary. This module records what happened
 * after bounded runtime orchestration without mutating queues, scheduling
 * retries, changing ledgers/candidates, editing manuscripts, touching Final
 * Review, or rendering UI/API output.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RecoveryExecutionResult, RecoveryExecutorInput } from './heldRecoveryExecutor'
import type { HeldRecoveryRuntimeOutcome, CanonicalHeldItem } from './heldRecoveryRuntimeOrchestrator'
import {
  HELD_RECOVERY_MAX_RETRIES,
  type RecoveryAttempt,
  type RecoveryAuditEvent,
  type RecoveryAttemptSnapshot,
  type RecoverySeriesKey,
} from './heldRecoveryState'
import type { CanonicalHeldReasonOccurrence } from './heldRecoveryPlan'
import { sourceHashFor } from './heldRecoveryVersioning'

export type RecoveryAttemptTrigger = RecoveryAttemptSnapshot['trigger']

export type HeldRecoveryAttemptRecord = {
  readonly idempotencyKey: string
  readonly heldItemId: string
  readonly opportunityId: string
  /**
   * Canonical non-negative integer string (bigint fidelity). Carried unchanged
   * from the DB read; never reconstructed from a JS number.
   */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  readonly runtimeOutcomeStatus: HeldRecoveryRuntimeOutcome['status']
  readonly runtimeRejectionReason?: string
  readonly executorResult: RecoveryExecutionResult
  readonly attempt: RecoveryAttempt
}

export type BuildRecoveryAttemptRecordInput = {
  readonly heldItem: CanonicalHeldItem
  readonly executorInput: RecoveryExecutorInput
  readonly runtimeOutcome: HeldRecoveryRuntimeOutcome & { readonly result: RecoveryExecutionResult }
  readonly trigger: RecoveryAttemptTrigger
  readonly attemptNumber: number
  readonly nowIso?: string
  readonly canonicalReasons?: readonly CanonicalHeldReasonOccurrence[]
  readonly originalBaseReasons?: readonly string[]
  readonly originalFinalReasons?: readonly string[]
  readonly promotionTransitionReason?: string | null
}

export type HeldRecoveryAttemptPersistenceAdapter = {
  readonly findByIdempotencyKey: (idempotencyKey: string) => Promise<HeldRecoveryAttemptRecord | null>
  readonly countAttemptsForSeries: (seriesKey: RecoverySeriesKey) => Promise<number>
  readonly insertAttempt: (record: HeldRecoveryAttemptRecord) => Promise<HeldRecoveryAttemptRecord>
  /**
   * ALL recorded attempts for a held item + opportunity, in the DB's natural
   * return order. Read-only. The adapter imposes NO authority ordering and
   * discards NO row: supersession/history selection is the LOADER's
   * responsibility, never the adapter's. Preserves the recovered Unit 3
   * contract (exact-parity array semantics).
   */
  readonly findByHeldItemAndOpportunity: (input: {
    readonly heldItemId: string
    readonly opportunityId: string
  }) => Promise<readonly HeldRecoveryAttemptRecord[]>
}

export type RecordRecoveryAttemptInput = Omit<BuildRecoveryAttemptRecordInput, 'attemptNumber'>

export type RecordRecoveryAttemptResult =
  | { readonly status: 'recorded'; readonly record: HeldRecoveryAttemptRecord }
  | { readonly status: 'already_recorded'; readonly record: HeldRecoveryAttemptRecord }

function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function runtimeRejectionReason(outcome: HeldRecoveryRuntimeOutcome): string | undefined {
  return outcome.status === 'rejected' ? outcome.reason : undefined
}

function seriesKeyFor(input: RecoveryExecutorInput, result: RecoveryExecutionResult): RecoverySeriesKey {
  return {
    opportunityVersion: input.opportunityVersion,
    candidateSetVersion: input.candidateSetVersion,
    producer: result.producer,
    code: result.code,
    recoveryAction: result.action,
  }
}

function idempotencyKeyFor(args: {
  readonly heldItem: CanonicalHeldItem
  readonly executorInput: RecoveryExecutorInput
  readonly runtimeOutcome: HeldRecoveryRuntimeOutcome
  readonly seriesKey: RecoverySeriesKey
}): string {
  return sourceHashFor({
    boundary: 'held_recovery_attempt_v1',
    heldItemId: args.heldItem.heldItemId,
    heldItemPersistedVersion: args.heldItem.persistedVersion,
    manuscriptVersionSha: args.heldItem.manuscriptVersionSha,
    opportunityId: args.heldItem.opportunityId,
    seriesKey: args.seriesKey,
    recoveryInputFingerprint: args.executorInput.recoveryInputFingerprint,
    runtimeOutcomeStatus: args.runtimeOutcome.status,
    runtimeRejectionReason: runtimeRejectionReason(args.runtimeOutcome) ?? null,
  })
}

function attemptDispositionFor(outcome: HeldRecoveryRuntimeOutcome): Pick<RecoveryAttempt, 'status' | 'outcome'> {
  switch (outcome.status) {
    case 'completed':
      return { status: 'recovered_pending_reclassification', outcome: 'succeeded' }
    case 'rejected':
      return { status: 'recovery_attempt_failed_terminal', outcome: 'failed_terminal' }
    case 'deferred':
    case 'unchanged':
    default:
      return { status: 'held', outcome: 'pending' }
  }
}

function terminalEventFor(outcome: HeldRecoveryRuntimeOutcome): RecoveryAuditEvent['event'] {
  if (outcome.status === 'completed' || outcome.status === 'unchanged') return 'action_succeeded'
  return 'action_failed'
}

export function buildHeldRecoveryAttemptRecord(
  input: BuildRecoveryAttemptRecordInput,
): HeldRecoveryAttemptRecord {
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) {
    throw new Error(`Invalid Held Recovery attempt number: ${input.attemptNumber}`)
  }

  const nowIso = input.nowIso ?? new Date().toISOString()
  const seriesKey = seriesKeyFor(input.executorInput, input.runtimeOutcome.result)
  const idempotencyKey = idempotencyKeyFor({
    heldItem: input.heldItem,
    executorInput: input.executorInput,
    runtimeOutcome: input.runtimeOutcome,
    seriesKey,
  })
  const disposition = attemptDispositionFor(input.runtimeOutcome)
  const snapshot: RecoveryAttemptSnapshot = {
    idempotencyKey,
    manuscriptVersionSha: input.heldItem.manuscriptVersionSha,
    opportunityId: input.heldItem.opportunityId,
    trigger: input.trigger,
    canonicalReasons: jsonCopy([...(input.canonicalReasons ?? [])]),
    originalBaseReasons: jsonCopy([...(input.originalBaseReasons ?? [])]),
    originalFinalReasons: jsonCopy([...(input.originalFinalReasons ?? [])]),
    promotionTransitionReason: input.promotionTransitionReason ?? null,
    opportunityVersionBefore: input.executorInput.opportunityVersion,
    candidateSetVersionBefore: input.executorInput.candidateSetVersion,
    recoveryInputFingerprintBefore: input.executorInput.recoveryInputFingerprint,
  }
  const eventBase = {
    action: input.runtimeOutcome.result.action,
    producer: input.runtimeOutcome.result.producer,
    code: input.runtimeOutcome.result.code,
    opportunityVersionBefore: input.executorInput.opportunityVersion,
    candidateSetVersionBefore: input.executorInput.candidateSetVersion,
    recoveryInputFingerprintBefore: input.executorInput.recoveryInputFingerprint,
  }
  const events: RecoveryAuditEvent[] = [
    {
      at: nowIso,
      event: 'snapshot_created',
      ...eventBase,
      details: { trigger: input.trigger, runtimeOutcomeStatus: input.runtimeOutcome.status },
    },
    {
      at: nowIso,
      event: 'action_started',
      ...eventBase,
      details: { idempotencyKey },
    },
    {
      at: nowIso,
      event: terminalEventFor(input.runtimeOutcome),
      ...eventBase,
      details: {
        runtimeOutcomeStatus: input.runtimeOutcome.status,
        runtimeRejectionReason: runtimeRejectionReason(input.runtimeOutcome) ?? null,
        executorOutcome: input.runtimeOutcome.result.outcome,
        executorError: input.runtimeOutcome.result.error ?? null,
      },
    },
  ]

  const attempt: RecoveryAttempt = {
    seriesKey,
    recoveryInputFingerprint: input.executorInput.recoveryInputFingerprint,
    attemptNumber: input.attemptNumber,
    maxAttempts: HELD_RECOVERY_MAX_RETRIES,
    status: disposition.status,
    outcome: disposition.outcome,
    terminalCardType: null,
    terminalTrustedPathStatus: null,
    snapshot,
    events,
    createdAt: nowIso,
    updatedAt: nowIso,
  }

  return {
    idempotencyKey,
    heldItemId: input.heldItem.heldItemId,
    opportunityId: input.heldItem.opportunityId,
    manuscriptId: input.heldItem.manuscriptId,
    manuscriptVersionSha: input.heldItem.manuscriptVersionSha,
    heldItemPersistedVersion: input.heldItem.persistedVersion,
    runtimeOutcomeStatus: input.runtimeOutcome.status,
    runtimeRejectionReason: runtimeRejectionReason(input.runtimeOutcome),
    executorResult: jsonCopy(input.runtimeOutcome.result),
    attempt,
  }
}

export function buildHeldRecoveryAttemptIdempotencyKey(
  input: Omit<BuildRecoveryAttemptRecordInput, 'attemptNumber'>,
): string {
  const seriesKey = seriesKeyFor(input.executorInput, input.runtimeOutcome.result)
  return idempotencyKeyFor({
    heldItem: input.heldItem,
    executorInput: input.executorInput,
    runtimeOutcome: input.runtimeOutcome,
    seriesKey,
  })
}

export async function recordHeldRecoveryAttempt(
  adapter: HeldRecoveryAttemptPersistenceAdapter,
  input: RecordRecoveryAttemptInput,
): Promise<RecordRecoveryAttemptResult> {
  const idempotencyKey = buildHeldRecoveryAttemptIdempotencyKey(input)
  const existing = await adapter.findByIdempotencyKey(idempotencyKey)
  if (existing) return { status: 'already_recorded', record: existing }

  const seriesKey = seriesKeyFor(input.executorInput, input.runtimeOutcome.result)
  const priorAttempts = await adapter.countAttemptsForSeries(seriesKey)
  const record = buildHeldRecoveryAttemptRecord({
    ...input,
    attemptNumber: priorAttempts + 1,
  })
  const inserted = await adapter.insertAttempt(record)
  return { status: 'recorded', record: inserted }
}

function rowForRecord(record: HeldRecoveryAttemptRecord): Record<string, unknown> {
  return {
    idempotency_key: record.idempotencyKey,
    held_item_id: record.heldItemId,
    opportunity_id: record.opportunityId,
    manuscript_id: record.manuscriptId,
    manuscript_version_sha: record.manuscriptVersionSha,
    held_item_persisted_version: record.heldItemPersistedVersion,
    runtime_outcome_status: record.runtimeOutcomeStatus,
    runtime_rejection_reason: record.runtimeRejectionReason ?? null,
    executor_result: record.executorResult,
    series_key: record.attempt.seriesKey,
    recovery_input_fingerprint: record.attempt.recoveryInputFingerprint,
    attempt_number: record.attempt.attemptNumber,
    max_attempts: record.attempt.maxAttempts,
    status: record.attempt.status,
    outcome: record.attempt.outcome,
    terminal_card_type: record.attempt.terminalCardType,
    terminal_trusted_path_status: record.attempt.terminalTrustedPathStatus,
    snapshot: record.attempt.snapshot,
    events: record.attempt.events,
    created_at: record.attempt.createdAt,
    updated_at: record.attempt.updatedAt,
  }
}

/**
 * Malformed-row guard: a DB read path must never destructure a non-object row.
 * Mirrors the orchestrator's isRecord() guard (rejects null, arrays, primitives).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function recordFromRow(row: Record<string, any>): HeldRecoveryAttemptRecord {
  return {
    idempotencyKey: row.idempotency_key,
    heldItemId: row.held_item_id,
    opportunityId: row.opportunity_id,
    // Carried unchanged as a canonical string. Never Number(...): held_recovery
    // _attempts.manuscript_id is a bigint whose exact value can exceed 2^53, and
    // a numeric conversion here would silently corrupt the identity. The pg/
    // PostgREST layer already returns bigint as a string.
    manuscriptId: row.manuscript_id,
    manuscriptVersionSha: row.manuscript_version_sha,
    heldItemPersistedVersion: row.held_item_persisted_version,
    runtimeOutcomeStatus: row.runtime_outcome_status,
    runtimeRejectionReason: row.runtime_rejection_reason ?? undefined,
    executorResult: row.executor_result,
    attempt: {
      seriesKey: row.series_key,
      recoveryInputFingerprint: row.recovery_input_fingerprint,
      attemptNumber: Number(row.attempt_number),
      maxAttempts: Number(row.max_attempts),
      status: row.status,
      outcome: row.outcome,
      terminalCardType: row.terminal_card_type ?? null,
      terminalTrustedPathStatus: row.terminal_trusted_path_status ?? null,
      snapshot: row.snapshot,
      events: Array.isArray(row.events) ? row.events : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  }
}

export function createSupabaseHeldRecoveryAttemptPersistenceAdapter(
  supabase: Pick<SupabaseClient, 'from'> = createAdminClient(),
): HeldRecoveryAttemptPersistenceAdapter {
  return {
    async findByIdempotencyKey(idempotencyKey: string): Promise<HeldRecoveryAttemptRecord | null> {
      const { data, error } = await supabase
        .from('held_recovery_attempts')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (error) throw new Error(`Failed to read Held Recovery attempt: ${error.message}`)
      return data ? recordFromRow(data as Record<string, any>) : null
    },

    async countAttemptsForSeries(seriesKey: RecoverySeriesKey): Promise<number> {
      const { count, error } = await supabase
        .from('held_recovery_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('series_key', seriesKey)

      if (error) throw new Error(`Failed to count Held Recovery attempts: ${error.message}`)
      return typeof count === 'number' ? count : 0
    },

    async insertAttempt(record: HeldRecoveryAttemptRecord): Promise<HeldRecoveryAttemptRecord> {
      const { data, error } = await supabase
        .from('held_recovery_attempts')
        .insert(rowForRecord(record))
        .select('*')
        .single()

      if (error) throw new Error(`Failed to persist Held Recovery attempt: ${error.message}`)
      return recordFromRow(data as Record<string, any>)
    },

    async findByHeldItemAndOpportunity(input: {
      readonly heldItemId: string
      readonly opportunityId: string
    }): Promise<readonly HeldRecoveryAttemptRecord[]> {
      // Returns ALL matching rows without imposing an authority order. The loader
      // owns supersession; DB return order is NOT treated as authority. No row is
      // discarded here (exact-parity Unit 3 recovered contract).
      const { data, error } = await supabase
        .from('held_recovery_attempts')
        .select('*')
        .eq('held_item_id', input.heldItemId)
        .eq('opportunity_id', input.opportunityId)

      if (error) {
        throw new Error(`Failed to read Held Recovery attempts for held item: ${error.message}`)
      }
      const rows = Array.isArray(data) ? data : []
      // Malformed-row guard on EVERY row BEFORE mapping: a DB read path must never
      // destructure a non-object row, and it must fail closed rather than silently
      // reinterpret or drop malformed data.
      return rows.map((row, index) => {
        if (!isRecord(row)) {
          throw new Error(
            `Held Recovery attempt row is malformed at index ${index}: expected an object`,
          )
        }
        return recordFromRow(row as Record<string, any>)
      })
    },
  }
}
