/**
 * Renderer Parity Guard — Issue #1021
 *
 * Verifies that all download formats (PDF, DOCX, TXT) and the web renderer
 * consume the same canonical artifact source through the same safety pipeline.
 *
 * Architecture invariant:
 *   UnifiedEvaluationDocument → reportRenderSafety → {web, PDF, DOCX, TXT}
 *
 * No renderer should independently construct, omit, truncate, reorder, or
 * restyle content in a way that changes the perceived report structure.
 */
import fs from 'fs';
import path from 'path';
import { validateDownloadParity } from '@/lib/evaluation/downloadParityGate';

const DOWNLOAD_ROUTE = path.resolve(
  __dirname,
  '../../app/api/reports/[jobId]/download/route.ts',
);

const VM_SOURCE = path.resolve(
  __dirname,
  '../../lib/evaluation/evaluationReportViewModel.ts',
);

const SHORT_FORM_DOC = path.resolve(
  __dirname,
  '../../lib/evaluation/shortFormReportDocument.ts',
);

describe('Issue #1021 — Renderer Parity Guard', () => {
  let downloadRouteSource: string;
  let vmSource: string;
  let shortFormSource: string;

  beforeAll(() => {
    downloadRouteSource = fs.readFileSync(DOWNLOAD_ROUTE, 'utf-8');
    vmSource = fs.readFileSync(VM_SOURCE, 'utf-8');
    shortFormSource = fs.readFileSync(SHORT_FORM_DOC, 'utf-8');
  });

  // ─── Shared canonical artifact source ───────────────────────────────

  test('download route loads from certified UnifiedEvaluationDocument artifact', () => {
    expect(downloadRouteSource).toContain('loadCertifiedUnifiedEvaluationDocumentArtifact');
  });

  test('download route runs validateDownloadParity before generating any format', () => {
    expect(downloadRouteSource).toContain('validateDownloadParity');
  });

  test('download route applies sanitizeResultForDownload to shared artifact', () => {
    expect(downloadRouteSource).toContain('sanitizeResultForDownload');
  });

  // ─── Shared safety pipeline ─────────────────────────────────────────

  test('all format branches use mistakeProofText for author-facing text', () => {
    expect(downloadRouteSource).toContain('mistakeProofText');
  });

  test('all format branches use sanitizeCMOS', () => {
    expect(downloadRouteSource).toContain('sanitizeCMOS');
  });

  test('UED construction uses buildTopRecommendations from shared module', () => {
    // buildTopRecommendations runs during UED construction, VM consumes pre-built ued.topRecommendations
    expect(shortFormSource).toContain('buildTopRecommendations');
  });

  test('UED construction uses buildReportPitches from shared template contract', () => {
    // buildReportPitches runs during UED construction, VM consumes pre-built pitches
    expect(shortFormSource).toContain('buildReportPitches');
  });

  test('download route uses getAuthorExposureDecision gate', () => {
    expect(downloadRouteSource).toContain('getAuthorExposureDecision');
  });

  // ─── Format coverage ────────────────────────────────────────────────

  test('download route supports PDF format', () => {
    expect(downloadRouteSource).toMatch(/format\s*===?\s*['"]pdf['"]/i);
  });

  test('download route supports DOCX format', () => {
    // DOCX is the default format — validated by includes check
    expect(downloadRouteSource).toContain("'pdf', 'docx', 'txt'");
  });

  test('download route supports TXT format', () => {
    expect(downloadRouteSource).toMatch(/format\s*===?\s*['"]txt['"]/i);
  });

  // ─── No independent content construction ────────────────────────────

  test('no format branch independently fetches evaluation_result_v2 — all use shared artifact', () => {
    // Count how many times the canonical artifact loader appears vs raw queries
    const canonicalLoads = (downloadRouteSource.match(/loadCertifiedUnifiedEvaluationDocumentArtifact/g) || []).length;
    expect(canonicalLoads).toBeGreaterThanOrEqual(1);

    // Should not have separate artifact queries per format
    const rawArtifactQueries = (downloadRouteSource.match(/\.from\(['"]job_artifacts['"]\).*evaluation_result_v2/g) || []).length;
    expect(rawArtifactQueries).toBe(0);
  });

  // ─── Download parity gate function ──────────────────────────────────

  test('validateDownloadParity detects missing criteria', () => {
    const result = validateDownloadParity({ overview: { overall_score_0_100: 75 } });
    expect(result.pass).toBe(false);
    expect(result.violations.some(v => v.code === 'NO_CRITERIA')).toBe(true);
  });

  test('validateDownloadParity passes for well-formed result', () => {
    const result = validateDownloadParity({
      overview: {
        overall_score_0_100: 75,
        one_paragraph_summary: 'A well-crafted story about redemption.',
        top_3_strengths: ['Strong voice', 'Compelling characters', 'Vivid settings'],
        top_3_risks: ['Pacing issues in Act 2', 'Dialogue needs polish', 'Ending feels rushed'],
      },
      criteria: [
        { key: 'voice', score_0_10: 8, rationale: 'Distinct and engaging voice throughout.' },
      ],
    });
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // ─── Shared formatting utilities ────────────────────────────────────

  test('download route uses shared confidence label formatting', () => {
    expect(downloadRouteSource).toContain('formatConfidenceLabel');
  });

  test('download route uses shared score formatting', () => {
    expect(downloadRouteSource).toContain('formatScoreForDisplay');
  });

  test('shared revision opportunity summarizer is available in template contract', () => {
    const contractSource = fs.readFileSync(
      path.resolve(__dirname, '../../lib/evaluation/reportTemplateContract.ts'), 'utf-8');
    expect(contractSource).toContain('summarizeRevisionOpportunities');
  });

  test('VM uses filterAuthorFacingTextList for safety-filtered lists', () => {
    expect(vmSource).toContain('filterAuthorFacingTextList');
  });

  test('VM uses getCriterionDisplayLabel for consistent criterion names', () => {
    expect(vmSource).toContain('getCriterionDisplayLabel');
  });
});
