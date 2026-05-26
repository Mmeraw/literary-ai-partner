import Link from 'next/link'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import KpiCard from '@/components/dashboard/KpiCard'
import EvaluationHistoryTable from '@/components/dashboard/EvaluationHistoryTable'
import EmptyState from '@/components/dashboard/EmptyState'
import {
  getDashboardEvaluations,
  computeDashboardKpis,
  type DashboardEvaluationRow,
} from '@/lib/dashboard/getDashboardEvaluations'

export const dynamic = 'force-dynamic'

function formatScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '—'
}

function getScoreDelta(current: number | null, previous: number | null): string {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 'Awaiting comparison'
  const delta = current - previous
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs prior evaluation`
}

function getAgentReadinessHref(row: { manuscriptId: string; jobId: string }): string {
  const params = new URLSearchParams({
    manuscriptId: row.manuscriptId,
    evaluationJobId: row.jobId,
  })
  return `/agent-readiness?${params.toString()}`
}

function canBuildAgentReadiness(status: string): boolean {
  return status !== 'failed' && status !== 'running'
}

function getCompletedRowsForLatestManuscript(rows: DashboardEvaluationRow[]): DashboardEvaluationRow[] {
  const latest = rows[0]
  if (!latest) return []
  return rows
    .filter((row) => row.manuscriptId === latest.manuscriptId && row.status !== 'running' && row.status !== 'failed')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function getPercent(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value * 10))
}

function getReadinessDeltaLabel(points: DashboardEvaluationRow[]): string {
  if (points.length < 2) return 'Needs a second completed evaluation'
  const first = points[0].readinessScore
  const last = points[points.length - 1].readinessScore
  if (first == null || last == null) return 'Awaiting comparable readiness scores'
  const delta = last - first
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} readiness since first tracked run`
}

function formatShortDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function countByStatus(rows: DashboardEvaluationRow[]): Array<{ label: string; count: number; className: string }> {
  const buckets = [
    { key: 'market_ready', label: 'Ready', className: 'rg-analytics-bar--gold' },
    { key: 'near_ready', label: 'Near', className: 'rg-analytics-bar--amber' },
    { key: 'improving', label: 'Improving', className: 'rg-analytics-bar--teal' },
    { key: 'below_standard', label: 'Below', className: 'rg-analytics-bar--muted' },
    { key: 'running', label: 'Running', className: 'rg-analytics-bar--blue' },
    { key: 'failed', label: 'Failed', className: 'rg-analytics-bar--red' },
  ]
  return buckets.map((bucket) => ({
    label: bucket.label,
    className: bucket.className,
    count: rows.filter((row) => row.status === bucket.key).length,
  }))
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
  const latest = rows[0]
  const priorSameManuscript = rows.find(
    (row) => row.manuscriptId === latest.manuscriptId && row.id !== latest.id,
  )
  const latestTopScore = Math.max(latest.overallScore ?? 0, latest.readinessScore ?? 0)
  const latestIsReady = latestTopScore >= 8
  const latestIsActionable = latest.status === 'failed' || latest.status === 'running'
  const latestCanBuildAgentReadiness = canBuildAgentReadiness(latest.status)
  const latestManuscriptPoints = getCompletedRowsForLatestManuscript(rows)
  const statusBuckets = countByStatus(rows)
  const maxStatusCount = Math.max(1, ...statusBuckets.map((bucket) => bucket.count))

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
            {latestCanBuildAgentReadiness && (
              <Link href={getAgentReadinessHref(latest)} className="rg-current-secondary">
                Build Agent Readiness Package
              </Link>
            )}
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

      <section className="rg-analytics-board" aria-label="Progress analytics">
        <div className="rg-analytics-intro">
          <div>
            <div className="rg-dash-context-label">Progress analytics</div>
            <h2>Measured movement, not vanity telemetry.</h2>
            <p>
              The charts below use evaluation data already available today. Deeper issue-frequency, Revise-decision, TrustedPath, and before/after repair analytics remain clearly marked until those runtime events are persisted.
            </p>
          </div>
          <div className="rg-analytics-note">
            <strong>{getReadinessDeltaLabel(latestManuscriptPoints)}</strong>
            <span>{latestManuscriptPoints.length} completed evaluation{latestManuscriptPoints.length === 1 ? '' : 's'} tracked for the current manuscript.</span>
          </div>
        </div>

        <div className="rg-analytics-grid">
          <article className="rg-analytics-card rg-analytics-card--wide">
            <div className="rg-analytics-card-head">
              <h3>Readiness over time</h3>
              <span>Current manuscript</span>
            </div>
            <div className="rg-trend-bars" role="list" aria-label="Readiness trend by completed evaluation">
              {latestManuscriptPoints.length > 0 ? latestManuscriptPoints.map((point) => (
                <div className="rg-trend-point" role="listitem" key={point.id}>
                  <div className="rg-trend-track">
                    <span style={{ height: `${getPercent(point.readinessScore)}%` }} />
                  </div>
                  <strong>{formatScore(point.readinessScore)}</strong>
                  <small>{formatShortDate(point.createdAt)}</small>
                </div>
              )) : (
                <p className="rg-analytics-empty">No completed evaluations yet for this manuscript.</p>
              )}
            </div>
          </article>

          <article className="rg-analytics-card">
            <div className="rg-analytics-card-head">
              <h3>Latest score bars</h3>
              <span>0–10 scale</span>
            </div>
            <div className="rg-score-bars">
              <div>
                <span>Overall</span>
                <div><i style={{ width: `${getPercent(latest.overallScore)}%` }} /></div>
                <strong>{formatScore(latest.overallScore)}</strong>
              </div>
              <div>
                <span>Readiness</span>
                <div><i style={{ width: `${getPercent(latest.readinessScore)}%` }} /></div>
                <strong>{formatScore(latest.readinessScore)}</strong>
              </div>
            </div>
          </article>

          <article className="rg-analytics-card">
            <div className="rg-analytics-card-head">
              <h3>Evaluation status mix</h3>
              <span>Recent activity</span>
            </div>
            <div className="rg-status-bars">
              {statusBuckets.map((bucket) => (
                <div key={bucket.label}>
                  <span>{bucket.label}</span>
                  <div><i className={bucket.className} style={{ width: `${(bucket.count / maxStatusCount) * 100}%` }} /></div>
                  <strong>{bucket.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="rg-analytics-card rg-analytics-card--pending">
            <div className="rg-analytics-card-head">
              <h3>Issue frequency</h3>
              <span>Pending runtime data</span>
            </div>
            <p>Will show recurring failure types reduced, unchanged, or increased once criterion-level issue events are persisted.</p>
          </article>

          <article className="rg-analytics-card rg-analytics-card--pending">
            <div className="rg-analytics-card-head">
              <h3>Revise decisions</h3>
              <span>Pending runtime data</span>
            </div>
            <p>Will separate accepted A/B/C options, custom rewrites, keep-original decisions, rejects, deferrals, and TrustedPath batches.</p>
          </article>

          <article className="rg-analytics-card rg-analytics-card--pending">
            <div className="rg-analytics-card-head">
              <h3>Before / after deltas</h3>
              <span>Requires re-evaluation</span>
            </div>
            <p>Will compare pre-revision and post-revision evaluations before claiming manuscript improvement.</p>
          </article>
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
