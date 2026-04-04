"use client";

import React from "react";
import Link from "next/link";
import { appendUserActivity } from "@/lib/activity/userActivity";
import { useJobs } from "../../lib/jobs/useJobs";
import { getJobDisplayInfo, getJobStatusBadge } from "../../lib/jobs/ui-helpers";
import { formatRelativeTime, formatDuration } from "../../lib/ui/time-helpers";
import { getPhaseSpecificCopy } from "../../lib/ui/phase-helpers";
import ManuscriptSubmissionForm from "./ManuscriptSubmissionForm";
import CompletionBanner from "./CompletionBanner";

/**
 * Day-1 Evaluation UI — Track A
 * 
 * Single entry point for users to:
 * 1. Submit manuscript text
 * 2. Start an evaluate_full job
 * 3. See live job status
 * 4. Reach "evaluation complete" state
 * 5. Click "View Evaluation Report" CTA
 */
export default function EvaluateEntry() {
  const { jobs, isLoading, isError } = useJobs();

  React.useEffect(() => {
    appendUserActivity({
      event: "evaluate.page.viewed",
      route: "/evaluate",
      href: "/evaluate",
      linkLabel: "Open Evaluate",
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading evaluations…</div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Failed to load evaluations.</div>
      </div>
    );
  }

  // Sort jobs by created_at DESC (newest first)
  const sortedJobs = [...jobs].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Empty state: No jobs yet
  const hasNoJobs = sortedJobs.length === 0;
  
  // Track C: Check if most recent job is complete
  const mostRecentJob = sortedJobs[0];
  const showCompletionBanner = mostRecentJob && mostRecentJob.status === "complete";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Manuscript Evaluation
          </h1>
          <p className="mt-2 text-gray-600">
            Submit your manuscript for comprehensive AI-powered evaluation
          </p>
        </div>

        {/* Track A: Submission Form */}
        <ManuscriptSubmissionForm />

        {/* Track C: Completion Banner */}
        {showCompletionBanner && (
          <div className="mt-8">
            <CompletionBanner jobId={mostRecentJob.id} />
          </div>
        )}

        {/* Job Status Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Evaluation History
          </h2>

          {hasNoJobs ? (
            // Empty State
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
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
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  No evaluations yet
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Submit your manuscript above to run your first evaluation
                </p>
              </div>
            </div>
          ) : (
            // Jobs List
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Manuscript ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phase
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedJobs.map((job) => {
                      const displayInfo = getJobDisplayInfo(job);
                      const statusBadge = getJobStatusBadge(displayInfo.badge);
                      const isComplete = job.status === "complete";
                      const isQueued = job.status === "queued";
                      const isRunning = job.status === "running";
                      const isFailed = job.status === "failed";
                      const relativeTime = formatRelativeTime(job.created_at);
                      
                      // Track C: Phase-specific copy
                      const phaseInfo = getPhaseSpecificCopy(
                        displayInfo.phaseDetail.phase,
                        displayInfo.phaseDetail.phase_status
                      );
                      
                      // Track B + C: Reassuring progress messages with phase-specific copy
                      let progressMessage = displayInfo.message || displayInfo.progress.display;
                      let subMessage = null;
                      
                      if (isQueued) {
                        progressMessage = "Preparing evaluation…";
                        subMessage = "This usually takes ~2–3 minutes";
                      } else if (isRunning) {
                        const duration = formatDuration(job.created_at);
                        // Track C: Use phase-specific copy
                        progressMessage = phaseInfo.displayCopy;
                        subMessage = `Running for ${duration} • ${phaseInfo.description}`;
                      } else if (isComplete) {
                        progressMessage = "Evaluation complete";
                        subMessage = "Ready to view your comprehensive report";
                      } else if (isFailed) {
                        progressMessage = "Evaluation failed";
                        subMessage = displayInfo.message || "An error occurred during processing";
                      }

                      return (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {job.manuscript_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {displayInfo.phaseDetail.display || "—"}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="text-gray-900">{progressMessage}</div>
                            {subMessage && (
                              <div className="text-xs text-gray-500 mt-1">{subMessage}</div>
                            )}
                            {/* Show progress bar for running jobs */}
                            {isRunning && displayInfo.progress.total > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                  <span>Progress</span>
                                  <span>{displayInfo.progress.percentage}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${displayInfo.progress.percentage}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>{relativeTime}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(job.created_at).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                              >
                                View Evaluation Report
                              </Link>
                            ) : isRunning ? (
                              <div className="flex items-center text-blue-600">
                                <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-xs font-medium">Processing</span>
                              </div>
                            ) : isQueued ? (
                              <div className="flex items-center text-gray-500">
                                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs">Queued</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">{statusBadge.label}</span>
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
        </div>
      </div>
    </div>
  );
}
