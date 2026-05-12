// app/evaluate/[jobId]/page.tsx
// Track D: Minimal Report Surface
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { headers } from "next/headers";
import {
  CRITERIA_KEYS,
  getCriterionDisplayLabel,
  type EvaluationScope,
  type CriterionKey,
} from "@/schemas/criteria-keys";
import { EvaluationPoller } from "@/components/EvaluationPoller";
import {
  buildTopRecommendations,
  normalizeRecommendationActionForDisplay,
} from "@/lib/evaluation/reportRecommendations";
import { classifyEvaluationIntegrityBanner } from "@/lib/evaluation/warningClassification";
import {
  getCertifiedCriteriaSummary,
  getCriterionPrimaryBadge,
  getCriterionRationalePresentation,
  getCriterionSupportLabel,
  isCertifiedCriterion,
} from "@/lib/evaluation/reportCriterionDisplay";
import { resolveReportTitle } from "@/lib/evaluation/reportTitle";

type Job = {
  id: string;
  user_id: string;
  manuscripts?:
    | { user_id: string | null; title?: string | null }
    | Array<{ user_id: string | null; title?: string | null }>
    | null;
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
    score_0_10: number | null;
    status?: "NOT_APPLICABLE" | "NO_SIGNAL" | "INSUFFICIENT_SIGNAL" | "SCORABLE";
    scorability_status?: "scorable" | "scorable_low_confidence" | "non_scorable";
    confidence_score_0_100?: number;
    confidence_level?: "high" | "moderate" | "low";
    confidence_reasons?: string[];
    scorable?: boolean;
    rationale?: string;
    insufficient_signal_reason?: {
      looked_for?: string[];
      not_found?: string[];
    };
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
    manuscript?: { title?: string; word_count?: number; char_count?: number; genre?: string };
    processing?: { segment_count?: number; total_tokens_estimated?: number; runtime_ms?: number };
  };
  governance?: {
    confidence?: number;
    warnings?: string[];
    limitations?: string[];
    transparency?: {
      artifact_validation_result?: "PASS" | "HOLD" | "FAIL";
      artifact_reason_codes?: string[];
      artifact_validated_at?: string;
      artifact_validation_mode?: "log" | "enforce";
      score_ledger?: {
        raw_total: number;
        max_total: number;
        normalized_total: number;
        weighting: "equal";
      };
      excellence_filter?: {
        verdict: "submission-ready" | "close-but-not-ready" | "not-yet-ready";
        blocking_criteria: string[];
      };
    };
  };
};

async function getJob(jobId: string): Promise<Job | null> {
  try {
    const supabase = createAdminClient();

    const { data: job, error } = await supabase
      .from("evaluation_jobs")
      .select("id, user_id, job_type, status, phase, phase_status, total_units, completed_units, failed_units, created_at, updated_at, last_error, manuscripts(user_id,title)")
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

    const ownerUserId =
      (job as any)?.user_id ??
      ((job as any)?.manuscripts?.user_id ??
        (Array.isArray((job as any)?.manuscripts)
          ? (job as any).manuscripts[0]?.user_id
          : null));

    if (!ownerUserId || typeof ownerUserId !== "string") {
      console.warn(`[getJob] Ownership user_id missing for job: ${jobId}`);
      return null;
    }

    return {
      ...(job as Job),
      user_id: ownerUserId,
    };
  } catch (err) {
    console.error(`[getJob] Unexpected error:`, err);
    return null;
  }
}

function getRelatedManuscriptTitle(job: Job | null): string | null {
  if (!job?.manuscripts) return null;

  const relation = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  const title = relation?.title?.trim();

  return title && title.length > 0 ? title : null;
}


async function getCurrentOwnerId(): Promise<string | null> {
  const sessionUser = await getAuthenticatedUser();
  const headerOwnerId =
    process.env.TEST_MODE === "true" && process.env.ALLOW_HEADER_USER_ID === "true"
      ? (await headers()).get("x-user-id")?.trim() ?? null
      : null;

  return sessionUser?.id ?? headerOwnerId;
}

export async function generateMetadata({
  params,
}: {
  params: { jobId: string };
}): Promise<Metadata> {
  const ownerId = await getCurrentOwnerId();
  if (!ownerId) {
    return { title: "Evaluation Report" };
  }

  const job = await getJob(params.jobId);
  if (!job || job.user_id !== ownerId) {
    return { title: "Evaluation Report" };
  }

  const artifactResult = job.status === "complete" ? await getArtifact(params.jobId) : null;
  const chapterTitle = artifactResult?.data.metrics?.manuscript?.title?.trim() || null;
  const manuscriptTitle = getRelatedManuscriptTitle(job);
  const { pageTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });
  return { title: pageTitle };
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
      .in("artifact_type", ["evaluation_result_v2", "evaluation_result_v1"])
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

function calculateProgressPercentage(job: Pick<Job, "completed_units" | "total_units">): number {
  const completed = job.completed_units ?? 0;
  const total = job.total_units ?? 0;

  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function isCriterionKey(key: string): key is CriterionKey {
  return (CRITERIA_KEYS as readonly string[]).includes(key);
}

function isScorableCriterion(
  c: NonNullable<ArtifactContentV1["criteria"]>[number],
): boolean {
  return isCertifiedCriterion(c);
}

function criterionStatusLabel(
  c: NonNullable<ArtifactContentV1["criteria"]>[number],
): string | null {
  return getCriterionSupportLabel(c);
}

function getConfidencePresentation(
  c: NonNullable<ArtifactContentV1["criteria"]>[number],
): { label: string; classes: string } | null {
  const confidenceLevel = c.confidence_level;
  const confidenceScore = c.confidence_score_0_100;

  if (confidenceLevel === "high" || (typeof confidenceScore === "number" && confidenceScore >= 85)) {
    return {
      label: "High Confidence",
      classes: "bg-emerald-100 text-emerald-800",
    };
  }

  if (
    confidenceLevel === "moderate" ||
    (typeof confidenceScore === "number" && confidenceScore >= 60)
  ) {
    return {
      label: "Moderate Confidence",
      classes: "bg-amber-100 text-amber-800",
    };
  }

  if (
    confidenceLevel === "low" ||
    (typeof confidenceScore === "number" && confidenceScore >= 0)
  ) {
    return {
      label: "Low Confidence",
      classes: "bg-rose-100 text-rose-800",
    };
  }

  return null;
}

function inferEvaluationScope(jobType?: string, genre?: string): EvaluationScope {
  const raw = `${jobType ?? ""} ${genre ?? ""}`.toLowerCase();

  if (raw.includes("excerpt")) return "excerpt";
  if (raw.includes("chapter")) return "chapter";
  return "full_manuscript";
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
  const initialPollerJob = {
    id: job.id,
    status: job.status,
    progress: calculateProgressPercentage(job),
    created_at: job.created_at ?? new Date(0).toISOString(),
    updated_at: job.updated_at ?? new Date(0).toISOString(),
    ...(job.last_error ? { last_error: job.last_error } : {}),
  };
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
  const evaluationScope = inferEvaluationScope(job.job_type, artifact?.metrics?.manuscript?.genre);
  const integrityBanner = artifact ? classifyEvaluationIntegrityBanner(artifact) : null;
  const chapterTitle = artifact?.metrics?.manuscript?.title?.trim() || null;
  const manuscriptTitle = getRelatedManuscriptTitle(job);
  const { displayTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });
  const wordCount = artifact?.metrics?.manuscript?.word_count ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evaluation Report</h1>
          <p className="mt-1 text-lg font-semibold text-gray-900">{displayTitle}</p>
          <p className="mt-1 text-sm text-gray-500">
            Job ID: <span className="font-mono">{job.id}</span>
          </p>
          {manuscriptTitle && chapterTitle && manuscriptTitle !== chapterTitle && (
            <p className="mt-1 text-sm text-gray-500">
              Manuscript Title: <span className="font-medium text-gray-700">{manuscriptTitle}</span>
            </p>
          )}
        </div>
        <Link href="/evaluate" className="text-sm text-blue-600 hover:text-blue-700 underline shrink-0">
          Back to Evaluate
        </Link>
      </div>

      {/* Job status header card */}
      <div className="rounded-lg border bg-white p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            job.status === "complete" ? "bg-green-100 text-green-800" :
            job.status === "failed" ? "bg-red-100 text-red-800" :
            job.status === "running" ? "bg-blue-100 text-blue-800" :
            "bg-gray-100 text-gray-700"
          }`}>
            {job.status === "complete" ? "✓ Report ready" : job.status === "failed" ? "⚠ Needs attention" : job.status === "running" ? "⟳ In progress" : "Waiting in queue"}
          </span>
        </div>
      </div>

      <section className="mb-6 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Evaluation Metadata</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-gray-600">Chapter Title</p>
            <p className="font-medium text-gray-900">{chapterTitle || manuscriptTitle || "Untitled"}</p>
          </div>
          <div>
            <p className="text-gray-600">Manuscript Title</p>
            <p className="font-medium text-gray-900">{manuscriptTitle || chapterTitle || "Untitled"}</p>
          </div>
          <div>
            <p className="text-gray-600">Job ID</p>
            <p className="font-mono text-xs text-gray-900 break-all">{job.id}</p>
          </div>
          <div>
            <p className="text-gray-600">Word Count</p>
            <p className="font-medium text-gray-900">{typeof wordCount === "number" ? wordCount.toLocaleString() : "N/A"}</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <EvaluationPoller
          jobId={jobId}
          initialJob={initialPollerJob}
          redirectOnComplete={false}
          refreshOnComplete={true}
        />
      </section>

      {job.status === "failed" && job.last_error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5">
          <h2 className="text-lg font-semibold text-red-900">Evaluation failed</h2>
          <p className="mt-2 text-sm text-red-800">{job.last_error}</p>
          <div className="mt-4">
            <Link
              href="/evaluate"
              className="inline-flex rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-900"
            >
              Return to job list
            </Link>
          </div>
        </section>
      ) : !isComplete ? (
        <section className="rounded-lg border bg-white p-5">
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
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold">
            {isProduction ? "Report integrity check failed" : "Report not available yet"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isProduction
              ? "Job is marked complete but canonical evaluation artifact is missing (expected evaluation_result_v2 or legacy evaluation_result_v1). This indicates an invariant violation; please re-run evaluation from the Evaluate page."
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
            <div className="mb-4 rounded-md bg-amber-50 border border-amber-300 p-4">
              <p className="text-sm font-medium text-amber-800">
                ⚠️ Showing Phase 1 inline output. Phase 2 artifact not yet persisted.
              </p>
              <p className="mt-1 text-xs text-amber-700">
                This is an interim result from evaluation_jobs.evaluation_result, not the canonical evaluation_artifacts row.
              </p>
            </div>
          )}

          {/* ── Governance Warnings (Classified: provenance vs quality vs structural) ── */}
          {integrityBanner && (
            <div className={`mb-4 ${integrityBanner.containerClassName}`}>
              <p className={integrityBanner.titleClassName}>{integrityBanner.title}</p>
              <p className={integrityBanner.detailClassName}>{integrityBanner.message}</p>
            </div>
          )}

          <section className="rounded-lg border bg-white p-6 mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Overall Summary</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              {artifact.summary || artifact.overview?.one_paragraph_summary || "No summary available"}
            </p>
          </section>

          <section className="rounded-lg border bg-white p-6 mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Top Recommendations</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {buildTopRecommendations(artifact).map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-gray-400">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>

              {/* ── 13 Story Criteria Scores ── */}
              {orderedCriteria.length > 0 && (
                <section className="rounded-lg border bg-white p-6 mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Story Criteria Scores</h2>
                  <div className="mt-4 rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
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
                  <p className="mt-3 text-sm font-medium text-gray-700">
                    {getCertifiedCriteriaSummary(orderedCriteria)}
                  </p>
                  <div className="mt-4 space-y-4">
                    {orderedCriteria.map((c) => (
                      <div key={c.key} className="rounded-md border bg-white p-5">
                        {(() => {
                          const scorable = isScorableCriterion(c);
                          const confidence = getConfidencePresentation(c);
                          const primaryBadge = getCriterionPrimaryBadge(c);

                          return (
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-semibold text-gray-900">
                            {isCriterionKey(c.key) ? getCriterionDisplayLabel(c.key, evaluationScope) : c.key}
                          </h3>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${primaryBadge.classes}`}>
                              {primaryBadge.label}
                            </span>
                            {confidence && (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${confidence.classes}`}>
                                {confidence.label}
                              </span>
                            )}
                          </div>
                        </div>
                          );
                        })()}
                        {criterionStatusLabel(c) && (
                          <p className="mt-2 text-xs font-medium text-gray-500">{criterionStatusLabel(c)}</p>
                        )}
                        {(() => {
                          const rationalePresentation = getCriterionRationalePresentation(c, c.rationale);
                          if (!rationalePresentation) return null;

                          return (
                            <div className="mt-2 space-y-1">
                              {rationalePresentation.label && (
                                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                                  {rationalePresentation.label}
                                </p>
                              )}
                              <p className="text-sm text-gray-600">{rationalePresentation.text}</p>
                            </div>
                          );
                        })()}
                        {!isScorableCriterion(c) && c.insufficient_signal_reason && (
                          <div className="mt-2 text-xs text-gray-500 space-y-1">
                            {Array.isArray(c.insufficient_signal_reason.looked_for) && c.insufficient_signal_reason.looked_for.length > 0 && (
                              <p><span className="font-medium">Looked for:</span> {c.insufficient_signal_reason.looked_for.join(", ")}</p>
                            )}
                            {Array.isArray(c.insufficient_signal_reason.not_found) && c.insufficient_signal_reason.not_found.length > 0 && (
                              <p><span className="font-medium">Not found:</span> {c.insufficient_signal_reason.not_found.join(", ")}</p>
                            )}
                          </div>
                        )}
                        {c.recommendations && c.recommendations.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recommendations:</p>
                            <ul className="mt-2 space-y-2">
                              {c.recommendations.map((r, ri) => (
                                <li key={ri} className="text-sm text-gray-700">
                                  {normalizeRecommendationActionForDisplay(r.action)}
                                  {r.priority && (
                                    <span className={`ml-1 font-medium ${
                                      r.priority === "high" ? "text-red-600" :
                                      r.priority === "medium" ? "text-amber-600" : "text-gray-500"
                                    }`}>({r.priority})</span>
                                  )}
                                  {r.expected_impact && (
                                    <span className="ml-1 text-xs text-gray-400">— {r.expected_impact}</span>
                                  )}
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

          <section className="rounded-lg border bg-white p-6 mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Key Metrics</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Overall Score" value={formatScore(artifact.overall_score ?? artifact.overview?.overall_score_0_100 ?? 0)} />
              <Metric label="Chunks Analyzed" value={artifact.chunk_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"} />
              <Metric label="Successfully Processed" value={artifact.processed_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"} />
            </div>

            {artifact.governance?.transparency?.score_ledger && (
              <div className="mt-3 rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
                <p>
                  <span className="font-medium">Score Ledger:</span>{" "}
                  Raw {artifact.governance.transparency.score_ledger.raw_total} / {artifact.governance.transparency.score_ledger.max_total},
                  Normalized {artifact.governance.transparency.score_ledger.normalized_total} / 100,
                  Weighting {artifact.governance.transparency.score_ledger.weighting}
                </p>
              </div>
            )}

            {integrityBanner?.label && (
              <div className="mt-3 rounded-md border bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
                <p>
                  <span className="font-medium">Evaluation Status:</span>{" "}
                  {integrityBanner.label}
                </p>
              </div>
            )}

            <p className="mt-3 text-xs text-gray-500">
              Generated: {artifact.generated_at ? new Date(artifact.generated_at).toLocaleString() : "N/A"}
            </p>
          </section>

          {/* ── Evaluation Provenance ── */}
          <section className="rounded-lg border bg-white p-6 mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Evaluation Provenance</h2>
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
    </div>
  );
}
