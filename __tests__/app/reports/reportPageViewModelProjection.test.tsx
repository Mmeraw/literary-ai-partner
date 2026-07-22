/** @jest-environment jsdom */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { buildUnifiedDocumentForParityFromEvaluationResult } from '@/lib/evaluation/reportRenderParity';
import type { EvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';

let projectedViewModel: EvaluationReportViewModel;

const evaluationResult = {
  schema_version: 'evaluation_result_v2',
  ids: {
    evaluation_run_id: 'web-projection-run',
    job_id: 'web-projection-job',
    manuscript_id: 17,
    user_id: 'author-1',
  },
  generated_at: '2026-07-22T00:00:00.000Z',
  engine: { model: 'projection-test', provider: 'other', prompt_version: 'test' },
  overview: {
    overall_score_0_100: 11,
    verdict: 'revise',
    one_paragraph_summary: 'Raw upstream summary that the webpage must not project directly.',
    top_3_strengths: ['Raw strength'],
    top_3_risks: ['Raw risk'],
  },
  metrics: {
    manuscript: {
      title: 'Projection Contract Manuscript',
      word_count: 4500,
      genre: 'RAW UPSTREAM GENRE',
      target_audience: 'Adult readers',
    },
  },
  enrichment: {
    premise: 'A projection contract premise.',
    trigger_warnings: [],
    reading_grade_level: 8,
    dialogue_percentage: 30,
    narrative_percentage: 70,
  },
  criteria: [{
    key: 'narrativeDrive',
    score_0_10: 1,
    confidence_level: 'low',
    confidence_score_0_100: 10,
    scorable: true,
    status: 'SCORABLE',
    signal_present: true,
    signal_strength: 'SUFFICIENT',
    rationale: 'Raw criterion rationale.',
    recommendations: [],
  }],
  recommendations: { quick_wins: [], strategic_revisions: [] },
};

const databaseJob = {
  evaluation_result: evaluationResult,
  status: 'completed',
  validity_status: 'valid',
  manuscript_id: 17,
  manuscripts: { user_id: 'author-1', title: 'Projection Contract Manuscript' },
};

const single = jest.fn(async () => ({ data: databaseJob, error: null }));
const query = {
  select: jest.fn(() => query),
  eq: jest.fn(() => query),
  single,
  maybeSingle: jest.fn(async () => ({ data: null, error: null })),
};

jest.mock('server-only', () => ({}));
jest.mock('next/cache', () => ({ unstable_noStore: jest.fn() }));
jest.mock('next/navigation', () => ({ notFound: jest.fn(() => { throw new Error('notFound'); }) }));
jest.mock('next/headers', () => ({ headers: jest.fn(async () => new Headers()) }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href?.toString()} {...props}>{children}</a>
  ),
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'author-1', app_metadata: {} } } })) },
  })),
}));
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({ from: jest.fn(() => query) })),
}));
jest.mock('@/lib/jobs/readReleaseGate', () => ({ canReleaseEvaluationRead: jest.fn(() => true) }));
jest.mock('@/lib/evaluation/authorExposureCertification', () => ({
  getAuthorExposureDecision: jest.fn(async () => ({ exposable: true, reason: 'certified' })),
}));
jest.mock('@/schemas/evaluation-result-v1', () => ({
  isEvaluationResultV1: jest.fn(() => false),
  hasD2TransparencyFields: jest.fn(() => true),
}));
jest.mock('@/schemas/evaluation-result-v2', () => ({ isEvaluationResultV2: jest.fn(() => true) }));
jest.mock('@/lib/release/forbiddenMarketClaims', () => ({
  scanObjectForForbiddenMarketClaims: jest.fn(() => false),
}));
jest.mock('@/lib/evaluation/persistedUnifiedEvaluationDocument', () => ({
  loadCertifiedUnifiedEvaluationDocumentArtifact: jest.fn(async () => ({
    ok: true,
    document: { schema_version: 'unified_evaluation_document_v1' },
  })),
}));
jest.mock('@/lib/evaluation/evaluationReportViewModel', () => ({
  normalizeEvaluationReportViewModel: jest.fn(() => projectedViewModel),
}));
jest.mock('@/lib/support/checkSupportAccess', () => ({
  hasActiveSupportGrant: jest.fn(async () => null),
  logSupportView: jest.fn(),
}));

jest.mock('@/components/evaluation/SynthesisPoller', () => ({ SynthesisPoller: () => <div /> }));
jest.mock('@/components/reports/CriterionOpportunities', () => () => <div />);
jest.mock('@/components/reports/DownloadReportButton', () => () => <button>Download</button>);
jest.mock('@/components/reports/CopyReferenceIdButton', () => () => <button>Copy reference</button>);
jest.mock('@/components/reports/AutoPrintOnLoad', () => () => null);
jest.mock('@/components/reports/SupportAccessToggle', () => () => null);
jest.mock('@/components/reports/longform/LongformCharacterCoverageArcLedger', () => () => null);
jest.mock('@/components/reports/longform/LongformRelationshipSpineLedger', () => () => null);
jest.mock('@/components/reports/longform/LongformSymbolPayoffLedger', () => () => null);
jest.mock('@/components/reports/longform/LongformSensoryEmotionalRegister', () => () => null);
jest.mock('@/components/reports/longform/LongformManuscriptIntegrityTable', () => () => null);
jest.mock('@/components/reports/longform/LongformEvidenceDistributionGate', () => () => null);

describe('S11a webpage ViewModel projection evidence', () => {
  beforeAll(() => {
    const { normalizeEvaluationReportViewModel } = jest.requireActual(
      '@/lib/evaluation/evaluationReportViewModel',
    ) as typeof import('@/lib/evaluation/evaluationReportViewModel');
    const ued = buildUnifiedDocumentForParityFromEvaluationResult({
      evaluationResult,
      displayTitle: 'Projection Contract Manuscript',
      mode: 'short_form_evaluation',
    });
    projectedViewModel = normalizeEvaluationReportViewModel({ ued: ued as any });

    projectedViewModel.titleBlock.reportType = 'VM REPORT TYPE SENTINEL';
    projectedViewModel.titleBlock.overallScoreLabel = 'VM SCORE SENTINEL';
    projectedViewModel.titleBlock.genre = 'VM GENRE SENTINEL';
    projectedViewModel.criteriaScoreGrid.forEach((row, index) => {
      row.confidenceLabel = `VM CONFIDENCE ${index + 1} SENTINEL`;
    });
    projectedViewModel.criterionDetails.forEach((detail, index) => {
      detail.confidenceLabel = `VM CONFIDENCE ${index + 1} SENTINEL`;
    });
  });

  it('projects report type, score, genre, and criterion confidence from the actual ViewModel consumer', async () => {
    const { default: ReportPage } = await import('@/app/reports/[jobId]/page');
    const page = await ReportPage({ params: { jobId: 'web-projection-job' } });
    const { container } = render(page);

    expect(screen.getByText('VM REPORT TYPE SENTINEL')).toBeTruthy();
    expect(screen.getAllByText('VM SCORE SENTINEL').length).toBeGreaterThanOrEqual(1);

    const metadata = container.querySelector('dl');
    expect(metadata).not.toBeNull();
    expect(within(metadata as HTMLElement).getByText('VM GENRE SENTINEL')).toBeTruthy();

    const criteriaGrid = screen.getByRole('heading', { name: '13 Criteria Score Grid' }).parentElement;
    expect(criteriaGrid).not.toBeNull();
    projectedViewModel.criteriaScoreGrid.forEach((_row, index) => {
      expect(
        within(criteriaGrid as HTMLElement).getByText(`VM CONFIDENCE ${index + 1} SENTINEL`),
      ).toBeTruthy();
    });

    expect(screen.queryByText('RAW UPSTREAM GENRE')).toBeNull();
    expect(screen.queryByText('11/100')).toBeNull();
  });
});
