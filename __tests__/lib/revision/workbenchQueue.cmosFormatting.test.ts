/**
 * Regression tests for the workbench-v2 error-fix pass (manuscript #7691 audit).
 *
 * These cover the data-layer defects that leaked machine-internal strings and
 * un-normalized prose into the author-facing revision workbench:
 *   - humanizeCoordinateSlug / cleanLocationRef: raw colon-delimited coordinate
 *     slugs (chapter:1:paragraph:20, narrativeclosure:recommendation) must be
 *     humanized or suppressed, never shown verbatim.
 *   - firstSentence: generator output beginning with a lowercase verb
 *     ("insert...", "cut...") must be capitalized (CMOS 6.13).
 *   - cleanAuthorFacingText: every author-facing field is CMOS-sanitized
 *     (curly quotes, US spelling) via the shared sanitizeCMOS choke point.
 */
import { __testing } from '@/lib/revision/workbenchQueue';

const { humanizeCoordinateSlug, cleanLocationRef, firstSentence, cleanAuthorFacingText } = __testing;

describe('humanizeCoordinateSlug', () => {
  // CMOS 8.180: generic in-text locators are lowercased; only the leading
  // locator is capitalized so the label reads as sentence-initial text.
  it.each([
    ['chapter:1:paragraph:20', 'Chapter 1, paragraph 20'],
    ['chapter:1:paragraph:12', 'Chapter 1, paragraph 12'],
    ['chapter:3:scene:2', 'Chapter 3, scene 2'],
  ] as const)('humanizes numeric slug %s -> %s', (slug, expected) => {
    expect(humanizeCoordinateSlug(slug)).toBe(expected);
  });

  it.each([
    'chapter:submission:overview',
    'narrativedrive:recommendation',
    'narrativeclosure:recommendation',
  ])('returns null for non-locational placeholder slug %s', (slug) => {
    expect(humanizeCoordinateSlug(slug)).toBeNull();
  });
});

describe('cleanLocationRef', () => {
  it('humanizes a raw coordinate slug rather than leaking it', () => {
    expect(cleanLocationRef('chapter:1:paragraph:20')).toBe('Chapter 1, paragraph 20');
  });

  it('suppresses placeholder recommendation slugs', () => {
    expect(cleanLocationRef('narrativeclosure:recommendation')).toBeNull();
    expect(cleanLocationRef('recommendation:4')).toBeNull();
  });

  it('passes through human-readable location text unchanged', () => {
    expect(cleanLocationRef('Chapter 2, opening paragraph')).toBe('Chapter 2, opening paragraph');
  });

  it('returns null for empty input', () => {
    expect(cleanLocationRef(null)).toBeNull();
    expect(cleanLocationRef('')).toBeNull();
  });
});

describe('firstSentence — sentence-initial capitalization', () => {
  it('capitalizes a lowercase-leading directive', () => {
    expect(firstSentence('insert a beat of hesitation here.', 'fallback')).toMatch(/^Insert/);
  });

  it('capitalizes a lowercase "cut" directive', () => {
    expect(firstSentence('cut the redundant clause.', 'fallback')).toMatch(/^Cut/);
  });

  it('leaves an already-capitalized sentence capitalized', () => {
    expect(firstSentence('Reframe the paragraph.', 'fallback')).toMatch(/^Reframe/);
  });

  it('returns the fallback when input is empty', () => {
    expect(firstSentence('', 'fallback text')).toBe('fallback text');
  });
});

describe('cleanAuthorFacingText — CMOS normalization applied', () => {
  it('converts straight quotes to curly quotes', () => {
    const out = cleanAuthorFacingText('She said "hello" softly.', 'fallback');
    expect(out).toContain('\u201c');
    expect(out).toContain('\u201d');
    expect(out).not.toContain('"');
  });

  it('normalizes British spelling to US', () => {
    const out = cleanAuthorFacingText('The gap measured one millimetre exactly.', 'fallback');
    expect(out).toContain('millimeter');
  });

  it('returns the fallback for empty input', () => {
    expect(cleanAuthorFacingText('', 'fallback')).toBe('fallback');
    expect(cleanAuthorFacingText(null, 'fallback')).toBe('fallback');
  });
});
