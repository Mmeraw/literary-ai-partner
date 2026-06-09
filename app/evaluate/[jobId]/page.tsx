import type { ReactNode } from "react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManuscriptText } from "@/lib/manuscripts/chunks";
import EvaluationUnavailableReloadButton from "@/components/evaluation/EvaluationUnavailableReloadButton";

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
  submitted_author_name?: string | null;
  submitted_project_title?: string | null;
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
    .select("id, user_id, manuscript_id, status, last_error, failure_code, manuscripts(user_id,title)")
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
  const submittedAuthorName = job?.submitted_author_name ?? null;
  const submittedProjectTitle = job?.submitted_project_title ?? null;
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

  const isFailed = job.status === "failed";

  return (
    <main className="mx-auto max-w-7xl p-8">
      <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A6A1F]">Evaluation Report</p>
            <h1 className="mt-2 font-rg-serif text-4xl font-semibold text-stone-950">{manuscriptTitle ?? "Evaluation"}</h1>
            <p className="mt-2 text-sm text-stone-500">
              <span className="font-medium text-stone-700">Reference ID:</span> <span className="break-all font-mono text-stone-900">{jobId}</span>
            </p>

            <div className="mt-6 grid gap-10 xl:grid-cols-[1fr_320px] xl:items-start">
              <dl className="grid gap-x-10 gap-y-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <HeaderField label="Author Name" value={submittedAuthorName ?? "Not provided"} />
                <HeaderField label="Project Name" value={submittedProjectTitle ?? manuscriptTitle ?? "Not provided"} />
                <HeaderField label="Report Type" value="Short-Form Evaluation" />
                <HeaderField label="Genre" value="Not specified" />
                <HeaderField label="Shelf" value="Not available" />
                <HeaderField label="Submitted Word Count" value="Calculating" />
                <HeaderField label="Estimated Manuscript Pages" value="Not available" />
                <HeaderField label="Reading Grade Level" value="Not available" />
                <HeaderField label="Dialogue/Narrative Ratio" value="Not available" />
                <HeaderField label="Market Readiness" value="Review" />
                <HeaderField label="Date Generated" value="Not available" />
                <HeaderField label="Target Audience" value="Not available" />
              </dl>

              {submissionPreview && (
                <section className="rounded-lg border border-stone-200 bg-stone-50 px-5 py-4">
                  <h2 className="text-sm font-semibold text-stone-950">Submission Preview</h2>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">{submissionPreview}</p>
                </section>
              )}
            </div>
          </div>

          <aside className="grid w-full shrink-0 gap-4 lg:w-72">
            <Link href="/evaluate" className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-base font-medium text-stone-700 hover:bg-stone-50">
              Back to Evaluate
            </Link>
          </aside>
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
