/**
 * Rendering Parity Tests
 *
 * Proves end-to-end content parity across all four output surfaces:
 *   ViewModel (Web source) → TXT → HTML/PDF → DOCX
 *
 * Two certified fixtures:
 *   1. Short-form evaluation
 *   2. Long-form multi-layer evaluation (DREAM)
 *
 * Parity checks confirm no renderer adds, drops, reorders, or recalculates
 * content relative to the single ViewModel source of truth.
 */

import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { normalizeEvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';
import type { EvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';
import mammoth from 'mammoth';

// ── Fixture Builders ──────────────────────────────────────────────────────

function buildShortFormFixture() {
  return buildShortFormEvaluationDocument({
    displayTitle: 'Parity Test: The Cartographer',
    result: {
      generated_at: '2026-05-27T12:00:00.000Z',
      overview: {
        overall_score_0_100: 74,
        verdict: 'revise',
        one_paragraph_summary:
          'The Cartographer builds a distinctive world through layered cartographic metaphor, but pacing falters in the second act where introspective passages overshadow forward momentum.',
        top_3_strengths: [
          'Distinctive cartographic voice with consistent metaphor integration.',
          'Strong opening chapter that grounds the reader in sensory detail.',
          'Compelling secondary characters who challenge the protagonist.',
        ],
        top_3_risks: [
          'Pacing stalls in the middle third where reflection replaces action.',
          'The antagonist motivation remains opaque past the midpoint.',
          'Dialogue tags occasionally overpower the spoken lines.',
        ],
      },
      enrichment: {
        premise: 'A retired mapmaker discovers her final commission hides a colonial secret.',
        trigger_warnings: ['colonialism', 'loss of a parent'],
        reading_grade_level: 10.2,
        dialogue_percentage: 38,
        narrative_percentage: 62,
      },
      metrics: {
        manuscript: {
          title: 'The Cartographer',
          word_count: 5200,
          genre: 'literary fiction',
          target_audience: 'Adult literary fiction readers',
        },
      },
      criteria: [
        {
          key: 'conceptAndCorePremise',
          score_0_10: 8,
          confidence_level: 'high',
          rationale: 'The cartographic conceit is fresh and well-integrated into both plot and theme.',
          recommendations: [
            {
              priority: 'medium',
              action: 'Deepen the colonial layer in the second half.',
              anchor_snippet: 'She traced the river, noticing how every bend had been renamed.',
              anchor_type: 'verbatim_quote',
              symptom: 'Colonial subtext introduced late without sufficient groundwork.',
              mechanism: 'Key thematic threads surface only in the final third.',
              specific_fix: 'Seed one colonial reference per chapter from chapter 3 onward.',
              reader_effect: 'Creates cohesive thematic throughline rather than late revelation.',
              mistake_proofing: 'Verify each chapter has at least one colonial-era reference after chapter 3.',
            },
          ],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 6,
          confidence_level: 'moderate',
          rationale: 'Momentum is strong in Act I but diffuses during extended cartographic digressions.',
          recommendations: [
            {
              priority: 'high',
              action: 'Add a ticking-clock element by chapter 8.',
              anchor_snippet: 'Days passed in the archive, each map yielding less than the last.',
              anchor_type: 'paraphrased_observation',
              symptom: 'Reader engagement drops during research montage sequences.',
              mechanism: 'Repetitive scene structure without escalating stakes.',
              specific_fix: 'Insert a deadline — the archive is closing, or a rival collector emerges.',
              reader_effect: 'Restores urgency and forward momentum.',
              mistake_proofing: 'Check each research scene for at least one stakes-raising beat.',
            },
          ],
        },
      ],
    },
  });
}

function buildLongFormFixture() {
  const canonicalDoc = buildShortFormEvaluationDocument({
    displayTitle: 'Parity Test: The Burning Archive',
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
          recommendations: [
            {
              priority: 'high',
              action: 'Tighten chapters 12 through 18.',
              symptom: 'Pacing falters in the middle third.',
              mechanism: 'Three consecutive research chapters without action beats.',
              specific_fix: 'Interleave research chapters with escalating threat scenes.',
              reader_effect: 'Maintains momentum through the mid-novel transition.',
              mistake_proofing: 'Each research chapter must contain at least one rising-action beat.',
            },
          ],
        },
      ],
      recommendations: {
        quick_wins: [],
        strategic_revisions: [],
      },
    },
  });

  canonicalDoc.templateMode = 'long_form_multi_layer_evaluation';
  (canonicalDoc as any).modeSpecific = {
    manuscriptScaleContinuityFindings: ['Timeline consistency holds across both strands.'],
    revisionPriorityPlan: [],
    storyLedgerArchitectureMap: ['Dual-timeline structure with chapter-level interleaving.'],
    reviewGateReadinessSurface: ['Structural integrity verified across both timelines.'],
    governedLedgerAddenda: [],
    crossLayerSynthesis: ['Historical and modern timelines converge at chapter 24.'],
    layerAwareRevisionSequencing: ['Revise emotional arc before addressing timeline transitions.'],
    continuityCoverageProof: ['All planted clues resolve by the final chapter.'],
    readinessReleasabilityPosture: 'Near market ready pending emotional arc revision.',
  };

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
        gap_evidence: ['Pacing falters during extended research sequences in Act II.'],
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
    calibration_notes: [
      'Scoring calibrated for dual-timeline historical thriller expectations.',
    ],
  } as any;

  return { canonicalDoc, dream };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function extractTextContent(rendered: string): string[] {
  return rendered
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
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

function vmContentStrings(vm: EvaluationReportViewModel): string[] {
  const strings: string[] = [];

  // Title block
  strings.push(vm.titleBlock.displayTitle);
  strings.push(vm.titleBlock.overallScoreLabel);
  strings.push(vm.titleBlock.marketReadiness);
  strings.push(vm.titleBlock.genre);
  strings.push(vm.titleBlock.targetAudience);

  // Pitches
  strings.push(vm.oneParagraphPitch);
  strings.push(vm.oneSentencePitch);
  if (vm.premise) strings.push(vm.premise);

  // Executive
  strings.push(vm.executiveSummary);
  strings.push(...vm.topStrengths);
  strings.push(...vm.topRisks);

  // Criteria
  for (const c of vm.criterionDetails) {
    strings.push(c.label);
    strings.push(c.rationaleText);
    for (const r of c.recommendations) {
      if (r.symptom) strings.push(r.symptom);
      if (r.mechanism) strings.push(r.mechanism);
      if (r.specific_fix) strings.push(r.specific_fix);
      if (r.reader_effect) strings.push(r.reader_effect);
      if (r.mistake_proofing) strings.push(r.mistake_proofing);
    }
  }

  return strings;
}

function assertContentPresent(output: string, contentStrings: string[], format: string): void {
  for (const content of contentStrings) {
    // Normalize for comparison: collapse whitespace
    const normalized = content.replace(/\s+/g, ' ').trim();
    const outputNormalized = output.replace(/\s+/g, ' ');
    expect(outputNormalized).toContain(normalized);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Rendering Parity: Short-Form Fixture', () => {
  let vm: EvaluationReportViewModel;
  let txt: string;
  let html: string;
  let docxText: string;

  beforeAll(async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const canonicalDoc = buildShortFormFixture();
    vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any });

    txt = testing.renderTxtFromViewModel(vm);
    html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    docxText = result.value;
  });

  test('VM produces expected field values from certified short-form fixture', () => {
    expect(vm.titleBlock.displayTitle).toBe('Parity Test: The Cartographer');
    expect(vm.templateMode).toBe('short_form_evaluation');
    expect(vm.topStrengths.length).toBe(3);
    expect(vm.topRisks.length).toBe(3);
    expect(vm.criterionDetails.length).toBeGreaterThanOrEqual(2);
    expect(vm.longFormMultiLayerEvaluation).toBeNull();
  });

  test('TXT contains all VM content strings', () => {
    const content = vmContentStrings(vm);
    for (const s of content) {
      const normalized = s.replace(/\s+/g, ' ').trim();
      // TXT may word-wrap, so join lines and check
      const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      expect(txtJoined).toContain(normalized);
    }
  });

  test('HTML/PDF contains all VM content strings', () => {
    const content = vmContentStrings(vm);
    const htmlPlain = stripHtmlTags(html);
    for (const s of content) {
      const normalized = s.replace(/\s+/g, ' ').trim();
      expect(htmlPlain).toContain(normalized);
    }
  });

  test('DOCX contains all VM content strings', () => {
    const content = vmContentStrings(vm);
    for (const s of content) {
      const normalized = s.replace(/\s+/g, ' ').trim();
      const docxNormalized = docxText.replace(/\s+/g, ' ');
      expect(docxNormalized).toContain(normalized);
    }
  });

  test('no renderer adds content not in the VM', () => {
    // Banned strings that should never appear in short-form output
    const banned = [
      'ACTION ITEMS',
      'Strategic Revisions:',
      'Quick Wins:',
    ];
    for (const b of banned) {
      expect(txt).not.toContain(b);
      expect(html).not.toContain(b);
      expect(docxText).not.toContain(b);
    }
  });

  test('section ordering is consistent across TXT, HTML, DOCX', () => {
    // All three formats must show pitch before strengths, strengths before risks
    const txtJoined = txt.replace(/\n/g, ' ');
    const htmlPlain = stripHtmlTags(html);
    const docxNorm = docxText.replace(/\s+/g, ' ');

    const pitchText = vm.oneParagraphPitch.slice(0, 30);
    const strengthText = vm.topStrengths[0].slice(0, 30);
    const riskText = vm.topRisks[0].slice(0, 30);

    // TXT ordering
    expect(txtJoined.indexOf(pitchText)).toBeLessThan(txtJoined.indexOf(strengthText));
    expect(txtJoined.indexOf(strengthText)).toBeLessThan(txtJoined.indexOf(riskText));

    // HTML ordering
    expect(htmlPlain.indexOf(pitchText)).toBeLessThan(htmlPlain.indexOf(strengthText));
    expect(htmlPlain.indexOf(strengthText)).toBeLessThan(htmlPlain.indexOf(riskText));

    // DOCX ordering
    expect(docxNorm.indexOf(pitchText)).toBeLessThan(docxNorm.indexOf(strengthText));
    expect(docxNorm.indexOf(strengthText)).toBeLessThan(docxNorm.indexOf(riskText));
  });

  test('score values are identical across all formats', () => {
    const scoreLabel = vm.titleBlock.overallScoreLabel;
    const txtJoined = txt.replace(/\n/g, ' ');
    const htmlPlain = stripHtmlTags(html);

    expect(txtJoined).toContain(scoreLabel);
    expect(htmlPlain).toContain(scoreLabel);
    // DOCX may format differently but should contain the numeric score
    const scoreMatch = scoreLabel.match(/(\d+(?:\.\d+)?)/);
    if (scoreMatch) {
      expect(docxText).toContain(scoreMatch[1]);
    }
  });

  test('disclaimer appears in all formats', () => {
    // TXT wraps lines, so check for key phrases instead of full disclaimer
    const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    expect(txtJoined).toContain('Author retains ownership of manuscript content');
    expect(stripHtmlTags(html)).toContain('Author retains ownership of manuscript content');
    expect(docxText).toContain('RevisionGrade');
  });
});

describe('Rendering Parity: Long-Form Multi-Layer Fixture', () => {
  let vm: EvaluationReportViewModel;
  let txt: string;
  let html: string;
  let docxText: string;

  beforeAll(async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const { canonicalDoc, dream } = buildLongFormFixture();
    vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any, dreamDoc: dream });

    txt = testing.renderTxtFromViewModel(vm);
    html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    docxText = result.value;
  });

  test('VM produces expected field values from certified long-form fixture', () => {
    expect(vm.titleBlock.displayTitle).toBe('Parity Test: The Burning Archive');
    expect(vm.templateMode).toBe('long_form_multi_layer_evaluation');
    expect(vm.longFormMultiLayerEvaluation).not.toBeNull();
    const lf = vm.longFormMultiLayerEvaluation!;
    expect(lf.structuralStack.length).toBe(2);
    expect(lf.arcMap.length).toBe(3);
    expect(lf.criterionAnalyses.length).toBe(2);
    expect(lf.revisionPlan.length).toBe(2);
    expect(lf.symbolicAudit).not.toBeNull();
    expect(lf.readerExperience).not.toBeNull();
  });

  test('DREAM executive verdict appears in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    const verdict = lf.executiveVerdict;
    const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const htmlPlain = stripHtmlTags(html);
    const docxNorm = docxText.replace(/\s+/g, ' ');

    expect(txtJoined).toContain(verdict);
    expect(htmlPlain).toContain(verdict);
    expect(docxNorm).toContain(verdict);
  });

  test('structural stack entries appear in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    for (const layer of lf.structuralStack) {
      const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      const htmlPlain = stripHtmlTags(html);
      const docxNorm = docxText.replace(/\s+/g, ' ');

      expect(txtJoined).toContain(layer.layerName);
      expect(htmlPlain).toContain(layer.layerName);
      expect(docxNorm).toContain(layer.layerName);
    }
  });

  test('arc map entries appear in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    for (const act of lf.arcMap) {
      const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      const htmlPlain = stripHtmlTags(html);
      const docxNorm = docxText.replace(/\s+/g, ' ');

      expect(txtJoined).toContain(act.actName);
      expect(htmlPlain).toContain(act.actName);
      expect(docxNorm).toContain(act.actName);
    }
  });

  test('criterion analysis content appears in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    for (const ca of lf.criterionAnalyses) {
      const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      const htmlPlain = stripHtmlTags(html);
      const docxNorm = docxText.replace(/\s+/g, ' ');

      for (const fit of ca.fitEvidence) {
        expect(txtJoined).toContain(fit);
        expect(htmlPlain).toContain(fit);
        expect(docxNorm).toContain(fit);
      }
      for (const gap of ca.gapEvidence) {
        expect(txtJoined).toContain(gap);
        expect(htmlPlain).toContain(gap);
        expect(docxNorm).toContain(gap);
      }
    }
  });

  test('revision queue items render structured displayText (not raw bracket syntax)', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    for (const ca of lf.criterionAnalyses) {
      for (const rq of ca.revisionQueue) {
        const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        const htmlPlain = stripHtmlTags(html);
        const docxNorm = docxText.replace(/\s+/g, ' ');

        // DisplayText should appear (structured form)
        expect(txtJoined).toContain(rq.displayText);
        expect(htmlPlain).toContain(rq.displayText);
        expect(docxNorm).toContain(rq.displayText);
      }
    }

    // Raw bracket syntax must NOT appear
    expect(txt).not.toContain('[LOCATION:');
    expect(txt).not.toContain('[OPERATION:');
    expect(html).not.toContain('[LOCATION:');
    expect(html).not.toContain('[OPERATION:');
    expect(docxText).not.toContain('[LOCATION:');
    expect(docxText).not.toContain('[OPERATION:');
  });

  test('market shelf data appears in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    const ms = lf.marketShelf;
    const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const htmlPlain = stripHtmlTags(html);
    const docxNorm = docxText.replace(/\s+/g, ' ');

    if (ms.bestShelf) {
      expect(txtJoined).toContain(ms.bestShelf);
      expect(htmlPlain).toContain(ms.bestShelf);
      expect(docxNorm).toContain(ms.bestShelf);
    }
    if (ms.marketableHook) {
      expect(txtJoined).toContain(ms.marketableHook);
      expect(htmlPlain).toContain(ms.marketableHook);
      expect(docxNorm).toContain(ms.marketableHook);
    }
  });

  test('symbolic audit content appears in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    const sa = lf.symbolicAudit!;
    const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const htmlPlain = stripHtmlTags(html);
    const docxNorm = docxText.replace(/\s+/g, ' ');

    expect(txtJoined).toContain(sa.auditConclusion);
    expect(htmlPlain).toContain(sa.auditConclusion);
    expect(docxNorm).toContain(sa.auditConclusion);

    for (const ps of sa.preservedSymbols) {
      expect(txtJoined).toContain(ps.symbol);
      expect(htmlPlain).toContain(ps.symbol);
      expect(docxNorm).toContain(ps.symbol);
    }
  });

  test('reader experience content appears in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    const re = lf.readerExperience!;
    const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const htmlPlain = stripHtmlTags(html);
    const docxNorm = docxText.replace(/\s+/g, ' ');

    if (re.aftertaste) {
      expect(txtJoined).toContain(re.aftertaste);
      expect(htmlPlain).toContain(re.aftertaste);
      expect(docxNorm).toContain(re.aftertaste);
    }
  });

  test('revision plan items appear in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    for (const rp of lf.revisionPlan) {
      const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      const htmlPlain = stripHtmlTags(html);
      const docxNorm = docxText.replace(/\s+/g, ' ');

      expect(txtJoined).toContain(rp.title);
      expect(htmlPlain).toContain(rp.title);
      expect(docxNorm).toContain(rp.title);

      expect(txtJoined).toContain(rp.goal);
      expect(htmlPlain).toContain(rp.goal);
      expect(docxNorm).toContain(rp.goal);
    }
  });

  test('releasability entries appear in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    for (const rel of lf.releasability) {
      const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
      const htmlPlain = stripHtmlTags(html);
      const docxNorm = docxText.replace(/\s+/g, ' ');

      expect(txtJoined).toContain(rel.dimension);
      expect(htmlPlain).toContain(rel.dimension);
      expect(docxNorm).toContain(rel.dimension);
    }
  });

  test('acceptance checks appear in all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    const ac = lf.acceptanceChecks!;
    const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const htmlPlain = stripHtmlTags(html);
    const docxNorm = docxText.replace(/\s+/g, ' ');

    for (const rd of ac.requiredDetection) {
      expect(txtJoined).toContain(rd);
      expect(htmlPlain).toContain(rd);
      expect(docxNorm).toContain(rd);
    }
    for (const fc of ac.failureConditions) {
      expect(txtJoined).toContain(fc);
      expect(htmlPlain).toContain(fc);
      expect(docxNorm).toContain(fc);
    }
  });

  test('no renderer drops content that exists in the VM', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    const allVmStrings = [
      ...vmContentStrings(vm),
      lf.executiveVerdict,
      ...lf.structuralStack.map(s => s.layerName),
      ...lf.arcMap.map(a => a.actName),
      ...lf.criterionAnalyses.flatMap(ca => [...ca.fitEvidence, ...ca.gapEvidence]),
    ];

    const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const htmlPlain = stripHtmlTags(html);
    const docxNorm = docxText.replace(/\s+/g, ' ');

    for (const s of allVmStrings) {
      const normalized = s.replace(/\s+/g, ' ').trim();
      if (normalized.length < 3) continue;
      expect(txtJoined).toContain(normalized);
      expect(htmlPlain).toContain(normalized);
      expect(docxNorm).toContain(normalized);
    }
  });

  test('long-form template section headings appear in all formats', () => {
    const expectedHeadings = [
      'Story Ledger',
      'Review Gate',
      'Cross-Layer Synthesis',
    ];
    const txtUpper = txt.toUpperCase();
    const htmlPlain = stripHtmlTags(html);

    for (const heading of expectedHeadings) {
      expect(txtUpper).toContain(heading.toUpperCase());
      expect(htmlPlain).toContain(heading);
      expect(docxText).toContain(heading);
    }
  });

  test('no forbidden internal artifacts leak to any format', () => {
    const forbidden = [
      'WAVE',
      'Final External Audit',
      'Golden Spine',
      'Dialogue Canon',
      'revision_opportunity_ledger',
      'revision_canon_metadata',
    ];
    for (const f of forbidden) {
      expect(txt).not.toContain(f);
      expect(html).not.toContain(f);
      expect(docxText).not.toContain(f);
    }
  });

  test('score values are consistent across all formats', () => {
    const lf = vm.longFormMultiLayerEvaluation!;
    const scores = lf.scores;
    const txtJoined = txt.replace(/\n/g, ' ');
    const htmlPlain = stripHtmlTags(html);

    if (scores.quality !== null) {
      expect(txtJoined).toContain(String(scores.quality));
      expect(htmlPlain).toContain(String(scores.quality));
      expect(docxText).toContain(String(scores.quality));
    }
    if (scores.readiness !== null) {
      expect(txtJoined).toContain(String(scores.readiness));
      expect(htmlPlain).toContain(String(scores.readiness));
      expect(docxText).toContain(String(scores.readiness));
    }
  });
});
