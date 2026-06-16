import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import mammoth from 'mammoth';

describe('download adapters parity (Option A canonicalDoc)', () => {
  test('TXT and HTML adapters include canonical section content in consistent order', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'Sister',
      result: {
        generated_at: '2026-06-08T00:00:00.000Z',
        overview: {
          overall_score_0_100: 67,
          verdict: 'revise',
          one_paragraph_summary: 'A concise summary for parity output checks.',
          top_3_strengths: ['Voice consistency'],
          top_3_risks: ['Pacing drift'],
        },
        enrichment: {
          premise: 'A reflective recovery story.',
          trigger_warnings: ['substance abuse'],
          reading_grade_level: 8.2,
          dialogue_percentage: 6,
          narrative_percentage: 94,
        },
        metrics: {
          manuscript: {
            title: 'Sister',
            word_count: 4903,
            genre: 'memoir',
            target_audience: 'Adult readers',
          },
        },
        criteria: [
          {
            key: 'conceptAndCorePremise',
            score_0_10: 7,
            confidence_level: 'high',
            rationale: 'Core rationale',
            recommendations: [{ action: 'Sharpen opening beat.', priority: 'high' }],
          },
        ],
      },
    });

    const txt = testing.buildCanonicalTemplateTxt(canonicalDoc);
    const html = testing.renderCanonicalTemplateHtml(canonicalDoc);

    expect(txt).toContain('ONE-PARAGRAPH PITCH');
    expect(txt).toContain('A concise summary for parity output checks.');
    expect(txt.indexOf('ONE-PARAGRAPH PITCH')).toBeLessThan(txt.indexOf('ONE-SENTENCE PITCH'));
    expect(txt.indexOf('TOP STRENGTHS')).toBeLessThan(txt.indexOf('TOP RISKS'));

    expect(html).toContain('A concise summary for parity output checks.');
    expect(html).toContain('Voice consistency');
    expect(html).toContain('Pacing drift');
    expect(html).toContain('RevisionGrade™ Evaluation Report');
    expect(html).toContain('class="cover"');
    expect(html).toContain('Submitted Word Count');

    const docxBuffer = await testing.buildCanonicalTemplateDocx(canonicalDoc);
    expect(docxBuffer.length).toBeGreaterThan(100);
    expect(docxBuffer[0]).toBe(0x50); // PK zip magic header
    expect(docxBuffer[1]).toBe(0x4b);

    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });
    expect(docxText).toContain('RevisionGrade');
    expect(docxText).toContain('One-Paragraph Pitch');
    expect(docxText).toContain('Submitted Word Count');
    expect(docxText).toContain('Confidentiality');
  });

  test('opportunity detail rows (Evidence/Symptom/Cause/Fix/Reader effect) appear in all 3 formats', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const longEvidence = 'A dark truck, fast, heading toward the river, with a reference identifier 123e4567-e89b-12d3-a456-426614174000 and a long unbroken pressure phrase that must remain fully present instead of clipping off the right side of the generated report page.';
    const longFix = 'Insert a ticking-clock reminder every 800 words and keep the sentence fully visible even when it contains long-market-positioning-language-without-friendly-breakpoints.';

    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'River Remembers Blood',
      result: {
        generated_at: '2026-06-10T00:00:00.000Z',
        overview: {
          overall_score_0_100: 78,
          verdict: 'revise',
          one_paragraph_summary: 'Summary for detail-row parity check.',
          top_3_strengths: ['Strong voice'],
          top_3_risks: ['Pacing'],
        },
        enrichment: {
          premise: 'River as judge.',
          trigger_warnings: ['violence'],
          reading_grade_level: 7,
          dialogue_percentage: 44,
          narrative_percentage: 55,
        },
        metrics: {
          manuscript: { title: 'River', word_count: 4500, genre: 'literary fiction', target_audience: 'Adult readers' },
        },
        criteria: [
          {
            key: 'narrativeDrive',
            score_0_10: 8,
            confidence_level: 'moderate',
            rationale: 'Momentum starts with the eerie absence at the riverbank.',
            recommendations: [
              {
                priority: 'medium',
                action: 'Increase the stakes surrounding the missing man.',
                anchor_snippet: longEvidence,
                symptom: 'Stakes or decision pressure diffuses before reaching the reader.',
                mechanism: 'Mid-chapter tension release without replacement hook.',
                specific_fix: longFix,
                reader_effect: 'Sustains reader engagement and enhances narrative urgency.',
                mistake_proofing: 'Check each scene break for forward-pull sentence.',
              },
            ],
          },
        ],
        recommendations: {
          quick_wins: [{ action: 'Tighten the opening hook.', why: 'First page is decisive.', effort: 'low', impact: 'high' }],
          strategic_revisions: [{ action: 'Restructure middle act.', why: 'Pacing sag.', effort: 'high', impact: 'high' }],
        },
      },
    });

    const txt = testing.buildCanonicalTemplateTxt(canonicalDoc);
    const html = testing.renderCanonicalTemplateHtml(canonicalDoc);

    const overlongTxtLines = txt
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => line.length > 78);
    expect(overlongTxtLines).toEqual([]);

    // TXT must include all 6 diagnostic fields
    expect(txt).toContain('Evidence: \u201cA dark truck, fast, heading toward the river, with a referenc');
    expect(txt).toContain('identifier 123e4567-e89b-12d3-a456-426614174000');
    expect(txt).toContain('Symptom: Stakes or decision pressure diffuses before reaching the reader.');
    expect(txt).toContain('Cause: Mid-chapter tension release without replacement hook.');
    expect(txt).toContain('Fix direction: Insert a ticking-clock reminder every 800 words and keep');
    expect(txt).toContain('long-market-positioning-language-without-friendly-breakpoints.');
    expect(txt).toContain('Reader effect: Sustains reader engagement and enhances narrative urgency.');
    expect(txt).toContain('Mistake-proofing: Check each scene break for forward-pull sentence.');

    // TXT must include Action Items
    expect(txt).toContain('ACTION ITEMS');
    expect(txt).toContain('Strategic Revisions:');
    expect(txt).toContain('Increase the stakes surrounding the missing man.');
    expect(txt).toContain('Location: narrativeDrive:recommendation');

    // HTML/PDF must include all 6 diagnostic fields
    expect(html).not.toContain('class="score-box"');
    expect(html).not.toContain('background:#1C1814');
    expect(html).not.toContain('background: #1c1814');
    expect(html).not.toContain('<table class="opp-table">');
    expect(html).not.toContain('<em>\u201c');
    expect(html).not.toContain('<em>"');
    expect(html).toContain('class="readiness-card readiness-risk"');
    expect(html).toContain('class="opp-field"');
    expect(html).toContain('class="opp-val"');
    expect(html).toContain(longEvidence);
    expect(html).toContain('Stakes or decision pressure diffuses before reaching the reader.');
    expect(html).toContain('Mid-chapter tension release without replacement hook.');
    expect(html).toContain(longFix);
    expect(html).toContain('Sustains reader engagement and enhances narrative urgency.');
    expect(html).toContain('Check each scene break for forward-pull sentence.');

    // HTML/PDF must include Action Items
    expect(html).toContain('Action Items');
    expect(html).toContain('Strategic Revisions');
    expect(html).toContain('Increase the stakes surrounding the missing man.');
    expect(html).toContain('narrativeDrive:recommendation');

    // DOCX must include all 6 diagnostic fields
    const docxBuffer = await testing.buildCanonicalTemplateDocx(canonicalDoc);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });
    expect(docxText).toContain('A dark truck, fast, heading toward the river, with a reference identifier');
    expect(docxText).toContain('Stakes or decision pressure diffuses before reaching the reader.');
    expect(docxText).toContain('Mid-chapter tension release without replacement hook.');
    expect(docxText).toContain('Insert a ticking-clock reminder every 800 words and keep the sentence fully visible');
    expect(docxText).toContain('Sustains reader engagement and enhances narrative urgency.');
    expect(docxText).toContain('Check each scene break for forward-pull sentence.');

    // DOCX must include Action Items
    expect(docxText).toContain('Action Items');
    expect(docxText).toContain('Increase the stakes surrounding the missing man.');
    expect(docxText).toContain('narrativeDrive:recommendation');
  });

  test('renders DREAM template sections and suppresses UED multi-layer fallback sections when dream is present', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'Template Truth Manuscript',
      result: {
        generated_at: '2026-06-13T00:00:00.000Z',
        overview: {
          overall_score_0_100: 84,
          verdict: 'revise',
          one_paragraph_summary: 'Canonical summary for template-truth rendering.',
          top_3_strengths: ['Core premise clarity'],
          top_3_risks: ['Middle-act drift'],
        },
        enrichment: {
          premise: 'A manuscript tested against canonical template output.',
          trigger_warnings: ['violence'],
          reading_grade_level: 9,
          dialogue_percentage: 40,
          narrative_percentage: 60,
        },
        metrics: {
          manuscript: {
            title: 'Template Truth Manuscript',
            word_count: 80000,
            genre: 'thriller',
            target_audience: 'Adult thriller readers',
          },
        },
        criteria: [
          {
            key: 'narrativeDrive',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'Strong scene momentum with occasional slack.',
            recommendations: [{ action: 'Tighten midpoint transition.', priority: 'high' }],
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
      manuscriptScaleContinuityFindings: ['UED continuity findings marker'],
      revisionPriorityPlan: [
        {
          priority: 'P1',
          title: 'UED fallback plan marker',
          location: 'Midpoint',
          operation: 'tighten',
          recommendation: 'UED fallback recommendation marker',
          rationale: 'UED fallback rationale marker',
        },
      ],
      storyLedgerArchitectureMap: ['UED fallback marker'],
      reviewGateReadinessSurface: ['UED review gate marker'],
      governedLedgerAddenda: ['UED governed ledger marker'],
      crossLayerSynthesis: ['UED cross-layer marker'],
      layerAwareRevisionSequencing: ['UED sequencing marker'],
      continuityCoverageProof: ['UED continuity marker'],
      readinessReleasabilityPosture: 'UED readiness posture marker',
    };

    const dream = {
      dream_scores: { quality: 91, readiness: 86, commercial: 82, literary: 88 },
      executive_verdict: 'Dream-driven executive verdict appears in all adapters.',
      market_shelf: {
        best_shelf: 'Upmarket suspense',
        marketable_hook: 'A witness discovers a staged memory.',
        shelf_neighbors: ['The Push', 'The It Girl'],
        comparison_space: ['Psychological suspense'],
        market_danger: 'Could blur into generic thriller positioning.',
      },
      what_not_to_become: ['A generic puzzle thriller that loses its emotional wound.'],
      structural_stack: [
        {
          layer_name: 'Causal Spine',
          status: 'stable',
          function: 'Maintain escalating consequence.',
          revision_note: 'Increase causal linkage at chapter breaks.',
        },
      ],
      arc_map: [
        {
          act_name: 'Act I',
          chapter_range: '1-8',
          primary_function: 'Establish danger and obligation.',
          revision_priority: 'Sharpen inciting event sequencing.',
        },
      ],
      criterion_analyses: [
        {
          key: 'narrativeDrive',
          score: 8,
          confidence: 'high',
          fit_evidence: ['Escalation is visible scene to scene.'],
          gap_evidence: ['Midpoint stakes briefly diffuse.'],
          revision_queue: ['[LOCATION: Midpoint] [OPERATION: tighten] Add consequence beat.'],
        },
      ],
      layer_analyses: [
        {
          layer_name: 'Memory Layer',
          status: 'moderate',
          needed_revision: 'Clarify the rules of remembered versus staged evidence.',
        },
      ],
      cross_layer_integration: [
        {
          motif: 'Red shoes',
          description: 'The image should connect witness memory to final agency.',
          integration_quality: 'moderate',
          revision_note: 'Echo the image before the final reveal.',
        },
      ],
      revision_plan: [
        {
          priority: 'P1',
          title: 'Restore midpoint pressure',
          goal: 'Sustain momentum through the middle third.',
          actions: ['Move reversal one page earlier.'],
          acceptance_check: 'Midpoint retains explicit forward pressure.',
        },
      ],
      releasability: [
        { dimension: 'Narrative Cohesion', current_status: 'Strong with revision notes', verdict: 'Revise' },
      ],
      acceptance_checks: {
        required_detection: ['Detect that the memory layer changes the thriller spine.'],
        failure_conditions: ['Fail if the report treats the manuscript as a flat procedural.'],
      },
    } as any;

    const txt = testing.buildCanonicalTemplateTxt(canonicalDoc, dream, 'job-template-truth');
    const html = testing.renderCanonicalTemplateHtml(canonicalDoc, dream, 'job-template-truth');
    const docxBuffer = await testing.buildCanonicalTemplateDocx(canonicalDoc, dream, 'job-template-truth');
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    expect(txt).toContain('NARRATIVE SYNTHESIS — HOLISTIC CRAFT ASSESSMENT');
    expect(txt).toContain('MARKET SHELF');
    expect(txt).toContain('What Not to Become:');
    expect(txt).toContain('A generic puzzle thriller that loses its emotional wound.');
    expect(txt).toContain('LAYER ANALYSIS');
    expect(txt).toContain('Memory Layer');
    expect(txt).toContain('CROSS-LAYER INTEGRATION');
    expect(txt).toContain('Red shoes');
    expect(txt).toContain('REVIEW GATE');
    expect(txt).toContain('Detect that the memory layer changes the thriller spine.');
    expect(txt).toContain('Location: Midpoint | Operation: Tighten | Recommendation: Add consequence beat.');
    expect(txt).not.toContain('[LOCATION: Midpoint]');
    expect(txt).not.toContain('STORY LEDGER OR LAYER-AWARE ARCHITECTURE MAP');
    expect(txt).not.toContain('UED fallback marker');

    expect(html).toContain('Narrative Synthesis');
    expect(html).toContain('Market Shelf');
    expect(html).toContain('What Not to Become');
    expect(html).toContain('A generic puzzle thriller that loses its emotional wound.');
    expect(html).toContain('Layer Analysis');
    expect(html).toContain('Memory Layer');
    expect(html).toContain('Cross-Layer Integration');
    expect(html).toContain('Red shoes');
    expect(html).toContain('Review Gate');
    expect(html).toContain('Detect that the memory layer changes the thriller spine.');
    expect(html).toContain('Location: Midpoint | Operation: Tighten | Recommendation: Add consequence beat.');
    expect(html).not.toContain('[LOCATION: Midpoint]');
    expect(html).toContain('Dream-driven executive verdict appears in all adapters.');
    expect(html).not.toContain('Story Ledger or Layer-Aware Architecture Map');
    expect(html).not.toContain('UED fallback marker');
    expect(html).not.toContain('<p>None supplied.</p>');

    expect(docxText).toContain('Narrative Synthesis');
    expect(docxText).toContain('Market Shelf');
    expect(docxText).toContain('What Not to Become');
    expect(docxText).toContain('A generic puzzle thriller that loses its emotional wound.');
    expect(docxText).toContain('Layer Analysis');
    expect(docxText).toContain('Memory Layer');
    expect(docxText).toContain('Cross-Layer Integration');
    expect(docxText).toContain('Red shoes');
    expect(docxText).toContain('Review Gate');
    expect(docxText).toContain('Detect that the memory layer changes the thriller spine.');
    expect(docxText).toContain('Location: Midpoint | Operation: Tighten | Recommendation: Add consequence beat.');
    expect(docxText).not.toContain('[LOCATION: Midpoint]');
    expect(docxText).toContain('Dream-driven executive verdict appears in all adapters.');
    expect(docxText).not.toContain('Story Ledger or Layer-Aware Architecture Map');
    expect(docxText).not.toContain('UED fallback marker');
  });

  test('does not let score-grid table CSS clip opportunity detail rows in PDF downloads', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'Diamonds Aren\'t Forever',
      result: {
        generated_at: '2026-06-14T00:00:00.000Z',
        overview: {
          overall_score_0_100: 72,
          verdict: 'revise',
          one_paragraph_summary: 'PDF CSS scoping regression test.',
          top_3_strengths: ['Strong premise'],
          top_3_risks: ['Pacing drift'],
        },
        enrichment: {
          premise: 'A heist gone wrong.',
          trigger_warnings: [],
          reading_grade_level: 9,
          dialogue_percentage: 30,
          narrative_percentage: 70,
        },
        metrics: { manuscript: { title: 'Diamonds', word_count: 6000, genre: 'thriller', target_audience: 'Adult readers' } },
        criteria: [
          {
            key: 'pacing',
            score_0_10: 6,
            confidence_level: 'moderate',
            rationale: 'Pacing stalls in the second act.',
            recommendations: [
              {
                priority: 'high',
                action: 'Tighten the second act.',
                anchor_snippet: 'The long corridor stretched endlessly, and she counted each fluorescent light overhead — one, two, three — until the pattern blurred into monotony and the reader lost all sense of temporal urgency.',
                symptom: 'Pacing stalls where reflective passages delay forward momentum.',
                mechanism: 'Extended interior monologue without scene-level stakes.',
                specific_fix: 'Insert a ticking-clock element at the chapter midpoint to restore urgency.',
                reader_effect: 'Maintains forward momentum through the mid-novel transition.',
                mistake_proofing: 'Check each chapter for at least one forward-pull sentence in the final paragraph.',
              },
            ],
          },
        ],
      },
    });

    const html = testing.renderCanonicalTemplateHtml(canonicalDoc);

    // Short-form: score-grid table MUST have scoped class
    expect(html).toContain('class="score-grid-table"');

    // Short-form: nth-child column rules scoped to .score-grid-table, not global
    const sfStyleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    expect(sfStyleMatch).toBeTruthy();
    const sfNthRules = sfStyleMatch![1].match(/[^\n;{}]*nth-child[^;{}]*/g) || [];
    for (const rule of sfNthRules) {
      expect(rule).toContain('.score-grid-table');
    }

    // Opportunity values use div-based layout, not table cells
    expect(html).toContain('class="opp-field"');
    expect(html).toContain('class="opp-val"');
    expect(html).not.toContain('<table class="opp-table">');
    expect(html).not.toContain('<td class="opp-val">');

    // opp-val CSS allows wrapping
    expect(html).toContain('white-space:normal');
    expect(html).toContain('overflow-wrap:anywhere');

    // Long evidence text is fully present (not truncated)
    expect(html).toContain('The long corridor stretched endlessly');
    expect(html).toContain('the reader lost all sense of temporal urgency.');
  });

  test('long-form premium PDF scopes score-grid CSS to .score-grid-table class', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const result = {
      generated_at: '2026-06-14T00:00:00.000Z',
      overview: {
        overall_score_0_100: 72,
        verdict: 'revise',
        one_paragraph_summary: 'Long-form PDF CSS scoping test.',
        top_3_strengths: ['Strong premise'],
        top_3_risks: ['Pacing drift'],
      },
      enrichment: {
        premise: 'A heist gone wrong.',
        trigger_warnings: [],
        reading_grade_level: 9,
        dialogue_percentage: 30,
        narrative_percentage: 70,
      },
      metrics: { manuscript: { title: 'Diamonds', word_count: 55000, genre: 'thriller', target_audience: 'Adult readers' } },
      criteria: [
        {
          key: 'pacing',
          score_0_10: 6,
          confidence_level: 'moderate',
          rationale: 'Pacing stalls.',
          recommendations: [
            {
              priority: 'high',
              action: 'Tighten second act.',
              anchor_snippet: 'She counted each fluorescent light overhead until the pattern blurred.',
              symptom: 'Pacing stalls.',
              mechanism: 'Extended interior monologue.',
              specific_fix: 'Insert ticking-clock element.',
              reader_effect: 'Maintains momentum.',
              mistake_proofing: 'Check each chapter for forward-pull sentence.',
            },
          ],
        },
      ],
    };

    const metadata = {
      displayTitle: 'Diamonds Aren\'t Forever',
      generatedAt: '2026-06-14',
      score: '72/100',
      verdict: 'Revise',
      wordCount: 55000,
      estimatedPages: 220,
      reportType: 'Long-Form Evaluation',
      shelf: 'Fiction',
      genre: 'Thriller',
      targetAudience: 'Adult readers',
    };

    const html = testing.renderPremiumReportHtml(result, metadata, 'Summary fallback.', null, null);

    // Long-form: score-grid table MUST use .score-grid-table class
    expect(html).toContain('class="score-grid-table"');

    // No global unscoped th/td nth-child column rules — all must be scoped to .score-grid-table
    // Extract CSS style block
    const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    expect(styleMatch).toBeTruthy();
    const css = styleMatch![1];

    // table-layout:fixed must only appear on .score-grid-table, not globally
    expect(css).not.toMatch(/^\s*table\s*\{[^}]*table-layout:\s*fixed/m);
    expect(css).toContain('.score-grid-table');

    // nth-child column rules must be scoped to .score-grid-table
    const nthChildRules = css.match(/[^\n]*nth-child[^\n]*/g) || [];
    for (const rule of nthChildRules) {
      expect(rule).toContain('.score-grid-table');
    }
  });
});
