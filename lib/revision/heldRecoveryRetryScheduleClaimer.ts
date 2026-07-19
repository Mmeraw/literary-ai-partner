/**
 * Held Recovery Retry Schedule Claim/Lease Runtime
 *
 * Runtime boundary for acquiring, renewing, releasing, and completing leases on
 * authoritative retry schedule rows. This module delegates all concurrency and
 * due/stale eligibility decisions to atomic database RPCs.
 *
 * It does not decide retry policy, schedule retries, dispatch workers, execute
 * recovery, transition queues, mutate attempts/candidates/manuscripts/Final
 * Review, or perform API/UI behavior.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export type HeldRecoveryRetryScheduleClaimStatus =
  | 'claimed'
  | 'already_claimed'
  | 'rejected_stale'
  | 'rejected_state_mismatch'
  | 'lease_conflict'
  | 'persistence_failed'

export type HeldRecoveryRetryScheduleLeaseOperationStatus =
  | 'renewed'
  | 'released'
  | 'completed'
  | 'rejected_state_mismatch'
  | 'lease_conflict'
  | 'persistence_failed'

export type HeldRecoveryRetryScheduleLeaseRecord = {
  readonly id: string
  readonly scheduleIdempotencyKey: string
  readonly heldItemId: string
  readonly attemptId: string
  readonly transitionEventId: string
  readonly retryAt: string
  readonly reason: 'retryable_failure_window_open'
  readonly policyVersion: string
  readonly scheduledAt: string
  readonly claimedBy: string | null
  readonly claimedAt: string | null
  readonly leaseToken: string | null
  readonly leaseUntil: string | null
  readonly completedAt: string | null
}

export type ClaimHeldRecoveryRetryScheduleInput = {
  readonly scheduleId: string
  readonly claimedBy: string
  readonly leaseToken: string
  readonly leaseUntil: string
  readonly claimedAt?: string
}

export type RenewHeldRecoveryRetryScheduleLeaseInput = {
  readonly scheduleId: string
  readonly claimedBy: string
  readonly leaseToken: string
  readonly leaseUntil: string
}

export type HeldRecoveryRetryScheduleLeaseOwnerInput = {
  readonly scheduleId: string
  readonly claimedBy: string
  readonly leaseToken: string
}

export type CompleteHeldRecoveryRetryScheduleLeaseInput = HeldRecoveryRetryScheduleLeaseOwnerInput & {
  readonly completedAt?: string
}

export type HeldRecoveryRetryScheduleClaimResult =
  | { readonly status: 'claimed'; readonly schedule: HeldRecoveryRetryScheduleLeaseRecord }
  | { readonly status: 'already_claimed'; readonly schedule: HeldRecoveryRetryScheduleLeaseRecord }
  | { readonly status: 'rejected_stale'; readonly reason: string }
  | {
      readonly status: 'rejected_state_mismatch'
      readonly expectedState: string
      readonly actualState: string | null
    }
  | { readonly status: 'lease_conflict'; readonly reason: string }
  | { readonly status: 'persistence_failed'; readonly reason: string }

export type HeldRecoveryRetryScheduleLeaseOperationResult =
  | { readonly status: 'renewed'; readonly schedule: HeldRecoveryRetryScheduleLeaseRecord }
  | { readonly status: 'released'; readonly schedule: HeldRecoveryRetryScheduleLeaseRecord }
  | { readonly status: 'completed'; readonly schedule: HeldRecoveryRetryScheduleLeaseRecord }
  | {
      readonly status: 'rejected_state_mismatch'
      readonly expectedState: string
      readonly actualState: string | null
    }
  | { readonly status: 'lease_conflict'; readonly reason: string }
  | { readonly status: 'persistence_failed'; readonly reason: string }

export type HeldRecoveryRetryScheduleClaimAdapter = {
  readonly claimSchedule: (
    input: ClaimHeldRecoveryRetryScheduleInput,
  ) => Promise<HeldRecoveryRetryScheduleClaimResult>
  readonly renewLease: (
    input: RenewHeldRecoveryRetryScheduleLeaseInput,
  ) => Promise<HeldRecoveryRetryScheduleLeaseOperationResult>
  readonly releaseLease: (
    input: HeldRecoveryRetryScheduleLeaseOwnerInput,
  ) => Promise<HeldRecoveryRetryScheduleLeaseOperationResult>
  readonly completeSchedule: (
    input: CompleteHeldRecoveryRetryScheduleLeaseInput,
  ) => Promise<HeldRecoveryRetryScheduleLeaseOperationResult>
}

export async function claimHeldRecoveryRetrySchedule(
  adapter: HeldRecoveryRetryScheduleClaimAdapter,
  input: ClaimHeldRecoveryRetryScheduleInput,
): Promise<HeldRecoveryRetryScheduleClaimResult> {
  try {
    return await adapter.claimSchedule(input)
  } catch (error) {
    return {
      status: 'persistence_failed',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function renewHeldRecoveryRetryScheduleLease(
  adapter: HeldRecoveryRetryScheduleClaimAdapter,
  input: RenewHeldRecoveryRetryScheduleLeaseInput,
): Promise<HeldRecoveryRetryScheduleLeaseOperationResult> {
  try {
    return await adapter.renewLease(input)
  } catch (error) {
    return {
      status: 'persistence_failed',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function releaseHeldRecoveryRetryScheduleLease(
  adapter: HeldRecoveryRetryScheduleClaimAdapter,
  input: HeldRecoveryRetryScheduleLeaseOwnerInput,
): Promise<HeldRecoveryRetryScheduleLeaseOperationResult> {
  try {
    return await adapter.releaseLease(input)
  } catch (error) {
    return {
      status: 'persistence_failed',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function completeHeldRecoveryRetryScheduleLease(
  adapter: HeldRecoveryRetryScheduleClaimAdapter,
  input: CompleteHeldRecoveryRetryScheduleLeaseInput,
): Promise<HeldRecoveryRetryScheduleLeaseOperationResult> {
  try {
    return await adapter.completeSchedule(input)
  } catch (error) {
    return {
      status: 'persistence_failed',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function scheduleFromRpcRow(row: Record<string, unknown>): HeldRecoveryRetryScheduleLeaseRecord {
  return {
    id: String(row.id),
    scheduleIdempotencyKey: String(row.schedule_idempotency_key),
    heldItemId: String(row.held_item_id),
    attemptId: String(row.attempt_id),
    transitionEventId: String(row.transition_event_id),
    retryAt: String(row.retry_at),
    reason: String(row.decision_reason) as 'retryable_failure_window_open',
    policyVersion: String(row.policy_version),
    scheduledAt: String(row.scheduled_at),
    claimedBy: nullableString(row.claimed_by),
    claimedAt: nullableString(row.claimed_at),
    leaseToken: nullableString(row.lease_token),
    leaseUntil: nullableString(row.lease_until),
    completedAt: nullableString(row.completed_at),
  }
}

function mismatchFromRpcRow(row: Record<string, unknown>): Extract<
  HeldRecoveryRetryScheduleClaimResult,
  { readonly status: 'rejected_state_mismatch' }
> {
  return {
    status: 'rejected_state_mismatch',
    expectedState: typeof row.expected_state === 'string' ? row.expected_state : 'recovery_attempt_failed_retryable',
    actualState: nullableString(row.actual_state),
  }
}

function claimResultFromRpcResponse(data: unknown): HeldRecoveryRetryScheduleClaimResult {
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  switch (row.status) {
    case 'claimed':
    case 'already_claimed':
      return { status: row.status, schedule: scheduleFromRpcRow(row) }
    case 'rejected_stale':
      return {
        status: 'rejected_stale',
        reason: typeof row.reason === 'string' ? row.reason : 'superseded_by_later_attempt_or_transition',
      }
    case 'rejected_state_mismatch':
      return mismatchFromRpcRow(row)
    case 'lease_conflict':
      return {
        status: 'lease_conflict',
        reason: typeof row.reason === 'string' ? row.reason : 'active_lease_owned_by_another_runtime',
      }
    case 'persistence_failed':
      return {
        status: 'persistence_failed',
        reason: typeof row.reason === 'string' ? row.reason : 'retry_schedule_claim_failed',
      }
    default:
      throw new Error(`Unexpected Held Recovery retry schedule claim RPC status: ${String(row.status)}`)
  }
}

function leaseOperationResultFromRpcResponse(data: unknown): HeldRecoveryRetryScheduleLeaseOperationResult {
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  switch (row.status) {
    case 'renewed':
    case 'released':
    case 'completed':
      return { status: row.status, schedule: scheduleFromRpcRow(row) }
    case 'rejected_state_mismatch':
      return mismatchFromRpcRow(row)
    case 'lease_conflict':
      return {
        status: 'lease_conflict',
        reason: typeof row.reason === 'string' ? row.reason : 'stale_or_not_owner',
      }
    case 'persistence_failed':
      return {
        status: 'persistence_failed',
        reason: typeof row.reason === 'string' ? row.reason : 'retry_schedule_lease_operation_failed',
      }
    default:
      throw new Error(`Unexpected Held Recovery retry schedule lease RPC status: ${String(row.status)}`)
  }
}

export function createSupabaseHeldRecoveryRetryScheduleClaimAdapter(
  supabase: Pick<SupabaseClient, 'rpc'> = createAdminClient(),
): HeldRecoveryRetryScheduleClaimAdapter {
  return {
    async claimSchedule(input: ClaimHeldRecoveryRetryScheduleInput): Promise<HeldRecoveryRetryScheduleClaimResult> {
      const { data, error } = await supabase.rpc('claim_held_recovery_retry_schedule_atomic', {
        p_claim: {
          schedule_id: input.scheduleId,
          claimed_by: input.claimedBy,
          lease_token: input.leaseToken,
          lease_until: input.leaseUntil,
          claimed_at: input.claimedAt,
        },
      })

      if (error) throw new Error(`Failed to claim Held Recovery retry schedule: ${error.message}`)
      return claimResultFromRpcResponse(data)
    },

    async renewLease(input: RenewHeldRecoveryRetryScheduleLeaseInput): Promise<HeldRecoveryRetryScheduleLeaseOperationResult> {
      const { data, error } = await supabase.rpc('renew_held_recovery_retry_schedule_lease_atomic', {
        p_lease: {
          schedule_id: input.scheduleId,
          claimed_by: input.claimedBy,
          lease_token: input.leaseToken,
          lease_until: input.leaseUntil,
        },
      })

      if (error) throw new Error(`Failed to renew Held Recovery retry schedule lease: ${error.message}`)
      return leaseOperationResultFromRpcResponse(data)
    },

    async releaseLease(input: HeldRecoveryRetryScheduleLeaseOwnerInput): Promise<HeldRecoveryRetryScheduleLeaseOperationResult> {
      const { data, error } = await supabase.rpc('release_held_recovery_retry_schedule_lease_atomic', {
        p_lease: {
          schedule_id: input.scheduleId,
          claimed_by: input.claimedBy,
          lease_token: input.leaseToken,
        },
      })

      if (error) throw new Error(`Failed to release Held Recovery retry schedule lease: ${error.message}`)
      return leaseOperationResultFromRpcResponse(data)
    },

    async completeSchedule(input: CompleteHeldRecoveryRetryScheduleLeaseInput): Promise<HeldRecoveryRetryScheduleLeaseOperationResult> {
      const { data, error } = await supabase.rpc('complete_held_recovery_retry_schedule_atomic', {
        p_completion: {
          schedule_id: input.scheduleId,
          claimed_by: input.claimedBy,
          lease_token: input.leaseToken,
          completed_at: input.completedAt,
        },
      })

      if (error) throw new Error(`Failed to complete Held Recovery retry schedule: ${error.message}`)
      return leaseOperationResultFromRpcResponse(data)
    },
  }
}