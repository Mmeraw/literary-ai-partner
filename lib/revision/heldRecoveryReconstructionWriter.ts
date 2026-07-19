/**
 * Held Recovery Reconstruction Writer (persistence adapter)
 *
 * Transport/validation boundary over the six SECURITY DEFINER RPCs created in
 * migration 20260719120000_create_held_recovery_reconstruction_work.sql:
 *
 *   - record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic
 *   - claim_held_recovery_reconstruction_work_atomic
 *   - renew_held_recovery_reconstruction_lease_atomic
 *   - complete_held_recovery_reconstruction_work_atomic
 *   - fail_held_recovery_reconstruction_work_atomic
 *   - supersede_held_recovery_reconstruction_work_atomic
 *
 * AUTHORITY BOUNDARY (must not be crossed by this module):
 *   The adapter may transport and validate persistence data ONLY. It MUST NOT
 *   derive, override, reinterpret, or persist:
 *     - producer                 - admission result       - queue destination
 *     - recovery action override - classification result  - cardType / finalDecision
 *   It does not construct or reinterpret the executor result. The caller supplies
 *   the already-canonical deferred attempt record plus the located continuation.
 *
 * It invokes RPCs only. It performs NO `.from(table).insert/update/delete`.
 * Unknown RPC statuses / malformed payloads FAIL CLOSED (throw a
 * ReconstructionPersistenceContractError) — they are never coerced into
 * rejected_stale, failed_terminal, or a success.
 *
 * MANUSCRIPT IDENTITY (PR #1340 contract): manuscript_id is a canonical decimal
 * STRING end-to-end. It is NEVER coerced to a JS number: a manuscripts.id bigint
 * can exceed 2^53, so Number(...) would silently corrupt the identity. The value
 * is validated against CANONICAL_MANUSCRIPT_ID and carried verbatim.
 *
 * This module contains NO caller wiring and NO worker logic.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Shared value objects ──────────────────────────────────────────────────────

export type ReconstructionWorkStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed_terminal'
  | 'superseded'

/**
 * The ONLY continuation payload the enqueue path accepts. No authority-bearing
 * fields; the recovery method is fixed by the executor's pure resolve_anchor.
 */
export type AnchorReconstructionContinuation = {
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly recoveryMethod: 'source_text_location_only'
}

/**
 * Already-canonical deferred attempt record. The caller has produced this from
 * the executor result; the adapter transports it verbatim and does NOT
 * reinterpret it. Deliberately excludes producer / recoveryAction /
 * admissionResult / classificationResult / queueDestination / cardType /
 * finalDecision — those are not persistence data.
 */
export type CanonicalDeferredAttemptRecord = {
  readonly idempotencyKey: string
  readonly heldItemId: string
  readonly opportunityId: string
  /** Canonical decimal manuscript-id STRING (bigint fidelity); never a number. */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  /** Fixed by the permitted deferred-continuation contract. */
  readonly runtimeOutcomeStatus: 'deferred'
  /** Opaque executor result, transported as-is; adapter never reinterprets it. */
  readonly executorResult: unknown
  readonly seriesKey?: unknown
  readonly recoveryInputFingerprint: string
  readonly attemptNumber: number
  readonly maxAttempts: number
  readonly status: string
  readonly outcome: string
  readonly snapshot?: unknown
}

// ── Inputs (transport/validation only; NO authority fields) ────────────────────

export type RecordDeferredAttemptAndEnqueueInput = {
  readonly attempt: CanonicalDeferredAttemptRecord
  readonly continuation: AnchorReconstructionContinuation
}

export type ClaimReconstructionWorkInput = {
  readonly workerId: string
  readonly leaseSeconds: number
}

export type RenewReconstructionLeaseInput = {
  readonly workItemId: string
  readonly claimToken: string
  readonly leaseSeconds: number
}

export type CompleteReconstructionWorkInput = {
  readonly workItemId: string
  readonly claimToken: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  readonly completionFingerprint: string
}

export type FailReconstructionWorkInput = {
  readonly workItemId: string
  readonly claimToken: string
  readonly terminalReason: string
}

export type SupersedeReconstructionWorkInput = {
  readonly workItemId: string
  readonly reason: string
}

// ── Result unions (every RPC status mapped; never collapsed to boolean) ────────

export type RecordDeferredAttemptAndEnqueueResult =
  | {
      readonly status: 'enqueued'
      readonly attemptId: string
      readonly workItemId: string
      readonly workItemStatus: 'pending'
    }
  | {
      readonly status: 'already_enqueued'
      readonly attemptId: string
      readonly workItemId: string
      readonly workItemStatus: ReconstructionWorkStatus
    }
  | {
      readonly status: 'idempotency_conflict'
      readonly reason:
        | 'immutable_payload_mismatch'
        | 'attempt_exists_without_reconstruction_item'
      readonly attemptId?: string
      readonly workItemId?: string
    }
  | {
      readonly status: 'rejected_stale'
      readonly reason:
        | 'not_permitted_deferred_continuation'
        | 'canonical_version_moved'
        | 'superseded_by_later_attempt'
    }

/** Claimed work carries the located anchor payload the worker needs to reconstruct. */
export type ClaimedReconstructionWork = {
  readonly workItemId: string
  readonly claimToken: string
  readonly claimedBy: string
  readonly leaseExpiresAt: string
  readonly attemptCount: number
  readonly heldItemId: string
  readonly opportunityId: string
  /** Canonical decimal manuscript-id STRING (bigint fidelity); never a number. */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly recoveryMethod: 'source_text_location_only'
}

export type ClaimReconstructionWorkResult =
  | { readonly status: 'claimed'; readonly work: ClaimedReconstructionWork }
  | { readonly status: 'no_work_available' }

export type RenewReconstructionLeaseResult =
  | { readonly status: 'renewed'; readonly workItemId: string; readonly leaseExpiresAt: string }
  | { readonly status: 'lease_lost'; readonly reason?: string }
  | { readonly status: 'not_found' }

/**
 * Completion returns the canonical anchor authority for SEPARATE re-admission by
 * the caller. It does NOT carry a queue destination or a final decision.
 */
export type CompletedReconstructionAuthority = {
  readonly workItemId: string
  /** Canonical decimal manuscript-id STRING (bigint fidelity); never a number. */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly recoveryMethod: 'source_text_location_only'
}

export type CompleteReconstructionWorkResult =
  | { readonly status: 'completed'; readonly authority: CompletedReconstructionAuthority }
  | { readonly status: 'already_completed'; readonly workItemId: string }
  | { readonly status: 'idempotency_conflict'; readonly reason: 'completion_fingerprint_mismatch' }
  | {
      readonly status: 'rejected_stale'
      readonly reason: 'canonical_version_moved' | 'superseded_by_later_attempt'
    }
  | { readonly status: 'rejected_terminal' }
  | { readonly status: 'lease_lost'; readonly reason?: string }
  | { readonly status: 'not_found' }

export type FailReconstructionWorkResult =
  | { readonly status: 'failed_terminal'; readonly workItemId: string; readonly terminalReason: string }
  | { readonly status: 'already_failed_terminal' }
  | { readonly status: 'lease_lost'; readonly reason?: string }
  | { readonly status: 'not_found' }

export type SupersedeReconstructionWorkResult =
  | { readonly status: 'superseded'; readonly workItemId: string; readonly terminalReason: string }
  | { readonly status: 'already_superseded' }
  | { readonly status: 'rejected_terminal'; readonly reason?: string }
  | { readonly status: 'not_found' }

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface HeldRecoveryReconstructionPersistenceAdapter {
  recordDeferredAttemptAndEnqueue(
    input: RecordDeferredAttemptAndEnqueueInput,
  ): Promise<RecordDeferredAttemptAndEnqueueResult>

  claimNext(input: ClaimReconstructionWorkInput): Promise<ClaimReconstructionWorkResult>

  renewLease(input: RenewReconstructionLeaseInput): Promise<RenewReconstructionLeaseResult>

  complete(input: CompleteReconstructionWorkInput): Promise<CompleteReconstructionWorkResult>

  failTerminal(input: FailReconstructionWorkInput): Promise<FailReconstructionWorkResult>

  supersede(input: SupersedeReconstructionWorkInput): Promise<SupersedeReconstructionWorkResult>
}

// ── Contract error (fail-closed) ──────────────────────────────────────────────

export class ReconstructionPersistenceContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReconstructionPersistenceContractError'
  }
}

// ── Input validation (persistence-shape only) ─────────────────────────────────

/**
 * Canonical non-negative decimal integer string: "0" or a leading-non-zero run
 * of digits. Mirrors CANONICAL_INTEGER_STRING in heldRecoveryRuntimeInputs.ts.
 * Used to guard manuscript_id WITHOUT numeric coercion (bigint fidelity).
 */
const CANONICAL_MANUSCRIPT_ID = /^(0|[1-9][0-9]*)$/

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ReconstructionPersistenceContractError(`${field} must be a non-empty string`)
  }
  return value
}

function requireInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ReconstructionPersistenceContractError(`${field} must be an integer`)
  }
  return value
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  const n = requireInteger(value, field)
  if (n < 0) {
    throw new ReconstructionPersistenceContractError(`${field} must be a non-negative integer`)
  }
  return n
}

function requirePositiveInteger(value: unknown, field: string): number {
  const n = requireInteger(value, field)
  if (n <= 0) {
    throw new ReconstructionPersistenceContractError(`${field} must be a positive integer`)
  }
  return n
}

/**
 * Validate a canonical decimal manuscript-id STRING. NEVER coerces to a number:
 * the value can exceed 2^53, so Number(...) would corrupt identity. A numeric
 * input (or any non-canonical string) fails closed.
 */
function requireCanonicalManuscriptId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !CANONICAL_MANUSCRIPT_ID.test(value)) {
    throw new ReconstructionPersistenceContractError(
      `${field} must be a canonical decimal manuscript-id string`,
    )
  }
  return value
}

/** Explicit parser (NOT a cast) so an invented DB status fails closed. */
function reconstructionWorkStatusOf(
  value: unknown,
  field = 'rpc.work_item_status',
): ReconstructionWorkStatus {
  switch (value) {
    case 'pending':
    case 'running':
    case 'completed':
    case 'failed_terminal':
    case 'superseded':
      return value
    default:
      throw new ReconstructionPersistenceContractError(
        `${field} has an unexpected value: ${String(value)}`,
      )
  }
}

function validateContinuation(c: AnchorReconstructionContinuation): void {
  requireNonEmptyString(c.sourceHash, 'continuation.sourceHash')
  requireNonNegativeInteger(c.sourceStartOffset, 'continuation.sourceStartOffset')
  requireNonNegativeInteger(c.sourceEndOffset, 'continuation.sourceEndOffset')
  if (c.sourceEndOffset < c.sourceStartOffset) {
    throw new ReconstructionPersistenceContractError(
      'continuation.sourceEndOffset must be >= sourceStartOffset',
    )
  }
  if (c.recoveryMethod !== 'source_text_location_only') {
    throw new ReconstructionPersistenceContractError(
      "continuation.recoveryMethod must be 'source_text_location_only'",
    )
  }
}

// ── RPC response coercion (unknown -> throw) ──────────────────────────────────

function asObject(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ReconstructionPersistenceContractError('RPC returned a non-object payload')
  }
  return data as Record<string, unknown>
}

function str(row: Record<string, unknown>, key: string): string {
  return requireNonEmptyString(row[key], `rpc.${key}`)
}

function num(row: Record<string, unknown>, key: string): number {
  const v = row[key]
  const n = typeof v === 'string' ? Number(v) : v
  return requireInteger(n, `rpc.${key}`)
}

/**
 * Read a canonical manuscript-id STRING from an RPC row. The RPC returns
 * manuscript_id as `::text`; this validates it verbatim and NEVER applies
 * Number()/parseInt — a numeric payload fails closed.
 */
function canonicalManuscriptId(row: Record<string, unknown>, key: string): string {
  return requireCanonicalManuscriptId(row[key], `rpc.${key}`)
}

function recoveryMethodOf(row: Record<string, unknown>): 'source_text_location_only' {
  const rm = row.recovery_method
  if (rm !== 'source_text_location_only') {
    throw new ReconstructionPersistenceContractError(
      `rpc.recovery_method must be 'source_text_location_only', got ${String(rm)}`,
    )
  }
  return rm
}

function unexpected(fn: string, status: unknown): never {
  throw new ReconstructionPersistenceContractError(
    `Unexpected ${fn} RPC status: ${String(status)}`,
  )
}

// ── Supabase concrete adapter (RPC-only) ──────────────────────────────────────

export function createSupabaseHeldRecoveryReconstructionPersistenceAdapter(
  supabase: Pick<SupabaseClient, 'rpc'> = createAdminClient(),
  options: { readonly opportunityIds?: readonly string[] } = {},
): HeldRecoveryReconstructionPersistenceAdapter {
  return {
    async recordDeferredAttemptAndEnqueue(input) {
      const { attempt, continuation } = input
      validateContinuation(continuation)
      requireNonEmptyString(attempt.idempotencyKey, 'attempt.idempotencyKey')
      requireNonEmptyString(attempt.heldItemId, 'attempt.heldItemId')
      requireNonEmptyString(attempt.opportunityId, 'attempt.opportunityId')
      requireCanonicalManuscriptId(attempt.manuscriptId, 'attempt.manuscriptId')
      requireNonEmptyString(attempt.manuscriptVersionSha, 'attempt.manuscriptVersionSha')
      requireNonEmptyString(attempt.heldItemPersistedVersion, 'attempt.heldItemPersistedVersion')
      requireNonEmptyString(attempt.recoveryInputFingerprint, 'attempt.recoveryInputFingerprint')
      requirePositiveInteger(attempt.attemptNumber, 'attempt.attemptNumber')
      requirePositiveInteger(attempt.maxAttempts, 'attempt.maxAttempts')
      if (attempt.attemptNumber > attempt.maxAttempts) {
        throw new ReconstructionPersistenceContractError(
          'attempt.attemptNumber must be <= attempt.maxAttempts',
        )
      }
      requireNonEmptyString(attempt.status, 'attempt.status')
      requireNonEmptyString(attempt.outcome, 'attempt.outcome')
      if (attempt.runtimeOutcomeStatus !== 'deferred') {
        throw new ReconstructionPersistenceContractError(
          "attempt.runtimeOutcomeStatus must be 'deferred'",
        )
      }

      const { data, error } = await supabase.rpc(
        'record_held_recovery_deferred_attempt_and_enqueue_reconstruction_atomic',
        {
          p_request: {
            attempt: {
              idempotency_key: attempt.idempotencyKey,
              held_item_id: attempt.heldItemId,
              opportunity_id: attempt.opportunityId,
              manuscript_id: attempt.manuscriptId,
              manuscript_version_sha: attempt.manuscriptVersionSha,
              held_item_persisted_version: attempt.heldItemPersistedVersion,
              runtime_outcome_status: attempt.runtimeOutcomeStatus,
              executor_result: attempt.executorResult,
              series_key: attempt.seriesKey ?? null,
              recovery_input_fingerprint: attempt.recoveryInputFingerprint,
              attempt_number: attempt.attemptNumber,
              max_attempts: attempt.maxAttempts,
              status: attempt.status,
              outcome: attempt.outcome,
              snapshot: attempt.snapshot ?? null,
            },
            continuation: {
              source_hash: continuation.sourceHash,
              source_start_offset: continuation.sourceStartOffset,
              source_end_offset: continuation.sourceEndOffset,
              recovery_method: continuation.recoveryMethod,
            },
          },
        },
      )
      if (error) {
        throw new ReconstructionPersistenceContractError(
          `Failed to record deferred attempt and enqueue reconstruction: ${error.message}`,
        )
      }
      const row = asObject(data)
      switch (row.status) {
        case 'enqueued':
          return {
            status: 'enqueued',
            attemptId: str(row, 'attempt_id'),
            workItemId: str(row, 'work_item_id'),
            workItemStatus: 'pending',
          }
        case 'already_enqueued':
          return {
            status: 'already_enqueued',
            attemptId: str(row, 'attempt_id'),
            workItemId: str(row, 'work_item_id'),
            workItemStatus: reconstructionWorkStatusOf(row.work_item_status),
          }
        case 'idempotency_conflict': {
          const reason = row.reason
          if (
            reason !== 'immutable_payload_mismatch' &&
            reason !== 'attempt_exists_without_reconstruction_item'
          ) {
            unexpected('enqueue.idempotency_conflict.reason', reason)
          }
          return {
            status: 'idempotency_conflict',
            reason,
            attemptId: typeof row.attempt_id === 'string' ? row.attempt_id : undefined,
            workItemId: typeof row.work_item_id === 'string' ? row.work_item_id : undefined,
          }
        }
        case 'rejected_stale': {
          const reason = row.reason
          if (
            reason !== 'not_permitted_deferred_continuation' &&
            reason !== 'canonical_version_moved' &&
            reason !== 'superseded_by_later_attempt'
          ) {
            unexpected('enqueue.rejected_stale.reason', reason)
          }
          return { status: 'rejected_stale', reason }
        }
        default:
          return unexpected('recordDeferredAttemptAndEnqueue', row.status)
      }
    },

    async claimNext(input) {
      requireNonEmptyString(input.workerId, 'workerId')
      requirePositiveInteger(input.leaseSeconds, 'leaseSeconds')

      const opportunityIds = options.opportunityIds
      const { data, error } = opportunityIds
        ? await supabase.rpc(
            'claim_held_recovery_reconstruction_work_for_opportunities_atomic',
            {
              p_worker_id: input.workerId,
              p_lease_seconds: input.leaseSeconds,
              p_opportunity_ids: [...opportunityIds],
            },
          )
        : await supabase.rpc(
            'claim_held_recovery_reconstruction_work_atomic',
            { p_worker_id: input.workerId, p_lease_seconds: input.leaseSeconds },
          )
      if (error) {
        throw new ReconstructionPersistenceContractError(
          `Failed to claim reconstruction work: ${error.message}`,
        )
      }
      const row = asObject(data)
      switch (row.status) {
        case 'no_work_available':
          return { status: 'no_work_available' }
        case 'claimed':
          return {
            status: 'claimed',
            work: {
              workItemId: str(row, 'work_item_id'),
              claimToken: str(row, 'claim_token'),
              claimedBy: str(row, 'claimed_by'),
              leaseExpiresAt: str(row, 'lease_expires_at'),
              attemptCount: num(row, 'attempt_count'),
              heldItemId: str(row, 'held_item_id'),
              opportunityId: str(row, 'opportunity_id'),
              manuscriptId: canonicalManuscriptId(row, 'manuscript_id'),
              manuscriptVersionSha: str(row, 'manuscript_version_sha'),
              heldItemPersistedVersion: str(row, 'held_item_persisted_version'),
              sourceHash: str(row, 'source_hash'),
              sourceStartOffset: num(row, 'source_start_offset'),
              sourceEndOffset: num(row, 'source_end_offset'),
              recoveryMethod: recoveryMethodOf(row),
            },
          }
        default:
          return unexpected('claimNext', row.status)
      }
    },

    async renewLease(input) {
      requireNonEmptyString(input.workItemId, 'workItemId')
      requireNonEmptyString(input.claimToken, 'claimToken')
      requirePositiveInteger(input.leaseSeconds, 'leaseSeconds')

      const { data, error } = await supabase.rpc(
        'renew_held_recovery_reconstruction_lease_atomic',
        {
          p_request: {
            work_item_id: input.workItemId,
            claim_token: input.claimToken,
            lease_seconds: input.leaseSeconds,
          },
        },
      )
      if (error) {
        throw new ReconstructionPersistenceContractError(
          `Failed to renew reconstruction lease: ${error.message}`,
        )
      }
      const row = asObject(data)
      switch (row.status) {
        case 'renewed':
          return {
            status: 'renewed',
            workItemId: str(row, 'work_item_id'),
            leaseExpiresAt: str(row, 'lease_expires_at'),
          }
        case 'lease_lost':
          return { status: 'lease_lost', reason: typeof row.reason === 'string' ? row.reason : undefined }
        case 'not_found':
          return { status: 'not_found' }
        default:
          return unexpected('renewLease', row.status)
      }
    },

    async complete(input) {
      requireNonEmptyString(input.workItemId, 'workItemId')
      requireNonEmptyString(input.claimToken, 'claimToken')
      requireNonEmptyString(input.manuscriptVersionSha, 'manuscriptVersionSha')
      requireNonEmptyString(input.heldItemPersistedVersion, 'heldItemPersistedVersion')
      requireNonEmptyString(input.completionFingerprint, 'completionFingerprint')

      const { data, error } = await supabase.rpc(
        'complete_held_recovery_reconstruction_work_atomic',
        {
          p_request: {
            work_item_id: input.workItemId,
            claim_token: input.claimToken,
            manuscript_version_sha: input.manuscriptVersionSha,
            held_item_persisted_version: input.heldItemPersistedVersion,
            completion_fingerprint: input.completionFingerprint,
          },
        },
      )
      if (error) {
        throw new ReconstructionPersistenceContractError(
          `Failed to complete reconstruction work: ${error.message}`,
        )
      }
      const row = asObject(data)
      switch (row.status) {
        case 'completed':
          return {
            status: 'completed',
            authority: {
              workItemId: str(row, 'work_item_id'),
              manuscriptId: canonicalManuscriptId(row, 'manuscript_id'),
              manuscriptVersionSha: str(row, 'manuscript_version_sha'),
              heldItemPersistedVersion: str(row, 'held_item_persisted_version'),
              sourceHash: str(row, 'source_hash'),
              sourceStartOffset: num(row, 'source_start_offset'),
              sourceEndOffset: num(row, 'source_end_offset'),
              recoveryMethod: recoveryMethodOf(row),
            },
          }
        case 'already_completed':
          return { status: 'already_completed', workItemId: str(row, 'work_item_id') }
        case 'idempotency_conflict': {
          if (row.reason !== 'completion_fingerprint_mismatch') {
            unexpected('complete.idempotency_conflict.reason', row.reason)
          }
          return { status: 'idempotency_conflict', reason: 'completion_fingerprint_mismatch' }
        }
        case 'rejected_stale': {
          const reason = row.reason
          if (reason !== 'canonical_version_moved' && reason !== 'superseded_by_later_attempt') {
            unexpected('complete.rejected_stale.reason', reason)
          }
          return { status: 'rejected_stale', reason }
        }
        case 'rejected_terminal':
          return { status: 'rejected_terminal' }
        case 'lease_lost':
          return { status: 'lease_lost', reason: typeof row.reason === 'string' ? row.reason : undefined }
        case 'not_found':
          return { status: 'not_found' }
        default:
          return unexpected('complete', row.status)
      }
    },

    async failTerminal(input) {
      requireNonEmptyString(input.workItemId, 'workItemId')
      requireNonEmptyString(input.claimToken, 'claimToken')
      requireNonEmptyString(input.terminalReason, 'terminalReason')

      const { data, error } = await supabase.rpc(
        'fail_held_recovery_reconstruction_work_atomic',
        {
          p_request: {
            work_item_id: input.workItemId,
            claim_token: input.claimToken,
            terminal_reason: input.terminalReason,
          },
        },
      )
      if (error) {
        throw new ReconstructionPersistenceContractError(
          `Failed to fail reconstruction work: ${error.message}`,
        )
      }
      const row = asObject(data)
      switch (row.status) {
        case 'failed_terminal':
          return {
            status: 'failed_terminal',
            workItemId: str(row, 'work_item_id'),
            terminalReason: str(row, 'terminal_reason'),
          }
        case 'already_failed_terminal':
          return { status: 'already_failed_terminal' }
        case 'lease_lost':
          return { status: 'lease_lost', reason: typeof row.reason === 'string' ? row.reason : undefined }
        case 'not_found':
          return { status: 'not_found' }
        default:
          return unexpected('failTerminal', row.status)
      }
    },

    async supersede(input) {
      requireNonEmptyString(input.workItemId, 'workItemId')
      requireNonEmptyString(input.reason, 'reason')

      const { data, error } = await supabase.rpc(
        'supersede_held_recovery_reconstruction_work_atomic',
        { p_request: { work_item_id: input.workItemId, reason: input.reason } },
      )
      if (error) {
        throw new ReconstructionPersistenceContractError(
          `Failed to supersede reconstruction work: ${error.message}`,
        )
      }
      const row = asObject(data)
      switch (row.status) {
        case 'superseded':
          return {
            status: 'superseded',
            workItemId: str(row, 'work_item_id'),
            terminalReason: str(row, 'terminal_reason'),
          }
        case 'already_superseded':
          return { status: 'already_superseded' }
        case 'rejected_terminal':
          return { status: 'rejected_terminal', reason: typeof row.reason === 'string' ? row.reason : undefined }
        case 'not_found':
          return { status: 'not_found' }
        default:
          return unexpected('supersede', row.status)
      }
    },
  }
}
