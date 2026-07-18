import { describe, it, expect } from '@jest/globals'
import {
  decideHeldQueueTransition,
  heldQueueTransitionAuthorityVersionFor,
  type HeldQueueTransitionDecision,
} from '@/lib/revision/heldRecoveryQueueTransitionPolicy'
import type { HeldRecoveryAttemptRecord } from '@/lib/revision/heldRecoveryAttemptRecorder'
import {
  HELD_RECOVERY_STATE_TRANSITIONS,
  type HeldRecoveryState,
} from '@/lib/revision/heldRecoveryState'

function recordedAttempt(overrides: Partial<HeldRecoveryAttemptRecord> = {}): HeldRecoveryAttemptRecord {
  const attemptOverrides = overrides.attempt ?? {}
  return {
    idempotencyKey: 'attempt-key-1',
    heldItemId: 'held-1',
    opportunityId: 'op-1',
    manuscriptId: 77,
    manuscriptVersionSha: 'manuscript-sha-1',
    heldItemPersistedVersion: 'held-version-1',
    runtimeOutcomeStatus: 'completed',
    executorResult: {
      outcome: 'success',
      action: 'retrieve_context',
      producer: 'preflight',
      code: 'context_missing',
      output: { matchingChunkCount: 1 },
    },
    attempt: {
      seriesKey: {
        opportunityVersion: 'op-version-1',
        candidateSetVersion: null,
        producer: 'preflight',
        code: 'context_missing',
        recoveryAction: 'retrieve_context',
      },
      recoveryInputFingerprint: 'fingerprint-1',
      attemptNumber: 1,
      maxAttempts: 3,
      status: 'recovered_pending_reclassification',
      outcome: 'succeeded',
      terminalCardType: null,
      terminalTrustedPathStatus: null,
      snapshot: {
        idempotencyKey: 'attempt-key-1',
        manuscriptVersionSha: 'manuscript-sha-1',
        opportunityId: 'op-1',
        trigger: 'system',
        canonicalReasons: [],
        originalBaseReasons: [],
        originalFinalReasons: [],
        promotionTransitionReason: null,
        opportunityVersionBefore: 'op-version-1',
        candidateSetVersionBefore: null,
        recoveryInputFingerprintBefore: 'fingerprint-1',
      },
      events: [],
      createdAt: '2026-07-18T04:00:00.000Z',
      updatedAt: '2026-07-18T04:00:00.000Z',
      ...attemptOverrides,
    },
    ...overrides,
  }
}

describe('held recovery queue transition policy', () => {
  it('returns an allowed decision for a canonical state-machine transition without writing anything', () => {
    const attempt = recordedAttempt()

    const decision = decideHeldQueueTransition({
      recordedAttempt: attempt,
      from: 'recovery_attempt_running',
      requestedTo: 'recovered_pending_reclassification',
    })

    expect(decision).toEqual({
      allowed: true,
      from: 'recovery_attempt_running',
      to: 'recovered_pending_reclassification',
      reason: 'canonical_state_machine_allows_transition',
      authorityVersion: heldQueueTransitionAuthorityVersionFor(attempt),
    })
    expect(decision).not.toHaveProperty('write')
    expect(decision).not.toHaveProperty('retrySchedule')
    expect(decision).not.toHaveProperty('attemptMutation')
    expect(decision).not.toHaveProperty('candidateMutation')
    expect(decision).not.toHaveProperty('manuscriptMutation')
    expect(decision).not.toHaveProperty('finalReviewMutation')
  })

  const canonicalTransitions = Object.entries(HELD_RECOVERY_STATE_TRANSITIONS).flatMap(
    ([from, targets]) => targets.map((to) => [from as HeldRecoveryState, to] as const),
  )

  it.each(canonicalTransitions)('allows canonical transition %s → %s', (from, requestedTo) => {
    expect(decideHeldQueueTransition({ recordedAttempt: recordedAttempt(), from, requestedTo })).toMatchObject({
      allowed: true,
      from,
      to: requestedTo,
      reason: 'canonical_state_machine_allows_transition',
    })
  })

  it('returns a denied decision rather than guessing for non-canonical transitions', () => {
    const decision = decideHeldQueueTransition({
      recordedAttempt: recordedAttempt(),
      from: 'held',
      requestedTo: 'recovery_attempt_running',
    })

    expect(decision).toMatchObject({
      allowed: false,
      from: 'held',
      requestedTo: 'recovery_attempt_running',
      reason: 'canonical_state_machine_denies_transition',
    })
  })

  it('denies terminal-state transitions explicitly', () => {
    const terminalStates: HeldRecoveryState[] = ['reclassified', 'dismissed', 'recovery_attempt_failed_terminal']

    for (const from of terminalStates) {
      expect(decideHeldQueueTransition({
        recordedAttempt: recordedAttempt(),
        from,
        requestedTo: 'held',
      })).toMatchObject({
        allowed: false,
        from,
        requestedTo: 'held',
        reason: 'terminal_state_has_no_outgoing_transition',
      })
    }
  })

  it('denies same-state requests so writers do not persist fake transitions', () => {
    const decision = decideHeldQueueTransition({
      recordedAttempt: recordedAttempt(),
      from: 'recovery_attempt_failed_retryable',
      requestedTo: 'recovery_attempt_failed_retryable',
    })

    expect(decision).toMatchObject({
      allowed: false,
      from: 'recovery_attempt_failed_retryable',
      requestedTo: 'recovery_attempt_failed_retryable',
      reason: 'no_state_change',
    })
  })

  it('fails closed when the caller presents a stale authority version', () => {
    const attempt = recordedAttempt()

    const decision = decideHeldQueueTransition({
      recordedAttempt: attempt,
      from: 'recovery_attempt_running',
      requestedTo: 'recovered_pending_reclassification',
      expectedAuthorityVersion: 'stale-authority-version',
    })

    expect(decision).toEqual({
      allowed: false,
      from: 'recovery_attempt_running',
      requestedTo: 'recovered_pending_reclassification',
      reason: 'authority_version_mismatch',
      authorityVersion: heldQueueTransitionAuthorityVersionFor(attempt),
    })
  })

  it('derives transition authority from recorded attempt identity, not attempt ordinal or timestamps', () => {
    const base = recordedAttempt()
    const repeatedOrdinal = recordedAttempt({
      attempt: {
        ...base.attempt,
        attemptNumber: 99,
        createdAt: '2099-01-01T00:00:00.000Z',
        updatedAt: '2099-01-01T00:00:00.000Z',
      },
    })
    const changedAuthority = recordedAttempt({ heldItemPersistedVersion: 'held-version-2' })

    expect(heldQueueTransitionAuthorityVersionFor(repeatedOrdinal)).toBe(heldQueueTransitionAuthorityVersionFor(base))
    expect(heldQueueTransitionAuthorityVersionFor(changedAuthority)).not.toBe(heldQueueTransitionAuthorityVersionFor(base))
  })

  it('does not mutate the recorded attempt while deriving a decision', () => {
    const attempt = recordedAttempt()
    const before = JSON.stringify(attempt)

    const decision: HeldQueueTransitionDecision = decideHeldQueueTransition({
      recordedAttempt: attempt,
      from: 'recovery_attempt_running',
      requestedTo: 'recovered_pending_reclassification',
    })

    expect(decision.allowed).toBe(true)
    expect(JSON.stringify(attempt)).toBe(before)
  })
})