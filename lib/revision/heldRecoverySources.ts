/**
 * Held Recovery Sources
 *
 * Code-derived registry of where held-reason information originates in the
 * production pipeline. This module is read-only and does not plan repairs.
 */

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
  | 'grounding_note'
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
 * `grounding_note` and `executability` are non-authoritative annotations.
 */
export const HELD_REASON_SOURCE_REGISTRY: HeldReasonSourceRegistryEntry[] = [
  {
    source: 'grounding',
    canonicalField: 'groundingStatus',
    producer: 'lib/revision/workbenchQueue.ts (SLAE evidence matching) and lib/revision/opportunityLedger.ts (hydration fallback)',
    phase: 'queue_construction',
    authoritativeForRecoveryPlanning: true,
    authoritativeForRouting: false,
    mayContainDuplicates: false,
  },
  {
    source: 'grounding_note',
    canonicalField: 'groundingNote',
    producer: 'lib/revision/opportunityLedger.ts (preflight block notes and admin annotations)',
    phase: 'queue_construction',
    authoritativeForRecoveryPlanning: false,
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
