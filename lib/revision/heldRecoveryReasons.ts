/**
 * Held Recovery Reasons
 *
 * Recovery metadata for individual held-reason codes. Maps reason codes to
 * repair family, recoverability, confidence, and allowed terminal outcomes.
 */

import {
  HELD_REASON_SOURCE_REGISTRY,
  type HeldReasonProducer,
  type HeldReasonSource,
  type RecoveryAuthorityRole,
} from './heldRecoverySources'


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
  | 'author_assisted_canon_review'

// Author dispositions are separate from executor actions.
export type RequiredAuthorDisposition = HeldAuthorAction

export type HeldTerminalOutcome =
  | 'copy_paste_rewrite'
  | 'revision_strategy'
  | 'withheld'

export type HeldReasonStatus = 'currently_emitted' | 'legacy_supported' | 'reserved_not_emitted' | 'unverified'

export type RecoveryExecutionAction =
  | 'resolve_anchor'
  | 'retrieve_context'
  | 'repair_diagnosis'
  | 'create_versioned_candidate_set'
  | 'none'

export type RecoveryValidationStep =
  | 'rerun_admission'
  | 'reclassify'

export type RecoveryValidationPrecondition =
  | 'execution_action_changed_inputs'
  | 'author_submission_changed_inputs'
  | 'new_canonical_version'

export type RecoveryExecutionMode =
  | 'deterministic'
  | 'llm_assisted'
  | 'none'

export type RecoveryInputSource =
  | 'canonical_opportunity'
  | 'persisted_ledger'
  | 'classification'
  | 'author_submission'
  | 'manuscript_artifact'

export type RecoveryInputValidation =
  | 'non_empty'
  | 'valid_anchor'
  | 'complete_diagnostic'
  | 'complete_candidate_set'
  | 'non_empty_source_hash'

export type RecoveryInputRequirement = {
  key: string
  source: RecoveryInputSource
  required: boolean
  validation: RecoveryInputValidation
  notes?: string
}

export type HeldReasonRecoveryContract = {
  producer: HeldReasonProducer
  producerModule: string
  code: string
  authorityRole: RecoveryAuthorityRole
  recoveryAction: RecoveryExecutionAction
  validationStep: RecoveryValidationStep | null
  validationPrecondition: RecoveryValidationPrecondition | null
  requiredInputs: RecoveryInputRequirement[]
  executionMode: RecoveryExecutionMode
}

export type HeldReasonInfo = {
  reasonCode: string
  possibleProvenanceSources: HeldReasonSource[]
  canonicalPlanningSources: HeldReasonSource[]
  status: HeldReasonStatus
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
  recoveryContract?: HeldReasonRecoveryContract
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
    possibleProvenanceSources: ['preflight', 'hydration', 'base_decision'],
    canonicalPlanningSources: ['preflight', 'hydration', 'base_decision'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'res_blocker', 'base_decision'],
    canonicalPlanningSources: ['preflight', 'res_blocker', 'base_decision'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability', 'base_decision'],
    canonicalPlanningSources: ['base_decision'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability', 'base_decision', 'strategy_admission'],
    canonicalPlanningSources: ['base_decision', 'strategy_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['hydration', 'preflight'],
    canonicalPlanningSources: ['hydration', 'preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['hydration', 'preflight'],
    canonicalPlanningSources: ['hydration', 'preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability', 'base_decision', 'preflight'],
    canonicalPlanningSources: ['base_decision', 'preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability', 'base_decision', 'preflight'],
    canonicalPlanningSources: ['base_decision', 'preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability', 'copy_paste_admission'],
    canonicalPlanningSources: ['copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight'],
    canonicalPlanningSources: ['preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['hydration', 'preflight'],
    canonicalPlanningSources: ['hydration', 'preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['hydration', 'preflight'],
    canonicalPlanningSources: ['hydration', 'preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability', 'base_decision', 'preflight'],
    canonicalPlanningSources: ['base_decision', 'preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight'],
    canonicalPlanningSources: ['preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['strategy_admission'],
    canonicalPlanningSources: ['strategy_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability', 'strategy_admission'],
    canonicalPlanningSources: ['strategy_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'candidate_quality'],
    canonicalPlanningSources: ['preflight', 'candidate_quality'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'candidate_quality'],
    canonicalPlanningSources: ['preflight', 'candidate_quality'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'candidate_quality', 'canon_gate'],
    canonicalPlanningSources: ['preflight', 'candidate_quality', 'canon_gate'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'candidate_quality'],
    canonicalPlanningSources: ['preflight', 'candidate_quality'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'candidate_quality'],
    canonicalPlanningSources: ['preflight', 'candidate_quality'],
    status: 'unverified',
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
  candidate_noncompliant: {
    possibleProvenanceSources: ['preflight', 'candidate_quality'],
    canonicalPlanningSources: ['preflight', 'candidate_quality'],
    status: 'unverified',
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'One or more candidates are not copy-paste ready; regeneration may produce compliant prose.',
    isHardBlocker: false,
  },
  candidate_low_diversity: {
    possibleProvenanceSources: ['preflight', 'candidate_quality'],
    canonicalPlanningSources: ['preflight', 'candidate_quality'],
    status: 'unverified',
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate set has low diversity; regeneration should produce more distinct options.',
    isHardBlocker: false,
  },

  // ── Uppercase candidate quality reasons emitted by evaluateCardCandidateQuality ─
  empty_candidate: {
    possibleProvenanceSources: ['candidate_quality', 'copy_paste_admission'],
    canonicalPlanningSources: ['candidate_quality', 'copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'copy_paste_admission'],
    canonicalPlanningSources: ['candidate_quality', 'copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'copy_paste_admission'],
    canonicalPlanningSources: ['candidate_quality', 'copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'copy_paste_admission'],
    canonicalPlanningSources: ['candidate_quality', 'copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'copy_paste_admission'],
    canonicalPlanningSources: ['candidate_quality', 'copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'copy_paste_admission'],
    canonicalPlanningSources: ['candidate_quality', 'copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'canon_gate', 'copy_paste_admission', 'strategy_admission'],
    canonicalPlanningSources: ['candidate_quality', 'canon_gate', 'copy_paste_admission', 'strategy_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'copy_paste_admission'],
    canonicalPlanningSources: ['candidate_quality', 'copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'voice_gate', 'copy_paste_admission', 'strategy_admission'],
    canonicalPlanningSources: ['candidate_quality', 'voice_gate', 'copy_paste_admission', 'strategy_admission'],
    status: 'unverified',
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
  voice_drift_pov: {
    possibleProvenanceSources: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
    canonicalPlanningSources: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
    status: 'currently_emitted',
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate shifts point of view relative to the passage.',
    isHardBlocker: false,
  },
  voice_drift_tense: {
    possibleProvenanceSources: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
    canonicalPlanningSources: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
    status: 'currently_emitted',
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate shifts verb tense relative to the passage.',
    isHardBlocker: false,
  },
  voice_drift_forbidden_pattern: {
    possibleProvenanceSources: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
    canonicalPlanningSources: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
    status: 'currently_emitted',
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Candidates need regeneration',
    authorFacingExplanation: 'The candidate matches a forbidden voice pattern.',
    isHardBlocker: false,
  },
  canon_drift: {
    possibleProvenanceSources: ['candidate_quality', 'canon_gate', 'copy_paste_admission', 'strategy_admission'],
    canonicalPlanningSources: ['candidate_quality', 'canon_gate', 'copy_paste_admission', 'strategy_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['candidate_quality', 'copy_paste_admission'],
    canonicalPlanningSources: ['candidate_quality', 'copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight'],
    canonicalPlanningSources: ['preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['strategy_admission'],
    canonicalPlanningSources: ['strategy_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['strategy_admission'],
    canonicalPlanningSources: ['strategy_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'candidate_quality'],
    canonicalPlanningSources: ['preflight', 'candidate_quality'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight'],
    canonicalPlanningSources: ['preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    canonicalPlanningSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    status: 'unverified',
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
    possibleProvenanceSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    canonicalPlanningSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    status: 'unverified',
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
    possibleProvenanceSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    canonicalPlanningSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    status: 'unverified',
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
    possibleProvenanceSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    canonicalPlanningSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability', 'copy_paste_admission'],
    canonicalPlanningSources: ['copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability'],
    canonicalPlanningSources: [],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability'],
    canonicalPlanningSources: [],
    status: 'unverified',
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
    possibleProvenanceSources: ['copy_paste_admission'],
    canonicalPlanningSources: ['copy_paste_admission'],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability'],
    canonicalPlanningSources: [],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability'],
    canonicalPlanningSources: [],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability'],
    canonicalPlanningSources: [],
    status: 'unverified',
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
    possibleProvenanceSources: ['executability'],
    canonicalPlanningSources: [],
    status: 'unverified',
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
  ledger_conflict_possible: {
    possibleProvenanceSources: ['base_decision', 'executability'],
    canonicalPlanningSources: ['base_decision'],
    status: 'currently_emitted',
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Ledger conflict',
    authorFacingExplanation: 'A possible ledger conflict was detected; verify the surrounding context before proceeding.',
    isHardBlocker: false,
  },
  canon_conflict: {
    possibleProvenanceSources: ['base_decision', 'executability'],
    canonicalPlanningSources: ['base_decision'],
    status: 'currently_emitted',
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Canon conflict',
    authorFacingExplanation: 'The recommendation conflicts with established canon. Canon review is required.',
    isHardBlocker: false,
  },
  voice_fingerprint_unstable: {
    possibleProvenanceSources: ['base_decision', 'executability'],
    canonicalPlanningSources: ['base_decision'],
    status: 'currently_emitted',
    repairFamily: 'candidates',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['request_reanalysis', 'provide_context', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'medium',
    allowedTerminalOutcomes: ['copy_paste_rewrite', 'revision_strategy', 'withheld'],
    authorFacingCategory: 'Voice mismatch',
    authorFacingExplanation: 'The voice fingerprint for the passage is unstable; candidate regeneration may recover it.',
    isHardBlocker: false,
  },
  safe_local_copy_paste_rewrite: {
    possibleProvenanceSources: ['base_decision', 'executability'],
    canonicalPlanningSources: ['base_decision'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['dismiss', 'save_as_note'],
    recoveryConfidence: 'high',
    allowedTerminalOutcomes: ['copy_paste_rewrite'],
    authorFacingCategory: 'Safe local rewrite',
    authorFacingExplanation: 'The recommendation is a safe local copy-paste rewrite and requires no recovery.',
    isHardBlocker: false,
  },

  // ── Legacy / generic ───────────────────────────────────────────────────────
  not_ready_for_revise: {
    possibleProvenanceSources: ['preflight'],
    canonicalPlanningSources: ['preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'executability'],
    canonicalPlanningSources: ['preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['preflight', 'executability'],
    canonicalPlanningSources: ['preflight'],
    status: 'unverified',
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
    possibleProvenanceSources: ['copy_paste_admission', 'strategy_admission', 'executability'],
    canonicalPlanningSources: ['copy_paste_admission', 'strategy_admission'],
    status: 'unverified',
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
  blocked_preflight: {
    possibleProvenanceSources: ['preflight'],
    canonicalPlanningSources: ['preflight'],
    status: 'unverified',
    repairFamily: 'diagnosis',
    recoverable: true,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Preflight blocked',
    authorFacingExplanation: 'The opportunity was blocked during preflight without a more specific reason.',
    isHardBlocker: false,
  },
  grounding_unsupported: {
    possibleProvenanceSources: ['grounding'],
    canonicalPlanningSources: ['grounding'],
    status: 'unverified',
    repairFamily: 'context',
    recoverable: true,
    automaticRecoveryAllowed: true,
    allowedAuthorActions: ['provide_context', 'request_reanalysis', 'dismiss', 'save_as_note'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['revision_strategy', 'withheld'],
    authorFacingCategory: 'Grounding unsupported',
    authorFacingExplanation: 'The opportunity grounding is unsupported and requires re-grounding.',
    isHardBlocker: false,
  },
  integrity_below_pass_strong: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity gate failure',
    authorFacingExplanation: 'The recommendation did not meet the minimum integrity tier.',
    isHardBlocker: false,
  },
  integrity_incomplete_field: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: INCOMPLETE_FIELD.',
    isHardBlocker: false,
  },
  integrity_orphan_conjunction: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: ORPHAN_CONJUNCTION.',
    isHardBlocker: false,
  },
  integrity_malformed_connector: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: MALFORMED_CONNECTOR.',
    isHardBlocker: false,
  },
  integrity_sentence_fragment: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: SENTENCE_FRAGMENT.',
    isHardBlocker: false,
  },
  integrity_no_lowercase_opening: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: NO_LOWERCASE_OPENING.',
    isHardBlocker: false,
  },
  integrity_missing_terminal_punctuation: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: MISSING_TERMINAL_PUNCTUATION.',
    isHardBlocker: false,
  },
  integrity_repeated_clause: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: REPEATED_CLAUSE.',
    isHardBlocker: false,
  },
  integrity_mid_sentence_truncation: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: MID_SENTENCE_TRUNCATION.',
    isHardBlocker: false,
  },
  integrity_generic_workshop_language: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: GENERIC_WORKSHOP_LANGUAGE.',
    isHardBlocker: false,
  },
  integrity_missing_specific_anchor: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: MISSING_SPECIFIC_ANCHOR.',
    isHardBlocker: false,
  },
  integrity_vague_anchor: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: VAGUE_ANCHOR.',
    isHardBlocker: false,
  },
  integrity_missing_causal_language: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: MISSING_CAUSAL_LANGUAGE.',
    isHardBlocker: false,
  },
  integrity_missing_reader_consequence: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: MISSING_READER_CONSEQUENCE.',
    isHardBlocker: false,
  },
  integrity_missing_manuscript_evidence: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: MISSING_MANUSCRIPT_EVIDENCE.',
    isHardBlocker: false,
  },
  integrity_generic_effect_phrase: {
    possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission', 'final_decision', 'base_decision'],
    canonicalPlanningSources: ['integrity'],
    status: 'currently_emitted',
    repairFamily: 'none',
    recoverable: false,
    automaticRecoveryAllowed: false,
    allowedAuthorActions: ['dismiss', 'save_as_note', 'provide_context'],
    recoveryConfidence: 'low',
    allowedTerminalOutcomes: ['withheld'],
    authorFacingCategory: 'Integrity violation',
    authorFacingExplanation: 'The recommendation contains an integrity violation: GENERIC_EFFECT_PHRASE.',
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
  possibleProvenanceSources: [],
  canonicalPlanningSources: [],
  status: 'unverified',
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
      possibleProvenanceSources: ['candidate_quality', 'preflight'],
      canonicalPlanningSources: ['candidate_quality', 'preflight'],
      status: 'unverified',
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
      possibleProvenanceSources: ['integrity', 'copy_paste_admission', 'strategy_admission'],
      canonicalPlanningSources: ['integrity', 'copy_paste_admission', 'strategy_admission'],
      status: 'unverified',
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
      possibleProvenanceSources: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
      canonicalPlanningSources: ['voice_gate', 'copy_paste_admission', 'strategy_admission'],
      status: 'unverified',
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
      possibleProvenanceSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
      canonicalPlanningSources: ['copy_paste_admission', 'strategy_admission', 'integrity'],
      status: 'unverified',
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
      possibleProvenanceSources: ['hydration', 'preflight'],
      canonicalPlanningSources: ['hydration', 'preflight'],
      status: 'unverified',
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
// Per-source recovery execution contracts
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_REGISTRY_BY_SOURCE = new Map<HeldReasonSource, typeof HELD_REASON_SOURCE_REGISTRY[number]>(
  HELD_REASON_SOURCE_REGISTRY.map((entry) => [entry.source, entry]),
)

type RecoveryContractShell = Pick<
  HeldReasonRecoveryContract,
  'recoveryAction' | 'validationStep' | 'validationPrecondition' | 'executionMode' | 'requiredInputs'
>

const FAMILY_CONTRACT_DEFAULTS: Record<HeldRepairFamily, RecoveryContractShell> = {
  anchor: {
    recoveryAction: 'resolve_anchor',
    validationStep: 'rerun_admission',
    validationPrecondition: 'execution_action_changed_inputs',
    executionMode: 'deterministic',
    requiredInputs: [
      { key: 'source_text', source: 'canonical_opportunity', required: true, validation: 'non_empty' },
      { key: 'manuscript_coordinates', source: 'canonical_opportunity', required: true, validation: 'valid_anchor' },
      { key: 'evidence_anchor', source: 'manuscript_artifact', required: true, validation: 'valid_anchor' },
    ],
  },
  context: {
    recoveryAction: 'retrieve_context',
    validationStep: 'rerun_admission',
    validationPrecondition: 'execution_action_changed_inputs',
    executionMode: 'deterministic',
    requiredInputs: [
      { key: 'source_text', source: 'canonical_opportunity', required: true, validation: 'non_empty' },
      { key: 'evidence_anchor', source: 'manuscript_artifact', required: true, validation: 'valid_anchor' },
      { key: 'manuscript_chunks', source: 'manuscript_artifact', required: true, validation: 'non_empty' },
    ],
  },
  diagnosis: {
    recoveryAction: 'repair_diagnosis',
    validationStep: 'rerun_admission',
    validationPrecondition: 'execution_action_changed_inputs',
    executionMode: 'llm_assisted',
    requiredInputs: [
      { key: 'symptom', source: 'canonical_opportunity', required: true, validation: 'complete_diagnostic' },
      { key: 'cause', source: 'canonical_opportunity', required: true, validation: 'complete_diagnostic' },
      { key: 'fix_direction', source: 'canonical_opportunity', required: true, validation: 'complete_diagnostic' },
      { key: 'reader_effect', source: 'canonical_opportunity', required: true, validation: 'complete_diagnostic' },
      { key: 'rationale', source: 'canonical_opportunity', required: false, validation: 'non_empty' },
    ],
  },
  candidates: {
    recoveryAction: 'create_versioned_candidate_set',
    validationStep: 'rerun_admission',
    validationPrecondition: 'execution_action_changed_inputs',
    executionMode: 'llm_assisted',
    requiredInputs: [
      { key: 'existing_candidates_a_b_c', source: 'persisted_ledger', required: false, validation: 'complete_candidate_set' },
      { key: 'source_text', source: 'canonical_opportunity', required: true, validation: 'non_empty' },
      { key: 'evidence_anchor', source: 'manuscript_artifact', required: true, validation: 'valid_anchor' },
      { key: 'rationale', source: 'canonical_opportunity', required: false, validation: 'non_empty' },
      { key: 'diagnostic_object', source: 'classification', required: true, validation: 'complete_diagnostic' },
    ],
  },
  strategy: {
    recoveryAction: 'none',
    validationStep: null,
    validationPrecondition: null,
    executionMode: 'none',
    // recoveryAction is 'none'; no inputs are consumed by an executor.
    requiredInputs: [],
  },
  none: {
    recoveryAction: 'none',
    validationStep: null,
    validationPrecondition: null,
    executionMode: 'none',
    requiredInputs: [],
  },
}

function isNonRecoverableByPolicy(info: HeldReasonInfo): boolean {
  return info.repairFamily === 'none' || info.isHardBlocker || !info.recoverable
}

function decisionProjectionContract(
  code: string,
  entry: typeof HELD_REASON_SOURCE_REGISTRY[number],
): HeldReasonRecoveryContract | undefined {
  // Decision-owned summary codes do not select independent executor actions.
  if (code === 'passage_too_long') {
    return {
      producer: entry.producer,
      producerModule: entry.producerModule,
      code,
      authorityRole: entry.authorityRole,
      recoveryAction: 'none',
      validationStep: 'rerun_admission',
      validationPrecondition: 'new_canonical_version',
      requiredInputs: FAMILY_CONTRACT_DEFAULTS.strategy.requiredInputs,
      executionMode: 'none',
    }
  }

  if (code === 'copy_paste_admission_failed' || code === 'strategy_admission_failed') {
    return {
      producer: entry.producer,
      producerModule: entry.producerModule,
      code,
      authorityRole: entry.authorityRole,
      recoveryAction: 'none',
      validationStep: null,
      validationPrecondition: null,
      requiredInputs: [],
      executionMode: 'none',
    }
  }

  // Other decision-projection codes are routing/audit context only.
  return {
    producer: entry.producer,
    producerModule: entry.producerModule,
    code,
    authorityRole: entry.authorityRole,
    recoveryAction: 'none',
    validationStep: null,
    validationPrecondition: null,
    requiredInputs: [],
    executionMode: 'none',
  }
}

/**
 * Returns the recovery execution contract for a canonical reason occurrence.
 *
 * The contract is determined by the source (which provides the producer and
 * authority role) and the reason code (which provides the repair family and
 * per-code overrides). Annotation sources never return a contract.
 *
 * Decision-projection sources return `recoveryAction: 'none'` for all codes
 * except the genuinely decision-owned `passage_too_long`, which only validates
 * after a new canonical version.
 */
export function getRecoveryContractForReason(
  occurrence: { code: string; source: HeldReasonSource; raw?: string },
): HeldReasonRecoveryContract | undefined {
  const entry = SOURCE_REGISTRY_BY_SOURCE.get(occurrence.source)
  if (!entry) return undefined

  const code = normalizeHeldReasonCode(occurrence.code)
  const info = getHeldReasonInfo(code)
  const base = FAMILY_CONTRACT_DEFAULTS[info.repairFamily]

  if (entry.authorityRole === 'annotation') {
    return undefined
  }

  if (info.isUnknown) {
    return undefined
  }

  if (entry.authorityRole === 'decision_projection') {
    return decisionProjectionContract(code, entry)
  }

  // Origin producers.
  if (isNonRecoverableByPolicy(info)) {
    return {
      producer: entry.producer,
      producerModule: entry.producerModule,
      code,
      authorityRole: entry.authorityRole,
      recoveryAction: 'none',
      validationStep: null,
      validationPrecondition: null,
      requiredInputs: [],
      executionMode: 'none',
    }
  }

  return {
    producer: entry.producer,
    producerModule: entry.producerModule,
    code,
    authorityRole: entry.authorityRole,
    recoveryAction: base.recoveryAction,
    validationStep: base.validationStep,
    validationPrecondition: base.validationPrecondition,
    requiredInputs: base.requiredInputs,
    executionMode: base.executionMode,
  }
}
