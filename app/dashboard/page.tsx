import EmptyState from '@/components/dashboard/EmptyState'
import AuthorProgressLedger from '@/components/dashboard/AuthorProgressLedger'
import {
  getDashboardEvaluations,
  computeDashboardKpis,
} from '@/lib/dashboard/getDashboardEvaluations'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { rows, error } = await getDashboardEvaluations({ limit: 15 })

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

  return (
    <div className="rg-dash-page">
      <AuthorProgressLedger rows={rows} kpis={kpis} />
      <p className="rg-dash-footnote">
        Submission readiness indicates a manuscript has reached a RevisionGrade quality
        threshold associated with stronger submission potential. It is a curation
        threshold, not a promise of industry response. Progress claims require a later
        evaluation to confirm measured movement.
      </p>
    </div>
  )
}
