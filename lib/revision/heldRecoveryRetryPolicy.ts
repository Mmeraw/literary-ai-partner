/**
 * Held Recovery Retry Policy
 *
 * Pure retry-decision boundary. Consumes canonical persisted attempt and
 * transition projections and returns an eligibility decision only.
 *
 * This module does not invoke recovery, mutate queue/attempt state, call
 * writers/RPC, create jobs/timers, or perform API/UI/worker behavior.
 */

import type { HeldRecoveryState } from './heldRecoveryState'

export const HELD_RECOVERY_RETRY_POLICY_VERSION = 'held_recovery_retry_policy_v1'

export type CanonicalRetryAttemptOutcome =
  | 'failed_retryable'
  | 'failed_terminal'
  | 'succeeded'
  | 'dismissed'

export type PersistedHeldRecoveryAttempt = {
  readonly attemptId: string
  readonly heldItemId: string
  readonly attemptedAt: string
  readonly authorityVersion: string
  readonly outcome: CanonicalRetryAttemptOutcome
  readonly attemptNumber: number
  readonly maxAttempts: number
}

export type PersistedHeldQueueTransition = {
  readonly transitionEventId: string
  readonly heldItemId: string
  readonly from: HeldRecoveryState
  readonly to: HeldRecoveryState
  readonly authorityVersion: string
  readonly appliedAt: string
}

export type HeldRecoveryRetryEligibilityReason = 'retryable_failure_window_open'

export type HeldRecoveryRetryDenialReason =
  | 'missing_attempt_state'
  | 'missing_transition_state'
  | 'incompatible_transition_state'
  | 'terminal_outcome'
  | 'attempt_limit_exhausted'
  | 'unrecognized_executor_result'
  | 'stale_authority_version'
  | 'superseded_by_later_attempt'
  | 'superseded_by_later_transition'

export type HeldRecoveryRetryDecision =
  | {
      readonly eligible: true
      readonly heldItemId: string
      readonly retryAt: string
      readonly reason: HeldRecoveryRetryEligibilityReason
      readonly attemptId: string
      readonly transitionEventId: string
      readonly policyVersion: string
    }
  | {
      readonly eligible: false
      readonly heldItemId: string
      readonly reason: HeldRecoveryRetryDenialReason
      readonly attemptId?: string
      readonly transitionEventId?: string
      readonly policyVersion: string
    }

export type DecideHeldRecoveryRetryInput = {
  readonly heldItemId: string
  readonly attempt?: PersistedHeldRecoveryAttempt | null
  readonly transition?: PersistedHeldQueueTransition | null
  readonly expectedAuthorityVersion?: string
  readonly latestAttemptId?: string | null
  readonly latestTransitionEventId?: string | null
  readonly baseDelaySeconds?: number
  readonly maxDelaySeconds?: number
}

function wholePositiveNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.floor(value))
}

export function retryDelaySecondsFor(args: {
  readonly attemptNumber: number
  readonly baseDelaySeconds?: number
  readonly maxDelaySeconds?: number
}): number {
  const baseDelaySeconds = wholePositiveNumber(args.baseDelaySeconds, 30)
  const maxDelaySeconds = wholePositiveNumber(args.maxDelaySeconds, 30 * 60)
  const exponent = Math.max(0, Math.floor(args.attemptNumber) - 1)
  return Math.min(baseDelaySeconds * Math.pow(3, exponent), maxDelaySeconds)
}

function retryAtFor(args: {
  readonly earliestFrom: string
  readonly attemptNumber: number
  readonly baseDelaySeconds?: number
  readonly maxDelaySeconds?: number
}): string {
  const earliestFromMs = new Date(args.earliestFrom).getTime()
  if (!Number.isFinite(earliestFromMs)) {
    throw new Error(`Invalid Held Recovery retry earliestFrom timestamp: ${args.earliestFrom}`)
  }

  const delaySeconds = retryDelaySecondsFor(args)
  return new Date(earliestFromMs + delaySeconds * 1000).toISOString()
}

function denied(input: {
  readonly heldItemId: string
  readonly reason: HeldRecoveryRetryDenialReason
  readonly attemptId?: string
  readonly transitionEventId?: string
}): HeldRecoveryRetryDecision {
  return {
    eligible: false,
    heldItemId: input.heldItemId,
    reason: input.reason,
    attemptId: input.attemptId,
    transitionEventId: input.transitionEventId,
    policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
  }
}

function isRecognizedAttemptOutcome(outcome: string): outcome is CanonicalRetryAttemptOutcome {
  return outcome === 'failed_retryable'
    || outcome === 'failed_terminal'
    || outcome === 'succeeded'
    || outcome === 'dismissed'
}

function isTerminalAttemptOutcome(outcome: CanonicalRetryAttemptOutcome): boolean {
  return outcome === 'failed_terminal' || outcome === 'succeeded' || outcome === 'dismissed'
}

export function decideHeldRecoveryRetry(input: DecideHeldRecoveryRetryInput): HeldRecoveryRetryDecision {
  const attempt = input.attempt
  if (!attempt || attempt.heldItemId !== input.heldItemId) {
    return denied({ heldItemId: input.heldItemId, reason: 'missing_attempt_state' })
  }

  if (!isRecognizedAttemptOutcome(attempt.outcome)) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'unrecognized_executor_result',
      attemptId: attempt.attemptId,
    })
  }

  if (
    input.latestAttemptId !== undefined
    && input.latestAttemptId !== null
    && input.latestAttemptId !== attempt.attemptId
  ) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'superseded_by_later_attempt',
      attemptId: attempt.attemptId,
    })
  }

  if (isTerminalAttemptOutcome(attempt.outcome)) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'terminal_outcome',
      attemptId: attempt.attemptId,
    })
  }

  if (attempt.attemptNumber >= attempt.maxAttempts) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'attempt_limit_exhausted',
      attemptId: attempt.attemptId,
    })
  }

  const transition = input.transition
  if (!transition || transition.heldItemId !== input.heldItemId) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'missing_transition_state',
      attemptId: attempt.attemptId,
    })
  }

  if (
    input.latestTransitionEventId !== undefined
    && input.latestTransitionEventId !== null
    && input.latestTransitionEventId !== transition.transitionEventId
  ) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'superseded_by_later_transition',
      attemptId: attempt.attemptId,
      transitionEventId: transition.transitionEventId,
    })
  }

  if (
    transition.to !== 'recovery_attempt_failed_retryable'
    || attempt.outcome !== 'failed_retryable'
    || attempt.heldItemId !== transition.heldItemId
  ) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'incompatible_transition_state',
      attemptId: attempt.attemptId,
      transitionEventId: transition.transitionEventId,
    })
  }

  if (new Date(attempt.attemptedAt).getTime() > new Date(transition.appliedAt).getTime()) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'incompatible_transition_state',
      attemptId: attempt.attemptId,
      transitionEventId: transition.transitionEventId,
    })
  }

  if (
    (input.expectedAuthorityVersion !== undefined && (
      input.expectedAuthorityVersion !== attempt.authorityVersion
      || input.expectedAuthorityVersion !== transition.authorityVersion
    ))
    || attempt.authorityVersion !== transition.authorityVersion
  ) {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'stale_authority_version',
      attemptId: attempt.attemptId,
      transitionEventId: transition.transitionEventId,
    })
  }

  let retryAt: string
  try {
    retryAt = retryAtFor({
      earliestFrom: transition.appliedAt,
      attemptNumber: attempt.attemptNumber,
      baseDelaySeconds: input.baseDelaySeconds,
      maxDelaySeconds: input.maxDelaySeconds,
    })
  } catch {
    return denied({
      heldItemId: input.heldItemId,
      reason: 'incompatible_transition_state',
      attemptId: attempt.attemptId,
      transitionEventId: transition.transitionEventId,
    })
  }

  return {
    eligible: true,
    heldItemId: input.heldItemId,
    retryAt,
    reason: 'retryable_failure_window_open',
    attemptId: attempt.attemptId,
    transitionEventId: transition.transitionEventId,
    policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
  }
}
