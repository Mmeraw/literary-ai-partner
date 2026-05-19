export type DashboardEvaluationStatus =
  | 'market_ready'
  | 'near_ready'
  | 'improving'
  | 'below_standard'
  | 'running'
  | 'failed'

export type DashboardEvaluationRow = {
  id: string
  jobId: string
  manuscriptId: string
  manuscriptTitle: string
  manuscriptSubtitle: string
  createdAt: string
  evaluationType: 'Evaluate' | 'Revise'
  overallScore: number | null
  readinessScore: number | null
  status: DashboardEvaluationStatus
  reportHref: string
}

export type DashboardKpi = {
  value: string
  meta: string
  delta: string
  deltaTone: 'positive' | 'gold' | 'neutral'
}

export type DashboardKpis = {
  latestOverall: DashboardKpi
  latestReadiness: DashboardKpi
  bestScore: DashboardKpi
  curationReady: DashboardKpi
}

/**
 * Phase 1 wiring: returns empty until the Supabase adapter PR lands.
 * The dashboard page renders the empty state safely.
 */
export async function getDashboardEvaluations(
  _opts: { limit?: number } = {},
): Promise<{ rows: DashboardEvaluationRow[]; error: Error | null }> {
  return { rows: [], error: null }
}

export function statusFromScores(
  overall: number | null,
  readiness: number | null,
): DashboardEvaluationStatus {
  const top = Math.max(overall ?? 0, readiness ?? 0)
  if (top >= 8.0) return 'market_ready'
  if (top >= 7.5) return 'near_ready'
  if (top >= 6.5) return 'improving'
  return 'below_standard'
}

export function computeDashboardKpis(rows: DashboardEvaluationRow[]): DashboardKpis {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const latest = sorted[0]
  const previousForSameManuscript = sorted.find(
    (r) => latest && r.manuscriptId === latest.manuscriptId && r.id !== latest.id,
  )

  const latestOverallValue = latest?.overallScore ?? null
  const previousOverallValue = previousForSameManuscript?.overallScore ?? null
  const overallDelta =
    latestOverallValue != null && previousOverallValue != null
      ? latestOverallValue - previousOverallValue
      : null

  const latestReadinessValue = latest?.readinessScore ?? null

  const best = rows.reduce<DashboardEvaluationRow | null>((acc, r) => {
    const cur = Math.max(r.overallScore ?? 0, r.readinessScore ?? 0)
    const top = acc ? Math.max(acc.overallScore ?? 0, acc.readinessScore ?? 0) : -1
    return cur > top ? r : acc
  }, null)

  const curationReadyCount = countCurationReady(rows)

  return {
    latestOverall: {
      value: formatScore(latestOverallValue),
      meta: latest ? latest.manuscriptTitle : 'No evaluations yet',
      delta:
        overallDelta == null
          ? '—'
          : `${overallDelta >= 0 ? '+' : ''}${overallDelta.toFixed(1)} vs prior evaluation`,
      deltaTone: overallDelta != null && overallDelta > 0 ? 'positive' : 'neutral',
    },
    latestReadiness: {
      value: formatScore(latestReadinessValue),
      meta: 'Threshold is 8.0',
      delta:
        latestReadinessValue != null && latestReadinessValue >= 8.0
          ? 'Curation-ready'
          : 'Below threshold',
      deltaTone:
        latestReadinessValue != null && latestReadinessValue >= 8.0 ? 'gold' : 'neutral',
    },
    bestScore: {
      value: formatScore(
        best ? Math.max(best.overallScore ?? 0, best.readinessScore ?? 0) : null,
      ),
      meta: best ? `${best.manuscriptTitle} · ${best.createdAt}` : 'No evaluations yet',
      delta: 'Highest recorded craft score',
      deltaTone: 'neutral',
    },
    curationReady: {
      value: String(curationReadyCount),
      meta: 'Manuscripts at or above 8.0',
      delta: 'Eligible for later curation review',
      deltaTone: curationReadyCount > 0 ? 'gold' : 'neutral',
    },
  }
}

function countCurationReady(rows: DashboardEvaluationRow[]): number {
  const latestPerManuscript = new Map<string, DashboardEvaluationRow>()
  for (const r of rows) {
    const prev = latestPerManuscript.get(r.manuscriptId)
    if (!prev || new Date(r.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
      latestPerManuscript.set(r.manuscriptId, r)
    }
  }
  let n = 0
  for (const r of latestPerManuscript.values()) {
    const top = Math.max(r.overallScore ?? 0, r.readinessScore ?? 0)
    if (top >= 8.0) n += 1
  }
  return n
}

function formatScore(value: number | null): string {
  if (value == null) return '—'
  return value.toFixed(1)
}
