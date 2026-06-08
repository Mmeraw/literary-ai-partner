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
import CopyReferenceIdButton from "@/components/reports/CopyReferenceIdButton";
import SupportAccessToggle from "@/components/reports/SupportAccessToggle";
import ReportConcernForm from "@/components/reports/ReportConcernForm";
import {
  buildUnifiedEvaluationDocument,
  type CanonicalEvaluationMode,
} from "@/lib/evaluation/unifiedEvaluationDocument";

import { SynthesisPoller } from "@/components/evaluation/SynthesisPoller";
import { classifyEvaluationIntegrityBanner } from "@/lib/evaluation/warningClassification";
import {
  getCertifiedCriteriaSummary,
  getCriterionPrimaryBadge,
  getCriterionRationalePresentation,
  getCriterionSupportLabel,
  isCertifiedCriterion,
} from "@/lib/evaluation/reportCriterionDisplay";
import {
  deriveGenreConfidence,
  deriveMarketReadinessConfidence,
  deriveOverallScoreConfidence,
  deriveShelfConfidence,
  getAudienceConfidence,
  getConfidenceLabelClasses,
  type CanonicalConfidenceLabel,
} from "@/lib/evaluation/confidenceFieldPolicy";
import { resolveReportTitle } from "@/lib/evaluation/reportTitle";
import { backfillManuscriptTitleIfMissing } from "@/lib/manuscripts/titleBackfill";
import { getManuscriptText } from "@/lib/manuscripts/chunks";
import CriterionOpportunities from "@/components/evaluation/CriterionOpportunities";
import EvaluationUnavailableReloadButton from "@/components/evaluation/EvaluationUnavailableReloadButton";
import PolishPassButton from "@/components/evaluation/PolishPassButton";
import { hasActiveSupportGrant, logSupportView } from "@/lib/support/checkSupportAccess";
import { canViewEvaluationOperationalDetails } from "@/lib/auth/evaluationOperationalAccess";
import { isStoryLedgerAdmin } from "@/lib/ledger/storyLedgerVisibility";
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  policy_family?: string | null;
  voice_preservation_level?: string | null;
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
      anchor_snippet?: string;
      mechanism?: string;
      specific_fix?: string;
      reader_effect?: string;
      issue_family?: string;
      strategic_lever?: string;
      revision_granularity?: string;
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
  enrichment?: {
    premise?: string;
    trigger_warnings?: string[];
    reading_grade_level?: number;
    dialogue_percentage?: number;
    narrative_percentage?: number;
    diagnosed_genre?: string;
    target_audience?: string;
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
      genre_expectation_context?: unknown;
    };
  };
};

type ShortFormResultLikeForPage = Parameters<typeof buildUnifiedEvaluationDocument>[0]['result'];

async function getJob(jobId: string): Promise<Job | null> {
  try {
    const supabase = createAdminClient();

    const { data: job, error } = await supabase
      .from("evaluation_jobs")
      .select("id, user_id, manuscript_id, job_type, status, phase, phase_status, total_units, completed_units, failed_units, created_at, updated_at, last_error, progress, policy_family, voice_preservation_level, manuscripts(user_id,title)")
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

async function getManuscriptWordCountById(manuscriptId?: number): Promise<number | null> {
  if (!Number.isFinite(manuscriptId) || (manuscriptId as number) <= 0) {
    return null;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("manuscripts")
      .select("word_count")
      .eq("id", manuscriptId)
      .maybeSingle();

    if (error) {
      console.warn(`[getManuscriptWordCountById] Failed to load manuscript ${manuscriptId}:`, error.message);
      return null;
    }

    const wordCount = data?.word_count;
    return typeof wordCount === "number" && wordCount > 0 ? wordCount : null;
  } catch (err) {
    console.warn(`[getManuscriptWordCountById] Unexpected error for manuscript ${manuscriptId}:`, err);
    return null;
  }
}

function firstWords(text: string, limit: number): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const preview = words.slice(0, limit).join(" ");
  return words.length > limit ? `${preview}…` : preview;
}

async function getSubmissionPreviewByManuscriptId(manuscriptId?: number): Promise<string | null> {
  if (!Number.isFinite(manuscriptId) || (manuscriptId as number) <= 0) {
    return null;
  }

  try {
    return firstWords(await getManuscriptText(manuscriptId as number), 200);
  } catch (err) {
    console.warn(`[getSubmissionPreviewByManuscriptId] Failed to load preview for manuscript ${manuscriptId}:`, err);
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
): { label: CanonicalConfidenceLabel; classes: string } | null {
  const confidenceLevel = c.confidence_level;
  const confidenceScore = c.confidence_score_0_100;

  let label: CanonicalConfidenceLabel | null = null;

  if (confidenceLevel === "high" || (typeof confidenceScore === "number" && confidenceScore >= 80)) {
    label = "High Confidence";
  } else if (
    confidenceLevel === "moderate" ||
    (typeof confidenceScore === "number" && confidenceScore >= 60)
  ) {
    label = "Moderate Confidence";
  } else if (
    confidenceLevel === "low" ||
    (typeof confidenceScore === "number" && confidenceScore >= 0)
  ) {
    label = "Low Confidence";
  }

  if (!label) return null;
  return { label, classes: getConfidenceLabelClasses(label) };
}

function getOverallReadinessPresentation(score: number | null): { label: string; classes: string } {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return {
      label: "Review",
      classes: "border-stone-400/50 bg-stone-200 text-stone-900 ring-1 ring-stone-400/60",
    };
  }

  if (score >= 90) {
    return {
      label: "Market Ready",
      classes: "border-emerald-500/60 bg-emerald-200 text-emerald-950 ring-1 ring-emerald-500/70",
    };
  }

  if (score >= 80) {
    return {
      label: "Near Market Ready",
      classes: "border-amber-500/60 bg-amber-200 text-amber-950 ring-1 ring-amber-500/70",
    };
  }

  return {
    label: "Not Market Ready",
    classes: "border-rose-500/60 bg-rose-200 text-rose-950 ring-1 ring-rose-500/70",
  };
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

  if (!job) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Evaluation Report</h1>
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Job not available yet</p>
          <p className="mt-2 text-sm text-gray-600">
            This evaluation is not accessible right now. If you just submitted or resumed a job,
            it may still be initialising—wait a moment and reload.
          </p>
          <div className="mt-4 flex gap-4">
            <EvaluationUnavailableReloadButton jobId={jobId} />
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

  const userRole = (sessionUser?.app_metadata as Record<string, unknown> | undefined)?.role;
  const isAdminRole = userRole === 'admin' || userRole === 'superadmin';
  const isLedgerAdmin = isStoryLedgerAdmin(sessionUser);
    const canSeeOperationalDetails = canViewEvaluationOperationalDetails(sessionUser);
  const isOwner = job.user_id === ownerId;
  const activeGrant = isAdminRole ? await hasActiveSupportGrant(jobId) : null;
  const hasSupportAccess = isAdminRole && !!activeGrant;

  if (!isOwner && !hasSupportAccess) {
    // Job may be mid-transition (queued after a reset) — do not say "expired".
    // Offer a reload and a return link. The poller will pick it up once it's live.
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Evaluation Report</h1>
        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Job not available yet</p>
          <p className="mt-2 text-sm text-gray-600">
            This evaluation is not accessible right now. If you just submitted or resumed a job,
            it may still be initialising—wait a moment and reload.
          </p>
          <div className="mt-4 flex gap-4">
            <EvaluationUnavailableReloadButton jobId={jobId} />
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

  // Support access: admin/support viewers can see technical sections only
  // when the author has granted temporary access.
  const showTechnicalSections = hasSupportAccess;

  // Log the support view if admin is viewing with an active grant
  if (showTechnicalSections && activeGrant && sessionUser) {
    await logSupportView(jobId, sessionUser.id, activeGrant.grantId);
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

  // Instant enrichment: reading grade + dialogue ratio stored in progress at submission time.
  // Falls back to artifact enrichment once evaluation completes.
  const instantReadingGrade: number | null =
    typeof progressJsonb?.enrichment_reading_grade_level === 'number'
      ? (progressJsonb.enrichment_reading_grade_level as number)
      : null;
  const instantDialoguePercentage: number | null =
    typeof progressJsonb?.enrichment_dialogue_percentage === 'number'
      ? (progressJsonb.enrichment_dialogue_percentage as number)
      : null;
  const instantNarrativePercentage: number | null =
    typeof progressJsonb?.enrichment_narrative_percentage === 'number'
      ? (progressJsonb.enrichment_narrative_percentage as number)
      : null;

  // Seed pass3_completed_at from progress JSONB so the poller can distinguish
  // interim-complete (synthesis pending) from final-complete on first render.
  // Self-healing: if pass3_completed_at is missing but longform_document_v1
  // artifact exists, use the artifact's created_at and backfill progress JSONB.
  const progressPass3CompletedAt: string | null = await (async () => {
    const raw = progressJsonb?.pass3_completed_at;
    if (typeof raw === 'string' && raw.length > 0) return raw;

    if (job.status !== 'complete') return null;
    const wordCount = pollerWordCount ?? artifact?.metrics?.manuscript?.word_count;
    if (typeof wordCount !== 'number' || wordCount < 25000) return null;

    const admin = createAdminClient();
    const { data: longformRow } = await admin
      .from('evaluation_artifacts')
      .select('created_at')
      .eq('job_id', jobId)
      .eq('artifact_type', 'longform_document_v1')
      .maybeSingle();

    if (!longformRow?.created_at) return null;

    const ts = longformRow.created_at as string;
    // Fire-and-forget: backfill progress JSONB so future polls work correctly
    admin
      .from('evaluation_jobs')
      .update({
        progress: {
          ...(typeof progressJsonb === 'object' && progressJsonb ? progressJsonb : {}),
          pass3_completed_at: ts,
          progress_high_water: 100,
        },
      })
      .eq('id', jobId)
      .then(() => {});
    return ts;
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
    ...(job.last_error && canSeeOperationalDetails ? { last_error: job.last_error } : {}),
    can_view_operational_details: canSeeOperationalDetails,
    // Seed review-gate quality signal and word count for immediate correct display.
    ...(progressHardFail !== null ? { hard_fail_present: progressHardFail } : {}),
    ...(pollerWordCount !== null ? { manuscript_word_count: pollerWordCount } : {}),
    // Seed synthesis completion so progress bar shows 92% (not 100%) during interim.
    ...(progressPass3CompletedAt !== null ? { pass3_completed_at: progressPass3CompletedAt } : {}),
    // Monotonic ratchet: seed progress_high_water so the display never regresses on page load.
    ...(typeof (progressJsonb as Record<string, unknown> | null)?.progress_high_water === 'number'
      ? { progress_high_water: (progressJsonb as Record<string, unknown>).progress_high_water as number }
      : {}),
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
  // Author name and project title are optional intake fields. They must never be
  // required to load a report/status page; jobId is the canonical access key.
  // Use progress metadata when available, with persisted manuscript/artifact title fallbacks.
  const submittedAuthorName =
    typeof progressJsonb?.submitted_author_name === "string" && progressJsonb.submitted_author_name.trim().length > 0
      ? progressJsonb.submitted_author_name.trim()
      : null;
  const submittedProjectTitle =
    typeof progressJsonb?.submitted_project_title === "string" && progressJsonb.submitted_project_title.trim().length > 0
      ? progressJsonb.submitted_project_title.trim()
      : null;

  let manuscriptTitle =
    submittedProjectTitle || getRelatedManuscriptTitle(job) || (await getManuscriptTitleById(job.manuscript_id));
  if (!manuscriptTitle && job.manuscript_id) {
    manuscriptTitle = await backfillManuscriptTitleIfMissing(job.manuscript_id);
  }
  const submissionPreview = await getSubmissionPreviewByManuscriptId(job.manuscript_id);
  const { displayTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });
  const manuscriptWordCount = await getManuscriptWordCountById(job.manuscript_id);
  const wordCount = artifact?.metrics?.manuscript?.word_count ?? manuscriptWordCount ?? null;
  const isLongForm = typeof wordCount === "number" && wordCount >= DREAM_WORD_COUNT_THRESHOLD;
  const dreamDoc = isComplete && isLongForm ? await getDreamArtifact(jobId) : null;
  const pipelineGenre = artifact?.metrics?.manuscript?.genre?.trim() || null;
  const diagnosedGenre = artifact?.enrichment?.diagnosed_genre?.trim() || null;
  const genre = diagnosedGenre ?? (pipelineGenre && pipelineGenre.toLowerCase() !== 'novel' && pipelineGenre.toLowerCase() !== 'short story' ? pipelineGenre : null) ?? 'Not specified';
  const rawTemplateMode = artifact ? (artifact as Record<string, unknown>).evaluation_mode : null;
  const canonicalMode: CanonicalEvaluationMode =
    rawTemplateMode === 'long_form_multi_layer_evaluation'
      ? 'long_form_multi_layer_evaluation'
      : isLongForm
      ? 'long_form_evaluation'
      : 'short_form_evaluation';
  const canonicalDoc = artifact
    ? buildUnifiedEvaluationDocument({
        mode: canonicalMode,
        displayTitle,
        dream: dreamDoc,
        result: {
          generated_at: artifact.generated_at,
          overview: {
            overall_score_0_100: artifact.overview?.overall_score_0_100 ?? artifact.overall_score,
            verdict: artifact.overview?.verdict,
            one_paragraph_summary: artifact.overview?.one_paragraph_summary ?? artifact.summary,
            top_3_strengths: artifact.overview?.top_3_strengths,
            top_3_risks: artifact.overview?.top_3_risks,
          },
          metrics: {
            manuscript: {
              title: displayTitle,
              word_count: wordCount ?? undefined,
              genre,
              target_audience: artifact.enrichment?.target_audience,
            },
          },
          enrichment: artifact.enrichment,
          governance: artifact.governance as ShortFormResultLikeForPage['governance'],
          criteria: artifact.criteria ?? [],
          recommendations: artifact.recommendations,
        },
      })
    : null;
  const reportPitches = canonicalDoc
    ? {
        oneParagraphPitch: canonicalDoc.oneParagraphPitch,
        oneSentencePitch: canonicalDoc.oneSentencePitch,
      }
    : null;
  const opportunitySummary = canonicalDoc?.revisionOpportunitySummary ?? null;
  const overallScore = artifact
    ? Math.round(artifact.overall_score ?? artifact.overview?.overall_score_0_100 ?? 0)
    : null;
  const verdictPresentation = getOverallReadinessPresentation(overallScore);
  const verdict = verdictPresentation.label;
  const generatedLabel = canonicalDoc?.titleBlock.dateGenerated ?? "Not available";
  const reportType = canonicalDoc?.titleBlock.reportType ?? (isLongForm ? "Long-Form Evaluation" : "Short-Form Evaluation");
  const displayWordCount = wordCount ?? progressWordCount;
  const estimatedPages = typeof displayWordCount === "number" ? Math.ceil(displayWordCount / 250) : null;
  const targetAudience = canonicalDoc?.titleBlock.targetAudience ?? 'Not available';
  const readinessCriterion = orderedCriteria.find((criterion) => {
    const key = criterion.key.toLowerCase();
    const label = isCriterionKey(criterion.key) ? getCriterionDisplayLabel(criterion.key, evaluationScope).toLowerCase() : key;
    return key.includes("readiness") || key.includes("market") || label.includes("readiness") || label.includes("market");
  });

  // Confidence labels for interpretive header fields (policy: confidenceFieldPolicy.ts)
  // Each field derives confidence from its OWN evidence signal — no shared source.
  const governanceConfidence01 = typeof artifact?.governance?.confidence === "number"
    ? artifact.governance.confidence
    : null;
  const scorableCriteriaCount = orderedCriteria.filter((c) => isCertifiedCriterion(c)).length;
  const totalCriteriaCount = orderedCriteria.length;

  const genreConfidenceLabel = deriveGenreConfidence(displayWordCount);
  const marketReadinessConfidenceLabel = deriveMarketReadinessConfidence(scorableCriteriaCount, totalCriteriaCount);
  const overallScoreConfidenceLabel = deriveOverallScoreConfidence(scorableCriteriaCount, totalCriteriaCount, governanceConfidence01);
  const audienceConfidence = getAudienceConfidence(displayWordCount);
  const shelfConfidenceLabel = canonicalDoc?.titleBlock.shelf
    ? canonicalDoc.titleBlock.shelfConfidenceLabel ?? deriveShelfConfidence({
        wordCount: displayWordCount,
        hasShelf: canonicalDoc.titleBlock.shelf !== 'Not available',
      })
    : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F6F1' }}>
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 rounded-xl border border-stone-300 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8A6A1F]">Evaluation Report</p>
            <h1 className="mt-2 font-rg-serif text-3xl font-bold leading-tight text-stone-950 sm:text-4xl">{displayTitle}</h1>
            {manuscriptTitle && chapterTitle && manuscriptTitle !== chapterTitle && (
              <p className="mt-2 text-base font-medium text-stone-700">{manuscriptTitle}</p>
            )}
            <p className="mt-2 text-sm text-stone-500">
              <span className="font-medium text-stone-700">Reference ID:</span>{' '}
              <span className="font-mono text-stone-900">{jobId}</span>{' '}
              <CopyReferenceIdButton
                value={jobId}
                className="ml-2 inline-flex items-center rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
              />
            </p>
            {(submittedAuthorName || manuscriptTitle || submissionPreview) && (
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="font-semibold text-stone-950">Author Name</dt>
                  <dd className="text-stone-700">{submittedAuthorName ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-950">Project Title</dt>
                  <dd className="text-stone-700">{submittedProjectTitle ?? manuscriptTitle ?? "Not provided"}</dd>
                </div>
                {submissionPreview && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="font-semibold text-stone-950">Submission Preview</dt>
                    <dd className="mt-1 max-w-4xl rounded-lg border border-stone-200 bg-stone-50 p-3 text-stone-700">
                      {submissionPreview}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="font-semibold text-stone-950">Report Type</dt><dd className="text-stone-700">{reportType}</dd></div>
              <div>
                <dt className="font-semibold text-stone-950">Genre</dt>
                <dd className="capitalize text-stone-700">
                  <span>{genre}</span>
                  {genreConfidenceLabel && (
                    <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getConfidenceLabelClasses(genreConfidenceLabel)}`}>
                      {genreConfidenceLabel}
                    </span>
                  )}
                </dd>
              </div>
              {canonicalDoc?.titleBlock.shelf && (
                <div>
                  <dt className="font-semibold text-stone-950">Shelf</dt>
                  <dd className="text-stone-700">
                    {canonicalDoc.titleBlock.shelf}
                    {shelfConfidenceLabel && (
                      <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getConfidenceLabelClasses(shelfConfidenceLabel)}`}>
                        {shelfConfidenceLabel}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {canonicalDoc?.titleBlock.genreExpectationContract && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="font-semibold text-stone-950">Genre Contract</dt>
                  <dd className="text-stone-700">
                    {canonicalDoc.titleBlock.genreExpectationContract.contractSummary}
                    <span className="ml-2 text-stone-500">
                      ({canonicalDoc.titleBlock.genreExpectationContract.expectationProfiles.join(', ')})
                    </span>
                  </dd>
                </div>
              )}
              <div><dt className="font-semibold text-stone-950">Submitted Word Count</dt><dd className="text-stone-700">{canonicalDoc?.titleBlock.submittedWordCount ?? (typeof displayWordCount === 'number' ? displayWordCount.toLocaleString() : 'Calculating')}</dd></div>
              <div><dt className="font-semibold text-stone-950">Estimated Manuscript Pages</dt><dd className="text-stone-700">{canonicalDoc?.titleBlock.estimatedPages ?? (estimatedPages ? `${estimatedPages.toLocaleString()} at 250 words/page` : 'Not available')}</dd></div>
              <div><dt className="font-semibold text-stone-950">Reading Grade Level</dt><dd className="text-stone-700">{canonicalDoc?.titleBlock.readingGradeLevel ?? ((artifact?.enrichment?.reading_grade_level ?? instantReadingGrade) != null ? `${Math.floor(Number(artifact?.enrichment?.reading_grade_level ?? instantReadingGrade))} (Flesch-Kincaid)` : 'Not available')}</dd></div>
              <div><dt className="font-semibold text-stone-950">Dialogue/Narrative Ratio</dt><dd className="text-stone-700">{canonicalDoc?.titleBlock.dialogueNarrativeRatio ?? ((artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage) != null ? `${Math.floor(Number(artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage))}% dialogue / ${Math.floor(Number(artifact?.enrichment?.narrative_percentage ?? instantNarrativePercentage ?? 100 - (artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage ?? 0)))}% narrative` : 'Not available')}</dd></div>
              <div>
                <dt className="font-semibold text-stone-950">Market Readiness</dt>
                <dd className="text-stone-700">
                  <span>{verdict}</span>
                  {marketReadinessConfidenceLabel && (
                    <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getConfidenceLabelClasses(marketReadinessConfidenceLabel)}`}>
                      {marketReadinessConfidenceLabel}
                    </span>
                  )}
                </dd>
              </div>
              <div><dt className="font-semibold text-stone-950">Date Generated</dt><dd className="text-stone-700">{generatedLabel}</dd></div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="font-semibold text-stone-950">Target Audience</dt>
                <dd className="text-stone-700">
                  {audienceConfidence.tentative && (
                    <span className="mr-1 text-stone-500 italic">Tentative:</span>
                  )}
                  <span>{targetAudience}</span>
                  <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getConfidenceLabelClasses(audienceConfidence.label)}`}>
                    {audienceConfidence.label}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <aside className="grid w-full shrink-0 gap-4 lg:w-72">
            {isComplete && (
              <div className="rounded-lg border border-[#B8922A]/45 bg-[#1C1814] p-5 text-[#F5EFE0]">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#C8A96E]">Overall Score</p>
                <p className="mt-3 font-rg-serif text-5xl font-bold leading-none text-white">{overallScore !== null ? overallScore : 'N/A'}<span className="text-2xl text-[#C8A96E]">/100</span></p>
                <p className={`mt-3 inline-flex rounded-full border px-3 py-1 text-base font-semibold uppercase tracking-wide ${verdictPresentation.classes}`}>{verdict}</p>
                {overallScoreConfidenceLabel && (
                  <p className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getConfidenceLabelClasses(overallScoreConfidenceLabel)}`}>
                    {overallScoreConfidenceLabel}
                  </p>
                )}
              </div>
            )}

            {!isComplete && (
              <Link href="/evaluate" className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-base font-medium text-stone-700 hover:bg-stone-50">
                Back to Evaluate
              </Link>
            )}
          </aside>
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
            {isLedgerAdmin
              ? '✓ Story Ledger approved—building your report is now running.'
              : '✓ Analysis in progress—building your report now.'}
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

      <section className="mt-3">
        <EvaluationPoller
          jobId={jobId}
          initialJob={initialPollerJob}
          redirectOnComplete={false}
          refreshOnComplete={true}
          redirectOnReviewGate={isLedgerAdmin}
        />
      </section>

      {job.status === "failed" ? null : !isComplete ? (
        job.phase === 'review_gate' && isLedgerAdmin ? (
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
        <section className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <h2 className="font-rg-serif text-base font-semibold text-stone-900">Report not ready yet</h2>
          <p className="mt-1 text-sm text-stone-600">
            Once the status is &quot;complete,&quot; your report will appear here automatically.
          </p>
          <div className="mt-2 flex gap-3">
            <Link
              href="/evaluate"
              className="inline-flex rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 shadow-sm transition-colors hover:bg-stone-50"
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
              : "Job completed but no evaluation artifact was found. Processing may still be finalizing results. Please refresh in a moment."}
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
          {/* Mode settings are now chosen at submission time — display read-only summary */}
          {job.policy_family && (
            <section className="rounded-lg border bg-white p-4 mb-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-700">
                <span>
                  <span className="font-semibold text-gray-900">Evaluation Mode:</span>{" "}
                  {job.policy_family === "transgressive" ? "Transgressive" : job.policy_family === "testimony" ? "Testimony" : "Standard"}
                </span>
                <span>
                  <span className="font-semibold text-gray-900">Voice Preservation:</span>{" "}
                  {(job.voice_preservation_level ?? "balanced").charAt(0).toUpperCase() + (job.voice_preservation_level ?? "balanced").slice(1)}
                </span>
              </div>
            </section>
          )}

          <section className="rounded-lg border bg-white p-6 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Revise</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Open the revision workbench to review and repair opportunities.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/evaluate" className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                  Back to Evaluate
                </Link>
                <DownloadReportButton jobId={jobId} />
                <Link
                  href={`/workbench-v2?manuscriptId=${job.manuscript_id}&evaluationJobId=${jobId}`}
                  className="inline-flex rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Revise
                </Link>
              </div>
            </div>
          </section>

          {!isProduction && artifactSource === "inline_job_result" && (
            <div className="mb-4 rounded-md bg-amber-50 border border-amber-300 p-4">
              <p className="text-sm font-medium text-amber-800">
                ⚠️ Showing interim inline output. Final report artifact not yet persisted.
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

          {/* ── §2 One-Paragraph Pitch ── */}
          {reportPitches && (
            <section className="rounded-lg border bg-white p-7 mb-7">
              <h2 className="text-2xl font-semibold text-gray-900">One-Paragraph Pitch</h2>
              <p className="mt-4 text-base leading-7 text-gray-800">
                {reportPitches.oneParagraphPitch}
              </p>
            </section>
          )}

          {/* ── §3 One-Sentence Pitch ── */}
          {reportPitches && (
            <section className="rounded-lg border bg-white p-7 mb-7">
              <h2 className="text-2xl font-semibold text-gray-900">One-Sentence Pitch</h2>
              <p className="mt-4 text-base font-medium leading-7 text-gray-900">
                {reportPitches.oneSentencePitch}
              </p>
            </section>
          )}

          {/* ── §4 Premise ── */}
          {canonicalDoc?.premise && (
            <section className="rounded-lg border bg-white p-7 mb-7">
              <h2 className="text-2xl font-semibold text-gray-900">Premise</h2>
              <p className="mt-4 text-base leading-7 text-gray-800">
                {canonicalDoc.premise}
              </p>
            </section>
          )}

          {/* ── §5 Content Warnings ── */}
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 mb-7">
            <h2 className="text-xl font-semibold text-amber-900">Content Warnings</h2>
            {canonicalDoc && canonicalDoc.contentWarnings.length > 0 ? (
              <ul className="mt-4 list-none space-y-3 pl-0 text-base text-amber-900">
                {canonicalDoc.contentWarnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 shrink-0">⚠️</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-base text-amber-800">No content warnings identified.</p>
            )}
            <p className="mt-4 text-base text-amber-800">
              Consider including content warnings in book marketing or front matter.
            </p>
          </section>

          {/* ── §6 Revision Opportunity Summary ── */}
          {opportunitySummary && (
            <section className="rounded-lg border bg-white p-7 mb-7">
              <h2 className="text-2xl font-semibold text-gray-900">Revision Opportunity Summary</h2>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-md border bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="mt-2 text-3xl font-bold text-gray-950">{opportunitySummary.total}</p>
                </div>
                <div className="rounded-md border bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-700">High Priority</p>
                  <p className="mt-2 text-3xl font-bold text-red-900">{opportunitySummary.high}</p>
                </div>
                <div className="rounded-md border bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-700">Medium Priority</p>
                  <p className="mt-2 text-3xl font-bold text-amber-900">{opportunitySummary.medium}</p>
                </div>
                <div className="rounded-md border bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-600">Low Priority</p>
                  <p className="mt-2 text-3xl font-bold text-gray-950">{opportunitySummary.low}</p>
                </div>
              </div>
              <p className="mt-4 text-base leading-7 text-gray-700">
                Priority labels indicate the recommended urgency of each revision opportunity.
              </p>
            </section>
          )}

          {/* ── §7 Executive Summary ── */}
          <section className="rounded-lg border bg-white p-7 mb-7">
            <h2 className="text-2xl font-semibold text-gray-900">Executive Summary</h2>
            <p className="mt-4 text-base leading-7 text-gray-800">
              {canonicalDoc?.executiveSummary ?? "No summary available"}
            </p>
          </section>

          {/* ── §8 Top Strengths ── */}
          {canonicalDoc && canonicalDoc.topStrengths.length > 0 && (
            <section className="rounded-lg border bg-white p-7 mb-7">
              <h2 className="text-2xl font-semibold text-gray-900">Top Strengths</h2>
              <ul className="mt-5 list-none space-y-4 pl-0 text-base leading-7 text-gray-800">
                {canonicalDoc.topStrengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-gray-600">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── §9 Top Risks ── */}
          {canonicalDoc && canonicalDoc.topRisks.length > 0 && (
            <section className="rounded-lg border bg-white p-7 mb-7">
              <h2 className="text-2xl font-semibold text-gray-900">Top Risks</h2>
              <ul className="mt-5 list-none space-y-4 pl-0 text-base leading-7 text-gray-800">
                {canonicalDoc.topRisks.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-gray-600">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── §10 Top Recommendations ── */}
          <section className="rounded-lg border bg-white p-7 mb-7">
            <h2 className="text-2xl font-semibold text-gray-900">Top Recommendations</h2>
            {canonicalDoc && canonicalDoc.topRecommendations.length > 0 ? (
              <ul className="mt-5 list-none space-y-4 pl-0 text-base leading-7 text-gray-800">
                {canonicalDoc.topRecommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 shrink-0 text-gray-600">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-base leading-7 text-gray-600">See per-criterion opportunities below for detailed revision guidance.</p>
            )}
          </section>

              {/* ── 13 Story Criteria Scores ── */}
              {orderedCriteria.length > 0 && (
                <section className="rounded-lg border bg-white p-7 mb-7">
                  <h2 className="text-2xl font-semibold text-gray-900">13 Criteria Score Grid</h2>
                  <p className="mt-5 text-base font-medium leading-7 text-gray-800">
                    {getCertifiedCriteriaSummary(orderedCriteria)}
                  </p>
                  <div className="mt-6 space-y-6">
                    {orderedCriteria.map((c) => (
                      <div key={c.key} className="rounded-md border bg-white p-6">
                        {(() => {
                          const scorable = isScorableCriterion(c);
                          const confidence = getConfidencePresentation(c);
                          const primaryBadge = getCriterionPrimaryBadge(c);

                          return (
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-xl font-semibold text-gray-900">
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
                          <p className="mt-3 text-base font-medium text-gray-800">{criterionStatusLabel(c)}</p>
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
                              <p className="text-base leading-7 text-gray-800">{rationalePresentation.text}</p>
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
                          <CriterionOpportunities recommendations={c.recommendations} />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

          {/* Technical sections — only visible to admin/support with active author grant */}
          {showTechnicalSections && artifact && (
            <>
              <section className="rounded-lg border border-amber-200 bg-amber-50/30 p-6 mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  Key Metrics
                  <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Support view</span>
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-gray-600">Overall Score</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      {Number.isFinite(artifact.overall_score ?? artifact.overview?.overall_score_0_100 ?? 0)
                        ? String(Math.round(artifact.overall_score ?? artifact.overview?.overall_score_0_100 ?? 0))
                        : "N/A"}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-gray-600">Chunks Analyzed</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      {artifact.chunk_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-gray-600">Successfully Processed</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      {artifact.processed_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-700">
                  Generated: {artifact.generated_at ? new Date(artifact.generated_at).toLocaleString() : "N/A"}
                </p>
              </section>

              <section className="rounded-lg border border-amber-200 bg-amber-50/30 p-6 mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  Evaluation Provenance
                  <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Support view</span>
                </h2>
                <div className="mt-3 space-y-2 text-sm">
                  <div>
                    <span className="text-gray-700 font-medium">Engine:</span>{" "}
                    <span className="font-mono text-gray-900">{(artifact as Record<string, unknown> & { engine?: { model?: string } }).engine?.model || "unknown"}</span>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Provider:</span>{" "}
                    <span className="font-mono text-gray-900">{(artifact as Record<string, unknown> & { engine?: { provider?: string } }).engine?.provider || "unknown"}</span>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">Prompt Version:</span>{" "}
                    <span className="font-mono text-gray-900">{(artifact as Record<string, unknown> & { engine?: { prompt_version?: string } }).engine?.prompt_version || "unknown"}</span>
                  </div>
                  {artifact.governance?.confidence != null && (
                    <div>
                      <span className="text-gray-700 font-medium">Confidence:</span>{" "}
                      <span className="font-medium">{Math.round(artifact.governance.confidence * 100)}%</span>
                    </div>
                  )}
                  {artifact.governance?.limitations && artifact.governance.limitations.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-gray-700 mb-1">Limitations:</p>
                      <ul className="list-none pl-0 text-xs text-gray-800 space-y-1">
                        {artifact.governance.limitations.map((limitation: string, i: number) => (
                          <li key={i} className="flex gap-1.5">
                            <span className="shrink-0 text-gray-600">•</span>
                            <span>{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ── §13 Narrative Synthesis (long-form only) ── */}
          {isLongForm && isComplete && (
            <section className="rounded-lg border border-indigo-100 bg-white p-6 mb-4">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span aria-hidden>📖</span> {dreamDoc ? 'Narrative Synthesis' : 'Generating narrative synthesis'}
                </h2>
                <p className="text-sm text-gray-700 mt-0.5">
                  Holistic craft assessment—long-form narrative synthesis
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

          {/* ── §14 Confidence Explanation ── */}
          <section className="rounded-lg border bg-white p-7 mb-7">
            <h2 className="text-2xl font-semibold text-gray-900">Confidence Explanation</h2>
            <p className="mt-4 text-base leading-7 text-gray-800">
              Confidence reflects how strongly each diagnosis is supported by direct evidence in your manuscript.
            </p>
            <ul className="mt-4 list-none space-y-3 pl-0 text-base leading-7 text-gray-800">
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
          </section>

          {/* ── §15 Author-facing Disclaimer ── */}
          <section className="rounded-lg border border-stone-200 bg-stone-50 p-6 mt-8">
            <h2 className="text-2xl font-semibold text-gray-900">Author-Facing Disclaimer</h2>
            <p className="text-sm leading-relaxed text-stone-600">
              Generated by RevisionGrade™. Author retains ownership of manuscript content.
              This report is an editorial diagnostic and does not guarantee publication,
              representation, or commercial outcome.
            </p>
          </section>

        </>
      )}
      {isComplete && (
        <div className="mt-8 space-y-4">
          {isOwner && (
            <section className="rounded-lg border border-[#B8922A]/30 bg-[#B8922A]/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Surface Polish</h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Scan for grammar, passive voice, adverb density, punctuation, and repetition — free, voice-preserving.
                  </p>
                </div>
                <PolishPassButton jobId={jobId} />
              </div>
            </section>
          )}
          {isOwner && (
            <div className="space-y-3">
              <SupportAccessToggle jobId={jobId} />
              <ReportConcernForm jobId={jobId} page="evaluation-report" />
            </div>
          )}
          <div className="flex justify-end">
            <DownloadReportButton jobId={jobId} />
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
