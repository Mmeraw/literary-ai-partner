import {
  revisionCandidateHash,
  revisionOpportunityVersion,
} from '@/lib/revision/decisionAuthorityIdentity';

const BASE = {
  id: 'opp-1',
  sourceUedHash: 'ued-hash-1',
  sourceOpportunityId: 'source-opp-1',
  sourceCriterion: 'PACING',
  sourceExcerpt: 'Alpha original safe.',
  sourceLocation: 'chapter 1',
  cardType: 'copy_paste_rewrite',
  trustedPathStatus: 'eligible',
  options: [
    { key: 'A', candidateText: 'Alpha repaired A.', text: 'Alpha repaired A.' },
    { key: 'B', candidateText: 'Alpha repaired B.', text: 'Alpha repaired B.' },
    { key: 'C', candidateText: 'Alpha repaired C.', text: 'Alpha repaired C.' },
  ],
};

function version(overrides: Partial<typeof BASE> = {}) {
  return revisionOpportunityVersion({
    ...BASE,
    ...overrides,
  });
}

describe('revision decision authority identity', () => {
  it('keeps opportunity version stable when candidate array order changes but slots and content do not', () => {
    const reordered = [BASE.options[2], BASE.options[0], BASE.options[1]];

    expect(version({ options: reordered })).toBe(version());
  });

  it.each([
    ['candidate B text changes', { options: [BASE.options[0], { key: 'B', candidateText: 'Alpha rebuilt B.', text: 'Alpha rebuilt B.' }, BASE.options[2]] }],
    ['candidate B and C swap slots', { options: [BASE.options[0], { key: 'B', candidateText: BASE.options[2].candidateText, text: BASE.options[2].text }, { key: 'C', candidateText: BASE.options[1].candidateText, text: BASE.options[1].text }] }],
    ['candidate C is removed', { options: [BASE.options[0], BASE.options[1]] }],
    ['candidate C is added', { options: [BASE.options[0], BASE.options[1], { key: 'C', candidateText: 'New candidate C.', text: 'New candidate C.' }] }],
    ['source excerpt changes', { sourceExcerpt: 'Alpha source passage changed.' }],
    ['source location changes', { sourceLocation: 'chapter 2' }],
    ['source UED hash changes', { sourceUedHash: 'ued-hash-2' }],
    ['card type changes', { cardType: 'revision_strategy' }],
    ['trusted path status changes', { trustedPathStatus: 'unavailable_author_review_required' }],
  ])('invalidates opportunity version when %s', (_case, overrides) => {
    expect(version(overrides as Partial<typeof BASE>)).not.toBe(version());
  });

  it('binds candidate hash to slot as well as candidate text and source identity', () => {
    const candidateText = 'Identical candidate prose.';

    const slotB = revisionCandidateHash({
      opportunityId: BASE.id,
      candidateSlot: 'B',
      candidateText,
      sourceUedHash: BASE.sourceUedHash,
      sourceOpportunityId: BASE.sourceOpportunityId,
      sourceCriterion: BASE.sourceCriterion,
    });
    const slotC = revisionCandidateHash({
      opportunityId: BASE.id,
      candidateSlot: 'C',
      candidateText,
      sourceUedHash: BASE.sourceUedHash,
      sourceOpportunityId: BASE.sourceOpportunityId,
      sourceCriterion: BASE.sourceCriterion,
    });

    expect(slotB).not.toBe(slotC);
  });
});
