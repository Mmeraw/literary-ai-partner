import {
  ADMISSION_CANDIDATE_QUALITY_REASON,
  ADMISSION_CANDIDATE_QUALITY_REASON_CODES,
  evaluateCandidateQuality,
  evaluateCardCandidateQuality,
  type CandidateQualityInput,
} from '@/lib/revision/candidateQuality';

describe('candidate quality admission reason-code parity', () => {
  it('emits every exported admission candidate-quality reason code from at least one fixture', () => {
    const observed = new Set<string>();

    const empty = evaluateCandidateQuality({ key: 'A', text: '' });
    expect(empty.passed).toBe(false);
    empty.reasons.forEach((r) => observed.add(r));

    const short = evaluateCandidateQuality({ key: 'A', text: 'a b c d e f' });
    expect(short.passed).toBe(false);
    short.reasons.forEach((r) => observed.add(r));

    const generic = evaluateCandidateQuality({ key: 'A', text: 'The silence stretched.' });
    expect(generic.passed).toBe(false);
    generic.reasons.forEach((r) => observed.add(r));

    const commentary = evaluateCandidateQuality({
      key: 'A',
      text: "This revision will make the passage stronger because it clarifies the scene.",
    });
    expect(commentary.passed).toBe(false);
    commentary.reasons.forEach((r) => observed.add(r));

    const notExecutable = evaluateCandidateQuality({
      key: 'A',
      text: '[INSERT better scene here]',
    });
    expect(notExecutable.passed).toBe(false);
    notExecutable.reasons.forEach((r) => observed.add(r));

    const anchorEcho = evaluateCandidateQuality({
      key: 'A',
      text: 'The old oak tree stood in the clearing.',
      anchor: 'The old oak tree stood in the clearing.',
    });
    expect(anchorEcho.passed).toBe(false);
    anchorEcho.reasons.forEach((r) => observed.add(r));

    const unsupportedFact = evaluateCandidateQuality({
      key: 'A',
      text: 'Voldemort appeared.',
      knownEntities: ['Harry'],
    });
    expect(unsupportedFact.passed).toBe(false);
    unsupportedFact.reasons.forEach((r) => observed.add(r));

    const contextMismatch = evaluateCandidateQuality({
      key: 'A',
      text: Array.from({ length: 30 }, (_, i) => `word${i}`).join(' '),
      beforeContext: 'abc def ghi jkl mno pqr stu vwx yz1 23a bcd efg',
    });
    expect(contextMismatch.passed).toBe(false);
    contextMismatch.reasons.forEach((r) => observed.add(r));

    const card = evaluateCardCandidateQuality([
      { key: 'A', text: '' },
      { key: 'B', text: 'a b c' },
      { key: 'C', text: 'the silence stretched' },
    ]);
    expect(card.passed).toBe(false);
    card.reasons.forEach((r) => observed.add(r));

    expect(new Set(observed)).toEqual(new Set(ADMISSION_CANDIDATE_QUALITY_REASON_CODES));
  });

  it('only returns reasons contained in the exported admission code set', () => {
    const inputs: CandidateQualityInput[] = [
      { key: 'A', text: '' },
      { key: 'B', text: 'the silence stretched' },
      { key: 'C', text: '[INSERT]' },
    ];
    const result = evaluateCardCandidateQuality(inputs);
    expect(result.reasons.length).toBeGreaterThan(0);
    for (const reason of result.reasons) {
      expect(ADMISSION_CANDIDATE_QUALITY_REASON_CODES).toContain(reason);
    }
  });

  it('uses the exact exported constants so the set cannot drift from the emitter', () => {
    expect(ADMISSION_CANDIDATE_QUALITY_REASON.EMPTY_CANDIDATE).toBe('EMPTY_CANDIDATE');
    expect(ADMISSION_CANDIDATE_QUALITY_REASON.REVISION_QUALITY_FAILED).toBe('REVISION_QUALITY_FAILED');
    expect(ADMISSION_CANDIDATE_QUALITY_REASON_CODES.sort()).toEqual([
      'ANCHOR_ECHO',
      'CONTEXT_MISMATCH',
      'EMPTY_CANDIDATE',
      'GENERIC_PROSE',
      'NON_EXECUTABLE_PROSE',
      'NOT_EXECUTABLE',
      'REVISION_QUALITY_FAILED',
      'TOO_SHORT',
      'UNSUPPORTED_FACT',
    ]);
  });
});
