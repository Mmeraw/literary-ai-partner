import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
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
  getDisplayDateTime,
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
import { buildReportPitches } from '@/lib/evaluation/reportTemplateContract';
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
      manuscript_id,
      manuscripts!inner(user_id,title)
    `)
    .eq('id', jobId)
    .eq('manuscripts.user_id', userId)
    .single();

  if (error || !job || !canReleaseEvaluationRead(job) || !job.evaluation_result) {
    return null;
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
      manuscript_id,
      manuscripts(title)
    `)
    .eq('id', jobId)
    .single();

  if (error || !job || !canReleaseEvaluationRead(job) || !job.evaluation_result) {
    return null;
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

  const { result: resultRaw, manuscriptTitle, manuscriptId } = report;
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
    <div className="min-h-screen bg-gray-50">
      {printMode && <AutoPrintOnLoad enabled />}
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-8">
        {/* Header + Title Block (template section 1) */}
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">Evaluation Report</h1>
              <p className="mt-1 text-lg font-semibold text-gray-900">{displayTitle}</p>
              {chapterTitle && manuscriptTitle && chapterTitle !== manuscriptTitle && (
                <p className="text-sm text-gray-600">{manuscriptTitle}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Generated {getDisplayDateTime(result.generated_at, "Unknown")}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                <span className="font-medium text-gray-700">Reference ID:</span>{' '}
                <span className="font-mono text-gray-900">{params.jobId}</span>{' '}
                <CopyReferenceIdButton
                  value={params.jobId}
                  className="ml-2 inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                />
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3 print-hidden">
              {manuscriptId && (
                <div className="flex flex-col items-center gap-0.5">
                  <Link
                    href={`/workbench?manuscriptId=${manuscriptId}&evaluationJobId=${params.jobId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    Revise now
                  </Link>
                  <span className="text-[10px] text-gray-400 leading-tight">May take 1–2 min to load</span>
                </div>
              )}
              <DownloadReportButton jobId={params.jobId} />
            </div>
          </div>
          {/* Title Block metadata grid (template-mandated fields) */}
          {(() => {
            const overallScore = overview.overall_score_0_100;
            const marketReadiness = typeof overallScore === 'number' && Number.isFinite(overallScore)
              ? (overallScore >= 90 ? 'Market Ready' : overallScore >= 80 ? 'Near Market Ready' : 'Not Market Ready')
              : 'Review';
            const genre = result.metrics?.manuscript?.genre || 'Not specified';
            const v2Enrichment = isEvaluationResultV2(resultRaw) ? (resultRaw as EvaluationResultV2).enrichment : null;
            const targetAudience = v2Enrichment?.target_audience || result.metrics?.manuscript?.target_audience || 'Not available';
            const submittedWordCount = result.metrics?.manuscript?.word_count;
            const estimatedPages = submittedWordCount ? Math.floor(submittedWordCount / 250) : null;
            const rgl = v2Enrichment?.reading_grade_level;
            const dialoguePct = v2Enrichment?.dialogue_percentage;
            const narrativePct = v2Enrichment?.narrative_percentage ?? (dialoguePct != null ? 100 - dialoguePct : null);
            return (
              <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm border-t border-gray-200 pt-4">
                <div><dt className="text-gray-500">Report Type</dt><dd className="font-medium text-gray-900">Short-Form Evaluation</dd></div>
                <div><dt className="text-gray-500">Overall Score</dt><dd className="font-medium text-gray-900">{overallScore}/100</dd></div>
                <div><dt className="text-gray-500">Market Readiness</dt><dd className="font-medium text-gray-900">{marketReadiness}</dd></div>
                <div><dt className="text-gray-500">Genre</dt><dd className="font-medium text-gray-900">{genre}</dd></div>
                <div><dt className="text-gray-500">Target Audience</dt><dd className="font-medium text-gray-900">{targetAudience}</dd></div>
                {submittedWordCount ? <div><dt className="text-gray-500">Submitted Word Count</dt><dd className="font-medium text-gray-900">{submittedWordCount.toLocaleString()}</dd></div> : null}
                {estimatedPages ? <div><dt className="text-gray-500">Estimated Pages</dt><dd className="font-medium text-gray-900">{estimatedPages.toLocaleString()} at 250 words/page</dd></div> : null}
                {rgl != null ? <div><dt className="text-gray-500">Reading Grade Level</dt><dd className="font-medium text-gray-900">{Math.floor(Number(rgl))} (Flesch-Kincaid)</dd></div> : null}
                {dialoguePct != null ? <div><dt className="text-gray-500">Dialogue/Narrative Ratio</dt><dd className="font-medium text-gray-900">{Math.floor(Number(dialoguePct))}% / {narrativePct != null ? Math.floor(Number(narrativePct)) : '—'}%</dd></div> : null}
              </dl>
            );
          })()}
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
        {(() => {
          const enrichment = isEvaluationResultV2(result) ? (result as EvaluationResultV2).enrichment : null;
          const pitches = buildReportPitches({
            premise: enrichment?.premise,
            summary: overview.one_paragraph_summary,
            title: displayTitle,
            one_sentence_pitch: (overview as Record<string, unknown>).one_sentence_pitch as string | undefined,
            one_paragraph_pitch: (overview as Record<string, unknown>).one_paragraph_pitch as string | undefined,
          });
          return (
            <>
              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">One-Paragraph Pitch</h2>
                <p className="text-gray-700 leading-relaxed">{mistakeProofText(pitches.oneParagraphPitch)}</p>
              </section>
              <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">One-Sentence Pitch</h2>
                <p className="text-gray-700 leading-relaxed font-medium">{mistakeProofText(pitches.oneSentencePitch)}</p>
              </section>
            </>
          );
        })()}

        {/* ── Premise (template section 4) + Content Warnings (template section 5) ── */}
        {(() => {
          if (!isEvaluationResultV2(result)) return null;
          const enrichment = (result as EvaluationResultV2).enrichment;
          if (!enrichment) return null;
          return (
            <>
              {enrichment.premise && (
                <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-3">Premise</h2>
                  <p className="text-gray-700 leading-relaxed">{mistakeProofText(enrichment.premise)}</p>
                </section>
              )}
              {enrichment.trigger_warnings && enrichment.trigger_warnings.length > 0 && (
                <section className="bg-amber-50 border border-amber-200 rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-2xl font-semibold text-amber-900 mb-3">Content Warnings</h2>
                  <ul className="space-y-2 text-amber-800">
                    {enrichment.trigger_warnings.map((w, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <span className="shrink-0 mt-0.5">{"\u26A0\uFE0F"}</span>
                        <span className="capitalize">{w}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-amber-700">
                    Consider including content warnings in book marketing or front matter.
                  </p>
                </section>
              )}
            </>
          );
        })()}

        {/* ── Revision Opportunity Summary ── */}
        {(() => {
          const allRecs = criteria.flatMap((c) =>
            Array.isArray((c as Record<string, unknown>).recommendations)
              ? ((c as Record<string, unknown>).recommendations as Array<{ priority?: string }>)
              : []
          );
          const total = allRecs.length;
          if (total === 0) return null;
          const recommended = allRecs.filter((r) => r.priority === 'high').length;
          const optional = allRecs.filter((r) => r.priority === 'medium').length;
          const consider = allRecs.filter((r) => !r.priority || r.priority === 'low').length;
          return (
            <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Revision Opportunity Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-md border bg-gray-50 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{total}</p>
                </div>
                <div className="rounded-md border bg-red-50 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-red-700">Recommended</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">{recommended}</p>
                </div>
                <div className="rounded-md border bg-amber-50 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Optional</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">{optional}</p>
                </div>
                <div className="rounded-md border bg-blue-50 p-4 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Consider</p>
                  <p className="mt-1 text-2xl font-bold text-blue-900">{consider}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">Recommendation tiers indicate the suggested urgency of each revision opportunity.</p>
            </section>
          );
        })()}

        {/* ── Executive Summary (template section 7) + Top Strengths (8) + Top Risks (9) ── */}
        {(!isLongForm || dreamDoc) && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-900">Executive Summary</h2>
              <div className="flex items-center gap-4">
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  overview.verdict === 'pass' ? 'bg-green-100 text-green-800' :
                  overview.verdict === 'revise' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {overview.verdict.toUpperCase()}
                </span>
                <span className="text-3xl font-bold text-gray-900">
                  {overview.overall_score_0_100}/100
                </span>
              </div>
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed">
              {mistakeProofText(correctScopeLanguage(chapterTitle ? `In ${displayTitle}, ${overview.one_paragraph_summary.replace(/^This\s/, 'this ')}` : overview.one_paragraph_summary, isLongForm))}
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-green-600">{"\u2713"}</span>
                  Top Strengths
                </h3>
                <ul className="space-y-2">
                  {overview.top_3_strengths.map((strength, idx) => (
                    <li key={idx} className="text-gray-700 pl-4 border-l-2 border-green-500">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-amber-600">{"\u26A0"}</span>
                  Top Risks
                </h3>
                <ul className="space-y-2">
                  {overview.top_3_risks.map((risk, idx) => (
                    <li key={idx} className="text-gray-700 pl-4 border-l-2 border-amber-500">
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ── Top Recommendations (template section 10) ── */}
        {(() => {
          const topRecs = criteria
            .flatMap((c) =>
              Array.isArray((c as Record<string, unknown>).recommendations)
                ? ((c as Record<string, unknown>).recommendations as Array<{
                    priority?: string;
                    action?: string;
                    specific_fix?: string;
                    reader_effect?: string;
                    expected_impact?: string;
                  }>).map((r) => ({ ...r, criterionKey: c.key }))
                : []
            )
            .filter((r) => r.action || r.specific_fix)
            .sort((a, b) => {
              const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
              return (order[a.priority ?? 'low'] ?? 2) - (order[b.priority ?? 'low'] ?? 2);
            })
            .slice(0, 5);
          if (topRecs.length === 0) return null;
          const tierLabel = (p?: string) => p === 'high' ? 'Recommended' : p === 'medium' ? 'Optional' : 'Consider';
          const tierColor = (p?: string) => p === 'high' ? 'bg-red-50 text-red-800 border-red-200' : p === 'medium' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200';
          return (
            <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Top Recommendations</h2>
              <ol className="space-y-3">
                {topRecs.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className={`shrink-0 mt-0.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tierColor(rec.priority)}`}>
                      {tierLabel(rec.priority)}
                    </span>
                    <span className="text-gray-700 leading-relaxed">
                      {rec.action || rec.specific_fix}
                      {rec.reader_effect || rec.expected_impact ? (
                        <span className="text-gray-500">{' — '}{rec.reader_effect || rec.expected_impact}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })()}

        {/* Criteria Scores — hidden for long-form once dreamDoc lands (full synthesis is canonical) */}
        {(!isLongForm || !dreamDoc) && (
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Detailed Scores
          </h2>
          <div className="mb-4 rounded-md border bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed">
            <p className="font-medium">What does Confidence mean?</p>
            <p className="mt-1">
              Confidence reflects how strongly each diagnosis is supported by direct evidence in your writing.
            </p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium shrink-0">High</span>
                <span>Strong textual evidence supports this diagnosis.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium shrink-0">Moderate</span>
                <span>Enough evidence to identify the issue, but some ambiguity remains.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-xs font-medium shrink-0">Low</span>
                <span>Limited or conflicting evidence—treat as a prompt for review, not a final judgment.</span>
              </li>
            </ul>
          </div>
          <p className="mb-4 text-sm font-medium text-gray-700">
            {getCertifiedCriteriaSummary(criteria as Parameters<typeof getCertifiedCriteriaSummary>[0])}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {criteria.map((criterion) => (
              <div key={criterion.key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {getCriterionDisplayLabel(criterion.key)}
                  </h3>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const badge = getCriterionPrimaryBadge(criterion as Parameters<typeof getCriterionPrimaryBadge>[0]);
                      return (
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${badge.classes}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                    {(() => {
                      const confidence = getConfidenceBadge(criterion);
                      if (!confidence) return null;
                      return (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${confidence.classes}`}>
                          {confidence.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {getCriterionSupportLabel(criterion as Parameters<typeof getCriterionSupportLabel>[0]) && (
                  <p className="mb-2 text-xs font-medium text-gray-700">
                    {getCriterionSupportLabel(criterion as Parameters<typeof getCriterionSupportLabel>[0])}
                  </p>
                )}
                {(() => {
                  const rationalePresentation = getCriterionRationalePresentation(criterion, criterion.rationale);
                  if (!rationalePresentation) return null;

                  return (
                    <div className="space-y-1">
                      {rationalePresentation.label && (
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                          {rationalePresentation.label}
                        </p>
                      )}
                      <p className="text-sm text-gray-700 leading-relaxed">{rationalePresentation.text}</p>
                    </div>
                  );
                })()}
                {/* Fit/Gap framing */}
                {(criterion as Record<string, unknown>).fit_summary && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">What&apos;s Working</p>
                      <p className="text-sm text-gray-700 leading-relaxed mt-0.5">{String((criterion as Record<string, unknown>).fit_summary)}</p>
                    </div>
                    {(criterion as Record<string, unknown>).gap_summary && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Gap to Close</p>
                        <p className="text-sm text-gray-700 leading-relaxed mt-0.5">{String((criterion as Record<string, unknown>).gap_summary)}</p>
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
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Action Items — hidden for long-form once dreamDoc lands (revision plan in synthesis is canonical) */}
        {(!isLongForm || !dreamDoc) && (
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Action Items</h2>
          {/* Quick Wins */}
          {recommendations.quick_wins.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-blue-600">{"\u26A1"}</span>
                Quick Wins
              </h3>
              <div className="space-y-3">
                {recommendations.quick_wins.map((qw, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{qw.action}</p>
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                        {qw.effort} effort
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                        {qw.impact} impact
                      </span>
                    </div>
                    {qw.anchor_snippet && (
                      <p className={`text-sm text-gray-600 mt-1 ${(qw as Record<string, unknown>).anchor_type !== 'editorial_diagnosis' ? 'italic' : ''} border-l-2 border-gray-300 pl-2`}>
                        <span className="font-medium not-italic text-gray-700">
                          {(qw as Record<string, unknown>).anchor_type === 'paraphrased_observation' ? 'Observation' : (qw as Record<string, unknown>).anchor_type === 'editorial_diagnosis' ? 'Diagnostic Basis' : 'Original Passage'}:
                        </span>{" "}
                        {(qw as Record<string, unknown>).anchor_type === 'editorial_diagnosis' ? qw.anchor_snippet : <>&ldquo;{qw.anchor_snippet}&rdquo;</>}
                      </p>
                    )}
                    {qw.candidate_text_a && (
                      <p className="text-sm text-emerald-700 mt-1 italic border-l-2 border-emerald-300 pl-2">
                        <span className="font-medium not-italic">Suggested Revision:</span>{" "}
                        &ldquo;{qw.candidate_text_a}&rdquo;
                      </p>
                    )}
                    {qw.reader_effect && (
                      <p className="text-xs text-purple-700 mt-1">
                        <span className="font-medium">Reader Effect:</span> {qw.reader_effect}
                      </p>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed">{qw.why}</p>
                    {qw.manuscript_coordinates && (
                      <p className="text-xs text-gray-500 mt-1">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-purple-600">{"\uD83D\uDCCA"}</span>
                Strategic Revisions
              </h3>
              <div className="space-y-3">
                {recommendations.strategic_revisions.map((sr, idx) => (
                  <div key={idx} className="border-l-4 border-purple-500 pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{sr.action}</p>
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                        {sr.effort} effort
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                        {sr.impact} impact
                      </span>
                    </div>
                    {sr.anchor_snippet && (
                      <p className={`text-sm text-gray-600 mt-1 ${(sr as Record<string, unknown>).anchor_type !== 'editorial_diagnosis' ? 'italic' : ''} border-l-2 border-gray-300 pl-2`}>
                        <span className="font-medium not-italic text-gray-700">
                          {(sr as Record<string, unknown>).anchor_type === 'paraphrased_observation' ? 'Observation' : (sr as Record<string, unknown>).anchor_type === 'editorial_diagnosis' ? 'Diagnostic Basis' : 'Original Passage'}:
                        </span>{" "}
                        {(sr as Record<string, unknown>).anchor_type === 'editorial_diagnosis' ? sr.anchor_snippet : <>&ldquo;{sr.anchor_snippet}&rdquo;</>}
                      </p>
                    )}
                    {sr.candidate_text_a && (
                      <p className="text-sm text-emerald-700 mt-1 italic border-l-2 border-emerald-300 pl-2">
                        <span className="font-medium not-italic">Suggested Revision:</span>{" "}
                        &ldquo;{sr.candidate_text_a}&rdquo;
                      </p>
                    )}
                    {sr.reader_effect && (
                      <p className="text-xs text-purple-700 mt-1">
                        <span className="font-medium">Reader Effect:</span> {sr.reader_effect}
                      </p>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed">{sr.why}</p>
                    {sr.manuscript_coordinates && (
                      <p className="text-xs text-gray-500 mt-1">
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
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-indigo-100">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <span aria-hidden>&#x1F4D6;</span> {dreamDoc ? 'Narrative Synthesis' : 'Finalizing your report'}
              {!dreamDoc && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                  Part 2 generating…
                </span>
              )}
            </h2>
            {!dreamDoc && (
              <p className="text-sm text-gray-700 mb-4">
                Part 1 of 2 ready—scroll up to review scores and revision plan while Part 2 generates below
              </p>
            )}

            {dreamDoc ? (
              <div className="space-y-6">
                {/* §1 — Executive verdict + DREAM scores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['quality', 'readiness', 'commercial', 'literary'] as const).map((dim) => (
                    <div key={dim} className="bg-indigo-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-indigo-600 uppercase font-semibold tracking-wide mb-1">{dim}</p>
                      <p className="text-2xl font-bold text-indigo-900">{getDisplayDreamScore(dreamDoc, dim)}</p>
                      <p className="text-xs text-indigo-500">/100</p>
                    </div>
                  ))}
                </div>

                {/* Executive Verdict */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Verdict</h3>
                  <div className="space-y-3">
                    {splitIntoParagraphs(correctScopeLanguage(dreamExecutiveVerdict, isLongForm)).map((para, idx) => (
                      <p key={idx} className="text-gray-700 leading-relaxed">{para}</p>
                    ))}
                  </div>
                </div>

                {/* §2 — Market shelf */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Shelf</h3>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Best shelf:</span> {dreamBestShelf ?? "—"}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Marketable hook:</span> {dreamMarketableHook ?? "—"}
                  </p>
                  <p className="text-sm text-rose-700">
                    <span className="font-medium">Market danger:</span> {dreamMarketDanger ?? "—"}
                  </p>
                  {dreamShelfNeighbors.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Comparable Titles &amp; Shelf Neighbors</h4>
                      <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-600">
                        {dreamShelfNeighbors.map((title, idx) => (
                          <li key={idx}>{title}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {dreamComparisonSpace.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Comparison Space</h4>
                      <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-600">
                        {dreamComparisonSpace.map((comp, idx) => (
                          <li key={idx}>{comp}</li>
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
