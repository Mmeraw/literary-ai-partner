// app/evaluate/[jobId]/page.tsx
// Track D: Minimal Report Surface
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { headers } from "next/headers";
import {
  CRITERIA_KEYS,
  CRITERIA_METADATA,
  type CriterionKey,
} from "@/schemas/criteria-keys";
import { EvaluationPoller } from "@/components/EvaluationPoller";

type Job = {
  id: string;
  user_id: string;
  job_type?: string;
  status: "queued" | "running" | "failed" | "complete";
  phase?: string | null;
  phase_status?: string | null;
  total_units?: number;
  completed_units?: number;
  failed_units?: number;
  created_at?: string;
  updated_at?: string;
  last_error?: string | null;
};

type ArtifactContentV1 = {
  // Shape A: from evaluation_artifacts
  summary?: string;
  overall_score?: number;
  chunk_count?: number;
  processed_count?: number;
  generated_at?: string;
  // Shape B: from evaluation_jobs.evaluation_result (EvaluationResultV1)
  overview?: {
    verdict?: string;
    overall_score_0_100?: number;
    one_paragraph_summary?: string;
    top_3_strengths?: string[];
    top_3_risks?: string[];
  };
  criteria?: Array<{
    key: string;
    score_0_10: number;
    rationale?: string;
    recommendations?: Array<{
      action: string;
      priority?: "high" | "medium" | "low";
      expected_impact?: string;
    }>;
  }>;
  recommendations?: {
    quick_wins?: Array<{ action: string; why?: string; effort?: string; impact?: string }>;
    strategic_revisions?: Array<{ action: string; why?: string; effort?: string; impact?: string }>;
  };
  metrics?: {
    manuscript?: { word_count?: number; char_count?: number; genre?: string };
    processing?: { segment_count?: number; total_tokens_estimated?: number; runtime_ms?: number };
  };
  governance?: { confidence?: number; warnings?: string[]; limitations?: string[] };
};

async function getJob(jobId: string): Promise<Job | null> {
  try {
    const supabase = createAdminClient();

    const { data: job, error } = await supabase
      .from("evaluation_jobs")
      .select("id, user_id, job_type, status, phase, phase_status, total_units, completed_units, failed_units, created_at, updated_at, last_error")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      console.error(`[getJob] Supabase error for job ${jobId}:`, error);
      return null;
    }
    if (!job) {
      console.warn(`[getJob] Job not found in database: ${jobId}`);
      return null;
    }

    return job as Job;
  } catch (err) {
    console.error(`[getJob] Unexpected error:`, err);
    return null;
  }
}

type ArtifactResult = {
  data: ArtifactContentV1;
  source: "artifact" | "inline_job_result";
} | null;

async function getArtifact(jobId: string): Promise<ArtifactResult> {
  try {
    const supabase = createAdminClient();

    // Try evaluation_artifacts first (canonical)
    const { data: artifact, error } = await supabase
      .from("evaluation_artifacts")
      .select("id, job_id, artifact_type, content, created_at")
      .eq("job_id", jobId)
      .eq("artifact_type", "evaluation_result_v1")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && artifact?.content) {
      return { data: artifact.content as ArtifactContentV1, source: "artifact" };
    }

    // Production must fail-closed if canonical artifact is missing.
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    // Fallback: read evaluation_result from evaluation_jobs
    const { data: job, error: jobError } = await supabase
      .from("evaluation_jobs")
      .select("evaluation_result")
      .eq("id", jobId)
      .maybeSingle();

    if (!jobError && job?.evaluation_result) {
      return { data: job.evaluation_result as ArtifactContentV1, source: "inline_job_result" };
    }

    return null;
  } catch (err) {
    console.error(`[getArtifact] Unexpected error:`, err);
    return null;
  }
}

function formatScore(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "N/A";
}

function isCriterionKey(key: string): key is CriterionKey {
  return (CRITERIA_KEYS as readonly string[]).includes(key);
}

function extractTopRecommendations(summary: string): string[] {
  const lines = summary
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  const bullets = lines
    .filter(l => /^[-•*]\s+/.test(l))
    .map(l => l.replace(/^[-•*]\s+/, ""));

  if (bullets.length) return bullets.slice(0, 5);

  // Fallback: split by sentences if no bullets found
  return summary
    .split(/(?<=[.!?])\s+/)
    .slice(0, 5);
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

export default async function EvaluationReportPage({
  params,
}: {
  params: { jobId: string };
}) {
  const { jobId } = params;

  const sessionUser = await getAuthenticatedUser();
  const headerOwnerId =
    process.env.TEST_MODE === "true" && process.env.ALLOW_HEADER_USER_ID === "true"
      ? (await headers()).get("x-user-id")?.trim() ?? null
      : null;
  const ownerId = sessionUser?.id ?? headerOwnerId;

  if (!ownerId) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Evaluation Report</h1>
        <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm text-yellow-800 font-medium">Please sign in to view your evaluation report.</p>
        </div>
        <div className="mt-6">
          <Link href="/login" className="inline-block text-sm text-blue-600 hover:text-blue-700 underline">
            Go to Sign In
          </Link>
        </div>
      </main>
    );
  }

  const job = await getJob(jobId);

  if (!job || job.user_id !== ownerId) {

    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Evaluation Report</h1>
        <div className="mt-4 rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm text-yellow-800 font-medium">Unable to load evaluation</p>
          <p className="mt-2 text-sm text-yellow-700">
            {`We couldn't find job ${jobId}. It may have expired, been deleted, or is not accessible to this account.`}
          </p>
        </div>

        <div className="mt-6">
          <Link href="/evaluate" className="inline-block text-sm text-blue-600 hover:text-blue-700 underline">
            Back to Evaluate
          </Link>
        </div>
      </main>
    );
  }

  const isComplete = job.status === "complete";
  const artifactResult = isComplete ? await getArtifact(jobId) : null;
  const artifact = artifactResult?.data ?? null;
  const artifactSource = artifactResult?.source ?? null;
  const isProduction = process.env.NODE_ENV === "production";
  const artifactCriteria = artifact?.criteria ?? [];
  const criteriaByKey = new Map<CriterionKey, NonNullable<ArtifactContentV1["criteria"]>[number]>();
  for (const criterion of artifactCriteria) {
    if (criterion?.key && isCriterionKey(criterion.key)) {
      criteriaByKey.set(criterion.key, criterion);
    }
  }
  const orderedCriteria = CRITERIA_KEYS
    .map((key) => criteriaByKey.get(key))
    .filter((criterion): criterion is NonNullable<ArtifactContentV1["criteria"]>[number] => Boolean(criterion));

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Evaluation Report</h1>
          <p className="mt-1 text-sm text-gray-600">
            Job ID: <span className="font-mono">{job.id}</span>
          </p>
        </div>

        <Link href="/evaluate" className="text-sm underline">
          Back to Evaluate
        </Link>
      </div>

      <div className="mt-6 rounded-lg border p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-gray-600">Status:</span>{" "}
            <span className="font-medium">{job.status}</span>
          </div>
          <div>
            <span className="text-gray-600">Phase:</span>{" "}
            <span className="font-medium">{job.phase ?? "—"}</span>
          </div>
          <div>
            <span className="text-gray-600">Phase status:</span>{" "}
            <span className="font-medium">{job.phase_status ?? "—"}</span>
          </div>
          <div>
            <span className="text-gray-600">Progress:</span>{" "}
            <span className="font-medium">
              {(job.completed_units ?? 0)}/{(job.total_units ?? 0)}
            </span>
          </div>
        </div>

        {job.last_error ? (
          <p className="mt-3 text-sm text-red-700">
            Error: {job.last_error}
          </p>
        ) : null}
      </div>

      <section className="mt-6">
        <EvaluationPoller jobId={jobId} redirectOnComplete={false} />
      </section>

      {!isComplete ? (
        <section className="mt-6 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Report not ready yet</h2>
          <p className="mt-2 text-sm text-gray-600">
            This evaluation hasn't completed. Once the status is "complete," your
            report will appear here automatically.
          </p>
          <div className="mt-4">
            <Link
              href="/evaluate"
              className="inline-flex rounded-md border px-3 py-2 text-sm font-medium"
            >
              Return to job list
            </Link>
          </div>
        </section>
      ) : !artifact ? (
        <section className="mt-6 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">
            {isProduction ? "Report integrity check failed" : "Report not available yet"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isProduction
              ? "Job is marked complete but canonical artifact evaluation_result_v1 is missing. This indicates an invariant violation; please re-run evaluation from the Evaluate page."
              : "Job completed but no evaluation artifact was found. Phase 2 may still be persisting results. Please refresh in a moment."}
          </p>
          <div className="mt-4">
            <Link
              href="/evaluate"
              className="inline-flex rounded-md border px-3 py-2 text-sm font-medium"
            >
              {isProduction ? "Re-run evaluation" : "Return to job list"}
            </Link>
          </div>
        </section>
      ) : (
        <>
          {!isProduction && artifactSource === "inline_job_result" && (
            <div className="mt-4 rounded-md bg-amber-50 border border-amber-300 p-4">
              <p className="text-sm font-medium text-amber-800">
                ⚠️ Showing Phase 1 inline output. Phase 2 artifact not yet persisted.
              </p>
              <p className="mt-1 text-xs text-amber-700">
                This is an interim result from evaluation_jobs.evaluation_result, not the canonical evaluation_artifacts row.
              </p>
            </div>
          )}

          {/* ── Governance Warnings (Mock Detection) ── */}
          {artifact.governance?.warnings && artifact.governance.warnings.length > 0 && (
            <div className="mt-4 rounded-md bg-red-50 border-2 border-red-400 p-4">
              <p className="text-sm font-bold text-red-900">
                ⚠️ EVALUATION INTEGRITY WARNING
              </p>
              <div className="mt-2 space-y-1">
                {artifact.governance.warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-red-800 font-medium">
                    {warning}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-xs text-red-700">
                This evaluation did not use real AI analysis. Scores and recommendations are generic placeholders.
                To get a real evaluation, ensure OPENAI_API_KEY is configured in Vercel environment variables.
              </p>
            </div>
          )}

          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Overall Summary</h2>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
              {artifact.summary || artifact.overview?.one_paragraph_summary || "No summary available"}
            </pre>
          </section>

          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Top Recommendations</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
              {extractTopRecommendations(artifact.summary || artifact.overview?.one_paragraph_summary || "").map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>

              {/* ── 13 Story Criteria Scores ── */}
              {orderedCriteria.length > 0 && (
                <section className="mt-6 rounded-lg border p-5">
                  <h2 className="text-lg font-semibold">Story Criteria Scores</h2>
                  <div className="mt-3 space-y-4">
                    {orderedCriteria.map((c) => (
                      <div key={c.key} className="rounded-md border p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">
                            {isCriterionKey(c.key) ? CRITERIA_METADATA[c.key].label : c.key}
                          </h3>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            (c.score_0_10 ?? 0) >= 8 ? "bg-green-100 text-green-800" :
                            (c.score_0_10 ?? 0) >= 6 ? "bg-yellow-100 text-yellow-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {c.score_0_10 ?? "—"} / 10
                          </span>
                        </div>
                        {c.rationale && (
                          <p className="mt-2 text-sm text-gray-600">{c.rationale}</p>
                        )}
                        {c.recommendations && c.recommendations.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500">Recommendations:</p>
                            <ul className="mt-1 list-disc pl-5 text-xs text-gray-600">
                              {c.recommendations.map((r, ri) => (
                                <li key={ri}>
                                  <span className="font-medium">{r.action}</span>
                                  {r.priority && <span className={`ml-1 text-xs ${
                                    r.priority === "high" ? "text-red-600" :
                                    r.priority === "medium" ? "text-amber-600" : "text-gray-500"
                                  }`}>({r.priority})</span>}
                                  {r.expected_impact && <span className="ml-1 text-gray-400">— {r.expected_impact}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

          <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Key Metrics</h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <Metric label="Overall Score" value={formatScore(artifact.overall_score ?? artifact.overview?.overall_score_0_100 ?? 0)} />
              <Metric label="Chunks Analyzed" value={artifact.chunk_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"} />
              <Metric label="Successfully Processed" value={artifact.processed_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"} />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Generated: {artifact.generated_at ? new Date(artifact.generated_at).toLocaleString() : "N/A"}
            </p>
          </section>

          {/* ── Evaluation Provenance ── */}
          <section className="mt-6 rounded-lg border p-5 bg-gray-50">
            <h2 className="text-lg font-semibold">Evaluation Provenance</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Engine:</span>{" "}
                <span className="font-mono">{(artifact as any).engine?.model || "unknown"}</span>
              </div>
              <div>
                <span className="text-gray-600">Provider:</span>{" "}
                <span className="font-mono">{(artifact as any).engine?.provider || "unknown"}</span>
              </div>
              <div>
                <span className="text-gray-600">Prompt Version:</span>{" "}
                <span className="font-mono">{(artifact as any).engine?.prompt_version || "unknown"}</span>
              </div>
              {artifact.governance?.confidence && (
                <div>
                  <span className="text-gray-600">Confidence:</span>{" "}
                  <span className="font-medium">{(artifact.governance.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
              {artifact.governance?.limitations && artifact.governance.limitations.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-gray-500 mb-1">Limitations:</p>
                  <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                    {artifact.governance.limitations.map((limitation, i) => (
                      <li key={i}>{limitation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
