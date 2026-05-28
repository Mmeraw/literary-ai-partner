"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appendUserActivity } from "@/lib/activity/userActivity";
import { useJobs } from "../../lib/jobs/useJobs";
import { getJobDisplayInfo, getJobStatusBadge, sortJobsByCreatedAtDesc } from "../../lib/jobs/ui-helpers";
import ManuscriptSubmissionForm from "./ManuscriptSubmissionForm";
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

function getStatusTone(status) {
  if (status === "complete") return "border-green-200 bg-green-50 text-green-900";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-900";
  if (status === "running") return "border-blue-200 bg-blue-50 text-blue-900";
  if (status === "queued") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-stone-200 bg-stone-50 text-stone-700";
}

function formatSubmittedAt(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPhaseLabel(job, displayInfo) {
  const phaseDetail = displayInfo?.phaseDetail || {};
  const rawPhase = phaseDetail.phase || job.progress?.phase || job.phase || "";
  const rawPhaseStatus = phaseDetail.phase_status || job.progress?.phase_status || job.phase_status || "";
  const message = displayInfo?.message || displayInfo?.progress?.display || "";

  if (job.status === "complete") return "Complete";
  if (job.status === "queued") return rawPhase ? `${formatPhaseName(rawPhase)} queued` : "Queued";

  if (job.status === "failed") {
    if (message) return compactFailureMessage(message);
    if (rawPhase) return `${formatPhaseName(rawPhase)} failed`;
    return "Failed";
  }

  if (job.status === "running") {
    if (message) return message;
    if (rawPhase) return rawPhaseStatus ? `${formatPhaseName(rawPhase)} ${rawPhaseStatus}` : formatPhaseName(rawPhase);
    return "Running";
  }

  return rawPhase ? formatPhaseName(rawPhase) : "—";
}

function formatPhaseName(value) {
  const normalized = String(value).replace(/^phase_/i, "").replace(/_/g, " ").trim();
  if (!normalized) return "—";

  if (/^0$/.test(normalized)) return "Phase 0";
  if (/^1a$/i.test(normalized)) return "Phase 1A";
  if (/^2$/.test(normalized)) return "Phase 2";
  if (/^3a$/i.test(normalized)) return "Phase 3A";
  if (/^3b$/i.test(normalized)) return "Phase 3B";

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactFailureMessage(message) {
  const normalized = String(message).replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Failed";

  if (/pass\s*3a|phase\s*3a/i.test(normalized)) return "3A failed";
  if (/gold|calibration|phase\s*0/i.test(normalized)) return "Gold-standard";
  if (/quality gate/i.test(normalized)) return "Quality gate";
  if (/timeout/i.test(normalized)) return "Timed out";

  return normalized.length > 44 ? `${normalized.slice(0, 41)}…` : normalized;
}

function getNextAction(job) {
  if (job.status === "complete") return "Review report";
  if (job.status === "failed") return "Needs attention";
  if (job.status === "running") return "In progress";
  if (job.status === "queued") return "Waiting";
  return "View details";
}

function EvaluationHistoryTable({ jobs }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200 text-left">
          <thead className="bg-[#FBFAF7]">
            <tr>
              <th className="px-4 py-3 font-rg-mono text-[0.66rem] uppercase tracking-[0.16em] text-stone-500">Status</th>
              <th className="px-4 py-3 font-rg-mono text-[0.66rem] uppercase tracking-[0.16em] text-stone-500">Evaluation ID</th>
              <th className="px-4 py-3 font-rg-mono text-[0.66rem] uppercase tracking-[0.16em] text-stone-500">Submitted</th>
              <th className="px-4 py-3 font-rg-mono text-[0.66rem] uppercase tracking-[0.16em] text-stone-500">Phase</th>
              <th className="px-4 py-3 font-rg-mono text-[0.66rem] uppercase tracking-[0.16em] text-stone-500">Next Action</th>
              <th className="px-4 py-3 font-rg-mono text-[0.66rem] uppercase tracking-[0.16em] text-stone-500">Report</th>
              <th className="px-4 py-3 text-right font-rg-mono text-[0.66rem] uppercase tracking-[0.16em] text-stone-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {jobs.map((job) => (
              <EvaluationHistoryRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EvaluationHistoryRow({ job }) {
  const displayInfo = getJobDisplayInfo(job);
  const statusBadge = getJobStatusBadge(displayInfo.badge);
  const isComplete = job.status === "complete";
  const isQueued = job.status === "queued";
  const isRunning = job.status === "running";
  const statusTone = getStatusTone(job.status);
  const href = `/evaluate/${job.id}`;
  const shortId = `${job.id.slice(0, 8)}…`;

  return (
    <tr className="align-middle transition hover:bg-stone-50/80">
      <td className="whitespace-nowrap px-4 py-3">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone}`}>
          {statusBadge.label}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Link href={href} className="font-mono text-sm text-stone-800 underline-offset-4 hover:text-stone-950 hover:underline" title={job.id}>
          {shortId}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600" title={job.created_at ? new Date(job.created_at).toLocaleString() : undefined}>
        {formatSubmittedAt(job.created_at)}
      </td>
      <td className="max-w-[18rem] px-4 py-3 text-sm text-stone-700">
        <Link href={href} className="line-clamp-1 underline-offset-4 hover:text-stone-950 hover:underline" title={displayInfo.message || displayInfo.progress?.display || undefined}>
          {getPhaseLabel(job, displayInfo)}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-700">
        {getNextAction(job)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        {isComplete ? (
          <Link
            href={href}
            onClick={() => {
              appendUserActivity({
                event: "evaluate.report.opened",
                route: "/evaluate",
                href,
                linkLabel: "View report from evaluation history",
                detail: `job_id=${job.id}`,
              });
            }}
            className="font-semibold text-green-800 underline-offset-4 hover:text-green-900 hover:underline"
          >
            View
          </Link>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={href}
            className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 font-rg-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-stone-700 transition hover:bg-stone-100 hover:text-stone-950"
          >
            {isRunning ? "Live" : isQueued ? "Queued" : "Details"}
          </Link>
          {(isRunning || isQueued) && (
            <CancelEvaluationButton jobId={job.id} label="STOP" buttonClassName="inline-flex items-center rounded-lg bg-red-700 px-3 py-1.5 font-rg-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white shadow-sm transition-colors hover:bg-red-800" />
          )}
        </div>
      </td>
    </tr>
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

  const sortedJobs = [...jobs].sort(sortJobsByCreatedAtDesc);
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
                Each evaluation is shown as one compact job row with its status, ID, phase, next action, and report link.
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
            <EvaluationHistoryTable jobs={sortedJobs} />
          )}
        </section>
      </div>
    </div>
  );
}
