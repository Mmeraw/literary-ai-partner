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
  recommendedRepair: string
  rhythmCadenceAlternative: string
  boldStructuralChoice: string
  authorDecisionRequired: string
}

const MIN_PASSING_CANDIDATES_FOR_COPY_PASTE = 2

export function evaluateRecommendationExecutability(
  input: RecommendationExecutabilityInput,
): RecommendationExecutabilityDecision {
  const withholdReasons: string[] = []

  if (!input.evidencePresent) withholdReasons.push('evidence_missing')
  if (!input.contextPresent) withholdReasons.push('context_missing')
  if (!input.canonClear) withholdReasons.push('canon_unclear')
  if (!input.diagnosisSupported) withholdReasons.push('diagnosis_unsupported')

  if (withholdReasons.length > 0) {
    return {
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      reasons: Array.from(new Set(withholdReasons)),
    }
  }

  const unsafeCopyPasteReasons: string[] = []
  const copyPasteAdmissionProvided = typeof input.copyPasteAdmissionPassed === 'boolean'

  if (!input.anchorPrecise) unsafeCopyPasteReasons.push('anchor_not_precise')
  if (input.passageLength === 'long') unsafeCopyPasteReasons.push('passage_too_long')
  if (!input.beforeAfterContextSufficient && !input.copyPasteAdmissionReasons?.includes('insufficient_before_after_context')) {
    unsafeCopyPasteReasons.push('insufficient_before_after_context')
  }
  if (input.ledgerConflictPossible) unsafeCopyPasteReasons.push('ledger_conflict_possible')
  if (input.canonConflict) unsafeCopyPasteReasons.push('canon_conflict')
  if (input.affectsSceneArchitecture) unsafeCopyPasteReasons.push('scene_architecture_change')
  if (input.affectsPOVVoiceCanonMetaphor) unsafeCopyPasteReasons.push('pov_voice_canon_or_metaphor_risk')
  if (input.downstreamContinuityRisk) unsafeCopyPasteReasons.push('downstream_continuity_risk')
  if (!input.voiceFingerprintStable) unsafeCopyPasteReasons.push('voice_fingerprint_unstable')
  if (!input.localOperation && !input.copyPasteAdmissionReasons?.includes('not_local_operation')) {
    unsafeCopyPasteReasons.push('not_local_operation')
  }

  if (copyPasteAdmissionProvided) {
    if (!input.copyPasteAdmissionPassed) {
      unsafeCopyPasteReasons.push('copy_paste_admission_failed')
      if (input.copyPasteAdmissionReasons) {
        unsafeCopyPasteReasons.push(...input.copyPasteAdmissionReasons)
      }
    }
  } else {
    if (input.passingCandidateCount < MIN_PASSING_CANDIDATES_FOR_COPY_PASTE) {
      unsafeCopyPasteReasons.push('fewer_than_two_candidates_passed_quality')
    }
    if (!input.candidateProseNarrativeSafe) unsafeCopyPasteReasons.push('candidate_prose_not_narratively_safe')
  }

  if (unsafeCopyPasteReasons.length > 0) {
    // A strategy-card fallback is only safe if the strategy admission gate also
    // thinks the recommendation is defensible. If strategy admission failed, the
    // card is withheld instead of being shown as a review-only strategy.
    if (input.strategyAdmissionPassed === false) {
      const strategyReasons = input.strategyAdmissionReasons?.length
        ? ['strategy_admission_failed', ...input.strategyAdmissionReasons]
        : ['strategy_admission_failed']
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
    reasons: ['safe_local_copy_paste_rewrite'],
  }
}

export function buildStrategyCardScaffold(input: {
  cardNumber: string
  reasonCopyPasteIsUnsafe: string
  ledgerReference: string
  evidenceAnchor: string
  recommendedRepair: string
  rhythmCadenceAlternative: string
  boldStructuralChoice: string
  authorDecisionRequired: string
}): StrategyCardScaffold {
  return {
    cardNumber: input.cardNumber,
    cardType: 'Strategy Card',
    trustedPathStatus: 'Unavailable — author review required',
    reasonCopyPasteIsUnsafe: input.reasonCopyPasteIsUnsafe,
    ledgerReference: input.ledgerReference,
    evidenceAnchor: input.evidenceAnchor,
    recommendedRepair: input.recommendedRepair,
    rhythmCadenceAlternative: input.rhythmCadenceAlternative,
    boldStructuralChoice: input.boldStructuralChoice,
    authorDecisionRequired: input.authorDecisionRequired,
  }
}
