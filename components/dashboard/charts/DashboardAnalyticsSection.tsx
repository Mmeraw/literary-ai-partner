'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardAnalytics, ScoreTrendPoint, ErrorTrendPeriod } from '@/lib/dashboard/getDashboardAnalytics'
import InsightCards from './InsightCards'

// Recharts requires client-side rendering
const ScoreTrendChart = dynamic(() => import('./ScoreTrendChart'), { ssr: false })
const ErrorTrendChart = dynamic(() => import('./ErrorTrendChart'), { ssr: false })

type Props = {
  analytics: DashboardAnalytics
}

export default function DashboardAnalyticsSection({ analytics }: Props) {
  const [selectedManuscript, setSelectedManuscript] = useState<string>('all')

  const filteredScoreTrend = useMemo<ScoreTrendPoint[]>(() => {
    if (selectedManuscript === 'all') return analytics.scoreTrend
    return analytics.scoreTrend.filter((p) => p.manuscriptId === selectedManuscript)
  }, [analytics.scoreTrend, selectedManuscript])

  const filteredErrorTrend = useMemo<ErrorTrendPeriod[]>(() => {
    if (selectedManuscript === 'all') return analytics.errorTrend
    return analytics.errorTrend.filter((p) =>
      analytics.scoreTrend.some(
        (s) => s.jobId === p.jobId && s.manuscriptId === selectedManuscript,
      ),
    )
  }, [analytics.errorTrend, analytics.scoreTrend, selectedManuscript])

  return (
    <div className="space-y-6">
      {/* Manuscript filter */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900">Analytics</h2>
        <select
          value={selectedManuscript}
          onChange={(e) => setSelectedManuscript(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="all">All manuscripts</option>
          {analytics.manuscripts.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </div>

      {/* Charts side by side */}
      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-neutral-300 bg-white p-6 text-neutral-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold">Score Trend</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Scores trending toward the 8.0 market-readiness threshold across evaluations.
              </p>
            </div>
            <span className="rounded-full border border-amber-500/50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
              8.0 ready
            </span>
          </div>
          <div className="mt-4">
            <ScoreTrendChart data={filteredScoreTrend} />
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            A rising line toward 8.0 indicates improving market readiness.
          </p>
        </article>

        <article className="rounded-3xl border border-neutral-300 bg-white p-6 text-neutral-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold">Error Trends</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Recurring craft issues by criterion. Falling bars indicate improvement.
              </p>
            </div>
            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-bold uppercase tracking-wide text-neutral-600">
              {filteredErrorTrend.length} evals
            </span>
          </div>
          <div className="mt-4">
            <ErrorTrendChart data={filteredErrorTrend} />
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Falling bars indicate that repeated craft issues are being resolved over time.
          </p>
        </article>
      </div>

      {/* Insight cards */}
      <InsightCards
        mostImproved={analytics.insights.mostImproved}
        stillBlocking={analytics.insights.stillBlocking}
        recentWins={analytics.insights.recentWins}
      />

      {/* What 8.0 means */}
      <article className="rounded-2xl border border-neutral-300 bg-neutral-50 p-5 text-neutral-950">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
          What 8.0 means
        </p>
        <p className="mt-3 text-sm leading-7 text-neutral-700">
          A score of 8.0 or above indicates market readiness within the RevisionGrade
          framework. It supports later curation review eligibility through Storygate Studio.
          It does not promise publication, representation, or agent response. Scores reflect
          alignment with contemporary agent-submission standards, not literary merit.
        </p>
      </article>
    </div>
  )
}
