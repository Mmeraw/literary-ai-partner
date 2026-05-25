import Link from 'next/link'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import KpiCard from '@/components/dashboard/KpiCard'
import EvaluationHistoryTable from '@/components/dashboard/EvaluationHistoryTable'
import EmptyState from '@/components/dashboard/EmptyState'
import {
  getDashboardEvaluations,
  computeDashboardKpis,
} from '@/lib/dashboard/getDashboardEvaluations'

export const dynamic = 'force-dynamic'

function formatScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '—'
}

function getScoreDelta(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return 'Awaiting comparison'
  const delta = current - previous
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs prior evaluation`
}

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
  const sortedRows = [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const latest = sortedRows[0]
  const priorSameManuscript = sortedRows.find(
    (row) => row.manuscriptId === latest.manuscriptId && row.id !== latest.id,
  )
  const latestTopScore = Math.max(latest.overallScore ?? 0, latest.readinessScore ?? 0)
  const latestIsReady = latestTopScore >= 8
  const latestIsActionable = latest.status === 'failed' || latest.status === 'running'

  return (
    <div className="rg-dash-page">
      <DashboardHeader />

      <section className="rg-current-focus" aria-label="Current manuscript focus">
        <div>
          <div className="rg-dash-context-label">Current manuscript focus</div>
          <h2>{latest.manuscriptTitle}</h2>
          <p>
            Latest status: {latest.status === 'running'
              ? 'evaluation in progress'
              : latest.status === 'failed'
              ? 'needs attention'
              : latestIsReady
              ? 'readiness threshold met'
              : 'below readiness threshold'}.
          </p>
        </div>
        <div className="rg-current-focus-grid">
          <div className="rg-current-focus-metric">
            <span>Overall</span>
            <strong>{formatScore(latest.overallScore)}</strong>
            <small>{getScoreDelta(latest.overallScore, priorSameManuscript?.overallScore ?? null)}</small>
          </div>
          <div className="rg-current-focus-metric">
            <span>Ready</span>
            <strong>{formatScore(latest.readinessScore)}</strong>
            <small>{getScoreDelta(latest.readinessScore, priorSameManuscript?.readinessScore ?? null)}</small>
          </div>
          <div className="rg-current-focus-actions">
            <Link href={latest.reportHref} className="rg-current-primary">
              {latestIsActionable ? 'Open details' : 'Open latest report'}
            </Link>
            <Link href="/revise" className="rg-current-secondary">
              Continue Revise
            </Link>
            <Link href="/evaluate" className="rg-current-secondary">
              Re-evaluate
            </Link>
          </div>
        </div>
      </section>

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

      <section className="rg-progress-preview" aria-label="Revision progress analytics preview">
        <div>
          <div className="rg-dash-context-label">Progress analytics</div>
          <h2>Diagnosis, repair, measurement.</h2>
          <p>
            This dashboard will track category movement, recurring issue reduction, Revise decisions, TrustedPath batches, and before/after evaluation deltas. Until a follow-up evaluation runs, revision activity is shown as activity—not confirmed improvement.
          </p>
        </div>
        <div className="rg-progress-preview-grid">
          <div><strong>Criteria movement</strong><span>Score deltas across the 13 story criteria.</span></div>
          <div><strong>Issue frequency</strong><span>Recurring failure types reduced, unchanged, or increased.</span></div>
          <div><strong>Revise decisions</strong><span>Accepted, custom, rejected, kept original, deferred, and TrustedPath activity.</span></div>
        </div>
      </section>

      <EvaluationHistoryTable rows={rows} />

      <p className="rg-dash-footnote">
        Submission readiness indicates a manuscript has reached a RevisionGrade quality
        threshold associated with stronger submission potential. It is a curation
        threshold, not a promise of industry response. Progress claims require a later
        evaluation to confirm measured movement.
      </p>
    </div>
  )
}
