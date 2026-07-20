/**
 * Surface-Parity Gate Test — Golden Master Certification
 *
 * Validates that UED → VM → TXT / HTML / DOCX produce identical content
 * (same sections, same order, same strings) and carry no rendering defects
 * (no generic fallback prose, no double-wrapped quotes, no overlong TXT lines,
 * no raw internal tokens).
 *
 * Section assertions are derived from the CANONICAL TEMPLATE CONTRACTS:
 *   - shortFormSectionContract.ts  (§1–§14 short-form sections)
 *   - sharedLongFormMultiLayerSections.ts (§12–§21 long-form sections)
 *
 * Uses exact heading extraction (extractHtmlH2Headings for HTML/DOCX-HTML,
 * an ASCII-divider extractor for TXT) so heading checks are exact-match and
 * the test stays authoritative as templates evolve.
 *
 * Fixture: full Let the River Decide golden long-form multi-layer evaluation
 * rendered through the real download-route renderers.
 */

import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { normalizeEvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';
import { getShortFormSections } from '../../../lib/evaluation/shortFormSectionContract';
import {
  getLongFormMultiLayerSections,
  extractHtmlH2Headings,
  getForbiddenTopLevelHeadings,
  getForbiddenNearDuplicates,
} from '../../../lib/evaluation/sharedLongFormMultiLayerSections';
import mammoth from 'mammoth';

const LONG_FORM_REPORT_TYPE = 'DREAM Long-Form Multi-Layer Evaluation';

function buildLongFormMultiLayerDocument(input: {
  result: Parameters<typeof buildShortFormEvaluationDocument>[0]['result'];
  displayTitle: string;
}) {
  const doc = buildShortFormEvaluationDocument({
    displayTitle: input.displayTitle,
    reportType: LONG_FORM_REPORT_TYPE,
    result: input.result,
  });
  doc.templateMode = 'long_form_multi_layer_evaluation';
  return doc;
}

function buildGoldenRiverFixture() {
  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'Let the River Decide',
    result: {
      generated_at: '2026-06-27T19:00:00.000Z',
      overview: {
        overall_score_0_100: 72,
        verdict: 'revise',
        one_paragraph_summary:
          'Let the River Decide is a serious, atmospheric, adult literary eco-thriller / eco-spiritual road novel built around a memorable central proposition: water is not inert background, but witness, archive, nervous system, and judge. The manuscript\u2019s greatest assets are atmosphere, voice, thematic seriousness, environmental imagination, the Mike/Cliff relationship, the animal-sensory layer, and the repeated transformation of ordinary travel detail into moral pressure.',
        top_3_strengths: [
          'River-as-memory/judge premise is distinctive and powerful.',
          'Smokehouse Camp atmospheric and ceremonial material.',
          'Mike/Cliff relationship engine and animal-sensory layer.',
        ],
        top_3_risks: [
          'Over-evidence: manuscript repeatedly proves what scenes already show.',
          'Cultural/protocol uncertainty requires external sensitivity review.',
          'NV115/Plunkett threads need sharper payoff integration.',
        ],
      },
      enrichment: {
        trigger_warnings: ['violence', 'disappearances', 'environmental destruction', 'grief'],
        premise:
          'A man, his aging stepfather, and two dogs encounter a northern First Nation whose river may be remembering, judging, and removing those who profit from desecration.',
      },
      metrics: {
        manuscript: {
          title: 'Let the River Decide',
          word_count: 83_779,
          genre: 'Adult Literary Eco-Thriller / Eco-Spiritual Road Novel',
          target_audience:
            'Adult readers of literary eco-thriller, climate fiction, spiritual realism, road novels, family-inheritance fiction, and ethically complex environmental suspense',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 9,
          confidence_level: 'high',
          rationale:
            'The river-as-memory/judge premise, filtered through road-trip witness, Indigenous protocol, and corporate extraction, is distinctive and powerful.',
          recommendations: [
            {
              action: 'Sharpen NV115 payoff: either resolve as first symptom of river agency or cut ambiguous thread.',
              priority: 'medium',
              anchor_type: 'scene',
              anchor_snippet: 'The black truck appeared again at the third pullout.',
              symptom: 'NV115 thread creates dread but does not connect to resolution arc.',
              mechanism: 'Unresolved symbolic thread weakens closure.',
              specific_fix: 'Tie NV115 to final verdict sequence or reframe as ambient atmosphere only.',
              reader_effect: 'Reader dread dissipates without payoff.',
              mistake_proofing: 'Preserve atmospheric function even if plot thread is trimmed.',
            },
          ],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 7,
          confidence_level: 'high',
          rationale:
            'Strong opening, return-to-camp arc, and ending; middle research/ledger sections slow pressure.',
          recommendations: [
            {
              action: 'Compress evidence ledger by 15-25% to restore middle-act pacing.',
              priority: 'high',
              anchor_type: 'chapter_range',
              anchor_snippet: 'Chapters 4-8 expand documentary evidence at the cost of narrative momentum.',
              symptom: 'Middle act reads as research compilation rather than story progression.',
              mechanism: 'Over-evidence replaces scene-driven escalation with informational density.',
              specific_fix: 'Keep strongest 3-4 case studies; convert rest to compressed dossier entries.',
              reader_effect: 'Reader engagement drops in middle third.',
              mistake_proofing: 'Maintain sense of scale and pattern-recognition without exhaustive enumeration.',
            },
          ],
        },
        {
          key: 'character',
          score_0_10: 8,
          confidence_level: 'high',
          rationale:
            'Mike/Cliff relationship and animal-sensory layer are distinctive; secondary cast well-drawn.',
          recommendations: [],
        },
        {
          key: 'voice',
          score_0_10: 9,
          confidence_level: 'high',
          rationale:
            'Atmospheric, restrained, and distinctive; road-trip register filters all other layers.',
          recommendations: [],
        },
      ],
    },
  });

  const dream = {
    dream_scores: { quality: 72, readiness: 65, commercial: null, literary: null },
    executive_verdict:
      'Let the River Decide is a serious, atmospheric, adult literary eco-thriller / eco-spiritual road novel. The book begins with road-trip unease, missing-person posters, a black truck marked NV115, a remote river camp, and the vulnerability of two travelers with dogs at the edge of the Liard. The manuscript\u2019s greatest assets are atmosphere, voice, thematic seriousness, environmental imagination, the Mike/Cliff relationship, and the animal-sensory layer. The principal drag is over-evidence: the manuscript repeatedly tries to prove what the scenes already make the reader feel.',
    market_shelf: {
      best_shelf: 'Literary Eco-Thriller / Climate Fiction / Spiritual Realism / Road Novel',
      marketable_hook: 'A northern river may be remembering, judging, and removing those who profit from desecration.',
      shelf_neighbors: ['Literary eco-thriller', 'Climate fiction', 'Spiritual realism', 'Road novel'],
      comparison_space: ['Eco-spiritual suspense', 'First Nation sovereignty fiction'],
      market_danger: 'The book can be misread as generic eco-thriller.',
    },
    what_not_to_become: [
      'A documentary eco-mystery where the narrator supplies the governing theory instead of letting the river remain exact but not fully legible.',
      'A research-file novel where evidence ledgers replace narrative tension.',
    ],
    structural_stack: [
      { layer_name: 'Road-trip witness layer', status: 'strong', function: 'Gives the reader an outsider entry point.', revision_note: 'Maintain lived pattern without overexplaining.' },
      { layer_name: 'Smokehouse Camp / Tłekeh Dene layer', status: 'strong', function: 'Provides moral center and cultural ground.', revision_note: 'Treat as story custody, not exposition.' },
      { layer_name: 'River agency layer', status: 'strong', function: 'Converts environmental damage into active consequence.', revision_note: 'Remain exact but not fully overexplained.' },
    ],
    arc_map: [
      { act_name: 'Opening unease', chapter_range: '1\u20133', primary_function: 'Strong hook, atmosphere, immediate dread.', revision_priority: 'NV115 must pay off.' },
      { act_name: 'Research expansion', chapter_range: '4\u20138', primary_function: 'Broadens stakes and scale.', revision_priority: 'Reduce early certainty.' },
      { act_name: 'Return to camp', chapter_range: '26\u201331', primary_function: 'Best atmospheric material.', revision_priority: 'Cultural review needed.' },
    ],
    criterion_analyses: [
      {
        key: 'concept',
        score: 8.5,
        confidence: 'high',
        finding: 'River-as-memory/judge premise is distinctive and powerful.',
        evidence_anchors: ['river witness frame', 'road-trip structure'],
        fit_evidence: ['The river witness conceit unifies multiple threads.'],
        gap_evidence: ['NV115 thread not integrated into resolution.'],
        revision_queue: ['[LOCATION: Chapter 36] [OPERATION: integrate]—Connect NV115 to final verdict.'],
      },
      {
        key: 'narrativeDrive',
        score: 7.0,
        confidence: 'high',
        finding: 'Strong opening and ending; middle research sections slow pressure.',
        evidence_anchors: ['opening dread', 'Smokehouse return'],
        fit_evidence: ['Opening creates immediate atmospheric dread.'],
        gap_evidence: ['Middle chapters replace scene escalation with documentary enumeration.'],
        revision_queue: ['[LOCATION: Chapters 4-8] [OPERATION: compress]—Reduce documentary inserts by 25%.'],
      },
    ],
    layer_analyses: [
      { layer_name: 'Road-trip witness layer', strength: 'strong', needed_revision: 'Maintain outsider vulnerability.' },
      { layer_name: 'Smokehouse Camp layer', strength: 'excellent', needed_revision: 'Cultural review required.' },
    ],
    cross_layer_integration: [
      { motif: 'Water as memory and judgment', layers_connected: ['River agency', 'Smokehouse Camp'], strength: 'strong' },
      { motif: 'Dogs as sensory sentinels', layers_connected: ['Animal-sensory', 'Road-trip witness'], strength: 'strong' },
    ],
    symbolic_audit: {
      systems: [
        { symbol: 'River', status: 'central', function: 'Witness, archive, nervous system, judge.' },
        { symbol: 'NV115 / black truck', status: 'needs payoff', function: 'Dread and pattern recognition.' },
        { symbol: 'Dogs\u2019 refusals', status: 'strong', function: 'Embodied evidence of danger.' },
      ],
    },
    reader_experience: {
      opening: { reader_question: 'Why are these travelers anxious?', emotional_state: 'Road-trip unease.', risk: 'NV115 thread must pay off.' },
      midpoint: { reader_question: 'Is the river really doing this?', emotional_state: 'Growing uncertainty.', risk: 'Research sections may reduce mystery.' },
      final_act: { reader_question: 'Will Mike accept the witness charge?', emotional_state: 'Gravity, ceremony.', risk: 'Ending risks over-declaring meaning.' },
      aftertaste: 'The river remains exact but not fully legible.',
    },
    revision_plan: [
      { priority: 'P1', title: 'Compress evidence ledger by 15-25%.', goal: 'Restore middle-act pacing.', actions: ['Remove weakest 25% of documentary inserts.', 'Convert remaining to compressed dossier entries.'], acceptance_check: 'Pacing improves without losing scale.' },
      { priority: 'P2', title: 'Promote Leanna / Verdant earlier.', goal: 'Antagonist system present from midpoint.', actions: ['Seed Leanna/Verdant pressure in first third.'], acceptance_check: 'External antagonist has causal presence.' },
    ],
    releasability: [
      { dimension: 'Concept', current_status: 'Strong, distinctive', verdict: 'Close' },
      { dimension: 'Pacing', current_status: 'Middle drag from over-evidence', verdict: 'Revise' },
    ],
    acceptance_checks: {
      required_detection: ['Mike / Cliff / dogs as travel-family unit', 'River agency as symbolic system', 'Smokehouse Camp as protocol center'],
      failure_conditions: ['Fails if treated as generic eco-thriller.', 'Fails if river agency over-explained.'],
    },
    calibration_notes: ['Scoring calibrated for literary eco-thriller at 83,779 words.'],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

// ── Canonical section labels derived from template contracts ─────────────────
// Short-form §1–§14: titles from shortFormSectionContract (excluding title_block which is metadata, not a heading)
const SHORT_FORM_SECTION_TITLES = getShortFormSections()
  .filter(s => s.id !== 'title_block')
  .map(s => s.title);

// Long-form §12–§21: titles from sharedLongFormMultiLayerSections

// Combined expected TXT sections (TXT uses UPPER CASE headings).
// Short-form §2–§12 (excluding overlaps with long-form) + long-form sections that
// the fixture actually renders (optional sections like governed_ledgers may be absent
// if the fixture doesn't provide content for them).
const EXPECTED_TXT_SECTIONS = [
  ...SHORT_FORM_SECTION_TITLES.filter(t =>
    // Exclude sections that are superseded by long-form equivalents
    t !== 'Confidence Explanation' && t !== 'Author-Facing Disclaimer'
  ),
  // Include only the long-form sections whose fixture provides content.
  // The contract-based tests (below) validate presence/order dynamically.
  'Expanded Criterion Analysis',
  'Story Ledger or Layer-Aware Architecture Map',
  'Review Gate Readiness Surface',
  'Readiness / Releasability Posture',
  'Confidence Explanation',
  'Author-Facing Disclaimer',
].map(t => t.toUpperCase());

// Content strings that MUST appear on every surface
const PARITY_CONTENT_STRINGS = [
  'Let the River Decide',
  'River-as-memory/judge premise is distinctive and powerful.',
  'Smokehouse Camp atmospheric and ceremonial material.',
  'Over-evidence: manuscript repeatedly proves what scenes already show.',
  'A man, his aging stepfather, and two dogs encounter a northern First Nation',
  'violence',
  'disappearances',
  'Literary Eco-Thriller',
  '83,779',
  '72',
];

// Content strings specific to opportunity rendering (evidence/fix/symptom).
// Keep these short enough to avoid being split by TXT 78-char wrapping.
const OPPORTUNITY_CONTENT_STRINGS = [
  'black truck appeared again',
  'NV115 thread creates dread',
  'Compress evidence ledger',
  'Middle act reads as research',
];

// Defect invariants — must NOT appear on any surface
const FORBIDDEN_DEFECT_PATTERNS = [
  /the evaluation identified a concrete craft issue/i,
  /premise remains abstract rather than grounded/i,
  /\[LOCATION:/,
  /\[OPERATION:/,
  /\[PRIORITY:/,
  /\[SEVERITY:/,
];

/**
 * Extract TXT headings delimited by ASCII divider lines ('=' or '-').
 * The TXT renderer uses ASCII dividers, unlike the Unicode dividers the
 * shared extractTxtHeadings helper expects.
 */
function extractAsciiTxtHeadings(txtContent: string): string[] {
  const lines = txtContent.split('\n');
  const headings: string[] = [];
  const dividerPattern = /^[=-]{3,}$/;
  for (let i = 0; i < lines.length - 1; i++) {
    if (dividerPattern.test(lines[i].trim())) {
      const next = lines[i + 1]?.trim();
      if (next && next.length > 0 && !dividerPattern.test(next)) {
        headings.push(next);
      }
    }
  }
  return headings;
}

describe('surface-parity gate (UED → VM → TXT/HTML/DOCX)', () => {
  let txt: string;
  let html: string;
  let docxText: string;
  let docxHtml: string;
  let printCss: string;

  beforeAll(async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const { canonicalDoc, dream } = buildGoldenRiverFixture();
    const vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any, dreamDoc: dream as any });

    txt = testing.renderTxtFromViewModel(vm, 'parity-gate-job');
    html = testing.renderHtmlFromViewModel(vm, 'parity-gate-job');
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    docxText = (await mammoth.extractRawText({ buffer: docxBuffer })).value;

    // DOCX converted to HTML preserves heading hierarchy (Heading1 → h1, Heading2 → h2)
    docxHtml = (await mammoth.convertToHtml({ buffer: docxBuffer })).value;

    // Web print CSS for pagination-doctrine validation
    const fs = await import('fs');
    const path = await import('path');
    printCss = fs.readFileSync(
      path.join(process.cwd(), 'app/reports/[jobId]/report-page.module.css'),
      'utf-8',
    );
  });

  describe('section presence and order (TXT)', () => {
    test('all expected sections are present in TXT output', () => {
      for (const section of EXPECTED_TXT_SECTIONS) {
        expect(txt).toContain(section);
      }
    });

    test('sections appear in correct order in TXT', () => {
      let lastIndex = -1;
      for (const section of EXPECTED_TXT_SECTIONS) {
        const idx = txt.indexOf(section);
        expect(idx).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      }
    });
  });

  describe('content parity across surfaces', () => {
    test('core content strings present on all 3 surfaces', () => {
      for (const content of PARITY_CONTENT_STRINGS) {
        expect(txt).toContain(content);
        expect(html).toContain(content);
        expect(docxText).toContain(content);
      }
    });

    test('opportunity detail content present on all 3 surfaces', () => {
      for (const content of OPPORTUNITY_CONTENT_STRINGS) {
        expect(txt).toContain(content);
        expect(html).toContain(content);
        expect(docxText).toContain(content);
      }
    });

    test('opportunity counts match across surfaces', () => {
      const txtOpCount = (txt.match(/OPPORTUNITIES \(\d+\)/g) || []).length;
      const htmlOpCount = (html.match(/Opportunities \(\d+\)/g) || []).length;
      expect(txtOpCount).toBeGreaterThan(0);
      expect(txtOpCount).toBe(htmlOpCount);
    });

    test('score values match across surfaces', () => {
      expect(txt).toContain('72');
      expect(html).toContain('72');
      expect(docxText).toContain('72');

      // Criterion scores visible
      expect(txt).toContain('9/10');
      expect(html).toContain('9');
      expect(txt).toContain('7/10');
      expect(html).toContain('7');
    });

    test('DREAM long-form sections present on HTML and DOCX', () => {
      // Executive verdict from DREAM
      const execSnippet = 'The principal drag is over-evidence';
      expect(html).toContain(execSnippet);
      expect(docxText).toContain(execSnippet);
      expect(txt).toContain(execSnippet);

      // Structural stack layers
      expect(html).toContain('Road-trip witness layer');
      expect(docxText).toContain('Road-trip witness layer');
      expect(txt).toContain('Road-trip witness layer');

      // Market shelf
      expect(html).toContain('Literary Eco-Thriller');
      expect(docxText).toContain('Literary Eco-Thriller');
      expect(txt).toContain('Literary Eco-Thriller');
    });
  });

  describe('no-defect invariants', () => {
    test('no generic fallback prose on any surface', () => {
      for (const pattern of FORBIDDEN_DEFECT_PATTERNS) {
        expect(txt).not.toMatch(pattern);
        expect(html).not.toMatch(pattern);
        expect(docxText).not.toMatch(pattern);
      }
    });

    test('no double-wrapped evidence quotes on any surface', () => {
      // Smart quotes
      expect(txt).not.toMatch(/\u201c\u201c/);
      expect(txt).not.toMatch(/\u201d\u201d/);
      expect(html).not.toMatch(/\u201c\u201c/);
      expect(html).not.toMatch(/\u201d\u201d/);
      // Straight doubles
      expect(txt).not.toMatch(/""/);
      expect(html).not.toMatch(/""/);
    });

    test('TXT output has no lines exceeding 78 characters', () => {
      const overlong = txt.split('\n').filter((line) => line.length > 78);
      expect(overlong).toEqual([]);
    });

    test('no raw internal tokens leak to any surface', () => {
      for (const surface of [txt, html, docxText]) {
        expect(surface).not.toContain('[LOCATION:');
        expect(surface).not.toContain('[OPERATION:');
        expect(surface).not.toContain('[PRIORITY:');
        expect(surface).not.toContain('[SEVERITY:');
        expect(surface).not.toContain('revision_opportunity_ledger');
        expect(surface).not.toContain('raw_prompt');
        expect(surface).not.toContain('chain_of_thought');
      }
    });
  });

  describe('revision queue token projection', () => {
    test('revision queue items render structured fields (Location/Operation) not raw tokens', () => {
      // The fixture has [LOCATION: Chapter 36] [OPERATION: integrate] — these should
      // be projected by the VM into structured "Location: Chapter 36 | Operation: Integrate"
      // format, not rendered with bracket syntax.
      expect(txt).toContain('Location:');
      expect(txt).toContain('Operation:');
      // But NOT the raw bracket tokens
      expect(txt).not.toContain('[LOCATION:');
      expect(txt).not.toContain('[OPERATION:');
    });
  });

  describe('structural equivalence', () => {
    test('trigger warnings present on all surfaces', () => {
      for (const warning of ['violence', 'disappearances', 'environmental destruction', 'grief']) {
        expect(txt).toContain(warning);
        expect(html).toContain(warning);
        expect(docxText).toContain(warning);
      }
    });

    test('revision plan items present on all surfaces', () => {
      const planContent = 'Compress evidence ledger';
      expect(txt).toContain(planContent);
      expect(html).toContain(planContent);
      expect(docxText).toContain(planContent);
    });

    test('releasability dimensions present on all surfaces', () => {
      expect(txt).toContain('Concept');
      expect(txt).toContain('Pacing');
      expect(html).toContain('Concept');
      expect(html).toContain('Pacing');
      expect(docxText).toContain('Concept');
      expect(docxText).toContain('Pacing');
    });

    test('acceptance checks present on all surfaces', () => {
      const checkContent = 'Mike / Cliff / dogs as travel-family unit';
      expect(txt).toContain(checkContent);
      expect(html).toContain(checkContent);
      expect(docxText).toContain(checkContent);
    });
  });

  // ── Golden Master Certification: expanded checks ──────────────────────────

  describe('section order parity via template contracts', () => {
    // Use the canonical contracts and built-in validators.
    // Note: TXT uses UPPER CASE headings; the validator expects Title Case.
    // We normalize TXT headings by matching against contract titles case-insensitively.

    /** Map UPPER CASE TXT headings back to canonical Title Case for validation. */
    function normalizeTxtHeadingsToCanonical(extracted: string[]): string[] {
      const contractTitles = [
        ...getShortFormSections().map(s => s.title),
        ...getLongFormMultiLayerSections().map(s => s.title),
      ];
      return extracted.map(h => {
        const match = contractTitles.find(t => t.toUpperCase() === h.toUpperCase());
        return match ?? h;
      });
    }

    test('HTML headings include rendered §13–§21 sections in correct order', () => {
      const htmlHeadings = extractHtmlH2Headings(html);
      // Only check sections actually present (fixture may not render all optional sections)
      const requiredTitles = getLongFormMultiLayerSections()
        .filter(s => s.required)
        .map(s => s.title);
      const presentRequired = requiredTitles.filter(t => htmlHeadings.includes(t));
      // Verify they appear in contract-defined order
      let lastIdx = -1;
      for (const title of presentRequired) {
        const idx = htmlHeadings.indexOf(title);
        expect(idx).toBeGreaterThan(lastIdx);
        lastIdx = idx;
      }
      // At least some §13–§21 sections must be present
      expect(presentRequired.length).toBeGreaterThanOrEqual(5);
    });

    test('TXT headings include rendered §13–§21 sections in correct order', () => {
      const rawTxtHeadings = extractAsciiTxtHeadings(txt);
      const txtHeadings = normalizeTxtHeadingsToCanonical(rawTxtHeadings);
      const requiredTitles = getLongFormMultiLayerSections()
        .filter(s => s.required)
        .map(s => s.title);
      const presentRequired = requiredTitles.filter(t => txtHeadings.includes(t));
      let lastIdx = -1;
      for (const title of presentRequired) {
        const idx = txtHeadings.indexOf(title);
        expect(idx).toBeGreaterThan(lastIdx);
        lastIdx = idx;
      }
      expect(presentRequired.length).toBeGreaterThanOrEqual(5);
    });

    test('cross-surface heading parity: same §13–§21 sections present on HTML and TXT', () => {
      const htmlHeadings = extractHtmlH2Headings(html);
      const rawTxtHeadings = extractAsciiTxtHeadings(txt);
      const txtHeadings = normalizeTxtHeadingsToCanonical(rawTxtHeadings);
      // Every required long-form section present in HTML must also be in TXT and vice versa
      const contractTitles = getLongFormMultiLayerSections().map(s => s.title);
      for (const title of contractTitles) {
        const inHtml = htmlHeadings.includes(title);
        const inTxt = txtHeadings.includes(title);
        if (inHtml || inTxt) {
          expect({ title, html: inHtml, txt: inTxt }).toEqual({ title, html: inHtml, txt: inHtml });
        }
      }
    });

    test('no forbidden DREAM headings appear as top-level on any surface', () => {
      const forbidden = getForbiddenTopLevelHeadings();
      const nearDuplicates = getForbiddenNearDuplicates();
      const allForbidden = [...forbidden, ...nearDuplicates];
      // Check against EXTRACTED headings (not full text) to avoid substring false positives
      const htmlHeadings = extractHtmlH2Headings(html);
      const rawTxtHeadings = extractAsciiTxtHeadings(txt);
      for (const heading of allForbidden) {
        // HTML: check extracted <h2> headings for exact match
        expect(htmlHeadings).not.toContain(heading);
        // TXT: check extracted headings for case-insensitive exact match
        const upperForbidden = heading.toUpperCase();
        expect(rawTxtHeadings.map(h => h.toUpperCase())).not.toContain(upperForbidden);
      }
    });

    test('short-form contract sections (§1–§12) appear on HTML in order', () => {
      const shortFormTitles = getShortFormSections()
        .filter(s => s.id !== 'title_block' && s.id !== 'criteria_score_grid')
        .map(s => s.title);
      let lastIdx = -1;
      for (const title of shortFormTitles) {
        const idx = html.indexOf(title);
        if (idx > -1) {
          expect(idx).toBeGreaterThan(lastIdx);
          lastIdx = idx;
        }
      }
    });

    test('long-form contract sections appear in order on HTML and DOCX', () => {
      const longFormTitles = getLongFormMultiLayerSections()
        .filter(s => s.rendererVisibility.txt)
        .map(s => s.title);
      // HTML
      let lastIdx = -1;
      for (const title of longFormTitles) {
        const idx = html.indexOf(title);
        if (idx > -1) {
          expect(idx).toBeGreaterThan(lastIdx);
          lastIdx = idx;
        }
      }
      // DOCX
      lastIdx = -1;
      for (const title of longFormTitles) {
        const idx = docxText.indexOf(title);
        if (idx > -1) {
          expect(idx).toBeGreaterThan(lastIdx);
          lastIdx = idx;
        }
      }
    });
  });

  describe('recommendation field parity across surfaces', () => {
    // Every recommendation field that exists in one surface must exist in all
    const RECOMMENDATION_FIELDS = [
      'NV115 thread creates dread',
      'Unresolved symbolic thread weakens closure',
      'Tie NV115 to final verdict sequence',
      'Reader dread dissipates without payoff',
      'Middle act reads as research compilation',
      'Over-evidence replaces scene-driven escalation',
      'Keep strongest 3-4 case studies',
      'Reader engagement drops in middle third',
    ];

    test('all recommendation detail fields present on TXT', () => {
      for (const field of RECOMMENDATION_FIELDS) {
        expect(txt).toContain(field);
      }
    });

    test('all recommendation detail fields present on HTML', () => {
      for (const field of RECOMMENDATION_FIELDS) {
        expect(html).toContain(field);
      }
    });

    test('all recommendation detail fields present on DOCX', () => {
      for (const field of RECOMMENDATION_FIELDS) {
        expect(docxText).toContain(field);
      }
    });
  });

  describe('evidence snippet normalization across surfaces', () => {
    // Evidence anchors should be present without wrapping quotes on all surfaces
    const EVIDENCE_SNIPPETS = [
      'black truck appeared again at the third pullout',
      'Chapters 4-8 expand documentary evidence',
    ];

    test('evidence snippets present on all surfaces without double quotes', () => {
      for (const snippet of EVIDENCE_SNIPPETS) {
        expect(txt).toContain(snippet);
        expect(html).toContain(snippet);
        expect(docxText).toContain(snippet);
      }
    });

    test('no evidence snippet is wrapped in smart quotes on any surface', () => {
      for (const snippet of EVIDENCE_SNIPPETS) {
        // Should not be preceded/followed by smart quotes on the surface
        expect(txt).not.toContain(`\u201c${snippet}\u201d`);
        expect(html).not.toContain(`\u201c${snippet}\u201d`);
        expect(docxText).not.toContain(`\u201c${snippet}\u201d`);
      }
    });
  });

  describe('no renderer-specific omissions or additions', () => {
    // Core ViewModel data must not be present on one surface and missing on another
    const CROSS_SURFACE_CONTENT = [
      // DREAM-specific content
      'The principal drag is over-evidence',
      'Road-trip witness layer',
      'Smokehouse Camp',
      'River agency layer',
      'Opening unease',
      'Research expansion',
      'Return to camp',
      // Cross-layer integration
      'Water as memory and judgment',
      'Dogs as sensory sentinels',
      // Symbolic audit
      'Witness, archive, nervous system, judge',
      // Reader experience
      'Why are these travelers anxious',
      'Is the river really doing this',
      // Revision plan
      'Promote Leanna / Verdant earlier',
      // What not to become
      'A documentary eco-mystery',
    ];

    test('no content present on HTML but missing from TXT', () => {
      for (const content of CROSS_SURFACE_CONTENT) {
        if (html.includes(content)) {
          expect(txt).toContain(content);
        }
      }
    });

    test('no content present on HTML but missing from DOCX', () => {
      for (const content of CROSS_SURFACE_CONTENT) {
        if (html.includes(content)) {
          expect(docxText).toContain(content);
        }
      }
    });

    test('no content present on TXT but missing from HTML', () => {
      for (const content of CROSS_SURFACE_CONTENT) {
        if (txt.includes(content)) {
          expect(html).toContain(content);
        }
      }
    });
  });

  describe('opportunity counts match across all surfaces', () => {
    test('DOCX opportunity sections match TXT count', () => {
      // TXT uses "OPPORTUNITIES (N)" format
      const txtOpMatches = txt.match(/OPPORTUNITIES \((\d+)\)/g) || [];
      const txtCounts = txtOpMatches.map(m => parseInt(m.match(/\d+/)![0]));

      // DOCX uses same "OPPORTUNITIES (N)" format
      const docxOpMatches = docxText.match(/OPPORTUNITIES \((\d+)\)/gi) || [];
      const docxCounts = docxOpMatches.map(m => parseInt(m.match(/\d+/)![0]));

      expect(txtCounts.length).toBeGreaterThan(0);
      expect(txtCounts).toEqual(docxCounts);
    });

    test('HTML opportunity counts match TXT counts', () => {
      const txtOpMatches = txt.match(/OPPORTUNITIES \((\d+)\)/g) || [];
      const txtCounts = txtOpMatches.map(m => parseInt(m.match(/\d+/)![0]));

      const htmlOpMatches = html.match(/Opportunities \((\d+)\)/g) || [];
      const htmlCounts = htmlOpMatches.map(m => parseInt(m.match(/\d+/)![0]));

      expect(txtCounts.length).toBe(htmlCounts.length);
      expect(txtCounts).toEqual(htmlCounts);
    });
  });

  describe('TXT formatting rules', () => {
    test('no line exceeds 78 characters (canonical wrap enforcement)', () => {
      const lines = txt.split('\n');
      const overshoots = lines
        .map((l, i) => ({ line: i + 1, length: l.length, text: l }))
        .filter(({ length }) => length > 78);
      expect(overshoots).toEqual([]);
    });

    test('section separators are consistent width', () => {
      const separators = txt.split('\n').filter(line => /^[═─━]+$/.test(line.trim()));
      for (const sep of separators) {
        expect(sep.trim().length).toBeLessThanOrEqual(78);
      }
    });

    test('no consecutive blank lines (max 2 newlines)', () => {
      expect(txt).not.toMatch(/\n\n\n\n/);
    });

    test('every section heading is followed by content', () => {
      for (const section of EXPECTED_TXT_SECTIONS) {
        const idx = txt.indexOf(section);
        if (idx > -1) {
          // After section heading, there should be non-whitespace content within 5 lines
          const afterHeading = txt.substring(idx + section.length, idx + section.length + 500);
          const lines = afterHeading.split('\n').slice(0, 5);
          const hasContent = lines.some(l => l.trim().length > 0 && !/^[═─━]+$/.test(l.trim()));
          expect(hasContent).toBe(true);
        }
      }
    });
  });

  describe('layout and pagination doctrine', () => {
    test('download HTML stylesheet: sections, criterion cards, and opportunity blocks use soft pagination', () => {
      const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
      expect(style).toMatch(/section\{[^}]*break-inside:auto[^}]*page-break-inside:auto/);
      expect(style).toMatch(/\.card\{[^}]*break-inside:auto[^}]*page-break-inside:auto/);
      expect(style).toMatch(/\.opp-block\{[^}]*break-inside:auto[^}]*page-break-inside:auto/);
      expect(style).toMatch(/\.opp-recommendation\{[^}]*break-inside:auto[^}]*page-break-inside:auto/);
      expect(style).toMatch(/article\.card\{[^}]*break-inside:auto[^}]*page-break-inside:auto/);
      expect(style).not.toMatch(/(?:^|})\s*(?:section|article\.card|\.card|\.opp-block|\.opp-recommendation)\{[^}]*break-inside:avoid/);
    });

    test('download HTML stylesheet: only compact units stay intact and table headers repeat', () => {
      const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
      expect(style).toMatch(/\.score-grid-table thead\{display:table-header-group\}/);
      expect(style).toMatch(/\.score-grid-table tr\{[^}]*break-inside:avoid/);
      expect(style).toMatch(/\.metric,.dash-card,.opp-field\{[^}]*break-inside:avoid/);
      expect(style).toMatch(/h2\{[^}]*break-after:avoid[^}]*page-break-after:avoid/);
      expect(style).toMatch(/\.report-closing\{[^}]*break-inside:avoid[^}]*page-break-inside:avoid/);
      expect(html).toMatch(/<section class="sec-meta report-closing">[\s\S]*Confidence Explanation[\s\S]*Author-Facing Disclaimer[\s\S]*<\/section>/);
    });

    test('download HTML cover preserves the approved premium title-page composition', () => {
      const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
      expect(style).toMatch(/\.cover\{[^}]*min-height:9\.2in[^}]*background:#FFFDF9/);
      expect(style).toMatch(/\.brand\{[^}]*font-family:Helvetica[^}]*font-size:25pt[^}]*font-weight:700[^}]*text-align:center/);
      expect(style).toMatch(/\.title\{[^}]*font-family:Helvetica[^}]*font-size:28pt[^}]*font-weight:700/);
      expect(style).toMatch(/\.dashboard\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
      expect(style).toMatch(/\.cover-wide\{[^}]*text-align:left[^}]*break-inside:avoid/);
      expect(style).toMatch(/\.cover-compact\{[^}]*min-height:9\.2in/);
      expect(html).toContain('<div class="cover-rule"><span></span></div>');
      expect(html).toContain('<strong>Target Audience</strong>');
      expect(html).toContain('class="cover-reference"');
      const dashboard = html.match(/<div class="dashboard">([\s\S]*?)<\/div>\s*<div class="grid title-metadata-grid">/)?.[1] ?? '';
      expect(dashboard).toContain('Overall Score');
      expect(dashboard).toContain('Market Readiness');
      expect(dashboard).toContain('Genre');
      expect(dashboard).not.toContain('Target Audience');
    });

    test('download HTML preserves the approved typography and section hierarchy', () => {
      const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
      expect(style).toMatch(/body\{[^}]*font-family:Georgia[^}]*line-height:1\.28[^}]*font-size:11pt/);
      expect(style).toMatch(/h2\{[^}]*font-size:18pt[^}]*border-bottom:1px solid #D9D0C3/);
      expect(style).toMatch(/section\{[^}]*background:#FFFFFF[^}]*border:1px solid #D9D0C3[^}]*border-radius:9px/);
      expect(style).toMatch(/section\.sec-pitch\{border-left:3\.5px solid #C8A96E\}/);
      expect(style).toMatch(/section\.sec-risk\{border-left:3\.5px solid #8B2020\}/);
      expect(style).toMatch(/\.opp-key\{[^}]*font-weight:700[^}]*color:#8B6D4A/);
    });

    test('download HTML: page-break-before only appears for major divisions', () => {
      const pageBreaks = html.match(/page-break-before:\s*always/g) || [];
      // Should have at most a few major division breaks, not one per card
      expect(pageBreaks.length).toBeLessThan(5);
    });

    test('web print CSS: soft pagination doctrine (sections/articles may split)', () => {
      // The @media print block must set break-inside: auto on sections/articles
      const printBlock = printCss.slice(printCss.indexOf('@media print'));
      expect(printBlock).toContain('break-inside: auto');
      // No blanket break-inside: avoid on section or article selectors
      const avoidBlocks = printBlock.split('}').filter(block => block.includes('break-inside: avoid'));
      for (const block of avoidBlocks) {
        // avoid is only allowed on compact blocks: header, header aside, tr
        expect(block).not.toMatch(/^\s*\.\w+\s+section\s*[,{]/m);
        expect(block).not.toMatch(/^\s*\.\w+\s+article\s*[,{]/m);
      }
    });

    test('web print CSS: heading orphan protection (break-after: avoid on h1/h2/h3)', () => {
      const printBlock = printCss.slice(printCss.indexOf('@media print'));
      expect(printBlock).toContain('break-after: avoid');
      expect(printBlock).toMatch(/h1[\s\S]{0,80}h3\s*\{[\s\S]{0,120}break-after:\s*avoid/);
    });

    test('web print CSS: widow/orphan control on paragraphs and list items', () => {
      const printBlock = printCss.slice(printCss.indexOf('@media print'));
      expect(printBlock).toMatch(/orphans:\s*[2-9]/);
      expect(printBlock).toMatch(/widows:\s*[2-9]/);
    });

    test('download HTML: no duplicate confidence label in cover scorecard', () => {
      // When overallScoreConfidenceLabel === marketReadinessConfidenceLabel,
      // the label should appear only once (not twice stacked).
      const coverCard = html.match(/<aside class="readiness-card[^]*?<\/aside>/)?.[0] ?? '';
      const labelDivs = coverCard.match(/<div class="label">[^<]+<\/div>/g) || [];
      const labelTexts = labelDivs.map(d => d.replace(/<[^>]+>/g, ''));
      // No two adjacent labels should be identical
      for (let i = 1; i < labelTexts.length; i++) {
        if (labelTexts[i] === labelTexts[i - 1]) {
          expect({ duplicate: labelTexts[i], index: i }).toEqual({ duplicate: 'none', index: -1 });
        }
      }
    });

    test('web report is not gray-only: brand palette present in styles', () => {
      // The report page must carry the RevisionGrade brand palette
      // (gold/oxblood/cream), not a generic gray-only theme.
      // Print CSS references brand background/border colors:
      expect(printCss).toMatch(/#faf7f2/i); // cream surface
      expect(printCss).toMatch(/#d9a441|#b8922a/i); // brand gold
      // Download HTML also carries brand colors inline
      expect(html).toMatch(/#B8922A|#8B2E2E|#F5EFE0/i);
    });

    test('DOCX preserves professional heading hierarchy (Heading2 styles for sections)', () => {
      // mammoth maps DOCX Heading styles to h2 tags; every major section must
      // carry a real Heading style (not plain bold paragraphs)
      const h2s = docxHtml.match(/<h2[^>]*>/g) || [];
      expect(h2s.length).toBeGreaterThanOrEqual(10);
      // The section headings must match the canonical contract titles
      const docxHeadings = extractHtmlH2Headings(docxHtml);
      for (const title of ['One-Paragraph Pitch', 'Executive Summary', 'Confidence Explanation']) {
        expect(docxHeadings).toContain(title);
      }
    });

    test('DOCX heading order mirrors HTML heading order for shared sections', () => {
      const webHeadings = extractHtmlH2Headings(html);
      const docxHeadings = extractHtmlH2Headings(docxHtml);
      // Every long-form contract section present in both must be in the same relative order
      const contractTitles = getLongFormMultiLayerSections().map(s => s.title);
      const webOrder = contractTitles.filter(t => webHeadings.includes(t));
      const docxOrder = contractTitles.filter(t => docxHeadings.includes(t));
      const shared = webOrder.filter(t => docxOrder.includes(t));
      expect(shared.length).toBeGreaterThanOrEqual(5);
      expect(docxOrder.filter(t => shared.includes(t))).toEqual(shared);
    });

    test('TXT preserves hierarchy: dividers delimit every major section', () => {
      const txtHeadings = extractAsciiTxtHeadings(txt);
      // Every expected TXT section must be an extracted (divider-delimited) heading
      for (const section of EXPECTED_TXT_SECTIONS) {
        const found = txtHeadings.some(h => h.toUpperCase() === section);
        expect({ section, found }).toEqual({ section, found: true });
      }
    });
  });
});
