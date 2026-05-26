import Link from 'next/link'
import EvaluationHistoryTable from './EvaluationHistoryTable'

const fmt = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '—')
const pct = (n) => (typeof n === 'number' ? `${Math.max(0, Math.min(100, n * 10))}%` : '0%')
const d = (v) => {
  const date = new Date(v)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function packageHref(row) {
  const params = new URLSearchParams({ manuscriptId: row.manuscriptId, evaluationJobId: row.jobId })
  return `/agent-readiness?${params.toString()}`
}

function workbenchHref(row) {
  const params = new URLSearchParams({ manuscriptId: row.manuscriptId, evaluationJobId: row.jobId })
  return `/workbench?${params.toString()}`
}

function trend(rows, latest) {
  return rows
    .filter((r) => r.manuscriptId === latest.manuscriptId && r.status !== 'running' && r.status !== 'failed')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-6)
}

export default function AuthorProgressLedger({ rows, kpis }) {
  const latest = rows[0]
  const prior = rows.find((r) => r.manuscriptId === latest.manuscriptId && r.id !== latest.id)
  const overallDelta = typeof latest.overallScore === 'number' && typeof prior?.overallScore === 'number' ? latest.overallScore - prior.overallScore : null
  const readinessDelta = typeof latest.readinessScore === 'number' && typeof prior?.readinessScore === 'number' ? latest.readinessScore - prior.readinessScore : null
  const topScore = Math.max(latest.overallScore ?? 0, latest.readinessScore ?? 0)
  const points = trend(rows, latest)
  const canPackage = latest.status !== 'running' && latest.status !== 'failed'

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-neutral-300 bg-white p-8 text-neutral-950">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Dashboard · author progress ledger</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-5xl">Track the path from evaluation to readiness.</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-neutral-600">Your dashboard is included with paid audits. It shows evaluation history, score movement, current readiness, and the Revise analytics that will activate once repair data is persisted.</p>
          </div>
          <div className="grid gap-2 min-w-56">
            <Link href={latest.reportHref} className="rounded-full bg-neutral-950 px-5 py-3 text-center text-sm font-bold text-white">Open latest report</Link>
            <Link href={workbenchHref(latest)} className="rounded-full border border-neutral-300 px-5 py-3 text-center text-sm font-bold text-neutral-900">Open Revise Workbench</Link>
            {canPackage && <Link href={packageHref(latest)} className="rounded-full border border-neutral-300 px-5 py-3 text-center text-sm font-bold text-neutral-900">Build Agent Readiness</Link>}
            <Link href="/evaluate" className="rounded-full border border-neutral-300 px-5 py-3 text-center text-sm font-bold text-neutral-900">Run re-evaluation</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Latest overall', kpis.latestOverall.value, overallDelta == null ? 'Awaiting comparison' : `${overallDelta >= 0 ? '+' : ''}${overallDelta.toFixed(1)} vs prior`],
          ['Market readiness', kpis.latestReadiness.value, 'Threshold is 8.0'],
          ['Best score', kpis.bestScore.value, kpis.bestScore.delta],
          ['Ready for review', kpis.curationReady.value, 'Latest works at or above 8.0'],
        ].map(([label, value, note]) => (
          <article key={label} className="rounded-2xl border border-neutral-300 bg-white p-5 text-neutral-950">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">{label}</p>
            <p className="mt-3 text-4xl font-bold">{value}</p>
            <p className="mt-2 text-sm text-neutral-600">{note}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-neutral-300 bg-white p-6 text-neutral-950">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Current manuscript</p>
            <h2 className="mt-3 text-3xl font-bold">{latest.manuscriptTitle}</h2>
            <p className="mt-3 text-neutral-600">Latest evaluation: {d(latest.createdAt)}. Progress claims require a later evaluation to confirm movement.</p>
          </div>
          <div className="space-y-4">
            {[
              ['Overall', latest.overallScore, fmt(latest.overallScore)],
              ['Ready', latest.readinessScore, fmt(latest.readinessScore)],
              ['To 8.0', topScore, topScore >= 8 ? 'Met' : `${(8 - topScore).toFixed(1)} left`],
            ].map(([label, value, text]) => (
              <div key={label} className="grid grid-cols-[90px_1fr_70px] items-center gap-3">
                <span className="text-sm font-semibold text-neutral-600">{label}</span>
                <div className="h-3 overflow-hidden rounded-full bg-neutral-200"><i className="block h-full rounded-full bg-amber-600" style={{ width: pct(value) }} /></div>
                <strong className="text-right text-sm">{text}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <EvaluationHistoryTable rows={rows} />

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-neutral-300 bg-white p-6 text-neutral-950">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Score Trend</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Shows repeated evaluation cycles for the current manuscript.</p></div><span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-bold uppercase tracking-wide">{points.length} runs</span></div>
          <div className="relative mt-6 flex h-64 items-end gap-4 border-b border-l border-neutral-200 px-4 pb-8">
            <div className="absolute left-0 right-0 top-[20%] border-t border-dashed border-amber-500"><span className="absolute -top-3 left-3 bg-white px-2 text-xs font-bold text-amber-700">8.0 threshold</span></div>
            {points.map((row) => <div key={row.id} className="flex flex-1 flex-col items-center gap-2"><div className="flex h-44 items-end gap-1"><i className="w-3 rounded-t bg-neutral-800" style={{ height: pct(row.overallScore) }} /><i className="w-3 rounded-t bg-amber-600" style={{ height: pct(row.readinessScore) }} /></div><strong className="text-sm">{fmt(row.readinessScore)}</strong><small className="text-xs text-neutral-500">{d(row.createdAt)}</small></div>)}
          </div>
        </article>
        <article className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-neutral-950">
          <h2 className="text-2xl font-bold">Revise Analytics</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Next phase: surface MUST / SHOULD / COULD opportunities, repair scope, decision history, and issue-type trends after Revise data is persisted.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['MUST', 'SHOULD', 'COULD'].map((label) => <div key={label} className="rounded-2xl border border-neutral-300 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-2 text-sm text-neutral-600">Pending Revise queue data</p></div>)}
          </div>
          <p className="mt-5 text-sm text-neutral-500">No improvement claim appears until the manuscript is revised and re-evaluated.</p>
        </article>
      </section>
    </div>
  )
}
