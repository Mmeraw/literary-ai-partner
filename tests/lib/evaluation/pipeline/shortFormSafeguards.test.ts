import { runShortFormEvidenceGate } from '@/lib/evaluation/pipeline/shortFormEvidenceGate';
import { runShortFormFinalSanityCheck } from '@/lib/evaluation/pipeline/shortFormFinalSanityCheck';

function criterion(overrides: Record<string, unknown> = {}) {
  return {
    key: 'concept',
    scorable: true,
    status: 'SCORABLE',
    score_0_10: 8,
    confidence_level: 'high',
    confidence_score_0_100: 90,
    scorability_status: 'scorable',
    rationale: 'The submitted opening creates a hook.',
    evidence: [{ snippet: 'The bell rang once, and Mara knew the house had answered.' }],
    recommendations: [],
    ...overrides,
  } as any;
}

describe('short-form evidence sufficiency gate', () => {
  test('500-word excerpt does not certify all criteria as scorable', () => {
    const gate = runShortFormEvidenceGate({ wordCount: 500, criteria: [criterion()] });

    expect(gate.mode).toBe('very_sparse');
    expect(gate.criteria.filter((item) => item.status === 'non_scorable').length).toBeGreaterThan(0);
    expect(gate.criteria.find((item) => item.criterion_key === 'narrativeClosure')?.reason_codes).toContain('ENDING_NOT_PRESENT');
  });

  test('criteria without direct anchors cannot show high-confidence support', () => {
    const gate = runShortFormEvidenceGate({ wordCount: 1000, criteria: [criterion({ evidence: [] })] });
    const concept = gate.criteria.find((item) => item.criterion_key === 'concept');

    expect(concept?.status).toBe('non_scorable');
    expect(concept?.reason_codes).toContain('NO_DIRECT_TEXTUAL_ANCHOR');
  });
});

describe('short-form final sanity check', () => {
  test('blocks internal process leakage', () => {
    const result = runShortFormFinalSanityCheck({
      wordCount: 1000,
      evaluationResult: {
        overview: { summary: 'Pass 3 and WAVE internals say this is market ready.', verdict: 'Market Ready' },
        criteria: [criterion()],
      } as any,
    });

    expect(result.verdict).toBe('BLOCK');
    expect(result.codes).toContain('SHORT_FORM_INTERNAL_PROCESS_LEAK');
  });

  test('does not block normal editorial use of the word "phase"', () => {
    const result = runShortFormFinalSanityCheck({
      wordCount: 1000,
      evaluationResult: {
        overview: { summary: 'Each phase of the opening establishes tone effectively.', verdict: 'Needs revision' },
        criteria: [criterion()],
      } as any,
    });

    expect(result.codes).not.toContain('SHORT_FORM_INTERNAL_PROCESS_LEAK');
  });

  test('blocks scored criteria without anchors', () => {
    const result = runShortFormFinalSanityCheck({
      wordCount: 1000,
      evaluationResult: {
        overview: { summary: 'Excerpt-scoped summary.', verdict: 'Needs revision' },
        criteria: [criterion({ evidence: [] })],
      } as any,
    });

    expect(result.verdict).toBe('BLOCK');
    expect(result.codes).toContain('SHORT_FORM_MISSING_ANCHORS');
  });
});
