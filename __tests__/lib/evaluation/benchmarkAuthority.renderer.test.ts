import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mammoth from 'mammoth';
import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { normalizeEvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';

const CONTRACT_ROOT = join(process.cwd(), 'tests/benchmark-authority');

type BenchmarkContract = {
  mode: 'short_form_evaluation' | 'long_form_multi_layer_evaluation';
  required_public_strings: string[];
  forbidden_public_strings: string[];
};

function loadContract(relativePath: string): BenchmarkContract {
  return JSON.parse(readFileSync(join(CONTRACT_ROOT, relativePath), 'utf8')) as BenchmarkContract;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSurfaceText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function assertStableStringsRenderEverywhere(params: {
  contract: BenchmarkContract;
  stableStrings: string[];
  txt: string;
  html: string;
  docxText: string;
}) {
  const txtPlain = normalizeSurfaceText(params.txt);
  const htmlPlain = normalizeSurfaceText(stripHtmlTags(params.html));
  const docxPlain = normalizeSurfaceText(params.docxText);

  for (const expected of params.stableStrings) {
    expect(params.contract.required_public_strings).toContain(expected);
    const normalized = normalizeSurfaceText(expected);
    expect(txtPlain).toContain(normalized);
    expect(htmlPlain).toContain(normalized);
    expect(docxPlain).toContain(normalized);
  }
}

function assertForbiddenStringsDoNotLeak(params: {
  contract: BenchmarkContract;
  txt: string;
  html: string;
  docxText: string;
}) {
  for (const forbidden of params.contract.forbidden_public_strings) {
    expect(params.txt).not.toContain(forbidden);
    expect(params.html).not.toContain(forbidden);
    expect(params.docxText).not.toContain(forbidden);
  }
}

function buildGoldenShortFormDocument() {
  return buildShortFormEvaluationDocument({
    displayTitle: 'Ancient Bloodlines',
    result: {
      generated_at: '2026-06-27T12:00:00.000Z',
      overview: {
        overall_score_0_100: 68,
        verdict: 'revise',
        one_paragraph_summary:
          'Ancient Bloodlines demonstrates strong conceptual ambition and genuine emotional intelligence in its handling of bullying, disability, grief, and interspecies cooperation, but struggles with pacing inconsistency, tonal register instability, and structural imbalance in the final third.',
        top_3_strengths: [
          'Cross-species relationship engine built through action rather than exposition.',
          'Ecological authenticity grounding the fantasy in observable natural systems.',
          'Anti-bullying narrative without didacticism.',
        ],
        top_3_risks: [
          'Tonal instability between gentle middle-grade fable and graphic violence.',
          'Mythology overload without grounding.',
          'Pacing collapse in Chapter 5.',
        ],
      },
      enrichment: {
        premise: 'Newton, a young rough-skinned newt with a damaged leg, must survive bullying, predation, and species prejudice to forge an unprecedented cross-species alliance.',
        trigger_warnings: ['animal-on-animal violence', 'parental death', 'environmental degradation', 'emotional abuse'],
        reading_grade_level: 5.8,
        dialogue_percentage: 35,
        narrative_percentage: 65,
      },
      metrics: {
        manuscript: {
          title: 'Ancient Bloodlines',
          word_count: 12200,
          genre: 'Middle-Grade Fantasy / Ecological Fable',
          target_audience: 'Middle-grade readers (ages 8\u201312) interested in animal fantasy, environmental themes, and anti-bullying narratives',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 8,
          confidence_level: 'high',
          rationale: 'The premise of a disabled newt forging cross-species alliance to save dying populations is original, commercially viable in the middle-grade animal fantasy space, and structurally sound.',
          recommendations: [],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 6,
          confidence_level: 'high',
          rationale: 'The first three chapters maintain strong forward momentum through immediate physical danger. Chapters 5\u20136 lose propulsive energy as exposition replaces action.',
          recommendations: [
            {
              priority: 'high',
              action: 'Restructure Chapter 5 creation myth as interrupted storytelling.',
              anchor_snippet: 'Thorander\'s creation myth monologue (~2,000 words of uninterrupted backstory).',
              anchor_type: 'paraphrased_observation',
              symptom: 'Narrative momentum halts completely during a static lecture scene.',
              mechanism: 'The mythology is delivered as exposition rather than embedded in dramatic action.',
              specific_fix: 'Restructure as interrupted storytelling with counterpoint tension.',
              reader_effect: 'Maintains engagement through the middle third while still delivering essential world-building.',
              mistake_proofing: 'Do not cut the creation myth entirely; it establishes the thematic foundation for cross-species cooperation.',
            },
          ],
        },
        {
          key: 'voice',
          score_0_10: 6,
          confidence_level: 'moderate',
          rationale: 'The narrative voice oscillates between close third-person perspective and an omniscient narrator who comments philosophically.',
          recommendations: [],
        },
      ],
    },
  });
}

function buildGoldenDreamFixture() {
  const canonicalDoc = buildShortFormEvaluationDocument({
    displayTitle: 'The Burning Archive',
    result: {
      generated_at: '2026-05-27T14:00:00.000Z',
      overview: {
        overall_score_0_100: 82,
        verdict: 'revise',
        one_paragraph_summary:
          'The Burning Archive delivers a layered historical thriller with strong structural integrity, but the emotional arc of the protagonist needs deeper grounding in the middle act.',
        top_3_strengths: [
          'Multi-layered timeline architecture is well-managed.',
          'The archival mystery creates genuine intellectual suspense.',
          'Period voice is consistent across both timeline strands.',
        ],
        top_3_risks: [
          'Protagonist emotional arc flattens in chapters 12 through 18.',
          'The dual-timeline transitions occasionally disorient the reader.',
          'Climax resolution relies on a coincidence that weakens earned tension.',
        ],
      },
      enrichment: {
        premise: 'A modern archivist discovers coded messages in a medieval manuscript that reveal a suppressed historical event.',
        trigger_warnings: ['violence', 'political persecution'],
        reading_grade_level: 11,
        dialogue_percentage: 42,
        narrative_percentage: 58,
      },
      metrics: {
        manuscript: {
          title: 'The Burning Archive',
          word_count: 92000,
          genre: 'historical thriller',
          target_audience: 'Adult historical fiction and thriller readers',
        },
      },
      criteria: [
        {
          key: 'conceptAndCorePremise',
          score_0_10: 9,
          confidence_level: 'high',
          rationale: 'The dual-timeline mystery premise is compelling and well-structured.',
          recommendations: [
            {
              priority: 'medium',
              action: 'Clarify the stakes of the historical discovery for the modern protagonist.',
              anchor_snippet: 'The coded page shimmered under UV light, its secrets waiting centuries for this moment.',
              anchor_type: 'verbatim_quote',
              symptom: 'Modern stakes feel academic rather than personal.',
              mechanism: 'The protagonist lacks personal consequences tied to the discovery.',
              specific_fix: 'Link the historical secret to the protagonist family history.',
              reader_effect: 'Transforms intellectual curiosity into personal urgency.',
              mistake_proofing: 'Verify the modern timeline has personal stakes by chapter 5.',
            },
          ],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 7,
          confidence_level: 'high',
          rationale: 'Strong forward drive in both timelines with a mid-novel sag.',
          recommendations: [],
        },
      ],
    },
  });

  canonicalDoc.templateMode = 'long_form_multi_layer_evaluation';

  const dream = {
    dream_scores: { quality: 88, readiness: 82, commercial: 79, literary: 85 },
    executive_verdict:
      'The Burning Archive is a structurally ambitious dual-timeline thriller with genuine intellectual suspense. The primary revision target is deepening the protagonist emotional arc in chapters 12 through 18.',
    market_shelf: {
      best_shelf: 'Historical thriller',
      marketable_hook: 'Coded medieval manuscript reveals suppressed history.',
      shelf_neighbors: ['The Historian', 'The Shadow of the Wind'],
      comparison_space: ['Historical mystery', 'Literary thriller'],
      market_danger: 'Risk of being shelved as pure literary fiction if thriller pacing falters.',
    },
    what_not_to_become: [
      'A dry academic procedural that loses its thriller spine.',
      'A Dan Brown clone that sacrifices literary depth for plot mechanics.',
    ],
    structural_stack: [
      {
        layer_name: 'Timeline Architecture',
        status: 'stable',
        function: 'Maintain dual-timeline coherence and pacing balance.',
        revision_note: 'Tighten modern-timeline chapters 12 through 18.',
      },
      {
        layer_name: 'Mystery Layer',
        status: 'strong',
        function: 'Drive intellectual suspense through coded manuscript clues.',
        revision_note: 'Ensure clue density remains consistent through the middle third.',
      },
    ],
    arc_map: [
      {
        act_name: 'Act I',
        chapter_range: '1-8',
        primary_function: 'Establish dual timelines and the central mystery.',
        revision_priority: 'Strengthen the personal stakes in the modern timeline opening.',
      },
      {
        act_name: 'Act II',
        chapter_range: '9-22',
        primary_function: 'Deepen the investigation and complicate both timelines.',
        revision_priority: 'Address pacing sag in chapters 12 through 18.',
      },
      {
        act_name: 'Act III',
        chapter_range: '23-32',
        primary_function: 'Converge timelines and resolve the central mystery.',
        revision_priority: 'Reduce reliance on coincidence in the climax.',
      },
    ],
    criterion_analyses: [
      {
        key: 'conceptAndCorePremise',
        score: 9,
        confidence: 'high',
        fit_evidence: ['Dual-timeline structure is well-integrated with the mystery premise.'],
        gap_evidence: ['Modern stakes remain primarily intellectual.'],
        revision_queue: [
          '[LOCATION: Chapter 5] [OPERATION: deepen] Connect the discovery to protagonist family history.',
        ],
      },
      {
        key: 'narrativeDrive',
        score: 7,
        confidence: 'high',
        fit_evidence: ['Strong forward momentum in Acts I and III.'],
        gap_evidence: ['Mid-novel research chapters reduce pressure.'],
        revision_queue: [
          '[LOCATION: Chapters 12-18] [OPERATION: tighten] Interleave research with rising-action beats.',
        ],
      },
    ],
    layer_analyses: [
      {
        layer_name: 'Emotional Arc',
        status: 'moderate',
        needed_revision: 'Deepen protagonist emotional response to discoveries.',
      },
    ],
    cross_layer_integration: [
      {
        motif: 'Fire imagery',
        description: 'Fire connects the medieval burning to the modern preservation crisis.',
        integration_quality: 'strong',
        revision_note: 'Echo fire imagery in the modern timeline climax.',
      },
    ],
    symbolic_audit: {
      preserved_symbols: [
        {
          symbol: 'The coded manuscript',
          current_function: 'Central plot device connecting both timelines.',
          revision_instruction: 'Ensure the manuscript appears in at least one scene per modern-timeline act.',
        },
      ],
      doctrine_strengths: ['Consistent use of archival imagery reinforces intellectual atmosphere.'],
      doctrine_risks: ['Fire symbolism may become heavy-handed if overused in Act III.'],
      audit_conclusion: 'Symbolic architecture is sound with minor risk of over-emphasis in the climax.',
    },
    reader_experience: {
      first_act: {
        reader_question: 'What secret does this manuscript hold?',
        emotional_state: 'Intellectual curiosity mixed with atmospheric unease.',
        risk: 'Risk of over-exposition in the modern-timeline setup.',
      },
      middle: {
        reader_question: 'Will the archivist survive the consequences of the discovery?',
        emotional_state: 'Growing tension but occasional impatience during research sequences.',
        risk: 'Pacing sag may cause reader disengagement.',
      },
      final_act: {
        reader_question: 'Was the suppression justified, and at what cost?',
        emotional_state: 'Moral complexity and cathartic resolution.',
        risk: 'Climax coincidence may undermine earned tension.',
      },
      aftertaste: 'A lingering question about what other secrets remain buried in archives.',
    },
    revision_plan: [
      {
        priority: 'P1',
        title: 'Deepen protagonist emotional arc',
        goal: 'Create personal stakes that match the intellectual stakes.',
        actions: [
          'Link the discovery to protagonist family history by chapter 5.',
          'Add emotional beats in chapters 12 through 18.',
        ],
        acceptance_check: 'Protagonist has personal stakes visible by chapter 5 and sustained through Act II.',
      },
      {
        priority: 'P2',
        title: 'Tighten mid-novel pacing',
        goal: 'Maintain thriller momentum through the research-heavy middle.',
        actions: ['Interleave research chapters with action beats.'],
        acceptance_check: 'No three consecutive chapters without an action or threat beat.',
      },
    ],
    releasability: [
      {
        dimension: 'Narrative Cohesion',
        current_status: 'Strong with revision notes on mid-novel pacing.',
        verdict: 'Revise',
      },
      {
        dimension: 'Emotional Depth',
        current_status: 'Needs deepening in protagonist arc.',
        verdict: 'Revise',
      },
    ],
    acceptance_checks: {
      required_detection: [
        'Must detect dual-timeline structure and evaluate coherence.',
        'Must identify the mid-novel pacing issue.',
      ],
      failure_conditions: [
        'Fails if treated as a single-timeline narrative.',
        'Fails if pacing issue in chapters 12-18 is not flagged.',
      ],
    },
    calibration_notes: [
      'Scoring calibrated for dual-timeline historical thriller expectations.',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

describe('benchmark authority contracts through real renderers', () => {
  test('short-form benchmark contract renders through ViewModel, TXT, HTML/PDF, and DOCX', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const contract = loadContract('short-form/expected.json');
    const vm = normalizeEvaluationReportViewModel({ ued: buildGoldenShortFormDocument() as any });

    expect(vm.templateMode).toBe('short_form_evaluation');
    expect(vm.titleBlock.displayTitle).toBe('Ancient Bloodlines');

    const txt = testing.renderTxtFromViewModel(vm);
    const html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const docxText = (await mammoth.extractRawText({ buffer: docxBuffer })).value;

    assertStableStringsRenderEverywhere({
      contract,
      txt,
      html,
      docxText,
      stableStrings: [
        'Ancient Bloodlines',
        'Middle-Grade Fantasy / Ecological Fable',
        '68',
        'Cross-species relationship engine built through action rather than exposition.',
        'Tonal instability between gentle middle-grade fable and graphic violence.',
        'Concept & Core Premise',
        'Narrative Drive & Momentum',
        'Point of View & Voice Control',
        'Author retains ownership of manuscript content',
      ],
    });

    assertForbiddenStringsDoNotLeak({ contract, txt, html, docxText });
  });

  test('DREAM benchmark contract renders through ViewModel, TXT, HTML/PDF, and DOCX', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const contract = loadContract('long-form-multi-layer/expected.json');
    const { canonicalDoc, dream } = buildGoldenDreamFixture();
    const vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any, dreamDoc: dream });

    expect(vm.templateMode).toBe('long_form_multi_layer_evaluation');
    expect(vm.longFormMultiLayerEvaluation).not.toBeNull();

    const txt = testing.renderTxtFromViewModel(vm);
    const html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const docxText = (await mammoth.extractRawText({ buffer: docxBuffer })).value;

    assertStableStringsRenderEverywhere({
      contract,
      txt,
      html,
      docxText,
      stableStrings: [
        'The Burning Archive',
        'historical thriller',
        'Adult historical fiction and thriller readers',
        'Historical thriller',
        'Coded medieval manuscript reveals suppressed history.',
        'Timeline Architecture',
        'Mystery Layer',
        'Act I',
        'Act II',
        'Act III',
        'Dual-timeline structure is well-integrated with the mystery premise.',
        'Modern stakes remain primarily intellectual.',
        'Fire imagery',
        'The coded manuscript',
        'A lingering question about what other secrets remain buried in archives.',
        'Deepen protagonist emotional arc',
        'Tighten mid-novel pacing',
        'Must detect dual-timeline structure and evaluate coherence.',
      ],
    });

    expect(txt).not.toContain('[LOCATION:');
    expect(html).not.toContain('[LOCATION:');
    expect(docxText).not.toContain('[LOCATION:');
    expect(txt).not.toContain('[OPERATION:');
    expect(html).not.toContain('[OPERATION:');
    expect(docxText).not.toContain('[OPERATION:');
    assertForbiddenStringsDoNotLeak({ contract, txt, html, docxText });
  });
});
