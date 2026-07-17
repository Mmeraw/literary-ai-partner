/**
 * Held Recovery State Machine
 *
 * Valid recovery states and transitions, plus the persisted RecoveryAttempt
 * shape used to audit recovery work.
 */

import type {
  HeldAuthorAction,
  RecoveryExecutionAction,
} from './heldRecoveryReasons'
import type { HeldReasonProducer } from './heldRecoverySources'
import type { CanonicalHeldReasonOccurrence } from './heldRecoveryPlan'

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

// ─────────────────────────────────────────────────────────────────────────────
// Recovery identity
// ─────────────────────────────────────────────────────────────────────────────

export type RecoverySeriesKey = {
  opportunityVersion: string
  candidateSetVersion: string | null
  producer: HeldReasonProducer
  code: string
  recoveryAction: RecoveryExecutionAction
}

export type RecoveryAttemptSnapshot = {
  idempotencyKey: string
  manuscriptVersionSha: string
  opportunityId: string
  trigger: 'request_reanalysis' | 'provide_more_context' | 'system' | 'author'
  canonicalReasons: CanonicalHeldReasonOccurrence[]
  originalBaseReasons: string[]
  originalFinalReasons: string[]
  promotionTransitionReason: string | null
  opportunityVersionBefore: string
  candidateSetVersionBefore: string | null
  recoveryInputFingerprintBefore: string
}

export type RecoveryAuditEvent = {
  at: string
  event:
    | 'snapshot_created'
    | 'action_started'
    | 'action_succeeded'
    | 'action_failed'
    | 'reclassified'
    | 'remained_held'
    | 'dismissed'
  action?: RecoveryExecutionAction
  disposition?: HeldAuthorAction
  producer?: HeldReasonProducer
  code?: string
  opportunityVersionBefore?: string
  candidateSetVersionBefore?: string | null
  recoveryInputFingerprintBefore?: string
  opportunityVersionAfter?: string
  candidateSetVersionAfter?: string | null
  recoveryInputFingerprintAfter?: string
  details?: Record<string, unknown>
}

export type RecoveryAttempt = {
  seriesKey: RecoverySeriesKey
  recoveryInputFingerprint: string
  attemptNumber: number
  maxAttempts: number
  status: HeldRecoveryState
  outcome: 'pending' | 'succeeded' | 'failed_retryable' | 'failed_terminal' | 'dismissed'
  terminalCardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld' | null
  terminalTrustedPathStatus: 'eligible' | 'unavailable_author_review_required' | 'impossible' | null
  snapshot: RecoveryAttemptSnapshot
  events: RecoveryAuditEvent[]
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
