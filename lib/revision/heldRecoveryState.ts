/**
 * Held Recovery State Machine
 *
 * Valid recovery states and transitions, plus the persisted RecoveryAttempt
 * shape used to audit recovery work.
 */

import type { HeldRecoveryStep } from './heldRecoveryReasons'

// ─────────────────────────────────────────────────────────────────────────────
// Recovery state machine
// ─────────────────────────────────────────────────────────────────────────────

export type HeldRecoveryState =
  | 'held'
  | 'recovery_attempt_pending'
  | 'recovery_attempt_running'
  | 'recovery_attempt_failed_retryable'
  | 'recovery_attempt_failed_terminal'
  | 'recovered_pending_reclassification'
  | 'reclassified'
  | 'dismissed'

export const HELD_RECOVERY_STATE_TRANSITIONS: Record<HeldRecoveryState, HeldRecoveryState[]> = {
  held: ['recovery_attempt_pending', 'dismissed'],
  recovery_attempt_pending: ['recovery_attempt_running', 'dismissed'],
  recovery_attempt_running: [
    'recovered_pending_reclassification',
    'recovery_attempt_failed_retryable',
    'recovery_attempt_failed_terminal',
    'dismissed',
  ],
  recovery_attempt_failed_retryable: ['recovery_attempt_pending', 'recovery_attempt_failed_terminal', 'dismissed'],
  recovery_attempt_failed_terminal: ['dismissed'],
  recovered_pending_reclassification: ['reclassified', 'recovery_attempt_failed_retryable', 'dismissed'],
  reclassified: [],
  dismissed: [],
}

export const HELD_RECOVERY_MAX_RETRIES = 3

export type RecoveryAttempt = {
  idempotencyKey: string
  manuscriptVersionSha: string
  opportunityId: string
  trigger: 'request_reanalysis' | 'provide_more_context' | 'system'
  repairPlan: HeldRecoveryStep[]
  attemptNumber: number
  maxAttempts: number
  status: HeldRecoveryState
  outcome: 'pending' | 'succeeded' | 'failed_retryable' | 'failed_terminal' | 'dismissed'
  terminalCardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld' | null
  terminalTrustedPathStatus: 'eligible' | 'unavailable_author_review_required' | 'impossible' | null
  auditTrail: string[]
  createdAt: string
  updatedAt: string
}

export function isTerminalRecoveryState(state: HeldRecoveryState): boolean {
  return state === 'reclassified' || state === 'dismissed' || state === 'recovery_attempt_failed_terminal'
}

export function isValidRecoveryTransition(from: HeldRecoveryState, to: HeldRecoveryState): boolean {
  if (from === to) return true
  return HELD_RECOVERY_STATE_TRANSITIONS[from].includes(to)
}
