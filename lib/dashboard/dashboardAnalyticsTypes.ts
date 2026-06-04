/**
 * Dashboard Analytics Types — shared between server data layer and client components.
 *
 * Separated from getDashboardAnalytics.ts to avoid pulling server-only
 * imports (supabase, cookies) into the client bundle.
 */

import type { CriterionKey } from '@/schemas/criteria-keys'

export type ScoreTrendPoint = {
  date: string
  jobId: string
  manuscriptId: string
  manuscriptTitle: string
  overall: number | null
  readiness: number | null
  criterionScores: Partial<Record<CriterionKey, number>>
}

export type ErrorTrendPeriod = {
  label: string
  jobId: string
  manuscriptTitle: string
  date: string
  counts: Record<string, number>
}

export type InsightCard = {
  title: string
  items: string[]
}

export type DashboardAnalytics = {
  scoreTrend: ScoreTrendPoint[]
  errorTrend: ErrorTrendPeriod[]
  insights: {
    mostImproved: InsightCard
    stillBlocking: InsightCard
    recentWins: InsightCard
  }
  manuscripts: { id: string; title: string }[]
}

export const CRITERION_SHORT_LABELS: Record<string, string> = {
  concept: 'Concept',
  narrativeDrive: 'Narrative Drive',
  character: 'Character',
  voice: 'Voice & POV',
  sceneConstruction: 'Scene Construction',
  dialogue: 'Dialogue',
  theme: 'Theme',
  worldbuilding: 'World-Building',
  pacing: 'Pacing',
  proseControl: 'Prose',
  tone: 'Tone',
  narrativeClosure: 'Closure',
  marketability: 'Market Position',
}
