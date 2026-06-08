import {
  buildStrategyCardScaffold,
  evaluateRecommendationExecutability,
  type RecommendationExecutabilityInput,
} from '@/lib/revision/recommendationExecutability'

const safeInput: RecommendationExecutabilityInput = {
  evidencePresent: true,
  contextPresent: true,
  canonClear: true,
  diagnosisSupported: true,
  anchorPrecise: true,
  passageLength: 'moderate',
  beforeAfterContextSufficient: true,
  ledgerConflictPossible: false,
  canonConflict: false,
  affectsSceneArchitecture: false,
  affectsPOVVoiceCanonMetaphor: false,
  downstreamContinuityRisk: false,
  voiceFingerprintStable: true,
  localOperation: true,
  passingCandidateCount: 2,
  candidateProseNarrativeSafe: true,
}

describe('recommendation executability standard', () => {
  it('admits safe local repairs as copy-paste rewrite cards eligible for TrustedPath', () => {
    expect(evaluateRecommendationExecutability(safeInput)).toEqual({
      cardType: 'copy_paste_rewrite',
      trustedPathStatus: 'eligible',
      reasons: ['safe_local_copy_paste_rewrite'],
    })
  })

  it('routes unsafe copy-paste repairs to strategy cards instead of fake prose', () => {
    const decision = evaluateRecommendationExecutability({
      ...safeInput,
      affectsSceneArchitecture: true,
      downstreamContinuityRisk: true,
    })

    expect(decision.cardType).toBe('revision_strategy')
    expect(decision.trustedPathStatus).toBe('unavailable_author_review_required')
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'scene_architecture_change',
      'downstream_continuity_risk',
    ]))
  })

  it('withholds unsupported diagnoses instead of exposing them to the user queue', () => {
    const decision = evaluateRecommendationExecutability({
      ...safeInput,
      evidencePresent: false,
      diagnosisSupported: false,
    })

    expect(decision.cardType).toBe('withheld')
    expect(decision.trustedPathStatus).toBe('impossible')
    expect(decision.reasons).toEqual(expect.arrayContaining(['evidence_missing', 'diagnosis_unsupported']))
  })

  it('requires at least two passing candidates before copy-paste prose is executable', () => {
    const decision = evaluateRecommendationExecutability({
      ...safeInput,
      passingCandidateCount: 1,
    })

    expect(decision.cardType).toBe('revision_strategy')
    expect(decision.reasons).toContain('fewer_than_two_candidates_passed_quality')
  })

  it('builds the required Strategy Card scaffold with ledger and author-decision fields', () => {
    expect(buildStrategyCardScaffold({
      cardNumber: '12 of 47',
      reasonCopyPasteIsUnsafe: 'The repair affects downstream continuity.',
      ledgerReference: 'Accepted Story Ledger: INSITE is metaphor, not literal narrator.',
      evidenceAnchor: 'Chapter 2, scene threshold beat',
      recommendedRepair: 'Clarify the symbolic function before changing prose.',
      rhythmCadenceAlternative: 'Preserve the existing cadence but reduce explanatory drag.',
      boldStructuralChoice: 'Move the revelation later, with a setup/payoff tradeoff.',
      authorDecisionRequired: 'Choose whether this beat should clarify now or remain withheld.',
    })).toEqual({
      cardNumber: '12 of 47',
      cardType: 'Strategy Card',
      trustedPathStatus: 'Unavailable — author review required',
      reasonCopyPasteIsUnsafe: 'The repair affects downstream continuity.',
      ledgerReference: 'Accepted Story Ledger: INSITE is metaphor, not literal narrator.',
      evidenceAnchor: 'Chapter 2, scene threshold beat',
      recommendedRepair: 'Clarify the symbolic function before changing prose.',
      rhythmCadenceAlternative: 'Preserve the existing cadence but reduce explanatory drag.',
      boldStructuralChoice: 'Move the revelation later, with a setup/payoff tradeoff.',
      authorDecisionRequired: 'Choose whether this beat should clarify now or remain withheld.',
    })
  })
})
