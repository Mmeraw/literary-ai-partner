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
      <div className="flex items-center justify-center min-h-screen bg-[#F7F4EF]">
        <div className="text-stone-600">Loading evaluations…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F7F4EF]">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">History</p>
              <h2 className="mt-1 font-rg-serif text-3xl text-stone-950">Recent evaluations</h2>
              <p className="mt-1 text-sm text-stone-600">Track submitted jobs, live progress, completed reports, and failed runs.</p>
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
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Job ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Result</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500" style={{ minWidth: "380px" }}>Pipeline — Entered &amp; Passed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Activity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Submitted</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {sortedJobs.map((job) => {
                      const displayInfo = getJobDisplayInfo(job);
                      const statusBadge = getJobStatusBadge(displayInfo.badge);
                      const isComplete = job.status === "complete";
                      const isQueued = job.status === "queued";
                      const isRunning = job.status === "running";
                      const isFailed = job.status === "failed";
                      const relativeTime = formatRelativeTime(job.created_at);
                      const phaseInfo = getPhaseSpecificCopy(displayInfo.phaseDetail.phase, displayInfo.phaseDetail.phase_status);

                      let progressMessage = displayInfo.message || displayInfo.progress.display;
                      let subMessage = null;

                      if (isQueued) {
                        progressMessage = "Preparing evaluation…";
                        subMessage = "This usually takes ~2–3 minutes";
                      } else if (isRunning) {
                        const duration = formatDuration(job.created_at);
                        progressMessage = phaseInfo.displayCopy;
                        subMessage = `Running for ${duration} • ${phaseInfo.description}`;
                      } else if (isComplete) {
                        progressMessage = "Evaluation complete";
                        subMessage = "Ready to view your report";
                      } else if (isFailed) {
                        progressMessage = "Evaluation failed";
                        subMessage = displayInfo.message || "An error occurred during processing";
                      }

                      return (
                        <tr key={job.id} className="hover:bg-stone-50">
                          <td className="whitespace-nowrap px-6 py-4 font-mono text-sm">
                            <Link href={`/evaluate/${job.id}`} className="text-blue-700 hover:text-blue-900 hover:underline" title={job.id}>
                              {job.id.slice(0, 8)}&hellip;
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-stone-500" style={{ minWidth: "380px" }}>
                            <PhaseBreadcrumb phaseLog={job.progress?.phase_log ?? []} job={job} compact={true} />
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="text-stone-900">{progressMessage}</div>
                            {subMessage && <div className="mt-1 text-xs text-stone-500">{subMessage}</div>}
                            {isRunning && displayInfo.progress.total > 0 && (
                              <div className="mt-2">
                                <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                                  <span>Progress</span>
                                  <span>{displayInfo.progress.percentage}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-stone-200">
                                  <div className="h-1.5 rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${displayInfo.progress.percentage}%` }} />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-stone-500">
                            <div>{relativeTime}</div>
                            <div className="mt-1 text-xs text-stone-400">{new Date(job.created_at).toLocaleString()}</div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm">
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
                                className="inline-flex items-center rounded-md border border-transparent bg-green-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-800"
                              >
                                View Report
                              </Link>
                            ) : isRunning || isQueued ? (
                              <div className="flex flex-wrap items-center gap-3">
                                <Link href={`/evaluate/${job.id}`} className={`flex items-center ${isRunning ? "text-blue-700" : "text-stone-500"} hover:underline`}>
                                  <svg className={`${isRunning ? "animate-spin" : ""} mr-2 h-4 w-4`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span className="text-xs font-medium">{isRunning ? "Live Progress" : "Queued"}</span>
                                </Link>
                                <CancelEvaluationButton jobId={job.id} label="STOP" buttonClassName="inline-flex items-center rounded-md bg-red-700 px-3 py-1.5 text-xs font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-red-800" />
                              </div>
                            ) : (
                              <span className="text-xs text-stone-400">{statusBadge.label}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
