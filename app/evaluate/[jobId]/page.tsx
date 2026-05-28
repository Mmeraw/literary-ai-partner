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
import { EvaluationPoller, type JobState } from "@/components/EvaluationPoller";
import DownloadReportButton from "@/components/reports/DownloadReportButton";
import {
  buildTopRecommendations,
  normalizeRecommendationActionForDisplay,
} from "@/lib/evaluation/reportRecommendations";
import ModeConfirmationBlock from "@/components/evaluation/ModeConfirmationBlock";
import { SynthesisPoller } from "@/components/evaluation/SynthesisPoller";
import { classifyEvaluationIntegrityBanner } from "@/lib/evaluation/warningClassification";
import {
  getCertifiedCriteriaSummary,
  getCriterionPrimaryBadge,
  getCriterionRationalePresentation,
  getCriterionSupportLabel,
  isCertifiedCriterion,
} from "@/lib/evaluation/reportCriterionDisplay";
import { resolveReportTitle } from "@/lib/evaluation/reportTitle";
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

type Job = {
  id: string;
  user_id: string;
  manuscript_id?: number;
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
  progress?: Record<string, unknown> | null;
};

type ArtifactContentV1 = {
  detected_mode?: {
    proposedEvaluationMode: "STANDARD" | "TRANSGRESSIVE" | "TESTIMONY";
    proposedVoicePreservationMode: "MAXIMUM" | "BALANCED" | "POLISHED";
    confidence: "LOW" | "MODERATE" | "HIGH";
    evidence: Array<{ signal: string; where: string }>;
    alternates?: Array<{ mode: "STANDARD" | "TRANSGRESSIVE" | "TESTIMONY"; reason: string }>;
    sectionOverrides?: Array<{
      chapterRange: [number, number];
      mode: "STANDARD" | "TRANSGRESSIVE" | "TESTIMONY";
      reason: string;
    }>;
  };
  confirmed_mode?: {
    evaluationMode: "STANDARD" | "TRANSGRESSIVE" | "TESTIMONY";
    voicePreservationMode: "MAXIMUM" | "BALANCED" | "POLISHED";
    sectionOverrides?: Array<{
      chapterRange: [number, number];
      mode: "STANDARD" | "TRANSGRESSIVE" | "TESTIMONY";
      reason: string;
    }>;
  } | null;
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
      .select("id, user_id, manuscript_id, job_type, status, phase, phase_status, total_units, completed_units, failed_units, created_at, updated_at, last_error, progress, manuscripts(user_id,title)")
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

async function getManuscriptTitleById(manuscriptId?: number): Promise<string | null> {
  if (!Number.isFinite(manuscriptId) || (manuscriptId as number) <= 0) {
    return null;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("manuscripts")
      .select("title")
      .eq("id", manuscriptId)
      .maybeSingle();

    if (error) {
      console.warn(`[getManuscriptTitleById] Failed to load manuscript ${manuscriptId}:`, error.message);
      return null;
    }

    const title = data?.title?.trim();
    return title && title.length > 0 ? title : null;
  } catch (err) {
    console.warn(`[getManuscriptTitleById] Unexpected error for manuscript ${manuscriptId}:`, err);
    return null;
  }
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
  const manuscriptTitle =
    getRelatedManuscriptTitle(job) || (await getManuscriptTitleById(job.manuscript_id));
  const { pageTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });
  return { title: pageTitle };
}

type ArtifactResult = {
  data: ArtifactContentV1;
  source: "artifact" | "inline_job_result";
} | null;

const DREAM_WORD_COUNT_THRESHOLD = 25000;

async function getDreamArtifact(jobId: string): Promise<LongformDreamDocument | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("evaluation_artifacts")
      .select("content")
      .eq("job_id", jobId)
      .eq("artifact_type", "longform_document_v1")
      .maybeSingle();
    if (error || !data?.content) return null;
    const content = data.content as { longform_document?: unknown };
    if (!content?.longform_document || typeof content.longform_document !== "object") return null;
    return content.longform_document as LongformDreamDocument;
  } catch {
    return null;
  }
}

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

  if (confidenceLevel === "high" || (typeof confidenceScore === "number" && confidenceScore >= 80)) {
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

export default async function EvaluationReportPage({
  params,
  searchParams,
}: {
  params: { jobId: string };
  searchParams?: { approved?: string };
}) {
  const { jobId } = params;
  const showApprovalBanner = searchParams?.approved === '1';

  const sessionUser = await getAuthenticatedUser();
  const headerOwnerId =
    process.env.TEST_MODE === "true" && process.env.ALLOW_HEADER_USER_ID === "true"
      ? (await headers()).get("x-user-id")?.trim() ?? null
      : null;
  const ownerId = sessionUser?.id ?? headerOwnerId;

  if (!ownerId) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Evaluation Report</h1>
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
    // Job may be mid-transition (queued after a reset) — do not say "expired".
    // Offer a reload and a return link. The poller will pick it up once it's live.
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Evaluation Report</h1>
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Job not available yet</p>
          <p className="mt-2 text-sm text-gray-600">
            This evaluation is not accessible right now. If you just submitted or resumed a job,
            it may still be initialising — wait a moment and reload.
          </p>
          <div className="mt-4 flex gap-4">
            <Link
              href={`/evaluate/${jobId}`}
              className="inline-block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100"
            >
              Reload
            </Link>
            <Link
              href="/evaluate"
              className="inline-block text-sm text-gray-500 underline hover:text-gray-700 py-1.5"
            >
              Back to Evaluate
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isComplete = job.status === "complete";
  const artifactResult = isComplete ? await getArtifact(jobId) : null;
  const artifact = artifactResult?.data ?? null;
  const artifactSource = artifactResult?.source ?? null;
  const isProduction = process.env.NODE_ENV === "production";

  // Extract manuscript_word_count + hard_fail_present from progress JSONB
  // so they can be seeded into initialPollerJob and shown in the metadata grid
  // before the artifact is available.
  const progressJsonb = job.progress ?? null;
  const chunkRoutingJsonb = progressJsonb?.chunk_routing as Record<string, unknown> | null | undefined;
  const progressWordCount: number | null =
    typeof chunkRoutingJsonb?.manuscript_words === 'number' && (chunkRoutingJsonb.manuscript_words as number) > 0
      ? (chunkRoutingJsonb.manuscript_words as number)
      : typeof chunkRoutingJsonb?.source_manuscript_words === 'number' && (chunkRoutingJsonb.source_manuscript_words as number) > 0
      ? (chunkRoutingJsonb.source_manuscript_words as number)
      : null;
  const progressHardFail: boolean | null =
    typeof progressJsonb?.hard_fail_present === 'boolean' ? (progressJsonb.hard_fail_present as boolean) : null;
  const pollerWordCount = progressWordCount ?? artifact?.metrics?.manuscript?.word_count ?? null;

  // Seed pass3_completed_at from progress JSONB so the poller can distinguish
  // interim-complete (synthesis pending) from final-complete on first render.
  const progressPass3CompletedAt: string | null = (() => {
    const raw = progressJsonb?.pass3_completed_at;
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  })();

  const initialPollerJob = {
    id: job.id,
    status: job.status,
    progress: calculateProgressPercentage(job),
    created_at: job.created_at ?? new Date(0).toISOString(),
    updated_at: job.updated_at ?? new Date(0).toISOString(),
    // Seed phase/phase_status so the poller renders the correct label
    // and percentage immediately, without waiting for the first API poll.
    ...(job.phase != null ? { phase: job.phase as JobState['phase'] } : {}),
    ...(job.phase_status != null ? { phase_status: job.phase_status as JobState['phase_status'] } : {}),
    // Seed unit counters for accurate early/late phase_1a label selection.
    ...(typeof job.total_units === 'number' ? { total_units: job.total_units } : {}),
    ...(typeof job.completed_units === 'number' ? { completed_units: job.completed_units } : {}),
    ...(job.last_error ? { last_error: job.last_error } : {}),
    // Seed review-gate quality signal and word count for immediate correct display.
    ...(progressHardFail !== null ? { hard_fail_present: progressHardFail } : {}),
    ...(pollerWordCount !== null ? { manuscript_word_count: pollerWordCount } : {}),
    // Seed synthesis completion so progress bar shows 92% (not 100%) during interim.
    ...(progressPass3CompletedAt !== null ? { pass3_completed_at: progressPass3CompletedAt } : {}),
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
  const manuscriptTitle =
    getRelatedManuscriptTitle(job) || (await getManuscriptTitleById(job.manuscript_id));
  const { displayTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });
  const wordCount = artifact?.metrics?.manuscript?.word_count ?? null;
  const isLongForm = typeof wordCount === "number" && wordCount >= DREAM_WORD_COUNT_THRESHOLD;
  const dreamDoc = isComplete && isLongForm ? await getDreamArtifact(jobId) : null;
  const hasDetectedMode = Boolean(artifact?.detected_mode);
  const hasConfirmedMode = Boolean(artifact?.confirmed_mode);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Evaluation Report</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              job.status === "complete" ? "bg-green-100 text-green-800" :
              job.status === "failed" ? "bg-red-100 text-red-800" :
              job.status === "running" ? "bg-blue-100 text-blue-800" :
              "bg-gray-100 text-gray-700"
            }`}>
              {job.status === "complete" ? "✓ Report ready" : job.status === "failed" ? "⚠ Needs attention" : job.status === "running" ? "⟳ In progress" : "Waiting in queue"}
            </span>
          </div>
          <p className="mt-1 text-lg font-semibold text-gray-900">{displayTitle}</p>
          {manuscriptTitle && chapterTitle && manuscriptTitle !== chapterTitle && (
            <p className="text-sm text-gray-600">{manuscriptTitle}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            {(() => {
              const displayCount = wordCount ?? progressWordCount;
              if (typeof displayCount === 'number') return `${displayCount.toLocaleString()} words`;
              if (isComplete) return '';
              return 'Word count: calculating…';
            })()}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isComplete && <DownloadReportButton jobId={jobId} />}
          <Link href="/evaluate" className="text-sm text-blue-600 hover:text-blue-700 underline">
            Back to Evaluate
          </Link>
        </div>
      </div>

      {showApprovalBanner && !isComplete && (
        <div
          className="mb-4 rounded-md border-l-4 p-3"
          style={{
            borderLeftColor: '#A98E4A',
            backgroundColor: '#F2EFEA',
            color: '#0E0E0E',
          }}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold" style={{ color: '#0E0E0E' }}>
            ✓ Story Ledger approved — craft diagnosis is now running.
          </p>
          <p className="mt-1 text-sm" style={{ color: '#7B7B7B' }}>
            {(() => {
              const wc = pollerWordCount ?? wordCount;
              if (typeof wc === 'number' && wc >= 30000)
                return 'For novels and novellas, this can take up to 1 hour.';
              if (typeof wc === 'number' && wc >= 10000)
                return 'For novelettes, this typically takes 15–20 minutes.';
              return 'For chapters, this typically takes 3–8 minutes.';
            })()}{' '}
            Your Diagnostic Report will appear here when complete.
          </p>
        </div>
      )}

      <section className="mt-4">
        <EvaluationPoller
          jobId={jobId}
          initialJob={initialPollerJob}
          redirectOnComplete={false}
          refreshOnComplete={true}
          redirectOnReviewGate={true}
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
        job.phase === 'review_gate' ? (
          <section
            className="rounded-lg border p-5"
            style={{
              borderColor: progressHardFail ? '#7A1E1E' : '#A98E4A',
              backgroundColor: progressHardFail ? '#1a0808' : '#0f0e0d',
            }}
          >
            <h2 className="text-lg font-semibold" style={{ color: '#F2EFEA' }}>
              {progressHardFail ? 'Story Layer Review Required' : 'Story Layer Ready for Review'}
            </h2>
            <p className="mt-2 text-sm" style={{ color: '#7B7B7B' }}>
              {progressHardFail
                ? 'The system detected narrative conflicts in the Story Layer that require your input before scoring can proceed. Review each layer, confirm or correct the findings, and submit your decisions.'
                : 'The Story Layer has been built from your manuscript. Review each of the 9 layers, confirm the findings, and approve to begin the scoring phase.'}
            </p>
            <div className="mt-4">
              <Link
                href={`/evaluate/${jobId}/ledger`}
                className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#7A1E1E', color: '#F2EFEA' }}
              >
                Review Story Ledger →
              </Link>
            </div>
          </section>
        ) : (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Report not ready yet</h2>
          <p className="mt-2 text-sm text-gray-600">
            This evaluation hasn&apos;t completed. Once the status is &quot;complete,&quot; your
            report will appear here automatically.
          </p>
          <div className="mt-4">
            <Link
              href="/evaluate"
              className="inline-flex rounded-md border border-gray-400 px-3 py-2 text-sm font-medium text-gray-900"
            >
              Return to job list
            </Link>
          </div>
        </section>
        )
      ) : !artifact ? (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">
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
              className="inline-flex rounded-md border border-gray-400 px-3 py-2 text-sm font-medium text-gray-900"
            >
              {isProduction ? "Re-run evaluation" : "Return to job list"}
            </Link>
          </div>
        </section>
      ) : (
        <>
          {hasDetectedMode && artifact?.detected_mode && (
            <ModeConfirmationBlock
              jobId={jobId}
              detectedMode={artifact.detected_mode}
              confirmedMode={artifact.confirmed_mode ?? null}
            />
          )}

          <section className="rounded-lg border bg-white p-6 mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Revise Access</h2>
            <p className="mt-2 text-sm text-gray-600">
              {hasConfirmedMode
                ? "Mode confirmed. You can proceed to Revise."
                : "Mode confirmation is required before Revise and Trustpath."}
            </p>
            <div className="mt-4">
              <Link
                href={hasConfirmedMode ? "/workbench" : "#"}
                aria-disabled={!hasConfirmedMode}
                className={`inline-flex rounded-md px-4 py-2 text-sm font-medium ${
                  hasConfirmedMode
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
                }`}
              >
                Start Revising
              </Link>
            </div>
          </section>

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
              {artifact.overview?.one_paragraph_summary || artifact.summary || "No summary available"}
            </p>
          </section>

          <section className="rounded-lg border bg-white p-6 mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Top Recommendations</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {buildTopRecommendations(artifact).map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-gray-600">•</span>
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
                    <p className="font-medium">What does Confidence mean?</p>
                    <p className="mt-1">
                      Confidence reflects how strongly each diagnosis is supported by direct evidence in your manuscript.
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
                        <span>Limited or conflicting evidence — treat as a prompt for review, not a final judgment.</span>
                      </li>
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
                          <p className="mt-2 text-xs font-medium text-gray-700">{criterionStatusLabel(c)}</p>
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
                          <div className="mt-2 text-xs text-gray-700 space-y-1">
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
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Recommendations:</p>
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
                                    <span className="ml-1 text-xs text-gray-600">— {r.expected_impact}</span>
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

          {/* Key Metrics / Evaluation Provenance removed from author-facing view.
             Internal telemetry (Engine, Provider, Chunks, Prompt Version) is not
             author-relevant. Support access with audit log will be added in a
             separate PR to allow author-controlled admin visibility. */}

          {/* ── Narrative Synthesis (long-form) ── */}
          {isLongForm && isComplete && (
            <section className="rounded-lg border border-indigo-100 bg-white p-6 mb-4">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span aria-hidden>📖</span> Narrative Synthesis
                </h2>
                <p className="text-sm text-gray-700 mt-0.5">
                  Holistic Craft Assessment — long-form synthesis report
                </p>
              </div>

              {/* SynthesisPoller handles both states:
                  - initialDreamDoc present  → renders immediately (fast path, no polling)
                  - initialDreamDoc null     → polls /api/jobs/[jobId]/artifacts every 15s,
                                               updates inline when longform_document_v1 lands
                  Isolation: the artifacts endpoint now filters by job_id + artifact_type,
                  so two concurrent evaluations from the same user cannot cross-contaminate. */}
              <SynthesisPoller
                jobId={jobId}
                wordCount={wordCount ?? 0}
                initialDreamDoc={dreamDoc}
              />
            </section>
          )}


        </>
      )}
      {isComplete && (
        <div className="mt-8 flex justify-end">
          <DownloadReportButton jobId={jobId} />
        </div>
      )}
      </main>
    </div>
  );
}
