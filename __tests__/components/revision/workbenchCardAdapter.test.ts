import { adaptWorkbenchOpportunityToCard } from '@/components/revision/workbenchCardAdapter';
import type { WorkbenchOpportunity } from '@/lib/revision/workbenchQueue';
import type { ClassifiedWorkbenchOpportunity } from '@/lib/revision/workbenchQueueProjection';
import { buildClassifiedWorkbenchOpportunity, classifyWorkbenchExecutabilityDetailed } from '@/lib/revision/workbenchQueueProjection';

function makeOpportunity(overrides: Partial<WorkbenchOpportunity> = {}): WorkbenchOpportunity {
  return {
    id: 'opp-1', severity: 'must', scope: 'Passage', mode: 'direct-rewrite', source: 'evaluation',
    criterion: 'TONE', leverage: 'Evaluation', crumb: 'TONE · passage:1', title: 'Tone opportunity',
    issueStatement: 'Tone opportunity', meta: 'TONE · passage:1', confidence: 'high confidence',
    anchor: 'passage:1', quoteHighlight: 'The river moved slowly.', quoteRest: '',
    symptom: 'The sentence is flat.', cause: 'The verb is abstract.', fixDirection: 'Use a concrete verb.',
    readerEffect: 'The moment becomes immediate.', mistakeProofing: 'Do not invent new facts.',
    diagnostic: {
      symptom: 'The sentence is flat.', cause: 'The verb is abstract.', fixStrategy: 'Use a concrete verb.',
      readerImpact: 'The moment becomes immediate.',
      evidence: { quotedExcerpt: 'The river moved slowly.', locationLabel: 'passage:1' },
      operationTargeting: 'Passage · passage:1', mistakeProofing: 'Do not invent new facts.',
    },
    revisionOperation: 'replace_selected_passage', readiness: 'ready_for_revise', readinessReason: null,
    cardType: 'copy_paste_rewrite', trustedPathStatus: 'eligible',
    options: [
      { key: 'A', mechanism: 'Recommended repair', candidateText: 'The river slid past the stones.', text: 'The river slid past the stones.', rationale: 'Safest.' },
      { key: 'B', mechanism: 'Rhythm variant', candidateText: 'Past the stones, the river slid.', text: 'Past the stones, the river slid.', rationale: 'Cadence.' },
      { key: 'C', mechanism: 'Bolder rendering shift', candidateText: 'The river shouldered through the stones.', text: 'The river shouldered through the stones.', rationale: 'Bolder.' },
    ],
    ...overrides,
  } as WorkbenchOpportunity;
}

function makeClassified(
  overrides: Partial<WorkbenchOpportunity> = {},
  finalCardType: ClassifiedWorkbenchOpportunity['finalDecision']['cardType'] = 'copy_paste_rewrite',
): ClassifiedWorkbenchOpportunity {
  const opportunity = makeOpportunity(overrides);

  const finalDecision =
    finalCardType === 'copy_paste_rewrite'
      ? {
          cardType: 'copy_paste_rewrite' as const,
          trustedPathStatus: 'eligible' as const,
          reasons: ['safe_local_copy_paste_rewrite'],
        }
      : finalCardType === 'revision_strategy'
        ? {
            cardType: 'revision_strategy' as const,
            trustedPathStatus: 'unavailable_author_review_required' as const,
            reasons: ['insufficient_before_after_context'],
          }
        : {
            cardType: 'withheld' as const,
            trustedPathStatus: 'impossible' as const,
            reasons: ['canon_unclear'],
          };

  return {
    ...opportunity,
    cardType: finalDecision.cardType,
    trustedPathStatus: finalDecision.trustedPathStatus,
    executabilityReasons: [...finalDecision.reasons],
    classification: {
      cardType: finalDecision.cardType,
      trustedPathStatus: finalDecision.trustedPathStatus,
      reasons: [...finalDecision.reasons],
      strategyCardViewModel: opportunity.strategyCardViewModel ?? null,
      copyPasteAdmissionPassed: finalDecision.cardType === 'copy_paste_rewrite',
      copyPasteAdmissionReasons: [],
      strategyAdmissionPassed: finalDecision.cardType !== 'withheld',
      strategyAdmissionReasons: [],
      baseDecision: finalDecision,
      finalDecision,
      needsTargetingPromotionApplied: false,
      promotionTransitionReason: null,
      gates: {
        copyPaste: { decision: 'ready', passed: true, reasons: [], passedCandidateCount: 3 },
        strategy: { decision: 'ready', passed: true, reasons: [] },
      },
      needsTargetingOverrideApplied: false,
    },
    baseDecision: finalDecision,
    finalDecision,
  };
}

describe('adaptWorkbenchOpportunityToCard', () => {
  it('requires exactly three candidates for copy-paste presentation', () => {
    const result = adaptWorkbenchOpportunityToCard(makeClassified());
    expect(result.cardType).toBe('copy_paste_rewrite');
    if (result.cardType !== 'copy_paste_rewrite') throw new Error('wrong card type');
    expect(result.candidates.map((candidate) => candidate.key)).toEqual(['A', 'B', 'C']);
  });

  it('emits one recommended strategy and one optional illustration', () => {
    const classified = makeClassified({
      evidenceLocationScope: 'Passage',
      repairScope: 'Structural',
      fixDirection: 'Redistribute the context into dialogue across the scene sequence.',
      strategyCardViewModel: {
        scaffold: {
          cardNumber: 'Passage · TONE', cardType: 'Strategy Card',
          trustedPathStatus: 'Unavailable — author review required',
          reasonCopyPasteIsUnsafe: 'Multi-scene repair', ledgerReference: 'opp-1',
          evidenceAnchor: 'Chapter 5, paragraph 1', conservativeApproach: 'Keep one grounding beat.',
          moderateApproach: 'Legacy middle wording.', boldApproach: 'Rebuild the section.',
          authorDecisionRequired: 'Choose how much history remains here.',
        },
        illustrativeExamples: [
          { key: 'A', label: 'Example one', text: 'Illustrative only.' },
          { key: 'B', label: 'Example two', text: 'Another illustration.' },
        ],
      },
    }, 'revision_strategy');
    const result = adaptWorkbenchOpportunityToCard(classified);
    expect(result.cardType).toBe('revision_strategy');
    if (result.cardType !== 'revision_strategy') throw new Error('wrong card type');
    expect(result.recommendedStrategy).toMatch(/Redistribute/i);
    expect(result.implementationApproaches).toBeUndefined();
    expect(result.implementationSequence).toHaveLength(3);
    expect(result.illustrativeExample?.text).toBe('Illustrative only.');
    expect('candidates' in result).toBe(false);
  });

  it('maps withheld reasons to a held summary instead of candidate prose', () => {
    const result = adaptWorkbenchOpportunityToCard(makeClassified({
      executabilityReasons: ['canon_unclear'], preflightReasons: ['blocked_context'],
    }, 'withheld'));
    expect(result.cardType).toBe('withheld');
    if (result.cardType !== 'withheld') throw new Error('wrong card type');
    expect(result.holdReason).toMatch(/canon_unclear/);
    expect('candidates' in result).toBe(false);
  });

  it('follows finalDecision.cardType when mirrored raw cardType is contradictory', () => {
    const opportunity = makeOpportunity({
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      readiness: 'needs_targeting',
      contextQuality: 'limited',
      preflightStatus: 'limited_context',
      groundingStatus: 'supported',
    });
    const classification = classifyWorkbenchExecutabilityDetailed(opportunity);
    const classified = {
      ...buildClassifiedWorkbenchOpportunity(opportunity, classification),
      cardType: 'withheld' as const,
      trustedPathStatus: 'impossible' as const,
      finalDecision: {
        cardType: 'revision_strategy' as const,
        trustedPathStatus: 'unavailable_author_review_required' as const,
        reasons: ['stale_raw_cardtype_should_be_ignored'],
      },
    } as ClassifiedWorkbenchOpportunity;

    const result = adaptWorkbenchOpportunityToCard(classified);

    expect(result.cardType).toBe('revision_strategy');
    expect(result.trustedPathStatus).toBe('unavailable_author_review_required');
    expect('holdReason' in result).toBe(false);
    expect('candidates' in result).toBe(false);
  });
});
