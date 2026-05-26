import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedUser } from '@/lib/supabase/server'

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

export async function getDashboardEvaluations(
  _opts: { limit?: number } = {},
): Promise<{ rows: DashboardEvaluationRow[]; error: Error | null }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return { rows: [], error: null }

    const supabase = createAdminClient()
    const limit = _opts.limit ?? 15

    // Two-step ownership trace: manuscripts.user_id is the canonical owner.
    const { data: manuscripts, error: manuscriptsError } = await supabase
      .from('manuscripts')
      .select('id, title')
      .eq('user_id', user.id)

    if (manuscriptsError) {
      return { rows: [], error: new Error(manuscriptsError.message) }
    }

    if (!manuscripts || manuscripts.length === 0) {
      return { rows: [], error: null }
    }

    const titleById = new Map<number, string>()
    const manuscriptIds: number[] = []
    for (const m of manuscripts as Array<{ id: number; title: string | null }>) {
      manuscriptIds.push(m.id)
      titleById.set(m.id, (m.title ?? 'Untitled').trim() || 'Untitled')
    }

    const { data: jobs, error: jobsError } = await supabase
      .from('evaluation_jobs')
      .select('id, status, phase, phase_status, created_at, manuscript_id')
      .in('manuscript_id', manuscriptIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (jobsError) {
      return { rows: [], error: new Error(jobsError.message) }
    }

    if (!jobs || jobs.length === 0) return { rows: [], error: null }

    const completedJobIds = (jobs as Array<{ id: string; status: string }>)
      .filter((j) => j.status === 'complete')
      .map((j) => j.id)

    const scoresByJobId: Record<string, { overall: number | null; readiness: number | null }> = {}

    if (completedJobIds.length > 0) {
      const { data: artifacts } = await supabase
        .from('evaluation_artifacts')
        .select('job_id, content')
        .in('job_id', completedJobIds)
        .eq('artifact_type', 'evaluation_result_v2')

      for (const art of (artifacts ?? []) as Array<{ job_id: string; content: Record<string, unknown> }>) {
        const c = art.content ?? {}
        const overallRaw = c.overall_score
        const readinessRaw = c.readiness_score
        const overall = typeof overallRaw === 'number' ? overallRaw : null
        const readiness = typeof readinessRaw === 'number' ? readinessRaw : null
        scoresByJobId[art.job_id] = { overall, readiness }
      }
    }

    const rows: DashboardEvaluationRow[] = []
    for (const job of jobs as Array<{
      id: string
      status: string
      phase: string | null
      phase_status: string | null
      created_at: string
      manuscript_id: number
    }>) {
      const title = titleById.get(job.manuscript_id) ?? 'Untitled'
      const scores = scoresByJobId[job.id] ?? { overall: null, readiness: null }

      let dashStatus: DashboardEvaluationStatus
      if (job.status === 'complete') {
        dashStatus = statusFromScores(scores.overall, scores.readiness)
      } else if (job.status === 'failed') {
        dashStatus = 'failed'
      } else {
        dashStatus = 'running'
      }

      rows.push({
        id: job.id,
        jobId: job.id,
        manuscriptId: String(job.manuscript_id),
        manuscriptTitle: title,
        manuscriptSubtitle: '',
        createdAt: job.created_at,
        evaluationType: 'Evaluate',
        overallScore: scores.overall,
        readinessScore: scores.readiness,
        status: dashStatus,
        reportHref:
          job.status === 'complete' ? `/reports/${job.id}` : `/evaluate/${job.id}`,
      })
    }

    return { rows, error: null }
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err : new Error(String(err)) }
  }
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
