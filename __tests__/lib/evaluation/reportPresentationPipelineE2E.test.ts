import * as React from 'react';
import { renderToString } from 'react-dom/server';
import mammoth from 'mammoth';

import { buildUnifiedDocumentForParityFromEvaluationResult } from '@/lib/evaluation/reportRenderParity';
import { normalizeEvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import { loadCertifiedUnifiedEvaluationDocumentArtifact } from '@/lib/evaluation/persistedUnifiedEvaluationDocument';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import CriterionOpportunities from '@/components/reports/CriterionOpportunities';
import { ABSENCE_STATUS_TEXT } from '@/lib/evaluation/presentation/reportDesignSystem';

const LONG_EVIDENCE = 'A dark truck, fast, heading toward the river, with a reference identifier 123e4567-e89b-12d3-a456-426614174000.';

function makeBaseResult(): any {
  return {
    schema_version: 'evaluation_result_v2',
    ids: {
      evaluation_run_id: 'e2e-run',
      job_id: 'e2e-job',
      manuscript_id: 1,
      user_id: '00000000-0000-0000-0000-000000000000',
    },
    generated_at: '2026-07-16T00:00:00.000Z',
    engine: { model: 'e2e-model', provider: 'other', prompt_version: 'e2e' },
    overview: {
      overall_score_0_100: 78,
      verdict: 'revise',
      one_paragraph_summary: 'A focused E2E summary for pipeline parity.',
      top_3_strengths: ['Voice'],
      top_3_risks: ['Pacing'],
    },
    metrics: {
      manuscript: {
        title: 'E2E Manuscript',
        word_count: 4500,
        genre: 'literary fiction',
        target_audience: 'Adult readers',
      },
    },
    enrichment: {
      premise: 'A river remembers blood.',
      trigger_warnings: [],
      reading_grade_level: 8,
      dialogue_percentage: 30,
      narrative_percentage: 70,
    },
    criteria: [],
    recommendations: { quick_wins: [], strategic_revisions: [] },
  };
}

function makeRecommendation(overrides: Record<string, unknown> = {}) {
  return {
    priority: 'medium',
    action: 'Increase the stakes surrounding the missing man.',
    anchor_snippet: LONG_EVIDENCE,
    anchor_type: 'verbatim_quote',
    symptom: 'Stakes diffuse before reaching the reader.',
    mechanism: 'Mid-chapter tension release without replacement hook.',
    specific_fix: 'Insert a ticking-clock reminder every 800 words.',
    reader_effect: 'Sustains reader engagement and enhances narrative urgency.',
    mistake_proofing: 'Check each scene break for a forward-pull sentence.',
    potential_damage: ['Flattened scene transitions', 'Loss of reader urgency'],
    ...overrides,
  };
}

function makeCriterion(overrides: Record<string, unknown> = {}) {
  return {
    key: 'narrativeDrive',
    score_0_10: 7,
    confidence_level: 'high',
    confidence_score_0_100: 90,
    scorable: true,
    status: 'SCORABLE',
    signal_present: true,
    signal_strength: 'SUFFICIENT',
    rationale: 'Momentum starts with the eerie absence at the riverbank.',
    recommendations: [makeRecommendation()],
    ...overrides,
  };
}

function buildVm(result: unknown, mode: 'short_form_evaluation' | 'long_form_evaluation' | 'long_form_multi_layer_evaluation') {
  const ued = buildUnifiedDocumentForParityFromEvaluationResult({
    evaluationResult: result,
    displayTitle: 'E2E Manuscript',
    mode,
  });
  return normalizeEvaluationReportViewModel({ ued: ued as any });
}

async function renderAllFormats(vm: any) {
  const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
  const testing = routeModule.__testingDownload;
  const txt = testing.renderTxtFromViewModel(vm);
  const html = testing.renderHtmlFromViewModel(vm);
  const docxBuffer = await testing.renderDocxFromViewModel(vm);
  const { value: docxText } = await mammoth.extractRawText({ buffer: docxBuffer });
  const pdfBuffer = await testing.buildChromiumPdf(html);
  return { txt, html, docxText, pdfBuffer };
}

function countPdfPages(pdfBuffer: Buffer): number {
  const source = pdfBuffer.toString('latin1');
  return (source.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe('report presentation pipeline E2E', () => {
  // Chromium PDF and DOCX rendering share constrained CI workers with the full
  // suite. The product assertions are deterministic; use the repository's
  // established rendering budget rather than Jest's unrelated 5-second default.
  jest.setTimeout(30_000);

  test('long title-page content occupies exactly one generated PDF page before report body', async () => {
    const result = makeBaseResult();
    result.metrics.manuscript.title = 'Criminality V2';
    result.metrics.manuscript.genre = 'Literary Fiction';
    result.metrics.manuscript.target_audience =
      'Readers of literary and upmarket fiction who appreciate morally complex first-person narratives, documentary texture, and slow-burn psychological tension in works that require patient attention to layered testimony.';
    result.governance = {
      transparency: {
        genre_expectation_context: {
          diagnosed_genre: 'literary fiction',
          shelf_target_audience: result.metrics.manuscript.target_audience,
          dominant_craft_engine: 'voice',
          expectation_profiles: ['voice_forward', 'reflection_forward', 'mood_forward'],
          genre_expectation_ids: ['literary_upmarket_fiction', 'contemplative_slow_burn_fiction'],
          genre_expectation_labels: ['Literary / Upmarket Fiction', 'Contemplative / Slow-burn Fiction'],
          resolution_notes: ['Voice focus governs the presentation contract.'],
        },
      },
    };
    const criterionKeys = [
      'concept', 'narrativeDrive', 'character', 'voice', 'sceneConstruction',
      'dialogue', 'theme', 'worldbuilding', 'pacing', 'proseControl', 'tone',
      'narrativeClosure', 'marketability',
    ];
    result.criteria = criterionKeys.map((key, index) => makeCriterion({
      key,
      score_0_10: [7, 6, 8, 8, 6, 7, 8, 7, 5, 6, 7, 5, 6][index],
      recommendations: key === 'proseControl' ? [makeRecommendation()] : [],
    }));

    const vm = buildVm(result, 'short_form_evaluation');
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const html = testing.renderHtmlFromViewModel(vm, '27aeb0e8-94aa-4d60-a96f-6a7a9d58ec5d');
    const dashboard = html.match(/<div class="dashboard">([\s\S]*?)<\/div>\s*<div class="grid title-metadata-grid">/)?.[1] ?? '';
    expect(dashboard).not.toContain('Target Audience');
    expect(html).toContain('<div class="cover-wide"><strong>Target Audience</strong>');

    const fullPdf = await testing.buildChromiumPdf(html);
    const bodyOnlyHtml = html.replace(/<header class="cover[^>]*>[\s\S]*?<\/header>/, '');
    const bodyOnlyPdf = await testing.buildChromiumPdf(bodyOnlyHtml);

    expect(fullPdf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(countPdfPages(fullPdf)).toBe(countPdfPages(bodyOnlyPdf) + 1);
    expect(countPdfPages(fullPdf)).toBeLessThanOrEqual(10);

    if (process.env.REPORT_PDF_PROOF_PATH) {
      const { writeFileSync } = await import('fs');
      writeFileSync(process.env.REPORT_PDF_PROOF_PATH, fullPdf);
    }
  }, 30_000);

  test('canonical result -> UED -> VM -> TXT/HTML/DOCX/PDF/Web parity for a normal short-form report', async () => {
    const result = makeBaseResult();
    result.criteria = [makeCriterion()];

    const vm = buildVm(result, 'short_form_evaluation');
    const { txt, html, docxText, pdfBuffer } = await renderAllFormats(vm);

    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(pdfBuffer.length).toBeGreaterThan(1024);

    const narrativeDetail = vm.criterionDetails.find((d: any) => d.key === 'narrativeDrive');
    const webHtml = renderToString(React.createElement(CriterionOpportunities, { presentedOpportunities: narrativeDetail?.presentedOpportunities ?? [] }));

    const normalize = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
    [
      ['What We Observed', 'Stakes diffuse before reaching the reader.'],
      ['Why It Matters', 'Mid-chapter tension release without replacement hook.'],
      ['Suggested Direction', 'Insert a ticking-clock reminder every 800 words.'],
      ['Expected Reader Experience', 'Sustains reader engagement and enhances narrative urgency.'],
      ['Preserve', 'Check each scene break for a forward-pull sentence.'],
      ['Risk if Mishandled', 'Flattened scene transitions'],
      ['Risk if Mishandled', 'Loss of reader urgency'],
      ['Evidence', LONG_EVIDENCE],
    ].forEach(([label, value]) => {
      expect(normalize(txt)).toContain(label);
      expect(normalize(txt)).toContain(value);
      expect(normalize(html)).toContain(label);
      expect(normalize(html)).toContain(value);
      expect(normalize(docxText)).toContain(label);
      expect(normalize(docxText)).toContain(value);
      expect(normalize(webHtml)).toContain(label);
      expect(normalize(webHtml)).toContain(value);
    });

    expect(txt).toContain('RECOMMENDED REVISION #1');
    expect(html).toContain('RECOMMENDED REVISION');
    expect(docxText).toContain('RECOMMENDED REVISION');
    expect(normalize(webHtml)).toContain('Recommended Revision #1');
  });

  test('sparse short-form report renders explicit absence statuses instead of blank sections', async () => {
    const result = makeBaseResult();
    result.overview.one_paragraph_summary = '';
    result.overview.top_3_strengths = [];
    result.overview.top_3_risks = [];
    result.criteria = [makeCriterion({
      recommendations: [],
      recommendation_status: 'insufficient_evidence',
      recommendation_status_rationale: 'No actionable revision opportunity was identified for this criterion.',
    })];

    const vm = buildVm(result, 'short_form_evaluation');
    const { txt, html, docxText, pdfBuffer } = await renderAllFormats(vm);

    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');

    expect(vm.executiveSummary).toBe(ABSENCE_STATUS_TEXT);
    expect(vm.topStrengths).toEqual([ABSENCE_STATUS_TEXT]);
    expect(vm.topRisks).toEqual([ABSENCE_STATUS_TEXT]);
    expect(vm.topRecommendations).toEqual([ABSENCE_STATUS_TEXT]);

    const expected = [ABSENCE_STATUS_TEXT, 'No actionable revision opportunity was identified for this criterion.'];
    for (const text of [txt, html, docxText]) {
      for (const value of expected) {
        expect(text).toContain(value);
      }
    }
  });

  test('perfect-score short-form report surfaces explicit status for suppressed risk/recommendation lists', async () => {
    const result = makeBaseResult();
    result.overview.overall_score_0_100 = 98;
    result.overview.top_3_risks = [];
    result.criteria = [makeCriterion({
      score_0_10: 10,
      recommendations: [],
      recommendation_status: 'no_recommendation_warranted',
      recommendation_status_rationale: 'The manuscript performs strongly on this criterion.',
    })];

    const vm = buildVm(result, 'short_form_evaluation');
    const { txt, html, docxText, pdfBuffer } = await renderAllFormats(vm);

    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(vm.topRisks).toEqual([ABSENCE_STATUS_TEXT]);
    expect(vm.topRecommendations).toEqual([ABSENCE_STATUS_TEXT]);

    for (const text of [txt, html, docxText]) {
      expect(text).toContain(ABSENCE_STATUS_TEXT);
      expect(text).toContain('The manuscript performs strongly on this criterion.');
    }
  });

  test('long-form report propagates mode-specific surfaces and absence statuses', async () => {
    const result = makeBaseResult();
    result.metrics.manuscript.word_count = 30000;
    result.criteria = [makeCriterion()];

    const vm = buildVm(result, 'long_form_evaluation');
    const { txt, html, docxText, pdfBuffer } = await renderAllFormats(vm);

    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');

    const longFormLabels = [
      'Manuscript-Scale Continuity Findings',
      'Story Ledger or Layer-Aware Architecture Map',
      'Review Gate Readiness Surface',
      'Governed Ledgers or Compact Governed-Ledger Addenda',
      'Cross-Layer Synthesis',
      'Layer-Aware Revision Sequencing',
      'Long-Form Continuity and Coverage Proof',
    ];

    for (const label of longFormLabels) {
      const pattern = new RegExp(label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
      expect(txt).toMatch(pattern);
      expect(html).toMatch(pattern);
      expect(docxText).toMatch(pattern);
    }

    expect(vm.modeSpecific.readinessReleasabilityPosture).toBe(ABSENCE_STATUS_TEXT);
  });

  test('persisted UED path is identical to in-memory UED path', async () => {
    const result = makeBaseResult();
    result.criteria = [makeCriterion()];

    const ued = buildUnifiedDocumentForParityFromEvaluationResult({
      evaluationResult: result,
      displayTitle: 'E2E Manuscript',
      mode: 'short_form_evaluation',
    });
    const uedHash = canonicalJsonSha256(ued);

    function makeSupabaseMock(rows: Record<string, unknown>) {
      return {
        from: jest.fn(() => {
          const chain = {
            artifactType: undefined as string | undefined,
            select: jest.fn(() => chain),
            eq: jest.fn((field: string, value: string) => {
              if (field === 'artifact_type') chain.artifactType = value;
              return chain;
            }),
            order: jest.fn(() => chain),
            limit: jest.fn(() => chain),
            maybeSingle: jest.fn(async () => ({
              data: chain.artifactType ? rows[chain.artifactType] ?? null : null,
              error: null,
            })),
          };
          return chain;
        }),
      };
    }

    const supabase = makeSupabaseMock({
      unified_evaluation_document_v1: { content: ued },
      author_exposure_certification_v1: {
        content: {
          schema_version: 'author_exposure_certification_v1',
          decision: 'certified',
          unified_document_hash: uedHash,
        },
      },
    });

    const loadResult = await loadCertifiedUnifiedEvaluationDocumentArtifact(supabase as never, result.ids.job_id);
    expect(loadResult.ok).toBe(true);
    if (!loadResult.ok) throw new Error('loadResult should be ok');

    const vm = normalizeEvaluationReportViewModel({ ued: loadResult.document });
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const txt = testing.renderTxtFromViewModel(vm);

    const normalize = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
    expect(normalize(txt)).toContain('What We Observed');
    expect(normalize(txt)).toContain('Risk if Mishandled');
    expect(normalize(txt)).toContain('Flattened scene transitions');
    expect(normalize(txt)).toContain('Loss of reader urgency');
    expect(txt).toContain('RECOMMENDED REVISION #1');
  });
  test('retains provenance in canonical data while excluding it from every author-facing renderer', async () => {
    const sourceId = 'marketability:abc123:1';
    const result = makeBaseResult();
    result.criteria = [
      makeCriterion({ recommendations: [makeRecommendation({ source_recommendation_ids: [sourceId] })] }),
    ];

    expect(result.criteria[0].recommendations[0].source_recommendation_ids).toEqual([
      sourceId,
    ]);

    const vm = buildVm(result, 'short_form_evaluation');
    const { txt, html, docxText, pdfBuffer } = await renderAllFormats(vm);

    expect(JSON.stringify(vm)).not.toContain('source_recommendation_ids');
    expect(JSON.stringify(vm)).not.toContain(sourceId);
    for (const output of [txt, html, docxText, pdfBuffer.toString('latin1')]) {
      expect(output).not.toContain('source_recommendation_ids');
      expect(output).not.toContain(sourceId);
    }
  }, 30_000);
});
