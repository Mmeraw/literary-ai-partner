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
                anchor_snippet: 'A dark truck, fast, heading toward the river.',
                symptom: 'Stakes or decision pressure diffuses before reaching the reader.',
                mechanism: 'Mid-chapter tension release without replacement hook.',
                specific_fix: 'Insert a ticking-clock reminder every 800 words.',
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
    expect(txt).toContain('Evidence: \u201cA dark truck, fast, heading toward the river.\u201d');
    expect(txt).toContain('Symptom: Stakes or decision pressure diffuses before reaching the reader.');
    expect(txt).toContain('Cause: Mid-chapter tension release without replacement hook.');
    expect(txt).toContain('Fix direction: Insert a ticking-clock reminder every 800 words.');
    expect(txt).toContain('Reader effect: Sustains reader engagement and enhances narrative urgency.');
    expect(txt).toContain('Mistake-proofing: Check each scene break for forward-pull sentence.');

    // TXT must include Action Items
    expect(txt).toContain('ACTION ITEMS');
    expect(txt).toContain('Quick Wins:');
    expect(txt).toContain('Tighten the opening hook.');
    expect(txt).toContain('Strategic Revisions:');
    expect(txt).toContain('Restructure middle act.');

    // HTML/PDF must include all 6 diagnostic fields
    expect(html).toContain('A dark truck, fast, heading toward the river.');
    expect(html).toContain('Stakes or decision pressure diffuses before reaching the reader.');
    expect(html).toContain('Mid-chapter tension release without replacement hook.');
    expect(html).toContain('Insert a ticking-clock reminder every 800 words.');
    expect(html).toContain('Sustains reader engagement and enhances narrative urgency.');
    expect(html).toContain('Check each scene break for forward-pull sentence.');

    // HTML/PDF must include Action Items
    expect(html).toContain('Action Items');
    expect(html).toContain('Quick Wins');
    expect(html).toContain('Tighten the opening hook.');
    expect(html).toContain('Strategic Revisions');
    expect(html).toContain('Restructure middle act.');

    // DOCX must include all 6 diagnostic fields
    const docxBuffer = await testing.buildCanonicalTemplateDocx(canonicalDoc);
    const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });
    expect(docxText).toContain('A dark truck, fast, heading toward the river.');
    expect(docxText).toContain('Stakes or decision pressure diffuses before reaching the reader.');
    expect(docxText).toContain('Mid-chapter tension release without replacement hook.');
    expect(docxText).toContain('Insert a ticking-clock reminder every 800 words.');
    expect(docxText).toContain('Sustains reader engagement and enhances narrative urgency.');
    expect(docxText).toContain('Check each scene break for forward-pull sentence.');

    // DOCX must include Action Items
    expect(docxText).toContain('Action Items');
    expect(docxText).toContain('Tighten the opening hook.');
    expect(docxText).toContain('Restructure middle act.');
  });
});
