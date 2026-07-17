export type RecommendationCardType = 'copy_paste_rewrite' | 'revision_strategy' | 'withheld'

export type TrustedPathStatus =
  | 'eligible'
  | 'unavailable_author_review_required'
  | 'impossible'

export type PassageLength = 'short' | 'moderate' | 'long'

export type RecommendationExecutabilityInput = {
  evidencePresent: boolean
  contextPresent: boolean
  canonClear: boolean
  diagnosisSupported: boolean
  anchorPrecise: boolean
  passageLength: PassageLength
  beforeAfterContextSufficient: boolean
  ledgerConflictPossible: boolean
  canonConflict: boolean
  affectsSceneArchitecture: boolean
  affectsPOVVoiceCanonMetaphor: boolean
  downstreamContinuityRisk: boolean
  voiceFingerprintStable: boolean
  localOperation: boolean
  passingCandidateCount: number
  candidateProseNarrativeSafe: boolean
  // New admission-gate driven fields. When provided, they take precedence over the
  // coarser legacy fields (passingCandidateCount / candidateProseNarrativeSafe).
  copyPasteAdmissionPassed?: boolean
  copyPasteAdmissionReasons?: string[]
  strategyAdmissionPassed?: boolean
  strategyAdmissionReasons?: string[]
}

export type RecommendationExecutabilityDecision = {
  cardType: RecommendationCardType
  trustedPathStatus: TrustedPathStatus
  reasons: string[]
}

export const BASE_DECISION_REASON = {
  EVIDENCE_MISSING: 'evidence_missing',
  CONTEXT_MISSING: 'context_missing',
  CANON_UNCLEAR: 'canon_unclear',
  DIAGNOSIS_UNSUPPORTED: 'diagnosis_unsupported',
  ANCHOR_NOT_PRECISE: 'anchor_not_precise',
  PASSAGE_TOO_LONG: 'passage_too_long',
  INSUFFICIENT_BEFORE_AFTER_CONTEXT: 'insufficient_before_after_context',
  LEDGER_CONFLICT_POSSIBLE: 'ledger_conflict_possible',
  CANON_CONFLICT: 'canon_conflict',
  SCENE_ARCHITECTURE_CHANGE: 'scene_architecture_change',
  POV_VOICE_CANON_OR_METAPHOR_RISK: 'pov_voice_canon_or_metaphor_risk',
  DOWNSTREAM_CONTINUITY_RISK: 'downstream_continuity_risk',
  VOICE_FINGERPRINT_UNSTABLE: 'voice_fingerprint_unstable',
  NOT_LOCAL_OPERATION: 'not_local_operation',
  COPY_PASTE_ADMISSION_FAILED: 'copy_paste_admission_failed',
  FEWER_THAN_TWO_CANDIDATES_PASSED_QUALITY: 'fewer_than_two_candidates_passed_quality',
  CANDIDATE_PROSE_NOT_NARRATIVELY_SAFE: 'candidate_prose_not_narratively_safe',
  STRATEGY_ADMISSION_FAILED: 'strategy_admission_failed',
  SAFE_LOCAL_COPY_PASTE_REWRITE: 'safe_local_copy_paste_rewrite',
} as const;

export type BaseDecisionReasonCode =
  (typeof BASE_DECISION_REASON)[keyof typeof BASE_DECISION_REASON];

export const BASE_DECISION_LOCAL_REASON_CODES: BaseDecisionReasonCode[] = Object.values(BASE_DECISION_REASON);

export type StrategyCardIllustrativeExample = {
  key: 'A' | 'B' | 'C'
  label: string
  text: string
}

export type StrategyCardViewModel = {
  scaffold: StrategyCardScaffold
  illustrativeExamples: StrategyCardIllustrativeExample[]
}

export type StrategyCardScaffold = {
  cardNumber: string
  cardType: 'Strategy Card'
  trustedPathStatus: 'Unavailable — author review required'
  reasonCopyPasteIsUnsafe: string
  ledgerReference: string
  evidenceAnchor: string
  conservativeApproach: string
  moderateApproach: string
  boldApproach: string
  authorDecisionRequired: string
}

const MIN_PASSING_CANDIDATES_FOR_COPY_PASTE = 2

export function evaluateRecommendationExecutability(
  input: RecommendationExecutabilityInput,
): RecommendationExecutabilityDecision {
  const withholdReasons: string[] = []

  if (!input.evidencePresent) withholdReasons.push(BASE_DECISION_REASON.EVIDENCE_MISSING)
  if (!input.contextPresent) withholdReasons.push(BASE_DECISION_REASON.CONTEXT_MISSING)
  if (!input.canonClear) withholdReasons.push(BASE_DECISION_REASON.CANON_UNCLEAR)
  if (!input.diagnosisSupported) withholdReasons.push(BASE_DECISION_REASON.DIAGNOSIS_UNSUPPORTED)

  if (withholdReasons.length > 0) {
    return {
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      reasons: Array.from(new Set(withholdReasons)),
    }
  }

  const unsafeCopyPasteReasons: string[] = []
  const copyPasteAdmissionProvided = typeof input.copyPasteAdmissionPassed === 'boolean'

  if (!input.anchorPrecise) unsafeCopyPasteReasons.push(BASE_DECISION_REASON.ANCHOR_NOT_PRECISE)
  if (input.passageLength === 'long') unsafeCopyPasteReasons.push(BASE_DECISION_REASON.PASSAGE_TOO_LONG)
  if (!input.beforeAfterContextSufficient && !input.copyPasteAdmissionReasons?.includes('insufficient_before_after_context')) {
    unsafeCopyPasteReasons.push(BASE_DECISION_REASON.INSUFFICIENT_BEFORE_AFTER_CONTEXT)
  }
  if (input.ledgerConflictPossible) unsafeCopyPasteReasons.push(BASE_DECISION_REASON.LEDGER_CONFLICT_POSSIBLE)
  if (input.canonConflict) unsafeCopyPasteReasons.push(BASE_DECISION_REASON.CANON_CONFLICT)
  if (input.affectsSceneArchitecture) unsafeCopyPasteReasons.push(BASE_DECISION_REASON.SCENE_ARCHITECTURE_CHANGE)
  if (input.affectsPOVVoiceCanonMetaphor) unsafeCopyPasteReasons.push(BASE_DECISION_REASON.POV_VOICE_CANON_OR_METAPHOR_RISK)
  if (input.downstreamContinuityRisk) unsafeCopyPasteReasons.push(BASE_DECISION_REASON.DOWNSTREAM_CONTINUITY_RISK)
  if (!input.voiceFingerprintStable) unsafeCopyPasteReasons.push(BASE_DECISION_REASON.VOICE_FINGERPRINT_UNSTABLE)
  if (!input.localOperation && !input.copyPasteAdmissionReasons?.includes('not_local_operation')) {
    unsafeCopyPasteReasons.push(BASE_DECISION_REASON.NOT_LOCAL_OPERATION)
  }

  if (copyPasteAdmissionProvided) {
    if (!input.copyPasteAdmissionPassed) {
      unsafeCopyPasteReasons.push(BASE_DECISION_REASON.COPY_PASTE_ADMISSION_FAILED)
      if (input.copyPasteAdmissionReasons) {
        unsafeCopyPasteReasons.push(...input.copyPasteAdmissionReasons)
      }
    }
  } else {
    if (input.passingCandidateCount < MIN_PASSING_CANDIDATES_FOR_COPY_PASTE) {
      unsafeCopyPasteReasons.push(BASE_DECISION_REASON.FEWER_THAN_TWO_CANDIDATES_PASSED_QUALITY)
    }
    if (!input.candidateProseNarrativeSafe) unsafeCopyPasteReasons.push(BASE_DECISION_REASON.CANDIDATE_PROSE_NOT_NARRATIVELY_SAFE)
  }

  if (unsafeCopyPasteReasons.length > 0) {
    // A strategy-card fallback is only safe if the strategy admission gate also
    // thinks the recommendation is defensible. If strategy admission failed, the
    // card is withheld instead of being shown as a review-only strategy.
    if (input.strategyAdmissionPassed === false) {
      const strategyReasons = input.strategyAdmissionReasons?.length
        ? [BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED, ...input.strategyAdmissionReasons]
        : [BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED]
      return {
        cardType: 'withheld',
        trustedPathStatus: 'impossible',
        reasons: Array.from(new Set([...unsafeCopyPasteReasons, ...strategyReasons])),
      }
    }

    return {
      cardType: 'revision_strategy',
      trustedPathStatus: 'unavailable_author_review_required',
      reasons: Array.from(new Set(unsafeCopyPasteReasons)),
    }
  }

  return {
    cardType: 'copy_paste_rewrite',
    trustedPathStatus: 'eligible',
    reasons: [BASE_DECISION_REASON.SAFE_LOCAL_COPY_PASTE_REWRITE],
  }
}

export function buildStrategyCardScaffold(input: {
  cardNumber: string
  reasonCopyPasteIsUnsafe: string
  ledgerReference: string
  evidenceAnchor: string
  conservativeApproach: string
  moderateApproach: string
  boldApproach: string
  authorDecisionRequired: string
}): StrategyCardScaffold {
  return {
    cardNumber: input.cardNumber,
    cardType: 'Strategy Card',
    trustedPathStatus: 'Unavailable — author review required',
    reasonCopyPasteIsUnsafe: input.reasonCopyPasteIsUnsafe,
    ledgerReference: input.ledgerReference,
    evidenceAnchor: input.evidenceAnchor,
    conservativeApproach: input.conservativeApproach,
    moderateApproach: input.moderateApproach,
    boldApproach: input.boldApproach,
    authorDecisionRequired: input.authorDecisionRequired,
  }
}
