/**
 * Held Recovery Plan
 *
 * Pure recovery planning function. Collects canonical reasons from a held
 * opportunity and produces an ordered, dependency-respecting repair plan.
 */

import type { HeldReasonSource } from './heldRecoverySources'
import {
  getHeldReasonInfo,
  normalizeHeldReasonCode,
  REPAIR_STEP_ORDER,
  type HeldAuthorAction,
  type HeldRecoveryConfidence,
  type HeldRepairFamily,
  type HeldRecoveryStep,
  type HeldTerminalOutcome,
} from './heldRecoveryReasons'

// ─────────────────────────────────────────────────────────────────────────────
// Canonical reason collection
// ─────────────────────────────────────────────────────────────────────────────

export type HeldOpportunityInput = {
  id: string
  groundingStatus?:
    | 'supported'
    | 'supported_after_relook'
    | 'uncertain_after_relook_reportable'
    | 'uncertain_after_relook_blocked'
    | 'unsupported_blocked'
    | string
    | null
  groundingNote?: string | null
  contextQuality?: 'clean' | 'limited' | 'blocked' | string | null
  preflightStatus?: 'passed' | 'limited_context' | 'blocked' | string | null
  preflightReasons?: string[]
  hydrationFailureReasons?: string[]
  resBlockerReasons?: string[]
  copyPasteAdmissionReasons?: string[]
  strategyAdmissionReasons?: string[]
  baseDecision?: {
    cardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld'
    reasons: string[]
  } | null
  finalDecision?: {
    cardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld'
    reasons: string[]
  } | null
  needsTargetingPromotionApplied?: boolean
  promotionTransitionReason?: string | null
  needsTargetingOverrideApplied?: boolean
}

export type CanonicalHeldReasonOccurrence = {
  code: string
  raw: string
  source: HeldReasonSource
}

export type CanonicalHeldReasonSet = {
  opportunityId: string
  finalCardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld' | null
  groundingStatus: string | null
  contextQuality: string | null
  preflightStatus: string | null
  occurrences: CanonicalHeldReasonOccurrence[]
}

function appendReasons(
  target: CanonicalHeldReasonOccurrence[],
  reasons: string[] | undefined,
  source: HeldReasonSource,
): void {
  if (!Array.isArray(reasons)) return
  for (const raw of reasons) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    target.push({ code: normalizeHeldReasonCode(raw), raw, source })
  }
}

export function collectCanonicalReasons(input: HeldOpportunityInput): CanonicalHeldReasonSet {
  const occurrences: CanonicalHeldReasonOccurrence[] = []

  // Hydration and RES blockers are derived from preflightReasons in
  // workbenchQueue.ts splitPreflightReasonsByClass. If the caller has already
  // split them, trust that; otherwise split here.
  const allPreflight = [...(input.preflightReasons ?? [])]
  const hydrationFromPreflight = allPreflight.filter((r) => r.startsWith('hydration_'))
  const resFromPreflight = allPreflight.filter((r) => !r.startsWith('hydration_'))
  const hydration = input.hydrationFailureReasons ?? hydrationFromPreflight
  const res = input.resBlockerReasons ?? resFromPreflight

  appendReasons(occurrences, input.copyPasteAdmissionReasons, 'copy_paste_admission')
  appendReasons(occurrences, input.strategyAdmissionReasons, 'strategy_admission')
  appendReasons(occurrences, input.baseDecision?.reasons, 'base_decision')
  appendReasons(occurrences, input.finalDecision?.reasons, 'final_decision')
  appendReasons(occurrences, hydration, 'hydration')
  appendReasons(occurrences, res, 'res_blocker')

  return {
    opportunityId: input.id,
    finalCardType: input.finalDecision?.cardType ?? null,
    groundingStatus: input.groundingStatus ?? null,
    contextQuality: input.contextQuality ?? null,
    preflightStatus: input.preflightStatus ?? null,
    occurrences,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure recovery planning
// ─────────────────────────────────────────────────────────────────────────────

export type RecoveryPlan = {
  opportunityId: string
  recoverable: boolean
  automaticRecoveryAllowed: boolean
  recoveryConfidence: HeldRecoveryConfidence
  requiredRepairs: HeldRecoveryStep[]
  allowedAuthorActions: HeldAuthorAction[]
  expectedTerminalOutcomes: HeldTerminalOutcome[]
  hardBlockers: string[]
  unknownReasons: string[]
  reasonFamilySet: Set<HeldRepairFamily>
}

function minConfidence(
  a: HeldRecoveryConfidence,
  b: HeldRecoveryConfidence,
): HeldRecoveryConfidence {
  const order: HeldRecoveryConfidence[] = ['high', 'medium', 'low']
  const ai = order.indexOf(a)
  const bi = order.indexOf(b)
  return order[Math.max(ai, bi)]
}

function confidenceFromGroundingStatus(status: string | null | undefined): HeldRecoveryConfidence {
  if (status === 'unsupported_blocked' || status === 'uncertain_after_relook_blocked') return 'low'
  if (status === 'uncertain_after_relook_reportable') return 'medium'
  if (status === 'supported_after_relook') return 'medium'
  if (status === 'supported') return 'high'
  return 'low'
}

function confidenceFromContextQuality(quality: string | null | undefined): HeldRecoveryConfidence {
  if (quality === 'blocked') return 'low'
  if (quality === 'limited') return 'medium'
  if (quality === 'clean') return 'high'
  return 'low'
}

export function buildRecoveryPlan(input: HeldOpportunityInput): RecoveryPlan {
  const reasons = collectCanonicalReasons(input)

  // Deduplicate occurrences by normalized code before planning so that
  // duplicated presentation strings do not create duplicate repair steps.
  const uniqueOccurrences: CanonicalHeldReasonOccurrence[] = []
  const seenCodes = new Set<string>()
  for (const occurrence of reasons.occurrences) {
    if (seenCodes.has(occurrence.code)) continue
    seenCodes.add(occurrence.code)
    uniqueOccurrences.push(occurrence)
  }

  const hardBlockers: string[] = []
  const unknownReasons: string[] = []
  const familySet = new Set<HeldRepairFamily>()
  let confidence: HeldRecoveryConfidence = minConfidence(
    'high',
    minConfidence(confidenceFromGroundingStatus(input.groundingStatus), confidenceFromContextQuality(input.contextQuality)),
  )
  let anyRecoverable = false
  const authorActions = new Set<HeldAuthorAction>()
  const terminalOutcomes = new Set<HeldTerminalOutcome>()

  for (const occurrence of uniqueOccurrences) {
    const info = getHeldReasonInfo(occurrence.raw)

    if (info.isHardBlocker) {
      hardBlockers.push(occurrence.raw)
    }

    if (info.isUnknown) {
      unknownReasons.push(occurrence.raw)
    }

    if (info.repairFamily !== 'none') {
      familySet.add(info.repairFamily)
    }

    if (info.recoverable && info.repairFamily !== 'none') {
      anyRecoverable = true
    }

    confidence = minConfidence(confidence, info.recoveryConfidence)

    for (const action of info.allowedAuthorActions) {
      authorActions.add(action)
    }
    for (const outcome of info.allowedTerminalOutcomes) {
      terminalOutcomes.add(outcome)
    }
  }

  // Hard blockers or unknown reasons fail closed: no automatic repair, and
  // terminal outcomes are restricted to withheld unless a known recoverable path
  // also exists.
  const hasHardBlocker = hardBlockers.length > 0
  const hasUnknownReason = unknownReasons.length > 0

  // If copy-paste is a possible outcome, candidates must be regenerated after
  // upstream repairs even when the original hold reason was not a candidate error.
  if (!hasHardBlocker && terminalOutcomes.has('copy_paste_rewrite')) {
    familySet.add('candidates')
  }

  const recoverable = anyRecoverable && !hasHardBlocker && !hasUnknownReason
  const contextBlocked = input.contextQuality === 'blocked'
  const automaticRecoveryAllowed =
    recoverable &&
    !contextBlocked &&
    uniqueOccurrences.every((o) => {
      const info = getHeldReasonInfo(o.raw)
      return info.automaticRecoveryAllowed || info.isHardBlocker
    }) &&
    !hasHardBlocker

  if (hasHardBlocker || hasUnknownReason) {
    terminalOutcomes.clear()
    terminalOutcomes.add('withheld')
  }

  const requiredRepairs = buildRequiredRepairs([...familySet], hasHardBlocker)

  return {
    opportunityId: input.id,
    recoverable,
    automaticRecoveryAllowed,
    recoveryConfidence: confidence,
    requiredRepairs,
    allowedAuthorActions: [...authorActions],
    expectedTerminalOutcomes: [...terminalOutcomes],
    hardBlockers,
    unknownReasons,
    reasonFamilySet: familySet,
  }
}

function buildRequiredRepairs(families: HeldRepairFamily[], hasHardBlocker: boolean): HeldRecoveryStep[] {
  const steps = new Set<HeldRecoveryStep>()

  const needsAnchor = families.includes('anchor')
  const needsContext = families.includes('context')
  const needsDiagnosis = families.includes('diagnosis')
  const needsCandidates = families.includes('candidates')
  const needsStrategy = families.includes('strategy')

  if (needsAnchor) steps.add('expand_anchor')
  if (needsContext) steps.add('retrieve_context')
  if (needsAnchor || needsContext) steps.add('re_ground')
  if (needsDiagnosis || needsAnchor || needsContext) steps.add('repair_diagnosis')
  if (needsCandidates && !hasHardBlocker) steps.add('regenerate_candidates')
  if (needsStrategy || needsCandidates || needsDiagnosis || needsAnchor || needsContext) {
    steps.add('rerun_admission')
    steps.add('reclassify')
  }

  if (steps.size === 0 && !hasHardBlocker) {
    // No recognized repair family but not a hard blocker; still re-evaluate.
    steps.add('rerun_admission')
    steps.add('reclassify')
  }

  return REPAIR_STEP_ORDER.filter((step) => steps.has(step))
}
