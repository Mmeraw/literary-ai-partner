import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedUser } from '@/lib/supabase/server'
import { ensureRevisionOpportunityLedgerArtifact } from './opportunityLedger'
import { buildRevisionPackage, type RevisionPackage } from './revisionPackage'
import { loadReviseQueueWarmupCorpus } from './reviseQueueWarmup'
import { getCriterionDisplayLabel } from '@/lib/evaluation/reportRenderSafety'
import type { DiagnosticFinding, ProposalSeverity } from './types'
import {
  hasWordProcessorArtifact,
  inferRevisionOperation,
  operationLabels,
  REVISION_OPERATIONS,
  type RevisionOperation,
  type RevisionReadiness,
  validateReviseCardContract,
} from './reviseCardContract'

export type WorkbenchSeverity = 'must' | 'should' | 'could'
export type WorkbenchScope = 'Line' | 'Passage' | 'Scene' | 'Chapter' | 'Structural' | 'Manuscript'
export type WorkbenchMode = 'direct-rewrite' | 'repair-brief'

export type WorkbenchOption = {
  key: 'A' | 'B' | 'C'
  mechanism: string
  candidateText: string
  text: string
  rationale: string
}

export type WorkbenchSource = 'evaluation' | 'deep_revision' | 'baseline_discovery'

export type WorkbenchOpportunity = {
  id: string
  severity: WorkbenchSeverity
  scope: WorkbenchScope
  mode: WorkbenchMode
  source: WorkbenchSource
  criterion: string
  leverage: string
  crumb: string
  title: string
  issueStatement: string
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
  diagnostic: {
    symptom: string
    cause: string
    fixStrategy: string
    readerImpact: string
    evidence: {
      quotedExcerpt: string
      locationLabel: string
    }
    operationTargeting: string
    mistakeProofing: string
  }
  revisionOperation: RevisionOperation
  readiness: RevisionReadiness
  readinessReason: string | null
  options: WorkbenchOption[]
}

export type WorkbenchQueuePayload = {
  ok: boolean
  error: string | null
  manuscriptId: string | null
  evaluationJobId: string | null
  revisionPackage?: RevisionPackage | null
  manuscriptTitle: string
  opportunities: WorkbenchOpportunity[]
  needsTargeting: WorkbenchOpportunity[]
  readinessTotals: {
    ready_for_revise: number
    needs_targeting: number
  }
  totals: Record<WorkbenchSeverity, number>
  scopes: Record<WorkbenchScope, number>
  criteria: Record<string, number>
  synthesis?: {
    admitted: number
    clustered: number
    held: number
    suppressed: number
  }
  goLiveProof?: {
    phase0Warmup: {
      status: 'loaded' | 'unavailable'
      warning: string | null
      loadedAt: string | null
      corpusSha256: string | null
      fileCount: number
      benchmarkCount: number
      benchmarkFiles: string[]
    }
    contractEnforcement: {
      candidateTextOnly: true
      sixPartDiagnosticRequired: true
      readyForRevise: number
      needsTargeting: number
      readyRate: number
    }
  }
}

type ResolvedWorkbenchTarget = {
  manuscriptId: string
  evaluationJobId: string
}

function decodeManuscriptTextFromFileUrl(fileUrl: string | null | undefined): string {
  if (typeof fileUrl !== 'string' || fileUrl.trim().length === 0) return ''
  const trimmed = fileUrl.trim()

  if (trimmed.startsWith('data:')) {
    const comma = trimmed.indexOf(',')
    if (comma === -1) return ''
    try {
      return decodeURIComponent(trimmed.slice(comma + 1))
    } catch {
      return ''
    }
  }

  return ''
}

async function ensureJobManuscriptVersionBinding(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    jobId: string
    manuscriptId: number
    manuscriptVersionId: string | null
    userId: string
  },
): Promise<string | null> {
  if (typeof input.manuscriptVersionId === 'string' && input.manuscriptVersionId.trim().length > 0) {
    return input.manuscriptVersionId
  }

  const { data: latestVersionRow, error: latestVersionError } = await supabase
    .from('manuscript_versions')
    .select('id')
    .eq('manuscript_id', input.manuscriptId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestVersionError) {
    throw new Error(`Failed to resolve manuscript version: ${latestVersionError.message}`)
  }

  let versionId = typeof latestVersionRow?.id === 'string' ? latestVersionRow.id : null

  if (!versionId) {
    const { data: manuscriptRow, error: manuscriptError } = await supabase
      .from('manuscripts')
      .select('id, user_id, file_url, word_count')
      .eq('id', input.manuscriptId)
      .eq('user_id', input.userId)
      .maybeSingle()

    if (manuscriptError) {
      throw new Error(`Failed to load manuscript for legacy version binding: ${manuscriptError.message}`)
    }

    if (!manuscriptRow) {
      throw new Error('Manuscript not found while binding legacy source version.')
    }

    const rawText = decodeManuscriptTextFromFileUrl(manuscriptRow.file_url as string | null | undefined)
    if (!rawText.trim()) {
      throw new Error('Legacy evaluation cannot be revised yet: manuscript source text is unavailable for version binding.')
    }

    const wordCount =
      typeof manuscriptRow.word_count === 'number' && manuscriptRow.word_count >= 0
        ? manuscriptRow.word_count
        : rawText.trim().split(/\s+/).filter(Boolean).length

    const { data: insertedVersionRow, error: insertVersionError } = await supabase
      .from('manuscript_versions')
      .insert({
        manuscript_id: input.manuscriptId,
        version_number: 1,
        source_version_id: null,
        raw_text: rawText,
        word_count: wordCount,
        created_by: input.userId,
      })
      .select('id')
      .maybeSingle()

    if (insertVersionError) {
      const { data: retryLatestVersionRow, error: retryLatestVersionError } = await supabase
        .from('manuscript_versions')
        .select('id')
        .eq('manuscript_id', input.manuscriptId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (retryLatestVersionError) {
        throw new Error(`Failed to bind legacy manuscript version: ${retryLatestVersionError.message}`)
      }

      versionId = typeof retryLatestVersionRow?.id === 'string' ? retryLatestVersionRow.id : null
      if (!versionId) {
        throw new Error(`Failed to create manuscript version for legacy evaluation: ${insertVersionError.message}`)
      }
    } else {
      versionId = typeof insertedVersionRow?.id === 'string' ? insertedVersionRow.id : null
    }
  }

  if (!versionId) {
    throw new Error('Failed to resolve manuscript version for legacy evaluation.')
  }

  const { error: bindError } = await supabase
    .from('evaluation_jobs')
    .update({ manuscript_version_id: versionId })
    .eq('id', input.jobId)

  if (bindError) {
    throw new Error(`Failed to bind legacy manuscript version to evaluation: ${bindError.message}`)
  }

  return versionId
}

// ---------------------------------------------------------------------------
// Rich recommendation from evaluation artifact (6-part diagnostic + proposals)
// ---------------------------------------------------------------------------
type RichRecommendation = {
  anchor_snippet: string
  symptom: string
  mechanism: string
  specific_fix: string
  reader_effect: string
  mistake_proofing: string
  action: string
  expected_impact: string
  priority: string
}

type QueueSynthesisResult = {
  opportunities: WorkbenchOpportunity[]
  synthesis: {
    admitted: number
    clustered: number
    held: number
    suppressed: number
  }
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

/** Convert internal criterion_key to author-facing label */
function criterionLabel(criterionKey: string | null | undefined): string {
  if (!criterionKey) return 'General'
  const label = getCriterionDisplayLabel(criterionKey)
  return label || cleanLabel(criterionKey)
}

/** Clean location_ref: strip machine-internal patterns like "recommendation:4" */
function cleanLocationRef(ref: string | null | undefined): string | null {
  if (!ref) return null
  if (/^recommendation:\d+$/i.test(ref)) return null
  if (/^suggestion:\d+$/i.test(ref)) return null
  if (/^[A-Z_]+:\d+:rec:\d+$/i.test(ref)) return null
  if (/^[A-Z_]+:[a-z0-9]+$/i.test(ref) && ref.length < 30) return null
  if (/^revision_guidance:\d+$/i.test(ref)) return null
  return ref
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
  if (!clean) return { quoteHighlight: 'No excerpt available', quoteRest: ' — this recommendation is based on patterns found across the manuscript rather than a single passage.' }
  const words = clean.split(' ')
  return {
    quoteHighlight: words.slice(0, Math.min(words.length, 8)).join(' '),
    quoteRest: words.length > 8 ? ` ${words.slice(8).join(' ')}` : '',
  }
}

function hasManuscriptWideSupport(finding: DiagnosticFinding): boolean {
  const haystack = [finding.diagnosis, finding.recommendation, finding.evidence_excerpt, finding.location_ref]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes('across the manuscript') || haystack.includes('manuscript-wide') || haystack.includes('whole manuscript')
}

function hasActionableEvidence(finding: DiagnosticFinding): boolean {
  const excerpt = (finding.evidence_excerpt ?? finding.original_text ?? '').trim()
  const location = cleanLocationRef(finding.location_ref)
  return Boolean(excerpt) || Boolean(location) || hasManuscriptWideSupport(finding)
}

function normalizeClusterKey(finding: DiagnosticFinding): string {
  const source = firstSentence(finding.diagnosis || finding.recommendation || 'revision opportunity', 'revision opportunity')
  return source.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function clusterTitleForFinding(finding: DiagnosticFinding): string {
  const title = (finding.diagnosis || finding.recommendation || '').toLowerCase()
  if (title.includes('long paragraph')) return 'Long paragraph pacing pattern'
  if (title.includes('long sentence')) return 'Long sentence density pattern'
  return `${firstSentence(finding.diagnosis || finding.recommendation || 'Revision pattern', 'Revision pattern')} pattern`
}

function synthesizeFindingsForWorkbench(
  findings: DiagnosticFinding[],
  richLookup: RichLookup,
): QueueSynthesisResult {
  const held: DiagnosticFinding[] = []
  const actionable: DiagnosticFinding[] = []

  for (const finding of findings) {
    if (hasActionableEvidence(finding)) {
      actionable.push(finding)
    } else {
      held.push(finding)
    }
  }

  const byKey = new Map<string, DiagnosticFinding[]>()
  for (const finding of actionable) {
    const key = normalizeClusterKey(finding)
    const bucket = byKey.get(key) ?? []
    bucket.push(finding)
    byKey.set(key, bucket)
  }

  const CLUSTER_THRESHOLD = 3
  const individual: DiagnosticFinding[] = []
  const clusters: WorkbenchOpportunity[] = []
  let suppressed = 0

  for (const group of byKey.values()) {
    if (group.length < CLUSTER_THRESHOLD) {
      individual.push(...group)
      continue
    }

    const representative = group[0]
    const base = findingToOpportunity(representative, 0, richLookup)
    const severity = group
      .map((item) => toSeverity(item.severity))
      .sort((a, b) => severityOrder[a] - severityOrder[b])[0] ?? base.severity

    clusters.push({
      ...base,
      id: `cluster:${normalizeClusterKey(representative)}`,
      severity,
      scope: 'Manuscript',
      mode: 'repair-brief',
      title: clusterTitleForFinding(representative),
      issueStatement: clusterTitleForFinding(representative),
      crumb: `${criterionLabel(representative.criterion_key)} · Pattern cluster (${group.length} instances)`,
      meta: `${criterionLabel(representative.criterion_key)} · Pattern cluster`,
      anchor: 'manuscript-wide pattern',
      quoteHighlight: `Pattern detected across ${group.length} findings`,
      quoteRest: ' Review top instances in Workbench V2 cluster expansion before applying broad edits.',
      symptom: firstSentence(representative.diagnosis, 'Repeated finding pattern detected.'),
      cause: 'Repeated similar findings were synthesized to prevent one-to-one raw diagnostic flooding.',
      fixDirection: 'Review this pattern as a grouped issue and prioritize outliers with strongest evidence first.',
      readerEffect: 'Grouping repeated low-granularity findings preserves author focus and revision trust.',
      mistakeProofing: 'Do not mass-apply edits from pattern cards without validating local context and voice continuity.',
    })

    suppressed += group.length - 1
  }

  const individualOpportunities = individual.map((finding, index) => findingToOpportunity(finding, index, richLookup))
  const opportunities = sortOpportunities([...individualOpportunities, ...clusters])

  return {
    opportunities,
    synthesis: {
      admitted: individualOpportunities.length,
      clustered: clusters.length,
      held: held.length,
      suppressed,
    },
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

function scopeFromCoordinates(coordinates: string): WorkbenchScope {
  const normalized = coordinates.trim().toLowerCase()
  const prefixMatch = normalized.match(/^([a-z_]+):/)
  const prefix = prefixMatch?.[1] ?? ''

  switch (prefix) {
    case 'line':
      return 'Line'
    case 'passage':
      return 'Passage'
    case 'scene':
      return 'Scene'
    case 'chapter':
      return 'Chapter'
    case 'structural':
      return 'Structural'
    case 'manuscript':
      return 'Manuscript'
    default:
      // Safe fallback for unknown or malformed coordinates.
      return 'Passage'
  }
}

function fallbackReaderEffect(criterion: string, scope: WorkbenchScope): string {
  const key = criterion.toLowerCase()
  if (scope === 'Structural' || scope === 'Manuscript') return 'Repairing this can restore cause-and-effect continuity across the manuscript.'
  if (key.includes('pacing')) return 'Repairing this can reduce drag and restore forward pressure.'
  if (key.includes('dialogue')) return 'Repairing this can clarify speaker logic, subtext, or attribution.'
  if (key.includes('voice') || key.includes('prose')) return 'Repairing this can strengthen voice control without flattening style.'
  if (key.includes('character')) return 'Repairing this can clarify agency, motivation, or emotional continuity.'
  return 'Repairing this can improve reader trust, clarity, and manuscript readiness.'
}

function fallbackMistakeProofing(mode: WorkbenchMode): string {
  return mode === 'repair-brief'
    ? 'Preserve author intent, setup/payoff logic, voice, and downstream continuity. Do not solve structural issues with surface polish.'
    : 'Preserve author voice and meaning. Do not introduce new information unless the repair path explicitly calls for it.'
}

function cleanAuthorFacingText(value: string | null | undefined, fallback: string): string {
  const raw = (value ?? '').trim()
  if (!raw) return fallback

  if (hasWordProcessorArtifact(raw)) {
    return fallback
  }

  if (/\b(?:prosecontrol|narrativedrive|evaluation_result|criteria\.recommendations|provenance)\b/i.test(raw)) {
    return fallback
  }

  return raw
}

function sanitizeEvidenceExcerpt(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''

  if (hasWordProcessorArtifact(raw)) return ''
  if (/\b(?:prosecontrol|narrativedrive|evaluation_result|criteria\.recommendations|provenance)\b/i.test(raw)) {
    return ''
  }
  if (/\b[A-Z]{3,}:[a-z_]+\b/.test(raw)) return ''

  return raw
}

function normalizeRevisionOperation(raw: unknown): RevisionOperation | null {
  if (typeof raw !== 'string') return null
  const clean = raw.trim()
  return (REVISION_OPERATIONS as readonly string[]).includes(clean)
    ? (clean as RevisionOperation)
    : null
}

function hasManuscriptWideSignal(opportunity: {
  anchor?: string | null
  quoteHighlight?: string | null
  quoteRest?: string | null
  scope?: WorkbenchScope | null
}): boolean {
  if (opportunity.scope === 'Manuscript') return true
  const anchor = (opportunity.anchor ?? '').toLowerCase()
  const quote = `${opportunity.quoteHighlight ?? ''} ${opportunity.quoteRest ?? ''}`.toLowerCase()
  return anchor.includes('manuscript-wide') || quote.includes('across the manuscript') || quote.includes('manuscript-wide')
}

function asCandidateText(option: Pick<WorkbenchOption, 'candidateText' | 'text'>): string {
  return (option.candidateText ?? option.text ?? '').trim()
}

// ---------------------------------------------------------------------------
// Build options from rich recommendation data (manuscript-specific proposals)
// ---------------------------------------------------------------------------
function optionsFromRich(rich: RichRecommendation, mode: WorkbenchMode): WorkbenchOption[] {
  const mainAction = rich.action?.trim() || rich.specific_fix?.trim() || ''
  if (!mainAction) return optionsFallback(mode)
  if (mode === 'repair-brief') {
    return [
      { key: 'A', mechanism: 'Recommended repair plan', candidateText: mainAction, text: mainAction, rationale: rich.expected_impact?.trim() || 'Primary repair path from the evaluation.' },
      { key: 'B', mechanism: 'Conservative bridge plan', candidateText: '', text: '', rationale: 'Needs targeting: add a manuscript-prose rhythm variant.' },
      { key: 'C', mechanism: 'Bolder restructuring plan', candidateText: '', text: '', rationale: 'Needs targeting: add a manuscript-prose bold variant.' },
    ]
  }
  return [
    { key: 'A', mechanism: 'Recommended repair', candidateText: mainAction, text: mainAction, rationale: rich.expected_impact?.trim() || 'Primary repair path from the evaluation.' },
    { key: 'B', mechanism: 'Rhythm variant', candidateText: '', text: '', rationale: 'Needs targeting: add a manuscript-prose rhythm variant.' },
    { key: 'C', mechanism: 'Bolder rendering shift', candidateText: '', text: '', rationale: 'Needs targeting: add a manuscript-prose bold variant.' },
  ]
}

function optionsFallback(mode: WorkbenchMode): WorkbenchOption[] {
  if (mode === 'repair-brief') {
    return [
      { key: 'A', mechanism: 'Recommended repair plan', candidateText: '', text: '', rationale: 'Needs targeting: candidate manuscript prose not provided.' },
      { key: 'B', mechanism: 'Conservative bridge plan', candidateText: '', text: '', rationale: 'Needs targeting: candidate manuscript prose not provided.' },
      { key: 'C', mechanism: 'Bolder restructuring plan', candidateText: '', text: '', rationale: 'Needs targeting: candidate manuscript prose not provided.' },
    ]
  }
  return [
    { key: 'A', mechanism: 'Recommended repair', candidateText: '', text: '', rationale: 'Needs targeting: candidate manuscript prose not provided.' },
    { key: 'B', mechanism: 'Rhythm variant', candidateText: '', text: '', rationale: 'Needs targeting: candidate manuscript prose not provided.' },
    { key: 'C', mechanism: 'Bolder rendering shift', candidateText: '', text: '', rationale: 'Needs targeting: candidate manuscript prose not provided.' },
  ]
}

// ---------------------------------------------------------------------------
// Evaluation artifact → rich recommendation lookup
// ---------------------------------------------------------------------------
type RichLookup = Map<string, RichRecommendation[]>

function buildLookupKey(criterionKey: string): string {
  return criterionKey.replace(/\s+/g, '_').toUpperCase()
}

function extractRichRecommendations(payload: any): RichLookup {
  const lookup: RichLookup = new Map()

  const criteria = Array.isArray(payload?.criteria) ? payload.criteria : []
  for (const criterion of criteria) {
    const key = buildLookupKey(
      String(criterion?.key ?? criterion?.criterion_key ?? 'GENERAL'),
    )
    const recs = Array.isArray(criterion?.recommendations) ? criterion.recommendations : []
    const rich: RichRecommendation[] = recs.map((rec: any) => ({
      anchor_snippet: String(rec?.anchor_snippet ?? '').trim(),
      symptom: String(rec?.symptom ?? '').trim(),
      mechanism: String(rec?.mechanism ?? '').trim(),
      specific_fix: String(rec?.specific_fix ?? '').trim(),
      reader_effect: String(rec?.reader_effect ?? '').trim(),
      mistake_proofing: String(rec?.mistake_proofing ?? '').trim(),
      action: String(rec?.action ?? '').trim(),
      expected_impact: String(rec?.expected_impact ?? '').trim(),
      priority: String(rec?.priority ?? 'medium').trim(),
    }))
    const existing = lookup.get(key) ?? []
    existing.push(...rich)
    lookup.set(key, existing)
  }

  // Also extract from top-level recommendations array
  const topRecs = Array.isArray(payload?.recommendations) ? payload.recommendations : []
  for (const rec of topRecs) {
    const key = buildLookupKey(String(rec?.criterion ?? rec?.rule ?? 'GENERAL'))
    const rich: RichRecommendation = {
      anchor_snippet: String(rec?.anchor_snippet ?? rec?.evidence_snippet ?? rec?.quote ?? '').trim(),
      symptom: String(rec?.symptom ?? '').trim(),
      mechanism: String(rec?.mechanism ?? '').trim(),
      specific_fix: String(rec?.specific_fix ?? '').trim(),
      reader_effect: String(rec?.reader_effect ?? '').trim(),
      mistake_proofing: String(rec?.mistake_proofing ?? '').trim(),
      action: String(rec?.action ?? '').trim(),
      expected_impact: String(rec?.expected_impact ?? '').trim(),
      priority: String(rec?.priority ?? 'medium').trim(),
    }
    const existing = lookup.get(key) ?? []
    existing.push(rich)
    lookup.set(key, existing)
  }

  return lookup
}

function matchRichRecommendation(
  finding: DiagnosticFinding,
  lookup: RichLookup,
): RichRecommendation | null {
  const key = buildLookupKey(finding.criterion_key)
  const candidates = lookup.get(key)
  if (!candidates || candidates.length === 0) return null

  // Try to match by evidence overlap
  const findingEvidence = (finding.evidence_excerpt ?? finding.original_text ?? '').toLowerCase().trim()
  const findingRec = (finding.recommendation ?? '').toLowerCase().trim()

  if (findingEvidence.length > 10) {
    for (const rich of candidates) {
      const anchor = rich.anchor_snippet.toLowerCase()
      if (anchor.length > 10 && (
        findingEvidence.includes(anchor.slice(0, 40)) ||
        anchor.includes(findingEvidence.slice(0, 40))
      )) {
        return rich
      }
    }
  }

  // Try to match by action text overlap with recommendation
  if (findingRec.length > 10) {
    for (const rich of candidates) {
      const action = rich.action.toLowerCase()
      if (action.length > 10 && (
        findingRec.includes(action.slice(0, 50)) ||
        action.includes(findingRec.slice(0, 50))
      )) {
        return rich
      }
    }
  }

  // Fall back to consuming by index (shift off the first unconsumed one)
  if (candidates.length > 0) {
    return candidates.shift()!
  }

  return null
}

// ---------------------------------------------------------------------------
// Finding → WorkbenchOpportunity (enriched with 6-part diagnostic)
// ---------------------------------------------------------------------------
function inferSource(finding: DiagnosticFinding): WorkbenchSource {
  const ft = finding.finding_type ?? ''
  if (ft.startsWith('baseline_manuscript_discovery')) return 'baseline_discovery'
  if (ft.startsWith('revision_') || ft.startsWith('repair_')) return 'deep_revision'
  return 'evaluation'
}

function findingToOpportunity(
  finding: DiagnosticFinding,
  index: number,
  richLookup: RichLookup,
): WorkbenchOpportunity {
  const severity = toSeverity(finding.severity)
  const scope = inferScope(finding)
  const mode = modeForScope(scope)
  const source = inferSource(finding)
  const criterion = criterionLabel(finding.criterion_key)
  const cleanedLocationRef = cleanLocationRef(finding.location_ref)
  const locationDisplay = cleanedLocationRef ?? `Item ${index + 1}`

  // Try to enrich from the raw evaluation artifact
  const rich = matchRichRecommendation(finding, richLookup)

  // Evidence: prefer rich anchor_snippet > finding.evidence_excerpt > finding.original_text
  const evidenceText =
    sanitizeEvidenceExcerpt(rich?.anchor_snippet)
    || sanitizeEvidenceExcerpt(finding.evidence_excerpt)
    || sanitizeEvidenceExcerpt(finding.original_text)
    || null
  const evidence = splitEvidence(evidenceText)

  // Title: use symptom if available (it's the observable reader problem)
  const title = firstSentence(
    rich?.symptom || finding.diagnosis,
    `${criterion} revision opportunity`,
  )

  // Anchor: if rich recommendation has a snippet, show a location hint
  const anchor = cleanedLocationRef ?? (rich?.anchor_snippet ? 'evidence anchored' : 'Location pending')

  return applyReviseCardContract({
    id: finding.id || `finding-${index + 1}`,
    severity,
    scope,
    mode,
    source,
    criterion,
    leverage: scope === 'Structural' || scope === 'Manuscript' ? 'Structural' : cleanLabel(finding.finding_type || criterion),
    crumb: `${criterion} · ${locationDisplay}`,
    title,
    issueStatement: title,
    meta: `${criterion} · ${locationDisplay}`,
    confidence: finding.confidence == null ? `${finding.severity} severity` : `${Math.round(finding.confidence * 100)}% confidence`,
    anchor,
    quoteHighlight: evidence.quoteHighlight,
    quoteRest: evidence.quoteRest,
    symptom: rich?.symptom || finding.diagnosis,
    cause: rich?.mechanism || finding.recommendation || 'The evaluation identified this as a manuscript readiness concern.',
    fixDirection: rich?.specific_fix || rich?.action || finding.recommendation || 'Review the evidence and choose a repair path before revising.',
    readerEffect: rich?.reader_effect || fallbackReaderEffect(finding.criterion_key, scope),
    mistakeProofing: rich?.mistake_proofing || fallbackMistakeProofing(mode),
    diagnostic: {
      symptom: rich?.symptom || finding.diagnosis,
      cause: rich?.mechanism || finding.recommendation || 'The evaluation identified this as a manuscript readiness concern.',
      fixStrategy: rich?.specific_fix || rich?.action || finding.recommendation || 'Review the evidence and choose a repair path before revising.',
      readerImpact: rich?.reader_effect || fallbackReaderEffect(finding.criterion_key, scope),
      evidence: {
        quotedExcerpt: `${evidence.quoteHighlight}${evidence.quoteRest}`.trim(),
        locationLabel: anchor,
      },
      operationTargeting: `${scope} · ${anchor}`,
      mistakeProofing: rich?.mistake_proofing || fallbackMistakeProofing(mode),
    },
    options: rich ? optionsFromRich(rich, mode) : optionsFallback(mode),
  })
}

const sourceOrder: Record<WorkbenchSource, number> = { evaluation: 0, deep_revision: 1, baseline_discovery: 2 }

function sortOpportunities(items: WorkbenchOpportunity[]): WorkbenchOpportunity[] {
  return [...items].sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity]
    || sourceOrder[a.source] - sourceOrder[b.source]
    || a.title.localeCompare(b.title),
  )
}

function emptyPayload(error: string | null): WorkbenchQueuePayload {
  return {
    ok: !error,
    error,
    manuscriptId: null,
    evaluationJobId: null,
    revisionPackage: null,
    manuscriptTitle: 'Revise Workbench',
    opportunities: [],
    needsTargeting: [],
    readinessTotals: { ready_for_revise: 0, needs_targeting: 0 },
    totals: { must: 0, should: 0, could: 0 },
    scopes: { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 },
    criteria: {},
    synthesis: { admitted: 0, clustered: 0, held: 0, suppressed: 0 },
  }
}

async function resolveLatestEligibleEvaluationForUser(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<ResolvedWorkbenchTarget | null> {
  const { data, error } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, status, manuscript_version_id, created_at, manuscripts!inner(user_id)')
    .eq('manuscripts.user_id', userId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const manuscriptId = Number(data.manuscript_id)
  const evaluationJobId = String(data.id ?? '').trim()
  if (!Number.isInteger(manuscriptId) || !evaluationJobId) return null

  return {
    manuscriptId: String(manuscriptId),
    evaluationJobId,
  }
}

export async function resolveWorkbenchRouteTargetForUser(): Promise<ResolvedWorkbenchTarget | null> {
  const user = await getAuthenticatedUser()
  if (!user) return null

  const supabase = createAdminClient()
  return resolveLatestEligibleEvaluationForUser(supabase, user.id)
}

function applyReviseCardContract(
  opportunity: Omit<WorkbenchOpportunity, 'revisionOperation' | 'readiness' | 'readinessReason'>,
  input?: { revisionOperation?: RevisionOperation | null },
): WorkbenchOpportunity {
  const inferredOperation = inferRevisionOperation({
    scope: opportunity.scope,
    mode: opportunity.mode,
    fixDirection: opportunity.fixDirection,
    recommendation: opportunity.symptom,
  })
  const revisionOperation = input?.revisionOperation ?? inferredOperation

  const sourceText = `${opportunity.quoteHighlight ?? ''}${opportunity.quoteRest ?? ''}`.trim()
  const issueStatement = firstSentence(opportunity.issueStatement || opportunity.title || opportunity.symptom, opportunity.title)
  const operationTargeting = `${operationLabels[revisionOperation] ?? 'Suggested revision'} · ${opportunity.anchor || 'Location pending'}`
  const diagnostic = {
    symptom: cleanAuthorFacingText(opportunity.diagnostic?.symptom ?? opportunity.symptom, opportunity.symptom),
    cause: cleanAuthorFacingText(opportunity.diagnostic?.cause ?? opportunity.cause, opportunity.cause),
    fixStrategy: cleanAuthorFacingText(opportunity.diagnostic?.fixStrategy ?? opportunity.fixDirection, opportunity.fixDirection),
    readerImpact: cleanAuthorFacingText(opportunity.diagnostic?.readerImpact ?? opportunity.readerEffect, opportunity.readerEffect),
    evidence: {
      quotedExcerpt: cleanAuthorFacingText(opportunity.diagnostic?.evidence?.quotedExcerpt ?? sourceText, sourceText || 'No excerpt available'),
      locationLabel: cleanAuthorFacingText(opportunity.diagnostic?.evidence?.locationLabel ?? opportunity.anchor, opportunity.anchor || 'Location pending'),
    },
    operationTargeting: cleanAuthorFacingText(opportunity.diagnostic?.operationTargeting ?? operationTargeting, operationTargeting),
    mistakeProofing: cleanAuthorFacingText(opportunity.diagnostic?.mistakeProofing ?? opportunity.mistakeProofing, opportunity.mistakeProofing),
  }

  const contract = validateReviseCardContract({
    issueStatement,
    symptom: diagnostic.symptom,
    cause: diagnostic.cause,
    fixStrategy: diagnostic.fixStrategy,
    readerImpact: diagnostic.readerImpact,
    operationNote: diagnostic.operationTargeting,
    sourceText,
    sourceLocationLabel: opportunity.anchor,
    hasManuscriptWideSupport: hasManuscriptWideSignal(opportunity),
    revisionOperation,
    candidateTexts: opportunity.options.map((option) => asCandidateText(option)),
  })

  return {
    ...opportunity,
    issueStatement,
    diagnostic,
    revisionOperation,
    readiness: contract.readiness,
    readinessReason: contract.reason,
  }
}
// ---------------------------------------------------------------------------
// Load raw evaluation artifact to extract rich recommendation fields
// ---------------------------------------------------------------------------
async function loadEvaluationArtifactPayload(
  supabase: ReturnType<typeof createAdminClient>,
  evaluationJobId: string,
): Promise<RichLookup> {
  const { data, error } = await supabase
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', evaluationJobId)
    .in('artifact_type', ['evaluation_result_v2', 'evaluation_result_v1'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.content) return new Map()
  return extractRichRecommendations(data.content)
}

export async function getWorkbenchQueue(input: { manuscriptId?: string; evaluationJobId?: string }): Promise<WorkbenchQueuePayload> {
  let warmupCorpus: Awaited<ReturnType<typeof loadReviseQueueWarmupCorpus>> | null = null
  let warmupWarning: string | null = null
  try {
    warmupCorpus = await loadReviseQueueWarmupCorpus()
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Failed to load Revise Queue warmup corpus.'
    warmupWarning = `Benchmark warmup proof is temporarily unavailable (${reason}). Revise Queue is rendered from saved evaluation artifacts with contract guards active.`
  }

  const user = await getAuthenticatedUser()
  if (!user) return emptyPayload('Please sign in to open your Revise Workbench.')

  const supabase = createAdminClient()
  let manuscriptId = input.manuscriptId
  let evaluationJobId = input.evaluationJobId

  if (!manuscriptId || !evaluationJobId) {
    return emptyPayload('Open a completed evaluation to load its saved revision package, or use the dashboard shortcut for the latest revision.')
  }

  const manuscriptNumericId = Number(manuscriptId)
  if (!Number.isInteger(manuscriptNumericId)) return emptyPayload('Invalid manuscript id.')

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
    .eq('id', evaluationJobId)
    .eq('manuscript_id', manuscriptNumericId)
    .maybeSingle()

  if (jobError) return emptyPayload(jobError.message)
  if (!job) return emptyPayload('Evaluation job not found for this manuscript.')
  if (job.status !== 'complete') return emptyPayload('This evaluation is not complete yet. Revise can load after the report is finished.')

  let boundManuscriptVersionId: string | null = null
  try {
    boundManuscriptVersionId = await ensureJobManuscriptVersionBinding(supabase, {
      jobId: evaluationJobId,
      manuscriptId: manuscriptNumericId,
      manuscriptVersionId:
        typeof job.manuscript_version_id === 'string' ? job.manuscript_version_id : null,
      userId: user.id,
    })
  } catch (error) {
    return emptyPayload(error instanceof Error ? error.message : 'Failed to bind manuscript version for legacy evaluation.')
  }

  const { artifactId: revisionLedgerArtifactId, opportunities: revisionLedgerOpportunities } = await ensureRevisionOpportunityLedgerArtifact(
    supabase,
    evaluationJobId,
  )

  const revisionPackage =
    revisionLedgerArtifactId && typeof (boundManuscriptVersionId ?? job.manuscript_version_id) === 'string' && (boundManuscriptVersionId ?? job.manuscript_version_id).trim().length > 0
      ? buildRevisionPackage({
          userId: user.id,
          manuscriptId: manuscriptNumericId,
          manuscriptVersionId: boundManuscriptVersionId ?? job.manuscript_version_id,
          evaluationJobId,
          revisionOpportunityLedgerArtifactId: revisionLedgerArtifactId,
          status: 'complete',
        })
      : null

  const opportunities = revisionLedgerOpportunities.map((opportunity) => {
    const criterion = criterionLabel(opportunity.criterion)
    const scope = scopeFromCoordinates(opportunity.manuscript_coordinates)
    const mode = modeForScope(scope)
    const severity: WorkbenchSeverity =
      opportunity.severity === 'must'
        ? 'must'
        : opportunity.severity === 'should'
          ? 'should'
          : 'could'
    const evidence = splitEvidence(sanitizeEvidenceExcerpt(opportunity.evidence_anchor) || null)
    const candidateA = (opportunity.candidate_text_a ?? '').trim()
    const candidateB = (opportunity.candidate_text_b ?? '').trim()
    const candidateC = (opportunity.candidate_text_c ?? '').trim()

    const options: WorkbenchOption[] = [
      {
        key: 'A',
        mechanism: 'Recommended repair',
        candidateText: candidateA,
        text: candidateA,
        rationale: 'Primary repair path from the evaluation.',
      },
      {
        key: 'B',
        mechanism: 'Rhythm variant',
        candidateText: candidateB,
        text: candidateB,
        rationale: 'Secondary variant for author-controlled cadence.',
      },
      {
        key: 'C',
        mechanism: 'Bolder rendering shift',
        candidateText: candidateC,
        text: candidateC,
        rationale: 'Alternative variant for stronger emphasis.',
      },
    ]

    const inferredCauseFallback =
      'The evaluation identified a concrete craft issue at this location that may weaken reader clarity or momentum.'

    const symptom = cleanAuthorFacingText(opportunity.symptom ?? opportunity.rationale, opportunity.rationale)
    const cause = cleanAuthorFacingText(opportunity.cause, inferredCauseFallback)
    const fixDirection = cleanAuthorFacingText(opportunity.fix_direction ?? opportunity.rationale, opportunity.rationale)
    const readerEffect = cleanAuthorFacingText(
      opportunity.reader_effect,
      fallbackReaderEffect(opportunity.criterion, scope),
    )
    const mistakeProofing = cleanAuthorFacingText(
      opportunity.mistake_proofing,
      fallbackMistakeProofing(mode),
    )

    return applyReviseCardContract({
      id: opportunity.opportunity_id,
      severity,
      scope,
      mode,
      source: 'evaluation' as const,
      criterion,
      leverage: cleanLabel(opportunity.provenance ?? 'evaluation_result'),
      crumb: `${criterion} · ${opportunity.manuscript_coordinates}`,
      title: firstSentence(opportunity.rationale, `${criterion} revision opportunity`),
      issueStatement: firstSentence(opportunity.rationale, `${criterion} revision opportunity`),
      meta: `${criterion} · ${opportunity.manuscript_coordinates}`,
      confidence: `${opportunity.confidence} confidence`,
      anchor: opportunity.manuscript_coordinates,
      quoteHighlight: evidence.quoteHighlight,
      quoteRest: evidence.quoteRest,
      symptom,
      cause,
      fixDirection,
      readerEffect,
      mistakeProofing,
      diagnostic: {
        symptom,
        cause,
        fixStrategy: fixDirection,
        readerImpact: readerEffect,
        evidence: {
          quotedExcerpt: `${evidence.quoteHighlight}${evidence.quoteRest}`.trim(),
          locationLabel: opportunity.manuscript_coordinates,
        },
        operationTargeting: `${scope} · ${opportunity.manuscript_coordinates}`,
        mistakeProofing,
      },
      options,
    }, {
      revisionOperation: normalizeRevisionOperation(opportunity.revision_operation),
    })
  })

  const readyForRevise = opportunities.filter((opportunity) => opportunity.readiness === 'ready_for_revise')
  const needsTargeting = opportunities.filter((opportunity) => opportunity.readiness === 'needs_targeting')

  const synthesisResult = {
    admitted: readyForRevise.length,
    clustered: 0,
    held: needsTargeting.length,
    suppressed: 0,
  }

  const totals: WorkbenchQueuePayload['totals'] = { must: 0, should: 0, could: 0 }
  const scopes: WorkbenchQueuePayload['scopes'] = { Line: 0, Passage: 0, Scene: 0, Chapter: 0, Structural: 0, Manuscript: 0 }
  const criteria: Record<string, number> = {}

  for (const opportunity of readyForRevise) {
    totals[opportunity.severity] += 1
    scopes[opportunity.scope] += 1
    criteria[opportunity.criterion] = (criteria[opportunity.criterion] ?? 0) + 1
  }

  return {
    ok: true,
    error: null,
    manuscriptId,
    evaluationJobId,
    revisionPackage,
    manuscriptTitle: manuscript.title ?? 'Untitled Manuscript',
    opportunities: readyForRevise,
    needsTargeting,
    readinessTotals: {
      ready_for_revise: readyForRevise.length,
      needs_targeting: needsTargeting.length,
    },
    totals,
    scopes,
    criteria,
    synthesis: synthesisResult,
    goLiveProof: {
      phase0Warmup: {
        status: warmupCorpus ? 'loaded' : 'unavailable',
        warning: warmupWarning,
        loadedAt: warmupCorpus?.loadedAt ?? null,
        corpusSha256: warmupCorpus?.proof.combinedSha256 ?? null,
        fileCount: warmupCorpus?.proof.fileCount ?? 0,
        benchmarkCount: warmupCorpus?.proof.benchmarkCount ?? 0,
        benchmarkFiles: warmupCorpus ? [...warmupCorpus.proof.benchmarkFilesLoaded] : [],
      },
      contractEnforcement: {
        candidateTextOnly: true,
        sixPartDiagnosticRequired: true,
        readyForRevise: readyForRevise.length,
        needsTargeting: needsTargeting.length,
        readyRate: opportunities.length === 0 ? 0 : Number((readyForRevise.length / opportunities.length).toFixed(4)),
      },
    },
  }
}

export const __testing = {
  hasActionableEvidence,
  synthesizeFindingsForWorkbench,
  scopeFromCoordinates,
}
