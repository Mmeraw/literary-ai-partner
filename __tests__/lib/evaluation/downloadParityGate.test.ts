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

  test('fails when malformed prose fragments appear in summary or recommendations', () => {
    const result = {
      ...canonicalResult,
      overview: {
        ...canonicalResult.overview,
        one_paragraph_summary: 'This section would because malformed connectors leaked through.',
      },
      criteria: [
        {
          ...canonicalResult.criteria[0],
          recommendations: [
            {
              action: 'Insert one concrete stakes beat; At the scene level, studies are mixed on the success of safe injection sites. would because the stakes signal arrives too late.',
            },
          ],
        },
      ],
    };

    const codes = validateDownloadParity(result).violations.map((v) => v.code);
    expect(codes).toContain('MALFORMED_WOULD_BECAUSE');
  });

  test('fails on additional malformed or off-topic contamination fragments', () => {
    const result = {
      ...canonicalResult,
      overview: {
        ...canonicalResult.overview,
        one_paragraph_summary: 'The argument could would tighten with clearer causality.',
        top_3_risks: ['At the scene level, studies are mixed on the success of safe injection sites.'],
      },
      criteria: [
        {
          ...canonicalResult.criteria[0],
          recommendations: [
            {
              action: 'This sequence may benefit from one because the connective logic is broken.',
            },
          ],
        },
      ],
    };

    const codes = validateDownloadParity(result).violations.map((v) => v.code);
    expect(codes).toEqual(expect.arrayContaining([
      'MALFORMED_DOUBLE_MODAL',
      'MALFORMED_BENEFIT_FROM_ONE_BECAUSE',
      'OFF_TOPIC_STUDIES_ARE_MIXED',
      'OFF_TOPIC_SAFE_INJECTION_SITES',
    ]));
  });
});
