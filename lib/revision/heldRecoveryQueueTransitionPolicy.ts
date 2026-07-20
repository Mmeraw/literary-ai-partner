/**
 * Held Recovery Queue Transition Policy
 *
 * Pure decision boundary for queue state transitions based on a durable recovery
 * attempt record. This module returns transition decisions only; it does not
 * write transitions, schedule retries, invoke recovery, mutate attempts,
 * candidates, manuscripts, Final Review, workers, API, or UI state.
 */

import type { HeldRecoveryAttemptRecord } from './heldRecoveryAttemptRecorder'
import {
  HELD_RECOVERY_STATE_TRANSITIONS,
  isTerminalRecoveryState,
  type HeldRecoveryState,
} from './heldRecoveryState'
import { sourceHashFor } from './heldRecoveryVersioning'

export type HeldQueueState = HeldRecoveryState

export type HeldQueueTransitionReason =
  | 'canonical_state_machine_allows_transition'

export type HeldQueueTransitionDenialReason =
  | 'authority_version_mismatch'
  | 'no_state_change'
  | 'terminal_state_has_no_outgoing_transition'
  | 'canonical_state_machine_denies_transition'

export type HeldQueueTransitionDecision =
  | {
      readonly allowed: true
      readonly from: HeldQueueState
      readonly to: HeldQueueState
      readonly reason: HeldQueueTransitionReason
      readonly authorityVersion: string
    }
  | {
      readonly allowed: false
      readonly from: HeldQueueState
      readonly requestedTo: HeldQueueState
      readonly reason: HeldQueueTransitionDenialReason
      readonly authorityVersion: string
    }

export type DecideHeldQueueTransitionInput = {
  readonly recordedAttempt: HeldRecoveryAttemptRecord
  readonly from: HeldQueueState
  readonly requestedTo: HeldQueueState
  readonly expectedAuthorityVersion?: string
}

export type DecideHeldQueueTransitionFromAuthorityInput = {
  readonly from: HeldQueueState
  readonly requestedTo: HeldQueueState
  readonly authorityVersion: string
}

/**
 * Canonical state-machine decision for an authority already verified by its
 * owning runtime boundary. This keeps non-attempt authorities (for example,
 * verified reconstructed-anchor Readmission) on the same transition graph
 * without manufacturing a RecoveryAttempt record.
 */
export function decideHeldQueueTransitionFromAuthority(
  input: DecideHeldQueueTransitionFromAuthorityInput,
): HeldQueueTransitionDecision {
  const { from, requestedTo, authorityVersion } = input
  if (!authorityVersion) {
    return {
      allowed: false,
      from,
      requestedTo,
      reason: 'authority_version_mismatch',
      authorityVersion,
    }
  }
  if (from === requestedTo) {
    return {
      allowed: false,
      from,
      requestedTo,
      reason: 'no_state_change',
      authorityVersion,
    }
  }
  if (HELD_RECOVERY_STATE_TRANSITIONS[from].includes(requestedTo)) {
    return {
      allowed: true,
      from,
      to: requestedTo,
      reason: 'canonical_state_machine_allows_transition',
      authorityVersion,
    }
  }
  if (isTerminalRecoveryState(from)) {
    return {
      allowed: false,
      from,
      requestedTo,
      reason: 'terminal_state_has_no_outgoing_transition',
      authorityVersion,
    }
  }
  return {
    allowed: false,
    from,
    requestedTo,
    reason: 'canonical_state_machine_denies_transition',
    authorityVersion,
  }
}

export function heldQueueTransitionAuthorityVersionFor(
  recordedAttempt: HeldRecoveryAttemptRecord,
): string {
  return sourceHashFor({
    boundary: 'held_queue_transition_policy_authority_v1',
    attemptIdempotencyKey: recordedAttempt.idempotencyKey,
    heldItemId: recordedAttempt.heldItemId,
    heldItemPersistedVersion: recordedAttempt.heldItemPersistedVersion,
    opportunityId: recordedAttempt.opportunityId,
    manuscriptId: recordedAttempt.manuscriptId,
    manuscriptVersionSha: recordedAttempt.manuscriptVersionSha,
    runtimeOutcomeStatus: recordedAttempt.runtimeOutcomeStatus,
    runtimeRejectionReason: recordedAttempt.runtimeRejectionReason ?? null,
    seriesKey: recordedAttempt.attempt.seriesKey,
    recoveryInputFingerprint: recordedAttempt.attempt.recoveryInputFingerprint,
    attemptStatus: recordedAttempt.attempt.status,
    attemptOutcome: recordedAttempt.attempt.outcome,
  })
}

export function decideHeldQueueTransition(
  input: DecideHeldQueueTransitionInput,
): HeldQueueTransitionDecision {
  const authorityVersion = heldQueueTransitionAuthorityVersionFor(input.recordedAttempt)
  if (
    input.expectedAuthorityVersion !== undefined &&
    input.expectedAuthorityVersion !== authorityVersion
  ) {
    return {
      allowed: false,
      from: input.from,
      requestedTo: input.requestedTo,
      reason: 'authority_version_mismatch',
      authorityVersion,
    }
  }

  return decideHeldQueueTransitionFromAuthority({
    from: input.from,
    requestedTo: input.requestedTo,
    authorityVersion,
  })
}
