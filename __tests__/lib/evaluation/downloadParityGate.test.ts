import { validateDownloadParity } from '../../../lib/evaluation/downloadParityGate';

describe('validateDownloadParity', () => {
  const canonicalResult = {
    generated_at: '2026-06-06T03:53:38.000Z',
    overview: {
      verdict: 'revise',
      overall_score_0_100: 82,
      one_paragraph_summary: 'A complete canonical summary for the author-facing report.',
      top_3_strengths: ['Strong opening image.'],
      top_3_risks: ['Middle escalation needs sharper turns.'],
    },
    criteria: [
      {
        key: 'premise',
        score_0_10: 8,
        confidence_level: 'high',
        rationale: 'The premise is clear and commercially legible.',
      },
    ],
    recommendations: {
      quick_wins: [],
      strategic_revisions: [],
    },
  };

  test('passes canonical V1/V2 nested overview fields used by report downloads', () => {
    expect(validateDownloadParity(canonicalResult).pass).toBe(true);
    expect(validateDownloadParity(canonicalResult).violations).toEqual([]);
  });

  test('does not reject zero scores as missing scores', () => {
    const result = {
      ...canonicalResult,
      overview: { ...canonicalResult.overview, overall_score_0_100: 0 },
      criteria: [{ ...canonicalResult.criteria[0], score_0_10: 0 }],
    };

    expect(validateDownloadParity(result).pass).toBe(true);
  });

  test('fails closed when required canonical author-facing fields are absent', () => {
    const result = {
      overview: {
        overall_score_0_100: 80,
        one_paragraph_summary: '',
        top_3_strengths: [],
        top_3_risks: [],
      },
      criteria: [{ key: 'premise', score_0_10: 8, rationale: '' }],
    };

    expect(validateDownloadParity(result).violations.map((v) => v.code)).toEqual([
      'NO_SUMMARY',
      'NO_TOP_STRENGTHS',
      'NO_TOP_RISKS',
      'CRITERION_NO_RATIONALE',
    ]);
  });
});
