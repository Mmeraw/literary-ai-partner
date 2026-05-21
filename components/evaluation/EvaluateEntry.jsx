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
import CompletionBanner from "./CompletionBanner";
import { CancelEvaluationButton } from "./CancelEvaluationButton";

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
  @import url('https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600&display=swap');
`;

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

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "#0D0A05", fontFamily: "'Switzer', 'Inter', system-ui, sans-serif" }}>
        <style>{FONTS}</style>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-[#C8A96E] border-t-transparent animate-spin" />
          <span className="text-sm text-[#6B6560]">Loading…</span>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "#0D0A05", fontFamily: "'Switzer', 'Inter', system-ui, sans-serif" }}>
        <style>{FONTS}</style>
        <p className="text-sm text-[#A7472A]">Failed to load evaluations.</p>
      </div>
    );
  }

  const sortedJobs = [...jobs].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const hasNoJobs = sortedJobs.length === 0;
  const mostRecentJob = sortedJobs[0];
  const showCompletionBanner = mostRecentJob && mostRecentJob.status === "complete";

  return (
    <div className="min-h-screen" style={{ background: "#0D0A05", fontFamily: "'Switzer', 'Inter', system-ui, sans-serif" }}>
      <style>{FONTS}</style>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid #1E180F" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#C8A96E] mb-3">
            RevisionGrade™ · Evaluate
          </p>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(2rem, 4vw, 3rem)", color: "#F5EFE0", lineHeight: 1.1, fontWeight: 400 }}>
            Submit your manuscript.<br />
            <em style={{ color: "#C8A96E" }}>Let the engine read it.</em>
          </h1>
          <p className="mt-4 text-[#B8AE9C] max-w-xl" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
            Upload or paste your writing. The engine evaluates 13 story criteria, scores them with evidence, and delivers a governed report you can act on.
          </p>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Completion banner */}
        {showCompletionBanner && (
          <div className="mb-8">
            <CompletionBanner jobId={mostRecentJob.id} />
          </div>
        )}

        {/* Submission form */}
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

        {/* ── Evaluation History ───────────────────────────────────── */}
        <div className="mt-14">
          <div className="flex items-center justify-between mb-6">
            <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "1.5rem", color: "#F5EFE0", fontWeight: 400 }}>
              Evaluation History
            </h2>
            {!hasNoJobs && (
              <span className="text-xs text-[#4A4440]">{sortedJobs.length} evaluation{sortedJobs.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {hasNoJobs ? (
            <div className="rounded-xl border border-[#1E180F] bg-[#14110C] p-12 text-center">
              <svg className="mx-auto h-10 w-10 text-[#2A2218] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium text-[#6B6560]">No evaluations yet</p>
              <p className="mt-1 text-xs text-[#4A4440]">Submit your manuscript above to run your first evaluation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedJobs.map((job) => {
                const displayInfo = getJobDisplayInfo(job);
                const isComplete = job.status === "complete";
                const isQueued = job.status === "queued";
                const isRunning = job.status === "running";
                const isFailed = job.status === "failed";
                const relativeTime = formatRelativeTime(job.created_at);

                const phaseInfo = getPhaseSpecificCopy(
                  displayInfo.phaseDetail.phase,
                  displayInfo.phaseDetail.phase_status
                );

                let statusLabel, statusColor, statusDot;
                if (isComplete) {
                  statusLabel = "Complete"; statusColor = "#7FA36B"; statusDot = "#7FA36B";
                } else if (isRunning) {
                  statusLabel = "In progress"; statusColor = "#C8A96E"; statusDot = "#C8A96E";
                } else if (isQueued) {
                  statusLabel = "Queued"; statusColor = "#6B6560"; statusDot = "#6B6560";
                } else {
                  statusLabel = "Failed"; statusColor = "#A7472A"; statusDot = "#A7472A";
                }

                let progressLabel = "";
                if (isQueued) progressLabel = "Preparing evaluation…";
                else if (isRunning) progressLabel = phaseInfo.displayCopy;
                else if (isComplete) progressLabel = "Report ready";
                else if (isFailed) progressLabel = displayInfo.message || "Evaluation failed";

                const progressPct = isRunning && displayInfo.progress.total > 0
                  ? displayInfo.progress.percentage
                  : null;

                return (
                  <div key={job.id}
                    className="rounded-xl border border-[#1E180F] bg-[#14110C] px-5 py-4 transition-colors hover:border-[#2A2218]">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">

                      {/* Status dot + info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="shrink-0 mt-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ background: statusDot,
                            boxShadow: isRunning ? `0 0 6px ${statusDot}` : "none" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm font-medium" style={{ color: statusColor }}>
                              {statusLabel}
                            </span>
                            {job.manuscript_id && (
                              <span className="text-xs text-[#4A4440]">Manuscript #{job.manuscript_id}</span>
                            )}
                            <span className="text-xs text-[#4A4440]">{relativeTime}</span>
                          </div>
                          {progressLabel && (
                            <p className="text-xs text-[#6B6560] mt-0.5">{progressLabel}</p>
                          )}
                          {progressPct !== null && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1 rounded-full bg-[#1E180F]">
                                <div className="h-1 rounded-full bg-[#C8A96E] transition-all duration-500"
                                  style={{ width: `${progressPct}%` }} />
                              </div>
                              <span className="text-xs text-[#6B6560] shrink-0">{progressPct}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isComplete && (
                          <Link
                            href={`/evaluate/${job.id}`}
                            onClick={() => appendUserActivity({
                              event: "evaluate.report.opened",
                              route: "/evaluate",
                              href: `/evaluate/${job.id}`,
                              linkLabel: "Open evaluation report",
                              detail: `job_id=${job.id}`,
                            })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#C8A96E] bg-[#C8A96E] px-4 py-2 text-xs font-semibold text-[#0D0A05] hover:bg-[#D9BB82] transition-colors"
                          >
                            View report →
                          </Link>
                        )}
                        {(isRunning || isQueued) && (
                          <>
                            <Link href={`/evaluate/${job.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2218] px-4 py-2 text-xs font-medium text-[#B8AE9C] hover:border-[#C8A96E] hover:text-[#C8A96E] transition-colors">
                              {isRunning ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2.5 w-2.5 rounded-full border border-[#C8A96E] border-t-transparent animate-spin" />
                                  Track progress
                                </span>
                              ) : "View status"}
                            </Link>
                            <CancelEvaluationButton
                              jobId={job.id}
                              label="Cancel"
                              buttonClassName="inline-flex items-center rounded-lg border border-[#2A2218] px-3 py-2 text-xs font-medium text-[#6B6560] hover:border-[#A7472A] hover:text-[#A7472A] transition-colors"
                            />
                          </>
                        )}
                        {isFailed && (
                          <Link href={`/evaluate/${job.id}`}
                            className="inline-flex items-center rounded-lg border border-[#7A2B1A44] px-4 py-2 text-xs font-medium text-[#A7472A] hover:border-[#A7472A] transition-colors">
                            View details
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-12 text-center text-xs text-[#2A2218]">
          Framework-driven analysis does not replace human editorial judgment.
        </p>
      </div>
    </div>
  );
}
