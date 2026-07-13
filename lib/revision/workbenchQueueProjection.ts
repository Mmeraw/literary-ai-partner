/**
 * Workbench Queue Projection — pure classification layer
 *
 * This module separates three concerns that were conflated in the legacy
 * classifier:
 *   1. evidenceLocationScope — where the quoted evidence lives in the manuscript
 *   2. repairScope — how broad the editorial repair actually is
 *   3. copy-paste vs strategy admission — two distinct contracts
 *
 * It contains no Supabase/auth/IO; it accepts already-shaped WorkbenchOpportunity
 * objects and returns the classified payload.
 */

import type {
  WorkbenchOpportunity,
  WorkbenchScope,
  WorkbenchMode,
  WorkbenchSeverity,
} from './workbenchQueue'
import type { StrategyCardViewModel } from './recommendationExecutability'
import {
  evaluateRecommendationExecutability,
  buildStrategyCardScaffold,
  type RecommendationExecutabilityDecision,
} from './recommendationExecutability'
import {
  runCopyPasteAdmissionGate,
  runStrategyAdmissionGate,
} from './reviseAdmissionGate'
import { operationLabels, type RevisionOperation } from './reviseCardContract'

export type { StrategyCardViewModel } from './recommendationExecutability'

// ─────────────────────────────────────────────────────────────────────────────
// Scope resolution
// ─────────────────────────────────────────────────────────────────────────────

export function resolveEvidenceLocationScope(coordinates: string): WorkbenchScope {
  const normalized = coordinates.trim().toLowerCase()
  if (!normalized) return 'Passage'

  const prefixMatch = normalized.match(/^([a-z_]+):/)
  const prefix = prefixMatch?.[1] ?? ''

  // Typed coordinate prefixes. The most-specific unit in a compound coordinate
  // wins: chapter:5:paragraph:1 is the paragraph, not the chapter.
  switch (prefix) {
    case 'line':
      return 'Line'
    case 'passage':
      return 'Passage'
    case 'scene':
      return 'Scene'
    case 'chapter':
      return resolveMostSpecificInCompound(normalized, 'Chapter')
    case 'structural':
      return 'Structural'
    case 'manuscript':
      return 'Manuscript'
    default: {
      if (prefix) {
        // Unknown typed prefix (e.g. note:..., meta:...). Do not let the word
        // 'manuscript' inside a note falsely promote the scope.
        return 'Passage'
      }
      return resolveEvidenceLocationScopeFromNaturalLanguage(coordinates, normalized)
    }
  }
}

function resolveMostSpecificInCompound(
  normalized: string,
  defaultScope: WorkbenchScope,
): WorkbenchScope {
  const tokens = normalized.split(/[\s,;:.]+/).filter(Boolean)

  if (tokens.includes('line')) return 'Line'
  if (tokens.includes('paragraph') || tokens.includes('para') || tokens.includes('passage')) {
    return 'Passage'
  }
  if (tokens.includes('scene')) return 'Scene'
  if (tokens.includes('chapter') || tokens.includes('ch') || tokens.includes('chapters')) {
    return 'Chapter'
  }
  return defaultScope
}

function resolveEvidenceLocationScopeFromNaturalLanguage(
  raw: string,
  normalized: string,
): WorkbenchScope {
  if (
    /\b(?:whole\s+book|whole\s+manuscript|full\s+manuscript|manuscript-wide|across\s+the\s+manuscript)\b/.test(normalized)
  ) {
    return 'Manuscript'
  }

  // Specific location units are checked in descending order of specificity.
  // paragraph > scene > chapter, but chapter must be accompanied by a number.
  if (/\bline\s*\d+/i.test(raw)) return 'Line'
  if (/\b(?:paragraph|para\.?|passage)\s*\d+/i.test(raw)) return 'Passage'
  if (/\bscene\s*\d+/i.test(raw)) return 'Scene'
  if (/\b(?:chapters?|ch\.)\s*\d+/i.test(raw)) return 'Chapter'

  // Structural / manuscript-wide language only when no numbered local unit exists.
  if (/\b(?:structural|spine|arc|midpoint|climax|global\s+plot)\b/.test(normalized)) {
    return 'Structural'
  }
  if (/\b(?:whole\s+book|whole\s+manuscript|full\s+manuscript|manuscript-wide|across\s+the\s+manuscript)\b/.test(normalized)) {
    return 'Manuscript'
  }

  return 'Passage'
}

export function resolveRepairScope(
  opportunity: Pick<
    WorkbenchOpportunity,
    'fixDirection' | 'symptom' | 'readerEffect' | 'revisionOperation' | 'scope'
  > & {
    rationale?: string;
  },
): WorkbenchScope {
  if (opportunity.revisionOperation === 'needs_targeting') {
    return opportunity.scope ?? 'Passage'
  }

  const haystack = [
    opportunity.fixDirection,
    opportunity.rationale,
    opportunity.symptom,
    opportunity.readerEffect,
  ]
    .map((s) => String(s ?? '').toLowerCase())
    .join(' ')

  const broad = inferBroadRepairScope(haystack)
  if (broad) return broad

  return opportunity.scope ?? 'Passage'
}

function inferBroadRepairScope(haystack: string): 'Structural' | 'Manuscript' | null {
  const h = haystack

  // Whole-manuscript / book-wide signals are the strongest broad scope.
  if (
    /\b(?:whole\s+book|whole\s+manuscript|full\s+manuscript|manuscript-wide|across\s+the\s+manuscript|throughout\s+the\s+manuscript|global\s+(?:book|manuscript)|across\s+the\s+book)\b/.test(
      h,
    )
  ) {
    return 'Manuscript'
  }

  // Unambiguous structural verbs.
  if (
    /\b(?:redistribute|restructure|resequence|reorder|relocate|transplant|reposition|refactor|rebalance|consolidate|collapse|fuse)\b/.test(
      h,
    )
  ) {
    return 'Structural'
  }

  const broadNouns =
    '(?:scenes?|chapters?|subplot|arcs?|thread|threads|sequence|sequences|multiple\s+scenes|multiple\s+chapters|whole\s+(?:book|manuscript|chapter|scene)|later\s+scenes?|later\s+chapters?|later\s+passages?)'

  if (new RegExp(`\\b(?:move|shift|spread|transfer)\\s+(?:across|throughout|later|into|between|to\\s+(?:the\\s+)?(?:later|other)|to\\s+later\\s+(?:scenes?|chapters?))`, 'i').test(h)) {
    return 'Structural'
  }

  if (new RegExp(`\\b(?:delete|remove|cut|drop|excise)\\s+(?:across|throughout|later|${broadNouns})`, 'i').test(h)) {
    return 'Structural'
  }

  if (new RegExp(`\\b(?:merge|split|combine|divide)\\s+(?:across|into|throughout|later|${broadNouns})`, 'i').test(h)) {
    return 'Structural'
  }

  if (new RegExp(`\\b(?:compress|trim|tighten|shorten|condense)\\s+(?:across|throughout|later|${broadNouns})`, 'i').test(h)) {
    return 'Structural'
  }

  if (new RegExp(`\\b(?:rewrite|rework|recast|reframe)\\s+(?:across|throughout|later|${broadNouns})`, 'i').test(h)) {
    return 'Structural'
  }

  if (new RegExp(`\\b(?:add|insert|include|introduce)\\s+(?:across|throughout|later|${broadNouns})`, 'i').test(h)) {
    return 'Structural'
  }

  return null
}

export function modeForScope(scope: WorkbenchScope): WorkbenchMode {
  return scope === 'Chapter' || scope === 'Structural' || scope === 'Manuscript'
    ? 'repair-brief'
    : 'direct-rewrite'
}

export function hasPlaceholderCoordinates(coordinates: string): boolean {
  const normalized = coordinates.trim()
  if (!normalized) return true
  if (/^[A-Z_]+:recommendation$/i.test(normalized)) return true
  if (
    /\b(?:recommendation|criteria\.recommendations|evaluation_result)\b/i.test(normalized) &&
    !/\b(?:chunk|chapter|scene|paragraph|line|passage|act|page)\b/i.test(normalized)
  ) {
    return true
  }
  return false
}

export function passageLengthForExecutability(
  scope: WorkbenchScope,
  sourceText: string,
): 'short' | 'moderate' | 'long' {
  if (scope === 'Chapter' || scope === 'Structural' || scope === 'Manuscript') return 'long'
  const words = sourceText.split(/\s+/).filter(Boolean).length
  if (words <= 35) return 'short'
  if (words <= 120) return 'moderate'
  return 'long'
}

// ─────────────────────────────────────────────────────────────────────────────
// Classification
// ─────────────────────────────────────────────────────────────────────────────

function hasReasonMatching(reasons: string[] | undefined, pattern: RegExp): boolean {
  return (reasons ?? []).some((reason) => pattern.test(reason))
}

function sourceTextOf(opportunity: WorkbenchOpportunity): string {
  const text = `${opportunity.quoteHighlight ?? ''}${opportunity.quoteRest ?? ''}`.trim()
  if (!text || /no excerpt available/i.test(text)) return ''
  return text
}

function isLocalContextVerified(opportunity: WorkbenchOpportunity): boolean {
  const clean =
    opportunity.contextQuality === 'clean' && opportunity.preflightStatus === 'passed'
  const targeted =
    (opportunity as any).localContextStatus === 'verified' &&
    (opportunity as any).localContextSource === 'targeted_relook'
  return clean || targeted
}

export function classifyWorkbenchExecutability(
  opportunity: WorkbenchOpportunity,
): {
  cardType: 'copy_paste_rewrite' | 'revision_strategy' | 'withheld'
  trustedPathStatus: 'eligible' | 'unavailable_author_review_required' | 'impossible'
  reasons: string[]
  strategyCardViewModel?: StrategyCardViewModel | null
  copyPasteAdmissionPassed: boolean
  copyPasteAdmissionReasons: string[]
  strategyAdmissionPassed: boolean
  strategyAdmissionReasons: string[]
} {
  const sourceText = sourceTextOf(opportunity)
  const preflightReasons = opportunity.preflightReasons ?? []

  const hasEvidence = sourceText.length > 0 && !/no excerpt available/i.test(sourceText)
  const hardContextBlock =
    opportunity.contextQuality === 'blocked' || opportunity.preflightStatus === 'blocked'
  const evidenceAndDiagnosisSupported =
    hasEvidence &&
    (opportunity.groundingStatus === 'supported' ||
      opportunity.groundingStatus === 'supported_after_relook')

  const hardCanonConflict = hasReasonMatching(
    preflightReasons,
    /canon_authority_blocked|canon_conflict|canon_drift|testimony_fabrication/i,
  )

  const localContextVerified = isLocalContextVerified(opportunity)

  const copyPasteAdmission = runCopyPasteAdmissionGate(opportunity)
  const strategyAdmission = runStrategyAdmissionGate(opportunity)

  const executability = evaluateRecommendationExecutability({
    evidencePresent: hasEvidence,
    contextPresent: !hardContextBlock && evidenceAndDiagnosisSupported,
    canonClear: !hardContextBlock && !hardCanonConflict,
    diagnosisSupported: evidenceAndDiagnosisSupported,
    anchorPrecise: !hasPlaceholderCoordinates(opportunity.anchor),
    passageLength: passageLengthForExecutability(opportunity.scope, sourceText),
    beforeAfterContextSufficient: evidenceAndDiagnosisSupported && localContextVerified,
    ledgerConflictPossible: hasReasonMatching(
      preflightReasons,
      /ledger_conflict|insufficient_anchor_grounding|context_mismatch|canon_conflict|canon_authority_blocked|canon_drift/i,
    ),
    canonConflict: hasReasonMatching(
      preflightReasons,
      /canon_authority_blocked|canon_conflict|canon_drift/i,
    ),
    affectsSceneArchitecture: opportunity.mode === 'repair-brief',
    affectsPOVVoiceCanonMetaphor: hasReasonMatching(
      preflightReasons,
      /voice|pov|metaphor|canon_conflict|canon_authority_blocked|canon_drift|testimony/i,
    ),
    downstreamContinuityRisk: opportunity.mode === 'repair-brief' || opportunity.scope === 'Scene',
    voiceFingerprintStable: !hasReasonMatching(
      preflightReasons,
      /voice|pov|testimony_fabrication/i,
    ),
    localOperation:
      opportunity.mode === 'direct-rewrite' && opportunity.revisionOperation !== 'needs_targeting',
    passingCandidateCount: copyPasteAdmission.passedCandidateCount,
    candidateProseNarrativeSafe: copyPasteAdmission.passed,
    copyPasteAdmissionPassed: copyPasteAdmission.passed,
    copyPasteAdmissionReasons: copyPasteAdmission.reasons,
    strategyAdmissionPassed: strategyAdmission.passed,
    strategyAdmissionReasons: strategyAdmission.reasons,
  })

  let strategyCardViewModel: StrategyCardViewModel | null = null
  if (
    executability.cardType === 'revision_strategy' &&
    opportunity.readiness === 'ready_for_revise'
  ) {
    strategyCardViewModel = buildStrategyCardViewModel(opportunity, executability)
  }

  return {
    cardType: executability.cardType,
    trustedPathStatus: executability.trustedPathStatus,
    reasons: executability.reasons,
    strategyCardViewModel,
    copyPasteAdmissionPassed: copyPasteAdmission.passed,
    copyPasteAdmissionReasons: copyPasteAdmission.reasons,
    strategyAdmissionPassed: strategyAdmission.passed,
    strategyAdmissionReasons: strategyAdmission.reasons,
  }
}

function ensureTerminalPunctuation(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/[.!?]$/.test(trimmed)) return trimmed
  return `${trimmed}.`
}

function deriveStrategyApproaches(
  opportunity: WorkbenchOpportunity,
): {
  conservativeApproach: string
  moderateApproach: string
  boldApproach: string
  authorDecisionRequired: string
} {
  const evidenceLocationScope = opportunity.evidenceLocationScope ?? opportunity.scope ?? 'Passage'
  const repairScope = opportunity.repairScope ?? evidenceLocationScope
  const operation = (opportunity.revisionOperation as RevisionOperation | undefined) ?? 'replace_selected_passage'
  const operationLabel = operationLabels[operation] ?? 'recommended repair'

  const fix = (opportunity.fixDirection || '').trim()
  const fixSentence = ensureTerminalPunctuation(fix)

  const evidenceScope = evidenceLocationScope.toLowerCase()
  const repairScopeText = repairScope.toLowerCase()
  const broaderScopeText = repairScope !== evidenceLocationScope ? `${repairScopeText} level` : 'broader scope'

  const moderateApproach = fixSentence
    ? `Apply the recommended repair: ${fixSentence} Adjust the immediate context so the change lands cleanly.`
    : `Apply the ${operationLabel} at the ${evidenceScope} level and adjust the immediate context so the change lands cleanly.`

  const conservativeApproach = fixSentence
    ? `Apply the recommended repair at the smallest safe scope: ${fixSentence} Keep the change confined to the ${evidenceScope} and preserve the surrounding prose and voice.`
    : `Apply the ${operationLabel} at the ${evidenceScope} only, preserving the surrounding prose and voice.`

  const boldApproach = fixSentence
    ? repairScope !== evidenceLocationScope
      ? `Apply the recommended repair with broader scope: ${fixSentence} Apply it at the ${repairScopeText} level if the symptom appears elsewhere.`
      : `Apply the recommended repair more broadly than the ${evidenceScope}: ${fixSentence} Extend the change to adjacent units if the symptom repeats.`
    : repairScope !== evidenceLocationScope
      ? `Apply the ${operationLabel} at the ${repairScopeText} level.`
      : `Apply the ${operationLabel} more broadly than the ${evidenceScope}, extending it to adjacent units.`

  const authorDecisionRequired = `Decide whether the recommended repair should be applied at the ${evidenceScope} level or at the ${broaderScopeText}, and whether the ${operationLabel} is the right trade-off.`

  return { conservativeApproach, moderateApproach, boldApproach, authorDecisionRequired }
}

export function buildStrategyCardViewModel(
  opportunity: WorkbenchOpportunity,
  executability: RecommendationExecutabilityDecision,
): StrategyCardViewModel | null {
  if (executability.cardType !== 'revision_strategy') return null
  const evidenceAnchor = sourceTextOf(opportunity)
  const reasonCopyPasteIsUnsafe = Array.from(new Set(executability.reasons))
    .filter((r) => r !== 'safe_local_copy_paste_rewrite')
    .join('; ')

  const { conservativeApproach, moderateApproach, boldApproach, authorDecisionRequired } =
    deriveStrategyApproaches(opportunity)

  const scaffold = buildStrategyCardScaffold({
    cardNumber: `${opportunity.evidenceLocationScope ?? opportunity.scope} · ${opportunity.criterion}`,
    reasonCopyPasteIsUnsafe,
    ledgerReference: opportunity.issueStatement || opportunity.title,
    evidenceAnchor,
    conservativeApproach,
    moderateApproach,
    boldApproach,
    authorDecisionRequired,
  })

  const illustrativeExamples = opportunity.options
    .map((option) => ({
      key: option.key as 'A' | 'B' | 'C',
      label: option.mechanism,
      text: (option.candidateText || option.text || '').trim(),
    }))
    .filter((example) => example.text.length > 0)

  return { scaffold, illustrativeExamples }
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue partition
// ─────────────────────────────────────────────────────────────────────────────

export function isSupportedForUserQueue(opportunity: WorkbenchOpportunity): boolean {
  if (opportunity.readiness !== 'ready_for_revise') return false
  if (
    opportunity.groundingStatus !== 'supported' &&
    opportunity.groundingStatus !== 'supported_after_relook'
  ) {
    return false
  }
  if (opportunity.preflightStatus !== 'passed' && opportunity.preflightStatus !== 'limited_context') {
    return false
  }
  if (hasPlaceholderCoordinates(opportunity.anchor)) return false
  if ((opportunity.hydrationFailureReasons?.length ?? 0) > 0) return false
  const hardResBlockers = (opportunity.resBlockerReasons ?? []).filter(
    (reason) => reason !== 'limited_context_due_to_degraded_canon',
  )
  if (hardResBlockers.length > 0) return false
  if (opportunity.revisionOperation === 'needs_targeting') return false
  return true
}

export function partitionWorkbenchQueue(opportunities: WorkbenchOpportunity[]): {
  opportunities: WorkbenchOpportunity[]
  needsTargeting: WorkbenchOpportunity[]
  withheldUnsupported: WorkbenchOpportunity[]
  readinessTotals: { ready_for_revise: number; needs_targeting: number; withheld_unsupported: number }
  totals: Record<WorkbenchSeverity, number>
  scopes: Record<WorkbenchScope, number>
  criteria: Record<string, number>
} {
  const readyForRevise = opportunities.filter((o) => o.readiness === 'ready_for_revise')
  const needsTargetingRaw = opportunities.filter((o) => o.readiness === 'needs_targeting')

  const strategyReadyForReview = readyForRevise.filter(
    (o) => isSupportedForUserQueue(o) && o.cardType === 'revision_strategy',
  )

  const supportedReadyForRevise = readyForRevise.filter(
    (o) =>
      isSupportedForUserQueue(o) &&
      o.cardType === 'copy_paste_rewrite' &&
      o.trustedPathStatus === 'eligible',
  )

  const withheldUnsupported = readyForRevise.filter(
    (o) => !isSupportedForUserQueue(o) || o.cardType === 'withheld',
  )

  const needsTargeting = [...needsTargetingRaw, ...strategyReadyForReview]

  const totals: Record<WorkbenchSeverity, number> = { must: 0, should: 0, could: 0 }
  const scopes: Record<WorkbenchScope, number> = {
    Line: 0,
    Passage: 0,
    Scene: 0,
    Chapter: 0,
    Structural: 0,
    Manuscript: 0,
  }
  const criteria: Record<string, number> = {}

  for (const opportunity of supportedReadyForRevise) {
    totals[opportunity.severity] += 1
    scopes[opportunity.scope] += 1
    criteria[opportunity.criterion] = (criteria[opportunity.criterion] ?? 0) + 1
  }

  return {
    opportunities: supportedReadyForRevise,
    needsTargeting,
    withheldUnsupported,
    readinessTotals: {
      ready_for_revise: supportedReadyForRevise.length,
      needs_targeting: needsTargeting.length,
      withheld_unsupported: withheldUnsupported.length,
    },
    totals,
    scopes,
    criteria,
  }
}
