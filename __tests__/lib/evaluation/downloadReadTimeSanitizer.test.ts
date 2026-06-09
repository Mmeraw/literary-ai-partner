import { sanitizeResultForDownload } from '@/lib/evaluation/downloadReadTimeSanitizer';
import { validateDownloadParity } from '@/lib/evaluation/downloadParityGate';

describe('downloadReadTimeSanitizer', () => {
  function makeValidResult(overrides: Record<string, unknown> = {}) {
    return {
      overview: {
        overall_score_0_100: 64,
        one_paragraph_summary: 'A valid summary with real content for evaluation purposes.',
        top_3_strengths: [
          'First strength is substantial enough to matter.',
          'Second strength shows quality.',
          'Third strength demonstrates value.',
        ],
        top_3_risks: [
          'First risk shows an area of concern.',
          'Second risk identifies a weakness.',
          'Third risk points to a gap.',
        ],
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 7,
          rationale: 'A valid rationale about the concept quality.',
          recommendations: [
            { action: 'Improve the opening by adding detail.', specific_fix: 'Add a scene.' },
          ],
        },
      ],
      recommendations: {
        quick_wins: [{ action: 'Fix this quickly.', why: 'It helps.' }],
        strategic_revisions: [{ action: 'Restructure this.', why: 'Better flow.' }],
      },
      ...overrides,
    };
  }

  it('passes parity gate when result is clean', () => {
    const result = makeValidResult();
    sanitizeResultForDownload(result);
    const parity = validateDownloadParity(result);
    expect(parity.pass).toBe(true);
    expect(parity.violations).toHaveLength(0);
  });

  it('sanitizes "would because" in summary and passes parity gate', () => {
    const result = makeValidResult({
      overview: {
        overall_score_0_100: 64,
        one_paragraph_summary: 'The manuscript would because demonstrate strong thematic coherence.',
        top_3_strengths: ['Good.', 'Fine.', 'Solid.'].map(s => s + ' extra padding text here'),
        top_3_risks: ['Risk one is real.', 'Risk two is real.', 'Risk three is real.'].map(s => s + ' with more detail'),
      },
    });

    // Before sanitization, parity gate would fail
    const beforeParity = validateDownloadParity(result);
    expect(beforeParity.pass).toBe(false);
    expect(beforeParity.violations.some(v => v.code === 'MALFORMED_WOULD_BECAUSE')).toBe(true);

    // After sanitization, parity gate passes
    sanitizeResultForDownload(result);
    const afterParity = validateDownloadParity(result);
    expect(afterParity.pass).toBe(true);
  });

  it('sanitizes "safe injection sites" in rationale and passes parity gate', () => {
    const result = makeValidResult();
    (result.criteria as Array<Record<string, unknown>>)[0].rationale =
      'At the scene level, studies are mixed on the success of safe injection sites. would because the stakes signal arrives too late.';

    const beforeParity = validateDownloadParity(result);
    expect(beforeParity.pass).toBe(false);

    sanitizeResultForDownload(result);
    const afterParity = validateDownloadParity(result);
    expect(afterParity.pass).toBe(true);

    // Verify the text was actually cleaned
    const rationale = (result.criteria as Array<Record<string, unknown>>)[0].rationale as string;
    expect(rationale).not.toContain('safe injection sites');
    expect(rationale).not.toContain('would because');
    expect(rationale).toContain('scene-specific evidence');
  });

  it('sanitizes double modals in recommendations', () => {
    const result = makeValidResult();
    (result.criteria as Array<Record<string, unknown>>)[0].recommendations = [
      { action: 'This would would improve the scene construction.', specific_fix: 'Add detail.' },
    ];

    sanitizeResultForDownload(result);
    const action = ((result.criteria as Array<Record<string, unknown>>)[0].recommendations as Array<Record<string, unknown>>)[0].action as string;
    expect(action).not.toMatch(/would\s+would/);
  });

  it('sanitizes "benefit from one because" in strengths', () => {
    const result = makeValidResult({
      overview: {
        overall_score_0_100: 64,
        one_paragraph_summary: 'A valid summary with enough text to pass.',
        top_3_strengths: [
          'The manuscript would benefit from one because it needs more specificity in the opening.',
          'Second strength is solid.',
          'Third strength works.',
        ],
        top_3_risks: ['Risk one is real enough.', 'Risk two is real enough.', 'Risk three is real enough.'],
      },
    });

    const beforeParity = validateDownloadParity(result);
    expect(beforeParity.pass).toBe(false);

    sanitizeResultForDownload(result);
    const afterParity = validateDownloadParity(result);
    expect(afterParity.pass).toBe(true);
  });

  it('sanitizes cross-cutting quick_wins and strategic_revisions', () => {
    const result = makeValidResult();
    result.recommendations = {
      quick_wins: [{ action: 'The author could could fix this easily.', why: 'Because it matters.' }],
      strategic_revisions: [{ action: 'Rebuild safe injection sites section.', why: 'Off-topic.' }],
    };

    sanitizeResultForDownload(result);
    const quickAction = (result.recommendations as Record<string, unknown[]>).quick_wins[0] as Record<string, string>;
    const stratAction = (result.recommendations as Record<string, unknown[]>).strategic_revisions[0] as Record<string, string>;
    expect(quickAction.action).not.toMatch(/could\s+could/);
    expect(stratAction.action).not.toContain('safe injection sites');
  });

  it('does NOT corrupt clean text', () => {
    const result = makeValidResult();
    const originalSummary = (result.overview as Record<string, unknown>).one_paragraph_summary;
    sanitizeResultForDownload(result);
    expect((result.overview as Record<string, unknown>).one_paragraph_summary).toBe(originalSummary);
  });

  it('handles missing overview gracefully', () => {
    const result = { criteria: [], score: 75 } as unknown as Record<string, unknown>;
    expect(() => sanitizeResultForDownload(result)).not.toThrow();
  });

  it('handles null criteria gracefully', () => {
    const result = makeValidResult();
    result.criteria = null as unknown;
    expect(() => sanitizeResultForDownload(result as unknown as Record<string, unknown>)).not.toThrow();
  });
});
