import { describe, it, expect } from '@jest/globals';
import {
  checkRecommendationIntegrity,
  INTEGRITY_VIOLATION_CODES,
  runRecommendationIntegrityGate,
  type IntegrityField,
  type IntegrityViolationCode,
} from '@/lib/evaluation/pipeline/recommendationIntegrityGate';
import { integrityAdmissionReasonCode, runCopyPasteAdmissionGate, ADMISSION_REASON } from '@/lib/revision/reviseAdmissionGate';

function codesFor(input: Parameters<typeof checkRecommendationIntegrity>[0]) {
  return new Set(checkRecommendationIntegrity(input).violations.map((v) => v.code));
}

describe('recommendationIntegrityGate parity', () => {
  it('emits every exported integrity violation code from at least one fixture', () => {
    const observed = new Set<IntegrityViolationCode>();

    // Incomplete fields (action and reader_effect missing/short)
    const incomplete = codesFor({ action: 'short' });
    for (const code of incomplete) observed.add(code);

    // Lowercase opening on action
    const lowerOpening = codesFor({
      action: 'add one visible consequence.',
      reader_effect: 'The reader sees the consequence.',
      surface: 'evaluation_report',
    });
    for (const code of lowerOpening) observed.add(code);

    // Missing terminal punctuation
    const missingTerminal = codesFor({
      action: 'Add one visible consequence',
      reader_effect: 'The reader sees the consequence.',
      surface: 'evaluation_report',
    });
    for (const code of missingTerminal) observed.add(code);

    // Orphan conjunction at start of action
    const orphanConjunction = codesFor({
      action: 'However, add one visible consequence.',
      reader_effect: 'The reader sees the consequence.',
      surface: 'evaluation_report',
    });
    for (const code of orphanConjunction) observed.add(code);

    // Malformed connector in action
    const malformedConnector = codesFor({
      action: 'We can nonetheless, add one visible consequence.',
      reader_effect: 'The reader feels tension.',
      surface: 'evaluation_report',
    });
    for (const code of malformedConnector) observed.add(code);

    // Sentence fragment starting with which/who
    const sentenceFragment = codesFor({
      action: 'Which choice adds one visible consequence.',
      reader_effect: 'The reader feels tension.',
      surface: 'evaluation_report',
    });
    for (const code of sentenceFragment) observed.add(code);

    // Repeated 6-word clause (no terminal punctuation so the repeated words match)
    const repeatedClause = codesFor({
      action: 'One two three four five six and one two three four five six',
      reader_effect: 'The reader feels tension.',
      surface: 'evaluation_report',
    });
    for (const code of repeatedClause) observed.add(code);

    // Mid-sentence truncation (ends with conjunction)
    const midTruncation = codesFor({
      action: 'Add one visible consequence, but',
      reader_effect: 'The reader feels tension.',
      surface: 'evaluation_report',
    });
    for (const code of midTruncation) observed.add(code);

    // Generic workshop language in action
    const genericWorkshop = codesFor({
      action: 'Insert one concrete stakes beat.',
      reader_effect: 'The reader feels tension.',
      surface: 'evaluation_report',
    });
    for (const code of genericWorkshop) observed.add(code);

    // Missing specific anchor when anchor snippet is provided
    const missingSpecificAnchor = codesFor({
      action: 'Add one visible consequence near the current scene.',
      reader_effect: 'The reader feels tension.',
      anchor_snippet: 'This is a long anchor text for the scene.',
      surface: 'evaluation_report',
    });
    for (const code of missingSpecificAnchor) observed.add(code);

    // Vague anchor snippet: runRecommendationIntegrityGate receives anchor_snippet as a field
    const vagueAnchorFields: IntegrityField[] = [
      { name: 'action', value: 'After "the disputed line", add one visible consequence.' },
      { name: 'reader_effect', value: 'The reader feels tension.' },
      { name: 'anchor_snippet', value: 'the passage.' },
    ];
    const vagueAnchor = new Set(
      runRecommendationIntegrityGate(vagueAnchorFields, { surface: 'evaluation_report' }).violations.map((v) => v.code),
    );
    for (const code of vagueAnchor) observed.add(code);

    // Cause missing causal language
    const missingCausal = codesFor({
      action: 'Insert one visible consequence at the disputed turn.',
      reader_effect: 'The reader feels tension.',
      cause: 'The scene is weak and needs more work.',
      surface: 'evaluation_report',
    });
    for (const code of missingCausal) observed.add(code);

    // Reader effect missing consequence language
    const missingReaderConsequence = codesFor({
      action: 'Insert one visible consequence at the disputed turn.',
      reader_effect: 'This is a necessary change.',
      surface: 'evaluation_report',
    });
    for (const code of missingReaderConsequence) observed.add(code);

    // Symptom missing manuscript evidence
    const missingManuscriptEvidence = codesFor({
      action: 'Insert one visible consequence at the disputed turn.',
      reader_effect: 'The reader feels tension.',
      symptom: 'The writing feels weak and ungrounded.',
      surface: 'evaluation_report',
    });
    for (const code of missingManuscriptEvidence) observed.add(code);

    // Generic effect phrase in reader_effect
    const genericEffect = codesFor({
      action: 'Insert one visible consequence at the disputed turn.',
      reader_effect: 'Improves engagement.',
      surface: 'evaluation_report',
    });
    for (const code of genericEffect) observed.add(code);

    expect(observed).toEqual(new Set(INTEGRITY_VIOLATION_CODES));
  });

  it('maps every integrity violation code through the admission prefix constructor', () => {
    for (const code of INTEGRITY_VIOLATION_CODES) {
      const admission = integrityAdmissionReasonCode(code);
      expect(admission).toBe(`INTEGRITY_${code}`);
      expect(admission).toMatch(/^INTEGRITY_[A-Z_]+$/);
    }
  });

  it('only emits integrity violation codes that are in the exported vocabulary', () => {
    const allowed = new Set(INTEGRITY_VIOLATION_CODES);
    const aggregate = checkRecommendationIntegrity({
      action: 'which can some add however add one visible consequence, but',
      reader_effect: 'improves engagement',
      cause: 'the scene is weak',
      symptom: 'the writing feels weak',
      anchor_snippet: 'the passage',
      surface: 'evaluation_report',
    });
    for (const v of aggregate.violations) {
      expect(allowed.has(v.code)).toBe(true);
    }
  });

  it('emits INTEGRITY_BELOW_PASS_STRONG and INTEGRITY_${code} reasons through runCopyPasteAdmissionGate', () => {
    const integrityInput = {
      action:
        'however add one concrete stakes beat and one two three four five six and one two three four five six and can nonetheless, improve the passage, but',
      symptom: 'The writing feels weak and ungrounded throughout this section.',
      cause: 'The scene is weak and needs more work to land the beat.',
      reader_effect: 'Improves engagement.',
      anchor_snippet:
        'This is a long anchor text for the scene and it is here.',
      surface: 'revise_queue' as const,
    };

    const integrityResult = checkRecommendationIntegrity(integrityInput);
    const expected = new Set<string>([
      ADMISSION_REASON.INTEGRITY_BELOW_PASS_STRONG,
      ...integrityResult.violations.map((v) => integrityAdmissionReasonCode(v.code)),
    ]);

    const admissionResult = runCopyPasteAdmissionGate({
      id: 'integrity-parity-1',
      groundingStatus: 'supported',
      preflightStatus: 'passed',
      contextQuality: 'clean',
      mode: 'direct-rewrite',
      revisionOperation: 'replace_selected_passage',
      symptom: integrityInput.symptom,
      cause: integrityInput.cause,
      fixDirection: integrityInput.action,
      readerEffect: integrityInput.reader_effect,
      anchor: integrityInput.anchor_snippet,
      quoteHighlight: integrityInput.anchor_snippet,
      quoteRest: 'After the moment, the story continues with more text.',
      options: [
        { key: 'A', candidateText: 'Alice stepped forward and raised the letter.' },
        { key: 'B', candidateText: 'Bob nodded and set the candle on the table.' },
        { key: 'C', candidateText: 'Clara turned the page and kept reading.' },
      ],
    });

    const actual = new Set(admissionResult.reasons);
    for (const code of expected) {
      expect(actual.has(code)).toBe(true);
    }
  });
});
