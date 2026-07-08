import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { getAuthorExposureDecision } from '@/lib/evaluation/authorExposureCertification';
import { EvaluationResultV1, isEvaluationResultV1, hasD2TransparencyFields } from '@/schemas/evaluation-result-v1';
import { isEvaluationResultV2, EvaluationResultV2 } from '@/schemas/evaluation-result-v2';
import { scanObjectForForbiddenMarketClaims } from '@/lib/release/forbiddenMarketClaims';
// reportCriterionDisplay helpers removed — all criterion display fields are
// owned by the ViewModel (vm.criterionDetails.*). Dead imports eliminated
// as part of U2-005 authority hardening.
import { loadCertifiedUnifiedEvaluationDocumentArtifact } from '@/lib/evaluation/persistedUnifiedEvaluationDocument';
import {
  getDisplayText,
  splitIntoParagraphs,
} from '@/lib/evaluation/reportRenderSafety';
import { resolveReportTitle } from '@/lib/evaluation/reportTitle';
import { normalizeEvaluationReportViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import type { LongFormMultiLayerEvaluationViewModel } from '@/lib/evaluation/evaluationReportViewModel';
import { hasActiveSupportGrant, logSupportView } from '@/lib/support/checkSupportAccess';
import { getLongFormMultiLayerSections } from '@/lib/evaluation/sharedLongFormMultiLayerSections';
import { SynthesisPoller } from '@/components/evaluation/SynthesisPoller';
import CriterionOpportunities from '@/components/reports/CriterionOpportunities';
import DownloadReportButton from '@/components/reports/DownloadReportButton';
import CopyReferenceIdButton from '@/components/reports/CopyReferenceIdButton';
import AutoPrintOnLoad from '@/components/reports/AutoPrintOnLoad';
import SupportAccessToggle from '@/components/reports/SupportAccessToggle';
import LongformCharacterCoverageArcLedger from '@/components/reports/longform/LongformCharacterCoverageArcLedger';
import LongformRelationshipSpineLedger from '@/components/reports/longform/LongformRelationshipSpineLedger';
import LongformSymbolPayoffLedger from '@/components/reports/longform/LongformSymbolPayoffLedger';
import LongformSensoryEmotionalRegister from '@/components/reports/longform/LongformSensoryEmotionalRegister';
import LongformManuscriptIntegrityTable from '@/components/reports/longform/LongformManuscriptIntegrityTable';
import LongformEvidenceDistributionGate from '@/components/reports/longform/LongformEvidenceDistributionGate';
// WAVE/Canon governance imports removed — these sections are internal-only
// and must never render on the user-facing reports page.
// import WaveGovernanceSummary from '@/components/reports/WaveGovernanceSummary';
// import CanonGovernanceSummary from '@/components/reports/CanonGovernanceSummary';
// import { getAllCanonGovernanceData } from '@/lib/evaluation/waveGovernanceData';

// ── Shared section contract: single source of truth for §13–§21 headings ──
const _webSectionContract = getLongFormMultiLayerSections();
function webSectionTitle(id: string): string {
  const sec = _webSectionContract.find(s => s.id === id);
  if (!sec) throw new Error(`Unknown section id: ${id}`);
  return sec.title;
}

// D1 Boundary: server-only. Service key must not leak to client.
// Hybrid owner-gate: SSR client for auth identity, admin client for
// privileged read scoped to (jobId + manuscript owner = auth.uid()).
// Ownership chain: evaluation_jobs.manuscript_id -> manuscripts.user_id
// TODO(gate7): migrate to full RLS once evaluation_jobs has user_id column.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EvaluationReportContext = {
  result: EvaluationResultV1 | EvaluationResultV2;
  manuscriptTitle: string | null;
  manuscriptId: number | null;
  progress: unknown;
};

type ReportSearchParams = {
  print?: string | string[];
};

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function hasMeaningfulText(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : typeof value === 'number';
}

function renderNoIndentOrderedList(items: string[], itemClassName = 'text-[#5C5549]'): JSX.Element {
  return (
    <ol className="space-y-1">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`} className={`flex items-start gap-2 ${itemClassName}`}>
          <span className="mt-0.5 shrink-0 font-semibold text-[#8B2E2E]">{index + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

// sanitizeAuthorFacingDisplayValue REMOVED — the ViewModel now owns all
// sanitization (mistakeProofText + correctScopeLanguage). Renderers must not
// apply their own correction layer on VM-owned fields.

// getConfidenceBadge removed — confidence display is owned by the ViewModel
// (vm.criterionDetails[n].confidenceLabel, vm.criteriaScoreGrid[n].confidenceLabel).
// Raw V1 criteria reads eliminated as part of U2-005 authority hardening.

function extractManuscriptTitle(manuscripts: unknown): string | null {
  const relation = Array.isArray(manuscripts) ? manuscripts[0] : manuscripts;
  const title = typeof relation === 'object' && relation && 'title' in relation
    ? (relation as { title?: unknown }).title
    : null;

  return typeof title === 'string' && title.trim().length > 0 ? title.trim() : null;
}

async function getEvaluationResult(jobId: string, userId: string): Promise<EvaluationReportContext | null> {
  noStore();

  const admin = createAdminClient();

  // Owner-gated read: join through manuscripts FK to verify ownership.
  // evaluation_jobs has no user_id column; ownership traces through:
  // evaluation_jobs.manuscript_id -> manuscripts.id -> manuscripts.user_id
  const { data: job, error } = await admin
    .from('evaluation_jobs')
    .select(`
      evaluation_result,
      status,
      validity_status,
      progress,
      manuscript_id,
      manuscripts!inner(user_id,title)
    `)
    .eq('id', jobId)
    .eq('manuscripts.user_id', userId)
    .single();

  if (error || !job || !canReleaseEvaluationRead(job) || !job.evaluation_result) {
    return null;
  }

  const exposureDecision = await getAuthorExposureDecision(admin, jobId);
  if (exposureDecision.exposable === false) {
    if (exposureDecision.reason === 'db_error') {
      throw new Error(`System error checking author exposure certification: ${exposureDecision.details ?? 'unknown database error'}`);
    }

    console.error('[reports.page] author_exposure gate blocked render — notFound()', {
      jobId,
      reason: exposureDecision.reason,
    });
    notFound();
  }

  const result = job.evaluation_result as unknown;

  if (!isEvaluationResultV1(result) && !isEvaluationResultV2(result)) {
    console.error('Invalid evaluation result format for job:', jobId);
    return null;
  }

  const rawManuscriptId = (job as Record<string, unknown>).manuscript_id;
  return {
    result,
    manuscriptTitle: extractManuscriptTitle((job as { manuscripts?: unknown }).manuscripts),
    manuscriptId: typeof rawManuscriptId === 'number' ? rawManuscriptId : null,
    progress: (job as { progress?: unknown }).progress ?? null,
  };
}

async function getEvaluationResultForSupport(jobId: string): Promise<EvaluationReportContext | null> {
  noStore();

  const admin = createAdminClient();

  const { data: job, error } = await admin
    .from('evaluation_jobs')
    .select(`
      evaluation_result,
      status,
      validity_status,
      progress,
      manuscript_id,
      manuscripts(title)
    `)
    .eq('id', jobId)
    .single();

  if (error || !job || !canReleaseEvaluationRead(job) || !job.evaluation_result) {
    return null;
  }

  const exposureDecision = await getAuthorExposureDecision(admin, jobId);
  if (exposureDecision.exposable === false) {
    if (exposureDecision.reason === 'db_error') {
      throw new Error(`System error checking author exposure certification: ${exposureDecision.details ?? 'unknown database error'}`);
    }

    console.error('[reports.page] author_exposure gate blocked support render — notFound()', {
      jobId,
      reason: exposureDecision.reason,
    });
    notFound();
  }

  const result = job.evaluation_result as unknown;

  if (!isEvaluationResultV1(result) && !isEvaluationResultV2(result)) {
    console.error('Invalid evaluation result format for support path job:', jobId);
    return null;
  }

  const rawManuscriptId = (job as Record<string, unknown>).manuscript_id;
  return {
    result,
    manuscriptTitle: extractManuscriptTitle((job as { manuscripts?: unknown }).manuscripts),
    manuscriptId: typeof rawManuscriptId === 'number' ? rawManuscriptId : null,
    progress: (job as { progress?: unknown }).progress ?? null,
  };
}

/**
 * Fetch the DREAM long-form artifact for a job.
 * Returns null for:
 *   1. Jobs where the DREAM worker hasn't run yet → spinner shown (correct)
 *   2. Jobs with _skipped stubs (no longform_document key) → spinner shown (acceptable — historical evals not surfaced in UI)
 * Owner-check not needed here — job ownership already verified by getEvaluationResult.
 */
async function getDreamArtifact(jobId: string): Promise<unknown | null> {
  noStore();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'longform_document_v1')
    .maybeSingle();

  if (error || !data?.content) return null;

  const content = data.content as { longform_document?: unknown };
  if (!content?.longform_document || typeof content.longform_document !== 'object') return null;

  return content.longform_document;
}

async function getCurrentUserId(): Promise<string | null> {
  const ssrSupabase = await createSSRClient();
  const { data: { user } } = await ssrSupabase.auth.getUser();

  if (user) {
    return user.id;
  }

  if (process.env.TEST_MODE === 'true' && process.env.ALLOW_HEADER_USER_ID === 'true') {
    return (await headers()).get('x-user-id')?.trim() ?? null;
  }

  return null;
}

export async function generateMetadata({ params }: { params: { jobId: string } }): Promise<Metadata> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { title: 'Evaluation Report' };
  }

  const report = await getEvaluationResult(params.jobId, userId);
  if (!report) {
    return { title: 'Evaluation Report' };
  }

  const resultForMeta = report.result as EvaluationResultV1;
  const chapterTitle = resultForMeta.metrics?.manuscript?.title?.trim() || null;
  const { pageTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle: report.manuscriptTitle });
  return { title: pageTitle };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { jobId: string };
  searchParams?: Promise<ReportSearchParams> | ReportSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const printMode = firstSearchParam(resolvedSearchParams.print) === '1';

  // Step 1: Get authenticated user via cookie-scoped SSR client
  const ssrSupabase = await createSSRClient();
  const { data: { user } } = await ssrSupabase.auth.getUser();

  if (!user) {
    notFound(); // Unauthenticated users see 404, not a login redirect
  }

  const reportUserRole = (user.app_metadata as Record<string, unknown> | undefined)?.role;
  const isAdminRole = reportUserRole === 'admin' || reportUserRole === 'superadmin';
  const activeGrant = isAdminRole ? await hasActiveSupportGrant(params.jobId) : null;
  const hasSupportAccess = isAdminRole && !!activeGrant;

  // Step 2: Owner-gated privileged read, with separate support/admin path
  // enabled only when an active author grant exists.
  let report = await getEvaluationResult(params.jobId, user.id);
  if (!report && hasSupportAccess) {
    report = await getEvaluationResultForSupport(params.jobId);
  }

  if (!report) {
    notFound();
  }

  const { result: resultRaw, manuscriptTitle, manuscriptId, progress } = report;
  // Cast to V1 for rendering — V2 is a structural superset; both share
  // governance / engine / metrics / criteria / generated_at top-level shape.
  // The report renderer was written against V1 field names which are present in V2.
  const result = resultRaw as EvaluationResultV1;
  const chapterTitle = result.metrics?.manuscript?.title?.trim() || null;
  const { displayTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });

  // DREAM long-form artifact — async Pass 3b, may not be ready yet.
  const wordCount = result.metrics?.manuscript?.word_count ?? 0;
  const isLongForm = wordCount >= 25000;
  const dreamDoc = isLongForm ? await getDreamArtifact(params.jobId) : null;
  const adminForPersistedUed = createAdminClient();
  const persistedDocument = await loadCertifiedUnifiedEvaluationDocumentArtifact(adminForPersistedUed, params.jobId);
  if (persistedDocument.ok === false) {
    console.error('[reports.page] Certified UED load failed — notFound()', {
      jobId: params.jobId,
      reason: persistedDocument.reason,
      details: persistedDocument.details,
    });
    notFound();
  }

  // ── ViewModel: single source of truth for all rendered fields ──
  // The VM applies all sanitization (mistakeProofText, correctScopeLanguage) internally.
  // Renderers must use vm.* directly — no additional sanitization or business logic.
  // Do NOT re-wrap in sanitizeAuthorFacingDisplayValue; double-sanitization is a bug.
  // Canon governance data intentionally NOT fetched — internal-only, never rendered.

  // Support access: admin/support viewers can see technical sections only
  // when the author has granted temporary access.
  const showTechnicalSections = hasSupportAccess;

  if (showTechnicalSections && activeGrant) {
    await logSupportView(params.jobId, user.id, activeGrant.grantId);
  }

  // D2 fail-closed: block forbidden market guarantee language from rendering in agent-facing output.
  if (scanObjectForForbiddenMarketClaims(result)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Evaluation Report
            </h1>
            <p className="text-xl font-semibold text-gray-900">
              {displayTitle}
            </p>
            <p className="text-gray-600">
              Report unavailable
            </p>
          </header>
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              Compliance Hold
            </h2>
            <p className="text-gray-700 leading-relaxed">
              This report is being withheld because prohibited market-claim language was detected.
            </p>
            <p className="text-sm text-gray-600 mt-4">
              Repro anchor: jobId {params.jobId}
            </p>
          </section>
        </div>
      </div>
    );
  }

  const { overview, criteria, recommendations, metrics, artifacts, governance } = result;

  // ── ViewModel: all rendered content flows through this single boundary ──
  const vm = normalizeEvaluationReportViewModel({
    ued: persistedDocument.document,
    dreamDoc,
    governance: { governance },
    supportMetadata: {
      model: result.engine?.model,
      confidence: governance?.confidence,
      wordCount: metrics?.manuscript?.word_count,
      processingMs: metrics?.processing?.runtime_ms,
    },
  });
  const lf = vm.longFormMultiLayerEvaluation;
  const integrityBanner = vm.integrityBanner;

  // D2 Transparency: validate all required fields are present before rendering agent view.
  if (!hasD2TransparencyFields(result)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Evaluation Report
            </h1>
            <p className="text-xl font-semibold text-gray-900">
              {displayTitle}
            </p>
            <p className="text-gray-600">
              Report unavailable
            </p>
          </header>
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">
              Compliance Hold
            </h2>
            <p className="text-gray-700 leading-relaxed">
              This report is being withheld because required transparency fields are missing.
            </p>
            <p className="text-sm text-gray-600 mt-4">
              Repro anchor: jobId {params.jobId}
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="rg-report-page min-h-screen overflow-x-hidden bg-[#F6F1EA] [overflow-wrap:anywhere]">
      {printMode && <AutoPrintOnLoad enabled />}
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {/* Header + Title Block (template section 1) */}
        <header className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] px-6 py-7 shadow-sm sm:px-8">

          {/* ── Top row: branding + action buttons ── */}
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B2E2E]">RevisionGrade™ — Editorial Readiness Assessment</p>
            <div className="flex w-full flex-wrap items-center gap-3 print-hidden sm:w-auto sm:shrink-0">
              {manuscriptId && (
                <div className="flex flex-col items-center gap-0.5">
                  <Link
                    href={`/workbench?manuscriptId=${manuscriptId}&evaluationJobId=${params.jobId}`}
                    className="rg-revise-cta px-4 py-2 text-sm !text-white visited:!text-white"
                    style={{ color: '#FFFFFF' }}
                  >
                    Revise now
                  </Link>
                  <span className="text-[10px] text-[#9A9087] leading-tight">May take 1–2 min to load</span>
                </div>
              )}
              <DownloadReportButton jobId={params.jobId} />
            </div>
          </div>

          {/* ── Hero: title + score card side by side ── */}
          <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:gap-6">
            {/* Title column */}
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-3xl font-bold leading-tight text-[#1C1814] sm:text-4xl">{displayTitle}</h1>
              <p className="mt-2 text-sm font-medium uppercase tracking-[0.08em] text-[#5C5549]">{vm.titleBlock.reportType}</p>
              {chapterTitle && manuscriptTitle && chapterTitle !== manuscriptTitle && (
                <p className="mt-1 text-sm text-[#5C5549]">{manuscriptTitle}</p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-[#9A9087]">
                Generated {vm.titleBlock.dateGenerated}
                {' · '}
                <span className="font-mono break-all">{params.jobId.slice(0, 8)}</span>
                <CopyReferenceIdButton
                  value={params.jobId}
                  className="ml-1.5 inline-flex items-center rounded-sm border border-[#D9D0C3] px-2 py-0.5 text-xs font-medium text-[#5C5549] transition hover:bg-[#FAF7F2]"
                />
              </p>
            </div>

            {/* Score card — always visible without scrolling */}
            <aside className={`w-full rounded-sm border-2 px-4 py-4 text-center text-[#1A1A1A] sm:w-44 sm:shrink-0 ${
              vm.titleBlock.marketReadinessPalette === 'ready' ? 'border-[#9DC79D] bg-[#EEF7EF]' :
              vm.titleBlock.marketReadinessPalette === 'near' ? 'border-[#D9A441] bg-[#FFF6E8]' :
              vm.titleBlock.marketReadinessPalette === 'not_ready' ? 'border-[#C97A7A] bg-[#FDEEEE]' :
              'border-[#D9D0C3] bg-[#FAF7F2]'
            }`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5C5549]">Overall Score</p>
              <p className="mt-1 font-serif text-4xl font-bold leading-none text-[#1A1A1A]">
                {vm.titleBlock.overallScoreLabel}
              </p>
              {vm.titleBlock.overallScoreConfidenceLabel && (
                <p className="mt-1 text-[10px] text-[#5C5549]">{vm.titleBlock.overallScoreConfidenceLabel}</p>
              )}
              <div className="mt-3 border-t border-[#D9D0C3] pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5C5549]">Market Readiness</p>
                <p className="mt-1 text-sm font-bold uppercase text-[#1A1A1A]">
                  {vm.titleBlock.marketReadiness}
                </p>
                {vm.titleBlock.marketReadinessConfidenceLabel && (
                  <p className="mt-0.5 text-[10px] text-[#5C5549]">{vm.titleBlock.marketReadinessConfidenceLabel}</p>
                )}
              </div>
            </aside>
          </div>

          {/* ── Metadata grid (secondary — below the hero) ── */}
          <dl className="mt-6 grid grid-cols-2 auto-rows-fr overflow-hidden rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] text-sm sm:grid-cols-3 lg:grid-cols-4">
            <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3]"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Genre</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">{vm.titleBlock.genre}{vm.titleBlock.genreConfidenceLabel ? <span className="ml-1 text-xs font-normal text-[#5C5549]">({vm.titleBlock.genreConfidenceLabel})</span> : null}</dd></div>
            <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3] sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Target Audience</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">{vm.titleBlock.audienceTentative ? 'Tentative: ' : ''}{vm.titleBlock.targetAudience}{vm.titleBlock.audienceConfidenceLabel ? <span className="ml-1 text-xs font-normal text-[#5C5549]">({vm.titleBlock.audienceConfidenceLabel})</span> : null}</dd></div>
            {vm.titleBlock.shelf ? <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3]"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Shelf</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">{vm.titleBlock.shelf}{vm.titleBlock.shelfConfidenceLabel ? <span className="ml-1 text-xs font-normal text-[#5C5549]">({vm.titleBlock.shelfConfidenceLabel})</span> : null}</dd></div> : null}
            {vm.titleBlock.submittedWordCount !== 'Not available' ? <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3]"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Submitted Word Count</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">{vm.titleBlock.submittedWordCount}</dd></div> : null}
            {vm.titleBlock.estimatedPages !== 'Not available' ? <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3]"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Estimated Pages</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">{vm.titleBlock.estimatedPages}</dd></div> : null}
            {vm.titleBlock.readingGradeLevel !== 'Not available' ? <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3]"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Reading Grade Level</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">{vm.titleBlock.readingGradeLevel}</dd></div> : null}
            {vm.titleBlock.dialogueNarrativeRatio !== 'Not available' ? <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3]"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Dialogue/Narrative Ratio</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">{vm.titleBlock.dialogueNarrativeRatio}</dd></div> : null}
            {vm.titleBlock.genreExpectationSummary ? <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3] sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Genre Expectations</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">{vm.titleBlock.genreExpectationSummary}{vm.titleBlock.genreExpectationProfileLabels.length > 0 ? <><br /><span className="text-xs font-normal text-[#5C5549]">Reader emphasis: {vm.titleBlock.genreExpectationProfileLabels.join(', ')}</span></> : null}</dd></div> : null}
            <div className="bg-white p-3.5 ring-1 ring-[#D9D0C3]"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Confidentiality</dt><dd className="mt-1.5 font-semibold leading-relaxed text-[#1C1814]">Prepared for author/editorial use.</dd></div>
          </dl>
        </header>

        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 leading-relaxed print-hidden">
          <span className="font-medium text-gray-700">Your writing is private.</span>{' '}
          RevisionGrade support and admin staff will never access your work or evaluation data unless you explicitly grant temporary permission for troubleshooting.
        </div>

        {/* Published / calibration work context disclaimer — hidden in print/PDF */}
        {/\(TEST FILE\)|CALIBRATION|BENCHMARK|REFERENCE\s+EVAL|PUBLIC[- ]DOMAIN|TEST\s+RUN/i.test(displayTitle ?? '') && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-gray-700 leading-relaxed print-hidden">
            <span className="font-semibold text-blue-800">Published Work Context</span>{' '}
            This appears to be a published, classic, or reference work. RevisionGrade is evaluating the submitted text
            against its manuscript-readiness criteria, not against the work&apos;s historical importance, sales record,
            cultural influence, or existing reputation. A score below the current agent-readiness threshold does not
            mean the work &ldquo;failed.&rdquo; It means the text may not align with RevisionGrade&apos;s modern
            submission-readiness rubric without historical, market, or audience context.
          </div>
        )}

        {/* Evaluation integrity status (single source of truth) */}
        {integrityBanner && (
          <section className={integrityBanner.containerClassName}>
            <p className={integrityBanner.titleClassName}>{integrityBanner.title}</p>
            <p className={integrityBanner.detailClassName}>{integrityBanner.message}</p>
          </section>
        )}

        {/* ── One-Paragraph Pitch (template section 2) + One-Sentence Pitch (template section 3) ── */}
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-3 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">One-Paragraph Pitch</h2>
          <p className="leading-relaxed text-[#1C1814]">{vm.oneParagraphPitch}</p>
        </section>
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-3 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">One-Sentence Pitch</h2>
          <p className="font-medium leading-relaxed text-[#1C1814]">{vm.oneSentencePitch}</p>
        </section>

        {/* ── Premise (template section 4) + Content Warnings (template section 5) ── */}
        {vm.premise && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">Premise</h2>
            <p className="leading-relaxed text-[#1C1814]">{vm.premise}</p>
          </section>
        )}
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFF6E8] p-6 shadow-sm">
          <h2 className="mb-3 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">Content Warnings</h2>
          {vm.contentWarnings.length > 0 ? (
            <ul className="space-y-2 text-[#1C1814]">
              {vm.contentWarnings.map((warning, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <span className="shrink-0 mt-0.5 text-[#8B2E2E]">•</span>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#1C1814]">No content warnings identified.</p>
          )}
          <p className="mt-4 text-sm text-[#5C5549]">
            Consider including content warnings in book marketing or front matter.
          </p>
        </section>

        {/* ── Revision Opportunity Summary ── */}
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-4 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">Revision Opportunity Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="border border-[#D9D0C3] bg-white p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5C5549]">Total</p>
              <p className="mt-1 text-2xl font-bold text-[#1C1814]">{vm.revisionOpportunitySummary.total}</p>
            </div>
            <div className="border border-[#D9D0C3] bg-[#EEF7EF] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5C5549]">Recommended</p>
              <p className="mt-1 text-2xl font-bold text-[#1C1814]">{vm.revisionOpportunitySummary.recommended}</p>
            </div>
            <div className="border border-[#D9D0C3] bg-[#EEF3F8] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5C5549]">Optional</p>
              <p className="mt-1 text-2xl font-bold text-[#1C1814]">{vm.revisionOpportunitySummary.optional}</p>
            </div>
            <div className="border border-[#D9D0C3] bg-[#FFF6E8] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5C5549]">Consider</p>
              <p className="mt-1 text-2xl font-bold text-[#1C1814]">{vm.revisionOpportunitySummary.consider}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#5C5549]">Recommendation tiers indicate the suggested urgency of each revision opportunity.</p>
        </section>

        {/* ── Executive Summary (template section 7) + Top Strengths (8) + Top Risks (9) ── */}
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl font-bold text-[#8B2E2E]">Executive Summary</h2>
              <div className="flex items-center gap-4">
                <span className={`border px-4 py-2 text-sm font-semibold ${
                  vm.titleBlock.marketReadinessPalette === 'ready' ? 'border-[#D9D0C3] bg-[#EEF7EF] text-[#1C1814]' :
                  vm.titleBlock.marketReadinessPalette === 'near' ? 'border-[#D9D0C3] bg-[#FFF6E8] text-[#1C1814]' :
                  'border-[#D9D0C3] bg-[#F9E8E8] text-[#1C1814]'
                }`}>
                  {vm.titleBlock.marketReadiness.toUpperCase()}
                </span>
                <span className="font-serif text-3xl font-bold text-[#8B2E2E]">
                  {vm.titleBlock.overallScoreLabel}
                </span>
              </div>
            </div>
            <p className="mb-6 leading-relaxed text-[#1C1814]">
              {vm.executiveSummary}
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#1C1814]">
                  <span className="text-[#8B2E2E]">•</span>
                  Top Strengths
                </h3>
                <ul className="space-y-2">
                  {vm.topStrengths.map((strength, idx) => (
                    <li key={idx} className="border-l-2 border-[#8B2E2E] pl-4 text-[#1C1814]">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#1C1814]">
                  <span className="text-[#8B2E2E]">•</span>
                  Top Risks
                </h3>
                <ul className="space-y-2">
                  {vm.topRisks.map((risk, idx) => (
                    <li key={idx} className="border-l-2 border-[#C8A96E] pl-4 text-[#1C1814]">
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

        {/* ── Top Recommendations (template section 10) ── */}
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-4 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">Top Recommendations</h2>
          {vm.topRecommendations.length > 0 ? (
            <ol className="space-y-3 text-[#1C1814]">
              {vm.topRecommendations.map((recommendation, idx) => (
                <li key={idx} className="flex items-start gap-3 leading-relaxed">
                  <span className="shrink-0 font-semibold text-[#8B2E2E]">{idx + 1}.</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[#1C1814]">See per-criterion opportunities below for detailed revision guidance.</p>
          )}
        </section>

        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-6 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">
            13 Criteria Score Grid
          </h2>
          <div className="overflow-x-auto rounded-sm border border-[#D9D0C3] bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#D9D0C3] bg-[#F7F1E6] text-left text-xs uppercase tracking-wide text-[#5C5549]">
                  <th className="px-3 py-2 font-semibold">Criterion</th>
                  <th className="px-3 py-2 font-semibold text-right">Score</th>
                  <th className="px-3 py-2 font-semibold text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {vm.criteriaScoreGrid.map((row, idx) => (
                  <tr key={`${row.label}-${idx}`} className={`border-b border-[#E6DED2] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FFFDF9]'}`}>
                    <td className="px-3 py-2 text-[#1C1814] [overflow-wrap:anywhere]">{row.label}</td>
                    <td className="px-3 py-2 text-right font-semibold text-[#1C1814] whitespace-nowrap">{row.scoreLabel}</td>
                    <td className="px-3 py-2 text-right text-[#5C5549] whitespace-nowrap">{row.confidenceLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-6 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">
            Criterion Rationales &amp; Surfaced Opportunities
          </h2>
          <div className="space-y-4">
            {vm.criterionDetails.map((detail, idx) => (
              <article key={`${detail.label}-${idx}`} className="overflow-hidden rounded-sm border border-[#D9D0C3] bg-[#FFFCF7] shadow-[0_1px_0_rgba(28,24,20,0.04)]">
                <div className="rg-report-criterion-header flex items-center justify-between gap-4 border-b border-[#D9D0C3] bg-[#F7F1E6] px-4 py-3 [color-scheme:light]">
                  <h3 className="font-serif text-base font-bold leading-snug !text-[#8B2E2E]">{detail.label}</h3>
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    <span className="font-serif text-base font-bold !text-[#8B2E2E]">{detail.scoreLabel}</span>
                    <span className="border-l border-[#C8A96E]/60 pl-2 font-medium !text-[#5C5549]">{detail.confidenceLabel}</span>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  {detail.supportLabel ? (
                    <p className="text-xs font-medium !text-[#5C5549]">{detail.supportLabel}</p>
                  ) : null}
                  {detail.rationaleLabel ? (
                    <p className="text-xs font-semibold tracking-[0.06em] !text-[#8B2E2E]">{detail.rationaleLabel}</p>
                  ) : null}
                  <p className="text-sm leading-relaxed !text-[#1C1814]">{detail.rationaleText}</p>
                  {detail.recommendations.length > 0 ? (
                    <CriterionOpportunities
                      recommendations={detail.recommendations as Array<{
                        priority?: string;
                        anchor_snippet?: string;
                        anchor_type?: 'verbatim_quote' | 'paraphrased_observation' | 'editorial_diagnosis';
                        symptom?: string;
                        mechanism?: string;
                        specific_fix?: string;
                        reader_effect?: string;
                        mistake_proofing?: string;
                        collapsed_from_criteria?: string[];
                      }>}
                    />
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Action Items / Quick Wins / Strategic Revisions REMOVED:
           These are not contract-approved sections for short-form evaluation.
           The canonical revision inventory lives in Criterion Rationales & Surfaced
           Opportunities above. Renderers must not create duplicate recommendation
           inventories outside the ViewModel. */}

        {/* Loading state — shown while DREAM is generating */}
        {isLongForm && !lf && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 font-serif text-2xl font-bold text-[#8B2E2E]">
              Finalizing Your Report
              <span className="ml-2 inline-flex items-center border border-[#D9D0C3] bg-[#FFF6E8] px-2.5 py-0.5 text-xs font-semibold text-[#1C1814]">
                Part 2 generating…
              </span>
            </h2>
            <p className="mb-4 text-sm text-[#5C5549]">
              Part 1 of 2 ready—scroll up to review scores and revision plan while Part 2 generates below
            </p>
            <SynthesisPoller
              jobId={params.jobId}
              wordCount={wordCount}
              initialDreamDoc={null}
            />
          </section>
        )}

        {/* ── §12a Expanded Criterion Analysis ── */}
        {lf && lf.criterionAnalyses.length > 0 && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[#8B2E2E]">{webSectionTitle('expanded_criterion_analysis')}</h2>
            <div className="space-y-2">
              {lf.criterionAnalyses.map((analysis, idx) => (
                  <div key={idx} className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-sm text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                    {analysis.key ? <p><span className="font-medium">Criterion:</span> {analysis.key}</p> : null}
                    {analysis.scoreLabel ? <p><span className="font-medium">Score:</span> {analysis.scoreLabel}</p> : null}
                    {analysis.confidenceLabel ? <p><span className="font-medium">Confidence:</span> {analysis.confidenceLabel}</p> : null}
                    <div className="mt-2 space-y-2">
                      {analysis.fitEvidence.length > 0 ? (
                        <div>
                          <p className="font-medium text-[#1C1814]">What Is Working:</p>
                          {renderNoIndentOrderedList(analysis.fitEvidence)}
                        </div>
                      ) : null}
                      {analysis.gapEvidence.length > 0 ? (
                        <div>
                          <p className="font-medium text-[#1C1814]">What Weakens Impact:</p>
                          {renderNoIndentOrderedList(analysis.gapEvidence)}
                        </div>
                      ) : null}
                      {analysis.revisionQueue.length > 0 ? (
                        <div>
                          <p className="font-medium text-[#1C1814]">Revision Queue:</p>
                          {renderNoIndentOrderedList(analysis.revisionQueue.map((entry) => entry.displayText))}
                        </div>
                      ) : null}
                    </div>
                  </div>
              ))}
            </div>
          </section>
        )}

        {/* ── §13 Story Ledger or Layer-Aware Architecture Map ── */}
        {lf && (lf.structuralStack.length > 0 || lf.arcMap.length > 0 || lf.layerAnalyses.length > 0) && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[#8B2E2E]">{webSectionTitle('story_ledger')}</h2>
            {lf.structuralStack.length > 0 ? (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Structural Architecture</h3>
                <div className="space-y-2">
                  {lf.structuralStack.map((layer, idx) => (
                    <div key={idx} className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-sm text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                      {layer.layerName ? <p><span className="font-medium">Layer:</span> {layer.layerName}</p> : null}
                      {layer.function ? <p><span className="font-medium">Function:</span> {layer.function}</p> : null}
                      {layer.status ? <p><span className="font-medium">Status:</span> {layer.status}</p> : null}
                      {layer.revisionNote ? <p><span className="font-medium">Revision note:</span> {layer.revisionNote}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {lf.arcMap.length > 0 ? (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Arc Map</h3>
                <div className="space-y-2">
                  {lf.arcMap.map((arc, idx) => (
                    <div key={idx} className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-sm text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                      {arc.actName ? <p><span className="font-medium">Act:</span> {arc.actName}</p> : null}
                      {arc.chapterRange ? <p><span className="font-medium">Chapter range:</span> {arc.chapterRange}</p> : null}
                      {arc.primaryFunction ? <p><span className="font-medium">Primary function:</span> {arc.primaryFunction}</p> : null}
                      {arc.revisionPriority ? (
                        <p>
                          <span className="font-medium">Revision priority:</span>{' '}
                          {arc.revisionPriority}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {lf.layerAnalyses.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Layer Analysis</h3>
                <div className="space-y-2">
                  {lf.layerAnalyses.map((layer, idx) => (
                    <div key={idx} className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-sm text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                      <p><span className="font-medium">Layer:</span> {layer.layerName}</p>
                      <p><span className="font-medium">Status:</span> {layer.status}</p>
                      <p><span className="font-medium">Needed revision:</span> {layer.neededRevision}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* ── §14 Review Gate Readiness Surface ── */}
        {lf?.acceptanceChecks && (lf.acceptanceChecks.requiredDetection.length > 0 || lf.acceptanceChecks.failureConditions.length > 0) && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[#8B2E2E]">{webSectionTitle('review_gate')}</h2>
            {lf.acceptanceChecks.requiredDetection.length > 0 ? (
              <div className="mb-2">
                <h3 className="mb-1 text-sm font-semibold text-[#1C1814]">Required Detection</h3>
                <ul className="space-y-0.5 text-sm text-[#5C5549]">
                  {lf.acceptanceChecks.requiredDetection.map((item, idx) => <li key={idx}>• {item}</li>)}
                </ul>
              </div>
            ) : null}
            {lf.acceptanceChecks.failureConditions.length > 0 ? (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-[#1C1814]">Failure Conditions</h3>
                <ul className="space-y-0.5 text-sm text-[#5C5549]">
                  {lf.acceptanceChecks.failureConditions.map((item, idx) => <li key={idx}>• {item}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        )}

        {/* ── §15 Governed Ledgers or Compact Governed-Ledger Addenda ── */}
        {lf?.symbolicAudit && (lf.symbolicAudit.preservedSymbols.length > 0 || lf.symbolicAudit.doctrineStrengths.length > 0 || lf.symbolicAudit.doctrineRisks.length > 0 || lf.symbolicAudit.auditConclusion) && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[#8B2E2E]">{webSectionTitle('governed_ledgers')}</h2>
            <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Symbolic &amp; Doctrine Audit</h3>
            {lf.symbolicAudit.preservedSymbols.length > 0 ? (
              <div className="space-y-2 mb-2">
                {lf.symbolicAudit.preservedSymbols.map((symbol, idx) => (
                  <div key={idx} className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-sm text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                    {symbol.symbol ? <p><span className="font-medium">Symbol:</span> {symbol.symbol}</p> : null}
                    {symbol.currentFunction ? <p><span className="font-medium">Current function:</span> {symbol.currentFunction}</p> : null}
                    {symbol.revisionInstruction ? <p><span className="font-medium">Revision instruction:</span> {symbol.revisionInstruction}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {lf.symbolicAudit.doctrineStrengths.length > 0 ? <p className="text-sm text-[#5C5549]"><span className="font-medium">Doctrine strengths:</span> {lf.symbolicAudit.doctrineStrengths.join('; ')}</p> : null}
            {lf.symbolicAudit.doctrineRisks.length > 0 ? <p className="text-sm text-[#5C5549]"><span className="font-medium">Doctrine risks:</span> {lf.symbolicAudit.doctrineRisks.join('; ')}</p> : null}
            {lf.symbolicAudit.auditConclusion ? <p className="text-sm text-[#5C5549]"><span className="font-medium">Audit conclusion:</span> {lf.symbolicAudit.auditConclusion}</p> : null}
          </section>
        )}

        {/* ── §16 Cross-Layer Synthesis ── */}
        {lf && (
          lf.scores.quality !== null || lf.scores.readiness !== null || lf.scores.commercial !== null || lf.scores.literary !== null ||
          lf.executiveVerdict ||
          lf.crossLayerIntegration.length > 0 ||
          lf.readerExperience
        ) && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[#8B2E2E]">{webSectionTitle('cross_layer_synthesis')}</h2>
            <div className="space-y-6">
              {(lf.scores.quality !== null || lf.scores.readiness !== null || lf.scores.commercial !== null || lf.scores.literary !== null) && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {(['quality', 'readiness', 'commercial', 'literary'] as const).map((dim) => {
                    const value = lf.scores[dim];
                    if (value === null) return null;
                    return (
                      <div key={dim} className="border border-[#D9D0C3] bg-white p-3 text-center">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#5C5549]">{dim}</p>
                        <p className="font-serif text-2xl font-bold text-[#8B2E2E]">{value}</p>
                        <p className="text-xs text-[#5C5549]">/100</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {lf.executiveVerdict && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Executive Verdict</h3>
                  <div className="space-y-3">
                    {splitIntoParagraphs(lf.executiveVerdict).map((para, idx) => (
                      <p key={idx} className="leading-relaxed text-[#1C1814]">{para}</p>
                    ))}
                  </div>
                </div>
              )}

              {lf.crossLayerIntegration.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Cross-Layer Integration</h3>
                  <div className="space-y-2">
                    {lf.crossLayerIntegration.map((row, idx) => (
                      <div key={idx} className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-sm text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                        <p><span className="font-medium">Motif:</span> {row.motif}</p>
                        <p><span className="font-medium">Description:</span> {row.description}</p>
                        <p><span className="font-medium">Integration quality:</span> {row.integrationQuality}</p>
                        <p><span className="font-medium">Revision note:</span> {row.revisionNote}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lf.readerExperience && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Reader Experience</h3>
                  <div className="grid gap-3 text-sm md:grid-cols-3">
                    {lf.readerExperience.firstAct && (lf.readerExperience.firstAct.readerQuestion || lf.readerExperience.firstAct.emotionalState || lf.readerExperience.firstAct.risk) ? (
                      <div className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                        <p className="mb-1 font-medium text-[#1C1814]">First Act</p>
                        {lf.readerExperience.firstAct.readerQuestion ? <p>Reader question: {lf.readerExperience.firstAct.readerQuestion}</p> : null}
                        {lf.readerExperience.firstAct.emotionalState ? <p>Emotional state: {lf.readerExperience.firstAct.emotionalState}</p> : null}
                        {lf.readerExperience.firstAct.risk ? <p>Risk: {lf.readerExperience.firstAct.risk}</p> : null}
                      </div>
                    ) : null}
                    {lf.readerExperience.middle && (lf.readerExperience.middle.readerQuestion || lf.readerExperience.middle.emotionalState || lf.readerExperience.middle.risk) ? (
                      <div className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                        <p className="mb-1 font-medium text-[#1C1814]">Middle</p>
                        {lf.readerExperience.middle.readerQuestion ? <p>Reader question: {lf.readerExperience.middle.readerQuestion}</p> : null}
                        {lf.readerExperience.middle.emotionalState ? <p>Emotional state: {lf.readerExperience.middle.emotionalState}</p> : null}
                        {lf.readerExperience.middle.risk ? <p>Risk: {lf.readerExperience.middle.risk}</p> : null}
                      </div>
                    ) : null}
                    {lf.readerExperience.finalAct && (lf.readerExperience.finalAct.readerQuestion || lf.readerExperience.finalAct.emotionalState || lf.readerExperience.finalAct.risk) ? (
                      <div className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                        <p className="mb-1 font-medium text-[#1C1814]">Final Act</p>
                        {lf.readerExperience.finalAct.readerQuestion ? <p>Reader question: {lf.readerExperience.finalAct.readerQuestion}</p> : null}
                        {lf.readerExperience.finalAct.emotionalState ? <p>Emotional state: {lf.readerExperience.finalAct.emotionalState}</p> : null}
                        {lf.readerExperience.finalAct.risk ? <p>Risk: {lf.readerExperience.finalAct.risk}</p> : null}
                      </div>
                    ) : null}
                  </div>
                  {lf.readerExperience.aftertaste ? <p className="mt-2 text-sm text-[#5C5549]"><span className="font-medium">Aftertaste:</span> {lf.readerExperience.aftertaste}</p> : null}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── §17 Layer-Aware Revision Sequencing ── */}
        {lf && lf.revisionPlan.length > 0 && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[#8B2E2E]">{webSectionTitle('revision_sequencing')}</h2>
            <div className="space-y-2">
              {lf.revisionPlan.map((planItem, idx) => (
                <div key={idx} className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-sm text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                  <p><span className="font-medium">Priority:</span> {planItem.displayPriority}</p>
                  {planItem.title ? <p><span className="font-medium">Title:</span> {planItem.title}</p> : null}
                  {planItem.goal ? <p><span className="font-medium">Goal:</span> {planItem.goal}</p> : null}
                  {planItem.actions.length > 0 ? (
                    <div>
                      <p><span className="font-medium">Actions:</span></p>
                      <div className="mt-1">{renderNoIndentOrderedList(planItem.actions)}</div>
                    </div>
                  ) : null}
                  {planItem.acceptanceCheck ? <p><span className="font-medium">Acceptance check:</span> {planItem.acceptanceCheck}</p> : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── §18 Long-Form Continuity and Coverage Proof ── */}
        {lf && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[#8B2E2E]">{webSectionTitle('continuity_coverage')}</h2>
            {(() => {
              const continuityItems: string[] = [];
              lf.arcMap.forEach((act) => {
                if (act.primaryFunction) continuityItems.push(`${act.actName}: ${act.primaryFunction}`);
              });
              lf.layerAnalyses.forEach((layer) => {
                if (layer.neededRevision) continuityItems.push(`${layer.layerName}: ${layer.neededRevision}`);
              });
              lf.crossLayerIntegration.forEach((item) => {
                if (item.revisionNote) continuityItems.push(`${item.motif}: ${item.revisionNote}`);
              });
              return continuityItems.length > 0 ? (
                <ul className="space-y-1 text-sm text-[#5C5549]">
                  {continuityItems.map((item, idx) => <li key={idx}>• {item}</li>)}
                </ul>
              ) : (
                <p className="text-sm italic text-[#5C5549]">
                  Continuity coverage proof is provisionally grounded in the current canonical evaluation surfaces. Certify only evidence-backed findings present in canonical output.
                </p>
              );
            })()}
          </section>
        )}

        {/* ── §19 Readiness / Releasability Posture ── */}
        {lf && (lf.releasability.length > 0 || lf.marketShelf.bestShelf || lf.marketShelf.marketableHook || lf.marketShelf.marketDanger || lf.marketShelf.shelfNeighbors.length > 0 || lf.marketShelf.comparisonSpace.length > 0 || lf.whatNotToBecome.length > 0) && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 font-serif text-2xl font-bold text-[#8B2E2E]">{webSectionTitle('readiness_posture')}</h2>
            {lf.releasability.length > 0 ? (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Releasability Assessment</h3>
                <div className="space-y-2">
                  {lf.releasability.map((row, idx) => (
                    <div key={idx} className="rounded-sm border border-[#D9D0C3] bg-white p-3 text-sm text-[#1C1814] shadow-[0_1px_0_rgba(28,24,20,0.03)]">
                      {row.dimension ? <p><span className="font-medium">Dimension:</span> {row.dimension}</p> : null}
                      {row.currentStatus ? <p><span className="font-medium">Current status:</span> {row.currentStatus}</p> : null}
                      {row.verdict ? <p><span className="font-medium">Verdict:</span> {row.verdict}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {(lf.marketShelf.bestShelf || lf.marketShelf.marketableHook || lf.marketShelf.marketDanger || lf.marketShelf.shelfNeighbors.length > 0 || lf.marketShelf.comparisonSpace.length > 0 || lf.whatNotToBecome.length > 0) ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#1C1814]">Market Shelf</h3>
                {lf.marketShelf.bestShelf ? (
                  <p className="mb-1 text-sm text-[#5C5549]"><span className="font-medium">Best shelf:</span> {lf.marketShelf.bestShelf}</p>
                ) : null}
                {lf.marketShelf.marketableHook ? (
                  <p className="mb-1 text-sm text-[#5C5549]"><span className="font-medium">Marketable hook:</span> {lf.marketShelf.marketableHook}</p>
                ) : null}
                {lf.marketShelf.marketDanger ? (
                  <p className="text-sm text-[#8B2E2E]"><span className="font-medium">Market danger:</span> {lf.marketShelf.marketDanger}</p>
                ) : null}
                {lf.marketShelf.shelfNeighbors.length > 0 ? (
                  <div className="mt-3">
                    <h4 className="mb-1 text-sm font-semibold text-[#1C1814]">Shelf Neighbors</h4>
                    <ul className="space-y-0.5 text-sm text-[#5C5549]">
                      {lf.marketShelf.shelfNeighbors.map((title, idx) => (
                        <li key={idx}>• {title}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {lf.marketShelf.comparisonSpace.length > 0 ? (
                  <div className="mt-3">
                    <h4 className="mb-1 text-sm font-semibold text-[#1C1814]">Comparison Space</h4>
                    <ul className="space-y-0.5 text-sm text-[#5C5549]">
                      {lf.marketShelf.comparisonSpace.map((comp, idx) => (
                        <li key={idx}>• {comp}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {lf.whatNotToBecome.length > 0 ? (
                  <div className="mt-3">
                    <h4 className="mb-1 text-sm font-semibold text-[#1C1814]">What Not to Become</h4>
                    <ul className="space-y-0.5 text-sm text-[#5C5549]">
                      {lf.whatNotToBecome.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        )}

        {/* ── Internal-only Long-Form Multi-Layer diagnostics (support staff only) ── */}
        {lf && showTechnicalSections && (
          <section className="mb-6 rounded-sm border border-amber-200 bg-amber-50/30 p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-gray-900 flex items-center gap-2">
              Long-Form Multi-Layer Diagnostics
              <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Support view</span>
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Layer Analyses <span className="text-xs text-amber-700">(internal)</span></h3>
                {lf.layerAnalyses.length > 0 ? (
                  <div className="space-y-2">
                    {lf.layerAnalyses.map((layer, idx) => (
                      <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                        <p><span className="font-medium">Layer:</span> {layer.layerName}</p>
                        <p><span className="font-medium">Status:</span> {layer.status}</p>
                        <p><span className="font-medium">Needed revision:</span> {layer.neededRevision}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700">—</p>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceptance Checks <span className="text-xs text-amber-700">(internal)</span></h3>
                <p className="text-sm text-gray-700"><span className="font-medium">Required detection:</span> {lf.acceptanceChecks?.requiredDetection.join("; ") || "—"}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Failure conditions:</span> {lf.acceptanceChecks?.failureConditions.join("; ") || "—"}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Calibration Notes <span className="text-xs text-amber-700">(internal)</span></h3>
                {lf.calibrationNotes.length > 0 ? (
                  <ul className="space-y-1">
                    {lf.calibrationNotes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700"><span className="mt-0.5 shrink-0 text-amber-700">•</span><span>{note}</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-700">—</p>
                )}
              </div>
              {lf.repoSummary && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Repository Summary <span className="text-xs text-amber-700">(internal)</span></h3>
                <div className="rounded border border-gray-200 p-3 text-sm space-y-1">
                  <p><span className="font-medium">Benchmark:</span> {lf.repoSummary.benchmarkName}</p>
                  <p><span className="font-medium">Source:</span> {lf.repoSummary.source}</p>
                  <p><span className="font-medium">Evaluation type:</span> {lf.repoSummary.evaluationType}</p>
                  <p><span className="font-medium">Overall score:</span> {lf.repoSummary.overallScore}</p>
                  <p><span className="font-medium">Readiness score:</span> {lf.repoSummary.readinessScore}</p>
                  <p><span className="font-medium">Primary strengths:</span> {lf.repoSummary.primaryStrengths.join("; ") || "—"}</p>
                  <p><span className="font-medium">Primary blockers:</span> {lf.repoSummary.primaryBlockers.join("; ") || "—"}</p>
                  <p><span className="font-medium">Gold standard requirement:</span> {lf.repoSummary.goldStandardRequirement}</p>
                </div>
              </div>
              )}
            </div>
          </section>
        )}

        {/* Character System — Peer Section */}
        {lf && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-violet-100">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <span aria-hidden>&#x1F9EC;</span> Character System
            </h2>
            <p className="text-sm text-gray-700 mb-6">
              Character arc coverage, relationship spine, and symbol payoff — evidence-based character ledgers
            </p>
            <div className="space-y-8">
              {/* Ledger A — Character Coverage & Arc */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger A — Character Coverage &amp; Arc</h3>
                <p className="text-xs text-gray-700 mb-3">Character system coverage — roles, arc movement, ending accountability</p>
                <LongformCharacterCoverageArcLedger vm={lf} showInternalSections={showTechnicalSections} />
              </div>
              {/* Ledger B — Relationship Spine */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger B — Relationship Spine</h3>
                <p className="text-xs text-gray-700 mb-3">Load-bearing relationships, bridge mechanisms &amp; trust transfer</p>
                <LongformRelationshipSpineLedger vm={lf} showInternalSections={showTechnicalSections} />
              </div>
              {/* Ledger C — Symbol-to-Character Payoff */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger C — Symbol-to-Character Payoff</h3>
                <p className="text-xs text-gray-700 mb-3">Symbol lifecycle — first appearance, transfer, payoff</p>
                <LongformSymbolPayoffLedger vm={lf} />
              </div>
            </div>
          </section>
        )}

        {/* Craft Evidence — Peer Section */}
        {lf && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-teal-100">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <span aria-hidden>&#x1F4DD;</span> Craft Evidence
            </h2>
            <p className="text-sm text-gray-700 mb-6">
              Sensory &amp; emotional register, manuscript integrity, and evidence distribution — craft-level ledgers
            </p>
            <div className="space-y-8">
              {/* Ledger D — Sensory / Emotional Register */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger D — Sensory &amp; Emotional Register</h3>
                <p className="text-xs text-gray-700 mb-3">Sensory systems, emotional arc, register governance</p>
                <LongformSensoryEmotionalRegister vm={lf} />
              </div>
              {/* Ledger E — Manuscript Integrity Confidence Table */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger E — Manuscript Integrity Table</h3>
                <p className="text-xs text-gray-700 mb-3">Document hygiene vs. story craft — classified integrity findings</p>
                <LongformManuscriptIntegrityTable vm={lf} />
              </div>
              {/* Ledger F — Evidence Distribution / Confidence Gate */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger F — Evidence Distribution &amp; Confidence Gate</h3>
                <p className="text-xs text-gray-700 mb-3">Confidence per criterion, distribution gaps, coverage failures</p>
                <LongformEvidenceDistributionGate vm={lf} showInternalSections={showTechnicalSections} />
              </div>
            </div>
          </section>
        )}

        {/* WAVE Governance, Canon Governance, Generated Artifacts — REMOVED from
            user-facing reports page entirely. These are internal pipeline diagnostics
            that must never appear in any user's browser/print view. Access governance
            data via the admin pipeline-health dashboard or direct DB queries only. */}

        {/* ── Confidence Explanation (template section 13) ── */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Confidence Explanation</h2>
          <p className="text-gray-700 whitespace-pre-line">{vm.confidenceExplanation}</p>
        </section>

        {/* ── Author-Facing Disclaimer ── */}
        <section className="border border-gray-200 rounded-lg p-5 mb-6 bg-gray-50">
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Author-Facing Disclaimer</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            {vm.disclaimer}
          </p>
          <p className="mt-3 text-xs text-gray-400 leading-relaxed">
            Generated by RevisionGrade™. Author retains ownership of manuscript content. This report is an editorial diagnostic and does not guarantee publication, representation, or commercial outcome.
          </p>
        </section>

        {/* Technical sections — only visible to admin/support with active author grant */}
        {showTechnicalSections && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-amber-200 bg-amber-50/30">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              Evaluation Metadata
              <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Support view</span>
            </h2>
            {vm.supportMetadata && (
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Model</p>
                  <p className="font-mono text-gray-900">{vm.supportMetadata.model}</p>
                </div>
                <div>
                  <p className="text-gray-600">Confidence</p>
                  <p className="font-mono text-gray-900">{vm.supportMetadata.confidenceLabel}</p>
                </div>
                <div>
                  <p className="text-gray-600">Job ID</p>
                  <p className="font-mono text-gray-900">{params.jobId}</p>
                </div>
                <div>
                  <p className="text-gray-600">Word Count</p>
                  <p className="font-mono text-gray-900">{vm.supportMetadata.wordCount}</p>
                </div>
                {vm.supportMetadata.processingTime && (
                  <div>
                    <p className="text-gray-600">Processing Time</p>
                    <p className="font-mono text-gray-900">{vm.supportMetadata.processingTime}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <div className="mt-6 space-y-4 print-hidden">
          <SupportAccessToggle jobId={params.jobId} />
          <div className="flex justify-end">
            <DownloadReportButton jobId={params.jobId} />
          </div>
        </div>
      </div>
    </div>
  );
}
