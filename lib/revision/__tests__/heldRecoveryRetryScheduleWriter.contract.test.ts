import { describe, expect, it, jest } from '@jest/globals'
import {
  applyHeldRecoveryRetrySchedule,
  buildHeldRecoveryRetryScheduleWriteRecord,
  createSupabaseHeldRecoveryRetrySchedulePersistenceAdapter,
  type HeldRecoveryRetrySchedulePersistenceAdapter,
} from '@/lib/revision/heldRecoveryRetryScheduleWriter'
import type { HeldRecoveryRetryDecision } from '@/lib/revision/heldRecoveryRetryPolicy'

const eligibleDecision: HeldRecoveryRetryDecision = {
  eligible: true,
  heldItemId: 'held-1',
  retryAt: '2026-07-18T04:00:30.000Z',
  reason: 'retryable_failure_window_open',
  attemptId: 'attempt-1',
  transitionEventId: 'transition-1',
  policyVersion: 'held_recovery_retry_policy_v1',
}

const deniedDecision: HeldRecoveryRetryDecision = {
  eligible: false,
  heldItemId: 'held-1',
  reason: 'terminal_outcome',
  attemptId: 'attempt-1',
  transitionEventId: 'transition-1',
  policyVersion: 'held_recovery_retry_policy_v1',
}

function adapterReturning(result: Awaited<ReturnType<HeldRecoveryRetrySchedulePersistenceAdapter['persistSchedule']>>): HeldRecoveryRetrySchedulePersistenceAdapter {
  return { persistSchedule: jest.fn(async () => result) }
}

describe('held recovery retry schedule writer', () => {
  it('rejects ineligible decisions without calling persistence', async () => {
    const adapter = {
      persistSchedule: jest.fn(async () => {
        throw new Error('must not persist ineligible decision')
      }),
    }

    await expect(applyHeldRecoveryRetrySchedule(adapter, {
      heldItemId: 'held-1',
      decision: deniedDecision,
    })).resolves.toEqual({
      status: 'persistence_failed',
      reason: 'ineligible_retry_decision',
    })

    expect(adapter.persistSchedule).not.toHaveBeenCalled()
  })

  it('builds a deterministic write record preserving canonical provenance fields', () => {
    const first = buildHeldRecoveryRetryScheduleWriteRecord({
      heldItemId: 'held-1',
      decision: eligibleDecision,
      scheduledAt: '2026-07-18T04:00:30.000Z',
    })
    const later = buildHeldRecoveryRetryScheduleWriteRecord({
      heldItemId: 'held-1',
      decision: eligibleDecision,
      scheduledAt: '2099-01-01T00:00:00.000Z',
    })
    const changedPolicy = buildHeldRecoveryRetryScheduleWriteRecord({
      heldItemId: 'held-1',
      decision: { ...eligibleDecision, policyVersion: 'held_recovery_retry_policy_v2' },
      scheduledAt: '2026-07-18T04:00:30.000Z',
    })

    expect(first.scheduleIdempotencyKey).toBe(later.scheduleIdempotencyKey)
    expect(changedPolicy.scheduleIdempotencyKey).not.toBe(first.scheduleIdempotencyKey)
    expect(first).toMatchObject({
      heldItemId: 'held-1',
      attemptId: 'attempt-1',
      transitionEventId: 'transition-1',
      retryAt: '2026-07-18T04:00:30.000Z',
      reason: 'retryable_failure_window_open',
      policyVersion: 'held_recovery_retry_policy_v1',
      scheduledAt: '2026-07-18T04:00:30.000Z',
    })
    expect(first).not.toHaveProperty('queueTransition')
    expect(first).not.toHaveProperty('workerDispatch')
    expect(first).not.toHaveProperty('recoveryExecution')
    expect(first).not.toHaveProperty('attemptMutation')
    expect(first).not.toHaveProperty('candidateMutation')
    expect(first).not.toHaveProperty('manuscriptMutation')
    expect(first).not.toHaveProperty('finalReviewMutation')
  })

  it('delegates exactly one atomic persistence request for an eligible decision', async () => {
    const record = buildHeldRecoveryRetryScheduleWriteRecord({
      heldItemId: 'held-1',
      decision: eligibleDecision,
      scheduledAt: '2026-07-18T04:00:30.000Z',
    })
    const adapter = adapterReturning({
      status: 'scheduled',
      schedule: {
        ...record,
        id: 'schedule-1',
      },
    })

    await expect(applyHeldRecoveryRetrySchedule(adapter, {
      heldItemId: 'held-1',
      decision: eligibleDecision,
      scheduledAt: '2026-07-18T04:00:30.000Z',
    })).resolves.toEqual({
      status: 'scheduled',
      schedule: {
        ...record,
        id: 'schedule-1',
      },
    })

    expect(adapter.persistSchedule).toHaveBeenCalledTimes(1)
    expect(adapter.persistSchedule).toHaveBeenCalledWith(record)
  })

  it.each([
    {
      status: 'already_scheduled',
      schedule: {
        id: 'schedule-1',
        ...buildHeldRecoveryRetryScheduleWriteRecord({ heldItemId: 'held-1', decision: eligibleDecision }),
      },
    },
    { status: 'rejected_stale', reason: 'superseded_by_later_attempt_or_transition' },
    { status: 'persistence_failed', reason: 'idempotency_conflict' },
  ] as const)('returns bounded writer outcome $status', async (adapterResult) => {
    const result = await applyHeldRecoveryRetrySchedule(adapterReturning(adapterResult), {
      heldItemId: 'held-1',
      decision: eligibleDecision,
    })

    expect(result).toEqual(adapterResult)
    expect(result).not.toHaveProperty('queueTransition')
    expect(result).not.toHaveProperty('dispatch')
  })

  it('keeps inputs immutable while scheduling', async () => {
    const decision = { ...eligibleDecision }
    const before = JSON.stringify(decision)
    const adapter = adapterReturning({ status: 'rejected_stale', reason: 'superseded_by_later_attempt_or_transition' })

    await applyHeldRecoveryRetrySchedule(adapter, {
      heldItemId: 'held-1',
      decision,
      scheduledAt: '2026-07-18T04:00:30.000Z',
    })

    expect(JSON.stringify(decision)).toBe(before)
  })
})

describe('held recovery retry schedule Supabase persistence adapter', () => {
  it('uses only the atomic schedule RPC and performs no direct table mutation', async () => {
    const record = buildHeldRecoveryRetryScheduleWriteRecord({
      heldItemId: 'held-1',
      decision: eligibleDecision,
      scheduledAt: '2026-07-18T04:00:30.000Z',
    })
    const forbidden = jest.fn(() => {
      throw new Error('forbidden direct mutation')
    })
    const supabase = {
      rpc: jest.fn(async (_name: string, _args: unknown) => ({
        data: {
          status: 'scheduled',
          id: 'schedule-1',
          schedule_idempotency_key: record.scheduleIdempotencyKey,
          held_item_id: record.heldItemId,
          attempt_id: record.attemptId,
          transition_event_id: record.transitionEventId,
          retry_at: record.retryAt,
          decision_reason: record.reason,
          policy_version: record.policyVersion,
          scheduled_at: record.scheduledAt,
        },
        error: null,
      })),
      from: forbidden,
      update: forbidden,
      insert: forbidden,
      upsert: forbidden,
      delete: forbidden,
    }

    const adapter = createSupabaseHeldRecoveryRetrySchedulePersistenceAdapter(supabase as never)

    await expect(adapter.persistSchedule(record)).resolves.toEqual({
      status: 'scheduled',
      schedule: {
        id: 'schedule-1',
        ...record,
      },
    })

    expect(supabase.rpc).toHaveBeenCalledWith('apply_held_recovery_retry_schedule_atomic', {
      p_schedule: {
        schedule_idempotency_key: record.scheduleIdempotencyKey,
        held_item_id: record.heldItemId,
        attempt_id: record.attemptId,
        transition_event_id: record.transitionEventId,
        retry_at: record.retryAt,
        decision_reason: record.reason,
        policy_version: record.policyVersion,
        scheduled_at: record.scheduledAt,
      },
    })
    expect(forbidden).not.toHaveBeenCalled()
  })
})