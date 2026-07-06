/**
 * Surface-Parity Gate Test
 *
 * Validates that UED → VM → TXT / HTML / DOCX produce identical content
 * (same sections, same order, same strings) and carry no rendering defects
 * (no generic fallback prose, no double-wrapped quotes, no overlong TXT lines,
 * no raw internal tokens).
 *
 * Fixture: full Let the River Decide golden long-form multi-layer evaluation
 * rendered through the real download-route renderers.
 */

import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { normalizeEvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';
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

// ── Canonical section labels expected across all surfaces ────────────────────
const EXPECTED_TXT_SECTIONS = [
  'ONE-PARAGRAPH PITCH',
  'ONE-SENTENCE PITCH',
  'PREMISE',
  'CONTENT WARNINGS',
  'REVISION OPPORTUNITY SUMMARY',
  'EXECUTIVE SUMMARY',
  'TOP STRENGTHS',
  'TOP RISKS',
  'TOP RECOMMENDATIONS',
  'CRITERION RATIONALES & SURFACED OPPORTUNITIES',
  'EXPANDED CRITERION ANALYSIS',
  'STORY LEDGER OR LAYER-AWARE ARCHITECTURE MAP',
  'REVIEW GATE READINESS SURFACE',
  'READINESS / RELEASABILITY POSTURE',
  'CONFIDENCE EXPLANATION',
  'AUTHOR-FACING DISCLAIMER',
];

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

describe('surface-parity gate (UED → VM → TXT/HTML/DOCX)', () => {
  let txt: string;
  let html: string;
  let docxText: string;

  beforeAll(async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const { canonicalDoc, dream } = buildGoldenRiverFixture();
    const vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any, dreamDoc: dream as any });

    txt = testing.renderTxtFromViewModel(vm, 'parity-gate-job');
    html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    docxText = (await mammoth.extractRawText({ buffer: docxBuffer })).value;
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
});
