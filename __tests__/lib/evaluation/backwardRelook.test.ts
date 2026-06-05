import { describe, expect, test } from '@jest/globals';

import { runEvaluationBackwardRelook } from '@/lib/evaluation/backwardRelook';

describe('runEvaluationBackwardRelook', () => {
  test('allows clean structurally valid artifacts after boundary pass', () => {
    const decision = runEvaluationBackwardRelook({
      structuralOk: true,
      boundaryGateDecision: 'PASS',
      reasonCodes: [],
    });

    expect(decision).toMatchObject({
      status: 'supported_after_relook',
      reportPersistence: 'allow',
      jobStatus: 'complete',
      validityStatus: 'valid',
    });
  });

  test('blocks structural failure before report persistence', () => {
    const decision = runEvaluationBackwardRelook({ structuralOk: false, boundaryGateDecision: 'PASS' });
    expect(decision.reportPersistence).toBe('block');
    expect(decision.status).toBe('unsupported_blocked');
  });

  test('blocks boundary failure before report persistence', () => {
    const decision = runEvaluationBackwardRelook({ structuralOk: true, boundaryGateDecision: 'FAIL' });
    expect(decision.reportPersistence).toBe('block');
    expect(decision.status).toBe('uncertain_after_relook_blocked');
  });

  test('blocks fallback path before report persistence', () => {
    const decision = runEvaluationBackwardRelook({ structuralOk: true, boundaryGateDecision: 'PASS', usedFallbackPath: true });
    expect(decision.reportPersistence).toBe('block');
    expect(decision.reasonCodes).toContain('FALLBACK_GENERATOR_USED');
  });

  test('blocks unresolved evidence mismatch before report persistence', () => {
    const decision = runEvaluationBackwardRelook({ structuralOk: true, boundaryGateDecision: 'PASS', evidenceMismatchUnresolved: true });
    expect(decision.reportPersistence).toBe('block');
    expect(decision.reasonCodes).toContain('UNRESOLVED_EVIDENCE_MISMATCH');
  });

  test('blocks uncertified long-form scoring before report persistence', () => {
    const decision = runEvaluationBackwardRelook({ structuralOk: true, boundaryGateDecision: 'PASS', manuscriptWideCertifiable: false });
    expect(decision.reportPersistence).toBe('block');
    expect(decision.reasonCodes).toContain('LONG_FORM_UNCERTIFIED_MANUSCRIPT_WIDE_SCORE');
  });

  test('blocks partial long-form scoring before report persistence', () => {
    const decision = runEvaluationBackwardRelook({ structuralOk: true, boundaryGateDecision: 'PASS', partialEvaluation: true });
    expect(decision.reportPersistence).toBe('block');
    expect(decision.reasonCodes).toContain('LONG_FORM_PARTIAL_EVALUATION');
  });

  test('blocks explicit blocked status before report persistence', () => {
    const decision = runEvaluationBackwardRelook({ structuralOk: true, boundaryGateDecision: 'PASS', explicitGroundingStatus: 'unsupported_blocked' });
    expect(decision.reportPersistence).toBe('block');
    expect(decision.status).toBe('unsupported_blocked');
  });

  test('preserves reportable explicit uncertainty without blocking', () => {
    const decision = runEvaluationBackwardRelook({
      structuralOk: true,
      boundaryGateDecision: 'PASS',
      explicitGroundingStatus: 'uncertain_after_relook_reportable',
    });

    expect(decision).toMatchObject({
      status: 'uncertain_after_relook_reportable',
      reportPersistence: 'allow',
      jobStatus: 'complete',
      validityStatus: 'valid',
    });
  });

  test('deduplicates reason codes across the matrix', () => {
    const decision = runEvaluationBackwardRelook({
      structuralOk: true,
      boundaryGateDecision: 'PASS',
      usedFallbackPath: true,
      reasonCodes: ['FALLBACK_GENERATOR_USED', 'FALLBACK_GENERATOR_USED'],
    });

    expect(decision.reasonCodes.filter((code) => code === 'FALLBACK_GENERATOR_USED')).toHaveLength(1);
  });
});
