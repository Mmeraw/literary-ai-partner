import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { EvaluationResultV1, isEvaluationResultV1, hasD2TransparencyFields } from '@/schemas/evaluation-result-v1';
import AgentTrustHeader from '@/components/reports/AgentTrustHeader';
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
  getDisplayObjectArray,
  getDisplayRecord,
  getDisplayDreamScore,
  getDisplayText,
} from '@/lib/evaluation/reportRenderSafety';
import { resolveReportTitle } from '@/lib/evaluation/reportTitle';
import type { LongformDreamDocument } from '@/lib/evaluation/pipeline/runPass3bLongform';
import { SynthesisPoller } from '@/components/evaluation/SynthesisPoller';
import DownloadReportButton from '@/components/reports/DownloadReportButton';
import LongformCharacterCoverageArcLedger from '@/components/reports/longform/LongformCharacterCoverageArcLedger';
import LongformRelationshipSpineLedger from '@/components/reports/longform/LongformRelationshipSpineLedger';
import LongformSymbolPayoffLedger from '@/components/reports/longform/LongformSymbolPayoffLedger';
import LongformSensoryEmotionalRegister from '@/components/reports/longform/LongformSensoryEmotionalRegister';
import LongformManuscriptIntegrityTable from '@/components/reports/longform/LongformManuscriptIntegrityTable';
import LongformEvidenceDistributionGate from '@/components/reports/longform/LongformEvidenceDistributionGate';

// D1 Boundary: server-only. Service key must not leak to client.
// Hybrid owner-gate: SSR client for auth identity, admin client for
// privileged read scoped to (jobId + manuscript owner = auth.uid()).
// Ownership chain: evaluation_jobs.manuscript_id -> manuscripts.user_id
// TODO(gate7): migrate to full RLS once evaluation_jobs has user_id column.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EvaluationReportContext = {
  result: EvaluationResultV1;
  manuscriptTitle: string | null;
};

function getConfidenceBadge(criterion: EvaluationResultV1["criteria"][number]): {
  label: string;
  classes: string;
} | null {
  if (criterion.confidence_level === "high" || (typeof criterion.confidence_score_0_100 === "number" && criterion.confidence_score_0_100 >= 85)) {
    return { label: "High Confidence", classes: "bg-emerald-100 text-emerald-800" };
  }

  if (criterion.confidence_level === "moderate" || (typeof criterion.confidence_score_0_100 === "number" && criterion.confidence_score_0_100 >= 60)) {
    return { label: "Moderate Confidence", classes: "bg-amber-100 text-amber-800" };
  }

  if (criterion.confidence_level === "low" || (typeof criterion.confidence_score_0_100 === "number" && criterion.confidence_score_0_100 >= 0)) {
    return { label: "Low Confidence", classes: "bg-rose-100 text-rose-800" };
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
      manuscripts!inner(user_id,title)
    `)
    .eq('id', jobId)
    .eq('manuscripts.user_id', userId)
    .single();

  if (error || !job || !canReleaseEvaluationRead(job) || !job.evaluation_result) {
    return null;
  }

  const result = job.evaluation_result as unknown;

  if (!isEvaluationResultV1(result)) {
    console.error('Invalid evaluation result format for job:', jobId);
    return null;
  }

  return {
    result,
    manuscriptTitle: extractManuscriptTitle((job as { manuscripts?: unknown }).manuscripts),
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

  const chapterTitle = report.result.metrics?.manuscript?.title?.trim() || null;
  const { pageTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle: report.manuscriptTitle });
  return { title: pageTitle };
}

export default async function ReportPage({ params }: { params: { jobId: string } }) {
  // Step 1: Get authenticated user via cookie-scoped SSR client
  const ssrSupabase = await createSSRClient();
  const { data: { user } } = await ssrSupabase.auth.getUser();

  if (!user) {
    notFound(); // Unauthenticated users see 404, not a login redirect
  }

  // Step 2: Owner-gated privileged read
  const report = await getEvaluationResult(params.jobId, user.id);

  if (!report) {
    notFound();
  }

  const { result, manuscriptTitle } = report;
  const chapterTitle = result.metrics?.manuscript?.title?.trim() || null;
  const { displayTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });

  // DREAM long-form artifact — async Pass 3b, may not be ready yet.
  const wordCount = result.metrics?.manuscript?.word_count ?? 0;
  const isLongForm = wordCount >= 25000;
  const dreamDoc = isLongForm ? await getDreamArtifact(params.jobId) : null;
  const dreamExecutiveVerdict = getDisplayText(dreamDoc?.executive_verdict, "No executive verdict available.");
  const dreamBestShelf = getDisplayDreamMarketField(dreamDoc, "best_shelf");
  const dreamMarketableHook = getDisplayDreamMarketField(dreamDoc, "marketable_hook");
  const dreamMarketDanger = getDisplayDreamMarketField(dreamDoc, "market_danger");
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
  const dreamRevisionPlan = getDisplayObjectArray(dreamDoc?.revision_plan);
  const dreamReleasability = getDisplayObjectArray(dreamDoc?.releasability);
  const dreamAcceptanceChecks = getDisplayRecord(dreamDoc?.acceptance_checks);
  const dreamRequiredDetections = getDisplayDreamList(dreamAcceptanceChecks?.required_detection);
  const dreamFailureConditions = getDisplayDreamList(dreamAcceptanceChecks?.failure_conditions);
  const dreamCalibrationNotes = getDisplayDreamList(dreamDoc?.calibration_notes);
  const dreamRepoSummary = getDisplayRecord(dreamDoc?.repo_summary);
  const dreamIntegrityIssues = getDisplayObjectArray(dreamDoc?.manuscript_integrity_issues);

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

  // D2 required fields (all validated above; safe to access now).
  const transparency = result.governance.transparency!;
  const finalWorkTypeUsed = transparency.final_work_type_used;
  const matrixVersion = transparency.matrix_version;
  const criteriaPlan = transparency.criteria_plan;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Evaluation Report
          </h1>
          <p className="text-xl font-semibold text-gray-900 mb-1">
            {displayTitle}
          </p>
          {chapterTitle && manuscriptTitle && chapterTitle !== manuscriptTitle && (
            <p className="text-sm text-gray-500 mb-1">
              Manuscript Title: <span className="font-medium text-gray-700">{manuscriptTitle}</span>
            </p>
          )}
          <p className="text-gray-600">
            Generated {getDisplayDateTime(result.generated_at, "Unknown")}
          </p>
          <div className="mt-4">
            <DownloadReportButton jobId={params.jobId} />
          </div>
        </header>

        {/* D2 Agent Trust Header (Required) */}
        <AgentTrustHeader
          jobId={params.jobId}
          generatedAt={result.generated_at}
          finalWorkTypeUsed={finalWorkTypeUsed}
          matrixVersion={matrixVersion}
          criteriaPlan={criteriaPlan}
        />

        {/* Evaluation integrity status (single source of truth) */}
        {integrityBanner && (
          <section className={integrityBanner.containerClassName}>
            <p className={integrityBanner.titleClassName}>{integrityBanner.title}</p>
            <p className={integrityBanner.detailClassName}>{integrityBanner.message}</p>
          </section>
        )}

        {/* Overview Section — hidden for long-form until Narrative Synthesis (Part 2) lands */}
        {(!isLongForm || dreamDoc) && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-900">Overview</h2>
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
              {chapterTitle ? `In ${displayTitle}, ${overview.one_paragraph_summary}` : overview.one_paragraph_summary}
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

        {/* Criteria Scores */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            §6 — Detailed Scores / Score Grid
          </h2>
          <div className="mb-4 rounded-md border bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed">
            <p className="font-medium">Confidence Guide</p>
            <p className="mt-1">
              Confidence shows how strongly each score and summary is supported by clear examples from your submitted text.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
              <li>High (≥85): strong support from the text</li>
              <li>Moderate (60–84): partial or uneven support from the text</li>
              <li>Low (&lt;60): limited support from the text</li>
            </ul>
          </div>
          <p className="mb-4 text-sm font-medium text-gray-700">
            {getCertifiedCriteriaSummary(criteria as Parameters<typeof getCertifiedCriteriaSummary>[0])}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {criteria.map((criterion) => (
              <div key={criterion.key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 capitalize">
                    {criterion.key}
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
              </div>
            ))}
          </div>
        </section>

        {/* Recommendations */}
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
                    <p className="text-sm text-gray-700 leading-relaxed">{qw.why}</p>
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
                    <p className="text-sm text-gray-700 leading-relaxed">{sr.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Narrative Synthesis (Pass 3b — async, long-form manuscripts only) */}
        {isLongForm && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-indigo-100">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <span aria-hidden>&#x1F4D6;</span> Narrative Synthesis
              {!dreamDoc && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                  Part 2 generating…
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {dreamDoc
                ? "Holistic Craft Assessment — long-form synthesis report"
                : "Part 1 of 2 ready — scroll up to review scores and revision plan while Part 2 generates below"}
            </p>

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
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">{dreamExecutiveVerdict}</p>
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
                    <p className="text-sm text-gray-500">—</p>
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
                    <p className="text-sm text-gray-500">—</p>
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
                          <p><span className="font-medium">Revision priority:</span> {getDisplayText(arc.revision_priority)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

                {/* §7 — Criterion analyses */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Criterion Analyses</h3>
                  {dreamCriterionAnalyses.length > 0 ? (
                    <div className="space-y-2">
                      {dreamCriterionAnalyses.map((analysis, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Criterion:</span> {getDisplayText(analysis.key)}</p>
                          <p><span className="font-medium">Score:</span> {getDisplayText(analysis.score)}</p>
                          <p><span className="font-medium">Confidence:</span> {getDisplayText(analysis.confidence)}</p>
                          <p><span className="font-medium">Fit evidence:</span> {getDisplayDreamList(analysis.fit_evidence).join("; ") || "—"}</p>
                          <p><span className="font-medium">Gap evidence:</span> {getDisplayDreamList(analysis.gap_evidence).join("; ") || "—"}</p>
                          <p><span className="font-medium">Revision queue:</span> {getDisplayDreamList(analysis.revision_queue).join("; ") || "—"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

                {/* §8 — Layer analyses */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Layer Analyses</h3>
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
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

                {/* §9 — Cross-layer integration */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Cross-Layer Integration</h3>
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
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

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
                    <p className="text-sm text-gray-500 mb-2">Preserved symbols: —</p>
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
                          <p><span className="font-medium">Priority:</span> {getDisplayText(planItem.priority)}</p>
                          <p><span className="font-medium">Title:</span> {getDisplayText(planItem.title)}</p>
                          <p><span className="font-medium">Goal:</span> {getDisplayText(planItem.goal)}</p>
                          <p><span className="font-medium">Actions:</span> {getDisplayDreamList(planItem.actions).join("; ") || "—"}</p>
                          <p><span className="font-medium">Acceptance check:</span> {getDisplayText(planItem.acceptance_check)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

                {/* Ledger A — Character Coverage & Arc */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Character Coverage &amp; Arc Ledger</h3>
                  <p className="text-xs text-gray-500 mb-3">Character system coverage — roles, arc movement, ending accountability</p>
                  <LongformCharacterCoverageArcLedger doc={dreamDoc} />
                </div>

                {/* Ledger B — Relationship Spine */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Relationship Spine Ledger</h3>
                  <p className="text-xs text-gray-500 mb-3">Load-bearing relationships, bridge mechanisms &amp; trust transfer</p>
                  <LongformRelationshipSpineLedger doc={dreamDoc} />
                </div>

                {/* Ledger C — Symbol-to-Character Payoff */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Symbol-to-Character Payoff Ledger</h3>
                  <p className="text-xs text-gray-500 mb-3">Symbol lifecycle — first appearance, transfer, payoff</p>
                  <LongformSymbolPayoffLedger doc={dreamDoc} />
                </div>

                {/* Ledger D — Sensory / Emotional Register */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Sensory &amp; Emotional Register</h3>
                  <p className="text-xs text-gray-500 mb-3">Sensory systems, emotional arc, register governance</p>
                  <LongformSensoryEmotionalRegister doc={dreamDoc} />
                </div>

                {/* Ledger E — Manuscript Integrity Confidence Table */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Manuscript Integrity Table</h3>
                  <p className="text-xs text-gray-500 mb-3">Document hygiene vs. story craft — classified integrity findings</p>
                  <LongformManuscriptIntegrityTable doc={dreamDoc} />
                </div>

                {/* Ledger F — Evidence Distribution / Confidence Gate */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Evidence Distribution &amp; Confidence Gate</h3>
                  <p className="text-xs text-gray-500 mb-3">Confidence per criterion, distribution gaps, coverage failures</p>
                  <LongformEvidenceDistributionGate doc={dreamDoc} />
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
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

                {/* §14 — Acceptance checks */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceptance Checks</h3>
                  <p className="text-sm text-gray-700"><span className="font-medium">Required detection:</span> {dreamRequiredDetections.join("; ") || "—"}</p>
                  <p className="text-sm text-gray-700"><span className="font-medium">Failure conditions:</span> {dreamFailureConditions.join("; ") || "—"}</p>
                </div>

                {/* §15 — Calibration notes */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Calibration Notes</h3>
                  {dreamCalibrationNotes.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {dreamCalibrationNotes.map((note, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{note}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>

                {/* §16 — Repo summary */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Repository Summary</h3>
                  <div className="rounded border border-gray-200 p-3 text-sm space-y-1">
                    <p><span className="font-medium">Benchmark:</span> {getDisplayText(dreamRepoSummary?.benchmark_name)}</p>
                    <p><span className="font-medium">Source:</span> {getDisplayText(dreamRepoSummary?.source)}</p>
                    <p><span className="font-medium">Evaluation type:</span> {getDisplayText(dreamRepoSummary?.evaluation_type)}</p>
                    <p><span className="font-medium">Overall score:</span> {getDisplayText(dreamRepoSummary?.overall_score)}</p>
                    <p><span className="font-medium">Readiness score:</span> {getDisplayText(dreamRepoSummary?.readiness_score)}</p>
                    <p><span className="font-medium">Primary strengths:</span> {getDisplayDreamList(dreamRepoSummary?.primary_strengths).join("; ") || "—"}</p>
                    <p><span className="font-medium">Primary blockers:</span> {getDisplayDreamList(dreamRepoSummary?.primary_blockers).join("; ") || "—"}</p>
                    <p><span className="font-medium">Gold standard requirement:</span> {getDisplayText(dreamRepoSummary?.gold_standard_requirement)}</p>
                  </div>
                </div>

                {/* Pre-analysis integrity flags */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Manuscript Integrity Issues</h3>
                  {dreamIntegrityIssues.length > 0 ? (
                    <div className="space-y-2">
                      {dreamIntegrityIssues.map((issue, idx) => (
                        <div key={idx} className="rounded border border-gray-200 p-3 text-sm">
                          <p><span className="font-medium">Kind:</span> {getDisplayText(issue.kind)}</p>
                          <p><span className="font-medium">Severity:</span> {getDisplayText(issue.severity)}</p>
                          <p><span className="font-medium">Description:</span> {getDisplayText(issue.description)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">—</p>
                  )}
                </div>
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

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Generated Artifacts</h2>
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <div key={artifact.artifact_id} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                  <div>
                    <p className="font-semibold text-gray-900">{artifact.title}</p>
                    <p className="text-sm text-gray-600 capitalize">{artifact.type.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={`px-3 py-1 rounded text-sm ${
                    artifact.status === 'ready' ? 'bg-green-100 text-green-800' :
                    artifact.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {artifact.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Metadata */}
        <section className="bg-gray-100 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Evaluation Metadata</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Chapter Title</p>
              <p className="font-mono text-gray-900">{chapterTitle || manuscriptTitle || 'Untitled'}</p>
            </div>
            <div>
              <p className="text-gray-600">Manuscript Title</p>
              <p className="font-mono text-gray-900">{manuscriptTitle || chapterTitle || 'Untitled'}</p>
            </div>
            <div>
              <p className="text-gray-600">Job ID</p>
              <p className="font-mono text-gray-900">{params.jobId}</p>
            </div>
            <div>
              <p className="text-gray-600">Word Count</p>
              <p className="font-mono text-gray-900">{metrics.manuscript.word_count ? metrics.manuscript.word_count.toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600">Model</p>
              <p className="font-mono text-gray-900">{result.engine.model}</p>
            </div>
            <div>
              <p className="text-gray-600">Confidence</p>
              <p className="font-mono text-gray-900">{(governance.confidence * 100).toFixed(0)}%</p>
            </div>
            {metrics.manuscript.word_count && (
              <div>
                <p className="text-gray-600">Word Count</p>
                <p className="font-mono text-gray-900">{metrics.manuscript.word_count.toLocaleString()}</p>
              </div>
            )}
            {metrics.processing.runtime_ms && (
              <div>
                <p className="text-gray-600">Processing Time</p>
                <p className="font-mono text-gray-900">{(metrics.processing.runtime_ms / 1000).toFixed(1)}s</p>
              </div>
            )}
          </div>
          {integrityBanner?.label && (
            <div className="mt-4">
              <p className="text-gray-600 mb-2">Evaluation Status</p>
              <p className="text-sm text-gray-800">{integrityBanner.label}</p>
            </div>
          )}
        </section>

        <div className="mt-6 flex justify-end">
          <DownloadReportButton jobId={params.jobId} />
        </div>
      </div>
    </div>
  );
}
