import type { ReportRenderManifestV1 } from '@/lib/evaluation/reportRenderParity';
import {
  buildAuthorExposureCertificationV1FromManifest,
  buildReportRenderManifestV1,
  buildUnifiedDocumentForParityFromEvaluationResult,
  inferCanonicalEvaluationModeFromWordCount,
} from '@/lib/evaluation/reportRenderParity';
import type { EvaluationResultV2 } from '@/schemas/evaluation-result-v2';

function makeBaseManifest(): ReportRenderManifestV1 {
  const fieldHashes: Record<string, string> = {
    'title': 'h1',
    'titleBlock.reportType': 'h2',
    'titleBlock.genre': 'h3',
    'titleBlock.targetAudience': 'h4',
    'titleBlock.overallScoreLabel': 'h5',
    'titleBlock.overallScoreConfidenceLabel': 'h6',
    'titleBlock.marketReadiness': 'h7',
    'titleBlock.marketReadinessConfidenceLabel': 'h8',
    'oneParagraphPitch': 'h9',
    'oneSentencePitch': 'h10',
    'contentWarnings': 'h11',
    'executiveSummary': 'h12',
    'topStrengths': 'h13',
    'topRisks': 'h14',
    'topRecommendations': 'h15',
    'criteriaScoreGrid': 'h16',
    'criterionDetails': 'h17',
    'confidenceExplanation': 'h18',
    'disclaimer': 'h19',
  };

  return {
    schema_version: 'report_render_manifest_v1',
    generated_at: new Date().toISOString(),
    job_id: 'job-1',
    template: {
      mode: 'short_form_evaluation',
      template_name: 'Short-Form Evaluation Template',
      template_path: 'docs/templates/evaluation/short-form-evaluation-template.md',
      report_type: 'Short-Form Evaluation',
    },
    unified_document_hash: 'doc-hash',
    unified_document_field_hashes: fieldHashes,
    required_field_registry: Object.keys(fieldHashes),
    renderer_versions: {
      webpage: 'webpage_ued_v1',
      pdf: 'pdf_canonical_template_v1',
      docx: 'docx_canonical_template_v1',
      txt: 'txt_canonical_template_v1',
    },
    surfaces: {
      webpage: {
        consumed_fields: Object.keys(fieldHashes),
        field_hashes: { ...fieldHashes },
        missing_required_fields: [],
        suppressed_fields: [],
        derived_canonical_fields: [],
      },
      pdf: {
        consumed_fields: Object.keys(fieldHashes),
        field_hashes: { ...fieldHashes },
        missing_required_fields: [],
        suppressed_fields: [],
        derived_canonical_fields: [],
      },
      docx: {
        consumed_fields: Object.keys(fieldHashes),
        field_hashes: { ...fieldHashes },
        missing_required_fields: [],
        suppressed_fields: [],
        derived_canonical_fields: [],
      },
      txt: {
        consumed_fields: Object.keys(fieldHashes),
        field_hashes: { ...fieldHashes },
        missing_required_fields: [],
        suppressed_fields: [],
        derived_canonical_fields: [],
      },
    },
    parity: {
      status: 'pass',
      missing_required_fields: [],
      mismatched_fields: [],
      derived_canonical_fields: [],
      reasons: [],
    },
  };
}

describe('report render parity certification', () => {
  test('blocks when webpage misses required field', () => {
    const manifest = makeBaseManifest();
    manifest.parity.status = 'fail';
    manifest.parity.reasons = ['required_fields_missing'];
    manifest.parity.missing_required_fields = ['webpage:titleBlock.overallScoreLabel'];
    manifest.surfaces.webpage.missing_required_fields = ['titleBlock.overallScoreLabel'];

    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.decision).toBe('blocked');
    expect(cert.blocking_reasons).toContain('webpage:titleBlock.overallScoreLabel');
  });

  test('blocks when any renderer has canonical mismatch', () => {
    const manifest = makeBaseManifest();
    manifest.parity.status = 'fail';
    manifest.parity.reasons = ['required_fields_mismatch'];
    manifest.parity.mismatched_fields = ['pdf:titleBlock.genre'];

    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.decision).toBe('blocked');
    expect(cert.parity_results.mismatched_fields).toContain('pdf:titleBlock.genre');
  });

  test('blocks when renderer-derived canonical field is detected', () => {
    const manifest = makeBaseManifest();
    manifest.parity.status = 'fail';
    manifest.parity.reasons = ['renderer_derived_canonical_fields_detected'];
    manifest.parity.derived_canonical_fields = ['txt:titleBlock.marketReadiness'];
    manifest.surfaces.txt.derived_canonical_fields = ['titleBlock.marketReadiness'];

    const cert = buildAuthorExposureCertificationV1FromManifest(manifest);
    expect(cert.decision).toBe('blocked');
    expect(cert.blocking_reasons).toContain('txt:titleBlock.marketReadiness');
  });
});

describe('report render parity manifest builder', () => {
  test('infers canonical template mode across short, long, and multi-layer word-count bands', () => {
    expect(inferCanonicalEvaluationModeFromWordCount(24_999)).toBe('short_form_evaluation');
    expect(inferCanonicalEvaluationModeFromWordCount(25_000)).toBe('long_form_evaluation');
    expect(inferCanonicalEvaluationModeFromWordCount(74_999)).toBe('long_form_evaluation');
    expect(inferCanonicalEvaluationModeFromWordCount(75_000)).toBe('long_form_multi_layer_evaluation');
    expect(inferCanonicalEvaluationModeFromWordCount(120_000)).toBe('long_form_multi_layer_evaluation');
  });

  test('builds manifest from unified document shape', () => {
    const mode = inferCanonicalEvaluationModeFromWordCount(5000);
    const result = {
      generated_at: '2026-06-11T00:00:00.000Z',
      overview: {
        overall_score_0_100: 76,
        verdict: 'revise',
        one_paragraph_summary: 'Summary',
        top_3_strengths: ['A', 'B', 'C'],
        top_3_risks: ['R1', 'R2', 'R3'],
      },
      metrics: {
        manuscript: {
          title: 'Test Manuscript',
          word_count: 5000,
          genre: 'thriller',
          target_audience: 'adult thriller readers',
        },
      },
      enrichment: {
        premise: 'Premise',
        trigger_warnings: ['violence'],
        reading_grade_level: '10',
        dialogue_percentage: 30,
        narrative_percentage: 70,
      },
      governance: {
        warnings: [],
        limitations: [],
      },
      criteria: [],
      recommendations: {
        quick_wins: [],
        strategic_revisions: [],
      },
    } as unknown as EvaluationResultV2;

    const doc = buildUnifiedDocumentForParityFromEvaluationResult({
      evaluationResult: result,
      displayTitle: 'Test Manuscript',
      mode,
    });

    const manifest = buildReportRenderManifestV1({
      jobId: 'job-manifest',
      unifiedDocument: doc,
    });

    expect(manifest.schema_version).toBe('report_render_manifest_v1');
    expect(manifest.job_id).toBe('job-manifest');
    expect(manifest.template.mode).toBe('short_form_evaluation');
    expect(manifest.renderer_versions.webpage).toContain('webpage');
  });
});
