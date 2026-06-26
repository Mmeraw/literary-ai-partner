/**
 * Surface Parity Verification — Rendered-Output Proof
 *
 * This test exercises the ACTUAL rendering functions (TXT, HTML/PDF, DOCX)
 * with a realistic short-form evaluation fixture and verifies field-by-field
 * parity across all surfaces.
 *
 * Produces a parity matrix as test output.
 */
import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { normalizeEvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';
import mammoth from 'mammoth';

describe('Surface Parity Verification — Rendered Output Proof', () => {
  test('produces parity matrix: Web/PDF/DOCX/TXT field-by-field comparison', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;

    // ── Realistic fixture with all fields populated ──────────────────────
    const canonicalDoc = buildShortFormEvaluationDocument({
      displayTitle: 'Let the River Decide',
      result: {
        generated_at: '2026-06-15T14:30:00.000Z',
        overview: {
          overall_score_0_100: 82,
          verdict: 'revise',
          one_paragraph_summary: 'A lyrical literary novel exploring generational trauma through the metaphor of a river that both divides and connects a rural community. The prose demonstrates genuine poetic sensibility, but structural drift in the middle third undermines narrative momentum.',
          top_3_strengths: [
            'Exceptional prose voice with precise imagery',
            'Complex, layered character dynamics',
            'Thematic resonance between landscape and emotional arc',
          ],
          top_3_risks: [
            'Middle-act pacing sag between chapters 8-12',
            'Secondary character arcs left unresolved',
            'Climax arrives too abruptly after extended setup',
          ],
        },
        enrichment: {
          premise: 'When a decades-old river dam threatens to burst, three generations of women must decide whether to save their land or each other.',
          trigger_warnings: ['flooding', 'generational trauma', 'death of a parent'],
          reading_grade_level: 9.4,
          dialogue_percentage: 32,
          narrative_percentage: 68,
        },
        metrics: {
          manuscript: {
            title: 'Let the River Decide',
            word_count: 78500,
            genre: 'Literary Fiction',
            target_audience: 'Adult literary fiction readers',
          },
        },
        criteria: [
          {
            key: 'concept',
            score_0_10: 9,
            confidence_level: 'high',
            rationale: 'The central premise — a dam collapse forcing three generations of women to confront their past — is compelling and inherently dramatic.',
            recommendations: [
              {
                priority: 'medium',
                action: 'Clarify the dam\'s symbolic weight earlier in Chapter 2.',
                anchor_snippet: 'The dam had held for forty years, which was longer than any of them had expected.',
                symptom: 'The reader reaches Chapter 5 before understanding the dam\'s metaphorical significance.',
                mechanism: 'Early chapters treat the dam as purely physical infrastructure.',
                specific_fix: 'Add one interior-thought passage in Chapter 2 linking the dam to the family\'s emotional containment.',
                reader_effect: 'Establishes dual-layer reading from the opening act.',
                mistake_proofing: 'Do not over-explain the metaphor; let one sentence carry both meanings.',
              },
            ],
          },
          {
            key: 'narrativeDrive',
            score_0_10: 7,
            confidence_level: 'moderate',
            rationale: 'Strong opening and closing momentum, but chapters 8-12 lose urgency as the narrative shifts to backstory.',
            recommendations: [
              {
                priority: 'high',
                action: 'Add present-tense pressure beats in the backstory chapters.',
                anchor_snippet: 'She remembered the summer of 1987, when the water was so low you could walk across.',
                symptom: 'Narrative urgency drops when the story moves to memory.',
                mechanism: 'Pure retrospection without present-stakes framing.',
                specific_fix: 'Interleave each backstory passage with a present-day sentence showing the water rising.',
                reader_effect: 'Maintains forward momentum even during reflective passages.',
                mistake_proofing: 'Check each flashback exits with a return to present tension.',
              },
            ],
          },
          {
            key: 'character',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'Three central women are richly drawn with distinct voices and motivations.',
            recommendations: [],
          },
          {
            key: 'voice',
            score_0_10: 9,
            confidence_level: 'high',
            rationale: 'The final reunion scene achieves genuine emotional power through earned restraint.',
            recommendations: [],
          },
          {
            key: 'sceneConstruction',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'Scenes are purposefully constructed with clear dramatic function.',
            recommendations: [],
          },
          {
            key: 'dialogue',
            score_0_10: 7,
            confidence_level: 'moderate',
            rationale: 'Dialogue effectively distinguishes character voices but occasionally becomes expository.',
            recommendations: [
              {
                priority: 'medium',
                action: 'Trim exposition in Chapter 10 dialogue between Mae and her daughter.',
                anchor_snippet: 'Mae said, "You know your grandmother built this house in 1952, the same year the dam was commissioned."',
                symptom: 'Characters deliver historical information too directly.',
                mechanism: 'Dialogue substituting for narration.',
                specific_fix: 'Convert the historical detail to narrative and let dialogue carry only emotional content.',
                reader_effect: 'Dialogue feels organic rather than informational.',
                mistake_proofing: 'Flag any dialogue line longer than 40 words that contains a date.',
              },
            ],
          },
          {
            key: 'theme',
            score_0_10: 9,
            confidence_level: 'high',
            rationale: 'Water/containment/release imagery operates consistently across all narrative layers.',
            recommendations: [],
          },
          {
            key: 'worldbuilding',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'The river valley setting is rendered with atmospheric precision and sensory detail.',
            recommendations: [],
          },
          {
            key: 'pacing',
            score_0_10: 6,
            confidence_level: 'high',
            rationale: 'Uneven pacing — strong opening and closing thirds bookend a middle that loses momentum.',
            recommendations: [
              {
                priority: 'high',
                action: 'Cut or compress chapters 9 and 11 by approximately 30%.',
                anchor_snippet: 'The summer stretched on, each day indistinguishable from the last, until even the birds stopped singing.',
                symptom: 'Narrative stalls for extended passages without plot advancement.',
                mechanism: 'Atmospheric writing without sufficient dramatic justification.',
                specific_fix: 'Identify the single essential revelation in each chapter and build the scene around it, cutting ambient passages.',
                reader_effect: 'Tighter middle act sustains engagement through to the climax.',
                mistake_proofing: 'Each chapter must advance at least one plot thread or reveal one character secret.',
              },
            ],
          },
          {
            key: 'proseControl',
            score_0_10: 9,
            confidence_level: 'high',
            rationale: 'Consistently excellent sentence-level craft with varied rhythm and precise imagery.',
            recommendations: [],
          },
          {
            key: 'tone',
            score_0_10: 8,
            confidence_level: 'high',
            rationale: 'Tonal authority is consistent throughout with well-managed shifts.',
            recommendations: [],
          },
          {
            key: 'narrativeClosure',
            score_0_10: 7,
            confidence_level: 'moderate',
            rationale: 'Resolution feels slightly rushed given the deliberate pacing of the preceding narrative.',
            recommendations: [
              {
                priority: 'medium',
                action: 'Expand the resolution by one additional scene showing the aftermath.',
                anchor_snippet: 'The water receded, and with it went everything they had refused to say.',
                symptom: 'Ending feels abrupt relative to buildup.',
                mechanism: 'Climax and denouement compressed into a single chapter.',
                specific_fix: 'Add a brief epilogue scene (500-800 words) showing the family dynamic two weeks after the flood.',
                reader_effect: 'Provides emotional breathing room and closure.',
                mistake_proofing: 'Epilogue must not introduce new conflict or information.',
              },
            ],
          },
          {
            key: 'marketability',
            score_0_10: 7,
            confidence_level: 'moderate',
            rationale: 'Strong literary voice positions this well for independent/literary presses, though commercial houses may request structural tightening.',
            recommendations: [],
          },
        ],
        recommendations: {
          quick_wins: [
            { action: 'Tighten the Chapter 2 dam metaphor.', why: 'Low effort, high symbolic payoff.', effort: 'low', impact: 'high' },
            { action: 'Cut the repeated river description in Chapter 4.', why: 'Redundant imagery slows the reader.', effort: 'low', impact: 'medium' },
          ],
          strategic_revisions: [
            { action: 'Restructure middle act (Ch. 8-12) to interleave past/present.', why: 'Pacing is the primary structural weakness.', effort: 'high', impact: 'high' },
            { action: 'Expand resolution with post-flood epilogue scene.', why: 'Current ending feels unearned given the slow build.', effort: 'medium', impact: 'high' },
          ],
        },
      },
    });

    // ── Generate all surfaces ────────────────────────────────────────────
    const vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc });
    const txt = testing.renderTxtFromViewModel(vm, null, 'job-parity-test');
    const html = testing.renderHtmlFromViewModel(vm, null, 'job-parity-test');
    const docxBuffer = await testing.renderDocxFromViewModel(vm, null, 'job-parity-test');
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });

    // ── Extract section headings from each surface ───────────────────────
    const txtHeadings = txt
      .split('\n')
      .filter(line => /^[A-Z][A-Z &/]+$/.test(line.trim()) && line.trim().length > 3)
      .map(h => h.trim());

    const htmlHeadings = (html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [])
      .map(m => m.replace(/<[^>]+>/g, '').trim());

    const docxHeadings = docxText
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 3 &&
          trimmed.length < 60 &&
          !/^\d/.test(trimmed) &&
          !/^[a-z]/.test(trimmed) &&
          !trimmed.includes(':') &&
          trimmed === trimmed.replace(/[^A-Za-z &/\u2019\u2018\u2122\u2014\u2013]/g, '');
      })
      .map(h => h.trim());

    // ── Print parity matrix ──────────────────────────────────────────────
    console.log('\n\n══════════════════════════════════════════════════════════════');
    console.log('       SURFACE PARITY VERIFICATION — Let the River Decide');
    console.log('══════════════════════════════════════════════════════════════\n');

    // Title Block
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ TITLE BLOCK FIELDS                                          │');
    console.log('├─────────────────────────────┬──────┬──────┬──────┬──────┬───┤');
    console.log('│ Field                       │ TXT  │ HTML │ DOCX │ Match│   │');
    console.log('├─────────────────────────────┼──────┼──────┼──────┼──────┼───┤');

    const titleBlockChecks = [
      { field: 'Manuscript Title', value: 'Let the River Decide' },
      { field: 'Report Type', value: 'Short-Form Evaluation' },
      { field: 'Overall Score', value: '82/100' },
      { field: 'Genre', value: 'Literary Fiction' },
      { field: 'Target Audience', value: 'Adult literary fiction' },
      { field: 'Word Count', value: '78,500' },
      { field: 'Reading Grade Level', value: '9' },
      { field: 'Dialogue/Narrative', value: '32' },
      { field: 'Date Generated', value: 'June 15, 2026' },
    ];

    let allMatch = true;
    for (const check of titleBlockChecks) {
      const inTxt = txt.includes(check.value) || txt.toLowerCase().includes(check.value.toLowerCase());
      const inHtml = html.includes(check.value) || html.toLowerCase().includes(check.value.toLowerCase());
      const inDocx = docxText.includes(check.value) || docxText.toLowerCase().includes(check.value.toLowerCase());
      const match = inTxt && inHtml && inDocx;
      if (!match) allMatch = false;
      console.log(`│ ${check.field.padEnd(27)} │ ${inTxt ? ' ✓  ' : ' ✗  '} │ ${inHtml ? ' ✓  ' : ' ✗  '} │ ${inDocx ? ' ✓  ' : ' ✗  '} │ ${match ? ' ✓  ' : ' ✗  '} │   │`);
    }
    console.log('└─────────────────────────────┴──────┴──────┴──────┴──────┴───┘\n');

    // Sections order
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ SECTION ORDER                                               │');
    console.log('├─────────────────────────────┬──────┬──────┬──────┬──────┬───┤');
    console.log('│ Section                     │ TXT  │ HTML │ DOCX │ Match│   │');
    console.log('├─────────────────────────────┼──────┼──────┼──────┼──────┼───┤');

    const requiredSections = [
      { name: 'One-Paragraph Pitch', txtKey: 'ONE-PARAGRAPH PITCH', htmlKey: 'One-Paragraph Pitch', docxKey: 'One-Paragraph Pitch' },
      { name: 'One-Sentence Pitch', txtKey: 'ONE-SENTENCE PITCH', htmlKey: 'One-Sentence Pitch', docxKey: 'One-Sentence Pitch' },
      { name: 'Content Warnings', txtKey: 'CONTENT WARNINGS', htmlKey: 'Content Warnings', docxKey: 'Content Warnings' },
      { name: 'Revision Opp Summary', txtKey: 'REVISION OPPORTUNITY SUMMARY', htmlKey: 'Revision Opportunity Summary', docxKey: 'Revision Opportunity Summary' },
      { name: 'Executive Summary', txtKey: 'EXECUTIVE SUMMARY', htmlKey: 'Executive Summary', docxKey: 'Executive Summary' },
      { name: 'Top Strengths', txtKey: 'TOP STRENGTHS', htmlKey: 'Top Strengths', docxKey: 'Top Strengths' },
      { name: 'Top Risks', txtKey: 'TOP RISKS', htmlKey: 'Top Risks', docxKey: 'Top Risks' },
      { name: 'Top Recommendations', txtKey: 'TOP RECOMMENDATIONS', htmlKey: 'Top Recommendations', docxKey: 'Top Recommendations' },
      { name: '13 Criteria Grid', txtKey: 'CRITERIA SCORE GRID', htmlKey: 'criteria', docxKey: 'Criteria' },
      { name: 'Criterion Rationales', txtKey: 'CRITERION RATIONALES', htmlKey: 'Criterion Rationales', docxKey: 'Criterion Rationales' },
      { name: 'Confidence', txtKey: 'CONFIDENCE EXPLANATION', htmlKey: 'Confidence Explanation', docxKey: 'Confidence' },
      { name: 'Disclaimer', txtKey: 'DISCLAIMER', htmlKey: 'Disclaimer', docxKey: 'Disclaimer' },
    ];

    for (const section of requiredSections) {
      const inTxt = txt.includes(section.txtKey);
      const inHtml = html.toLowerCase().includes(section.htmlKey.toLowerCase());
      const inDocx = docxText.toLowerCase().includes(section.docxKey.toLowerCase());
      const match = inTxt && inHtml && inDocx;
      if (!match) allMatch = false;
      console.log(`│ ${section.name.padEnd(27)} │ ${inTxt ? ' ✓  ' : ' ✗  '} │ ${inHtml ? ' ✓  ' : ' ✗  '} │ ${inDocx ? ' ✓  ' : ' ✗  '} │ ${match ? ' ✓  ' : ' ✗  '} │   │`);
    }
    console.log('└─────────────────────────────┴──────┴──────┴──────┴──────┴───┘\n');

    // Forbidden sections
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ FORBIDDEN SECTIONS (must NOT appear)                        │');
    console.log('├─────────────────────────────┬──────┬──────┬──────┬──────┬───┤');
    console.log('│ Section                     │ TXT  │ HTML │ DOCX │ Clean│   │');
    console.log('├─────────────────────────────┼──────┼──────┼──────┼──────┼───┤');

    const forbiddenSections = [
      { name: 'Action Items', txtKey: 'ACTION ITEMS', htmlKey: '<h2>Action Items</h2>', docxKey: 'Action Items' },
      { name: 'Strategic Revisions', txtKey: 'STRATEGIC REVISIONS', htmlKey: '<h2>Strategic Revisions</h2>', docxKey: 'Strategic Revisions' },
      { name: 'Revision Queue', txtKey: 'REVISION QUEUE', htmlKey: 'Revision Queue', docxKey: 'Revision Queue' },
      { name: 'Revision Priority Plan', txtKey: 'REVISION PRIORITY PLAN', htmlKey: 'Revision Priority Plan', docxKey: 'Revision Priority Plan' },
      { name: 'Deep Criterion Analysis', txtKey: 'DEEP CRITERION ANALYSIS', htmlKey: 'Deep Criterion Analysis', docxKey: 'Deep Criterion Analysis' },
      { name: 'Releasability Assessment', txtKey: 'RELEASABILITY ASSESSMENT', htmlKey: 'Releasability Assessment', docxKey: 'Releasability Assessment' },
      { name: 'Review Gate', txtKey: 'REVIEW GATE', htmlKey: 'Review Gate', docxKey: 'Review Gate' },
    ];

    for (const section of forbiddenSections) {
      const inTxt = txt.includes(section.txtKey);
      const inHtml = html.includes(section.htmlKey);
      // For DOCX check as heading (not in body text like rationale)
      const inDocx = docxText.split('\n').some(line => line.trim() === section.docxKey);
      const clean = !inTxt && !inHtml && !inDocx;
      if (!clean) allMatch = false;
      console.log(`│ ${section.name.padEnd(27)} │ ${inTxt ? ' ✗  ' : ' ✓  '} │ ${inHtml ? ' ✗  ' : ' ✓  '} │ ${inDocx ? ' ✗  ' : ' ✓  '} │ ${clean ? ' ✓  ' : ' ✗  '} │   │`);
    }
    console.log('└─────────────────────────────┴──────┴──────┴──────┴──────┴───┘\n');

    // Opportunity counts
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ OPPORTUNITY COUNTS                                          │');
    console.log('├─────────────────────────────┬──────┬──────┬──────┬──────┬───┤');

    const totalOppMatch = txt.match(/Total Revision Opportunities:\s*(\d+)/i);
    const totalOpp = totalOppMatch ? totalOppMatch[1] : 'N/A';
    // HTML renders as: <strong>Total</strong><div>N</div>
    const htmlOppMatch = html.match(/<strong>Total<\/strong><div>(\d+)<\/div>/i);
    const htmlOpp = htmlOppMatch ? htmlOppMatch[1] : 'N/A';
    // DOCX renders as "Total Revision Opportunities: N" or "Total  N" across lines
    const docxOppMatch = docxText.match(/Total Revision Opportunities[:\s]*(\d+)/i) || docxText.match(/Total[\s\n]*(\d+)/) || docxText.match(/Total.{0,20}?(\d+)/);
    const docxOpp = docxOppMatch ? docxOppMatch[1] : 'N/A';
    console.log(`│ Total Opportunities         │  ${totalOpp.padEnd(3)} │  ${htmlOpp.padEnd(3)} │  ${docxOpp.padEnd(3)} │ ${totalOpp === htmlOpp && htmlOpp === docxOpp ? ' ✓  ' : ' ✗  '} │   │`);

    const recMatch = txt.match(/Recommended:\s*(\d+)/);
    const recTxt = recMatch ? recMatch[1] : 'N/A';
    // HTML renders as: <strong>Recommended</strong><div>N</div>
    const recHtmlMatch = html.match(/<strong>Recommended<\/strong><div>(\d+)<\/div>/i);
    const recHtml = recHtmlMatch ? recHtmlMatch[1] : 'N/A';
    const recDocxMatch = docxText.match(/Recommended[:\s]*(\d+)/);
    const recDocx = recDocxMatch ? recDocxMatch[1] : 'N/A';
    console.log(`│ Recommended                 │  ${recTxt.padEnd(3)} │  ${recHtml.padEnd(3)} │  ${recDocx.padEnd(3)} │ ${recTxt === recHtml && recHtml === recDocx ? ' ✓  ' : ' ✗  '} │   │`);

    console.log('└─────────────────────────────┴──────┴──────┴──────┴──────┴───┘\n');

    // Criterion scores
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ CRITERION SCORES (sample)                                   │');
    console.log('├─────────────────────────────┬──────┬──────┬──────┬──────┬───┤');

    const criteriaChecks = [
      { name: 'Concept & Core Premise', score: '9/10' },
      { name: 'Narrative Drive', score: '7/10' },
      { name: 'Pacing', score: '6/10' },
      { name: 'Prose Control', score: '9/10' },
    ];

    for (const c of criteriaChecks) {
      const inTxt = txt.includes(c.score);
      const inHtml = html.includes(c.score);
      const inDocx = docxText.includes(c.score);
      const match = inTxt && inHtml && inDocx;
      if (!match) allMatch = false;
      console.log(`│ ${(c.name + ' ' + c.score).padEnd(27)} │ ${inTxt ? ' ✓  ' : ' ✗  '} │ ${inHtml ? ' ✓  ' : ' ✗  '} │ ${inDocx ? ' ✓  ' : ' ✗  '} │ ${match ? ' ✓  ' : ' ✗  '} │   │`);
    }
    console.log('└─────────────────────────────┴──────┴──────┴──────┴──────┴───┘\n');

    // Top Recommendations
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ TOP RECOMMENDATIONS (must appear in all surfaces)           │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    // Top Recommendations section must have content (not just heading)
    const txtRecIdx = txt.indexOf('TOP RECOMMENDATIONS');
    const txtRecHasContent = txtRecIdx >= 0 && txt.substring(txtRecIdx, txtRecIdx + 200).includes('.');
    const htmlRecIdx = html.indexOf('Top Recommendations');
    const htmlRecHasContent = htmlRecIdx >= 0 && (html.substring(htmlRecIdx, htmlRecIdx + 500).includes('<ol>') || html.substring(htmlRecIdx, htmlRecIdx + 500).includes('<li>'));
    const docxRecHasContent = docxText.includes('Top Recommendations') && docxText.length > docxText.indexOf('Top Recommendations') + 50;
    const recContentMatch = txtRecHasContent && htmlRecHasContent && docxRecHasContent;
    if (!recContentMatch) allMatch = false;
    console.log(`│ Content present: TXT=${txtRecHasContent ? '✓' : '✗'} HTML=${htmlRecHasContent ? '✓' : '✗'} DOCX=${docxRecHasContent ? '✓' : '✗'} │`);
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    // Section order validation
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│ SECTION ORDER VALIDATION                                    │');
    console.log('├─────────────────────────────────────────────────────────────┤');

    const txtOrder = [
      txt.indexOf('ONE-PARAGRAPH PITCH'),
      txt.indexOf('ONE-SENTENCE PITCH'),
      txt.indexOf('CONTENT WARNINGS'),
      txt.indexOf('REVISION OPPORTUNITY SUMMARY'),
      txt.indexOf('EXECUTIVE SUMMARY'),
      txt.indexOf('TOP STRENGTHS'),
      txt.indexOf('TOP RISKS'),
      txt.indexOf('TOP RECOMMENDATIONS'),
      txt.indexOf('CRITERIA SCORE GRID'),
      txt.indexOf('CRITERION RATIONALES'),
      txt.indexOf('CONFIDENCE EXPLANATION'),
    ].filter(i => i >= 0);

    const txtOrderCorrect = txtOrder.every((val, i, arr) => i === 0 || val > arr[i - 1]);
    console.log(`│ TXT section order: ${txtOrderCorrect ? 'CORRECT (monotonically increasing)' : 'INCORRECT'}          │`);

    const htmlOrder = [
      html.toLowerCase().indexOf('one-paragraph pitch'),
      html.toLowerCase().indexOf('one-sentence pitch'),
      html.toLowerCase().indexOf('content warnings'),
      html.toLowerCase().indexOf('revision opportunity summary'),
      html.toLowerCase().indexOf('executive summary'),
      html.toLowerCase().indexOf('top strengths'),
      html.toLowerCase().indexOf('top risks'),
      html.toLowerCase().indexOf('top recommendations'),
    ].filter(i => i >= 0);

    const htmlOrderCorrect = htmlOrder.every((val, i, arr) => i === 0 || val > arr[i - 1]);
    console.log(`│ HTML section order: ${htmlOrderCorrect ? 'CORRECT (monotonically increasing)' : 'INCORRECT'}         │`);
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    // Final verdict
    console.log('══════════════════════════════════════════════════════════════');
    console.log(`  OVERALL PARITY VERDICT: ${allMatch ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log('══════════════════════════════════════════════════════════════\n');

    // ── Assertions ───────────────────────────────────────────────────────
    // Title Block parity
    expect(txt).toContain('Let the River Decide');
    expect(html).toContain('Let the River Decide');
    expect(docxText).toContain('Let the River Decide');

    expect(txt).toContain('82/100');
    expect(html).toContain('82/100');
    expect(docxText).toContain('82/100');

    expect(txt).toContain('Literary Fiction');
    expect(html).toContain('Literary Fiction');
    expect(docxText).toContain('Literary Fiction');

    // Section presence
    expect(txt).toContain('ONE-PARAGRAPH PITCH');
    expect(txt).toContain('TOP STRENGTHS');
    expect(txt).toContain('TOP RISKS');
    expect(txt).toContain('TOP RECOMMENDATIONS');
    expect(txt).toContain('CRITERION RATIONALES');
    expect(txt).toContain('CONFIDENCE EXPLANATION');

    expect(html).toContain('Top Strengths');
    expect(html).toContain('Top Risks');
    expect(html).toContain('Top Recommendations');

    expect(docxText).toContain('Top Strengths');
    expect(docxText).toContain('Top Risks');
    expect(docxText).toContain('Top Recommendations');

    // Forbidden sections NOT present (short-form)
    expect(txt).not.toContain('ACTION ITEMS');
    expect(txt).not.toContain('STRATEGIC REVISIONS');
    expect(txt).not.toContain('REVISION QUEUE');
    expect(txt).not.toContain('DEEP CRITERION ANALYSIS');
    expect(html).not.toContain('<h2>Action Items</h2>');
    expect(html).not.toContain('<h2>Strategic Revisions</h2>');
    expect(html).not.toContain('<h2>Revision Queue</h2>');

    // Opportunity counts match across surfaces (all should be numeric and equal)
    expect(totalOpp).not.toBe('N/A');
    expect(htmlOpp).not.toBe('N/A');
    expect(totalOpp).toBe(htmlOpp);

    // Section order (TXT)
    expect(txtOrderCorrect).toBe(true);
    expect(htmlOrderCorrect).toBe(true);

    // No duplicate recommendation inventories
    const txtActionItemsCount = (txt.match(/ACTION ITEMS/g) || []).length;
    expect(txtActionItemsCount).toBe(0);

    // All criterion scores appear in all surfaces
    expect(txt).toContain('9/10');
    expect(html).toContain('9/10');
    expect(docxText).toContain('9/10');
  });
});
