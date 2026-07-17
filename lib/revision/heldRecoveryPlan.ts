/**
 * Held Recovery Plan
 *
 * Pure recovery planning function. Collects canonical reasons from a held
 * opportunity and produces an ordered, dependency-respecting repair plan.
 *
 * Governance:
 * - finalDecision.cardType is the only queue-routing authority.
 * - groundingNote and executabilityReasons are annotations, not canonical planning
 *   inputs. Unknown annotations are recorded but do not fail the plan closed.
 */

import type { HeldReasonSource, RecoveryAuthorityRole } from './heldRecoverySources'
import {
  getHeldReasonInfo,
  getRecoveryContractForReason,
  normalizeHeldReasonCode,
  REPAIR_STEP_ORDER,
  type HeldAuthorAction,
  type HeldRecoveryConfidence,
  type HeldRepairFamily,
  type HeldRecoveryStep,
  type HeldTerminalOutcome,
  type HeldReasonRecoveryContract,
} from './heldRecoveryReasons'

// ─────────────────────────────────────────────────────────────────────────────
// Evidence collection
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
  executabilityReasons?: string[]
  needsTargetingPromotionApplied?: boolean
  promotionTransitionReason?: string | null
  needsTargetingOverrideApplied?: boolean
}

export type CanonicalHeldReasonOccurrence = {
  code: string
  raw: string
  source: HeldReasonSource
  authorityRole: RecoveryAuthorityRole
  recoveryContract?: HeldReasonRecoveryContract
}

export type HeldReasonAnnotation = {
  raw: string
  source: 'executability' | 'grounding_note'
  code: string
}

export type HeldRecoveryEvidence = {
  opportunityId: string
  finalCardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld' | null
  groundingStatus: string | null
  contextQuality: string | null
  preflightStatus: string | null
  canonicalReasons: CanonicalHeldReasonOccurrence[]
  annotations: HeldReasonAnnotation[]
}

function occurrenceFor(raw: string, source: HeldReasonSource): CanonicalHeldReasonOccurrence {
  const code = normalizeHeldReasonCode(raw)
  const contract = getRecoveryContractForReason({ code, source, raw })
  return {
    code,
    raw,
    source,
    authorityRole: contract?.authorityRole ?? 'annotation',
    recoveryContract: contract,
  }
}

function appendCanonicalReasons(
  target: CanonicalHeldReasonOccurrence[],
  reasons: string[] | undefined,
  source: HeldReasonSource,
): void {
  if (!Array.isArray(reasons)) return
  for (const raw of reasons) {
    if (typeof raw !== 'string' || !raw.trim()) continue
    target.push(occurrenceFor(raw, source))
  }
}

export function collectCanonicalReasons(input: HeldOpportunityInput): HeldRecoveryEvidence {
  const canonicalReasons: CanonicalHeldReasonOccurrence[] = []
  const annotations: HeldReasonAnnotation[] = []

  // Hydration and RES blockers are derived from preflightReasons in
  // workbenchQueue.ts splitPreflightReasonsByClass. If the caller has already
  // split them, trust that; otherwise split here.
  const allPreflight = [...(input.preflightReasons ?? [])]
  const hydrationFromPreflight = allPreflight.filter((r) => r.startsWith('hydration_'))
  const resFromPreflight = allPreflight.filter((r) => !r.startsWith('hydration_'))
  const hydration = input.hydrationFailureReasons ?? hydrationFromPreflight
  const res = input.resBlockerReasons ?? resFromPreflight

  appendCanonicalReasons(canonicalReasons, input.copyPasteAdmissionReasons, 'copy_paste_admission')
  appendCanonicalReasons(canonicalReasons, input.strategyAdmissionReasons, 'strategy_admission')
  appendCanonicalReasons(canonicalReasons, input.baseDecision?.reasons, 'base_decision')
  appendCanonicalReasons(canonicalReasons, input.finalDecision?.reasons, 'final_decision')
  appendCanonicalReasons(canonicalReasons, hydration, 'hydration')
  appendCanonicalReasons(canonicalReasons, res, 'res_blocker')

  // executabilityReasons is a presentation copy of finalDecision.reasons.
  // We collect it only as an annotation; it must never override canonical sources.
  if (Array.isArray(input.executabilityReasons)) {
    for (const raw of input.executabilityReasons) {
      if (typeof raw === 'string' && raw.trim()) {
        annotations.push({ raw, source: 'executability', code: normalizeHeldReasonCode(raw) })
      }
    }
  }

  if (input.groundingNote && typeof input.groundingNote === 'string' && input.groundingNote.trim()) {
    annotations.push({ raw: input.groundingNote, source: 'grounding_note', code: input.groundingNote })
  }

  return {
    opportunityId: input.id,
    finalCardType: input.finalDecision?.cardType ?? null,
    groundingStatus: input.groundingStatus ?? null,
    contextQuality: input.contextQuality ?? null,
    preflightStatus: input.preflightStatus ?? null,
    canonicalReasons,
    annotations,
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
  unknownCanonicalReasons: string[]
  unknownAnnotations: string[]
  groundingNote: string | null
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

const DECISION_OWNED_SUMMARY_CODES = new Set([
  'copy_paste_admission_failed',
  'strategy_admission_failed',
  'passage_too_long',
])

function decomposeDecisionProjection(
  occurrence: CanonicalHeldReasonOccurrence,
  info: ReturnType<typeof getHeldReasonInfo>,
): HeldReasonRecoveryContract | undefined {
  // Decision-owned summary codes do not decompose into a single upstream action;
  // they require the actual upstream origin reasons to be present.
  if (DECISION_OWNED_SUMMARY_CODES.has(occurrence.code)) return undefined

  for (const source of info.canonicalPlanningSources) {
    const contract = getRecoveryContractForReason({ code: occurrence.code, source })
    if (contract && contract.authorityRole === 'origin') {
      return contract
    }
  }
  return undefined
}

function deduplicateAnnotations<T extends { code: string; raw: string }>(reasons: T[]): T[] {
  const unique: T[] = []
  const seen = new Map<string, T>()
  for (const reason of reasons) {
    if (seen.has(reason.code)) continue
    seen.set(reason.code, reason)
    unique.push(reason)
  }
  return unique
}

function deduplicateCanonicalReasons(
  reasons: CanonicalHeldReasonOccurrence[],
): CanonicalHeldReasonOccurrence[] {
  const precedence: Record<RecoveryAuthorityRole, number> = {
    origin: 0,
    decision_projection: 1,
    annotation: 2,
  }
  const ordered = [...reasons].sort(
    (a, b) => precedence[a.authorityRole] - precedence[b.authorityRole],
  )
  const unique: CanonicalHeldReasonOccurrence[] = []
  const seen = new Set<string>()
  for (const reason of ordered) {
    if (seen.has(reason.code)) continue
    seen.add(reason.code)
    unique.push(reason)
  }
  return unique
}

export function buildRecoveryPlan(input: HeldOpportunityInput): RecoveryPlan {
  const evidence = collectCanonicalReasons(input)

  const canonical = deduplicateCanonicalReasons(evidence.canonicalReasons)
  const annotations = deduplicateAnnotations(evidence.annotations)

  const hardBlockers: string[] = []
  const unknownCanonicalReasons: string[] = []
  const unknownAnnotations: string[] = []
  const familySet = new Set<HeldRepairFamily>()
  let confidence: HeldRecoveryConfidence = minConfidence(
    'high',
    minConfidence(confidenceFromGroundingStatus(input.groundingStatus), confidenceFromContextQuality(input.contextQuality)),
  )
  let anyRecoverable = false
  const authorActions = new Set<HeldAuthorAction>()
  const terminalOutcomes = new Set<HeldTerminalOutcome>()

  for (const occurrence of canonical) {
    const info = getHeldReasonInfo(occurrence.raw)
    // Decision projections decompose into their upstream origin producer when one
    // exists; otherwise they remain non-recoverative audit context.
    const contract =
      occurrence.recoveryContract?.authorityRole === 'decision_projection'
        ? decomposeDecisionProjection(occurrence, info) ?? occurrence.recoveryContract
        : occurrence.recoveryContract

    if (info.isHardBlocker) {
      hardBlockers.push(occurrence.raw)
    }

    if (info.isUnknown) {
      unknownCanonicalReasons.push(occurrence.raw)
    }

    // Recovery planning is driven only by origin producers. Decision projections
    // (base_decision / final_decision) and annotations contribute policy and
    // audit context but do not select independent repair actions.
    const isOriginActionable =
      contract?.authorityRole === 'origin' &&
      contract.recoveryAction !== 'none' &&
      info.recoverable

    if (isOriginActionable && info.repairFamily !== 'none') {
      familySet.add(info.repairFamily)
    }

    if (isOriginActionable) {
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

  // Annotations are observable but do not drive planning. Unknown reason codes
  // that appear only in non-canonical annotations are recorded for audit.
  for (const annotation of annotations) {
    if (annotation.source === 'executability') {
      const info = getHeldReasonInfo(annotation.raw)
      if (info.isUnknown) {
        unknownAnnotations.push(annotation.raw)
      }
    }
  }

  // Hard blockers or unknown canonical reasons fail closed: no automatic repair,
  // and terminal outcomes are restricted to withheld.
  const hasHardBlocker = hardBlockers.length > 0
  const hasUnknownCanonical = unknownCanonicalReasons.length > 0

  // If copy-paste is a possible outcome, candidates must be regenerated after
  // upstream repairs even when the original hold reason was not a candidate error.
  if (!hasHardBlocker && terminalOutcomes.has('copy_paste_rewrite')) {
    familySet.add('candidates')
  }

  const recoverable = anyRecoverable && !hasHardBlocker && !hasUnknownCanonical
  const contextBlocked = input.contextQuality === 'blocked'
  const automaticRecoveryAllowed =
    recoverable &&
    !contextBlocked &&
    canonical.every((o) => {
      const info = getHeldReasonInfo(o.raw)
      return info.automaticRecoveryAllowed || info.isHardBlocker
    }) &&
    !hasHardBlocker

  if (hasHardBlocker || hasUnknownCanonical) {
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
    unknownCanonicalReasons,
    unknownAnnotations,
    groundingNote: evidence.annotations.find((a) => a.source === 'grounding_note')?.raw ?? null,
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
