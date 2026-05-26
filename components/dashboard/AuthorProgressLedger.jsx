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

function barWidth(value, total) {
  if (!total) return '0%'
  return `${Math.max(4, Math.min(100, (value / total) * 100))}%`
}

function activityLabel(value) {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AuthorProgressLedger({ rows, kpis, reviseAnalytics }) {
  const latest = rows[0]
  const prior = rows.find((r) => r.manuscriptId === latest.manuscriptId && r.id !== latest.id)
  const overallDelta = typeof latest.overallScore === 'number' && typeof prior?.overallScore === 'number' ? latest.overallScore - prior.overallScore : null
  const readinessDelta = typeof latest.readinessScore === 'number' && typeof prior?.readinessScore === 'number' ? latest.readinessScore - prior.readinessScore : null
  const topScore = Math.max(latest.overallScore ?? 0, latest.readinessScore ?? 0)
  const points = trend(rows, latest)
  const canPackage = latest.status !== 'running' && latest.status !== 'failed'
  const revise = reviseAnalytics ?? {
    totalOpportunities: 0,
    totalDecisions: 0,
    uniqueDecidedOpportunities: 0,
    decisions: { accepted: 0, custom: 0, keptOriginal: 0, rejected: 0, deferred: 0 },
    priorities: { must: 0, should: 0, could: 0, decided: 0, pending: 0 },
    scopes: { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    activity: [],
  }
  const decisionTotal = revise.uniqueDecidedOpportunities || 0
  const scopeTotal = Object.values(revise.scopes).reduce((sum, n) => sum + n, 0)

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-neutral-300 bg-white p-8 text-neutral-950">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">Dashboard · author progress ledger</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-5xl">Track the path from evaluation to readiness.</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-neutral-600">Your dashboard is included with paid audits. It shows evaluation history, score movement, current readiness, Revise decisions, and the recheck trail that proves whether the manuscript moved.</p>
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
          ['Market readiness', kpis.latestReadiness.value, readinessDelta == null ? 'Threshold is 8.0' : `${readinessDelta >= 0 ? '+' : ''}${readinessDelta.toFixed(1)} readiness delta`],
          ['Revise decisions', String(revise.uniqueDecidedOpportunities), `${revise.priorities.pending} opportunities pending`],
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

        <article className="rounded-3xl border border-neutral-300 bg-white p-6 text-neutral-950">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Revise Analytics</h2><p className="mt-2 text-sm leading-6 text-neutral-600">Synced from the Revision Ledger. These show author decisions and pending repair work; improvement is confirmed only after re-evaluation.</p></div><span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-bold uppercase tracking-wide">{revise.totalOpportunities} opportunities</span></div>
          {revise.totalOpportunities === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm leading-6 text-neutral-600">No revision decisions yet. Open the Revise Workbench to begin building your manuscript progress history.</div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['MUST', revise.priorities.must, 'Readiness blockers'],
                  ['SHOULD', revise.priorities.should, 'High-value repairs'],
                  ['COULD', revise.priorities.could, 'Optional refinements'],
                ].map(([label, value, note]) => <div key={label} className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-1 text-xs text-neutral-600">{note}</p></div>)}
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4">
                <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Decision state</p><strong className="text-sm">{revise.uniqueDecidedOpportunities}/{revise.totalOpportunities} decided</strong></div>
                <div className="mt-4 space-y-3">
                  {[
                    ['Accepted', revise.decisions.accepted],
                    ['Custom', revise.decisions.custom],
                    ['Kept original', revise.decisions.keptOriginal],
                    ['Rejected', revise.decisions.rejected],
                    ['Deferred', revise.decisions.deferred],
                  ].map(([label, value]) => <div key={label} className="grid grid-cols-[110px_1fr_44px] items-center gap-3"><span className="text-sm text-neutral-600">{label}</span><div className="h-3 overflow-hidden rounded-full bg-white"><i className="block h-full rounded-full bg-neutral-900" style={{ width: barWidth(value, decisionTotal) }} /></div><strong className="text-right text-sm">{value}</strong></div>)}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Revision scope</p>
                <div className="mt-4 space-y-3">
                  {Object.entries(revise.scopes).map(([label, value]) => <div key={label} className="grid grid-cols-[90px_1fr_44px] items-center gap-3"><span className="text-sm text-neutral-600">{label}</span><div className="h-3 overflow-hidden rounded-full bg-white"><i className="block h-full rounded-full bg-amber-600" style={{ width: barWidth(value, scopeTotal) }} /></div><strong className="text-right text-sm">{value}</strong></div>)}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">Revision activity</p>
                {revise.activity.length === 0 ? <p className="mt-3 text-sm text-neutral-600">No synced ledger activity yet.</p> : <div className="mt-4 flex h-28 items-end gap-2">{revise.activity.map((point) => <div key={point.date} className="flex flex-1 flex-col items-center gap-2"><i className="w-full rounded-t bg-neutral-900" style={{ height: barWidth(point.count, Math.max(...revise.activity.map((p) => p.count))) }} /><small className="text-[10px] text-neutral-500">{activityLabel(point.date)}</small></div>)}</div>}
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  )
}
