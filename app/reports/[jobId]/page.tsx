import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { EvaluationResultV1, isEvaluationResultV1, hasD2TransparencyFields } from '@/schemas/evaluation-result-v1';
import AgentTrustHeader from '@/components/reports/AgentTrustHeader';
import { scanObjectForForbiddenMarketClaims } from '@/lib/release/forbiddenMarketClaims';

// D1 Boundary: server-only. Service key must not leak to client.
// Hybrid owner-gate: SSR client for auth identity, admin client for
// privileged read scoped to (jobId + manuscript owner = auth.uid()).
// Ownership chain: evaluation_jobs.manuscript_id -> manuscripts.user_id
// TODO(gate7): migrate to full RLS once evaluation_jobs has user_id column.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
          <div className="grid md:grid-cols-2 gap-4">
            {criteria.map((criterion) => (
              <div key={criterion.key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 capitalize">
                    {criterion.key}
                  </h3>
                  <span className={`text-lg font-bold ${
                    criterion.score_0_10 >= 8 ? 'text-green-600' :
                    criterion.score_0_10 >= 6 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {criterion.score_0_10}/10
                  </span>
                </div>
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
          {governance.warnings.length > 0 && (
            <div className="mt-4">
              <p className="text-gray-600 mb-2">Warnings</p>
              <ul className="space-y-1">
                {governance.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-amber-700">{"\u26A0"} {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
