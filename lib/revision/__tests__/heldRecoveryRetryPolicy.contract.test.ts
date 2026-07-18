import { describe, it, expect } from '@jest/globals'
import {
  decideHeldRecoveryRetry,
  HELD_RECOVERY_RETRY_POLICY_VERSION,
  retryDelaySecondsFor,
  type PersistedHeldQueueTransition,
  type PersistedHeldRecoveryAttempt,
} from '@/lib/revision/heldRecoveryRetryPolicy'

function persistedAttempt(overrides: Partial<PersistedHeldRecoveryAttempt> = {}): PersistedHeldRecoveryAttempt {
  return {
    attemptId: 'attempt-1',
    heldItemId: 'held-1',
    attemptedAt: '2026-07-18T04:00:00.000Z',
    authorityVersion: 'authority-v1',
    outcome: 'failed_retryable',
    attemptNumber: 1,
    maxAttempts: 3,
    ...overrides,
  }
}

function persistedTransition(overrides: Partial<PersistedHeldQueueTransition> = {}): PersistedHeldQueueTransition {
  return {
    transitionEventId: 'transition-1',
    heldItemId: 'held-1',
    from: 'recovery_attempt_running',
    to: 'recovery_attempt_failed_retryable',
    authorityVersion: 'authority-v1',
    appliedAt: '2026-07-18T04:00:00.000Z',
    ...overrides,
  }
}

describe('held recovery retry policy contract', () => {
  it('computes capped exponential retry delay from attempt ordinal', () => {
    expect(retryDelaySecondsFor({ attemptNumber: 1 })).toBe(30)
    expect(retryDelaySecondsFor({ attemptNumber: 2 })).toBe(90)
    expect(retryDelaySecondsFor({ attemptNumber: 3 })).toBe(270)
    expect(retryDelaySecondsFor({ attemptNumber: 9, maxDelaySeconds: 300 })).toBe(300)
  })

  it('returns eligible decision with deterministic retryAt, provenance ids, and policy version', () => {
    const decision = decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt(),
      transition: persistedTransition(),
    })

    expect(decision).toEqual({
      eligible: true,
      heldItemId: 'held-1',
      retryAt: '2026-07-18T04:00:30.000Z',
      reason: 'retryable_failure_window_open',
      attemptId: 'attempt-1',
      transitionEventId: 'transition-1',
      policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
    })
    expect(decision).not.toHaveProperty('rpc')
    expect(decision).not.toHaveProperty('insert')
    expect(decision).not.toHaveProperty('update')
    expect(decision).not.toHaveProperty('scheduleJob')
    expect(decision).not.toHaveProperty('setTimeout')
  })

  it('fails closed for missing attempt state', () => {
    expect(decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: null,
      transition: persistedTransition(),
    })).toEqual({
      eligible: false,
      heldItemId: 'held-1',
      reason: 'missing_attempt_state',
      policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
    })
  })

  it('fails closed for missing transition state', () => {
    expect(decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt(),
      transition: null,
    })).toEqual({
      eligible: false,
      heldItemId: 'held-1',
      reason: 'missing_transition_state',
      attemptId: 'attempt-1',
      policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
    })
  })

  it('fails closed for incompatible transition state', () => {
    expect(decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt(),
      transition: persistedTransition({ to: 'recovered_pending_reclassification' }),
    })).toEqual({
      eligible: false,
      heldItemId: 'held-1',
      reason: 'incompatible_transition_state',
      attemptId: 'attempt-1',
      transitionEventId: 'transition-1',
      policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
    })
  })

  it('fails closed for terminal outcomes', () => {
    expect(decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt({ outcome: 'failed_terminal' }),
      transition: persistedTransition(),
    })).toEqual({
      eligible: false,
      heldItemId: 'held-1',
      reason: 'terminal_outcome',
      attemptId: 'attempt-1',
      policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
    })
  })

  it('fails closed for exhausted attempt limits', () => {
    expect(decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt({ attemptNumber: 3, maxAttempts: 3 }),
      transition: persistedTransition(),
    })).toEqual({
      eligible: false,
      heldItemId: 'held-1',
      reason: 'attempt_limit_exhausted',
      attemptId: 'attempt-1',
      policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
    })
  })

  it('fails closed for stale authority versions', () => {
    expect(decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt(),
      transition: persistedTransition({ authorityVersion: 'authority-v2' }),
      expectedAuthorityVersion: 'authority-v1',
    })).toEqual({
      eligible: false,
      heldItemId: 'held-1',
      reason: 'stale_authority_version',
      attemptId: 'attempt-1',
      transitionEventId: 'transition-1',
      policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
    })
  })

  it('fails closed for superseded attempt and transition records', () => {
    const byAttempt = decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt(),
      transition: persistedTransition(),
      latestAttemptId: 'attempt-2',
    })
    expect(byAttempt).toMatchObject({
      eligible: false,
      reason: 'superseded_by_later_attempt',
      attemptId: 'attempt-1',
    })

    const byTransition = decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt(),
      transition: persistedTransition(),
      latestTransitionEventId: 'transition-2',
    })
    expect(byTransition).toMatchObject({
      eligible: false,
      reason: 'superseded_by_later_transition',
      transitionEventId: 'transition-1',
    })
  })

  it('fails closed for invalid temporal ordering', () => {
    expect(decideHeldRecoveryRetry({
      heldItemId: 'held-1',
      attempt: persistedAttempt({ attemptedAt: '2026-07-18T04:01:00.000Z' }),
      transition: persistedTransition({ appliedAt: '2026-07-18T04:00:00.000Z' }),
    })).toEqual({
      eligible: false,
      heldItemId: 'held-1',
      reason: 'incompatible_transition_state',
      attemptId: 'attempt-1',
      transitionEventId: 'transition-1',
      policyVersion: HELD_RECOVERY_RETRY_POLICY_VERSION,
    })
  })

  it('keeps decisions pure and does not mutate persisted projections', () => {
    const attempt = persistedAttempt()
    const transition = persistedTransition()
    const beforeAttempt = JSON.stringify(attempt)
    const beforeTransition = JSON.stringify(transition)

    const decision = decideHeldRecoveryRetry({ heldItemId: 'held-1', attempt, transition })
    expect(decision.eligible).toBe(true)
    expect(JSON.stringify(attempt)).toBe(beforeAttempt)
    expect(JSON.stringify(transition)).toBe(beforeTransition)
  })
})
