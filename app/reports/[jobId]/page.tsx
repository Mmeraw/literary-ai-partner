import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
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
  getCriterionSupportLabel,
} from '@/lib/evaluation/reportCriterionDisplay';

// D1 Boundary: server-only. Service key must not leak to client.
// Hybrid owner-gate: SSR client for auth identity, admin client for
// privileged read scoped to (jobId + manuscript owner = auth.uid()).
// Ownership chain: evaluation_jobs.manuscript_id -> manuscripts.user_id
// TODO(gate7): migrate to full RLS once evaluation_jobs has user_id column.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

async function getEvaluationResult(jobId: string, userId: string): Promise<EvaluationResultV1 | null> {
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
      manuscripts!inner(user_id)
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

  return result;
}

export default async function ReportPage({ params }: { params: { jobId: string } }) {
  // Step 1: Get authenticated user via cookie-scoped SSR client
  const ssrSupabase = await createSSRClient();
  const { data: { user } } = await ssrSupabase.auth.getUser();

  if (!user) {
    notFound(); // Unauthenticated users see 404, not a login redirect
  }

  // Step 2: Owner-gated privileged read
  const result = await getEvaluationResult(params.jobId, user.id);

  if (!result) {
    notFound();
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
            {overview.one_paragraph_summary}
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
                <p className="text-sm text-gray-600">
                  {criterion.rationale}
                </p>
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
