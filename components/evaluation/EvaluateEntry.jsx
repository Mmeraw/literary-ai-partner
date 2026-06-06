"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appendUserActivity } from "@/lib/activity/userActivity";
import { useJobs } from "../../lib/jobs/useJobs";
import { getJobDisplayInfo, sortJobsByCreatedAtDesc, canShowCancelButton } from "../../lib/jobs/ui-helpers";
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

const CALIBRATION_PATTERNS = [
  /\(TEST FILE\)/i,
  /\bCALIBRATION\b/i,
  /\bBENCHMARK\b/i,
  /\bREFERENCE\s+EVAL/i,
  /\bPUBLIC[- ]DOMAIN\b/i,
  /\bTEST\s+RUN\b/i,
];

function detectPurpose(title) {
  if (CALIBRATION_PATTERNS.some((re) => re.test(title || ""))) return "calibration";
  return "author_manuscript";
}

function evalStatusLabel(job, purpose) {
  if (job.status === "running") return purpose === "calibration" ? "Calibration in progress" : "In progress";
  if (job.status === "queued") return purpose === "calibration" ? "Calibration queued" : "Queued";
  if (job.status === "failed") return purpose === "calibration" ? "Calibration failed" : "Evaluation failed";
  if (job.status === "complete") return purpose === "calibration" ? "Calibration complete" : "Complete";
  return "—";
}

function evalStatusTone(job, purpose) {
  if (job.status === "complete" && purpose === "calibration") return "border-blue-300 bg-blue-50 text-blue-950";
  if (job.status === "complete") return "border-green-300 bg-green-50 text-green-950";
  if (job.status === "failed") return "border-red-300 bg-red-50 text-red-950";
  if (job.status === "running") return "border-blue-300 bg-blue-50 text-blue-950";
  if (job.status === "queued") return "border-amber-300 bg-amber-50 text-amber-950";
  return "border-stone-300 bg-stone-50 text-stone-900";
}

function getReportHref(job) {
  return job.status === "complete" ? `/reports/${job.id}` : `/evaluate/${job.id}`;
}

function EvaluationHistoryTable({ jobs }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-300 text-left text-base">
          <thead className="bg-[#F4EFE5]">
            <tr>
              {['Status', 'Manuscript', 'Submitted', 'Phase', 'Report', 'Actions'].map((heading) => (
                <th key={heading} className={`px-5 py-4 font-rg-mono text-[0.8rem] font-bold uppercase tracking-[0.12em] text-stone-900 ${heading === 'Actions' ? 'text-right' : ''}`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 bg-white">
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
  const title = job.manuscript_title || "Untitled Manuscript";
  const purpose = detectPurpose(title);
  const isComplete = job.status === "complete";
  const isQueued = job.status === "queued";
  const isRunning = job.status === "running";
  const reportHref = getReportHref(job);
  const detailHref = `/evaluate/${job.id}`;

  return (
    <tr className="align-middle transition hover:bg-[#FBFAF7]">
      <td className="whitespace-nowrap px-5 py-4">
        <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-bold ${evalStatusTone(job, purpose)}`}>
          {evalStatusLabel(job, purpose)}
        </span>
      </td>
      <td className="px-5 py-4">
        <Link href={reportHref} className="block max-w-[30rem] text-base font-bold leading-6 text-stone-950 underline-offset-4 hover:underline">
          {title}
        </Link>
        <span className="font-mono text-sm text-stone-600" title={job.id}>{job.id.slice(0, 8)}…</span>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-base font-medium text-stone-800" title={job.created_at ? new Date(job.created_at).toLocaleString() : undefined}>
        {formatSubmittedAt(job.created_at)}
      </td>
      <td className="max-w-[20rem] px-5 py-4 text-base font-medium text-stone-800">
        <Link href={detailHref} className="line-clamp-2 underline-offset-4 hover:text-stone-950 hover:underline" title={displayInfo.message || displayInfo.progress?.display || undefined}>
          {getPhaseLabel(job, displayInfo)}
        </Link>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-base">
        {isComplete ? (
          <Link
            href={reportHref}
            onClick={() => appendUserActivity({ event: "evaluate.report.opened", route: "/evaluate", href: reportHref, linkLabel: "View report from evaluation history", detail: `job_id=${job.id}` })}
            className="font-bold text-green-900 underline underline-offset-4 hover:text-green-950"
          >
            Open report
          </Link>
        ) : (
          <span className="font-medium text-stone-500">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link href={detailHref} className="inline-flex min-h-[40px] items-center rounded-lg border border-stone-300 bg-stone-50 px-4 py-2 font-rg-mono text-sm font-bold uppercase tracking-[0.08em] text-stone-900 transition hover:bg-stone-100">
            {isRunning ? "Live" : isQueued ? "Queued" : "Details"}
          </Link>
          {canShowCancelButton(job.status, job.progress) && (
            <CancelEvaluationButton jobId={job.id} label="Cancel" buttonClassName="inline-flex min-h-[40px] items-center rounded-lg bg-red-700 px-4 py-2 font-rg-mono text-sm font-bold uppercase tracking-[0.08em] text-white shadow-sm transition-colors hover:bg-red-800" />
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
        <div className="text-lg font-semibold text-stone-800">Loading evaluations…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF]">
        <div className="text-lg font-semibold text-red-800">Failed to load evaluations.</div>
      </div>
    );
  }

  const sortedJobs = [...jobs].sort(sortJobsByCreatedAtDesc);
  const hasNoJobs = sortedJobs.length === 0;
  const mostRecentJob = sortedJobs[0];
  const showCompletionBanner = mostRecentJob && mostRecentJob.status === "complete";

  return (
    <div className="min-h-screen bg-[#F7F4EF] py-5 text-[18px] text-stone-950 sm:py-6 lg:py-7">
      <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-3xl border border-stone-300 bg-white/95 p-5 shadow-sm sm:p-6 lg:p-7">
          <p className="font-rg-mono text-[0.82rem] font-bold uppercase tracking-[0.18em] text-[#8A5A00]">Evaluate</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(27rem,0.95fr)] lg:items-start">
            <div>
              <h1 className="max-w-3xl font-rg-serif text-5xl leading-[0.95] text-stone-950 sm:text-6xl lg:text-7xl">
                Begin manuscript evaluation.
              </h1>
              <p className="mt-5 max-w-4xl text-xl leading-9 text-stone-900">
                Submit existing writing into the correct diagnostic path. Short-form work is evaluated against the 13 story criteria; long-form manuscripts qualify for manuscript-scale readiness analysis.
              </p>

              <div className="mt-6 rounded-2xl border border-stone-300 bg-[#FBFAF7] p-5 sm:p-6">
                <p className="font-rg-mono text-[0.82rem] font-bold uppercase tracking-[0.14em] text-[#8A5A00]">Word Count Guide</p>
                <ul className="mt-4 grid gap-x-8 gap-y-2 text-lg leading-8 text-stone-900 sm:grid-cols-2">
                  <li><span className="font-bold text-stone-950">Flash / Excerpt</span> — 200–749 words</li>
                  <li><span className="font-bold text-stone-950">Scene / Chapter</span> — 750–5,999 words</li>
                  <li><span className="font-bold text-stone-950">Multi-chapter</span> — 6,000–7,499 words</li>
                  <li><span className="font-bold text-stone-950">Novelette</span> — 7,500–19,999 words</li>
                  <li><span className="font-bold text-stone-950">Novella</span> — 20,000–49,999 words</li>
                  <li><span className="font-bold text-stone-950">Novel</span> — 50,000+ words</li>
                </ul>
                <p className="mt-4 text-base leading-7 text-stone-800">
                  RevisionGrade automatically classifies your submission and adjusts confidence thresholds based on manuscript length.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {evaluationModes.map((mode) => (
                <div key={mode.label} className="rounded-2xl border border-stone-300 bg-[#FBFAF7] p-5 sm:p-6">
                  <p className="font-rg-mono text-[0.78rem] font-bold uppercase tracking-[0.12em] text-[#8A5A00]">{mode.range}</p>
                  <h2 className="mt-2 font-rg-serif text-3xl leading-tight text-stone-950">{mode.label}</h2>
                  <p className="mt-3 text-lg leading-8 text-stone-900">{mode.copy}</p>
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

        <section className="mt-8 rounded-3xl border border-stone-300 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-rg-mono text-[0.82rem] font-bold uppercase tracking-[0.16em] text-[#8A5A00]">History</p>
              <h2 className="mt-1 font-rg-serif text-4xl text-stone-950">Recent evaluations</h2>
              <p className="mt-2 max-w-3xl text-base leading-7 text-stone-800">
                Each evaluation is shown as one readable job row with its status, ID, phase, next action, and report link.
              </p>
            </div>
          </div>

          {hasNoJobs ? (
            <div className="rounded-2xl border border-stone-300 bg-[#FBFAF7] p-10 text-center">
              <div className="mx-auto max-w-md">
                <h3 className="font-rg-serif text-3xl text-stone-950">No evaluations yet</h3>
                <p className="mt-2 text-base text-stone-800">Choose a manuscript, upload a file, or paste text above to begin your first evaluation.</p>
              </div>
            </div>
          ) : (
            <EvaluationHistoryTable jobs={sortedJobs.slice(0, 15)} />
          )}
        </section>
      </div>
    </div>
  );
}
