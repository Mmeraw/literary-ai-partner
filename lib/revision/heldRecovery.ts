/**
 * Held Recovery Engine — initial production reason inventory.
 *
 * NOT YET COMPLETE. This is an initial inventory based on source inspection.
 * Registry completeness requires:
 *   1. Every canonical producer to export or type its emitted vocabulary.
 *   2. Anti-drift tests that prove registry coverage against live producer output.
 *
 * Do NOT normalise production reason strings. Production codes are kept exactly
 * as emitted (e.g. 'GENERIC_PROSE', 'canon_conflict').
 * Normalisation for lookup is performed inside lookupRecoveryAction() only.
 */

import type { ClassifiedWorkbenchOpportunity } from './workbenchQueueProjection';

// ---------------------------------------------------------------------------
// Recovery action vocabulary
// ---------------------------------------------------------------------------

export type RecoveryAction =
  | 'PROVIDE_EVIDENCE'
  | 'PROVIDE_CONTEXT'
  | 'RESOLVE_CANON'
  | 'REGENERATE_CANDIDATES'
  | 'REEVALUATE_DIAGNOSIS'
  | 'REQUEST_AUTHOR_INPUT'
  | 'IMPOSSIBLE';

// ---------------------------------------------------------------------------
// Recovery action priority (lower index = higher severity / blocks others)
// ---------------------------------------------------------------------------

const ACTION_PRIORITY: readonly RecoveryAction[] = [
  'IMPOSSIBLE',
  'RESOLVE_CANON',
  'PROVIDE_EVIDENCE',
  'PROVIDE_CONTEXT',
  'REEVALUATE_DIAGNOSIS',
  'REGENERATE_CANDIDATES',
  'REQUEST_AUTHOR_INPUT',
];

export function primaryAction(actions: readonly RecoveryAction[]): RecoveryAction {
  if (actions.length === 0) return 'REQUEST_AUTHOR_INPUT';
  let best = actions[0];
  for (const action of actions) {
    if (ACTION_PRIORITY.indexOf(action) < ACTION_PRIORITY.indexOf(best)) {
      best = action;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Registry entry shape
// ---------------------------------------------------------------------------

export type ReasonRegistryEntry = {
  /** Exact string as emitted by the production producer. Never normalised here. */
  readonly code: string;
  /** Dot-path to the emitting function, e.g. "recommendationExecutability.evaluateRecommendationExecutability" */
  readonly producer: string;
  /** Which field the reason appears in on WorkbenchOpportunity */
  readonly emittedBy: 'executabilityReasons' | 'preflightReasons' | 'hydrationFailureReasons' | 'resBlockerReasons' | 'admissionReasons';
  readonly status: 'currently_emitted';
  /**
   * 'source-grep'  — presence confirmed by source inspection only.
   * 'unit-test'    — presence confirmed by a unit test that calls the producer.
   */
  readonly evidence: 'source-grep' | 'unit-test';
  readonly recoveryAction: RecoveryAction;
};

// ---------------------------------------------------------------------------
// Initial production reason inventory
// (rename to PRODUCTION_REASON_REGISTRY once all entries have evidence:'unit-test'
//  and every producer exports its vocabulary as a typed constant)
// ---------------------------------------------------------------------------

export const INITIAL_PRODUCTION_REASON_INVENTORY: readonly ReasonRegistryEntry[] = [
  // ── recommendationExecutability.evaluateRecommendationExecutability ──────
  // Withheld-level executability codes (land in executabilityReasons via classifier)
  { code: 'evidence_missing',       producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_EVIDENCE' },
  { code: 'context_missing',        producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_CONTEXT' },
  { code: 'canon_unclear',          producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'RESOLVE_CANON' },
  { code: 'diagnosis_unsupported',  producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REEVALUATE_DIAGNOSIS' },

  // Copy-paste unsafe codes (may also appear in executabilityReasons when copy-paste blocked)
  { code: 'insufficient_before_after_context', producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_CONTEXT' },
  { code: 'ledger_conflict_possible',          producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },
  { code: 'canon_conflict',                    producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'RESOLVE_CANON' },
  { code: 'anchor_not_precise',               producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_EVIDENCE' },
  { code: 'passage_too_long',                 producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },
  { code: 'scene_architecture_change',        producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },
  { code: 'pov_voice_canon_or_metaphor_risk', producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'RESOLVE_CANON' },
  { code: 'downstream_continuity_risk',       producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },
  { code: 'voice_fingerprint_unstable',       producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },
  { code: 'not_local_operation',              producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },
  { code: 'fewer_than_two_candidates_passed_quality', producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
  { code: 'candidate_prose_not_narratively_safe',     producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
  { code: 'copy_paste_admission_failed',              producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
  { code: 'safe_local_copy_paste_rewrite',            producer: 'recommendationExecutability.evaluateRecommendationExecutability', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },

  // ── reviseAdmissionGate.runCopyPasteAdmissionGate ────────────────────────
  { code: 'DIAGNOSTIC_MISSING_SYMPTOM',      producer: 'reviseAdmissionGate.runCopyPasteAdmissionGate', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'IMPOSSIBLE' },
  { code: 'DIAGNOSTIC_MISSING_CAUSE',        producer: 'reviseAdmissionGate.runCopyPasteAdmissionGate', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'IMPOSSIBLE' },
  { code: 'DIAGNOSTIC_MISSING_FIX_DIRECTION',producer: 'reviseAdmissionGate.runCopyPasteAdmissionGate', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'IMPOSSIBLE' },
  { code: 'DIAGNOSTIC_MISSING_READER_EFFECT',producer: 'reviseAdmissionGate.runCopyPasteAdmissionGate', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'IMPOSSIBLE' },
  { code: 'INTEGRITY_BELOW_PASS_STRONG',      producer: 'reviseAdmissionGate.integrityReasons',          emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'IMPOSSIBLE' },
  { code: 'HARD_CONTEXT_BLOCK',               producer: 'reviseAdmissionGate.runStrategyAdmissionGate',  emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_CONTEXT' },
  { code: 'HARD_CANON_CONFLICT',              producer: 'reviseAdmissionGate.runStrategyAdmissionGate',  emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'RESOLVE_CANON' },
  { code: 'EVIDENCE_MISSING',                 producer: 'reviseAdmissionGate.runStrategyAdmissionGate',  emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_EVIDENCE' },
  { code: 'UNSUPPORTED_REVISION',             producer: 'reviseAdmissionGate.runCopyPasteAdmissionGate', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REEVALUATE_DIAGNOSIS' },
  { code: 'MISSING_CONCRETE_ACTION',          producer: 'reviseAdmissionGate.runStrategyAdmissionGate',  emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'IMPOSSIBLE' },

  // HARD_CANDIDATE_REASONS — emitted via candidateQuality into admission gate
  { code: 'GENERIC_PROSE',                    producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
  { code: 'NON_EXECUTABLE_PROSE',             producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
  { code: 'NOT_EXECUTABLE',                   producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
  { code: 'UNSUPPORTED_FACT',                 producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
  { code: 'CONTEXT_MISMATCH',                 producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_CONTEXT' },
  { code: 'CANON_DRIFT',                      producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'RESOLVE_CANON' },
  { code: 'VOICE_DRIFT_POV',                  producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },
  { code: 'VOICE_DRIFT_TENSE',                producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },
  { code: 'VOICE_DRIFT_FORBIDDEN_PATTERN',    producer: 'reviseAdmissionGate.HARD_CANDIDATE_REASONS', emittedBy: 'executabilityReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REQUEST_AUTHOR_INPUT' },

  // ── opportunityLedger.preflightReasonsForOpportunity ────────────────────
  { code: 'canon_authority_blocked',          producer: 'opportunityLedger.preflightReasonsForOpportunity', emittedBy: 'preflightReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'RESOLVE_CANON' },
  { code: 'insufficient_anchor_grounding',    producer: 'opportunityLedger.preflightReasonsForOpportunity', emittedBy: 'preflightReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_EVIDENCE' },
  { code: 'truncated_anchor',                 producer: 'opportunityLedger.preflightReasonsForOpportunity', emittedBy: 'preflightReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'PROVIDE_EVIDENCE' },
  { code: 'recommendation_requires_rewrite',  producer: 'opportunityLedger.preflightReasonsForOpportunity', emittedBy: 'preflightReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'IMPOSSIBLE' },
  { code: 'testimony_fabrication_risk',       producer: 'opportunityLedger.preflightReasonsForOpportunity', emittedBy: 'preflightReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'RESOLVE_CANON' },
  { code: 'rationale_contaminated',           producer: 'opportunityLedger.preflightReasonsForOpportunity', emittedBy: 'preflightReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'IMPOSSIBLE' },
  { code: 'hydration_candidate_rejected_overlap', producer: 'opportunityLedger.preflightReasonsForOpportunity', emittedBy: 'preflightReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
  { code: 'candidate_quality_failed_after_regen', producer: 'opportunityLedger.preflightReasonsForOpportunity', emittedBy: 'preflightReasons', status: 'currently_emitted', evidence: 'source-grep', recoveryAction: 'REGENERATE_CANDIDATES' },
] as const;

// ---------------------------------------------------------------------------
// Lookup — normalisation occurs here only, never in production code
// ---------------------------------------------------------------------------

const _byCode = new Map<string, ReasonRegistryEntry>(
  INITIAL_PRODUCTION_REASON_INVENTORY.map((entry) => [entry.code.toLowerCase(), entry]),
);

/**
 * Look up a registry entry by reason code.
 * Case-insensitive; normalisation happens in this function only.
 * Returns undefined if the code is not yet in the initial inventory.
 */
export function lookupRegistryEntry(code: string): ReasonRegistryEntry | undefined {
  return _byCode.get(code.toLowerCase());
}

/**
 * Resolve a reason code to its recovery action.
 * Falls back to 'REQUEST_AUTHOR_INPUT' for unregistered codes rather than
 * throwing, because an unrecognised code should not crash the planner.
 */
export function lookupRecoveryAction(code: string): RecoveryAction {
  return lookupRegistryEntry(code)?.recoveryAction ?? 'REQUEST_AUTHOR_INPUT';
}

// ---------------------------------------------------------------------------
// Recovery plan
// ---------------------------------------------------------------------------

export type RecoveryPlan = {
  readonly opportunityId: string;
  /** All distinct recovery actions derived from the opportunity's reason codes. */
  readonly actions: readonly RecoveryAction[];
  /** The highest-priority action (see ACTION_PRIORITY). */
  readonly primaryAction: RecoveryAction;
  /** The raw reason codes that informed this plan. */
  readonly reasonCodes: readonly string[];
  /** True unless primaryAction is 'IMPOSSIBLE'. */
  readonly isRecoverable: boolean;
  /** Reason codes not found in the initial inventory; included for audit. */
  readonly unregisteredCodes: readonly string[];
};

/**
 * Pure function. Derives a RecoveryPlan from a withheld opportunity.
 *
 * CONTRACT: this function MUST NOT mutate any field of the input opportunity,
 * including finalDecision. The input is typed Readonly to enforce this at the
 * call site; deep-freeze is used in tests to catch accidental nested mutation.
 *
 * This function does not promote the item, reclassify it, or modify the queue.
 * Planning is separate from execution.
 */
export function planHeldRecovery(
  opportunity: Readonly<ClassifiedWorkbenchOpportunity>,
): RecoveryPlan {
  const allCodes: string[] = [
    ...(opportunity.executabilityReasons ?? []),
    ...(opportunity.preflightReasons ?? []),
    ...(opportunity.hydrationFailureReasons ?? []),
    ...(opportunity.resBlockerReasons ?? []),
  ];

  const uniqueCodes = Array.from(new Set(allCodes));
  const unregisteredCodes = uniqueCodes.filter((code) => lookupRegistryEntry(code) === undefined);
  const actions = Array.from(
    new Set(uniqueCodes.map((code) => lookupRecoveryAction(code))),
  ) as RecoveryAction[];

  const primary = primaryAction(actions.length > 0 ? actions : ['REQUEST_AUTHOR_INPUT']);

  return {
    opportunityId: opportunity.id,
    actions: actions.length > 0 ? actions : ['REQUEST_AUTHOR_INPUT'],
    primaryAction: primary,
    reasonCodes: uniqueCodes,
    isRecoverable: primary !== 'IMPOSSIBLE',
    unregisteredCodes,
  };
}
