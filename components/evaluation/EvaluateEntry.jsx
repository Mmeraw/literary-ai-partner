"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appendUserActivity } from "@/lib/activity/userActivity";
import { useJobs } from "../../lib/jobs/useJobs";
import { getJobDisplayInfo, getJobStatusBadge } from "../../lib/jobs/ui-helpers";
import { formatRelativeTime, formatDuration } from "../../lib/ui/time-helpers";
import { getPhaseSpecificCopy } from "../../lib/ui/phase-helpers";
import ManuscriptSubmissionForm from "./ManuscriptSubmissionForm";
import PhaseBreadcrumb from "./PhaseBreadcrumb";
import CompletionBanner from "./CompletionBanner";
import { CancelEvaluationButton } from "./CancelEvaluationButton";

const evaluationModes = [
  {
    label: "Short-form evaluation",
    range: "Under 25,000 words",
    copy: "Evaluated against the 13 story criteria only. Best for openings, chapters, excerpts, and shorter works.",
  },
  {
    label: "Long-form evaluation",
    range: "25,000+ words",
    copy: "Adds manuscript-scale continuity, pacing over distance, setup/payoff, and structural readiness signals.",
  },
  {
    label: "Long-form multi-layer",
    range: "Complex manuscripts",
    copy: "Deeper architecture review for complex long-form prose where layered story logic and governance apply.",
  },
];

function getJobTitle(job) {
  return (
    job.manuscript_title ||
    job.manuscriptTitle ||
    job.title ||
    job.chapter_title ||
    job.chapterTitle ||
    `Evaluation ${job.id.slice(0, 8)}…`
  );
}

function getStatusTone(status) {
  if (status === "complete") return "border-green-200 bg-green-50 text-green-900";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-900";
  if (status === "running") return "border-blue-200 bg-blue-50 text-blue-900";
  if (status === "queued") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-stone-200 bg-stone-50 text-stone-700";
}

function EvaluationHistoryCard({ job }) {
  const displayInfo = getJobDisplayInfo(job);
  const statusBadge = getJobStatusBadge(displayInfo.badge);
  const isComplete = job.status === "complete";
  const isQueued = job.status === "queued";
  const isRunning = job.status === "running";
  const isFailed = job.status === "failed";
  const relativeTime = formatRelativeTime(job.created_at);
  const phaseInfo = getPhaseSpecificCopy(displayInfo.phaseDetail.phase, displayInfo.phaseDetail.phase_status);
  const statusTone = getStatusTone(job.status);

  let progressMessage = displayInfo.message || displayInfo.progress.display;
  let subMessage = null;

  if (isQueued) {
    progressMessage = "Preparing evaluation…";
    subMessage = "This usually takes about 2–3 minutes.";
  } else if (isRunning) {
    const duration = formatDuration(job.created_at);
    progressMessage = phaseInfo.displayCopy;
    subMessage = `Running for ${duration}. ${phaseInfo.description}`;
  } else if (isComplete) {
    progressMessage = "Evaluation complete";
    subMessage = "Your report is ready to review.";
  } else if (isFailed) {
    progressMessage = "Evaluation failed";
    subMessage = displayInfo.message || "An error occurred during processing.";
  }

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-rg-gold/60 hover:shadow-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone}`}>
              {statusBadge.label}
            </span>
            <span className="font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-stone-400">
              Submitted {relativeTime}
            </span>
          </div>

          <h3 className="mt-3 font-rg-serif text-2xl leading-tight text-stone-950">
            {getJobTitle(job)}
          </h3>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            {progressMessage}
          </p>
          {subMessage && <p className="mt-1 text-xs leading-5 text-stone-500">{subMessage}</p>}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {isComplete ? (
            <Link
              href={`/evaluate/${job.id}`}
              onClick={() => {
                appendUserActivity({
                  event: "evaluate.report.opened",
                  route: "/evaluate",
                  href: `/evaluate/${job.id}`,
                  linkLabel: "Open evaluation report",
                  detail: `job_id=${job.id}`,
                });
              }}
              className="inline-flex items-center rounded-xl bg-green-700 px-4 py-2 font-rg-mono text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-green-800"
            >
              Open Report
            </Link>
          ) : isRunning || isQueued ? (
            <>
              <Link
                href={`/evaluate/${job.id}`}
                className={`inline-flex items-center rounded-xl border px-4 py-2 font-rg-mono text-xs font-semibold uppercase tracking-[0.12em] transition ${isRunning ? "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100" : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"}`}
              >
                {isRunning && (
                  <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isRunning ? "Live Progress" : "Queued"}
              </Link>
              <CancelEvaluationButton jobId={job.id} label="STOP" buttonClassName="inline-flex items-center rounded-xl bg-red-700 px-4 py-2 font-rg-mono text-xs font-bold uppercase tracking-[0.12em] text-white shadow-sm transition-colors hover:bg-red-800" />
            </>
          ) : (
            <Link
              href={`/evaluate/${job.id}`}
              className="inline-flex items-center rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 font-rg-mono text-xs font-semibold uppercase tracking-[0.12em] text-stone-600 transition hover:bg-stone-100"
            >
              View Details
            </Link>
          )}
        </div>
      </div>

      {isRunning && displayInfo.progress.total > 0 && (
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="mb-2 flex items-center justify-between font-rg-mono text-[0.68rem] uppercase tracking-[0.14em] text-blue-900/70">
            <span>Progress</span>
            <span>{displayInfo.progress.percentage}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-blue-100">
            <div className="h-2 rounded-full bg-blue-700 transition-all duration-500" style={{ width: `${displayInfo.progress.percentage}%` }} />
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-stone-100 pt-5 lg:grid-cols-[1fr_1.35fr]">
        <div>
          <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-stone-400">Evaluation ID</p>
          <Link href={`/evaluate/${job.id}`} className="mt-1 block truncate font-mono text-sm text-stone-600 hover:text-stone-950 hover:underline" title={job.id}>
            {job.id}
          </Link>
          <p className="mt-3 font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-stone-400">Submitted</p>
          <p className="mt-1 text-sm text-stone-600">{new Date(job.created_at).toLocaleString()}</p>
        </div>

        <div>
          <p className="font-rg-mono text-[0.68rem] uppercase tracking-[0.16em] text-stone-400">Process checkpoint</p>
          <div className="mt-2 rounded-2xl border border-stone-200 bg-[#FBFAF7] p-3">
            <PhaseBreadcrumb phaseLog={job.progress?.phase_log ?? []} job={job} compact={true} />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function EvaluateEntry() {
  const router = useRouter();
  const { jobs, isLoading, isError } = useJobs();

  React.useEffect(() => {
    appendUserActivity({
      event: "evaluate.page.viewed",
      route: "/evaluate",
      href: "/evaluate",
      linkLabel: "Open Evaluate",
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF]">
        <div className="text-stone-600">Loading evaluations…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF]">
        <div className="text-red-700">Failed to load evaluations.</div>
      </div>
    );
  }

  const sortedJobs = [...jobs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const hasNoJobs = sortedJobs.length === 0;
  const mostRecentJob = sortedJobs[0];
  const showCompletionBanner = mostRecentJob && mostRecentJob.status === "complete";

  return (
    <div className="min-h-screen bg-[#F7F4EF] py-8 text-stone-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="mb-8 rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm md:p-8">
          <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Evaluate</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <h1 className="font-rg-serif text-4xl leading-tight text-stone-950 md:text-5xl">
                Begin manuscript evaluation.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
                Submit existing writing into the correct diagnostic path. Short-form work is evaluated against the 13 story criteria; long-form manuscripts qualify for manuscript-scale readiness analysis.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {evaluationModes.map((mode) => (
                <div key={mode.label} className="rounded-2xl border border-stone-200 bg-[#FBFAF7] p-4">
                  <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.16em] text-rg-gold">{mode.range}</p>
                  <h2 className="mt-2 font-rg-serif text-xl text-stone-950">{mode.label}</h2>
                  <p className="mt-2 text-xs leading-5 text-stone-600">{mode.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ManuscriptSubmissionForm
          onSubmitSuccess={(data) => {
            const jobId = data?.job_id;
            if (!jobId) return;

            appendUserActivity({
              event: "evaluate.job.created",
              route: "/evaluate",
              href: `/evaluate/${jobId}`,
              linkLabel: "Redirect to job status",
              detail: `job_id=${jobId}`,
            });

            router.push(`/evaluate/${jobId}`);
          }}
        />

        {showCompletionBanner && (
          <div className="mt-8">
            <CompletionBanner jobId={mostRecentJob.id} />
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">History</p>
              <h2 className="mt-1 font-rg-serif text-3xl text-stone-950">Recent evaluations</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">
                Your evaluations are shown as readable manuscript cards with status, progress, report access, and submission timing.
              </p>
            </div>
          </div>

          {hasNoJobs ? (
            <div className="rounded-2xl border border-stone-200 bg-[#FBFAF7] p-12 text-center">
              <div className="mx-auto max-w-md">
                <svg
                  className="mx-auto h-12 w-12 text-stone-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-4 font-rg-serif text-2xl text-stone-950">No evaluations yet</h3>
                <p className="mt-2 text-sm text-stone-500">Choose a manuscript, upload a file, or paste text above to begin your first evaluation.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedJobs.map((job) => (
                <EvaluationHistoryCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
