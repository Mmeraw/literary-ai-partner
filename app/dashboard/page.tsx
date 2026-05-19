import DashboardHeader from '@/components/dashboard/DashboardHeader'
import KpiCard from '@/components/dashboard/KpiCard'
import EvaluationHistoryTable from '@/components/dashboard/EvaluationHistoryTable'
import EmptyState from '@/components/dashboard/EmptyState'
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
        <DashboardHeader />
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
        <DashboardHeader />
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
      <DashboardHeader />

      <section className="rg-kpi-row" aria-label="Summary metrics">
        <KpiCard
          label="Latest overall score"
          value={kpis.latestOverall.value}
          meta={kpis.latestOverall.meta}
          delta={kpis.latestOverall.delta}
          deltaTone={kpis.latestOverall.deltaTone}
        />
        <KpiCard
          label="Latest readiness score"
          value={kpis.latestReadiness.value}
          meta={kpis.latestReadiness.meta}
          delta={kpis.latestReadiness.delta}
          deltaTone={kpis.latestReadiness.deltaTone}
        />
        <KpiCard
          label="Best dimension score"
          value={kpis.bestScore.value}
          meta={kpis.bestScore.meta}
          delta={kpis.bestScore.delta}
          deltaTone={kpis.bestScore.deltaTone}
        />
        <KpiCard
          label="Curation-ready manuscripts"
          value={kpis.curationReady.value}
          meta={kpis.curationReady.meta}
          delta={kpis.curationReady.delta}
          deltaTone={kpis.curationReady.deltaTone}
        />
      </section>

      <EvaluationHistoryTable rows={rows} />

      <p className="rg-dash-footnote">
        Submission readiness indicates a manuscript has reached a RevisionGrade quality
        threshold associated with stronger submission potential. It is a curation
        threshold, not a promise of industry response.
      </p>
    </div>
  )
}
