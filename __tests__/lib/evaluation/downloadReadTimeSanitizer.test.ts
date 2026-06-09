import { sanitizeResultForDownload } from '@/lib/evaluation/downloadReadTimeSanitizer';
import { validateDownloadParity } from '@/lib/evaluation/downloadParityGate';
import { FORBIDDEN_PATTERNS, getForbiddenDetectors, getForbiddenReplacements } from '@/lib/evaluation/reportForbiddenPatterns';

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

  // ── Critical regression tests for Issue #1021 download fix ──

  it('sanitizes SHORT form "studies are mixed on the success of" (without "safe injection sites")', () => {
    const result = makeValidResult();
    (result.criteria as Array<Record<string, unknown>>)[0].rationale =
      'Studies are mixed on the success of these harm reduction approaches in the region.';

    // Before: parity gate catches the shorter pattern
    const beforeParity = validateDownloadParity(result);
    expect(beforeParity.pass).toBe(false);
    expect(beforeParity.violations.some(v => v.code === 'OFF_TOPIC_STUDIES_ARE_MIXED')).toBe(true);

    // After: sanitizer cleans it, gate passes
    sanitizeResultForDownload(result);
    const afterParity = validateDownloadParity(result);
    expect(afterParity.pass).toBe(true);

    const rationale = (result.criteria as Array<Record<string, unknown>>)[0].rationale as string;
    expect(rationale).not.toMatch(/studies\s+are\s+mixed/i);
  });

  it('Sister-like contaminated payload: sanitizer cleans → parity gate passes', () => {
    // Simulates the exact contamination found in Sister eval (0fea6d6c)
    const result = makeValidResult({
      overview: {
        overall_score_0_100: 65,
        one_paragraph_summary:
          'This chapter offers a powerful fusion of INSITE\'s harm-reduction policy with the narrator\'s fraught relationships.',
        top_3_strengths: [
          'A distinctive conceptual frame that links INSITE\'s supervised injection model.',
          'Rich psychologically coherent characterization.',
          'Strong thematic integration of addiction-as-disease and harm reduction.',
        ],
        top_3_risks: [
          'Front-loaded policy exposition about INSITE and international drug policy.',
          'Reliance on retrospective summary over in-scene dramatization.',
          'Mid-level prose control and copyediting gaps.',
        ],
      },
      criteria: [
        {
          key: 'pacing',
          score_0_10: 5,
          rationale: 'The chapter alternates between dense policy paragraphs about safe injection sites and summarized history.',
          recommendations: [
            {
              action: 'cut one reflective sentence and insert one immediate external action trigger',
              specific_fix: 'The structural turn at the passage near "Studies are mixed on the success of safe injection sites" is close, but the causal order is inverted. Move the trigger ahead of reflection so the section can land the structural beat before the reflective passage stalls forward momentum.',
              anchor_snippet: 'Studies are mixed on the success of safe injection sites.',
              expected_impact: 'Stronger forward momentum through the section turn.',
              mechanism: 'the reflective passage stalls forward momentum before the narrative urgency peaks',
              reader_effect: 'stronger forward momentum and cleaner urgency through the section turn',
            },
          ],
        },
        {
          key: 'concept',
          score_0_10: 8,
          rationale: 'The core idea is strong and distinct.',
          recommendations: [
            { action: 'Improve opening hook.', specific_fix: 'Add a scene.' },
          ],
        },
      ],
    });

    // Before sanitization: parity gate FAILS (exactly what production does now)
    const beforeParity = validateDownloadParity(result);
    expect(beforeParity.pass).toBe(false);
    const violationCodes = beforeParity.violations.map(v => v.code);
    expect(
      violationCodes.includes('OFF_TOPIC_STUDIES_ARE_MIXED') ||
      violationCodes.includes('OFF_TOPIC_STUDIES_ARE_MIXED_FULL') ||
      violationCodes.includes('OFF_TOPIC_SAFE_INJECTION_SITES')
    ).toBe(true);

    // After sanitization: parity gate PASSES (proves the blocker is gone)
    sanitizeResultForDownload(result);
    const afterParity = validateDownloadParity(result);
    expect(afterParity.pass).toBe(true);
    expect(afterParity.violations).toHaveLength(0);

    // Verify contamination was actually removed (not just renamed)
    const rationale = (result.criteria as Array<Record<string, unknown>>)[0].rationale as string;
    expect(rationale).not.toContain('safe injection sites');
    const specificFix = ((result.criteria as Array<Record<string, unknown>>)[0].recommendations as Array<Record<string, unknown>>)[0].specific_fix as string;
    expect(specificFix).not.toMatch(/studies\s+are\s+mixed/i);
    expect(specificFix).not.toContain('safe injection sites');
  });

  it('every parity-gate forbidden pattern has a matching sanitizer replacement', () => {
    const detectors = getForbiddenDetectors();
    const replacements = getForbiddenReplacements();

    // Every detector code must have at least one replacement
    for (const detector of detectors) {
      const hasReplacement = replacements.some(r => r.code === detector.code);
      expect(hasReplacement).toBe(true);
    }

    // Both derive from the same FORBIDDEN_PATTERNS registry
    expect(detectors.length).toBe(FORBIDDEN_PATTERNS.length);
    expect(replacements.length).toBe(FORBIDDEN_PATTERNS.length);
  });

  it('shared registry: sanitizer and gate use identical pattern sources', () => {
    const detectors = getForbiddenDetectors();
    const replacements = getForbiddenReplacements();

    // Same count — one entry per FORBIDDEN_PATTERNS item
    expect(detectors.length).toBe(replacements.length);

    // Each detector regex source matches the corresponding replacement source
    for (let i = 0; i < detectors.length; i++) {
      expect(detectors[i].re.source).toBe(replacements[i].re.source);
    }
  });

  // ── Specific sanitizer ordering / orphan tests (per user request) ──

  it('full phrase does NOT leave "safe injection sites" orphaned after sanitization', () => {
    const result = makeValidResult();
    (result.criteria as Array<Record<string, unknown>>)[0].rationale =
      'The studies are mixed on the success of safe injection sites and the surrounding community.';

    sanitizeResultForDownload(result);
    const rationale = (result.criteria as Array<Record<string, unknown>>)[0].rationale as string;
    expect(rationale).not.toContain('safe injection sites');
    expect(rationale).not.toMatch(/studies\s+are\s+mixed/i);

    const parity = validateDownloadParity(result);
    expect(parity.pass).toBe(true);
  });

  it('orphan "studies are mixed on the success of" (no "safe injection sites") is sanitized', () => {
    const result = makeValidResult();
    (result.criteria as Array<Record<string, unknown>>)[0].rationale =
      'Recent studies are mixed on the success of these harm reduction programs in Vancouver.';

    sanitizeResultForDownload(result);
    const rationale = (result.criteria as Array<Record<string, unknown>>)[0].rationale as string;
    expect(rationale).not.toMatch(/studies\s+are\s+mixed/i);

    const parity = validateDownloadParity(result);
    expect(parity.pass).toBe(true);
  });

  it('parity gate deduplicates family codes for same-span matches', () => {
    const result = makeValidResult();
    // This text matches both long and short OFF_TOPIC_STUDIES_ARE_MIXED patterns
    (result.criteria as Array<Record<string, unknown>>)[0].rationale =
      'The studies are mixed on the success of safe injection sites in Vancouver.';

    const parity = validateDownloadParity(result);
    expect(parity.pass).toBe(false);

    // Should NOT have duplicate OFF_TOPIC_STUDIES_ARE_MIXED codes for the same field
    const studiesCodes = parity.violations.filter(v => v.code === 'OFF_TOPIC_STUDIES_ARE_MIXED');
    expect(studiesCodes.length).toBe(1);
  });
});
