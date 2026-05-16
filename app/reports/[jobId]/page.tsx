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
import { resolveReportTitle } from '@/lib/evaluation/reportTitle';
import type { LongformDreamDocument } from '@/lib/evaluation/pipeline/runPass3bLongform';

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
 * Returns null if not yet generated (DREAM worker hasn't run yet).
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
            Generated {new Date(result.generated_at).toLocaleString()}
          </p>
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

        {/* Overview Section */}
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

        {/* Criteria Scores */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Detailed Scores</h2>
          <div className="mb-4 rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
            <p className="font-medium">Confidence Guide</p>
            <p className="mt-1">
              Confidence shows how strongly each score and summary is supported by clear examples from your submitted text.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
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
                  <p className="mb-2 text-xs font-medium text-gray-500">
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
                      <p className="text-sm text-gray-600">{rationalePresentation.text}</p>
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
                    <p className="text-sm text-gray-600">{qw.why}</p>
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
                    <p className="text-sm text-gray-600">{sr.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* DREAM Long-Form Synthesis (Pass 3b — async, long-form manuscripts only) */}
        {isLongForm && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-indigo-100">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <span aria-hidden>&#x1F4D6;</span> DREAM Analysis
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Deep Read &amp; Editorial Assessment Memo — long-form synthesis
            </p>

            {dreamDoc ? (
              <div className="space-y-8">

                {/* §1 — DREAM Score Grid + Executive Verdict */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(['quality', 'readiness', 'commercial', 'literary'] as const).map((dim) => (
                      <div key={dim} className="bg-indigo-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-indigo-600 uppercase font-semibold tracking-wide mb-1">{dim}</p>
                        <p className="text-2xl font-bold text-indigo-900">{dreamDoc.dream_scores[dim]}</p>
                        <p className="text-xs text-indigo-500">/100</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Verdict</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{dreamDoc.executive_verdict}</p>
                  </div>
                </div>

                {/* §2 — Market / Shelf Description */}
                {dreamDoc.market_shelf && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§2 — Market / Shelf</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Best shelf:</span> {dreamDoc.market_shelf.best_shelf}
                      </p>
                      {Array.isArray(dreamDoc.market_shelf.shelf_neighbors) && dreamDoc.market_shelf.shelf_neighbors.length > 0 && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Shelf neighbors:</span> {dreamDoc.market_shelf.shelf_neighbors.join(', ')}
                        </p>
                      )}
                      {Array.isArray(dreamDoc.market_shelf.comparison_space) && dreamDoc.market_shelf.comparison_space.length > 0 && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Comparison space:</span> {dreamDoc.market_shelf.comparison_space.join(', ')}
                        </p>
                      )}
                      {dreamDoc.market_shelf.marketable_hook && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Marketable hook:</span> {dreamDoc.market_shelf.marketable_hook}
                        </p>
                      )}
                      {dreamDoc.market_shelf.market_danger && (
                        <p className="text-sm text-rose-700">
                          <span className="font-medium">Market danger:</span> {dreamDoc.market_shelf.market_danger}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* §3 — What This Manuscript Should Not Become */}
                {Array.isArray(dreamDoc.what_not_to_become) && dreamDoc.what_not_to_become.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">§3 — What This Manuscript Should Not Become</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {dreamDoc.what_not_to_become.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* §4 — Structural Stack */}
                {Array.isArray(dreamDoc.structural_stack) && dreamDoc.structural_stack.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§4 — Structural Stack</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Layer</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Function</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Revision Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {dreamDoc.structural_stack.map((row, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-medium text-gray-800">{row.layer_name}</td>
                              <td className="px-3 py-2 text-gray-600">{row.function}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                  row.status === 'strong' ? 'bg-green-100 text-green-800' :
                                  row.status === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                                  row.status === 'weak' ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>{row.status}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{row.revision_note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* §5 — Arc Map */}
                {Array.isArray(dreamDoc.arc_map) && dreamDoc.arc_map.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§5 — Arc Map</h3>
                    <div className="space-y-3">
                      {dreamDoc.arc_map.map((act, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-800">{act.act_name}</span>
                            <span className="text-xs text-gray-500">{act.chapter_range}</span>
                          </div>
                          <p className="text-sm text-gray-700 mb-1">{act.primary_function}</p>
                          {act.revision_priority && (
                            <p className="text-xs text-amber-700"><span className="font-medium">Revision priority:</span> {act.revision_priority}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* §7 — Criterion-by-Criterion Analysis */}
                {Array.isArray(dreamDoc.criterion_analyses) && dreamDoc.criterion_analyses.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§7 — Criterion Analysis</h3>
                    <div className="space-y-4">
                      {dreamDoc.criterion_analyses.map((c, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-800 capitalize">{c.key.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-indigo-700">{c.score}</span>
                              <span className="text-xs text-gray-500">/ 10</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{c.confidence}</span>
                            </div>
                          </div>
                          {Array.isArray(c.fit_evidence) && c.fit_evidence.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-green-700 mb-1">Fit evidence</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {c.fit_evidence.map((e, i) => <li key={i} className="text-xs text-gray-600">{e}</li>)}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(c.gap_evidence) && c.gap_evidence.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-rose-700 mb-1">Gap evidence</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {c.gap_evidence.map((e, i) => <li key={i} className="text-xs text-gray-600">{e}</li>)}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(c.revision_queue) && c.revision_queue.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-amber-700 mb-1">Revision queue</p>
                              <ol className="list-decimal list-inside space-y-0.5">
                                {c.revision_queue.map((r, i) => <li key={i} className="text-xs text-gray-600">{r}</li>)}
                              </ol>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* §8 — Layer-by-Layer Analysis */}
                {Array.isArray(dreamDoc.layer_analyses) && dreamDoc.layer_analyses.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§8 — Layer-by-Layer Analysis</h3>
                    <div className="space-y-3">
                      {dreamDoc.layer_analyses.map((layer, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-800">{layer.layer_name}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">{layer.status}</span>
                          </div>
                          {layer.needed_revision && (
                            <p className="text-sm text-gray-700">{layer.needed_revision}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* §9 — Cross-Layer Integration */}
                {Array.isArray(dreamDoc.cross_layer_integration) && dreamDoc.cross_layer_integration.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§9 — Cross-Layer Integration</h3>
                    <div className="space-y-3">
                      {dreamDoc.cross_layer_integration.map((item, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-800">{item.motif}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                              item.integration_quality === 'strong' ? 'bg-green-100 text-green-700' :
                              item.integration_quality === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>{item.integration_quality}</span>
                          </div>
                          <p className="text-sm text-gray-700 mb-1">{item.description}</p>
                          {item.revision_note && (
                            <p className="text-xs text-amber-700">{item.revision_note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* §10 — Symbolic / Doctrine / System Audit */}
                {dreamDoc.symbolic_audit && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§10 — Symbolic / Doctrine Audit</h3>
                    <div className="space-y-3">
                      {Array.isArray(dreamDoc.symbolic_audit.preserved_symbols) && dreamDoc.symbolic_audit.preserved_symbols.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Preserved Symbols</p>
                          <div className="space-y-2">
                            {dreamDoc.symbolic_audit.preserved_symbols.map((s, i) => (
                              <div key={i} className="bg-green-50 rounded p-2">
                                <span className="font-medium text-sm text-gray-800">{s.symbol}</span>
                                <p className="text-xs text-gray-600">{s.current_function}</p>
                                {s.revision_instruction && <p className="text-xs text-amber-700">{s.revision_instruction}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(dreamDoc.symbolic_audit.doctrine_strengths) && dreamDoc.symbolic_audit.doctrine_strengths.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-green-700 mb-1">Doctrine Strengths</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {dreamDoc.symbolic_audit.doctrine_strengths.map((s, i) => <li key={i} className="text-sm text-gray-700">{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(dreamDoc.symbolic_audit.doctrine_risks) && dreamDoc.symbolic_audit.doctrine_risks.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-rose-700 mb-1">Doctrine Risks</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {dreamDoc.symbolic_audit.doctrine_risks.map((r, i) => <li key={i} className="text-sm text-gray-700">{r}</li>)}
                          </ul>
                        </div>
                      )}
                      {dreamDoc.symbolic_audit.audit_conclusion && (
                        <p className="text-sm text-gray-700 italic">{dreamDoc.symbolic_audit.audit_conclusion}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* §11 — Reader Experience */}
                {dreamDoc.reader_experience && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§11 — Reader Experience</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(['first_act', 'middle', 'final_act'] as const).map((act) => (
                        <div key={act} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-indigo-700 uppercase mb-2">{act.replace('_', ' ')}</p>
                          <p className="text-xs text-gray-700 mb-1"><span className="font-medium">Q:</span> {dreamDoc.reader_experience[act].reader_question}</p>
                          <p className="text-xs text-gray-700 mb-1"><span className="font-medium">Emotional state:</span> {dreamDoc.reader_experience[act].emotional_state}</p>
                          {dreamDoc.reader_experience[act].risk && (
                            <p className="text-xs text-rose-700"><span className="font-medium">Risk:</span> {dreamDoc.reader_experience[act].risk}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {dreamDoc.reader_experience.aftertaste && (
                      <p className="mt-3 text-sm text-gray-700 italic">
                        <span className="font-medium">Aftertaste:</span> {dreamDoc.reader_experience.aftertaste}
                      </p>
                    )}
                  </div>
                )}

                {/* §12 — Prioritized Revision Plan */}
                {Array.isArray(dreamDoc.revision_plan) && dreamDoc.revision_plan.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§12 — Revision Plan</h3>
                    <div className="space-y-4">
                      {dreamDoc.revision_plan.map((item, idx) => (
                        <div key={idx} className="border-l-4 border-indigo-300 pl-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-indigo-600 uppercase">#{item.priority}</span>
                            <span className="font-semibold text-gray-800">{item.title}</span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{item.goal}</p>
                          {Array.isArray(item.actions) && item.actions.length > 0 && (
                            <ul className="list-disc list-inside space-y-0.5 mb-2">
                              {item.actions.map((a, i) => <li key={i} className="text-xs text-gray-600">{a}</li>)}
                            </ul>
                          )}
                          {item.acceptance_check && (
                            <p className="text-xs text-green-700"><span className="font-medium">Acceptance check:</span> {item.acceptance_check}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* §13 — Releasability Assessment */}
                {Array.isArray(dreamDoc.releasability) && dreamDoc.releasability.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§13 — Releasability</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Dimension</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Current Status</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Verdict</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {dreamDoc.releasability.map((row, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-medium text-gray-800">{row.dimension}</td>
                              <td className="px-3 py-2 text-gray-600">{row.current_status}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                  row.verdict === 'Ready' ? 'bg-green-100 text-green-800' :
                                  row.verdict === 'Near-ready' ? 'bg-blue-100 text-blue-800' :
                                  row.verdict === 'Revise' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>{row.verdict}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* §14 — Acceptance Checks */}
                {dreamDoc.acceptance_checks && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§14 — Acceptance Checks</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.isArray(dreamDoc.acceptance_checks.required_detection) && dreamDoc.acceptance_checks.required_detection.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-green-700 mb-1">Required Detection</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {dreamDoc.acceptance_checks.required_detection.map((c, i) => <li key={i} className="text-xs text-gray-700">{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(dreamDoc.acceptance_checks.failure_conditions) && dreamDoc.acceptance_checks.failure_conditions.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-rose-700 mb-1">Failure Conditions</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {dreamDoc.acceptance_checks.failure_conditions.map((c, i) => <li key={i} className="text-xs text-gray-700">{c}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* §15 — Calibration Notes */}
                {Array.isArray(dreamDoc.calibration_notes) && dreamDoc.calibration_notes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">§15 — Calibration Notes</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {dreamDoc.calibration_notes.map((note, idx) => (
                        <li key={idx} className="text-sm text-gray-700">{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* §16 — Repo-Ready Summary Block */}
                {dreamDoc.repo_summary && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">§16 — Repo Summary</h3>
                    <div className="bg-indigo-50 rounded-lg p-4 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-indigo-600 uppercase font-semibold">Overall Score</p>
                          <p className="text-2xl font-bold text-indigo-900">{dreamDoc.repo_summary.overall_score}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-indigo-600 uppercase font-semibold">Readiness</p>
                          <p className="text-2xl font-bold text-indigo-900">{dreamDoc.repo_summary.readiness_score}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <p className="text-xs text-indigo-600 uppercase font-semibold">Eval Type</p>
                          <p className="text-sm font-semibold text-indigo-900">{dreamDoc.repo_summary.evaluation_type}</p>
                        </div>
                      </div>
                      {Array.isArray(dreamDoc.repo_summary.primary_strengths) && dreamDoc.repo_summary.primary_strengths.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-green-700 mb-1">Primary Strengths</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {dreamDoc.repo_summary.primary_strengths.map((s, i) => <li key={i} className="text-xs text-gray-700">{s}</li>)}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(dreamDoc.repo_summary.primary_blockers) && dreamDoc.repo_summary.primary_blockers.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-rose-700 mb-1">Primary Blockers</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {dreamDoc.repo_summary.primary_blockers.map((b, i) => <li key={i} className="text-xs text-gray-700">{b}</li>)}
                          </ul>
                        </div>
                      )}
                      {dreamDoc.repo_summary.gold_standard_requirement && (
                        <p className="text-xs text-indigo-700 italic">
                          <span className="font-medium">Gold standard requirement:</span> {dreamDoc.repo_summary.gold_standard_requirement}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Manuscript Integrity Issues (if any) */}
                {Array.isArray(dreamDoc.manuscript_integrity_issues) && dreamDoc.manuscript_integrity_issues.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Manuscript Integrity Issues</h3>
                    <div className="space-y-2">
                      {dreamDoc.manuscript_integrity_issues.map((issue, idx) => (
                        <div key={idx} className={`rounded-lg p-3 ${
                          issue.severity === 'blocking' ? 'bg-red-50 border border-red-200' :
                          issue.severity === 'major' ? 'bg-orange-50 border border-orange-200' :
                          'bg-yellow-50 border border-yellow-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold uppercase ${
                              issue.severity === 'blocking' ? 'text-red-700' :
                              issue.severity === 'major' ? 'text-orange-700' : 'text-yellow-700'
                            }`}>{issue.severity}</span>
                            <span className="text-sm font-medium text-gray-800">{issue.kind}</span>
                          </div>
                          <p className="text-sm text-gray-700">{issue.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex items-center gap-3 py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-400 border-t-transparent" aria-hidden />
                <p className="text-sm text-gray-500">
                  DREAM synthesis generating… Refresh in a minute to see the full long-form analysis.
                </p>
              </div>
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
      </div>
    </div>
  );
}
