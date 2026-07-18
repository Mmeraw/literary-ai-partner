/**
 * Held Recovery Retry Schedule Writer
 *
 * Durable writer boundary for persisting retry schedules from eligible retry
 * decisions only. This module verifies decision eligibility, builds a
 * deterministic idempotency identity, and delegates one atomic persistence
 * operation.
 *
 * It does not execute retries, claim due schedules, invoke workers,
 * transition queues, mutate attempts/candidates/manuscripts/Final Review,
 * or perform API/UI behavior.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { HeldRecoveryRetryDecision } from './heldRecoveryRetryPolicy'
import { sourceHashFor } from './heldRecoveryVersioning'

export type HeldRecoveryRetryScheduleWriteStatus =
  | 'scheduled'
  | 'already_scheduled'
  | 'rejected_stale'
  | 'persistence_failed'

export type HeldRecoveryRetryScheduleWriteRecord = {
  readonly scheduleIdempotencyKey: string
  readonly heldItemId: string
  readonly attemptId: string
  readonly transitionEventId: string
  readonly retryAt: string
  readonly reason: Extract<HeldRecoveryRetryDecision, { readonly eligible: true }>['reason']
  readonly policyVersion: string
  readonly scheduledAt: string
}

export type PersistedHeldRecoveryRetrySchedule = HeldRecoveryRetryScheduleWriteRecord & {
  readonly id: string
}

export type HeldRecoveryRetrySchedulePersistenceAdapterResult =
  | { readonly status: 'scheduled'; readonly schedule: PersistedHeldRecoveryRetrySchedule }
  | { readonly status: 'already_scheduled'; readonly schedule: PersistedHeldRecoveryRetrySchedule }
  | { readonly status: 'rejected_stale'; readonly reason: string }
  | { readonly status: 'persistence_failed'; readonly reason: string }

export type HeldRecoveryRetrySchedulePersistenceAdapter = {
  readonly persistSchedule: (
    schedule: HeldRecoveryRetryScheduleWriteRecord,
  ) => Promise<HeldRecoveryRetrySchedulePersistenceAdapterResult>
}

export type ApplyHeldRecoveryRetryScheduleInput = {
  readonly heldItemId: string
  readonly decision: HeldRecoveryRetryDecision
  readonly scheduledAt?: string
}

export type HeldRecoveryRetryScheduleWriteResult =
  | { readonly status: 'scheduled'; readonly schedule: PersistedHeldRecoveryRetrySchedule }
  | { readonly status: 'already_scheduled'; readonly schedule: PersistedHeldRecoveryRetrySchedule }
  | { readonly status: 'rejected_stale'; readonly reason: string }
  | { readonly status: 'persistence_failed'; readonly reason: string }

function scheduleIdempotencyKeyFor(args: {
  readonly heldItemId: string
  readonly attemptId: string
  readonly transitionEventId: string
  readonly retryAt: string
  readonly reason: Extract<HeldRecoveryRetryDecision, { readonly eligible: true }>['reason']
  readonly policyVersion: string
}): string {
  return sourceHashFor({
    boundary: 'held_recovery_retry_schedule_write_v1',
    heldItemId: args.heldItemId,
    attemptId: args.attemptId,
    transitionEventId: args.transitionEventId,
    retryAt: args.retryAt,
    reason: args.reason,
    policyVersion: args.policyVersion,
  })
}

export function buildHeldRecoveryRetryScheduleWriteRecord(
  input: ApplyHeldRecoveryRetryScheduleInput & {
    readonly decision: HeldRecoveryRetryDecision & { readonly eligible: true }
  },
): HeldRecoveryRetryScheduleWriteRecord {
  return {
    scheduleIdempotencyKey: scheduleIdempotencyKeyFor({
      heldItemId: input.heldItemId,
      attemptId: input.decision.attemptId,
      transitionEventId: input.decision.transitionEventId,
      retryAt: input.decision.retryAt,
      reason: input.decision.reason,
      policyVersion: input.decision.policyVersion,
    }),
    heldItemId: input.heldItemId,
    attemptId: input.decision.attemptId,
    transitionEventId: input.decision.transitionEventId,
    retryAt: input.decision.retryAt,
    reason: input.decision.reason,
    policyVersion: input.decision.policyVersion,
    scheduledAt: input.scheduledAt ?? new Date().toISOString(),
  }
}

export async function applyHeldRecoveryRetrySchedule(
  adapter: HeldRecoveryRetrySchedulePersistenceAdapter,
  input: ApplyHeldRecoveryRetryScheduleInput,
): Promise<HeldRecoveryRetryScheduleWriteResult> {
  if (!input.decision.eligible) {
    return {
      status: 'persistence_failed',
      reason: 'ineligible_retry_decision',
    }
  }

  const record = buildHeldRecoveryRetryScheduleWriteRecord({
    heldItemId: input.heldItemId,
    decision: input.decision,
    scheduledAt: input.scheduledAt,
  })

  try {
    return await adapter.persistSchedule(record)
  } catch (error) {
    return {
      status: 'persistence_failed',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

function scheduleFromRpcRow(row: Record<string, unknown>): PersistedHeldRecoveryRetrySchedule {
  return {
    id: String(row.id),
    scheduleIdempotencyKey: String(row.schedule_idempotency_key),
    heldItemId: String(row.held_item_id),
    attemptId: String(row.attempt_id),
    transitionEventId: String(row.transition_event_id),
    retryAt: String(row.retry_at),
    reason: String(row.decision_reason) as Extract<HeldRecoveryRetryDecision, { readonly eligible: true }>['reason'],
    policyVersion: String(row.policy_version),
    scheduledAt: String(row.scheduled_at),
  }
}

function resultFromRpcResponse(data: unknown): HeldRecoveryRetrySchedulePersistenceAdapterResult {
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  const status = row.status
  switch (status) {
    case 'scheduled':
    case 'already_scheduled':
      return { status, schedule: scheduleFromRpcRow(row) }
    case 'rejected_stale':
      return {
        status,
        reason: typeof row.reason === 'string' ? row.reason : 'superseded_by_later_attempt_or_transition',
      }
    case 'persistence_failed':
      return {
        status,
        reason: typeof row.reason === 'string' ? row.reason : 'retry_schedule_persistence_failed',
      }
    default:
      throw new Error(`Unexpected Held Recovery retry schedule RPC status: ${String(status)}`)
  }
}

export function createSupabaseHeldRecoveryRetrySchedulePersistenceAdapter(
  supabase: Pick<SupabaseClient, 'rpc'> = createAdminClient(),
): HeldRecoveryRetrySchedulePersistenceAdapter {
  return {
    async persistSchedule(schedule: HeldRecoveryRetryScheduleWriteRecord): Promise<HeldRecoveryRetrySchedulePersistenceAdapterResult> {
      const { data, error } = await supabase.rpc('apply_held_recovery_retry_schedule_atomic', {
        p_schedule: {
          schedule_idempotency_key: schedule.scheduleIdempotencyKey,
          held_item_id: schedule.heldItemId,
          attempt_id: schedule.attemptId,
          transition_event_id: schedule.transitionEventId,
          retry_at: schedule.retryAt,
          decision_reason: schedule.reason,
          policy_version: schedule.policyVersion,
          scheduled_at: schedule.scheduledAt,
        },
      })

      if (error) throw new Error(`Failed to persist Held Recovery retry schedule: ${error.message}`)
      return resultFromRpcResponse(data)
    },
  }
}