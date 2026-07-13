import type {
  CopyPasteCardViewModel,
  StrategyCardUiViewModel,
  WithheldCardViewModel,
  WorkbenchCardViewModel,
} from './workbenchCardModels';

export const copyPastePresentationFixture: CopyPasteCardViewModel = {
  opportunityId: 'golden-copy-paste',
  cardType: 'copy_paste_rewrite',
  trustedPathStatus: 'eligible',
  severity: 'must',
  criterion: 'NARRATIVE_DRIVE',
  originalPassage: 'The river moved below them in a long sheet of grey.',
  evidenceLocation: 'Chapter 5, paragraph 1',
  candidates: [
    {
      key: 'A',
      label: 'Recommended repair',
      text: 'Below them, the river carried a long sheet of grey toward the bend.',
      rationale: 'Preserves the image while giving the sentence a clearer directional pull.',
    },
    {
      key: 'B',
      label: 'Rhythm variant',
      text: 'The river slid below them—grey, long, and unbroken to the bend.',
      rationale: 'Solves the same pacing issue with a more compressed cadence.',
    },
    {
      key: 'C',
      label: 'Bolder rendering shift',
      text: 'Far below, the river dragged its grey skin around the bend.',
      rationale: 'Uses a stronger image while preserving location and movement.',
    },
  ],
};

export const strategyPresentationFixture: StrategyCardUiViewModel = {
  opportunityId: 'golden-strategy',
  cardType: 'revision_strategy',
  trustedPathStatus: 'unavailable_author_review_required',
  severity: 'should',
  criterion: 'STRUCTURE',
  recommendedStrategy: 'Redistribute the historical explanation across the next two scenes instead of replacing this paragraph in isolation.',
  whyDirectCopyPasteUnsafe: 'The repair changes information order and character knowledge across multiple scenes.',
  evidenceAnchor: 'Chapter 5, paragraphs 1–4',
  implementationSequence: [
    'Keep one immediate grounding sentence in the current scene.',
    'Move policy history into the later council exchange.',
    'Return the remaining factual detail when the river crossing raises it naturally.',
  ],
  implementationApproaches: [
    'Conservative: retain the current paragraph but cut the second explanatory beat.',
    'Scene-based: distribute each fact where it becomes causally relevant.',
  ],
  authorDecisionRequired: 'Choose whether the current scene should prioritize geography or political history.',
  safeguards: ['Preserve the NV115 fact.', 'Do not alter the established travel sequence.'],
};

export const withheldPresentationFixture: WithheldCardViewModel = {
  opportunityId: 'golden-withheld',
  cardType: 'withheld',
  trustedPathStatus: 'impossible',
  severity: 'must',
  criterion: 'CONTINUITY',
  title: 'The relationship reference cannot be verified',
  holdReason: 'The available evidence conflicts with the manuscript relationship ledger.',
  missingContext: ['A confirmed relationship timeline', 'The surrounding scene transition'],
  recoveryAction: 'Confirm the relationship timeline, then request re-analysis.',
  evidenceAnchor: 'He called her by the name only his sister used.',
};

export const workbenchPresentationGoldenMaster: readonly WorkbenchCardViewModel[] = [
  copyPastePresentationFixture,
  strategyPresentationFixture,
  withheldPresentationFixture,
] as const;
