import EmptyState from '@/components/dashboard/EmptyState'
import AuthorProgressLedger from '@/components/dashboard/AuthorProgressLedger'
import DashboardAnalyticsSection from '@/components/dashboard/charts/DashboardAnalyticsSection'
import {
  getDashboardEvaluations,
  computeDashboardKpis,
} from '@/lib/dashboard/getDashboardEvaluations'
import { getDashboardAnalytics } from '@/lib/dashboard/getDashboardAnalytics'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { rows, reviseAnalytics, error } = await getDashboardEvaluations({ limit: 15 })

  if (error) {
    return (
      <div className="rg-dash-page">
        <EmptyState
          title="We couldn't load your evaluations"
          body="Please refresh the page. If the problem continues, contact support."
          ctaHref="/dashboard"
          ctaLabel="Try again"
        />
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="rg-dash-page">
        <EmptyState
          title="No evaluations yet"
          body="Run your first RevisionGrade evaluation to start tracking scores, trends, and submission readiness."
          ctaHref="/evaluate"
          ctaLabel="Start evaluation"
        />
      </div>
    )
  }

  const kpis = computeDashboardKpis(rows)
  const analytics = await getDashboardAnalytics()

  return (
    <div className="rg-dash-page">
      <AuthorProgressLedger rows={rows} kpis={kpis} reviseAnalytics={reviseAnalytics} />
      {analytics && (
        <div className="mt-8">
          <DashboardAnalyticsSection analytics={analytics} />
        </div>
      )}
      <p className="rg-dash-footnote">
        Agent readiness indicates a manuscript has reached a RevisionGrade quality
        threshold associated with stronger submission potential. It is a curation
        threshold, not a promise of industry response. Scores reflect alignment with
        contemporary agent-submission standards, not literary merit. Published classics
        may score differently than unpublished manuscripts optimized for today&#39;s market.
        Progress claims require a later evaluation to confirm measured movement.
      </p>
    </div>
  )
}
