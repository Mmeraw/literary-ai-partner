/**
 * Dashboard Analytics — score trend and error trend data layer
 *
 * Queries evaluation_artifacts and diagnostic_findings to build
 * interactive chart data for the Author Progress Ledger.
 *
 * Types are in dashboardAnalyticsTypes.ts to avoid pulling server-only
 * imports into the client bundle.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedUser } from '@/lib/supabase/server'
import { CRITERIA_METADATA, type CriterionKey } from '@/schemas/criteria-keys'
import { floorScoreForDisplay, formatScoreForDisplay } from '@/lib/ui/score-formatting'
import { CRITERION_SHORT_LABELS } from './dashboardAnalyticsTypes'

export type {
  ScoreTrendPoint,
  ErrorTrendPeriod,
  InsightCard,
  DashboardAnalytics,
} from './dashboardAnalyticsTypes'

export { CRITERION_SHORT_LABELS } from './dashboardAnalyticsTypes'

import type {
  ScoreTrendPoint,
  ErrorTrendPeriod,
  DashboardAnalytics,
} from './dashboardAnalyticsTypes'

function shortLabel(key: string): string {
  return CRITERION_SHORT_LABELS[key] ?? CRITERIA_METADATA[key as CriterionKey]?.label ?? key
}

// ── Main entry ───────────────────────────────────────────────────────

export async function getDashboardAnalytics(
  opts: { manuscriptId?: string } = {},
): Promise<DashboardAnalytics | null> {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const supabase = createAdminClient()

  // Get user's manuscripts
  const { data: manuscripts, error: mErr } = await supabase
    .from('manuscripts')
    .select('id, title')
    .eq('user_id', user.id)

  if (mErr || !manuscripts?.length) return null

  const titleById = new Map<number, string>()
  const manuscriptIds: number[] = []
  for (const m of manuscripts as Array<{ id: number; title: string | null }>) {
    manuscriptIds.push(m.id)
    titleById.set(m.id, (m.title ?? 'Untitled').trim() || 'Untitled')
  }

  // Filter by manuscript if specified
  const filterIds = opts.manuscriptId
    ? manuscriptIds.filter((id) => String(id) === opts.manuscriptId)
    : manuscriptIds

  if (filterIds.length === 0) return null

  // Get ALL completed evaluation jobs (not just 15)
  const { data: jobs, error: jErr } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, created_at, status')
    .in('manuscript_id', filterIds)
    .eq('status', 'complete')
    .order('created_at', { ascending: true })

  if (jErr || !jobs?.length) return null

  const jobRows = jobs as Array<{
    id: string
    manuscript_id: number
    created_at: string
    status: string
  }>

  const jobIds = jobRows.map((j) => j.id)

  // Fetch evaluation results (contains overall_score, readiness_score, criteria)
  const { data: artifacts } = await supabase
    .from('evaluation_artifacts')
    .select('job_id, content')
    .in('job_id', jobIds)
    .eq('artifact_type', 'evaluation_result_v2')

  const artifactByJob = new Map<string, Record<string, unknown>>()
  for (const art of (artifacts ?? []) as Array<{ job_id: string; content: Record<string, unknown> }>) {
    artifactByJob.set(art.job_id, art.content ?? {})
  }

  // Fetch diagnostic_findings for error trend
  const { data: findings } = await supabase
    .from('diagnostic_findings')
    .select('evaluation_job_id, criterion_key, severity')
    .in('evaluation_job_id', jobIds)

  const findingsByJob = new Map<string, Array<{ criterion_key: string | null; severity: string | null }>>()
  for (const f of (findings ?? []) as Array<{
    evaluation_job_id: string
    criterion_key: string | null
    severity: string | null
  }>) {
    const arr = findingsByJob.get(f.evaluation_job_id) ?? []
    arr.push({ criterion_key: f.criterion_key, severity: f.severity })
    findingsByJob.set(f.evaluation_job_id, arr)
  }

  // Build score trend
  const scoreTrend: ScoreTrendPoint[] = []
  for (const job of jobRows) {
    const content = artifactByJob.get(job.id)
    if (!content) continue

    const overall = typeof content.overall_score === 'number' ? content.overall_score : null
    const readiness = typeof content.readiness_score === 'number' ? content.readiness_score : null

    const criterionScores: Partial<Record<CriterionKey, number>> = {}
    const criteria = content.criteria as Array<{ key: string; final_score_0_10: number }> | undefined
    if (Array.isArray(criteria)) {
      for (const c of criteria) {
        if (typeof c.final_score_0_10 === 'number') {
          criterionScores[c.key as CriterionKey] = c.final_score_0_10
        }
      }
    }

    scoreTrend.push({
      date: job.created_at,
      jobId: job.id,
      manuscriptId: String(job.manuscript_id),
      manuscriptTitle: titleById.get(job.manuscript_id) ?? 'Untitled',
      overall,
      readiness,
      criterionScores,
    })
  }

  // Build error trend (diagnostic findings count by criterion per evaluation)
  const errorTrend: ErrorTrendPeriod[] = []
  for (const job of jobRows) {
    const jobFindings = findingsByJob.get(job.id)
    if (!jobFindings?.length) continue

    const counts: Record<string, number> = {}
    for (const f of jobFindings) {
      const key = f.criterion_key ?? 'other'
      counts[key] = (counts[key] ?? 0) + 1
    }

    errorTrend.push({
      label: new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      jobId: job.id,
      manuscriptTitle: titleById.get(
        jobRows.find((j) => j.id === job.id)?.manuscript_id ?? 0,
      ) ?? 'Untitled',
      date: job.created_at,
      counts,
    })
  }

  // Build insight cards
  const insights = computeInsights(scoreTrend, errorTrend)

  return {
    scoreTrend,
    errorTrend,
    insights,
    manuscripts: manuscriptIds.map((id) => ({
      id: String(id),
      title: titleById.get(id) ?? 'Untitled',
    })),
  }
}

// ── Insight computation ──────────────────────────────────────────────

function computeInsights(
  scoreTrend: ScoreTrendPoint[],
  errorTrend: ErrorTrendPeriod[],
): DashboardAnalytics['insights'] {
  const mostImprovedItems: string[] = []
  const blockingItems: string[] = []
  const winsItems: string[] = []

  if (scoreTrend.length >= 2) {
    const first = scoreTrend[0]
    const last = scoreTrend[scoreTrend.length - 1]

    // Overall improvement
    if (first.overall != null && last.overall != null) {
      const delta = last.overall - first.overall
      const flooredDelta = floorScoreForDisplay(delta)
      if (flooredDelta !== null && flooredDelta > 0) {
        mostImprovedItems.push(
          `Overall score improved by ${flooredDelta} points (${formatScoreForDisplay(first.overall)} → ${formatScoreForDisplay(last.overall)})`,
        )
      }
    }

    // Per-criterion improvement
    const criterionDeltas: { key: string; delta: number; latest: number }[] = []
    for (const key of Object.keys(CRITERIA_METADATA)) {
      const firstScore = first.criterionScores[key as CriterionKey]
      const lastScore = last.criterionScores[key as CriterionKey]
      if (firstScore != null && lastScore != null) {
        criterionDeltas.push({ key, delta: lastScore - firstScore, latest: lastScore })
      }
    }

    // Most improved criteria
    criterionDeltas
      .filter((d) => d.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3)
      .forEach((d) => {
        const flooredDelta = floorScoreForDisplay(d.delta)
        if (flooredDelta !== null && flooredDelta > 0) {
          mostImprovedItems.push(`${shortLabel(d.key)} improved by ${flooredDelta} points`)
        }
      })

    // Still blocking readiness (latest score < 8)
    criterionDeltas
      .filter((d) => d.latest < 8)
      .sort((a, b) => a.latest - b.latest)
      .slice(0, 3)
      .forEach((d) => {
        blockingItems.push(`${shortLabel(d.key)} at ${formatScoreForDisplay(d.latest)} (needs 8+)`)
      })

    // Recent wins
    if (last.overall != null && last.overall >= 8) {
      winsItems.push(`${last.manuscriptTitle} reached market readiness (${formatScoreForDisplay(last.overall)})`)
    }
    if (last.readiness != null && last.readiness >= 8) {
      winsItems.push(`Market readiness score hit ${formatScoreForDisplay(last.readiness)}`)
    }

    // Largest single jump
    for (let i = 1; i < scoreTrend.length; i++) {
      const prev = scoreTrend[i - 1]
      const curr = scoreTrend[i]
      if (prev.overall != null && curr.overall != null) {
        const jump = curr.overall - prev.overall
        const flooredJump = floorScoreForDisplay(jump)
        if (flooredJump !== null && flooredJump > 0) {
          winsItems.push(
            `${curr.manuscriptTitle}: +${flooredJump} point jump on ${new Date(curr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          )
          break
        }
      }
    }
  }

  // Error trend improvements
  if (errorTrend.length >= 2) {
    const firstErrors = errorTrend[0].counts
    const lastErrors = errorTrend[errorTrend.length - 1].counts
    const allKeys = new Set([...Object.keys(firstErrors), ...Object.keys(lastErrors)])

    for (const key of allKeys) {
      const firstCount = firstErrors[key] ?? 0
      const lastCount = lastErrors[key] ?? 0
      if (firstCount > lastCount && firstCount - lastCount >= 2) {
        mostImprovedItems.push(
          `${shortLabel(key)} issues dropped from ${firstCount} to ${lastCount}`,
        )
      }
    }
  }

  if (blockingItems.length === 0) {
    blockingItems.push('No criteria currently blocking readiness')
  }
  if (winsItems.length === 0) {
    winsItems.push('Keep evaluating to unlock milestone tracking')
  }
  if (mostImprovedItems.length === 0) {
    mostImprovedItems.push('Run multiple evaluations to see improvement trends')
  }

  return {
    mostImproved: { title: 'Most Improved', items: mostImprovedItems.slice(0, 4) },
    stillBlocking: { title: 'Still Blocking Readiness', items: blockingItems.slice(0, 4) },
    recentWins: { title: 'Recent Wins', items: winsItems.slice(0, 4) },
  }
}
