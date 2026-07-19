import { describe, expect, it, jest } from '@jest/globals'
import {
  claimHeldRecoveryRetrySchedule,
  completeHeldRecoveryRetryScheduleLease,
  createSupabaseHeldRecoveryRetryScheduleClaimAdapter,
  releaseHeldRecoveryRetryScheduleLease,
  renewHeldRecoveryRetryScheduleLease,
  type HeldRecoveryRetryScheduleClaimAdapter,
  type HeldRecoveryRetryScheduleClaimResult,
  type HeldRecoveryRetryScheduleLeaseOperationResult,
  type HeldRecoveryRetryScheduleLeaseRecord,
} from '@/lib/revision/heldRecoveryRetryScheduleClaimer'

const claimedSchedule: HeldRecoveryRetryScheduleLeaseRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  scheduleIdempotencyKey: 'schedule-key-1',
  heldItemId: 'held-1',
  attemptId: 'attempt-1',
  transitionEventId: 'transition-1',
  retryAt: '2026-07-18T04:00:00.000Z',
  reason: 'retryable_failure_window_open' as const,
  policyVersion: 'held_recovery_retry_policy_v1',
  scheduledAt: '2026-07-18T03:59:00.000Z',
  claimedBy: 'production:127.0.0.1:trace-1',
  claimedAt: '2026-07-18T04:00:01.000Z',
  leaseToken: '22222222-2222-4222-8222-222222222222',
  leaseUntil: '2026-07-18T04:05:01.000Z',
  completedAt: null,
}

const claimInput = {
  scheduleId: claimedSchedule.id,
  claimedBy: claimedSchedule.claimedBy,
  leaseToken: claimedSchedule.leaseToken,
  leaseUntil: claimedSchedule.leaseUntil,
  claimedAt: claimedSchedule.claimedAt,
}

function adapterReturning(
  overrides: Partial<HeldRecoveryRetryScheduleClaimAdapter> = {},
): HeldRecoveryRetryScheduleClaimAdapter {
  return {
    claimSchedule: jest.fn<() => Promise<HeldRecoveryRetryScheduleClaimResult>>(async () => ({ status: 'claimed', schedule: claimedSchedule })),
    renewLease: jest.fn<() => Promise<HeldRecoveryRetryScheduleLeaseOperationResult>>(async () => ({ status: 'renewed', schedule: claimedSchedule })),
    releaseLease: jest.fn<() => Promise<HeldRecoveryRetryScheduleLeaseOperationResult>>(async () => ({ status: 'released', schedule: claimedSchedule })),
    completeSchedule: jest.fn<() => Promise<HeldRecoveryRetryScheduleLeaseOperationResult>>(async () => ({ status: 'completed', schedule: claimedSchedule })),
    ...overrides,
  }
}

describe('held recovery retry schedule claim/lease runtime', () => {
  it('delegates claim acquisition to one atomic adapter operation and does not dispatch', async () => {
    const adapter = adapterReturning()

    await expect(claimHeldRecoveryRetrySchedule(adapter, claimInput)).resolves.toEqual({
      status: 'claimed',
      schedule: claimedSchedule,
    })

    expect(adapter.claimSchedule).toHaveBeenCalledTimes(1)
    expect(adapter.claimSchedule).toHaveBeenCalledWith(claimInput)
    expect(adapter.renewLease).not.toHaveBeenCalled()
    expect(adapter.releaseLease).not.toHaveBeenCalled()
    expect(adapter.completeSchedule).not.toHaveBeenCalled()
  })

  it('preserves explicit idempotent claim replay outcomes', async () => {
    const adapter = adapterReturning({
      claimSchedule: jest.fn<() => Promise<HeldRecoveryRetryScheduleClaimResult>>(async () => ({ status: 'already_claimed', schedule: claimedSchedule })),
    })

    await expect(claimHeldRecoveryRetrySchedule(adapter, claimInput)).resolves.toEqual({
      status: 'already_claimed',
      schedule: claimedSchedule,
    })

    expect(adapter.claimSchedule).toHaveBeenCalledWith(claimInput)
  })

  it.each([
    { status: 'rejected_stale', reason: 'superseded_by_later_attempt_or_transition' },
    {
      status: 'rejected_state_mismatch',
      expectedState: 'recovery_attempt_failed_retryable',
      actualState: 'dismissed',
    },
    { status: 'lease_conflict', reason: 'active_lease_owned_by_another_runtime' },
    { status: 'persistence_failed', reason: 'claim_rpc_failed' },
  ] as const)('returns bounded claim outcome $status', async (result) => {
    const adapter = adapterReturning({
      claimSchedule: jest.fn<() => Promise<HeldRecoveryRetryScheduleClaimResult>>(async () => result),
    })

    await expect(claimHeldRecoveryRetrySchedule(adapter, claimInput)).resolves.toEqual(result)
  })

  it('requires current lease ownership for renew, release, and completion helpers', async () => {
    const adapter = adapterReturning()
    const leaseInput = {
      scheduleId: claimedSchedule.id,
      claimedBy: claimedSchedule.claimedBy,
      leaseToken: claimedSchedule.leaseToken,
    }

    await expect(renewHeldRecoveryRetryScheduleLease(adapter, {
      ...leaseInput,
      leaseUntil: '2026-07-18T04:10:01.000Z',
    })).resolves.toEqual({ status: 'renewed', schedule: claimedSchedule })
    await expect(releaseHeldRecoveryRetryScheduleLease(adapter, leaseInput)).resolves.toEqual({
      status: 'released',
      schedule: claimedSchedule,
    })
    await expect(completeHeldRecoveryRetryScheduleLease(adapter, {
      ...leaseInput,
      completedAt: '2026-07-18T04:04:01.000Z',
    })).resolves.toEqual({ status: 'completed', schedule: claimedSchedule })

    expect(adapter.renewLease).toHaveBeenCalledTimes(1)
    expect(adapter.releaseLease).toHaveBeenCalledTimes(1)
    expect(adapter.completeSchedule).toHaveBeenCalledTimes(1)
  })
})

describe('held recovery retry schedule Supabase claim adapter', () => {
  it('uses only atomic lease RPCs and performs no direct table mutation', async () => {
    const forbidden = jest.fn(() => {
      throw new Error('forbidden direct mutation')
    })
    const supabase = {
      rpc: jest.fn(async (name: string) => ({
        data: {
          status: name.includes('claim')
            ? 'claimed'
            : name.includes('renew')
              ? 'renewed'
              : name.includes('release')
                ? 'released'
                : 'completed',
          id: claimedSchedule.id,
          schedule_idempotency_key: claimedSchedule.scheduleIdempotencyKey,
          held_item_id: claimedSchedule.heldItemId,
          attempt_id: claimedSchedule.attemptId,
          transition_event_id: claimedSchedule.transitionEventId,
          retry_at: claimedSchedule.retryAt,
          decision_reason: claimedSchedule.reason,
          policy_version: claimedSchedule.policyVersion,
          scheduled_at: claimedSchedule.scheduledAt,
          claimed_by: claimedSchedule.claimedBy,
          claimed_at: claimedSchedule.claimedAt,
          lease_token: claimedSchedule.leaseToken,
          lease_until: claimedSchedule.leaseUntil,
          completed_at: claimedSchedule.completedAt,
        },
        error: null,
      })),
      from: forbidden,
      update: forbidden,
      insert: forbidden,
      upsert: forbidden,
      delete: forbidden,
    }

    const adapter = createSupabaseHeldRecoveryRetryScheduleClaimAdapter(supabase as never)

    await expect(adapter.claimSchedule(claimInput)).resolves.toEqual({
      status: 'claimed',
      schedule: claimedSchedule,
    })
    await expect(adapter.renewLease({
      scheduleId: claimedSchedule.id,
      claimedBy: claimedSchedule.claimedBy,
      leaseToken: claimedSchedule.leaseToken,
      leaseUntil: '2026-07-18T04:10:01.000Z',
    })).resolves.toMatchObject({ status: 'renewed' })
    await expect(adapter.releaseLease({
      scheduleId: claimedSchedule.id,
      claimedBy: claimedSchedule.claimedBy,
      leaseToken: claimedSchedule.leaseToken,
    })).resolves.toMatchObject({ status: 'released' })
    await expect(adapter.completeSchedule({
      scheduleId: claimedSchedule.id,
      claimedBy: claimedSchedule.claimedBy,
      leaseToken: claimedSchedule.leaseToken,
      completedAt: '2026-07-18T04:04:01.000Z',
    })).resolves.toMatchObject({ status: 'completed' })

    expect(supabase.rpc.mock.calls[0]).toEqual(['claim_held_recovery_retry_schedule_atomic', {
      p_claim: {
        schedule_id: claimedSchedule.id,
        claimed_by: claimedSchedule.claimedBy,
        lease_token: claimedSchedule.leaseToken,
        lease_until: claimedSchedule.leaseUntil,
        claimed_at: claimedSchedule.claimedAt,
      },
    }])
    expect(supabase.rpc.mock.calls[1]).toEqual(['renew_held_recovery_retry_schedule_lease_atomic', {
      p_lease: {
        schedule_id: claimedSchedule.id,
        claimed_by: claimedSchedule.claimedBy,
        lease_token: claimedSchedule.leaseToken,
        lease_until: '2026-07-18T04:10:01.000Z',
      },
    }])
    expect(supabase.rpc.mock.calls[2]).toEqual(['release_held_recovery_retry_schedule_lease_atomic', {
      p_lease: {
        schedule_id: claimedSchedule.id,
        claimed_by: claimedSchedule.claimedBy,
        lease_token: claimedSchedule.leaseToken,
      },
    }])
    expect(supabase.rpc.mock.calls[3]).toEqual(['complete_held_recovery_retry_schedule_atomic', {
      p_completion: {
        schedule_id: claimedSchedule.id,
        claimed_by: claimedSchedule.claimedBy,
        lease_token: claimedSchedule.leaseToken,
        completed_at: '2026-07-18T04:04:01.000Z',
      },
    }])
    expect(forbidden).not.toHaveBeenCalled()
  })
})