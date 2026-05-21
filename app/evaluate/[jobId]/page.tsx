// app/evaluate/[jobId]/page.tsx
// Track D: Minimal Report Surface — dark token redesign
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

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  ink:          '#0D0A05',
  surface:      '#12100B',
  surfaceRaised:'#1C160E',
  ink3:         '#261A0A',
  cream:        '#F5EFE0',
  cream2:       '#C8BEA8',
  gold:         '#C8A96E',
  goldMute:     '#a8893b',
  border:       'rgba(216,209,192,0.14)',
  borderStrong: 'rgba(216,209,192,0.28)',
  dim:          '#6B6560',
  red:          '#7A2B1A',
  success:      '#7FA36B',
  danger:       '#A7472A',
  fontDisplay:  "'Instrument Serif', Georgia, serif",
  fontBody:     "'Switzer', system-ui, sans-serif",
};

// ── Types ────────────────────────────────────────────────────────────────────
type Job = {
  id: string;
  user_id: string;
  manuscript_id?: number;
  manuscripts?:
    | { user_id: string | null; title?: string | null; word_count?: number | null }
    | Array<{ user_id: string | null; title?: string | null; word_count?: number | null }>
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
  summary?: string;
  overall_score?: number;
  chunk_count?: number;
  processed_count?: number;
  generated_at?: string;
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
    warnings?: string[]
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

// ── Data helpers ─────────────────────────────────────────────────────────────
async function getJob(jobId: string): Promise<Job | null> {
  try {
    const supabase = createAdminClient();
    const { data: job, error } = await supabase
      .from("evaluation_jobs")
      .select("id, user_id, manuscript_id, job_type, status, phase, phase_status, total_units, completed_units, failed_units, created_at, updated_at, last_error, manuscripts(user_id,title,word_count)")
      .eq("id", jobId)
      .maybeSingle();

    if (error) { console.error(`[getJob] Supabase error for job ${jobId}:`, error); return null; }
    if (!job) { console.warn(`[getJob] Job not found in database: ${jobId}`); return null; }

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

    return { ...(job as Job), user_id: ownerUserId };
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
  if (!Number.isFinite(manuscriptId) || (manuscriptId as number) <= 0) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("manuscripts").select("title").eq("id", manuscriptId).maybeSingle();
    if (error) { console.warn(`[getManuscriptTitleById] Failed:`, error.message); return null; }
    const title = data?.title?.trim();
    return title && title.length > 0 ? title : null;
  } catch (err) {
    console.warn(`[getManuscriptTitleById] Unexpected error:`, err);
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
  if (!ownerId) return { title: "Evaluation Report" };

  const job = await getJob(params.jobId);
  if (!job || job.user_id !== ownerId) return { title: "Evaluation Report" };

  const artifactResult = job.status === "complete" ? await getArtifact(params.jobId) : null;
  const chapterTitle = artifactResult?.data.metrics?.manuscript?.title?.trim() || null;
  const manuscriptTitle =
    getRelatedManuscriptTitle(job) || (await getManuscriptTitleById(job.manuscript_id));
  const { pageTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });
  return { title: pageTitle };
}

type ArtifactResult = { data: ArtifactContentV1; source: "artifact" | "inline_job_result" } | null;

const DREAM_WORD_COUNT_THRESHOLD = 25000;

async function getDreamArtifact(jobId: string): Promise<LongformDreamDocument | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("evaluation_artifacts").select("content")
      .eq("job_id", jobId).eq("artifact_type", "longform_document_v1").maybeSingle();
    if (error || !data?.content) return null;
    const content = data.content as { longform_document?: unknown };
    if (!content?.longform_document || typeof content.longform_document !== "object") return null;
    return content.longform_document as LongformDreamDocument;
  } catch { return null; }
}

async function getArtifact(jobId: string): Promise<ArtifactResult> {
  try {
    const supabase = createAdminClient();
    const { data: artifact, error } = await supabase
      .from("evaluation_artifacts")
      .select("id, job_id, artifact_type, content, created_at")
      .eq("job_id", jobId)
      .in("artifact_type", ["evaluation_result_v2", "evaluation_result_v1"])
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    if (!error && artifact?.content) {
      return { data: artifact.content as ArtifactContentV1, source: "artifact" };
    }

    if (process.env.NODE_ENV === "production") return null;

    const { data: job, error: jobError } = await supabase
      .from("evaluation_jobs").select("evaluation_result").eq("id", jobId).maybeSingle();

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
): { label: string; style: React.CSSProperties } | null {
  const confidenceLevel = c.confidence_level;
  const confidenceScore = c.confidence_score_0_100;

  if (confidenceLevel === "high" || (typeof confidenceScore === "number" && confidenceScore >= 80)) {
    return {
      label: "High Confidence",
      style: { background: 'rgba(127,163,107,0.14)', color: '#7FA36B', border: '1px solid rgba(127,163,107,0.3)' },
    };
  }
  if (confidenceLevel === "moderate" || (typeof confidenceScore === "number" && confidenceScore >= 60)) {
    return {
      label: "Moderate Confidence",
      style: { background: 'rgba(200,169,110,0.12)', color: T.gold, border: `1px solid rgba(200,169,110,0.3)` },
    };
  }
  if (confidenceLevel === "low" || (typeof confidenceScore === "number" && confidenceScore >= 0)) {
    return {
      label: "Low Confidence",
      style: { background: 'rgba(167,71,42,0.14)', color: '#e07a5f', border: '1px solid rgba(167,71,42,0.35)' },
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

// ── Sub-components ────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl mb-4 ${className}`}
      style={{ background: T.surfaceRaised, border: `1px solid ${T.border}` }}
    >
      {children}
    </div>
  );
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-6">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xl font-semibold mb-3"
      style={{ color: T.cream, fontFamily: T.fontDisplay }}
    >
      {children}
    </h2>
  );
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: T.dim }}>
      {children}
    </p>
  );
}

function MetaValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium" style={{ color: T.cream }}>
      {children}
    </p>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: '#12100B', border: `1px solid ${T.border}` }}
    >
      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: T.dim }}>{label}</p>
      <p className="text-lg font-semibold" style={{ color: T.cream }}>{value}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
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

  const pageWrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: T.ink, fontFamily: T.fontBody }}>
      <main style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {children}
      </main>
    </div>
  );

  if (!ownerId) {
    return pageWrap(
      <>
        <h1 style={{ fontFamily: T.fontDisplay, color: T.cream, fontSize: '2rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          Evaluation Report
        </h1>
        <Card>
          <CardBody>
            <p style={{ color: T.gold, fontSize: '0.875rem' }}>Please sign in to view your evaluation report.</p>
            <Link
              href="/login"
              style={{ display: 'inline-block', marginTop: '1rem', fontSize: '0.875rem', color: T.gold, textDecoration: 'underline' }}
            >
              Go to Sign In
            </Link>
          </CardBody>
        </Card>
      </>
    );
  }

  const job = await getJob(jobId);

  if (!job || job.user_id !== ownerId) {
    return pageWrap(
      <>
        <h1 style={{ fontFamily: T.fontDisplay, color: T.cream, fontSize: '2rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          Evaluation Report
        </h1>
        <Card>
          <CardBody>
            <p style={{ color: T.gold, fontSize: '0.875rem', fontWeight: 600 }}>Unable to load evaluation</p>
            <p style={{ color: T.cream2, fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {`We couldn't find job ${jobId}. It may have expired, been deleted, or is not accessible to this account.`}
            </p>
            <Link
              href="/evaluate"
              style={{ display: 'inline-block', marginTop: '1rem', fontSize: '0.875rem', color: T.gold, textDecoration: 'underline' }}
            >
              Back to Evaluate
            </Link>
          </CardBody>
        </Card>
      </>
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
  const manuscriptTitle =
    getRelatedManuscriptTitle(job) || (await getManuscriptTitleById(job.manuscript_id));
  const { displayTitle } = resolveReportTitle({ chapterTitle, manuscriptTitle });
  const wordCount = artifact?.metrics?.manuscript?.word_count ?? null;
  const isLongForm = typeof wordCount === "number" && wordCount >= DREAM_WORD_COUNT_THRESHOLD;
  const dreamDoc = isComplete && isLongForm ? await getDreamArtifact(jobId) : null;
  const hasDetectedMode = Boolean(artifact?.detected_mode);
  const hasConfirmedMode = Boolean(artifact?.confirmed_mode);

  return pageWrap(
    <>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.gold, marginBottom: '0.35rem', fontFamily: T.fontBody }}>
            Evaluation Report
          </p>
          <h1 style={{ fontFamily: T.fontDisplay, color: T.cream, fontSize: '2.25rem', fontWeight: 600, lineHeight: 1.15, margin: 0 }}>
            {displayTitle || "Your Manuscript"}
          </h1>
          {manuscriptTitle && chapterTitle && manuscriptTitle !== chapterTitle && (
            <p style={{ marginTop: '0.35rem', fontSize: '0.875rem', color: T.cream2 }}>
              Manuscript: <span style={{ color: T.cream }}>{manuscriptTitle}</span>
            </p>
          )}
        </div>
        <Link
          href="/evaluate"
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.4rem 0.9rem',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: T.cream2,
            border: `1px solid ${T.border}`,
            background: 'transparent',
            textDecoration: 'none',
            fontFamily: T.fontBody,
          }}
        >
          ← Back
        </Link>
      </div>

      {/* ── Terminal status pill ── */}
      {(job.status === "complete" || job.status === "failed") && (
        <div style={{ marginBottom: '1.5rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '9999px',
              padding: '0.25rem 0.85rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: job.status === "complete" ? 'rgba(127,163,107,0.14)' : 'rgba(122,43,26,0.2)',
              color: job.status === "complete" ? '#7FA36B' : '#e07a5f',
              border: `1px solid ${job.status === "complete" ? 'rgba(127,163,107,0.3)' : 'rgba(167,71,42,0.4)'}`,
            }}
          >
            {job.status === "complete" ? "✓ Report ready" : "⚠ Needs attention"}
          </span>
        </div>
      )}

      {/* ── Evaluation Metadata ── */}
      <Card>
        <CardBody>
          <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: T.dim, marginBottom: '1rem', fontFamily: T.fontBody }}>
            Evaluation Metadata
          </h2>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))' }}>
            <div>
              <MetaLabel>Chapter Title</MetaLabel>
              <MetaValue>{chapterTitle || manuscriptTitle || "Untitled"}</MetaValue>
            </div>
            <div>
              <MetaLabel>Manuscript Title</MetaLabel>
              <MetaValue>{manuscriptTitle || chapterTitle || "Untitled"}</MetaValue>
            </div>
            <div>
              <MetaLabel>Word Count</MetaLabel>
              <MetaValue>
                {typeof wordCount === "number"
                  ? wordCount.toLocaleString()
                  : (() => {
                      const manuscriptWordCount =
                        job.manuscripts && !Array.isArray(job.manuscripts)
                          ? (job.manuscripts as any).word_count
                          : Array.isArray(job.manuscripts)
                            ? (job.manuscripts[0] as any)?.word_count
                            : null;
                      return typeof manuscriptWordCount === "number"
                        ? manuscriptWordCount.toLocaleString()
                        : !isComplete
                          ? "Calculating\u2026"
                          : "N/A";
                    })()}
              </MetaValue>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── Technical details (collapsible) ── */}
      <details
        style={{
          marginBottom: '1.5rem',
          borderRadius: '0.75rem',
          border: `1px solid ${T.border}`,
          background: T.surfaceRaised,
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            padding: '0.75rem 1.5rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: T.dim,
            fontFamily: T.fontBody,
          }}
        >
          Technical details
        </summary>
        <div
          style={{
            borderTop: `1px solid ${T.border}`,
            padding: '0.75rem 1.5rem',
            fontSize: '0.75rem',
            color: T.cream2,
          }}
        >
          <span style={{ color: T.dim }}>Job ID: </span>
          <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{job.id}</span>
        </div>
      </details>

      {/* ── Poller ── */}
      <section style={{ marginBottom: '1.5rem' }}>
        <EvaluationPoller
          jobId={jobId}
          initialJob={initialPollerJob}
          redirectOnComplete={false}
          refreshOnComplete={true}
        />
      </section>

      {/* ── States: failed / in-progress / no artifact / complete ── */}
      {job.status === "failed" && job.last_error ? (
        <Card>
          <CardBody>
            <h2 style={{ fontFamily: T.fontDisplay, color: '#e07a5f', fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Evaluation failed
            </h2>
            <p style={{ color: T.cream2, fontSize: '0.875rem' }}>{job.last_error}</p>
            <Link
              href="/evaluate"
              style={{
                display: 'inline-flex',
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: T.cream2,
                border: `1px solid rgba(167,71,42,0.45)`,
                background: 'rgba(122,43,26,0.15)',
                textDecoration: 'none',
              }}
            >
              Return to job list
            </Link>
          </CardBody>
        </Card>
      ) : !isComplete ? (
        <Card>
          <CardBody>
            <h2 style={{ fontFamily: T.fontDisplay, color: T.cream, fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Evaluation in progress
            </h2>
            <p style={{ color: T.cream2, fontSize: '0.875rem' }}>
              Your report will appear here automatically when final QA completes.
            </p>
            <Link
              href="/evaluate"
              style={{
                display: 'inline-flex',
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: T.cream2,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                textDecoration: 'none',
              }}
            >
              Return to job list
            </Link>
          </CardBody>
        </Card>
      ) : !artifact ? (
        <Card>
          <CardBody>
            <h2 style={{ fontFamily: T.fontDisplay, color: T.cream, fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {isProduction ? "Report integrity check failed" : "Report not available yet"}
            </h2>
            <p style={{ color: T.cream2, fontSize: '0.875rem' }}>
              {isProduction
                ? "Job is marked complete but canonical evaluation artifact is missing (expected evaluation_result_v2 or legacy evaluation_result_v1). This indicates an invariant violation; please re-run evaluation from the Evaluate page."
                : "Job completed but no evaluation artifact was found. Phase 2 may still be persisting results. Please refresh in a moment."}
            </p>
            <Link
              href="/evaluate"
              style={{
                display: 'inline-flex',
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: T.cream2,
                border: `1px solid ${T.border}`,
                background: 'transparent',
                textDecoration: 'none',
              }}
            >
              {isProduction ? "Re-run evaluation" : "Return to job list"}
            </Link>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Mode confirmation */}
          {hasDetectedMode && artifact?.detected_mode && (
            <ModeConfirmationBlock
              jobId={jobId}
              detectedMode={artifact.detected_mode}
              confirmedMode={artifact.confirmed_mode ?? null}
            />
          )}

          {/* Dev: inline result warning */}
          {!isProduction && artifactSource === "inline_job_result" && (
            <div
              style={{
                marginBottom: '1rem',
                borderRadius: '0.75rem',
                padding: '1rem',
                background: 'rgba(200,169,110,0.08)',
                border: `1px solid rgba(200,169,110,0.25)`,
              }}
            >
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: T.gold }}>
                ⚠ Showing Phase 1 inline output. Phase 2 artifact not yet persisted.
              </p>
              <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: T.cream2 }}>
                This is an interim result from evaluation_jobs.evaluation_result, not the canonical evaluation_artifacts row.
              </p>
            </div>
          )}

          {/* Governance / integrity banner */}
          {integrityBanner && (
            <div
              style={{
                marginBottom: '1rem',
                borderRadius: '0.75rem',
                padding: '1rem',
                background: 'rgba(200,169,110,0.08)',
                border: `1px solid rgba(200,169,110,0.25)`,
              }}
            >
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: T.gold }}>{integrityBanner.title}</p>
              <p style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: T.cream2 }}>{integrityBanner.message}</p>
            </div>
          )}

          {/* Revise Access */}
          <Card>
            <CardBody>
              <SectionTitle>Revise Access</SectionTitle>
              <p style={{ color: T.cream2, fontSize: '0.875rem', marginBottom: '1rem' }}>
                {hasConfirmedMode
                  ? "Mode confirmed. You can proceed to Revise."
                  : "Mode confirmation is required before Revise and Trustpath."}
              </p>
              <Link
                href={hasConfirmedMode ? "/revise" : "#"}
                aria-disabled={!hasConfirmedMode}
                style={{
                  display: 'inline-flex',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: hasConfirmedMode ? T.gold : 'rgba(216,209,192,0.08)',
                  color: hasConfirmedMode ? '#0D0A05' : T.dim,
                  border: hasConfirmedMode ? 'none' : `1px solid ${T.border}`,
                  pointerEvents: hasConfirmedMode ? 'auto' : 'none',
                  cursor: hasConfirmedMode ? 'pointer' : 'not-allowed',
                }}
              >
                Start Revising
              </Link>
            </CardBody>
          </Card>

          {/* Overall Summary */}
          <Card>
            <CardBody>
              <SectionTitle>Overall Summary</SectionTitle>
              <p style={{ color: T.cream2, fontSize: '0.9375rem', lineHeight: 1.75 }}>
                {artifact.summary || artifact.overview?.one_paragraph_summary || "No summary available"}
              </p>
            </CardBody>
          </Card>

          {/* Top Recommendations */}
          <Card>
            <CardBody>
              <SectionTitle>Top Recommendations</SectionTitle>
              <ul style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {buildTopRecommendations(artifact).map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.625rem', fontSize: '0.9375rem', color: T.cream2 }}>
                    <span style={{ color: T.gold, flexShrink: 0, marginTop: '0.1em' }}>›</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {/* ── 13 Story Criteria Scores ── */}
          {orderedCriteria.length > 0 && (
            <Card>
              <CardBody>
                <SectionTitle>Story Criteria Scores</SectionTitle>

                {/* Confidence guide */}
                <div
                  style={{
                    borderRadius: '0.5rem',
                    padding: '0.875rem 1rem',
                    marginBottom: '1rem',
                    background: '#12100B',
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: T.gold, marginBottom: '0.25rem' }}>Confidence Guide</p>
                  <p style={{ fontSize: '0.75rem', color: T.cream2 }}>
                    Confidence shows how strongly each score and summary is supported by clear examples from your submitted text.
                  </p>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.75rem', color: T.dim, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <li>High (≥80): strong support from the text</li>
                    <li>Moderate (60–79): partial or uneven support from the text</li>
                    <li>Low (&lt;60): limited support from the text</li>
                  </ul>
                </div>

                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: T.cream2, marginBottom: '1rem' }}>
                  {getCertifiedCriteriaSummary(orderedCriteria)}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {orderedCriteria.map((c) => {
                    const confidence = getConfidencePresentation(c);
                    const primaryBadge = getCriterionPrimaryBadge(c);
                    const rationalePresentation = getCriterionRationalePresentation(c, c.rationale);
                    const statusLbl = criterionStatusLabel(c);

                    // Map primary badge classes → dark inline styles
                    const badgeStyle: React.CSSProperties = (() => {
                      const cls = primaryBadge.classes ?? '';
                      if (cls.includes('green') || cls.includes('emerald')) {
                        return { background: 'rgba(127,163,107,0.14)', color: '#7FA36B', border: '1px solid rgba(127,163,107,0.3)' };
                      }
                      if (cls.includes('amber') || cls.includes('yellow')) {
                        return { background: 'rgba(200,169,110,0.12)', color: T.gold, border: `1px solid rgba(200,169,110,0.3)` };
                      }
                      if (cls.includes('red') || cls.includes('rose')) {
                        return { background: 'rgba(167,71,42,0.14)', color: '#e07a5f', border: '1px solid rgba(167,71,42,0.35)' };
                      }
                      if (cls.includes('gray') || cls.includes('slate')) {
                        return { background: 'rgba(216,209,192,0.06)', color: T.dim, border: `1px solid ${T.border}` };
                      }
                      return { background: 'rgba(200,169,110,0.12)', color: T.gold, border: `1px solid rgba(200,169,110,0.3)` };
                    })();

                    return (
                      <div
                        key={c.key}
                        style={{
                          borderRadius: '0.625rem',
                          padding: '1.25rem',
                          background: '#12100B',
                          border: `1px solid ${T.border}`,
                          borderLeft: `3px solid ${T.gold}`,
                        }}
                      >
                        {/* Title + badges */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: T.cream, fontFamily: T.fontBody, margin: 0 }}>
                            {isCriterionKey(c.key) ? getCriterionDisplayLabel(c.key, evaluationScope) : c.key}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: '9999px',
                                padding: '0.2rem 0.75rem',
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                ...badgeStyle,
                              }}
                            >
                              {primaryBadge.label}
                            </span>
                            {confidence && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  borderRadius: '9999px',
                                  padding: '0.15rem 0.6rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                  ...confidence.style,
                                }}
                              >
                                {confidence.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status label */}
                        {statusLbl && (
                          <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 500, color: T.dim }}>
                            {statusLbl}
                          </p>
                        )}

                        {/* Rationale */}
                        {rationalePresentation && (
                          <div style={{ marginTop: '0.625rem' }}>
                            {rationalePresentation.label && (
                              <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.gold, marginBottom: '0.2rem' }}>
                                {rationalePresentation.label}
                              </p>
                            )}
                            <p style={{ fontSize: '0.9rem', color: T.cream2, lineHeight: 1.65 }}>
                              {rationalePresentation.text}
                            </p>
                          </div>
                        )}

                        {/* Insufficient signal */}
                        {!isScorableCriterion(c) && c.insufficient_signal_reason && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: T.dim }}>
                            {Array.isArray(c.insufficient_signal_reason.looked_for) && c.insufficient_signal_reason.looked_for.length > 0 && (
                              <p><span style={{ fontWeight: 600 }}>Looked for:</span> {c.insufficient_signal_reason.looked_for.join(", ")}</p>
                            )}
                            {Array.isArray(c.insufficient_signal_reason.not_found) && c.insufficient_signal_reason.not_found.length > 0 && (
                              <p style={{ marginTop: '0.15rem' }}><span style={{ fontWeight: 600 }}>Not found:</span> {c.insufficient_signal_reason.not_found.join(", ")}</p>
                            )}
                          </div>
                        )}

                        {/* Per-criterion recommendations */}
                        {c.recommendations && c.recommendations.length > 0 && (
                          <div style={{ marginTop: '0.875rem' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.dim, marginBottom: '0.4rem' }}>
                              Recommendations
                            </p>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                              {c.recommendations.map((r, ri) => (
                                <li key={ri} style={{ fontSize: '0.875rem', color: T.cream2 }}>
                                  {normalizeRecommendationActionForDisplay(r.action)}
                                  {r.priority && (
                                    <span
                                      style={{
                                        marginLeft: '0.35rem',
                                        fontWeight: 600,
                                        color: r.priority === "high" ? '#e07a5f' : r.priority === "medium" ? T.gold : T.dim,
                                      }}
                                    >
                                      ({r.priority})
                                    </span>
                                  )}
                                  {r.expected_impact && (
                                    <span style={{ marginLeft: '0.35rem', fontSize: '0.75rem', color: T.dim }}>
                                      — {r.expected_impact}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Key Metrics */}
          <Card>
            <CardBody>
              <SectionTitle>Key Metrics</SectionTitle>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))' }}>
                <Metric label="Overall Score" value={formatScore(artifact.overall_score ?? artifact.overview?.overall_score_0_100 ?? 0)} />
                <Metric label="Chunks Analyzed" value={artifact.chunk_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"} />
                <Metric label="Processed" value={artifact.processed_count ?? artifact.metrics?.processing?.segment_count ?? "N/A"} />
              </div>

              {artifact.governance?.transparency?.score_ledger && (
                <div
                  style={{
                    marginTop: '0.875rem',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                    background: '#12100B',
                    border: `1px solid ${T.border}`,
                    fontSize: '0.75rem',
                    color: T.cream2,
                  }}
                >
                  <span style={{ color: T.dim, fontWeight: 600 }}>Score Ledger: </span>
                  Raw {artifact.governance.transparency.score_ledger.raw_total} / {artifact.governance.transparency.score_ledger.max_total},{" "}
                  Weighted composite {artifact.governance.transparency.score_ledger.normalized_total} / 10,{" "}
                  Weighting {artifact.governance.transparency.score_ledger.weighting}
                  <p style={{ marginTop: '0.35rem', fontSize: '0.6875rem', color: T.dim }}>
                    Weighted composite is the canonical 0–10 score. The Overall Score above is the same value rescaled to 0–100.
                  </p>
                </div>
              )}

              {integrityBanner?.label && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    borderRadius: '0.5rem',
                    padding: '0.75rem 1rem',
                    background: '#12100B',
                    border: `1px solid ${T.border}`,
                    fontSize: '0.75rem',
                    color: T.cream2,
                  }}
                >
                  <span style={{ color: T.dim, fontWeight: 600 }}>Evaluation Status: </span>
                  {integrityBanner.label}
                </div>
              )}

              <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: T.dim }}>
                Generated: {artifact.generated_at ? new Date(artifact.generated_at).toLocaleString() : "N/A"}
              </p>
            </CardBody>
          </Card>

          {/* Narrative Synthesis (long-form) */}
          {isLongForm && isComplete && (
            <Card>
              <CardBody>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h2 style={{ fontFamily: T.fontDisplay, color: T.cream, fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Narrative Synthesis
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: T.cream2 }}>
                    Holistic Craft Assessment — long-form synthesis report
                  </p>
                </div>
                <SynthesisPoller
                  jobId={jobId}
                  wordCount={wordCount ?? 0}
                  initialDreamDoc={dreamDoc}
                />
              </CardBody>
            </Card>
          )}

          {/* Evaluation Provenance */}
          <Card>
            <CardBody>
              <SectionTitle>Evaluation Provenance</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div>
                  <span style={{ color: T.dim, fontWeight: 600 }}>Engine: </span>
                  <span style={{ fontFamily: 'monospace', color: T.cream2 }}>{(artifact as any).engine?.model || "unknown"}</span>
                </div>
                <div>
                  <span style={{ color: T.dim, fontWeight: 600 }}>Provider: </span>
                  <span style={{ fontFamily: 'monospace', color: T.cream2 }}>{(artifact as any).engine?.provider || "unknown"}</span>
                </div>
                <div>
                  <span style={{ color: T.dim, fontWeight: 600 }}>Prompt Version: </span>
                  <span style={{ fontFamily: 'monospace', color: T.cream2 }}>{(artifact as any).engine?.prompt_version || "unknown"}</span>
                </div>
                {artifact.governance?.confidence && (
                  <div>
                    <span style={{ color: T.dim, fontWeight: 600 }}>Confidence: </span>
                    <span style={{ color: T.cream, fontWeight: 600 }}>{(artifact.governance.confidence * 100).toFixed(0)}%</span>
                  </div>
                )}
                {artifact.governance?.limitations && artifact.governance.limitations.length > 0 && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${T.border}` }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: T.dim, marginBottom: '0.35rem' }}>Limitations:</p>
                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.75rem', color: T.cream2, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {artifact.governance.limitations.map((limitation, i) => (
                        <li key={i}>{limitation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Editorial disclaimer */}
          <p style={{ fontSize: '0.75rem', color: T.dim, textAlign: 'center', marginTop: '2rem', lineHeight: 1.6 }}>
            Framework-driven analysis does not replace human editorial judgment.
          </p>
        </>
      )}
    </>
  );
}
