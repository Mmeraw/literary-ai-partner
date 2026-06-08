import { evaluateCardCandidateQuality, evaluateCandidateQuality } from '../../../lib/revision/candidateQuality';

describe('candidateQuality', () => {
  it('blocks generic literary filler', () => {
    const result = evaluateCandidateQuality({ key: 'A', text: 'The silence stretched until the room seemed smaller.' });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('GENERIC_PROSE');
  });

  it('blocks commentary instead of manuscript prose', () => {
    const result = evaluateCandidateQuality({ key: 'A', text: 'This revision should improve the scene by adding tension.' });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('NON_EXECUTABLE_PROSE');
  });

  it('requires at least two passing candidates for a card', () => {
    const result = evaluateCardCandidateQuality([
      { key: 'A', text: 'The silence stretched until the room seemed smaller.' },
      { key: 'B', text: 'He placed the cup beside the ledger and waited for her answer.' },
      { key: 'C', text: 'Here is a rewrite that makes the moment stronger.' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('REVISION_QUALITY_FAILED');
  });
});
