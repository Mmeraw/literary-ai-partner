/**
 * Held Recovery Inventory
 *
 * Authoritative reason-source registry and recovery metadata for held Workbench
 * opportunities. This module does NOT route, promote, or mutate cards. It is a
 * read-only contract used by the recovery planner to decide whether a held item
 * is recoverable and, if so, what repairs are required and in what order.
 *
 * Governance:
 * - finalDecision.cardType is the only queue-routing authority.
 * - Recoverability is derived from canonical production fields and gates, not
 *   from presentation copies such as `executabilityReasons` or `groundingNote`.
 * - Unknown reasons fail closed (recoverable=false, automaticRecoveryAllowed=false).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Canonical reason sources
// ─────────────────────────────────────────────────────────────────────────────

export type HeldReasonSource =
  | 'grounding'
  | 'preflight'
  | 'hydration'
  | 'res_blocker'
  | 'copy_paste_admission'
  | 'strategy_admission'
  | 'executability'
  | 'base_decision'
  | 'final_decision'
  | 'integrity'
  | 'candidate_quality'
  | 'voice_gate'
  | 'canon_gate'

export type HeldReasonSourceRegistryEntry = {
  source: HeldReasonSource
  canonicalField: string
  producer: string
  phase: string
  authoritativeForRecoveryPlanning: boolean
  authoritativeForRouting: boolean
  mayContainDuplicates: boolean
}

/**
 * Canonical source-of-truth table for held reason provenance.
 *
 * Only `final_decision` is authoritative for routing. The admission, grounding,
 * preflight, and base_decision sources are authoritative for planning repairs.
 * `executability` is a presentation copy of finalDecision.reasons and is NOT
 * authoritative on its own.
 */
export const HELD_REASON_SOURCE_REGISTRY: HeldReasonSourceRegistryEntry[] = [
  {
    source: 'grounding',
    canonicalField: 'groundingStatus / groundingNote',
    producer: 'lib/revision/workbenchQueue.ts (SLAE evidence matching) and lib/revision/opportunityLedger.ts (hydration fallback)',
    phase: 'queue_construction',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: false,
  },
  {
    source: 'preflight',
    canonicalField: 'preflightStatus / preflightReasons',
    producer: 'lib/revision/opportunityLedger.ts (preflightReasonsForOpportunity, blockOpportunityByPreflight, applyReviseQueuePreflight)',
    phase: 'ledger_preflight',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: true,
  },
  {
    source: 'hydration',
    canonicalField: 'hydrationFailureReasons',
    producer: 'lib/revision/opportunityLedger.ts (candidate hydration loop) and lib/revision/workbenchQueue.ts (splitPreflightReasonsByClass)',
    phase: 'candidate_hydration',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: true,
  },
  {
    source: 'res_blocker',
    canonicalField: 'resBlockerReasons',
    producer: 'lib/revision/workbenchQueue.ts (splitPreflightReasonsByClass)',
    phase: 'queue_construction',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: true,
  },
  {
    source: 'copy_paste_admission',
    canonicalField: 'classification.copyPasteAdmissionPassed / classification.copyPasteAdmissionReasons',
    producer: 'lib/revision/reviseAdmissionGate.ts (runCopyPasteAdmissionGate)',
    phase: 'admission_gate',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: true,
  },
  {
    source: 'strategy_admission',
    canonicalField: 'classification.strategyAdmissionPassed / classification.strategyAdmissionReasons',
    producer: 'lib/revision/reviseAdmissionGate.ts (runStrategyAdmissionGate)',
    phase: 'admission_gate',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: true,
  },
  {
    source: 'base_decision',
    canonicalField: 'classification.baseDecision (cardType, trustedPathStatus, reasons)',
    producer: 'lib/revision/recommendationExecutability.ts (evaluateRecommendationExecutability)',
    phase: 'executability_classification',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: false,
  },
  {
    source: 'final_decision',
    canonicalField: 'classification.finalDecision (cardType, trustedPathStatus, reasons)',
    producer: 'lib/revision/workbenchQueueProjection.ts (classifyWorkbenchExecutabilityDetailedCore, after needs-targeting promotion/override)',
    phase: 'executability_classification',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: true,
    mayContainDuplicates: false,
  },
  {
    source: 'executability',
    canonicalField: 'executabilityReasons',
    producer: 'lib/revision/workbenchQueueProjection.ts (copied from finalDecision.reasons onto the opportunity)',
    phase: 'presentation',
    authoritativeForRecoveryPlanning: false,
    authoritativeForRouting: false,
    mayContainDuplicates: true,
  },
  {
    source: 'integrity',
    canonicalField: 'Embedded in admission reasons as INTEGRITY_* and DIAGNOSTIC_* codes',
    producer: 'lib/evaluation/pipeline/recommendationIntegrityGate.ts (runRecommendationIntegrityGate)',
    phase: 'admission_gate',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: false,
  },
  {
    source: 'candidate_quality',
    canonicalField: 'Embedded in admission/preflight reasons',
    producer: 'lib/revision/candidateQuality.ts (evaluateCardCandidateQuality) and lib/revision/opportunityLedger.ts (candidateQualityReasons)',
    phase: 'candidate_quality_gate',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: true,
  },
  {
    source: 'voice_gate',
    canonicalField: 'Embedded in admission reasons',
    producer: 'lib/revision/voiceGate.ts (runVoiceGate)',
    phase: 'candidate_quality_gate',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: false,
  },
  {
    source: 'canon_gate',
    canonicalField: 'Embedded in admission reasons',
    producer: 'lib/revision/canonGate.ts (runCanonGate)',
    phase: 'candidate_quality_gate',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: false,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Recovery primitives
// ─────────────────────────────────────────────────────────────────────────────

export type HeldRecoveryStep =
  | 'expand_anchor'
  | 'retrieve_context'
  | 're_ground'
  | 'repair_diagnosis'
  | 'regenerate_candidates'
  | 'rerun_admission'
  | 'reclassify'

export type HeldRepairFamily =
  | 'anchor'
  | 'context'
  | 'diagnosis'
  | 'candidates'
  | 'strategy'
  | 'none'

export type HeldRecoveryConfidence = 'high' | 'medium' | 'low'

export type HeldAuthorAction =
  | 'provide_context'
  | 'request_reanalysis'
  | 'dismiss'
  | 'save_as_note'

export type HeldTerminalOutcome =
  | 'copy_paste_rewrite'
  | 'revision_strategy'
  | 'withheld'

export type HeldReasonInfo = {
  reasonCode: string
  sourceAuthorities: HeldReasonSource[]
  repairFamily: HeldRepairFamily
  recoverable: boolean
  automaticRecoveryAllowed: boolean
  allowedAuthorActions: HeldAuthorAction[]
  recoveryConfidence: HeldRecoveryConfidence
  allowedTerminalOutcomes: HeldTerminalOutcome[]
  authorFacingCategory: string
  authorFacingExplanation: string
  isHardBlocker: boolean
  isUnknown: boolean
}

export const REPAIR_STEP_ORDER: HeldRecoveryStep[] = [
  'expand_anchor',
  'retrieve_context',
  're_ground',
  'repair_diagnosis',
  'regenerate_candidates',
  'rerun_admission',
  'reclassify',
]

export const REPAIR_FAMILY_TEMPLATES: Record<HeldRepairFamily, HeldRecoveryStep[]> = {
  anchor: ['expand_anchor', 're_ground', 'repair_diagnosis', 'regenerate_candidates', 'rerun_admission', 'reclassify'],
  context: ['retrieve_context', 're_ground', 'repair_diagnosis', 'regenerate_candidates', 'rerun_admission', 'reclassify'],
  diagnosis: ['repair_diagnosis', 'regenerate_candidates', 'rerun_admission', 'reclassify'],
  candidates: ['regenerate_candidates', 'rerun_admission', 'reclassify'],
  strategy: ['rerun_admission', 'reclassify'],
  none: [],
}

const DEFAULT_AUTHOR_ACTIONS: HeldAuthorAction[] = ['dismiss', 'save_as_note']

// ─────────────────────────────────────────────────────────────────────────────
// Reason normalization
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeHeldReasonCode(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// Reason inventory
// ─────────────────────────────────────────────────────────────────────────────

export const HELD_REASON_INVENTORY: Record<string, PartialHeldReasonInfo> = {
  // ── Grounding / anchor ────────────────────────────────────────────────────
  truncated_anchor: {
    sourceAuthorities: ['preflight', 'hydration', 'base_decision'],
    repairFamily: 'anchor',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Anchor needs expansion',
    authorFacingExplanation: 'The cited passage appears clipped. Expanding the anchor window from the manuscript is likely to make this actionable.',
    isHardBlocker: false,
  },
  insufficient_anchor_grounding: {
    sourceAuthorities: ['preflight', 'res_blocker', 'base_decision'],
    repairFamily: 'anchor',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Anchor needs expansion',
    authorFacingExplanation: 'The evidence anchor could not be verified against the manuscript. Anchor expansion or context retrieval is needed.',
    isHardBlocker: false,
  },
  anchor_not_precise: {
    sourceAuthorities: ['executability', 'base_decision'],
    repairFamily: 'anchor',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Anchor needs expansion',
    authorFacingExplanation: 'The target passage is too vague or matches multiple locations. A more precise anchor is required.',
    isHardBlocker: false,
  },
  evidence_missing: {
    sourceAuthorities: ['executability', 'base_decision', 'strategy_admission'],
    repairFamily: 'anchor',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Anchor needs expansion',
    authorFacingExplanation: 'No manuscript evidence was found. The anchor must be recovered before the recommendation can proceed.',
    isHardBlocker: false,
  },
  hydration_anchor_truncated: {
    sourceAuthorities: ['hydration', 'preflight'],
    repairFamily: 'anchor',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Anchor needs expansion',
    authorFacingExplanation: 'The hydration anchor was truncated and could not be matched to the manuscript.',
    isHardBlocker: false,
  },
  hydration_placeholder_coordinates: {
    sourceAuthorities: ['hydration', 'preflight'],
    repairFamily: 'anchor',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Anchor needs expansion',
    authorFacingExplanation: 'The anchor uses placeholder coordinates that must be resolved to actual manuscript text.',
    isHardBlocker: false,
  },

  // ── Context / canon ───────────────────────────────────────────────────────
  context_missing: {
    sourceAuthorities: ['executability', 'base_decision', 'preflight'],
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Context needed',
    authorFacingExplanation: 'More surrounding scene context is needed to confirm this direction.',
    isHardBlocker: false,
  },
  canon_unclear: {
    sourceAuthorities: ['executability', 'base_decision', 'preflight'],
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Canon clarity needed',
    authorFacingExplanation: 'Manuscript facts around this passage are unclear. More context is needed before a safe revision can be generated.',
    isHardBlocker: false,
  },
  insufficient_before_after_context: {
    sourceAuthorities: ['executability', 'copy_paste_admission'],
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Context needed',
    authorFacingExplanation: 'The passage window is too narrow to support a safe replacement.',
    isHardBlocker: false,
  },
  limited_context_due_to_degraded_canon: {
    sourceAuthorities: ['preflight'],
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Canon rebuild needed',
    authorFacingExplanation: 'The local manuscript memory appears desynchronized. A fresh context rebuild may recover this item.',
    isHardBlocker: false,
  },
  hydration_context_not_found: {
    sourceAuthorities: ['hydration', 'preflight'],
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Context needed',
    authorFacingExplanation: 'The hydration system could not locate the manuscript context for this anchor.',
    isHardBlocker: false,
  },
  hydration_input_contaminated: {
    sourceAuthorities: ['hydration', 'preflight'],
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Input contaminated',
    authorFacingExplanation: 'The hydration input contained prompt artifacts or non-manuscript text and must be re-fetched cleanly.',
    isHardBlocker: false,
  },

  // ── Diagnosis ─────────────────────────────────────────────────────────────
  diagnosis_unsupported: {
    sourceAuthorities: ['executability', 'base_decision', 'preflight'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'copy_paste_rewrite', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The editorial connection between the evidence and the recommendation needs to be re-established.',
    isHardBlocker: false,
  },
  recommendation_requires_rewrite: {
    sourceAuthorities: ['preflight'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The recommendation does not state a concrete, executable revision operation.',
    isHardBlocker: false,
  },
  missing_concrete_action: {
    sourceAuthorities: ['strategy_admission'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The recommendation lacks a concrete action. The diagnosis should be sharpened before any prose is generated.',
    isHardBlocker: false,
  },
  strategy_admission_failed: {
    sourceAuthorities: ['executability', 'strategy_admission'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The recommendation could not be defended as a strategy. The underlying editorial argument may need repair.',
    isHardBlocker: false,
  },

  // ── Candidate quality ───────────────────────────────────────────────────────
  candidate_quality_failed: {
    sourceAuthorities: ['preflight', 'candidate_quality'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The generated candidates did not pass quality checks. Regeneration with better grounding may produce safe prose.',
    isHardBlocker: false,
  },
  candidate_quality_failed_after_regen: {
    sourceAuthorities: ['preflight', 'candidate_quality'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'Candidates failed quality checks even after regeneration. The recommendation may be better suited as a strategy.',
    isHardBlocker: false,
  },
  candidate_quality_unsupported_facts: {
    sourceAuthorities: ['preflight', 'candidate_quality', 'canon_gate'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'A candidate introduced an unverified fact. Regeneration constrained to known canon may recover it.',
    isHardBlocker: false,
  },
  candidate_quality_context_mismatch: {
    sourceAuthorities: ['preflight', 'candidate_quality'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate does not fit the surrounding passage. Anchor and context repair should come first.',
    isHardBlocker: false,
  },
  candidate_quality_not_evidence_grounded: {
    sourceAuthorities: ['preflight', 'candidate_quality'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate is not grounded in the evidence anchor. Anchor and context repair should come first.',
    isHardBlocker: false,
  },

  // ── Uppercase candidate quality reasons emitted by evaluateCardCandidateQuality ─
  empty_candidate: {
    sourceAuthorities: ['candidate_quality', 'copy_paste_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'No candidate text was produced. Regeneration may provide usable prose.',
    isHardBlocker: false,
  },
  too_short: {
    sourceAuthorities: ['candidate_quality', 'copy_paste_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'A candidate is too short to be a usable replacement.',
    isHardBlocker: false,
  },
  generic_prose: {
    sourceAuthorities: ['candidate_quality', 'copy_paste_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate prose is too generic. Regeneration with stronger voice constraints may recover it.',
    isHardBlocker: false,
  },
  non_executable_prose: {
    sourceAuthorities: ['candidate_quality', 'copy_paste_admission'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The candidate reads like editorial commentary rather than executable prose. The recommendation should be sharpened.',
    isHardBlocker: false,
  },
  not_executable: {
    sourceAuthorities: ['candidate_quality', 'copy_paste_admission'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The candidate contains placeholders or instructions instead of executable manuscript prose.',
    isHardBlocker: false,
  },
  anchor_echo: {
    sourceAuthorities: ['candidate_quality', 'copy_paste_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate repeats the anchor too closely and is not a meaningful revision.',
    isHardBlocker: false,
  },
  unsupported_fact: {
    sourceAuthorities: ['candidate_quality', 'canon_gate', 'copy_paste_admission', 'strategy_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'A candidate introduced an unverified fact. Regeneration constrained to known canon may recover it.',
    isHardBlocker: false,
  },
  context_mismatch: {
    sourceAuthorities: ['candidate_quality', 'copy_paste_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate does not fit the surrounding passage. Anchor and context repair should come first.',
    isHardBlocker: false,
  },
  voice_drift: {
    sourceAuthorities: ['candidate_quality', 'voice_gate', 'copy_paste_admission', 'strategy_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate voice does not match the passage. Voice-aware regeneration may help.',
    isHardBlocker: false,
  },
  canon_drift: {
    sourceAuthorities: ['candidate_quality', 'canon_gate', 'copy_paste_admission', 'strategy_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate drifts from established manuscript facts. Canon repair may recover it.',
    isHardBlocker: false,
  },
  revision_quality_failed: {
    sourceAuthorities: ['candidate_quality', 'copy_paste_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate set failed the overall revision quality gate.',
    isHardBlocker: false,
  },

  // ── Hard blockers ─────────────────────────────────────────────────────────
  canon_authority_blocked: {
    sourceAuthorities: ['preflight'],
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Canon conflict',
    authorFacingExplanation: 'This recommendation conflicts with the manuscript and is unlikely to become actionable without substantive manuscript revision.',
    isHardBlocker: true,
  },
  hard_canon_conflict: {
    sourceAuthorities: ['strategy_admission'],
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Canon conflict',
    authorFacingExplanation: 'This recommendation conflicts with the manuscript and is unlikely to become actionable.',
    isHardBlocker: true,
  },
  hard_context_block: {
    sourceAuthorities: ['strategy_admission'],
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Context blocked',
    authorFacingExplanation: 'The surrounding context is unavailable. This item cannot be made actionable without a revised manuscript.',
    isHardBlocker: true,
  },
  testimony_fabrication_risk: {
    sourceAuthorities: ['preflight', 'candidate_quality'],
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Unsafe factual suggestion',
    authorFacingExplanation: 'This recommendation introduces unsupported events and should not be generated.',
    isHardBlocker: true,
  },
  rationale_contaminated: {
    sourceAuthorities: ['preflight'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The recommendation rationale contains template or system text and should be regenerated from the source findings.',
    isHardBlocker: false,
  },

  // ── Diagnostic completeness (from reviseAdmissionGate) ──────────────────────
  diagnostic_missing_symptom: {
    sourceAuthorities: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The symptom field is missing or too short.',
    isHardBlocker: false,
  },
  diagnostic_missing_cause: {
    sourceAuthorities: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The cause field is missing or too short.',
    isHardBlocker: false,
  },
  diagnostic_missing_fix_direction: {
    sourceAuthorities: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The fix direction field is missing or too short.',
    isHardBlocker: false,
  },
  diagnostic_missing_reader_effect: {
    sourceAuthorities: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The reader effect field is missing or too short.',
    isHardBlocker: false,
  },

  // ── Executability-level admission failures ────────────────────────────────
  copy_paste_admission_failed: {
    sourceAuthorities: ['executability', 'copy_paste_admission'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The recommendation did not pass the executable-prose gate. Candidates may need regeneration after context is fixed.',
    isHardBlocker: false,
  },
  fewer_than_two_candidates_passed_quality: {
    sourceAuthorities: ['executability'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'Fewer than two candidates passed the quality gate.',
    isHardBlocker: false,
  },
  candidate_prose_not_narratively_safe: {
    sourceAuthorities: ['executability'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate prose is not narratively safe.',
    isHardBlocker: false,
  },

  // ── Scope / operation reasons ───────────────────────────────────────────────
  not_local_operation: {
    sourceAuthorities: ['copy_paste_admission'],
    repairFamily: 'strategy',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Scope too broad',
    authorFacingExplanation: 'The revision is not a local operation and is better suited as a strategy.',
    isHardBlocker: false,
  },
  scene_architecture_change: {
    sourceAuthorities: ['executability'],
    repairFamily: 'strategy',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Scope too broad',
    authorFacingExplanation: 'The change affects scene architecture and is better suited as a strategy.',
    isHardBlocker: false,
  },
  pov_voice_canon_or_metaphor_risk: {
    sourceAuthorities: ['executability'],
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate risks POV, voice, canon, or metaphor drift.',
    isHardBlocker: false,
  },
  downstream_continuity_risk: {
    sourceAuthorities: ['executability'],
    repairFamily: 'strategy',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Scope too broad',
    authorFacingExplanation: 'The change creates downstream continuity risk and is better suited as a strategy.',
    isHardBlocker: false,
  },
  passage_too_long: {
    sourceAuthorities: ['executability'],
    repairFamily: 'strategy',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Scope too broad',
    authorFacingExplanation: 'The passage is too long for a safe local replacement.',
    isHardBlocker: false,
  },

  // ── Legacy / generic ───────────────────────────────────────────────────────
  not_ready_for_revise: {
    sourceAuthorities: ['preflight'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The opportunity is not ready for the revise queue.',
    isHardBlocker: false,
  },
  preflight_not_passed: {
    sourceAuthorities: ['preflight', 'executability'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The preflight gate did not pass. Inspect the specific preflight reasons.',
    isHardBlocker: false,
  },
  context_insufficient: {
    sourceAuthorities: ['preflight', 'executability'],
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Context needed',
    authorFacingExplanation: 'The context is insufficient for a safe revision.',
    isHardBlocker: false,
  },
  unsupported_revision: {
    sourceAuthorities: ['copy_paste_admission', 'strategy_admission', 'executability'],
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Diagnosis needs repair',
    authorFacingExplanation: 'The revision is not supported by the evidence anchor.',
    isHardBlocker: false,
  },
}

/**
 * Partial reason info with defaults applied by `getHeldReasonInfo`.
 */
type PartialHeldReasonInfo = Omit<HeldReasonInfo, 'reasonCode' | 'isUnknown'> & {
  reasonCode?: string
}

const DEFAULT_REASON_INFO: HeldReasonInfo = {
  reasonCode: 'unknown',
  sourceAuthorities: [],
  repairFamily: 'none',
  recoverable: false,
  automaticRecoveryAllowed: false,
  allowedAuthorActions: DEFAULT_AUTHOR_ACTIONS,
  recoveryConfidence: 'low',
  allowedTerminalOutcomes: ['withheld'],
  authorFacingCategory: 'Unknown reason',
  authorFacingExplanation: 'This diagnostic has no known recovery strategy.',
  isHardBlocker: false,
  isUnknown: false,
}

// Patterns for reason families emitted dynamically by gates.
const HELD_REASON_PATTERNS: Array<{
  pattern: RegExp
  info: PartialHeldReasonInfo
}> = [
  {
    pattern: /^candidate_quality_/,
    info: {
      sourceAuthorities: ['candidate_quality', 'preflight'],
      repairFamily: 'candidates',
      recoverable: true,
      automaticRecoveryAllowed: true,
      allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
      recoveryConfidence: 'medium',
      allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      authorFacingCategory: 'Candidates need regeneration',
      authorFacingExplanation: 'A candidate-quality check failed. Inspect the specific reason for details.',
      isHardBlocker: false,
    },
  },
  {
    pattern: /^integrity_/,
    info: {
      sourceAuthorities: ['integrity', 'copy_paste_admission', 'strategy_admission'],
      repairFamily: 'diagnosis',
      recoverable: true,
      automaticRecoveryAllowed: false,
      allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
      recoveryConfidence: 'low',
      allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
      authorFacingCategory: 'Diagnosis needs repair',
      authorFacingExplanation: 'An integrity check on the diagnostic text failed.',
      isHardBlocker: false,
    },
  },
  {
    pattern: /^voice_drift_/,
    info: {
      sourceAuthorities: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
      repairFamily: 'candidates',
      recoverable: true,
      automaticRecoveryAllowed: true,
      allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
      recoveryConfidence: 'medium',
      allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      authorFacingCategory: 'Candidates need regeneration',
      authorFacingExplanation: 'A candidate has a voice drift.',
      isHardBlocker: false,
    },
  },
  {
    pattern: /^diagnostic_missing_/,
    info: {
      sourceAuthorities: ['copy_paste_admission', 'strategy_admission', 'integrity'],
      repairFamily: 'diagnosis',
      recoverable: true,
      automaticRecoveryAllowed: false,
      allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
      recoveryConfidence: 'medium',
      allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
      authorFacingCategory: 'Diagnosis needs repair',
      authorFacingExplanation: 'A required diagnostic field is missing or too short.',
      isHardBlocker: false,
    },
  },
  {
    pattern: /^hydration_/,
    info: {
      sourceAuthorities: ['hydration', 'preflight'],
      repairFamily: 'context',
      recoverable: true,
      automaticRecoveryAllowed: true,
      allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
      recoveryConfidence: 'medium',
      allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
      authorFacingCategory: 'Hydration issue',
      authorFacingExplanation: 'The candidate hydration step encountered an anchor or context problem.',
      isHardBlocker: false,
    },
  },
]

export function getHeldReasonInfo(rawReason: string): HeldReasonInfo {
  const normalized = normalizeHeldReasonCode(rawReason)
  const exact = HELD_REASON_INVENTORY[normalized]
  if (exact) {
    return { ...DEFAULT_REASON_INFO, ...exact, reasonCode: normalized }
  }

  for (const { pattern, info } of HELD_REASON_PATTERNS) {
    if (pattern.test(normalized)) {
      return { ...DEFAULT_REASON_INFO, ...info, reasonCode: normalized }
    }
  }

  return {
    ...DEFAULT_REASON_INFO,
    reasonCode: normalized,
    isUnknown: true,
    authorFacingExplanation: `Unrecognized diagnostic "${rawReason}". It will remain auditable and withheld until the inventory is updated.`,
  }
}

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
