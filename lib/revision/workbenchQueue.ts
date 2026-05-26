import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedUser } from '@/lib/supabase/server'
import { ensureOperationalRevisionFindings } from './operationalQueueBuilder'
import type { DiagnosticFinding, ProposalSeverity } from './types'

export type WorkbenchSeverity = 'must' | 'should' | 'could'
export type WorkbenchScope = 'Line' | 'Passage' | 'Scene' | 'Chapter' | 'Structural' | 'Manuscript'
export type WorkbenchMode = 'direct-rewrite' | 'repair-brief'

export type WorkbenchOption = {
  key: 'A' | 'B' | 'C'
  mechanism: string
  text: string
  rationale: string
}

export type WorkbenchOpportunity = {
  id: string
  severity: WorkbenchSeverity
  scope: WorkbenchScope
  mode: WorkbenchMode
  leverage: string
  crumb: string
  title: string
  meta: string
  confidence: string
  anchor: string
  quoteHighlight: string
  quoteRest: string
  symptom: string
  cause: string
  fixDirection: string
  readerEffect: string
  mistakeProofing: string
  options: WorkbenchOption[]
}

export type WorkbenchQueuePayload = {
  ok: boolean
  error: string | null
  manuscriptId: string | null
  evaluationJobId: string | null
  manuscriptTitle: string
  opportunities: WorkbenchOpportunity[]
  totals: Record<WorkbenchSeverity, number>
  scopes: Record<WorkbenchScope, number>
}

const severityOrder: Record<WorkbenchSeverity, number> = { must: 0, should: 1, could: 2 }

function toSeverity(value: ProposalSeverity): WorkbenchSeverity {
  if (value === 'high') return 'must'
  if (value === 'medium') return 'should'
  return 'could'
}

function cleanLabel(value: string): string {
  return value.replace(/[_:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (m) => m.toUpperCase())
}

function firstSentence(value: string, fallback: string): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return fallback
  const sentence = clean.match(/^(.{24,150}?[.!?])\s/)?.[1]
  const out = sentence ?? clean
  return out.length > 150 ? `${out.slice(0, 147).trim()}…` : out.replace(/[.!?]$/, '')
}

function splitEvidence(value: string | null): { quoteHighlight: string; quoteRest: string } {
  const clean = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return { quoteHighlight: 'Evidence pending', quoteRest: ' — no anchored excerpt was stored with this finding.' }
  const words = clean.split(' ')
  return {
    quoteHighlight: words.slice(0, Math.min(words.length, 8)).join(' '),
    quoteRest: words.length > 8 ? ` ${words.slice(8).join(' ')}` : '',
  }
}

function inferScope(finding: DiagnosticFinding): WorkbenchScope {
  const haystack = [finding.criterion_key, finding.finding_type, finding.location_ref, finding.diagnosis, finding.recommendation, finding.evidence_excerpt]
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

function modeForScope(scope: WorkbenchScope): WorkbenchMode {
  return scope === 'Chapter' || scope === 'Structural' || scope === 'Manuscript' ? 'repair-brief' : 'direct-rewrite'
}

function readerEffect(criterion: string, scope: WorkbenchScope): string {
  const key = criterion.toLowerCase()
  if (scope === 'Structural' || scope === 'Manuscript') return 'Repairing this can restore cause-and-effect continuity across the manuscript.'
  if (key.includes('pacing')) return 'Repairing this can reduce drag and restore forward pressure.'
  if (key.includes('dialogue')) return 'Repairing this can clarify speaker logic, subtext, or attribution.'
  if (key.includes('voice') || key.includes('prose')) return 'Repairing this can strengthen voice control without flattening style.'
  if (key.includes('character')) return 'Repairing this can clarify agency, motivation, or emotional continuity.'
  return 'Repairing this can improve reader trust, clarity, and manuscript readiness.'
}

function optionsFor(finding: DiagnosticFinding, scope: WorkbenchScope): WorkbenchOption[] {
  const recommendation = finding.recommendation?.trim() || 'Review this opportunity and choose the least disruptive repair that preserves author voice.'
  if (modeForScope(scope) === 'repair-brief') {
    return [
      { key: 'A', mechanism: 'Recommended repair plan', text: recommendation, rationale: 'Default plan drawn from the evaluation and queue builder.' },
      { key: 'B', mechanism: 'Conservative bridge plan', text: 'Preserve the existing order and add the smallest connective beat that restores clarity.', rationale: 'Lowest-disruption approach for larger-scope repair.' },
      { key: 'C', mechanism: 'Bolder restructuring plan', text: 'Re-sequence or deepen the affected beat so setup, pressure, and payoff carry through the relevant span.', rationale: 'Higher-leverage option when local polish is not enough.' },
    ]
  }
  return [
    { key: 'A', mechanism: 'Recommended repair', text: recommendation, rationale: 'Default repair path from the evaluation-derived finding.' },
    { key: 'B', mechanism: 'Rhythm variant', text: 'Apply the same repair goal with a lighter touch, preserving more of the original cadence.', rationale: 'For authors who want minimal intervention.' },
    { key: 'C', mechanism: 'Bolder rendering shift', text: 'Apply the same repair goal with stronger emphasis, image, or beat structure.', rationale: 'For local moments that need more visible movement.' },
  ]
}

function findingToOpportunity(finding: DiagnosticFinding, index: number): WorkbenchOpportunity {
  const severity = toSeverity(finding.severity)
  const scope = inferScope(finding)
  const mode = modeForScope(scope)
  const criterion = cleanLabel(finding.criterion_key || 'General')
  const evidence = splitEvidence(finding.evidence_excerpt ?? finding.original_text)
  const title = firstSentence(finding.diagnosis, `${criterion} revision opportunity`)

  return {
    id: finding.id || `finding-${index + 1}`,
    severity,
    scope,
    mode,
    leverage: scope === 'Structural' || scope === 'Manuscript' ? 'Structural' : cleanLabel(finding.finding_type || criterion),
    crumb: `${criterion} · ${finding.location_ref ?? `finding ${index + 1}`}`,
    title,
    meta: `${criterion} · ${finding.location_ref ?? 'location pending'}`,
    confidence: finding.confidence == null ? `${finding.severity} severity` : `${Math.round(finding.confidence * 100)}% confidence`,
    anchor: finding.location_ref ?? 'Location pending',
    quoteHighlight: evidence.quoteHighlight,
    quoteRest: evidence.quoteRest,
    symptom: finding.diagnosis,
    cause: finding.recommendation || 'The evaluation and queue builder identified this as a manuscript readiness risk.',
    fixDirection: finding.recommendation || 'Review the evidence and choose a repair path before revising.',
    readerEffect: readerEffect(finding.criterion_key, scope),
    mistakeProofing: mode === 'repair-brief'
      ? 'Preserve author intent, setup/payoff logic, voice, and downstream continuity. Do not solve structural issues with surface polish.'
      : 'Preserve author voice and meaning. Do not introduce new information unless the repair path explicitly calls for it.',
    options: optionsFor(finding, scope),
  }
}

function sortOpportunities(items: WorkbenchOpportunity[]): WorkbenchOpportunity[] {
  return [...items].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title))
}

function emptyPayload(error: string | null): WorkbenchQueuePayload {
  return {
    ok: !error,
    error,
    manuscriptId: null,
    evaluationJobId: null,
    manuscriptTitle: 'Revise Workbench',
    opportunities: [],
    totals: { must: 0, should: 0, could: 0 },
    scopes: { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
  }
}

export async function getWorkbenchQueue(input: { manuscriptId?: string; evaluationJobId?: string }): Promise<WorkbenchQueuePayload> {
  if (!input.manuscriptId || !input.evaluationJobId) return emptyPayload('Open the workbench from a completed manuscript evaluation so RevisionGrade knows which queue to load.')

  const user = await getAuthenticatedUser()
  if (!user) return emptyPayload('Please sign in to open your Revise Workbench.')

  const manuscriptNumericId = Number(input.manuscriptId)
  if (!Number.isInteger(manuscriptNumericId)) return emptyPayload('Invalid manuscript id.')

  const supabase = createAdminClient()
  const { data: manuscript, error: manuscriptError } = await supabase
    .from('manuscripts')
    .select('id, title, user_id')
    .eq('id', manuscriptNumericId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (manuscriptError) return emptyPayload(manuscriptError.message)
  if (!manuscript) return emptyPayload('Manuscript not found in your workspace.')

  const { data: job, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('id, status, manuscript_id, manuscript_version_id')
    .eq('id', input.evaluationJobId)
    .eq('manuscript_id', manuscriptNumericId)
    .maybeSingle()

  if (jobError) return emptyPayload(jobError.message)
  if (!job) return emptyPayload('Evaluation job not found for this manuscript.')
  if (job.status !== 'complete') return emptyPayload('This evaluation is not complete yet. Revise can load after the report is finished.')
  if (!job.manuscript_version_id) return emptyPayload('This evaluation is missing its manuscript version link.')

  const findings = await ensureOperationalRevisionFindings(input.evaluationJobId, job.manuscript_version_id as string)
  const opportunities = sortOpportunities(findings.map(findingToOpportunity))
  const totals: WorkbenchQueuePayload['totals'] = { must: 0, should: 0, could: 0 }
  const scopes: WorkbenchQueuePayload['scopes'] = { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 }

  for (const opportunity of opportunities) {
    totals[opportunity.severity] += 1
    scopes[opportunity.scope] += 1
  }

  return {
    ok: true,
    error: null,
    manuscriptId: input.manuscriptId,
    evaluationJobId: input.evaluationJobId,
    manuscriptTitle: manuscript.title ?? 'Untitled Manuscript',
    opportunities,
    totals,
    scopes,
  }
}
