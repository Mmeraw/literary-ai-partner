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
import { classifyEvaluationIntegrityBanner } from '@/lib/evaluation/warningClassification';
import {
  getCertifiedCriteriaSummary,
  getCriterionPrimaryBadge,
  getCriterionRationalePresentation,
  getCriterionSupportLabel,
} from '@/lib/evaluation/reportCriterionDisplay';
import {
  buildUnifiedEvaluationDocument,
  type CanonicalEvaluationMode,
  type UnifiedEvaluationDocument,
} from '@/lib/evaluation/unifiedEvaluationDocument';
import { isGenreExpectationMetadata } from '@/lib/evaluation/genreExpectationProfiles';
import {
  getDisplayDreamList,
  getDisplayDreamMarketField,
  getDisplayDreamMarketList,
  getDisplayObjectArray,
  getDisplayRecord,
  getDisplayDreamScore,
  getDisplayText,
  filterAuthorFacingTextList,
  getRenumberedAuthorFacingRevisionPlan,
  safeTruncateToWordBoundary,
  mistakeProofText,
  getCriterionDisplayLabel,
  splitIntoParagraphs,
  correctScopeLanguage,
} from '@/lib/evaluation/reportRenderSafety';
import { resolveReportTitle } from '@/lib/evaluation/reportTitle';
import { hasActiveSupportGrant, logSupportView } from '@/lib/support/checkSupportAccess';
import type { LongformDreamDocument } from '@/lib/evaluation/pipeline/runPass3bLongform';
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

function getConfidenceBadge(criterion: EvaluationResultV1["criteria"][number]): {
  label: string;
  classes: string;
} | null {
  if (criterion.confidence_level === "high" || (typeof criterion.confidence_score_0_100 === "number" && criterion.confidence_score_0_100 >= 80)) {
    return { label: "High Confidence", classes: "bg-emerald-200 text-emerald-900 ring-1 ring-emerald-400" };
  }

  if (criterion.confidence_level === "moderate" || (typeof criterion.confidence_score_0_100 === "number" && criterion.confidence_score_0_100 >= 60)) {
    return { label: "Moderate Confidence", classes: "bg-yellow-200 text-yellow-900 ring-1 ring-yellow-400" };
  }

  if (criterion.confidence_level === "low" || (typeof criterion.confidence_score_0_100 === "number" && criterion.confidence_score_0_100 >= 0)) {
    return { label: "Low Confidence", classes: "bg-rose-200 text-rose-900 ring-1 ring-rose-400" };
  }

  return null;
}

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
async function getDreamArtifact(jobId: string): Promise<LongformDreamDocument | null> {
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

  return content.longform_document as LongformDreamDocument;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeCanonicalMode(raw: unknown, wordCount: number | null): CanonicalEvaluationMode {
  if (raw === 'short_form_evaluation' || raw === 'long_form_evaluation' || raw === 'long_form_multi_layer_evaluation') {
    return raw;
  }
  if (typeof wordCount === 'number' && wordCount >= 25000) return 'long_form_evaluation';
  return 'short_form_evaluation';
}

async function loadCanonicalEvaluationMode(
  jobId: string,
  rawResult: unknown,
  progress: unknown,
  wordCount: number | null,
): Promise<CanonicalEvaluationMode> {
  const resultRecord = asRecord(rawResult);
  const metadataRecord = asRecord(resultRecord?.metadata);
  const progressRecord = asRecord(progress);

  const direct = normalizeCanonicalMode(resultRecord?.evaluation_mode, null);
  if (direct !== 'short_form_evaluation' || resultRecord?.evaluation_mode === 'short_form_evaluation') return direct;

  const metadataMode = normalizeCanonicalMode(metadataRecord?.evaluation_mode, null);
  if (metadataMode !== 'short_form_evaluation' || metadataRecord?.evaluation_mode === 'short_form_evaluation') return metadataMode;

  const progressMode = normalizeCanonicalMode(progressRecord?.evaluation_mode, null);
  if (progressMode !== 'short_form_evaluation' || progressRecord?.evaluation_mode === 'short_form_evaluation') return progressMode;

  const admin = createAdminClient();
  const { data: seed } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'evaluation_seed_v1')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const seedContent = asRecord((seed as { content?: unknown } | null)?.content);
  return normalizeCanonicalMode(seedContent?.scope_mode, wordCount);
}

type WebpageEnrichmentData = EvaluationResultV2['enrichment'] | null;

function buildWebpageUnifiedDocument(input: {
  mode: CanonicalEvaluationMode;
  result: EvaluationResultV1 | EvaluationResultV2;
  displayTitle: string;
  enrichment: WebpageEnrichmentData;
  dream: LongformDreamDocument | null;
}): UnifiedEvaluationDocument {
  const genreExpectationContext = (input.result as {
    governance?: { transparency?: { genre_expectation_context?: unknown } };
  }).governance?.transparency?.genre_expectation_context;

  return buildUnifiedEvaluationDocument({
    mode: input.mode,
    result: {
      generated_at: typeof input.result.generated_at === 'string' ? input.result.generated_at : undefined,
      overview: {
        overall_score_0_100: input.result.overview?.overall_score_0_100,
        verdict: input.result.overview?.verdict,
        one_paragraph_summary: input.result.overview?.one_paragraph_summary,
        top_3_strengths: input.result.overview?.top_3_strengths,
        top_3_risks: input.result.overview?.top_3_risks,
      },
      metrics: {
        manuscript: {
          title: input.displayTitle,
          word_count: input.result.metrics?.manuscript?.word_count,
          genre: input.enrichment?.diagnosed_genre ?? input.result.metrics?.manuscript?.genre,
          target_audience: input.enrichment?.target_audience ?? input.result.metrics?.manuscript?.target_audience,
        },
      },
      enrichment: {
        premise: input.enrichment?.premise,
        trigger_warnings: input.enrichment?.trigger_warnings,
        reading_grade_level: input.enrichment?.reading_grade_level,
        dialogue_percentage: input.enrichment?.dialogue_percentage,
        narrative_percentage: input.enrichment?.narrative_percentage,
      },
      governance: isGenreExpectationMetadata(genreExpectationContext)
        ? { transparency: { genre_expectation_context: genreExpectationContext } }
        : undefined,
      criteria: input.result.criteria,
      recommendations: input.result.recommendations,
    },
    displayTitle: input.displayTitle,
    dream: input.dream,
  });
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
  const enrichment = isEvaluationResultV2(resultRaw) ? (resultRaw as EvaluationResultV2).enrichment ?? null : null;
  const evaluationMode = await loadCanonicalEvaluationMode(
    params.jobId,
    resultRaw,
    progress,
    typeof wordCount === 'number' && wordCount > 0 ? wordCount : null,
  );
  const canonicalDoc = buildWebpageUnifiedDocument({
    mode: evaluationMode,
    result: resultRaw,
    displayTitle,
    enrichment,
    dream: dreamDoc,
  });
  // Canon governance data intentionally NOT fetched — internal-only, never rendered.
  const dreamExecutiveVerdict = getDisplayText(dreamDoc?.executive_verdict, "No executive verdict available.");
  const dreamBestShelf = getDisplayDreamMarketField(dreamDoc, "best_shelf");
  const dreamMarketableHook = getDisplayDreamMarketField(dreamDoc, "marketable_hook");
  const dreamMarketDanger = getDisplayDreamMarketField(dreamDoc, "market_danger");
  const dreamShelfNeighbors = getDisplayDreamMarketList(dreamDoc, "shelf_neighbors");
  const dreamComparisonSpace = getDisplayDreamMarketList(dreamDoc, "comparison_space");
  const dreamAntiPatterns = getDisplayDreamList(dreamDoc?.what_not_to_become);
  const dreamStructuralStack = getDisplayObjectArray(dreamDoc?.structural_stack);
  const dreamArcMap = getDisplayObjectArray(dreamDoc?.arc_map);
  const dreamCriterionAnalyses = getDisplayObjectArray(dreamDoc?.criterion_analyses);
  const dreamLayerAnalyses = getDisplayObjectArray(dreamDoc?.layer_analyses);
  const dreamCrossLayerIntegration = getDisplayObjectArray(dreamDoc?.cross_layer_integration);
  const dreamSymbolicAudit = getDisplayRecord(dreamDoc?.symbolic_audit);
  const dreamPreservedSymbols = getDisplayObjectArray(dreamSymbolicAudit?.preserved_symbols);
  const dreamDoctrineStrengths = getDisplayDreamList(dreamSymbolicAudit?.doctrine_strengths);
  const dreamDoctrineRisks = getDisplayDreamList(dreamSymbolicAudit?.doctrine_risks);
  const dreamReaderExperience = getDisplayRecord(dreamDoc?.reader_experience);
  const dreamReaderFirstAct = getDisplayRecord(dreamReaderExperience?.first_act);
  const dreamReaderMiddle = getDisplayRecord(dreamReaderExperience?.middle);
  const dreamReaderFinalAct = getDisplayRecord(dreamReaderExperience?.final_act);
  const dreamRevisionPlan = getRenumberedAuthorFacingRevisionPlan(dreamDoc?.revision_plan);
  const dreamReleasability = getDisplayObjectArray(dreamDoc?.releasability);
  const dreamAcceptanceChecks = getDisplayRecord(dreamDoc?.acceptance_checks);
  const dreamRequiredDetections = getDisplayDreamList(dreamAcceptanceChecks?.required_detection);
  const dreamFailureConditions = getDisplayDreamList(dreamAcceptanceChecks?.failure_conditions);
  const dreamCalibrationNotes = getDisplayDreamList(dreamDoc?.calibration_notes);
  const dreamRepoSummary = getDisplayRecord(dreamDoc?.repo_summary);
  const dreamIntegrityIssues = getDisplayObjectArray(dreamDoc?.manuscript_integrity_issues);

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
  const integrityBanner = classifyEvaluationIntegrityBanner({ governance });

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
    <div className="min-h-screen bg-[#F6F1EA]">
      {printMode && <AutoPrintOnLoad enabled />}
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-8">
        {/* Header + Title Block (template section 1) */}
        <header className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] px-6 py-7 shadow-sm sm:px-8">

          {/* ── Top row: branding + action buttons ── */}
          <div className="flex items-center justify-between gap-4 mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B2E2E]">RevisionGrade™ — Editorial Readiness Assessment</p>
            <div className="shrink-0 flex items-center gap-3 print-hidden">
              {manuscriptId && (
                <div className="flex flex-col items-center gap-0.5">
                  <Link
                    href={`/workbench?manuscriptId=${manuscriptId}&evaluationJobId=${params.jobId}`}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-[#8B2E2E] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#6F1D1B]"
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
          <div className="flex items-start gap-6">
            {/* Title column */}
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-3xl font-bold leading-tight text-[#1C1814] sm:text-4xl">{displayTitle}</h1>
              <p className="mt-2 text-sm font-medium uppercase tracking-[0.08em] text-[#5C5549]">{canonicalDoc.titleBlock.reportType}</p>
              {chapterTitle && manuscriptTitle && chapterTitle !== manuscriptTitle && (
                <p className="mt-1 text-sm text-[#5C5549]">{manuscriptTitle}</p>
              )}
              <p className="mt-3 text-xs text-[#9A9087]">
                Generated {canonicalDoc.titleBlock.dateGenerated}
                {' · '}
                <span className="font-mono">{params.jobId.slice(0, 8)}</span>
                <CopyReferenceIdButton
                  value={params.jobId}
                  className="ml-1.5 inline-flex items-center rounded-sm border border-[#D9D0C3] px-2 py-0.5 text-xs font-medium text-[#5C5549] transition hover:bg-[#FAF7F2]"
                />
              </p>
            </div>

            {/* Score card — always visible without scrolling */}
            <aside className="shrink-0 w-44 rounded-sm border-2 border-[#B8922A] bg-[#1C1814] px-4 py-4 text-center text-[#F5EFE0]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">Overall Score</p>
              <p className="mt-1 font-serif text-4xl font-bold leading-none text-white">
                {canonicalDoc.titleBlock.overallScoreLabel}
              </p>
              {canonicalDoc.titleBlock.overallScoreConfidenceLabel && (
                <p className="mt-1 text-[10px] text-[#C8A96E]">{canonicalDoc.titleBlock.overallScoreConfidenceLabel}</p>
              )}
              <div className="mt-3 border-t border-[#B8922A] pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">Market Readiness</p>
                <p className="mt-1 text-sm font-bold uppercase text-[#F5E9C8]">
                  {canonicalDoc.titleBlock.marketReadiness}
                </p>
                {canonicalDoc.titleBlock.marketReadinessConfidenceLabel && (
                  <p className="mt-0.5 text-[10px] text-[#C8A96E]">{canonicalDoc.titleBlock.marketReadinessConfidenceLabel}</p>
                )}
              </div>
            </aside>
          </div>

          {/* ── Metadata grid (secondary — below the hero) ── */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-[#D9D0C3] bg-[#D9D0C3] text-sm sm:grid-cols-3 lg:grid-cols-4">
            <div className="bg-white p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Genre</dt><dd className="mt-1 font-semibold text-[#1C1814]">{canonicalDoc.titleBlock.genre}{canonicalDoc.titleBlock.genreConfidenceLabel ? <span className="ml-1 text-xs font-normal text-[#5C5549]">({canonicalDoc.titleBlock.genreConfidenceLabel})</span> : null}</dd></div>
            <div className="bg-white p-3 sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Target Audience</dt><dd className="mt-1 font-semibold leading-relaxed text-[#1C1814]">{canonicalDoc.titleBlock.audienceTentative ? 'Tentative: ' : ''}{canonicalDoc.titleBlock.targetAudience}{canonicalDoc.titleBlock.audienceConfidenceLabel ? <span className="ml-1 text-xs font-normal text-[#5C5549]">({canonicalDoc.titleBlock.audienceConfidenceLabel})</span> : null}</dd></div>
            {canonicalDoc.titleBlock.shelf ? <div className="bg-white p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Shelf</dt><dd className="mt-1 font-semibold text-[#1C1814]">{canonicalDoc.titleBlock.shelf}{canonicalDoc.titleBlock.shelfConfidenceLabel ? <span className="ml-1 text-xs font-normal text-[#5C5549]">({canonicalDoc.titleBlock.shelfConfidenceLabel})</span> : null}</dd></div> : null}
            {canonicalDoc.titleBlock.submittedWordCount !== 'Not available' ? <div className="bg-white p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Submitted Word Count</dt><dd className="mt-1 font-semibold text-[#1C1814]">{canonicalDoc.titleBlock.submittedWordCount}</dd></div> : null}
            {canonicalDoc.titleBlock.estimatedPages !== 'Not available' ? <div className="bg-white p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Estimated Pages</dt><dd className="mt-1 font-semibold text-[#1C1814]">{canonicalDoc.titleBlock.estimatedPages}</dd></div> : null}
            {canonicalDoc.titleBlock.readingGradeLevel !== 'Not available' ? <div className="bg-white p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Reading Grade Level</dt><dd className="mt-1 font-semibold text-[#1C1814]">{canonicalDoc.titleBlock.readingGradeLevel}</dd></div> : null}
            {canonicalDoc.titleBlock.dialogueNarrativeRatio !== 'Not available' ? <div className="bg-white p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#5C5549]">Dialogue/Narrative Ratio</dt><dd className="mt-1 font-semibold text-[#1C1814]">{canonicalDoc.titleBlock.dialogueNarrativeRatio}</dd></div> : null}
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
          <p className="leading-relaxed text-[#1C1814]">{canonicalDoc.oneParagraphPitch}</p>
        </section>
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-3 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">One-Sentence Pitch</h2>
          <p className="font-medium leading-relaxed text-[#1C1814]">{canonicalDoc.oneSentencePitch}</p>
        </section>

        {/* ── Premise (template section 4) + Content Warnings (template section 5) ── */}
        {canonicalDoc.premise && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-3 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">Premise</h2>
            <p className="leading-relaxed text-[#1C1814]">{canonicalDoc.premise}</p>
          </section>
        )}
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFF6E8] p-6 shadow-sm">
          <h2 className="mb-3 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">Content Warnings</h2>
          <ul className="space-y-2 text-[#1C1814]">
            {canonicalDoc.contentWarnings.map((warning, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="shrink-0 mt-0.5 text-[#8B2E2E]">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
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
              <p className="mt-1 text-2xl font-bold text-[#1C1814]">{canonicalDoc.revisionOpportunitySummary.total}</p>
            </div>
            <div className="border border-[#D9D0C3] bg-[#EEF7EF] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5C5549]">Recommended</p>
              <p className="mt-1 text-2xl font-bold text-[#1C1814]">{canonicalDoc.revisionOpportunitySummary.high}</p>
            </div>
            <div className="border border-[#D9D0C3] bg-[#EEF3F8] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5C5549]">Optional</p>
              <p className="mt-1 text-2xl font-bold text-[#1C1814]">{canonicalDoc.revisionOpportunitySummary.medium}</p>
            </div>
            <div className="border border-[#D9D0C3] bg-[#FFF6E8] p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5C5549]">Consider</p>
              <p className="mt-1 text-2xl font-bold text-[#1C1814]">{canonicalDoc.revisionOpportunitySummary.low}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#5C5549]">Recommendation tiers indicate the suggested urgency of each revision opportunity.</p>
        </section>

        {/* ── Executive Summary (template section 7) + Top Strengths (8) + Top Risks (9) ── */}
        {(!isLongForm || dreamDoc) && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl font-bold text-[#8B2E2E]">Executive Summary</h2>
              <div className="flex items-center gap-4">
                <span className={`border px-4 py-2 text-sm font-semibold ${
                  overview.verdict === 'pass' ? 'border-[#D9D0C3] bg-[#EEF7EF] text-[#1C1814]' :
                  overview.verdict === 'revise' ? 'border-[#D9D0C3] bg-[#FFF6E8] text-[#1C1814]' :
                  'border-[#D9D0C3] bg-[#F9E8E8] text-[#1C1814]'
                }`}>
                  {overview.verdict.toUpperCase()}
                </span>
                <span className="font-serif text-3xl font-bold text-[#8B2E2E]">
                  {canonicalDoc.titleBlock.overallScoreLabel}
                </span>
              </div>
            </div>
            <p className="mb-6 leading-relaxed text-[#1C1814]">
              {correctScopeLanguage(canonicalDoc.executiveSummary, isLongForm)}
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#1C1814]">
                  <span className="text-[#8B2E2E]">•</span>
                  Top Strengths
                </h3>
                <ul className="space-y-2">
                  {canonicalDoc.topStrengths.map((strength, idx) => (
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
                  {canonicalDoc.topRisks.map((risk, idx) => (
                    <li key={idx} className="border-l-2 border-[#C8A96E] pl-4 text-[#1C1814]">
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ── Top Recommendations (template section 10) ── */}
        {canonicalDoc.topRecommendations.length > 0 && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-4 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">Top Recommendations</h2>
            <ol className="space-y-3 text-[#1C1814]">
              {canonicalDoc.topRecommendations.map((recommendation, idx) => (
                <li key={idx} className="flex items-start gap-3 leading-relaxed">
                  <span className="shrink-0 font-semibold text-[#8B2E2E]">{idx + 1}.</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Criteria Scores — hidden for long-form once dreamDoc lands (full synthesis is canonical) */}
        {(!isLongForm || !dreamDoc) && (
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-6 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">
            Detailed Scores
          </h2>
          <div className="mb-4 border border-[#D9D0C3] bg-[#FAF7F2] p-3 text-sm leading-relaxed text-[#1C1814]">
            <p className="font-medium">What Does Confidence Mean?</p>
            <p className="mt-1">
              Confidence reflects how strongly each diagnosis is supported by direct evidence in your writing.
            </p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="inline-flex shrink-0 items-center bg-[#EEF7EF] px-2 py-0.5 text-xs font-medium text-[#1C1814]">High</span>
                <span>Strong textual evidence supports this diagnosis.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex shrink-0 items-center bg-[#EEF3F8] px-2 py-0.5 text-xs font-medium text-[#1C1814]">Moderate</span>
                <span>Enough evidence to identify the issue, but some ambiguity remains.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex shrink-0 items-center bg-[#FFF6E8] px-2 py-0.5 text-xs font-medium text-[#1C1814]">Low</span>
                <span>Limited or conflicting evidence—treat as a prompt for review, not a final judgment.</span>
              </li>
            </ul>
          </div>
          <p className="mb-4 text-sm font-medium text-[#5C5549]">
            {getCertifiedCriteriaSummary(criteria as Parameters<typeof getCertifiedCriteriaSummary>[0])}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {criteria.map((criterion) => (
              <div key={criterion.key} className="border border-[#D9D0C3] bg-white overflow-hidden">
                {/* Criterion header band — name left, score + confidence right */}
                <div className="flex items-center justify-between gap-3 bg-[#1C1814] px-4 py-2.5">
                  <h3 className="font-serif text-sm font-bold text-[#F5EFE0] leading-snug">
                    {getCriterionDisplayLabel(criterion.key)}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {(() => {
                      const badge = getCriterionPrimaryBadge(criterion as Parameters<typeof getCriterionPrimaryBadge>[0]);
                      return (
                        <span className="font-serif text-base font-bold text-[#C8A96E]">
                          {badge.label}
                        </span>
                      );
                    })()}
                    {(() => {
                      const confidence = getConfidenceBadge(criterion);
                      if (!confidence) return null;
                      return (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9A9087] border-l border-[#3A3530] pl-2">
                          {confidence.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="p-4">
                {getCriterionSupportLabel(criterion as Parameters<typeof getCriterionSupportLabel>[0]) && (
                  <p className="mb-2 text-xs font-medium text-[#5C5549]">
                    {getCriterionSupportLabel(criterion as Parameters<typeof getCriterionSupportLabel>[0])}
                  </p>
                )}
                {(() => {
                  const rationalePresentation = getCriterionRationalePresentation(criterion, criterion.rationale);
                  if (!rationalePresentation) return null;

                  return (
                    <div className="space-y-1">
                      {rationalePresentation.label && (
                        <p className="text-xs font-medium uppercase tracking-wide text-[#8B2E2E]">
                          {rationalePresentation.label}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed text-[#1C1814]">{rationalePresentation.text}</p>
                    </div>
                  );
                })()}
                {/* Fit/Gap framing */}
                {(criterion as Record<string, unknown>).fit_summary && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8B2E2E]">What&apos;s Working</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-[#1C1814]">{String((criterion as Record<string, unknown>).fit_summary)}</p>
                    </div>
                    {(criterion as Record<string, unknown>).gap_summary && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8B2E2E]">Gap to Close</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-[#1C1814]">{String((criterion as Record<string, unknown>).gap_summary)}</p>
                      </div>
                    )}
                  </div>
                )}
                {/* Criterion Opportunities (6-part diagnostic) */}
                {Array.isArray((criterion as Record<string, unknown>).recommendations) &&
                  ((criterion as Record<string, unknown>).recommendations as Array<Record<string, unknown>>).length > 0 && (
                  <CriterionOpportunities
                    recommendations={(criterion as Record<string, unknown>).recommendations as Array<{
                      priority?: string;
                      anchor_snippet?: string;
                      symptom?: string;
                      mechanism?: string;
                      specific_fix?: string;
                      reader_effect?: string;
                      mistake_proofing?: string;
                    }>}
                  />
                )}
                </div>{/* end card body */}
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Action Items — hidden for long-form once dreamDoc lands (revision plan in synthesis is canonical) */}
        {(!isLongForm || !dreamDoc) && (
        <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
          <h2 className="mb-6 border-b border-[#D9D0C3] pb-2 font-serif text-2xl font-bold text-[#8B2E2E]">Action Items</h2>
          {/* Quick Wins */}
          {recommendations.quick_wins.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-semibold text-[#1C1814]">
                Quick Wins
              </h3>
              <div className="space-y-3">
                {recommendations.quick_wins.map((qw, idx) => (
                  <div key={idx} className="border-l-4 border-[#8B2E2E] pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-[#1C1814]">{qw.action}</p>
                      <span className="text-xs px-2 py-1 bg-[#FAF7F2] text-[#5C5549]">
                        {qw.effort} effort
                      </span>
                      <span className="text-xs px-2 py-1 bg-[#FAF7F2] text-[#1C1814] font-medium">
                        {qw.impact} impact
                      </span>
                    </div>
                    {qw.anchor_snippet && (
                      <p className={`text-sm text-[#5C5549] mt-1 ${(qw as Record<string, unknown>).anchor_type !== 'editorial_diagnosis' ? 'italic' : ''} border-l-2 border-[#D9D0C3] pl-2`}>
                        <span className="font-medium not-italic text-[#1C1814]">
                          {(qw as Record<string, unknown>).anchor_type === 'paraphrased_observation' ? 'Observation' : (qw as Record<string, unknown>).anchor_type === 'editorial_diagnosis' ? 'Diagnostic Basis' : 'Original Passage'}:
                        </span>{" "}
                        {(qw as Record<string, unknown>).anchor_type === 'editorial_diagnosis' ? qw.anchor_snippet : <>&ldquo;{qw.anchor_snippet}&rdquo;</>}
                      </p>
                    )}
                    {qw.candidate_text_a && (
                      <p className="text-sm text-[#3A6B2A] mt-1 italic border-l-2 border-[#A8C5A0] pl-2">
                        <span className="font-medium not-italic">Suggested Revision:</span>{" "}
                        &ldquo;{qw.candidate_text_a}&rdquo;
                      </p>
                    )}
                    {qw.reader_effect && (
                      <p className="text-xs text-[#5C5549] mt-1">
                        <span className="font-medium">Reader Effect:</span> {qw.reader_effect}
                      </p>
                    )}
                    <p className="text-sm text-[#1C1814] leading-relaxed">{qw.why}</p>
                    {qw.manuscript_coordinates && (
                      <p className="text-xs text-[#9A9087] mt-1">
                        <span className="font-medium">Location:</span> {qw.manuscript_coordinates}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Strategic Revisions */}
          {recommendations.strategic_revisions.length > 0 && (
            <div>
              <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-semibold text-[#1C1814]">
                Strategic Revisions
              </h3>
              <div className="space-y-3">
                {recommendations.strategic_revisions.map((sr, idx) => (
                  <div key={idx} className="border-l-4 border-[#C8A96E] pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-[#1C1814]">{sr.action}</p>
                      <span className="text-xs px-2 py-1 bg-[#FAF7F2] text-[#5C5549]">
                        {sr.effort} effort
                      </span>
                      <span className="text-xs px-2 py-1 bg-[#FAF7F2] text-[#1C1814] font-medium">
                        {sr.impact} impact
                      </span>
                    </div>
                    {sr.anchor_snippet && (
                      <p className={`text-sm text-[#5C5549] mt-1 ${(sr as Record<string, unknown>).anchor_type !== 'editorial_diagnosis' ? 'italic' : ''} border-l-2 border-[#D9D0C3] pl-2`}>
                        <span className="font-medium not-italic text-[#1C1814]">
                          {(sr as Record<string, unknown>).anchor_type === 'paraphrased_observation' ? 'Observation' : (sr as Record<string, unknown>).anchor_type === 'editorial_diagnosis' ? 'Diagnostic Basis' : 'Original Passage'}:
                        </span>{" "}
                        {(sr as Record<string, unknown>).anchor_type === 'editorial_diagnosis' ? sr.anchor_snippet : <>&ldquo;{sr.anchor_snippet}&rdquo;</>}
                      </p>
                    )}
                    {sr.candidate_text_a && (
                      <p className="text-sm text-[#3A6B2A] mt-1 italic border-l-2 border-[#A8C5A0] pl-2">
                        <span className="font-medium not-italic">Suggested Revision:</span>{" "}
                        &ldquo;{sr.candidate_text_a}&rdquo;
                      </p>
                    )}
                    {sr.reader_effect && (
                      <p className="text-xs text-[#5C5549] mt-1">
                        <span className="font-medium">Reader Effect:</span> {sr.reader_effect}
                      </p>
                    )}
                    <p className="text-sm text-[#1C1814] leading-relaxed">{sr.why}</p>
                    {sr.manuscript_coordinates && (
                      <p className="text-xs text-[#9A9087] mt-1">
                        <span className="font-medium">Location:</span> {sr.manuscript_coordinates}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        )}

        {/* Narrative Synthesis (Pass 3b — async, long-form manuscripts only) */}
        {isLongForm && (
          <section className="mb-6 rounded-sm border border-[#D9D0C3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 font-serif text-2xl font-bold text-[#8B2E2E]">
              {dreamDoc ? 'Narrative Synthesis' : 'Finalizing Your Report'}
              {!dreamDoc && (
                <span className="ml-2 inline-flex items-center border border-[#D9D0C3] bg-[#FFF6E8] px-2.5 py-0.5 text-xs font-semibold text-[#1C1814]">
                  Part 2 generating…
                </span>
              )}
            </h2>
            {!dreamDoc && (
              <p className="mb-4 text-sm text-[#5C5549]">
                Part 1 of 2 ready—scroll up to review scores and revision plan while Part 2 generates below
              </p>
            )}

            {dreamDoc ? (
              <div className="space-y-6">
                {/* §1 — Executive verdict + DREAM scores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['quality', 'readiness', 'commercial', 'literary'] as const).map((dim) => (
                    <div key={dim} className="border border-[#D9D0C3] bg-white p-3 text-center">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#5C5549]">{dim}</p>
                      <p className="font-serif text-2xl font-bold text-[#8B2E2E]">{getDisplayDreamScore(dreamDoc, dim)}</p>
                      <p className="text-xs text-[#5C5549]">/100</p>
                    </div>
                  ))}
                </div>

                {/* Executive Verdict */}
                <div>
                  <h3 className="mb-2 font-serif text-lg font-semibold text-[#8B2E2E]">Executive Verdict</h3>
                  <div className="space-y-3">
                    {splitIntoParagraphs(correctScopeLanguage(dreamExecutiveVerdict, isLongForm)).map((para, idx) => (
                      <p key={idx} className="leading-relaxed text-[#1C1814]">{para}</p>
                    ))}
                  </div>
                </div>

                {/* §2 — Market shelf */}
                <div>
                  <h3 className="mb-2 font-serif text-lg font-semibold text-[#8B2E2E]">Market Shelf</h3>
                  <p className="mb-1 text-sm text-[#5C5549]">
                    <span className="font-medium">Best shelf:</span> {dreamBestShelf ?? "—"}
                  </p>
                  <p className="mb-1 text-sm text-[#5C5549]">
                    <span className="font-medium">Marketable hook:</span> {dreamMarketableHook ?? "—"}
                  </p>
                  <p className="text-sm text-[#8B2E2E]">
                    <span className="font-medium">Market danger:</span> {dreamMarketDanger ?? "—"}
                  </p>
                  {dreamShelfNeighbors.length > 0 && (
                    <div className="mt-3">
                      <h4 className="mb-1 text-sm font-semibold text-[#1C1814]">Comparable Titles &amp; Shelf Neighbors</h4>
                      <ul className="space-y-0.5 text-sm text-[#5C5549]">
                        {dreamShelfNeighbors.map((title, idx) => (
                          <li key={idx}>• {title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {dreamComparisonSpace.length > 0 && (
                    <div className="mt-3">
                      <h4 className="mb-1 text-sm font-semibold text-[#1C1814]">Comparison Space</h4>
                      <ul className="space-y-0.5 text-sm text-[#5C5549]">
                        {dreamComparisonSpace.map((comp, idx) => (
                          <li key={idx}>• {comp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* §3 — What not to become */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Anti-Patterns to Avoid</h3>
                  {dreamAntiPatterns.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {dreamAntiPatterns.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>

                {/* §4 — Structural stack */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Structural Stack</h3>
                  {dreamStructuralStack.length > 0 ? (
                    <div className="space-y-2">
                      {dreamStructuralStack.map((layer, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Layer:</span> {getDisplayText(layer.layer_name)}</p>
                          <p><span className="font-medium">Function:</span> {getDisplayText(layer.function)}</p>
                          <p><span className="font-medium">Status:</span> {getDisplayText(layer.status)}</p>
                          <p><span className="font-medium">Revision note:</span> {getDisplayText(layer.revision_note)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>

                {/* §5 — Arc map */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Arc Map</h3>
                  {dreamArcMap.length > 0 ? (
                    <div className="space-y-2">
                      {dreamArcMap.map((arc, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Act:</span> {getDisplayText(arc.act_name)}</p>
                          <p><span className="font-medium">Chapter range:</span> {getDisplayText(arc.chapter_range)}</p>
                          <p><span className="font-medium">Primary function:</span> {getDisplayText(arc.primary_function)}</p>
                          <p>
                            <span className="font-medium">Revision priority:</span>{' '}
                            {getDisplayText(arc.revision_priority)}
                            {typeof arc.revision_rationale === 'string' && arc.revision_rationale.trim() && (
                              <span className="text-gray-600">—{arc.revision_rationale.trim()}</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>

                {/* §7 — Criterion analyses */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Criterion Analyses</h3>
                  {dreamCriterionAnalyses.length > 0 ? (
                    <div className="space-y-2">
                      {dreamCriterionAnalyses.map((analysis, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Criterion:</span> {getCriterionDisplayLabel(getDisplayText(analysis.key))}</p>
                          <p><span className="font-medium">Score:</span> {getDisplayText(analysis.score)}</p>
                          <p><span className="font-medium">Confidence:</span> {getDisplayText(analysis.confidence)}</p>

                          {(() => {
                            const fitEvidence = filterAuthorFacingTextList(analysis.fit_evidence);
                            const gapEvidence = filterAuthorFacingTextList(analysis.gap_evidence);
                            const revisionQueue = filterAuthorFacingTextList(analysis.revision_queue);

                            return (
                              <div className="mt-2 space-y-2">
                                {fitEvidence.length > 0 && (
                                  <div>
                                    <p className="font-medium">Fit evidence:</p>
                                    <ol className="list-decimal list-inside space-y-0.5 text-gray-700">
                                      {fitEvidence.map((entry, i) => (
                                        <li key={i}>{entry}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                {gapEvidence.length > 0 && (
                                  <div>
                                    <p className="font-medium">Gap evidence:</p>
                                    <ol className="list-decimal list-inside space-y-0.5 text-gray-700">
                                      {gapEvidence.map((entry, i) => (
                                        <li key={i}>{entry}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                {revisionQueue.length > 0 && (
                                  <div>
                                    <p className="font-medium">Revision queue:</p>
                                    <ol className="list-decimal list-inside space-y-0.5 text-gray-700">
                                      {revisionQueue.map((entry, i) => (
                                        <li key={i}>{entry}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                {fitEvidence.length === 0 && gapEvidence.length === 0 && revisionQueue.length === 0 && (
                                  <p className="text-gray-700">—</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>

                {/* §8–9: Layer analyses + Cross-layer integration — INTERNAL ONLY.
                    Never rendered in author-facing reports. */}
                {showTechnicalSections && (
                <>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Layer Analyses <span className="text-xs text-amber-700">(internal)</span></h3>
                  {dreamLayerAnalyses.length > 0 ? (
                    <div className="space-y-2">
                      {dreamLayerAnalyses.map((layer, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Layer:</span> {getDisplayText(layer.layer_name)}</p>
                          <p><span className="font-medium">Status:</span> {getDisplayText(layer.status)}</p>
                          <p><span className="font-medium">Needed revision:</span> {getDisplayText(layer.needed_revision)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Cross-Layer Integration <span className="text-xs text-amber-700">(internal)</span></h3>
                  {dreamCrossLayerIntegration.length > 0 ? (
                    <div className="space-y-2">
                      {dreamCrossLayerIntegration.map((row, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Motif:</span> {getDisplayText(row.motif)}</p>
                          <p><span className="font-medium">Description:</span> {getDisplayText(row.description)}</p>
                          <p><span className="font-medium">Integration quality:</span> {getDisplayText(row.integration_quality)}</p>
                          <p><span className="font-medium">Revision note:</span> {getDisplayText(row.revision_note)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>
                </>
                )}

                {/* §10 — Symbolic audit */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Symbolic / Doctrine Audit</h3>
                  {dreamPreservedSymbols.length > 0 ? (
                    <div className="space-y-2 mb-2">
                      {dreamPreservedSymbols.map((symbol, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Symbol:</span> {getDisplayText(symbol.symbol)}</p>
                          <p><span className="font-medium">Current function:</span> {getDisplayText(symbol.current_function)}</p>
                          <p><span className="font-medium">Revision instruction:</span> {getDisplayText(symbol.revision_instruction)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 mb-2">Preserved symbols: —</p>
                  )}
                  <p className="text-sm text-gray-700"><span className="font-medium">Doctrine strengths:</span> {dreamDoctrineStrengths.join("; ") || "—"}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium">Doctrine risks:</span> {dreamDoctrineRisks.join("; ") || "—"}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium">Audit conclusion:</span> {getDisplayText(dreamSymbolicAudit?.audit_conclusion)}</p>
                </div>

                {/* §11 — Reader experience */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Reader Experience</h3>
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded border border-gray-200 p-3">
                      <p className="font-medium text-gray-900 mb-1">First Act</p>
                      <p>Reader question: {getDisplayText(dreamReaderFirstAct?.reader_question)}</p>
                      <p>Emotional state: {getDisplayText(dreamReaderFirstAct?.emotional_state)}</p>
                      <p>Risk: {getDisplayText(dreamReaderFirstAct?.risk)}</p>
                    </div>
                    <div className="rounded border border-gray-200 p-3">
                      <p className="font-medium text-gray-900 mb-1">Middle</p>
                      <p>Reader question: {getDisplayText(dreamReaderMiddle?.reader_question)}</p>
                      <p>Emotional state: {getDisplayText(dreamReaderMiddle?.emotional_state)}</p>
                      <p>Risk: {getDisplayText(dreamReaderMiddle?.risk)}</p>
                    </div>
                    <div className="rounded border border-gray-200 p-3">
                      <p className="font-medium text-gray-900 mb-1">Final Act</p>
                      <p>Reader question: {getDisplayText(dreamReaderFinalAct?.reader_question)}</p>
                      <p>Emotional state: {getDisplayText(dreamReaderFinalAct?.emotional_state)}</p>
                      <p>Risk: {getDisplayText(dreamReaderFinalAct?.risk)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2"><span className="font-medium">Aftertaste:</span> {getDisplayText(dreamReaderExperience?.aftertaste)}</p>
                </div>

                {/* §12 — Revision plan */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Revision Plan</h3>
                  {dreamRevisionPlan.length > 0 ? (
                    <div className="space-y-2">
                      {dreamRevisionPlan.map((planItem, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Priority:</span> {planItem.displayPriority}</p>
                          <p><span className="font-medium">Title:</span> {getDisplayText(planItem.title)}</p>
                          <p><span className="font-medium">Goal:</span> {getDisplayText(planItem.goal)}</p>
                          {planItem.actions.length > 0 ? (
                            <div>
                              <p><span className="font-medium">Actions:</span></p>
                              <ol className="list-decimal list-inside space-y-0.5 text-gray-700 mt-1">
                                {planItem.actions.map((action, actionIdx) => (
                                  <li key={actionIdx}>{action}</li>
                                ))}
                              </ol>
                            </div>
                          ) : (
                            <p><span className="font-medium">Actions:</span> —</p>
                          )}
                          <p><span className="font-medium">Acceptance check:</span> {getDisplayText(planItem.acceptance_check)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>

                {/* §13 — Releasability */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Releasability</h3>
                  {dreamReleasability.length > 0 ? (
                    <div className="space-y-2">
                      {dreamReleasability.map((row, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Dimension:</span> {getDisplayText(row.dimension)}</p>
                          <p><span className="font-medium">Current status:</span> {getDisplayText(row.current_status)}</p>
                          <p><span className="font-medium">Verdict:</span> {getDisplayText(row.verdict)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>

                {/* §14–16: Acceptance checks, Calibration notes, Repo summary — INTERNAL ONLY.
                    Never rendered in author-facing reports. Only visible to support staff
                    with active author grant (showTechnicalSections). */}
                {showTechnicalSections && (
                <>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceptance Checks <span className="text-xs text-amber-700">(internal)</span></h3>
                  <p className="text-sm text-gray-700"><span className="font-medium">Required detection:</span> {dreamRequiredDetections.join("; ") || "—"}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium">Failure conditions:</span> {dreamFailureConditions.join("; ") || "—"}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Calibration Notes <span className="text-xs text-amber-700">(internal)</span></h3>
                  {dreamCalibrationNotes.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {dreamCalibrationNotes.map((note, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{note}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Repository Summary <span className="text-xs text-amber-700">(internal)</span></h3>
                  <div className="rounded border border-gray-200 p-3 text-sm space-y-1">
                    <p><span className="font-medium">Benchmark:</span> {getDisplayText(dreamRepoSummary?.benchmark_name)}</p>
                    <p><span className="font-medium">Source:</span> {getDisplayText(dreamRepoSummary?.source)}</p>
                    <p><span className="font-medium">Evaluation type:</span> {getDisplayText(dreamRepoSummary?.evaluation_type)}</p>
                    <p><span className="font-medium">Overall score:</span> {getDisplayText(dreamRepoSummary?.overall_score)}</p>
                    <p><span className="font-medium">Readiness score:</span> {getDisplayText(dreamRepoSummary?.readiness_score)}</p>
                    <p><span className="font-medium">Primary strengths:</span> {getDisplayDreamList(dreamRepoSummary?.primary_strengths).join("; ") || "—"}</p>
                    <p><span className="font-medium">Primary blockers:</span> {getDisplayText(dreamRepoSummary?.primary_blockers)}</p>
                    <p><span className="font-medium">Gold standard requirement:</span> {getDisplayText(dreamRepoSummary?.gold_standard_requirement)}</p>
                  </div>
                </div>
                </>
                )}

                {/* Pre-analysis integrity flags — prose block removed; LongformManuscriptIntegrityTable (Ledger E peer section) is canonical */}
              </div>
            ) : (
              <SynthesisPoller
                jobId={params.jobId}
                wordCount={wordCount}
                initialDreamDoc={null}
              />
            )}
          </section>
        )}

        {/* Character System — Peer Section (shown after Narrative Synthesis lands) */}
        {isLongForm && dreamDoc && (
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
                <LongformCharacterCoverageArcLedger doc={dreamDoc} showInternalSections={showTechnicalSections} />
              </div>
              {/* Ledger B — Relationship Spine */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger B — Relationship Spine</h3>
                <p className="text-xs text-gray-700 mb-3">Load-bearing relationships, bridge mechanisms &amp; trust transfer</p>
                <LongformRelationshipSpineLedger doc={dreamDoc} showInternalSections={showTechnicalSections} />
              </div>
              {/* Ledger C — Symbol-to-Character Payoff */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger C — Symbol-to-Character Payoff</h3>
                <p className="text-xs text-gray-700 mb-3">Symbol lifecycle — first appearance, transfer, payoff</p>
                <LongformSymbolPayoffLedger doc={dreamDoc} />
              </div>
            </div>
          </section>
        )}

        {/* Craft Evidence — Peer Section (shown after Narrative Synthesis lands) */}
        {isLongForm && dreamDoc && (
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
                <LongformSensoryEmotionalRegister doc={dreamDoc} />
              </div>
              {/* Ledger E — Manuscript Integrity Confidence Table */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger E — Manuscript Integrity Table</h3>
                <p className="text-xs text-gray-700 mb-3">Document hygiene vs. story craft — classified integrity findings</p>
                <LongformManuscriptIntegrityTable doc={dreamDoc} />
              </div>
              {/* Ledger F — Evidence Distribution / Confidence Gate */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Ledger F — Evidence Distribution &amp; Confidence Gate</h3>
                <p className="text-xs text-gray-700 mb-3">Confidence per criterion, distribution gaps, coverage failures</p>
                <LongformEvidenceDistributionGate doc={dreamDoc} showInternalSections={showTechnicalSections} />
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
          <p className="text-gray-900 font-medium mb-2">What Does Confidence Mean?</p>
          <p className="text-gray-700 mb-4">
            Confidence reflects how strongly each diagnosis is supported by direct evidence in your writing.
          </p>
          <ul className="space-y-2 text-gray-700">
            <li><span className="font-medium">High:</span> Strong textual evidence supports this diagnosis.</li>
            <li><span className="font-medium">Moderate:</span> Enough evidence to identify the issue, but some ambiguity remains.</li>
            <li><span className="font-medium">Low:</span> Limited or conflicting evidence—treat as a prompt for review, not a final judgment.</li>
          </ul>
        </section>

        {/* ── Author-Facing Disclaimer ── */}
        <section className="border border-gray-200 rounded-lg p-5 mb-6 bg-gray-50">
          <p className="text-xs text-gray-500 leading-relaxed">
            Generated by RevisionGrade™. Author retains ownership of manuscript content.
            This report is an editorial diagnostic and does not guarantee publication,
            representation, or commercial outcome.
          </p>
        </section>

        {/* Technical sections — only visible to admin/support with active author grant */}
        {showTechnicalSections && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-amber-200 bg-amber-50/30">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              Evaluation Metadata
              <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Support view</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Model</p>
                <p className="font-mono text-gray-900">{result.engine.model}</p>
              </div>
              <div>
                <p className="text-gray-600">Confidence</p>
                <p className="font-mono text-gray-900">{(governance.confidence * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-gray-600">Job ID</p>
                <p className="font-mono text-gray-900">{params.jobId}</p>
              </div>
              <div>
                <p className="text-gray-600">Word Count</p>
                <p className="font-mono text-gray-900">{metrics.manuscript.word_count ? metrics.manuscript.word_count.toLocaleString() : 'N/A'}</p>
              </div>
              {metrics.processing.runtime_ms && (
                <div>
                  <p className="text-gray-600">Processing Time</p>
                  <p className="font-mono text-gray-900">{(metrics.processing.runtime_ms / 1000).toFixed(1)}s</p>
                </div>
              )}
            </div>
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
