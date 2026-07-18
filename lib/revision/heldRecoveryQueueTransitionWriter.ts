/**
 * Held Recovery Queue Transition Writer
 *
 * Durable writer boundary for applying an allowed queue-transition policy
 * decision. This module verifies a decision and delegates one atomic
 * compare-and-set persistence operation; it does not decide transitions,
 * schedule retries, invoke recovery, mutate attempts, candidates, manuscripts,
 * Final Review, workers, API, or UI state.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { HeldQueueState, HeldQueueTransitionDecision } from './heldRecoveryQueueTransitionPolicy'
import { sourceHashFor } from './heldRecoveryVersioning'

export type HeldQueueTransitionWriteStatus =
  | 'applied'
  | 'already_applied'
  | 'rejected_stale'
  | 'rejected_state_mismatch'
  | 'rejected_denied_decision'
  | 'persistence_failed'

export type HeldQueueTransitionWriteRecord = {
  readonly heldItemId: string
  readonly transitionIdempotencyKey: string
  readonly from: HeldQueueState
  readonly to: HeldQueueState
  readonly reason: Extract<HeldQueueTransitionDecision, { readonly allowed: true }>['reason']
  readonly decisionAuthorityVersion: string
  readonly nextAuthorityVersion: string
  readonly appliedAt: string
}

export type HeldQueueTransitionPersistenceAdapterResult =
  | { readonly status: 'applied'; readonly record: HeldQueueTransitionWriteRecord }
  | { readonly status: 'already_applied'; readonly record: HeldQueueTransitionWriteRecord }
  | {
      readonly status: 'rejected_stale'
      readonly expectedAuthorityVersion: string
      readonly actualAuthorityVersion: string | null
    }
  | {
      readonly status: 'rejected_state_mismatch'
      readonly expectedState: HeldQueueState
      readonly actualState: HeldQueueState | null
    }

export type HeldQueueTransitionPersistenceAdapter = {
  readonly applyAllowedTransition: (
    record: HeldQueueTransitionWriteRecord,
  ) => Promise<HeldQueueTransitionPersistenceAdapterResult>
}

export type ApplyHeldQueueTransitionInput = {
  readonly heldItemId: string
  readonly decision: HeldQueueTransitionDecision
  readonly appliedAt?: string
}

export type HeldQueueTransitionWriteResult =
  | { readonly status: 'applied'; readonly record: HeldQueueTransitionWriteRecord }
  | { readonly status: 'already_applied'; readonly record: HeldQueueTransitionWriteRecord }
  | {
      readonly status: 'rejected_stale'
      readonly expectedAuthorityVersion: string
      readonly actualAuthorityVersion: string | null
    }
  | {
      readonly status: 'rejected_state_mismatch'
      readonly expectedState: HeldQueueState
      readonly actualState: HeldQueueState | null
    }
  | { readonly status: 'rejected_denied_decision'; readonly decision: HeldQueueTransitionDecision }
  | { readonly status: 'persistence_failed'; readonly error: string }

function nextAuthorityVersionFor(args: {
  readonly heldItemId: string
  readonly from: HeldQueueState
  readonly to: HeldQueueState
  readonly decisionAuthorityVersion: string
}): string {
  return sourceHashFor({
    boundary: 'held_queue_transition_next_authority_v1',
    heldItemId: args.heldItemId,
    from: args.from,
    to: args.to,
    decisionAuthorityVersion: args.decisionAuthorityVersion,
  })
}

function transitionIdempotencyKeyFor(args: {
  readonly heldItemId: string
  readonly from: HeldQueueState
  readonly to: HeldQueueState
  readonly decisionAuthorityVersion: string
  readonly nextAuthorityVersion: string
}): string {
  return sourceHashFor({
    boundary: 'held_queue_transition_write_v1',
    heldItemId: args.heldItemId,
    from: args.from,
    to: args.to,
    decisionAuthorityVersion: args.decisionAuthorityVersion,
    nextAuthorityVersion: args.nextAuthorityVersion,
  })
}

export function buildHeldQueueTransitionWriteRecord(
  input: ApplyHeldQueueTransitionInput & { readonly decision: HeldQueueTransitionDecision & { readonly allowed: true } },
): HeldQueueTransitionWriteRecord {
  const nextAuthorityVersion = nextAuthorityVersionFor({
    heldItemId: input.heldItemId,
    from: input.decision.from,
    to: input.decision.to,
    decisionAuthorityVersion: input.decision.authorityVersion,
  })

  return {
    heldItemId: input.heldItemId,
    transitionIdempotencyKey: transitionIdempotencyKeyFor({
      heldItemId: input.heldItemId,
      from: input.decision.from,
      to: input.decision.to,
      decisionAuthorityVersion: input.decision.authorityVersion,
      nextAuthorityVersion,
    }),
    from: input.decision.from,
    to: input.decision.to,
    reason: input.decision.reason,
    decisionAuthorityVersion: input.decision.authorityVersion,
    nextAuthorityVersion,
    appliedAt: input.appliedAt ?? new Date().toISOString(),
  }
}

export async function applyHeldQueueTransition(
  adapter: HeldQueueTransitionPersistenceAdapter,
  input: ApplyHeldQueueTransitionInput,
): Promise<HeldQueueTransitionWriteResult> {
  if (!input.decision.allowed) {
    return { status: 'rejected_denied_decision', decision: input.decision }
  }

  const record = buildHeldQueueTransitionWriteRecord({
    heldItemId: input.heldItemId,
    decision: input.decision,
    appliedAt: input.appliedAt,
  })

  try {
    return await adapter.applyAllowedTransition(record)
  } catch (error) {
    return {
      status: 'persistence_failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function stateOrNull(value: unknown): HeldQueueState | null {
  return typeof value === 'string' ? value as HeldQueueState : null
}

function recordFromRpcRow(row: Record<string, unknown>): HeldQueueTransitionWriteRecord {
  return {
    heldItemId: String(row.held_item_id),
    transitionIdempotencyKey: String(row.transition_idempotency_key),
    from: String(row.from_state) as HeldQueueState,
    to: String(row.to_state) as HeldQueueState,
    reason: String(row.decision_reason) as Extract<HeldQueueTransitionDecision, { readonly allowed: true }>['reason'],
    decisionAuthorityVersion: String(row.decision_authority_version),
    nextAuthorityVersion: String(row.next_authority_version),
    appliedAt: String(row.applied_at),
  }
}

function resultFromRpcResponse(data: unknown): HeldQueueTransitionPersistenceAdapterResult {
  const row = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {}
  const status = row.status
  switch (status) {
    case 'applied':
    case 'already_applied':
      return { status, record: recordFromRpcRow(row) }
    case 'rejected_stale':
      return {
        status,
        expectedAuthorityVersion: String(row.expected_authority_version),
        actualAuthorityVersion: typeof row.actual_authority_version === 'string' ? row.actual_authority_version : null,
      }
    case 'rejected_state_mismatch':
      return {
        status,
        expectedState: String(row.expected_state) as HeldQueueState,
        actualState: stateOrNull(row.actual_state),
      }
    default:
      throw new Error(`Unexpected Held Recovery queue transition RPC status: ${String(status)}`)
  }
}

export function createSupabaseHeldQueueTransitionPersistenceAdapter(
  supabase: Pick<SupabaseClient, 'rpc'> = createAdminClient(),
): HeldQueueTransitionPersistenceAdapter {
  return {
    async applyAllowedTransition(record: HeldQueueTransitionWriteRecord): Promise<HeldQueueTransitionPersistenceAdapterResult> {
      const { data, error } = await supabase.rpc('apply_held_recovery_queue_transition_atomic', {
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

      if (error) throw new Error(`Failed to apply Held Recovery queue transition: ${error.message}`)
      return resultFromRpcResponse(data)
    },
  }
}