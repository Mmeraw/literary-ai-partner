/**
 * Held Recovery Reasons
 *
 * Recovery metadata for individual held-reason codes. Maps reason codes to
 * repair family, recoverability, confidence, and allowed terminal outcomes.
 */

import type { HeldReasonSource } from './heldRecoverySources'


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
