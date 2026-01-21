"use client";

import Link from "next/link";

/**
 * Track C: Completion Banner
 * Track D: Wire to real report route
 * Makes completion feel intentional with prominent CTA
 */
export default function CompletionBanner({ jobId }) {
  return (
    <div className="bg-green-50 border-l-4 border-green-500 p-6 mb-6 rounded-r-lg shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-8 w-8 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-green-900">
            Evaluation Complete!
          </h3>
          <p className="mt-1 text-sm text-green-700">
            Your manuscript has been analyzed. View your comprehensive evaluation report with detailed feedback and revision guidance.
          </p>
          <div className="mt-4">
            <Link
              href={`/evaluate/${jobId}`}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <svg
                className="mr-2 h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              View Evaluation Report
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
