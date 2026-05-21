"use client";

import Link from "next/link";

/** Completion banner — dark design system */
export default function CompletionBanner({ jobId }) {
  return (
    <div className="rounded-xl border border-[#7FA36B44] bg-[#7FA36B0D] px-6 py-5 mb-6"
      style={{ fontFamily: "'Switzer', 'Inter', system-ui, sans-serif" }}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5">
          <svg className="h-6 w-6 text-[#7FA36B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#7FA36B] uppercase tracking-widest">Evaluation complete</p>
          <p className="mt-1 text-sm text-[#B8AE9C]">
            Your report is ready — scores, rationale, and revision guidance.
          </p>
          <div className="mt-4">
            <Link href={`/evaluate/${jobId}`}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C8A96E] bg-[#C8A96E] px-5 py-2.5 text-sm font-semibold text-[#0D0A05] hover:bg-[#D9BB82] transition-colors">
              View report →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
