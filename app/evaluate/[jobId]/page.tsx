import type { ReactNode } from "react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManuscriptText } from "@/lib/manuscripts/chunks";
import EvaluationUnavailableReloadButton from "@/components/evaluation/EvaluationUnavailableReloadButton";
import { EvaluationPoller } from "@/components/EvaluationPoller";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ jobId: string }>;
};

type HeaderFieldProps = {
  label: string;
  value: ReactNode;
  confidenceLabel?: string | null;
  capitalize?: boolean;
};

type EvaluationJob = {
  id: string;
  manuscript_id: number | null;
  status: string | null;
  last_error: string | null;
  failure_code: string | null;
  progress?: Record<string, unknown> | null;
  manuscripts?:
    | { user_id: string | null; title?: string | null }
    | Array<{ user_id: string | null; title?: string | null }>
    | null;
};

const HeaderField = ({ label, value, confidenceLabel, capitalize = false }: HeaderFieldProps) => (
  <div>
    <dt className="font-semibold text-stone-950">{label}</dt>
    <dd className={capitalize ? "capitalize text-stone-700" : "text-stone-700"}>
      {value}
      {confidenceLabel ? (
        <span className="ml-2 inline-flex whitespace-nowrap rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs text-red-700">
          {confidenceLabel}
        </span>
      ) : null}
    </dd>
  </div>
);

function firstWords(text: string, limit: number): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const preview = words.slice(0, limit).join(" ");
  return words.length > limit ? `${preview}…` : preview;
}

async function getSubmissionPreviewByManuscriptId(manuscriptId?: number | null): Promise<string | null> {
  if (!Number.isFinite(manuscriptId) || (manuscriptId as number) <= 0) return null;
  try {
    return firstWords(await getManuscriptText(manuscriptId as number), 80);
  } catch {
    return null;
  }
}

async function getJob(jobId: string): Promise<EvaluationJob | null> {
  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("evaluation_jobs")
    .select("id, user_id, manuscript_id, status, last_error, failure_code, progress, manuscripts(user_id,title)")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return null;

  const manuscriptOwnerUserId = Array.isArray((job as EvaluationJob).manuscripts)
    ? (job as EvaluationJob).manuscripts?.[0]?.user_id ?? null
    : ((job as EvaluationJob).manuscripts as { user_id?: string | null } | null)?.user_id ?? null;
  const directJobUserId = (job as { user_id?: string | null }).user_id ?? null;
  const ownerUserId = manuscriptOwnerUserId ?? directJobUserId;

  if (!ownerUserId) return null;
  return job as EvaluationJob;
}

export default async function EvaluationReportPage({ params }: PageProps) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  const manuscriptTitle = Array.isArray(job?.manuscripts)
    ? job?.manuscripts?.[0]?.title ?? null
    : job?.manuscripts?.title ?? null;
  const progress = (job?.progress as Record<string, unknown> | null) ?? {};
  const submittedAuthorName = (progress.submitted_author_name as string | null) ?? null;
  const submittedProjectTitle = (progress.submitted_project_title as string | null) ?? null;
  const wordCount = (progress.manuscript_word_count as number | null) ?? null;
  const readingGradeLevel = (progress.enrichment_reading_grade_level as number | null) ?? null;
  const dialoguePercentage = (progress.enrichment_dialogue_percentage as number | null) ?? null;
  const narrativePercentage = (progress.enrichment_narrative_percentage as number | null) ?? null;
  const phase0CompletedAt = (progress.phase0_completed_at as string | null) ?? null;
  const submissionPreview = await getSubmissionPreviewByManuscriptId(job?.manuscript_id ?? null);

  if (!job) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="font-rg-serif text-2xl font-semibold text-stone-950">Report not available yet</h1>
          <p className="mt-2 text-stone-700">This evaluation is still being prepared or could not be loaded.</p>
          <div className="mt-4">
            <EvaluationUnavailableReloadButton jobId={jobId} />
          </div>
        </section>
      </main>
    );
  }

  const isTerminal = job.status === "complete" || job.status === "failed";

  const isFailed = job.status === "failed";

  return (
    <main className="mx-auto max-w-7xl p-8">
      {/* Progress bar — shown for all non-terminal jobs.
          Previously gated on isRunningOrQueued which missed edge cases where
          status hadn't transitioned to "queued"/"running" at SSR time, causing
          the progress bar to not render until a hard refresh. */}
      {!isTerminal && (
        <section className="mb-6">
          <EvaluationPoller
            jobId={jobId}
            redirectOnComplete={false}
            refreshOnComplete={true}
          />
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        {/* Top bar: title left, back button right */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A6A1F]">Evaluation Report</p>
            <h1 className="mt-2 font-rg-serif text-3xl font-semibold text-stone-950 sm:text-4xl">{manuscriptTitle ?? "Evaluation"}</h1>
            <p className="mt-2 text-sm text-stone-500">
              <span className="font-medium text-stone-700">Reference ID:</span> <span className="break-all font-mono text-stone-900">{jobId}</span>
            </p>
          </div>
          <Link href="/evaluate" className="inline-flex shrink-0 items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Back to Evaluate
          </Link>
        </div>

        {/* Body: metadata left, submission preview right */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
          <dl className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2 md:grid-cols-3">
            <HeaderField label="Author Name" value={submittedAuthorName ?? "Not provided"} />
            <HeaderField label="Project Name" value={submittedProjectTitle ?? manuscriptTitle ?? "Not provided"} />
            <HeaderField label="Report Type" value="Short-Form Evaluation" />
            <HeaderField label="Genre" value="Not specified" />
            <HeaderField label="Shelf" value="Not available" />
            <HeaderField label="Submitted Word Count" value={wordCount ? wordCount.toLocaleString() : "Calculating"} />
            <HeaderField label="Estimated Manuscript Pages" value={wordCount ? Math.floor(wordCount / 250).toLocaleString() : "Not available"} />
            <HeaderField label="Reading Grade Level" value={readingGradeLevel ? String(Math.floor(readingGradeLevel)) : "Not available"} />
            <HeaderField label="Dialogue/Narrative Ratio" value={dialoguePercentage != null && narrativePercentage != null ? `${Math.floor(dialoguePercentage)}% / ${Math.floor(narrativePercentage)}%` : "Not available"} />
            <HeaderField label="Market Readiness" value="Review" />
            <HeaderField label="Date Generated" value={phase0CompletedAt ? new Date(phase0CompletedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Not available"} />
            <HeaderField label="Target Audience" value="Not available" />
          </dl>

          {submissionPreview && (
            <section className="rounded-lg border border-stone-200 bg-stone-50 px-5 py-4">
              <h2 className="text-sm font-semibold text-stone-950">Submission Preview</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-700">{submissionPreview}</p>
            </section>
          )}
        </div>
      </section>

      {isFailed ? (
        <section className="mt-6 rounded-xl border border-red-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">Evaluation Details</p>
          <h2 className="mt-1 font-rg-serif text-2xl font-semibold text-stone-950">Evaluation needs review</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
            This report did not pass internal quality assurance and completeness checks. RevisionGrade is investigating and your manuscript has been preserved.
          </p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-semibold text-stone-950">Reference ID</dt>
              <dd className="break-all font-mono text-xs text-stone-700">{jobId}</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-950">Status</dt>
              <dd className="text-stone-700">Quality and completeness review needed</dd>
            </div>
            <div>
              <dt className="font-semibold text-stone-950">Next Step</dt>
              <dd className="text-stone-700">RevisionGrade is investigating. Use the Reference ID if you contact support.</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
