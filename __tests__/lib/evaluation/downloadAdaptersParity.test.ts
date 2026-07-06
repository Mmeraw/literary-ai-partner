import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { normalizeEvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';
import mammoth from 'mammoth';

const buildVm = (canonicalDoc: ReturnType<typeof buildShortFormEvaluationDocument>) =>
  normalizeEvaluationReportViewModel({ ued: canonicalDoc as any });

describe('download adapters parity (ViewModel renderers)', () => {
  test('TXT score grid renders Not scorable without truncation and no trailing spaces', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'Score Grid Test',
      result: {
        generated_at: '2026-07-06T00:00:00.000Z',
        overview: {
          overall_score_0_100: 75,
          verdict: 'revise',
          one_paragraph_summary: 'Score grid presentation check.',
          top_3_strengths: ['Strong premise.'],
          top_3_risks: ['Pacing issues.'],
        },
        enrichment: { premise: 'A test.', trigger_warnings: [], reading_grade_level: 8, dialogue_percentage: 30, narrative_percentage: 70 },
        metrics: { manuscript: { title: 'Score Grid Test', word_count: 5000, genre: 'Literary Fiction', target_audience: 'Adult readers' } },
        criteria: [
          { key: 'concept', score_0_10: 8, confidence_level: 'high', rationale: 'Strong.', recommendations: [] },
          // A criterion with no score produces "Not scorable" (12 chars) — must not be truncated to 10
          { key: 'voice', score_0_10: undefined as unknown as number, confidence_level: 'low', rationale: 'Insufficient evidence.', recommendations: [] },
        ],
      },
    });

    const txt = testing.renderTxtFromViewModel(buildVm(canonicalDoc));
    const lines = txt.split('\n');
    const gridLines = lines.filter((line) => line.includes('Not scor'));

    expect(gridLines.length).toBeGreaterThan(0);
    expect(gridLines[0]).toContain('Not scorable');
    expect(gridLines[0]).not.toContain('Not scora…');

    const gridSection = lines.filter((_, i) => {
      const heading = lines.findIndex((l) => l.includes('CRITERIA SCORE GRID'));
      const next = lines.findIndex((l, j) => j > heading && l.startsWith('-----'));
      return i > heading && i < (next === -1 ? lines.length : next + 5);
    });
    expect(gridSection.filter((l) => / {2,}$/.test(l))).toEqual([]);
    expect(lines.filter((l) => l.length > 78)).toEqual([]);
  });

  test('TXT title-block metadata uses hanging indents without changing field content', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const longAudience = 'Adult readers of literary eco-thriller, climate fiction, spiritual realism, road novels, family-inheritance fiction, and ethically complex environmental suspense';
    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'Long Metadata Fixture',
      result: {
        generated_at: '2026-07-06T00:00:00.000Z',
        overview: {
          overall_score_0_100: 82,
          verdict: 'revise',
          one_paragraph_summary: 'A concise summary for metadata formatting checks.',
          top_3_strengths: ['Strong atmospheric premise.'],
          top_3_risks: ['Some middle-act drift.'],
        },
        enrichment: {
          premise: 'A river may remember what people try to forget.',
          trigger_warnings: [],
          reading_grade_level: 9,
          dialogue_percentage: 30,
          narrative_percentage: 70,
        },
        metrics: {
          manuscript: {
            title: 'Long Metadata Fixture',
            word_count: 78500,
            genre: 'Literary Eco-Thriller / Eco-Spiritual Road Novel',
            target_audience: longAudience,
          },
        },
        criteria: [
          {
            key: 'concept',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'The premise is distinctive and clear.',
            recommendations: [],
          },
        ],
      },
    });

    const txt = testing.renderTxtFromViewModel(buildVm(canonicalDoc));
    const txtJoined = txt.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const lines = txt.split('\n');
    const targetAudienceLine = lines.findIndex((line) => line.startsWith('Target Audience:'));
    const targetAudienceContinuationIndent = ' '.repeat('Target Audience: '.length);

    expect(txtJoined).toContain(longAudience);
    expect(targetAudienceLine).toBeGreaterThanOrEqual(0);
    expect(lines[targetAudienceLine + 1]).toMatch(new RegExp(`^${targetAudienceContinuationIndent}\\S`));
    expect(lines.filter((line) => line.length > 78)).toEqual([]);
  });

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

    const vm = buildVm(canonicalDoc);
    const txt = testing.renderTxtFromViewModel(vm);
    const html = testing.renderHtmlFromViewModel(vm);

    expect(txt).toContain('ONE-PARAGRAPH PITCH');
    expect(txt).toContain('A concise summary for parity output checks.');
    expect(txt.indexOf('ONE-PARAGRAPH PITCH')).toBeLessThan(txt.indexOf('ONE-SENTENCE PITCH'));
    expect(txt.indexOf('TOP STRENGTHS')).toBeLessThan(txt.indexOf('TOP RISKS'));

    expect(html).toContain('A concise summary for parity output checks.');
    expect(html).toContain('Voice consistency');
    expect(html).toContain('Pacing drift');
    expect(html).toContain('RevisionGrade™ Evaluation Report');
    expect(html).toContain('class="cover"');
    expect(html).toContain('class="grid title-metadata-grid"');
    expect(html).toContain('class="grid summary-grid"');
    expect(html).toContain('Submitted Word Count');

    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    expect(docxBuffer.length).toBeGreaterThan(100);
    expect(docxBuffer[0]).toBe(0x50); // PK zip magic header
    expect(docxBuffer[1]).toBe(0x4b);

    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });
    expect(docxText).toContain('RevisionGrade');
    expect(docxText).toContain('One-Paragraph Pitch');
    expect(docxText).toContain('Submitted Word Count');
    expect(docxText).toContain('Estimated Pages');
    expect(docxText).toContain('Dialogue/Narrative Ratio');
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

    const vm = buildVm(canonicalDoc);
    const txt = testing.renderTxtFromViewModel(vm);
    const html = testing.renderHtmlFromViewModel(vm);

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

    const txtLines = txt.split('\n');
    const evidenceLine = txtLines.findIndex((line) => line.startsWith('    Evidence:'));
    const evidenceContinuation = txtLines[evidenceLine + 1] ?? '';
    const evidenceContinuationIndent = ' '.repeat('    Evidence: '.length);
    const evidenceContinuationLeadingSpaces = evidenceContinuation.match(/^ */)?.[0].length ?? 0;

    expect(evidenceLine).toBeGreaterThanOrEqual(0);
    expect(evidenceContinuationLeadingSpaces).toBe(evidenceContinuationIndent.length);
    expect(evidenceContinuation.trimStart()).toContain('identifier 123e4567-e89b-12d3-a456-426614174000');

    // TXT must NOT include Action Items (short-form per Revision Surface Ownership Contract)
    expect(txt).not.toContain('ACTION ITEMS');
    expect(txt).not.toContain('Strategic Revisions:');

    // HTML/PDF must include all 6 diagnostic fields
    expect(html).not.toContain('class="score-box"');
    expect(html).not.toContain('background:#1C1814');
    expect(html).not.toContain('background: #1c1814');
    expect(html).not.toContain('<table class="opp-table">');
    expect(html).not.toContain('<em>\u201c');
    expect(html).not.toContain('<em>"');
    expect(html).toContain('class="dash-card readiness-risk"');
    expect(html).toContain('class="opp-field"');
    expect(html).toContain('class="opp-val"');
    expect(html).toContain('class="opp-recommendation"');
    expect(html).toContain('class="opp-severity"');
    expect(html).toContain(longEvidence);
    expect(html).toContain('Stakes or decision pressure diffuses before reaching the reader.');
    expect(html).toContain('Mid-chapter tension release without replacement hook.');
    expect(html).toContain(longFix);
    expect(html).toContain('Sustains reader engagement and enhances narrative urgency.');
    expect(html).toContain('Check each scene break for forward-pull sentence.');

    // HTML/PDF must NOT include Action Items (short-form per Revision Surface Ownership Contract)
    expect(html).not.toContain('<h2>Action Items</h2>');
    expect(html).not.toContain('<h3>Strategic Revisions</h3>');

    // DOCX must include all 6 diagnostic fields
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });
    expect(docxText).toContain('A dark truck, fast, heading toward the river, with a reference identifier');
    expect(docxText).toContain('Stakes or decision pressure diffuses before reaching the reader.');
    expect(docxText).toContain('Mid-chapter tension release without replacement hook.');
    expect(docxText).toContain('Insert a ticking-clock reminder every 800 words and keep the sentence fully visible');
    expect(docxText).toContain('Sustains reader engagement and enhances narrative urgency.');
    expect(docxText).toContain('Check each scene break for forward-pull sentence.');

    // DOCX must NOT include Action Items (short-form per Revision Surface Ownership Contract)
    expect(docxText).not.toContain('Action Items');
  });

  test('filters generic fallback opportunity prose and avoids double-wrapped evidence quotes in TXT/HTML/DOCX', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'Fallback and Quote Guard',
      result: {
        generated_at: '2026-07-06T00:00:00.000Z',
        overview: {
          overall_score_0_100: 74,
          verdict: 'revise',
          one_paragraph_summary: 'Regression fixture for fallback suppression and quote normalization.',
          top_3_strengths: ['Focused premise'],
          top_3_risks: ['Generic revision language can leak'],
        },
        enrichment: {
          premise: 'A witness rewrites a city memory.',
          trigger_warnings: [],
          reading_grade_level: 8,
          dialogue_percentage: 35,
          narrative_percentage: 65,
        },
        metrics: {
          manuscript: {
            title: 'Fallback and Quote Guard',
            word_count: 42000,
            genre: 'literary suspense',
            target_audience: 'Adult readers',
          },
        },
        criteria: [
          {
            key: 'narrativeDrive',
            score_0_10: 7,
            confidence_level: 'moderate',
            rationale: 'Momentum exists but can become abstract.',
            recommendations: [
              {
                priority: 'high',
                action: 'The evaluation identified a concrete craft issue: premise remains abstract rather than grounded in scene evidence.',
              },
              {
                priority: 'medium',
                action: 'Anchor the midpoint in tangible cause-and-effect.',
                anchor_snippet: '“Already quoted evidence.”',
                symptom: 'Midpoint tension resolves before replacement pressure arrives.',
                mechanism: 'Consequence language is deferred into summary rather than scene action.',
                specific_fix: 'Move the consequence beat into the scene-ending paragraph.',
                reader_effect: 'Readers maintain urgency through the midpoint turn.',
              },
            ],
          },
        ],
      },
    });

    const vm = buildVm(canonicalDoc);
    const txt = testing.renderTxtFromViewModel(vm);
    const html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    expect(txt.toLowerCase()).not.toContain('the evaluation identified a concrete craft issue');
    expect(txt.toLowerCase()).not.toContain('premise remains abstract');
    expect(html.toLowerCase()).not.toContain('the evaluation identified a concrete craft issue');
    expect(html.toLowerCase()).not.toContain('premise remains abstract');
    expect(docxText.toLowerCase()).not.toContain('the evaluation identified a concrete craft issue');
    expect(docxText.toLowerCase()).not.toContain('premise remains abstract');

    expect(txt).toContain('Evidence: “Already quoted evidence.”');
    expect(txt).not.toContain('Evidence: ““Already quoted evidence.””');
    expect(html).toContain('“Already quoted evidence.”');
    expect(html).not.toContain('““Already quoted evidence.””');
    expect(docxText).toContain('Already quoted evidence.');
    expect(docxText).not.toMatch(/[“"]{2}Already quoted evidence/);
  });

  test('wraps long-form TXT sections to 78 chars including late multi-layer sections', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'Long-Form Wrap Guard',
      result: {
        generated_at: '2026-07-06T00:00:00.000Z',
        overview: {
          overall_score_0_100: 79,
          verdict: 'revise',
          one_paragraph_summary: 'Long-form wrapping regression fixture.',
          top_3_strengths: ['Layer coherence'],
          top_3_risks: ['Late-section line overflow'],
        },
        enrichment: {
          premise: 'A layered manuscript under structured evaluation.',
          trigger_warnings: [],
          reading_grade_level: 9,
          dialogue_percentage: 28,
          narrative_percentage: 72,
        },
        metrics: {
          manuscript: {
            title: 'Long-Form Wrap Guard',
            word_count: 98000,
            genre: 'upmarket suspense',
            target_audience: 'Adult readers',
          },
        },
        criteria: [
          {
            key: 'structure',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'Structure is solid with targeted revision needs.',
            recommendations: [],
          },
        ],
      },
    });

    const dream = {
      dream_scores: { quality: 88, readiness: 84, commercial: 81, literary: 86 },
      executive_verdict: 'Executive verdict remains evidence grounded across late sections.',
      structural_stack: [
        {
          layer_name: 'Structural Continuity Layer With A Very Long Label For Wrapping Coverage',
          status: 'stable with minor drift in back-half dependency sequencing and causality carryover',
          function: 'Maintain causal continuity across chapter boundaries while preserving suspense pressure through linked consequence statements.',
          revision_note: 'Re-sequence chapter exits so each handoff includes one explicit unresolved consequence with reader-visible urgency.',
        },
      ],
      arc_map: [
        {
          act_name: 'Act II Escalation Arc With Intentional Length For Wrap Validation',
          chapter_range: '9-24 including interstitial bridge passages and mirrored callback beats',
          primary_function: 'Sustain escalating constraint while proving irreversible cost at each major transition point.',
          revision_priority: 'Strengthen the midpoint reversal so subsequent scenes inherit explicit consequence pressure.',
        },
      ],
      criterion_analyses: [
        {
          key: 'structure',
          score: 8,
          confidence: 'high',
          fit_evidence: ['Escalation remains visible across most scene transitions with clear consequence tracking.'],
          gap_evidence: ['Late-act transitions compress setup and payoff into summary-heavy bridge language.'],
          revision_queue: ['[LOCATION: Act II to III bridge] [OPERATION: re-sequence] Add visible consequence relay before chapter close.'],
        },
      ],
      layer_analyses: [
        {
          layer_name: 'Reader Experience Layer',
          status: 'moderate',
          needed_revision: 'Clarify emotional trajectory markers at every act boundary using concrete scene-level signals.',
        },
      ],
      cross_layer_integration: [
        {
          motif: 'River ledger motif',
          description: 'Motif aligns memory evidence with accountability across disparate timeline slices.',
          integration_quality: 'developing with uneven endpoint reinforcement',
          revision_note: 'Echo motif language in the final bridge scene before verdict disclosure.',
        },
      ],
      revision_plan: [
        {
          priority: 'P1',
          title: 'Rebuild back-half consequence carryover with explicit scene relay language',
          goal: 'Maintain forward pressure through the final third without abstraction drift.',
          actions: ['Insert one explicit unresolved consequence line in every chapter ending across chapters 19 through 26.'],
          acceptance_check: 'Every chapter close in the final third contains a clear unresolved consequence statement.',
        },
      ],
      releasability: [
        {
          dimension: 'Narrative Cohesion and Reader Momentum',
          current_status: 'strong foundation with late-stage relay variance requiring targeted edits',
          verdict: 'Revise',
        },
      ],
      market_shelf: {
        best_shelf: 'Upmarket suspense with literary texture and consequence-forward pacing language.',
        marketable_hook: 'A witness must choose between inherited silence and public accountability while memory itself becomes contested evidence.',
        shelf_neighbors: ['The Push with layered consequence relay', 'The It Girl with stronger scene-end urgency continuity'],
        comparison_space: ['Character-forward suspense with ethical consequence mechanics and layered memory evidence'],
        market_danger: 'May read as emotionally diffuse if late-act consequence relay remains implicit rather than explicit.',
      },
      what_not_to_become: ['A beautifully phrased but consequence-light suspense narrative that diffuses urgency in bridge scenes.'],
      acceptance_checks: {
        required_detection: ['Detect explicit consequence relay in every final-third chapter ending with scene-level specificity.'],
        failure_conditions: ['Fail if assessment language substitutes abstract summary for concrete scene evidence in late sections.'],
      },
    } as any;

    const vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any, dreamDoc: dream });
    const txt = testing.renderTxtFromViewModel(vm);

    const overlongLines = txt
      .split('\n')
      .map((line, idx) => ({ line, lineNumber: idx + 1 }))
      .filter(({ line }) => line.length > 78);

    expect(overlongLines).toEqual([]);
    expect(txt).toContain('STORY LEDGER OR LAYER-AWARE ARCHITECTURE MAP');
    expect(txt).toContain('READINESS / RELEASABILITY POSTURE');
    expect(txt).toContain('LAYER-AWARE REVISION SEQUENCING');
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

    // DREAM now flows through the VM boundary (projected into
    // vm.longFormMultiLayerEvaluation); renderers receive only the VM.
    const vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any, dreamDoc: dream });
    const txt = testing.renderTxtFromViewModel(vm, 'job-template-truth');
    const html = testing.renderHtmlFromViewModel(vm, 'job-template-truth');
    const docxBuffer = await testing.renderDocxFromViewModel(vm, 'job-template-truth');
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    // §13-§21 template-authorized headings (from shared section contract)
    expect(txt).toContain('STORY LEDGER OR LAYER-AWARE ARCHITECTURE MAP');
    expect(txt).toContain('REVIEW GATE READINESS SURFACE');
    expect(txt).toContain('CROSS-LAYER SYNTHESIS');
    // Subsection content preserved under template-authorized parents
    expect(txt).toContain('Memory Layer');
    expect(txt).toContain('Red shoes');
    expect(txt).toContain('Detect that the memory layer changes the thriller spine.');
    expect(txt).toContain('Location: Midpoint');
    expect(txt).toContain('Operation: Tighten');
    expect(txt).toMatch(/Recommendation: Add consequence\s+beat\./);
    expect(txt).not.toContain('[LOCATION: Midpoint]');
    // Forbidden DREAM headings must not appear as top-level TXT divider sections
    expect(txt).not.toContain('NARRATIVE SYNTHESIS — HOLISTIC CRAFT ASSESSMENT');
    expect(txt).not.toContain('UED fallback marker');

    // §13-§21 template-authorized headings in HTML
    expect(html).toContain('Story Ledger or Layer-Aware Architecture Map');
    expect(html).toContain('Review Gate Readiness Surface');
    expect(html).toContain('Cross-Layer Synthesis');
    // Subsection content preserved under template-authorized parents
    expect(html).toContain('Memory Layer');
    expect(html).toContain('Red shoes');
    expect(html).toContain('Detect that the memory layer changes the thriller spine.');
    expect(html).toContain('Location: Midpoint | Operation: Tighten | Recommendation: Add consequence beat.');
    expect(html).not.toContain('[LOCATION: Midpoint]');
    expect(html).toContain('Dream-driven executive verdict appears in all adapters.');
    expect(html).not.toContain('UED fallback marker');
    expect(html).not.toContain('<p>None supplied.</p>');

    // §13-§21 template-authorized headings in DOCX
    expect(docxText).toContain('Story Ledger or Layer-Aware Architecture Map');
    expect(docxText).toContain('Review Gate Readiness Surface');
    expect(docxText).toContain('Cross-Layer Synthesis');
    // Subsection content preserved under template-authorized parents
    expect(docxText).toContain('Memory Layer');
    expect(docxText).toContain('Red shoes');
    expect(docxText).toContain('Detect that the memory layer changes the thriller spine.');
    expect(docxText).toContain('Location: Midpoint | Operation: Tighten | Recommendation: Add consequence beat.');
    expect(docxText).not.toContain('[LOCATION: Midpoint]');
    expect(docxText).toContain('Dream-driven executive verdict appears in all adapters.');
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

    const html = testing.renderHtmlFromViewModel(buildVm(canonicalDoc));

    // Short-form: score-grid table MUST have scoped class
    expect(html).toContain('class="score-grid-table"');
    expect(html).toContain('class="grid summary-grid"');
    expect(html).toContain('class="grid title-metadata-grid"');

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
    expect(html).toContain('score-grid-table tbody tr:nth-child(even)');

    // Long evidence text is fully present (not truncated)
    expect(html).toContain('The long corridor stretched endlessly');
    expect(html).toContain('the reader lost all sense of temporal urgency.');
  });
});
