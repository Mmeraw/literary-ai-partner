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

export type ReviseDecisionBucket = {
  accepted: number
  custom: number
  keptOriginal: number
  rejected: number
  deferred: number
}

export type RevisePriorityBucket = {
  must: number
  should: number
  could: number
  decided: number
  pending: number
}

export type ReviseScopeBucket = {
  Line: number
  Passage: number
  Scene: number
  Chapter: number
  Structural: number
  Manuscript: number
}

export type ReviseActivityPoint = {
  date: string
  count: number
}

export type DashboardReviseAnalytics = {
  totalOpportunities: number
  totalDecisions: number
  uniqueDecidedOpportunities: number
  decisions: ReviseDecisionBucket
  priorities: RevisePriorityBucket
  scopes: ReviseScopeBucket
  activity: ReviseActivityPoint[]
  latestEvaluationJobId: string | null
}

const emptyDecisionBucket = (): ReviseDecisionBucket => ({
  accepted: 0,
  custom: 0,
  keptOriginal: 0,
  rejected: 0,
  deferred: 0,
})

const emptyPriorityBucket = (): RevisePriorityBucket => ({
  must: 0,
  should: 0,
  could: 0,
  decided: 0,
  pending: 0,
})

const emptyScopeBucket = (): ReviseScopeBucket => ({
  Line: 0,
  Passage: 0,
  Scene: 0,
  Chapter: 0,
  Structural: 0,
  Manuscript: 0,
})

export function emptyReviseAnalytics(): DashboardReviseAnalytics {
  return {
    totalOpportunities: 0,
    totalDecisions: 0,
    uniqueDecidedOpportunities: 0,
    decisions: emptyDecisionBucket(),
    priorities: emptyPriorityBucket(),
    scopes: emptyScopeBucket(),
    activity: [],
    latestEvaluationJobId: null,
  }
}

export async function getDashboardEvaluations(
  _opts: { limit?: number } = {},
): Promise<{ rows: DashboardEvaluationRow[]; reviseAnalytics: DashboardReviseAnalytics; error: Error | null }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return { rows: [], reviseAnalytics: emptyReviseAnalytics(), error: null }

    const supabase = createAdminClient()
    const limit = _opts.limit ?? 15

    // Two-step ownership trace: manuscripts.user_id is the canonical owner.
    const { data: manuscripts, error: manuscriptsError } = await supabase
      .from('manuscripts')
      .select('id, title')
      .eq('user_id', user.id)

    if (manuscriptsError) {
      return { rows: [], reviseAnalytics: emptyReviseAnalytics(), error: new Error(manuscriptsError.message) }
    }

    if (!manuscripts || manuscripts.length === 0) {
      return { rows: [], reviseAnalytics: emptyReviseAnalytics(), error: null }
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
      return { rows: [], reviseAnalytics: emptyReviseAnalytics(), error: new Error(jobsError.message) }
    }

    if (!jobs || jobs.length === 0) return { rows: [], reviseAnalytics: emptyReviseAnalytics(), error: null }

    const jobIds = (jobs as Array<{ id: string }>).map((j) => j.id)
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

    const reviseAnalytics = await computeReviseAnalyticsForDashboard({
      supabase,
      userId: user.id,
      jobIds,
      latestEvaluationJobId: rows[0]?.jobId ?? null,
    })

    return { rows, reviseAnalytics, error: null }
  } catch (err) {
    return { rows: [], reviseAnalytics: emptyReviseAnalytics(), error: err instanceof Error ? err : new Error(String(err)) }
  }
}

async function computeReviseAnalyticsForDashboard({
  supabase,
  userId,
  jobIds,
  latestEvaluationJobId,
}: {
  supabase: ReturnType<typeof createAdminClient>
  userId: string
  jobIds: string[]
  latestEvaluationJobId: string | null
}): Promise<DashboardReviseAnalytics> {
  if (jobIds.length === 0) return emptyReviseAnalytics()

  const { data: findings, error: findingsError } = await supabase
    .from('diagnostic_findings')
    .select('id, evaluation_job_id, criterion_key, finding_type, severity, location_ref, diagnosis, recommendation, evidence_excerpt, original_text')
    .in('evaluation_job_id', jobIds)

  if (findingsError) {
    return { ...emptyReviseAnalytics(), latestEvaluationJobId }
  }

  const findingRows = (findings ?? []) as Array<{
    id: string
    evaluation_job_id: string
    criterion_key: string | null
    finding_type: string | null
    severity: string | null
    location_ref: string | null
    diagnosis: string | null
    recommendation: string | null
    evidence_excerpt: string | null
    original_text: string | null
  }>

  const findingById = new Map(findingRows.map((f) => [f.id, f]))
  const priority = emptyPriorityBucket()
  const scopes = emptyScopeBucket()

  for (const finding of findingRows) {
    const severity = severityToPriority(finding.severity)
    priority[severity] += 1
    scopes[inferScope(finding)] += 1
  }

  const { data: ledger, error: ledgerError } = await supabase
    .from('revision_ledger_decisions')
    .select('evaluation_job_id, opportunity_id, opportunity_title, decision, selected_option, created_at')
    .eq('user_id', userId)
    .in('evaluation_job_id', jobIds)
    .eq('is_undo', false)
    .order('created_at', { ascending: true })

  if (ledgerError) {
    return {
      ...emptyReviseAnalytics(),
      totalOpportunities: findingRows.length,
      priorities: { ...priority, pending: findingRows.length },
      scopes,
      latestEvaluationJobId,
    }
  }

  const ledgerRows = (ledger ?? []) as Array<{
    evaluation_job_id: string
    opportunity_id: string
    opportunity_title: string | null
    decision: string
    selected_option: string | null
    created_at: string
  }>

  const latestByOpportunity = new Map<string, (typeof ledgerRows)[number]>()
  const activityByDate = new Map<string, number>()

  for (const row of ledgerRows) {
    latestByOpportunity.set(`${row.evaluation_job_id}:${row.opportunity_id}`, row)
    const day = formatDateKey(row.created_at)
    activityByDate.set(day, (activityByDate.get(day) ?? 0) + 1)
  }

  const decisions = emptyDecisionBucket()
  for (const row of latestByOpportunity.values()) {
    if (row.decision === 'custom') decisions.custom += 1
    else if (row.decision === 'keep_original') decisions.keptOriginal += 1
    else if (row.decision === 'reject') decisions.rejected += 1
    else if (row.decision === 'deferred') decisions.deferred += 1
    else if (row.decision.startsWith('accepted_')) decisions.accepted += 1
  }

  priority.decided = latestByOpportunity.size
  priority.pending = Math.max(0, findingRows.length - latestByOpportunity.size)

  return {
    totalOpportunities: findingRows.length,
    totalDecisions: ledgerRows.length,
    uniqueDecidedOpportunities: latestByOpportunity.size,
    decisions,
    priorities: priority,
    scopes,
    activity: [...activityByDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, count]) => ({ date, count })),
    latestEvaluationJobId,
  }
}

function severityToPriority(severity: string | null | undefined): 'must' | 'should' | 'could' {
  if (severity === 'high') return 'must'
  if (severity === 'medium') return 'should'
  return 'could'
}

function inferScope(finding: {
  criterion_key?: string | null
  finding_type?: string | null
  location_ref?: string | null
  diagnosis?: string | null
  recommendation?: string | null
  evidence_excerpt?: string | null
  original_text?: string | null
}): keyof ReviseScopeBucket {
  const haystack = [
    finding.criterion_key,
    finding.finding_type,
    finding.location_ref,
    finding.diagnosis,
    finding.recommendation,
    finding.evidence_excerpt,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (haystack.includes('manuscript') || haystack.includes('whole book')) return 'Manuscript'
  if (haystack.includes('structural') || haystack.includes('spine') || haystack.includes('closure') || haystack.includes('midpoint') || haystack.includes('arc')) return 'Structural'
  if (haystack.includes('chapter') || haystack.includes('ch.')) return 'Chapter'
  if (haystack.includes('scene') || haystack.includes('dialogue') || haystack.includes('pacing') || haystack.includes('character')) return 'Scene'
  if ((finding.original_text ?? finding.evidence_excerpt ?? '').length > 220) return 'Passage'
  return 'Line'
}

function formatDateKey(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toISOString().slice(0, 10)
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
