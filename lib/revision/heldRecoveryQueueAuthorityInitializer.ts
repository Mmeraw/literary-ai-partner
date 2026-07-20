/**
 * Initial durable authority creation for the bounded Held Recovery proof path.
 *
 * The queue identity is created only after the canonical deferred attempt and
 * its paired reconstruction work item exist. The database RPC verifies that
 * relationship atomically and either creates one running queue authority or
 * returns the identity-equivalent existing authority.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export type InitializeHeldRecoveryQueueAuthorityInput = {
  readonly evaluationJobId: string
  readonly heldItemId: string
  readonly opportunityId: string
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  readonly deferredAttemptIdempotencyKey: string
}

type InitializedQueueState =
  | 'recovery_attempt_running'
  | 'recovered_pending_reclassification'
  | 'reclassified'

export type InitializeHeldRecoveryQueueAuthorityResult =
  | {
      readonly status: 'created' | 'already_created'
      readonly heldItemId: string
      readonly queueState: InitializedQueueState
      readonly authorityVersion: string
    }
  | {
      readonly status: 'rejected_missing_deferred_authority' | 'rejected_identity_mismatch'
      readonly reason: string
    }

export type HeldRecoveryQueueAuthorityInitializer = (
  input: InitializeHeldRecoveryQueueAuthorityInput,
) => Promise<InitializeHeldRecoveryQueueAuthorityResult>

export class HeldRecoveryQueueAuthorityInitializationError extends Error {
  constructor(message: string) {
    super(`Held Recovery queue authority initialization failed: ${message}`)
    this.name = 'HeldRecoveryQueueAuthorityInitializationError'
  }
}

function required(value: string, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HeldRecoveryQueueAuthorityInitializationError(`${field} must be a non-empty string`)
  }
  return value
}

function rowOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HeldRecoveryQueueAuthorityInitializationError('RPC returned a non-object payload')
  }
  return value as Record<string, unknown>
}

function queueStateOf(value: unknown): InitializedQueueState {
  if (
    value !== 'recovery_attempt_running' &&
    value !== 'recovered_pending_reclassification' &&
    value !== 'reclassified'
  ) {
    throw new HeldRecoveryQueueAuthorityInitializationError(
      `RPC returned an invalid queue_state: ${String(value)}`,
    )
  }
  return value
}

export function createSupabaseHeldRecoveryQueueAuthorityInitializer(
  supabase: Pick<SupabaseClient, 'rpc'> = createAdminClient(),
): HeldRecoveryQueueAuthorityInitializer {
  return async (input) => {
    const request = {
      evaluation_job_id: required(input.evaluationJobId, 'evaluationJobId'),
      held_item_id: required(input.heldItemId, 'heldItemId'),
      opportunity_id: required(input.opportunityId, 'opportunityId'),
      manuscript_id: required(input.manuscriptId, 'manuscriptId'),
      manuscript_version_sha: required(input.manuscriptVersionSha, 'manuscriptVersionSha'),
      held_item_persisted_version: required(
        input.heldItemPersistedVersion,
        'heldItemPersistedVersion',
      ),
      deferred_attempt_idempotency_key: required(
        input.deferredAttemptIdempotencyKey,
        'deferredAttemptIdempotencyKey',
      ),
    }

    const { data, error } = await supabase.rpc(
      'initialize_held_recovery_queue_authority_atomic',
      { p_request: request },
    )
    if (error) throw new HeldRecoveryQueueAuthorityInitializationError(error.message)

    const row = rowOf(data)
    switch (row.status) {
      case 'created':
      case 'already_created':
        return {
          status: row.status,
          heldItemId: required(String(row.held_item_id ?? ''), 'rpc.held_item_id'),
          queueState: queueStateOf(row.queue_state),
          authorityVersion: required(String(row.authority_version ?? ''), 'rpc.authority_version'),
        }
      case 'rejected_missing_deferred_authority':
      case 'rejected_identity_mismatch':
        return {
          status: row.status,
          reason: required(String(row.reason ?? ''), 'rpc.reason'),
        }
      default:
        throw new HeldRecoveryQueueAuthorityInitializationError(
          `unexpected RPC status: ${String(row.status)}`,
        )
    }
  }
}
