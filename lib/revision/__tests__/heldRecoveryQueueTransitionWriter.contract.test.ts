import { describe, it, expect, jest } from '@jest/globals'
import {
  applyHeldQueueTransition,
  buildHeldQueueTransitionWriteRecord,
  createSupabaseHeldQueueTransitionPersistenceAdapter,
  type HeldQueueTransitionPersistenceAdapter,
} from '@/lib/revision/heldRecoveryQueueTransitionWriter'
import type { HeldQueueTransitionDecision } from '@/lib/revision/heldRecoveryQueueTransitionPolicy'

const allowedDecision: HeldQueueTransitionDecision = {
  allowed: true,
  from: 'recovery_attempt_running',
  to: 'recovered_pending_reclassification',
  reason: 'canonical_state_machine_allows_transition',
  authorityVersion: 'authority-v1',
}

const deniedDecision: HeldQueueTransitionDecision = {
  allowed: false,
  from: 'held',
  requestedTo: 'recovery_attempt_running',
  reason: 'canonical_state_machine_denies_transition',
  authorityVersion: 'authority-v1',
}

function adapterReturning(result: Awaited<ReturnType<HeldQueueTransitionPersistenceAdapter['applyAllowedTransition']>>): HeldQueueTransitionPersistenceAdapter {
  return { applyAllowedTransition: jest.fn(async () => result) }
}

describe('held recovery queue transition writer', () => {
  it('rejects denied policy decisions without calling persistence', async () => {
    const adapter = { applyAllowedTransition: jest.fn(async () => { throw new Error('must not persist denied decision') }) }

    await expect(applyHeldQueueTransition(adapter, {
      heldItemId: 'held-1',
      decision: deniedDecision,
    })).resolves.toEqual({ status: 'rejected_denied_decision', decision: deniedDecision })

    expect(adapter.applyAllowedTransition).not.toHaveBeenCalled()
  })

  it('builds a deterministic transition record from an allowed decision without retry or downstream mutation fields', () => {
    const first = buildHeldQueueTransitionWriteRecord({
      heldItemId: 'held-1',
      decision: allowedDecision,
      appliedAt: '2026-07-18T03:30:00.000Z',
    })
    const later = buildHeldQueueTransitionWriteRecord({
      heldItemId: 'held-1',
      decision: allowedDecision,
      appliedAt: '2099-01-01T00:00:00.000Z',
    })
    const changedDecision = buildHeldQueueTransitionWriteRecord({
      heldItemId: 'held-1',
      decision: { ...allowedDecision, authorityVersion: 'authority-v2' },
      appliedAt: '2026-07-18T03:30:00.000Z',
    })

    expect(first.transitionIdempotencyKey).toBe(later.transitionIdempotencyKey)
    expect(first.nextAuthorityVersion).toBe(later.nextAuthorityVersion)
    expect(changedDecision.transitionIdempotencyKey).not.toBe(first.transitionIdempotencyKey)
    expect(first).toMatchObject({
      heldItemId: 'held-1',
      from: 'recovery_attempt_running',
      to: 'recovered_pending_reclassification',
      reason: 'canonical_state_machine_allows_transition',
      decisionAuthorityVersion: 'authority-v1',
      appliedAt: '2026-07-18T03:30:00.000Z',
    })
    expect(first).not.toHaveProperty('retrySchedule')
    expect(first).not.toHaveProperty('recoveryInvocation')
    expect(first).not.toHaveProperty('attemptMutation')
    expect(first).not.toHaveProperty('candidateMutation')
    expect(first).not.toHaveProperty('manuscriptMutation')
    expect(first).not.toHaveProperty('finalReviewMutation')
  })

  it('applies an allowed transition by delegating exactly one compare-and-set record to persistence', async () => {
    const record = buildHeldQueueTransitionWriteRecord({
      heldItemId: 'held-1',
      decision: allowedDecision,
      appliedAt: '2026-07-18T03:30:00.000Z',
    })
    const adapter = adapterReturning({ status: 'applied', record })

    await expect(applyHeldQueueTransition(adapter, {
      heldItemId: 'held-1',
      decision: allowedDecision,
      appliedAt: '2026-07-18T03:30:00.000Z',
    })).resolves.toEqual({ status: 'applied', record })

    expect(adapter.applyAllowedTransition).toHaveBeenCalledTimes(1)
    expect(adapter.applyAllowedTransition).toHaveBeenCalledWith(record)
  })

  it.each([
    { status: 'already_applied', record: buildHeldQueueTransitionWriteRecord({ heldItemId: 'held-1', decision: allowedDecision }) },
    { status: 'rejected_stale', expectedAuthorityVersion: 'authority-v1', actualAuthorityVersion: 'authority-v2' },
    { status: 'rejected_state_mismatch', expectedState: 'recovery_attempt_running', actualState: 'held' },
  ] as const)('returns persistence status $status without scheduling retries', async (adapterResult) => {
    const result = await applyHeldQueueTransition(adapterReturning(adapterResult), {
      heldItemId: 'held-1',
      decision: allowedDecision,
    })

    expect(result).toEqual(adapterResult)
    expect(result).not.toHaveProperty('retrySchedule')
  })

  it('returns persistence_failed when the compare-and-set adapter throws', async () => {
    const adapter = { applyAllowedTransition: jest.fn(async () => { throw new Error('database unavailable') }) }

    await expect(applyHeldQueueTransition(adapter, {
      heldItemId: 'held-1',
      decision: allowedDecision,
    })).resolves.toEqual({ status: 'persistence_failed', error: 'database unavailable' })
  })
})

describe('held recovery queue transition Supabase persistence adapter', () => {
  it('uses only the atomic transition RPC and performs no direct table updates or retry scheduling', async () => {
    const record = buildHeldQueueTransitionWriteRecord({ heldItemId: 'held-1', decision: allowedDecision })
    const forbidden = jest.fn(() => { throw new Error('forbidden direct mutation') })
    const supabase = {
      rpc: jest.fn(async (_name: string, _args: unknown) => ({
        data: {
          status: 'applied',
          held_item_id: record.heldItemId,
          transition_idempotency_key: record.transitionIdempotencyKey,
          from_state: record.from,
          to_state: record.to,
          decision_reason: record.reason,
          decision_authority_version: record.decisionAuthorityVersion,
          next_authority_version: record.nextAuthorityVersion,
          applied_at: record.appliedAt,
        },
        error: null,
      })),
      from: forbidden,
      update: forbidden,
      insert: forbidden,
      upsert: forbidden,
      delete: forbidden,
    }
    const adapter = createSupabaseHeldQueueTransitionPersistenceAdapter(supabase as never)

    await expect(adapter.applyAllowedTransition(record)).resolves.toEqual({ status: 'applied', record })

    expect(supabase.rpc).toHaveBeenCalledWith('apply_held_recovery_queue_transition_atomic', {
      p_transition: {
        held_item_id: record.heldItemId,
        transition_idempotency_key: record.transitionIdempotencyKey,
        from_state: record.from,
        to_state: record.to,
        decision_reason: record.reason,
        decision_authority_version: record.decisionAuthorityVersion,
        next_authority_version: record.nextAuthorityVersion,
        applied_at: record.appliedAt,
      },
    })
    expect(forbidden).not.toHaveBeenCalled()
  })
})