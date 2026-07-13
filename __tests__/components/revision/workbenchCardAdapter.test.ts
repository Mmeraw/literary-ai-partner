import { adaptWorkbenchOpportunityToCard } from '@/components/revision/workbenchCardAdapter';
import type { WorkbenchOpportunity } from '@/lib/revision/workbenchQueue';

function makeOpportunity(overrides: Partial<WorkbenchOpportunity> = {}): WorkbenchOpportunity {
  return {
    id: 'opp-1',
    severity: 'must',
    scope: 'Passage',
    mode: 'direct-rewrite',
    source: 'evaluation',
    criterion: 'TONE',
    leverage: 'Evaluation',
    crumb: 'TONE · passage:1',
    title: 'Tone opportunity',
    issueStatement: 'Tone opportunity',
    meta: 'TONE · passage:1',
    confidence: 'high confidence',
    anchor: 'passage:1',
    quoteHighlight: 'The river moved slowly.',
    quoteRest: '',
    symptom: 'The sentence is flat.',
    cause: 'The verb is abstract.',
    fixDirection: 'Use a concrete verb.',
    readerEffect: 'The moment becomes immediate.',
    mistakeProofing: 'Do not invent new facts.',
    diagnostic: {
      symptom: 'The sentence is flat.',
      cause: 'The verb is abstract.',
      fixStrategy: 'Use a concrete verb.',
      readerImpact: 'The moment becomes immediate.',
      evidence: { quotedExcerpt: 'The river moved slowly.', locationLabel: 'passage:1' },
      operationTargeting: 'Passage · passage:1',
      mistakeProofing: 'Do not invent new facts.',
    },
    revisionOperation: 'replace_selected_passage',
    readiness: 'ready_for_revise',
    readinessReason: null,
    cardType: 'copy_paste_rewrite',
    trustedPathStatus: 'eligible',
    options: [
      { key: 'A', mechanism: 'Recommended repair', candidateText: 'The river slid past the stones.', text: 'The river slid past the stones.', rationale: 'Safest.' },
      { key: 'B', mechanism: 'Rhythm variant', candidateText: 'Past the stones, the river slid.', text: 'Past the stones, the river slid.', rationale: 'Cadence.' },
      { key: 'C', mechanism: 'Bolder rendering shift', candidateText: 'The river shouldered through the stones.', text: 'The river shouldered through the stones.', rationale: 'Bolder.' },
    ],
    ...overrides,
  } as WorkbenchOpportunity;
}

describe('adaptWorkbenchOpportunityToCard', () => {
  it('requires exactly three candidates for copy-paste presentation', () => {
    const result = adaptWorkbenchOpportunityToCard(makeOpportunity());
    expect(result.cardType).toBe('copy_paste_rewrite');
    if (result.cardType !== 'copy_paste_rewrite') throw new Error('wrong card type');
    expect(result.candidates.map((candidate) => candidate.key)).toEqual(['A', 'B', 'C']);
  });

  it('does not carry A/B/C semantics into a strategy card', () => {
    const result = adaptWorkbenchOpportunityToCard(makeOpportunity({
      cardType: 'revision_strategy',
      trustedPathStatus: 'unavailable_author_review_required',
      strategyCardViewModel: {
        scaffold: {
          cardNumber: 'Passage · TONE',
          cardType: 'Strategy Card',
          trustedPathStatus: 'Unavailable — author review required',
          reasonCopyPasteIsUnsafe: 'Multi-scene repair',
          ledgerReference: 'opp-1',
          evidenceAnchor: 'Chapter 5, paragraph 1',
          conservativeApproach: 'Keep one grounding beat.',
          moderateApproach: 'Redistribute the policy context into dialogue.',
          boldApproach: 'Rebuild the section around scene-based discovery.',
          authorDecisionRequired: 'Choose how much history remains here.',
        },
        illustrativeExamples: [
          { key: 'A', label: 'Recommended repair', text: 'Illustrative only.' },
        ],
      },
    }));
    expect(result.cardType).toBe('revision_strategy');
    if (result.cardType !== 'revision_strategy') throw new Error('wrong card type');
    expect(result.recommendedStrategy).toMatch(/Redistribute/i);
    expect('candidates' in result).toBe(false);
  });

  it('maps withheld reasons to a held summary instead of candidate prose', () => {
    const result = adaptWorkbenchOpportunityToCard(makeOpportunity({
      cardType: 'withheld',
      trustedPathStatus: 'impossible',
      executabilityReasons: ['canon_unclear'],
      preflightReasons: ['blocked_context'],
    }));
    expect(result.cardType).toBe('withheld');
    if (result.cardType !== 'withheld') throw new Error('wrong card type');
    expect(result.holdReason).toMatch(/canon_unclear/);
    expect('candidates' in result).toBe(false);
  });
});
