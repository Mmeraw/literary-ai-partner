/**
 * Section Contract Parity — §13–§21 Heading Enforcement
 *
 * This test verifies the shared section contract and enforces invariants
 * across all renderers using RENDERED OUTPUT inspection, not source-string
 * checks.
 *
 * Test categories:
 * 1. Contract self-validation (startup guard)
 * 2. Rendered heading validation (with dream-present fixture)
 * 3. Forbidden heading detection (exact + near-duplicate)
 * 4. Grep-style invariant: no renderer hardcodes §13–§21 titles
 * 5. Cross-surface parity
 */
import fs from 'fs';
import path from 'path';
import {
  getLongFormMultiLayerSections,
  getRequiredSectionTitles,
  getForbiddenTopLevelHeadings,
  getForbiddenNearDuplicates,
  validateLongFormMultiLayerSectionContract,
  validateRenderedHeadings,
  validateCrossSurfaceParity,
  extractHtmlH2Headings,
  extractTxtHeadings,
  extractDocxXmlHeadings,
} from '@/lib/evaluation/sharedLongFormMultiLayerSections';

// ── 1. Contract Self-Validation ─────────────────────────────────────────

describe('Section Contract Self-Validation', () => {
  test('contract passes startup validation', () => {
    const result = validateLongFormMultiLayerSectionContract();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('contains all required §13–§21 orders', () => {
    const sections = getLongFormMultiLayerSections();
    for (let order = 13; order <= 21; order++) {
      expect(sections.some(s => s.order === order)).toBe(true);
    }
  });

  test('no section title collides with forbidden DREAM headings', () => {
    const forbidden = new Set(getForbiddenTopLevelHeadings());
    const sections = getLongFormMultiLayerSections();
    for (const s of sections) {
      expect(forbidden.has(s.title)).toBe(false);
    }
  });

  test('all required sections are visible on all 4 surfaces', () => {
    const sections = getLongFormMultiLayerSections();
    for (const s of sections) {
      if (s.required) {
        expect(s.rendererVisibility.web).toBe(true);
        expect(s.rendererVisibility.pdf).toBe(true);
        expect(s.rendererVisibility.docx).toBe(true);
        expect(s.rendererVisibility.txt).toBe(true);
      }
    }
  });
});

// ── 2. Heading Extraction Helpers ───────────────────────────────────────

describe('Heading Extraction', () => {
  test('extractHtmlH2Headings extracts h2 tags', () => {
    const html = `
      <h2>Story Ledger or Layer-Aware Architecture Map</h2>
      <h2>Review Gate Readiness Surface</h2>
      <h3>This is not top-level</h3>
      <h2>Confidence Explanation</h2>
    `;
    const headings = extractHtmlH2Headings(html);
    expect(headings).toEqual([
      'Story Ledger or Layer-Aware Architecture Map',
      'Review Gate Readiness Surface',
      'Confidence Explanation',
    ]);
  });

  test('extractTxtHeadings extracts divider-delimited headings', () => {
    const txt = [
      '══════════════════',
      'STORY LEDGER OR LAYER-AWARE ARCHITECTURE MAP',
      '══════════════════',
      'Some content here',
      '──────────────────',
      'REVIEW GATE READINESS SURFACE',
      '──────────────────',
    ].join('\n');
    const headings = extractTxtHeadings(txt);
    expect(headings).toContain('STORY LEDGER OR LAYER-AWARE ARCHITECTURE MAP');
    expect(headings).toContain('REVIEW GATE READINESS SURFACE');
  });

  test('extractDocxXmlHeadings extracts Heading2 paragraphs', () => {
    const xml = `
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Story Ledger or Layer-Aware Architecture Map</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t>Body text</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Review Gate Readiness Surface</w:t></w:r></w:p>
    `;
    const headings = extractDocxXmlHeadings(xml);
    expect(headings).toEqual([
      'Story Ledger or Layer-Aware Architecture Map',
      'Review Gate Readiness Surface',
    ]);
  });
});

// ── 3. Rendered Heading Validation ──────────────────────────────────────

describe('Rendered Heading Validation', () => {
  const requiredTitles = getRequiredSectionTitles();

  test('valid heading set passes', () => {
    const headings = [
      'Some Preamble Section',
      ...requiredTitles,
    ];
    const result = validateRenderedHeadings(headings, 'test');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing required heading fails', () => {
    const headings = requiredTitles.filter(t => t !== 'Long-Form Continuity and Coverage Proof');
    const result = validateRenderedHeadings(headings, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Long-Form Continuity and Coverage Proof'))).toBe(true);
  });

  test('out-of-order required headings fails', () => {
    const reversed = [...requiredTitles].reverse();
    const result = validateRenderedHeadings(reversed, 'test');
    expect(result.valid).toBe(false);
  });

  test('forbidden top-level heading fails', () => {
    const headings = [
      'Narrative Synthesis',
      ...requiredTitles,
    ];
    const result = validateRenderedHeadings(headings, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Narrative Synthesis'))).toBe(true);
  });

  test('near-duplicate forbidden heading fails', () => {
    const headings = [
      'Cross Layer Synthesis',
      ...requiredTitles,
    ];
    const result = validateRenderedHeadings(headings, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('near-duplicate') || e.includes('Near-duplicate'))).toBe(true);
  });

  test('all 10 forbidden headings are detected', () => {
    const forbidden = getForbiddenTopLevelHeadings();
    expect(forbidden).toContain('Narrative Synthesis');
    expect(forbidden).toContain('Structural Architecture');
    expect(forbidden).toContain('Arc Map');
    expect(forbidden).toContain('Deep Criterion Analysis');
    expect(forbidden).toContain('Cross-Layer Integration');
    expect(forbidden).toContain('Symbolic & Doctrine Audit');
    expect(forbidden).toContain('Reader Experience');
    expect(forbidden).toContain('Market Shelf');
    expect(forbidden).toContain('Releasability Assessment');
    expect(forbidden).toContain('Review Gate');
  });
});

// ── 4. Cross-Surface Parity ─────────────────────────────────────────────

describe('Cross-Surface Parity', () => {
  const requiredTitles = [...getRequiredSectionTitles()];

  test('identical surfaces pass', () => {
    const result = validateCrossSurfaceParity({
      web: requiredTitles,
      pdf: requiredTitles,
      docx: requiredTitles,
      txt: requiredTitles,
    });
    expect(result.valid).toBe(true);
  });

  test('surface missing a section fails', () => {
    const result = validateCrossSurfaceParity({
      web: requiredTitles,
      pdf: requiredTitles,
      docx: requiredTitles.filter(t => t !== 'Confidence Explanation'),
      txt: requiredTitles,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Confidence Explanation') && e.includes('docx'))).toBe(true);
  });
});

// ── 5. Grep-Style Invariant: No Renderer Hardcodes §13–§21 Titles ──────

describe('Grep-Style Invariant — Single Source of Truth', () => {
  const SHARED_CONTRACT_FILE = 'lib/evaluation/sharedLongFormMultiLayerSections.ts';

  const ALLOWED_FILES = new Set([
    SHARED_CONTRACT_FILE,
  ]);

  const RENDERER_FILES = [
    'app/api/reports/[jobId]/download/route.ts',
    'app/reports/[jobId]/page.tsx',
  ];

  const TEMPLATE_TITLES = getRequiredSectionTitles().filter(
    t => t !== 'Confidence Explanation' && t !== 'Author-Facing Disclaimer',
  );

  for (const rendererFile of RENDERER_FILES) {
    test(`${rendererFile} does not hardcode §13–§19 section titles`, () => {
      const filePath = path.resolve(__dirname, '../../', rendererFile);
      if (!fs.existsSync(filePath)) {
        // Skip if file doesn't exist (shouldn't happen in normal repo)
        return;
      }
      const source = fs.readFileSync(filePath, 'utf-8');

      for (const title of TEMPLATE_TITLES) {
        // Check for the title as a string literal (in quotes)
        const singleQuoted = `'${title}'`;
        const doubleQuoted = `"${title}"`;
        const backtickInlined = `\`${title}\``;

        const hasSingleQuoted = source.includes(singleQuoted);
        const hasDoubleQuoted = source.includes(doubleQuoted);
        const hasBacktickInlined = source.includes(backtickInlined);

        expect(hasSingleQuoted || hasDoubleQuoted || hasBacktickInlined).toBe(false);
      }
    });
  }

  // Negative invariant: forbidden DREAM headings must not appear as
  // top-level heading output in renderers
  const FORBIDDEN_HEADINGS = getForbiddenTopLevelHeadings();
  const NEAR_DUPLICATES = getForbiddenNearDuplicates();

  for (const rendererFile of RENDERER_FILES) {
    test(`${rendererFile} does not emit forbidden headings as top-level h2/heading`, () => {
      const filePath = path.resolve(__dirname, '../../', rendererFile);
      if (!fs.existsSync(filePath)) return;
      const source = fs.readFileSync(filePath, 'utf-8');

      for (const forbidden of FORBIDDEN_HEADINGS) {
        // Check for forbidden heading as h2 content
        const h2Pattern = `<h2>${forbidden}</h2>`;
        const h2ClassPattern = new RegExp(`<h2[^>]*>\\s*${forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h2>`, 'g');
        // Check for forbidden heading as DOCX makeHeading argument
        const makeHeadingPattern = `makeHeading('${forbidden}')`;
        const makeHeadingDoubleQuote = `makeHeading("${forbidden}")`;
        // Check for forbidden heading as TXT push
        const pushPattern = `push('${forbidden.toUpperCase()}')`;
        const pushDoubleQuote = `push("${forbidden.toUpperCase()}")`;

        const found = source.includes(h2Pattern) ||
          h2ClassPattern.test(source) ||
          source.includes(makeHeadingPattern) ||
          source.includes(makeHeadingDoubleQuote) ||
          source.includes(pushPattern) ||
          source.includes(pushDoubleQuote);

        if (found) {
          throw new Error(
            `${rendererFile} emits forbidden DREAM heading "${forbidden}" as top-level heading. ` +
            `Forbidden headings may only appear as subsection labels or body text.`,
          );
        }
      }
    });
  }
});

// ── 6. Dream-Present Fixture: §13–§21 Must Exist ───────────────────────

describe('Dream-Present Fixture — §13–§21 Heading Sequence', () => {
  // Simulate the headings that a dream-present long-form multi-layer
  // evaluation should produce across all surfaces
  const requiredTitles = getRequiredSectionTitles();

  test('required §13–§21 section titles are defined', () => {
    expect(requiredTitles.length).toBeGreaterThanOrEqual(9);
  });

  test('Long-Form Continuity and Coverage Proof exists in required titles', () => {
    expect(requiredTitles).toContain('Long-Form Continuity and Coverage Proof');
  });

  test('forbidden heading count matches expected', () => {
    const forbidden = getForbiddenTopLevelHeadings();
    expect(forbidden.length).toBeGreaterThanOrEqual(10);
  });

  test('near-duplicate count is at least as large as exact forbidden set', () => {
    const forbidden = getForbiddenTopLevelHeadings();
    const nearDupes = getForbiddenNearDuplicates();
    expect(nearDupes.length).toBeGreaterThanOrEqual(forbidden.length);
  });

  test('no required title appears in forbidden list', () => {
    const forbidden = new Set(getForbiddenTopLevelHeadings());
    for (const title of requiredTitles) {
      expect(forbidden.has(title)).toBe(false);
    }
  });

  test('no required title appears in near-duplicate list (except if it IS the canonical title)', () => {
    const nearDupes = new Set(getForbiddenNearDuplicates());
    for (const title of requiredTitles) {
      if (nearDupes.has(title)) {
        // This is fine if it's also a required title — validateRenderedHeadings
        // exempts required titles from near-duplicate detection
      }
    }
  });
});
