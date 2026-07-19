import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedUser } from '@/lib/supabase/server'
import { backfillManuscriptTitleIfMissing } from '@/lib/manuscripts/titleBackfill'
import { ensureRevisionOpportunityLedgerArtifact } from './opportunityLedger'
import { buildRevisionPackage, type RevisionPackage } from './revisionPackage'
import { loadReviseQueueWarmupCorpus } from './reviseQueueWarmup'
import { getCriterionDisplayLabel } from '@/lib/evaluation/reportRenderSafety'
import { sanitizeCMOS } from '@/lib/evaluation/cmosSanitizer'
import { getAuthorExposureDecision } from '@/lib/evaluation/authorExposureCertification'
import type { DiagnosticFinding, ProposalSeverity } from './types'
import {
  candidateTextIsCopyPasteReady,
  hasWordProcessorArtifact,
  inferRevisionOperation,
  operationLabels,
  REVISION_OPERATIONS,
  type RevisionOperation,
  type RevisionReadiness,
  validateReviseCardContract,
} from './reviseCardContract'
import { type SlaeGroundingStatus } from './slae'
import {
  modeContractForMetadata,
  resolveRevisionModeContract,
  type RevisionModeContract,
} from './modeContract'
import {
  type RecommendationCardType,
  type TrustedPathStatus,
  type StrategyCardViewModel,
} from './recommendationExecutability'
import {
  classifyWorkbenchExecutabilityDetailed,
  buildClassifiedWorkbenchOpportunity,
  resolveEvidenceLocationScope,
  resolveRepairScope,
  modeForScope,
  hasPlaceholderCoordinates,
  partitionClassifiedWorkbenchQueue,
  type WorkbenchExecutabilityClassification,
} from './workbenchQueueProjection'
import { buildWorkbenchQueueAudit, isAuditLogEnabled, logWorkbenchQueueAudit, type WorkbenchAdmissionDetails } from './workbenchQueueAudit'

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

export type WorkbenchSource = 'evaluation' | 'deep_revision' | 'baseline_discovery' | 'surface_polish'

export type WorkbenchOpportunity = {
  id: string
  sourceOpportunityId?: string
  sourceCriterion?: string
  sourceUedHash?: string
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
  cardType?: RecommendationCardType
  trustedPathStatus?: TrustedPathStatus
  executabilityReasons?: string[]
  evidenceLocationScope?: WorkbenchScope
  repairScope?: WorkbenchScope
  strategyCardViewModel?: StrategyCardViewModel | null
  groundingStatus?: SlaeGroundingStatus
  groundingNote?: string | null
  contextQuality?: 'clean' | 'limited' | 'blocked'
  preflightStatus?: 'passed' | 'limited_context' | 'blocked'
  preflightReasons?: string[]
  hydrationFailureReasons?: string[]
  resBlockerReasons?: string[]
  preflightNote?: string | null
  adminRepairLabel?: string | null
  adminRepairReason?: string | null
  adminActions?: string[]
  options: WorkbenchOption[]
}

const HYDRATION_REASON_PREFIX = 'hydration_'

function splitPreflightReasonsByClass(reasons: string[] | undefined): { hydration: string[]; res: string[] } {
  const all = Array.isArray(reasons) ? reasons.filter((reason) => typeof reason === 'string' && reason.trim().length > 0) : []
  const hydration = all.filter((reason) => reason.startsWith(HYDRATION_REASON_PREFIX))
  const res = all.filter((reason) => !reason.startsWith(HYDRATION_REASON_PREFIX))
  return { hydration, res }
}

function duplicateOpportunityIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const id of ids) {
    const normalized = id.trim()
    if (!normalized) continue
    if (seen.has(normalized)) {
      duplicates.add(normalized)
      continue
    }
    seen.add(normalized)
  }

  return [...duplicates].sort()
}

export type WorkbenchQueuePayload = {
  ok: boolean
  error: string | null
  manuscriptId: string | null
  evaluationJobId: string | null
  revisionPackage?: RevisionPackage | null
  modeContract: RevisionModeContract | null
  manuscriptTitle: string
  opportunities: WorkbenchOpportunity[]
  needsTargeting: WorkbenchOpportunity[]
  withheldUnsupported: WorkbenchOpportunity[]
  readinessTotals: {
    ready_for_revise: number
    needs_targeting: number
    withheld_unsupported: number
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

// ---------------------------------------------------------------------------
// Manuscript fidelity: verify evidence anchors against actual manuscript text
// ---------------------------------------------------------------------------
function normalizeForFidelity(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[""]/g, '"').replace(/['']/g, "'").trim().toLowerCase()
}

function evidenceMatchesManuscript(evidence: string, manuscriptText: string): boolean {
  if (!evidence || !manuscriptText) return false
  const normEvidence = normalizeForFidelity(evidence)
  const normManuscript = normalizeForFidelity(manuscriptText)
  if (normEvidence.length < 10) return false
  if (normManuscript.includes(normEvidence)) return true
  // Try matching first 60 chars — anchors may be truncated
  const prefix = normEvidence.slice(0, Math.min(60, normEvidence.length))
  if (prefix.length >= 15 && normManuscript.includes(prefix)) return true
  return false
}

function findClosestManuscriptPassage(evidence: string, manuscriptText: string): string | null {
  if (!evidence || !manuscriptText) return null
  const normEvidence = normalizeForFidelity(evidence)
  // Extract key content words from the evidence (skip short/common words)
  const evidenceWords = normEvidence.split(/\s+/).filter(w => w.length > 4)
  if (evidenceWords.length < 3) return null
  // Use a sliding window to find the best-matching passage
  const manuscriptWords = manuscriptText.split(/\s+/)
  const windowSize = Math.max(10, Math.min(evidenceWords.length * 2, 60))
  let bestScore = 0
  let bestStart = -1
  for (let i = 0; i <= manuscriptWords.length - windowSize; i += 1) {
    const window = manuscriptWords.slice(i, i + windowSize).join(' ')
    const normWindow = normalizeForFidelity(window)
    let score = 0
    for (const word of evidenceWords) {
      if (normWindow.includes(word)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      bestStart = i
    }
  }
  // Require at least 50% of content words to match
  if (bestScore < evidenceWords.length * 0.5) return null
  return manuscriptWords.slice(bestStart, bestStart + windowSize).join(' ').trim()
}

async function loadManuscriptRawText(
  supabase: ReturnType<typeof createAdminClient>,
  manuscriptVersionId: string | null,
  manuscriptId: number,
): Promise<string> {
  if (manuscriptVersionId) {
    const { data } = await supabase
      .from('manuscript_versions')
      .select('raw_text')
      .eq('id', manuscriptVersionId)
      .maybeSingle()
    if (data?.raw_text && typeof data.raw_text === 'string') return data.raw_text
  }
  // Fallback: try file_url from manuscripts table
  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('file_url')
    .eq('id', manuscriptId)
    .maybeSingle()
  return decodeManuscriptTextFromFileUrl(manuscript?.file_url as string | null | undefined)
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
// Convert a raw colon-delimited coordinate slug into a human-readable label.
// e.g. "chapter:1:paragraph:20" -> "Chapter 1, paragraph 20"
//      "chapter:3:scene:2"     -> "Chapter 3, scene 2"
// Per CMOS 8.180, generic in-text locators ("chapter", "paragraph", "scene")
// are lowercased; only the leading locator is capitalized so the label reads
// as sentence-initial text.
// Returns null when the slug is a non-locational placeholder (no digits),
// e.g. "chapter:submission:overview", "narrativeclosure:recommendation".
function humanizeCoordinateSlug(ref: string): string | null {
  const parts = ref.split(':').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const hasNumeric = parts.some((p) => /^\d+$/.test(p))
  if (!hasNumeric) return null // placeholder slug like chapter:submission:overview

  const segments: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i]
    const next = parts[i + 1]
    if (/^\d+$/.test(key)) continue // handled with its preceding label
    // CMOS 8.180: generic locators stay lowercase in running text.
    const label = key.toLowerCase()
    if (next && /^\d+$/.test(next)) {
      segments.push(`${label} ${next}`)
      i += 1
    } else {
      segments.push(label)
    }
  }
  if (!segments.length) return null
  // Capitalize only the leading locator so the label reads as sentence-initial.
  const joined = segments.join(', ')
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

function cleanLocationRef(ref: string | null | undefined): string | null {
  if (!ref) return null
  if (/^recommendation:\d+$/i.test(ref)) return null
  if (/^suggestion:\d+$/i.test(ref)) return null
  if (/^[A-Z_]+:\d+:rec:\d+$/i.test(ref)) return null
  if (/^[A-Z_]+:[a-z0-9]+$/i.test(ref) && ref.length < 30) return null
  if (/^revision_guidance:\d+$/i.test(ref)) return null
  // Humanize / suppress raw colon-delimited coordinate slugs so machine-readable
  // identifiers (chapter:1:paragraph:20, narrativeclosure:recommendation) never
  // reach the user-facing Original Passage location line.
  if (/^[a-z_]+:[a-z0-9:_]+$/i.test(ref)) {
    return humanizeCoordinateSlug(ref)
  }
  return ref
}

function firstSentence(value: string, fallback: string): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return fallback
  const sentence = clean.match(/^(.{24,150}?[.!?])\s/)?.[1]
  const out = sentence ?? clean
  // Enforce sentence-initial capitalization (CMOS §6.13). Fixes generator
  // output that begins with a lowercase verb (e.g. "insert...", "cut...").
  const capped = out.charAt(0).toUpperCase() + out.slice(1)
  return capped.length > 150 ? `${capped.slice(0, 147).trim()}…` : capped.replace(/[.!?]$/, '')
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

/** Template-generated meta-phrases that should never appear in user-facing text. */
const AUTHOR_FACING_CONTAMINATION_PATTERNS = [
  /there is a clear editorial opportunity in/i,
  /the material in .{5,80} has stronger upside/i,
  /the structural turn at .{5,80} is close/i,
  /the current draft surfaces pressure in/i,
  /several lines around .{5,80} summarize effect/i,
  /scene momentum drops near/i,
  /tension softens around/i,
  /the pressure line in .{5,80} resolves before/i,
  /cadence flattens in/i,
  /the prose rhythm around .{5,80} is close to landing/i,
  /at the scene level, .{5,80} would benefit/i,
  /within .{5,80}, add a short action-response/i,
  /rather than explaining the pressure in/i,
  /instead of resolving the moment in exposition at/i,
  /readers will track stakes more clearly if/i,
  /to strengthen reader trust, let .{5,80} conclude/i,
  /the passage near \u201c/i,
]

function cleanAuthorFacingText(value: string | null | undefined, fallback: string): string {
  const raw = (value ?? '').trim()
  if (!raw) return fallback

  if (hasWordProcessorArtifact(raw)) {
    return fallback
  }

  if (/\b(?:prosecontrol|narrativedrive|evaluation_result|criteria\.recommendations|provenance)\b/i.test(raw)) {
    return fallback
  }

  // Reject template-generated action text that leaked into user-facing fields.
  if (AUTHOR_FACING_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(raw))) {
    return fallback
  }

  // CMOS normalization: curly quotes, closed em-dashes, balanced quotation
  // marks, US spelling, single spacing. Applied to every author-facing field
  // so the revision workbench matches the sanitized evaluation-report path.
  return sanitizeCMOS(raw)
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
  // Only use mainAction as candidateText if it is actual copy-paste-ready prose,
  // not an editorial instruction like "Deepen Zimeon's interior reactions..."
  const actionIsProse = candidateTextIsCopyPasteReady(mainAction)
  const candidateA = actionIsProse ? mainAction : ''
  if (mode === 'repair-brief') {
    return [
      { key: 'A', mechanism: 'Recommended repair plan', candidateText: candidateA, text: candidateA, rationale: rich.expected_impact?.trim() || 'Primary repair path from the evaluation.' },
      { key: 'B', mechanism: 'Conservative bridge plan', candidateText: '', text: '', rationale: 'Needs targeting: add a manuscript-prose rhythm variant.' },
      { key: 'C', mechanism: 'Bolder restructuring plan', candidateText: '', text: '', rationale: 'Needs targeting: add a manuscript-prose bold variant.' },
    ]
  }
  return [
    { key: 'A', mechanism: 'Recommended repair', candidateText: candidateA, text: candidateA, rationale: rich.expected_impact?.trim() || 'Primary repair path from the evaluation.' },
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
    // Diagnostic fields carry ONLY real evaluation data (rich enrichment or the
    // finding's own recommendation/diagnosis). Canned boilerplate is never
    // substituted here — a genuinely-empty field must reach the admission gate
    // empty so DIAGNOSTIC_MISSING_* fires and the card is withheld, not padded.
    symptom: rich?.symptom || finding.diagnosis || '',
    cause: rich?.mechanism || finding.recommendation || '',
    fixDirection: rich?.specific_fix || rich?.action || finding.recommendation || '',
    readerEffect: rich?.reader_effect || '',
    mistakeProofing: rich?.mistake_proofing || '',
    diagnostic: {
      symptom: rich?.symptom || finding.diagnosis || '',
      cause: rich?.mechanism || finding.recommendation || '',
      fixStrategy: rich?.specific_fix || rich?.action || finding.recommendation || '',
      readerImpact: rich?.reader_effect || '',
      evidence: {
        quotedExcerpt: `${evidence.quoteHighlight}${evidence.quoteRest}`.trim(),
        locationLabel: anchor,
      },
      operationTargeting: `${scope} · ${anchor}`,
      mistakeProofing: rich?.mistake_proofing || '',
    },
    options: rich ? optionsFromRich(rich, mode) : optionsFallback(mode),
  })
}

const sourceOrder: Record<WorkbenchSource, number> = { evaluation: 0, deep_revision: 1, baseline_discovery: 2, surface_polish: 3 }

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
    modeContract: null,
    manuscriptTitle: 'Revise Workbench',
    opportunities: [],
    needsTargeting: [],
    withheldUnsupported: [],
    readinessTotals: { ready_for_revise: 0, needs_targeting: 0, withheld_unsupported: 0 },
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
async function _loadEvaluationArtifactPayload(
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

async function loadEvaluationResultPayload(
  supabase: ReturnType<typeof createAdminClient>,
  evaluationJobId: string,
): Promise<unknown> {
  const { data, error } = await supabase
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', evaluationJobId)
    .in('artifact_type', ['evaluation_result_v2', 'evaluation_result_v1'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data?.content ?? null
}

type GetWorkbenchQueueInput = {
  manuscriptId?: string
  evaluationJobId?: string
  user?: { id: string; email?: string | null } | null
}

async function getWorkbenchQueueInternal(
  input: GetWorkbenchQueueInput,
  allowTrustedServerUser: boolean,
): Promise<WorkbenchQueuePayload> {
  let warmupCorpus: Awaited<ReturnType<typeof loadReviseQueueWarmupCorpus>> | null = null
  let warmupWarning: string | null = null
  try {
    warmupCorpus = await loadReviseQueueWarmupCorpus()
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Failed to load Revise Queue warmup corpus.'
    warmupWarning = `Benchmark warmup proof is temporarily unavailable (${reason}). Revise Queue is rendered from saved evaluation artifacts with contract guards active.`
  }

  const user =
    input.user && (allowTrustedServerUser || process.env.WORKER_ALLOW_SERVICE_ROLE_DEV === '1')
      ? input.user
      : await getAuthenticatedUser()
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
    .select('id, status, manuscript_id, manuscript_version_id, policy_family, voice_preservation_level, english_variant')
    .eq('id', evaluationJobId)
    .eq('manuscript_id', manuscriptNumericId)
    .maybeSingle()

  if (jobError) return emptyPayload(jobError.message)
  if (!job) return emptyPayload('Evaluation job not found for this manuscript.')
  if (job.status !== 'complete') return emptyPayload('This evaluation is not complete yet. Revise can load after the report is finished.')

  const exposureDecision = await getAuthorExposureDecision(supabase, evaluationJobId)
  if (exposureDecision.exposable === false) {
    if (exposureDecision.reason === 'db_error') {
      return emptyPayload('System error checking author exposure certification. Please try again shortly.')
    }

    return emptyPayload(`Evaluation is not releasable for author revise surfaces (author_exposure:${exposureDecision.reason}).`)
  }

  const evaluationResultPayload = await loadEvaluationResultPayload(supabase, evaluationJobId)
  const modeContract = resolveRevisionModeContract({
    evaluationPayload: evaluationResultPayload,
    job,
  })

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

  const duplicateLedgerOpportunityIds = duplicateOpportunityIds(
    revisionLedgerOpportunities
      .map((opportunity) => String(opportunity.opportunity_id ?? '').trim())
      .filter(Boolean),
  )

  if (duplicateLedgerOpportunityIds.length > 0) {
    return emptyPayload(
      `Revision opportunity ledger contains duplicate opportunity id${duplicateLedgerOpportunityIds.length === 1 ? '' : 's'}: ${duplicateLedgerOpportunityIds.join(', ')}.`,
    )
  }

  // Load manuscript text for evidence fidelity verification
  let manuscriptRawText = ''
  try {
    manuscriptRawText = await loadManuscriptRawText(
      supabase,
      boundManuscriptVersionId ?? (typeof job.manuscript_version_id === 'string' ? job.manuscript_version_id : null),
      manuscriptNumericId,
    )
  } catch {
    // Non-blocking: fidelity checks degrade gracefully without manuscript text
  }

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

  const admissionsById = new Map<string, WorkbenchAdmissionDetails>()
  const classificationsById = new Map<string, WorkbenchExecutabilityClassification>()

  const opportunities = revisionLedgerOpportunities.map((opportunity) => {
    const criterion = criterionLabel(opportunity.criterion)
    const evidenceLocationScope = resolveEvidenceLocationScope(opportunity.manuscript_coordinates)
    const repairScope = resolveRepairScope({
      fixDirection: opportunity.fix_direction,
      rationale: opportunity.rationale,
      symptom: opportunity.symptom,
      readerEffect: opportunity.reader_effect,
      revisionOperation: normalizeRevisionOperation(opportunity.revision_operation) ?? undefined,
      scope: evidenceLocationScope,
    })
    const mode = modeForScope(repairScope)
    const scope = evidenceLocationScope
    const severity: WorkbenchSeverity =
      opportunity.severity === 'must'
        ? 'must'
        : opportunity.severity === 'should'
          ? 'should'
          : 'could'
    // Fidelity check: verify evidence actually appears in manuscript.
    // SLAE fail-closed rule: unresolved mismatch blocks executable readiness.
    // If correction fails, evidence is blanked and opportunity is forced into
    // needs_targeting via contract validation.
    let rawEvidence = sanitizeEvidenceExcerpt(opportunity.evidence_anchor) || null
    let groundingStatus: SlaeGroundingStatus = rawEvidence ? 'supported' : 'uncertain_after_relook_reportable'
    let groundingNote: string | null = rawEvidence
      ? null
      : 'No evidence excerpt available in ledger; requires targeting before revise.'

    if (rawEvidence && manuscriptRawText && !evidenceMatchesManuscript(rawEvidence, manuscriptRawText)) {
      const corrected = findClosestManuscriptPassage(rawEvidence, manuscriptRawText)
      if (corrected) {
        rawEvidence = corrected
        groundingStatus = 'supported_after_relook'
        groundingNote = 'Evidence excerpt required manuscript relook correction before rendering.'
      } else {
        rawEvidence = null
        groundingStatus = 'uncertain_after_relook_blocked'
        groundingNote = 'Evidence excerpt did not match manuscript and could not be corrected; blocked by SLAE.'
      }
    }
    const evidence = splitEvidence(rawEvidence)
    const candidateA = (opportunity.candidate_text_a ?? '').trim()
    const candidateB = (opportunity.candidate_text_b ?? '').trim()
    const candidateC = (opportunity.candidate_text_c ?? '').trim()

    if (opportunity.grounding_status && opportunity.grounding_status !== 'supported') {
      groundingStatus = opportunity.grounding_status
      groundingNote = opportunity.grounding_note ?? groundingNote
    }

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

    // Required diagnostic fields must reach applyReviseCardContract with their
    // real ledger values or as empty strings. No canned fallbacks are permitted
    // here: an empty field must fail the contract/admission gates so the card is
    // withheld rather than padded with fabricated author-facing prose.
    const symptom = cleanAuthorFacingText(opportunity.symptom ?? opportunity.rationale, opportunity.rationale)
    const cause = cleanAuthorFacingText(opportunity.cause, '')
    const fixDirection = cleanAuthorFacingText(opportunity.fix_direction ?? opportunity.rationale, opportunity.rationale)
    const readerEffect = cleanAuthorFacingText(opportunity.reader_effect, '')
    const mistakeProofing = cleanAuthorFacingText(opportunity.mistake_proofing, '')

    const contracted = applyReviseCardContract({
      id: opportunity.opportunity_id,
      severity,
      scope,
      mode,
      evidenceLocationScope,
      repairScope,
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

    const splitReasons = splitPreflightReasonsByClass(opportunity.preflight_reasons)
    const hydrationRepairNeeded = splitReasons.hydration.length > 0
    const baseOpportunity = {
      ...contracted,
      sourceOpportunityId: (opportunity as any).source_opportunity_id,
      sourceCriterion: (opportunity as any).source_criterion,
      sourceUedHash: (opportunity as any).source_ued_hash,
      readinessReason: hydrationRepairNeeded
        ? 'Needs hydration repair'
        : contracted.readinessReason,
      groundingStatus,
      groundingNote,
      contextQuality: opportunity.context_quality,
      preflightStatus: opportunity.preflight_status,
      preflightReasons: opportunity.preflight_reasons,
      hydrationFailureReasons: splitReasons.hydration,
      resBlockerReasons: splitReasons.res,
      preflightNote: opportunity.preflight_note ?? null,
      adminRepairLabel: hydrationRepairNeeded ? 'Needs hydration repair' : null,
      adminRepairReason: hydrationRepairNeeded
        ? 'anchor/context not recoverable'
        : null,
      adminActions: Array.isArray((opportunity as any).admin_actions)
        ? ((opportunity as any).admin_actions as string[])
        : undefined,
      modeContract: modeContractForMetadata(modeContract),
      evidenceLocationScope,
      repairScope,
    }
    const executability = classifyWorkbenchExecutabilityDetailed(baseOpportunity)
    classificationsById.set(baseOpportunity.id, executability)

    admissionsById.set(baseOpportunity.id, {
      copyPasteAdmissionPassed: executability.copyPasteAdmissionPassed,
      copyPasteAdmissionReasons: executability.copyPasteAdmissionReasons,
      strategyAdmissionPassed: executability.strategyAdmissionPassed,
      strategyAdmissionReasons: executability.strategyAdmissionReasons,
    })

    return buildClassifiedWorkbenchOpportunity(baseOpportunity, executability)
  })

  const partition = partitionClassifiedWorkbenchQueue(opportunities)

  const synthesisResult = {
    admitted: partition.opportunities.length,
    clustered: 0,
    held: partition.needsTargeting.length + partition.withheldUnsupported.length,
    suppressed: 0,
  }

  const payload: WorkbenchQueuePayload = {
    ok: true,
    error: null,
    manuscriptId,
    evaluationJobId,
    revisionPackage,
    modeContract,
    manuscriptTitle: manuscript.title ?? (await backfillManuscriptTitleIfMissing(manuscriptNumericId)) ?? 'Untitled Manuscript',
    opportunities: partition.opportunities,
    needsTargeting: partition.needsTargeting,
    withheldUnsupported: partition.withheldUnsupported,
    readinessTotals: partition.readinessTotals,
    totals: partition.totals,
    scopes: partition.scopes,
    criteria: partition.criteria,
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
        readyForRevise: partition.opportunities.length,
        needsTargeting: partition.needsTargeting.length + partition.withheldUnsupported.length,
        readyRate: opportunities.length === 0 ? 0 : Number((partition.opportunities.length / opportunities.length).toFixed(4)),
      },
    },
  }

  if (isAuditLogEnabled()) {
    logWorkbenchQueueAudit(buildWorkbenchQueueAudit(payload, { ledgerArtifactId: revisionLedgerArtifactId, admissionsById, classificationsById }))
  }

  return payload
}

export async function getWorkbenchQueue(input: GetWorkbenchQueueInput): Promise<WorkbenchQueuePayload> {
  return getWorkbenchQueueInternal(input, false)
}

/**
 * Server-only projection for identity-verified Held Recovery Readmission.
 * It deliberately reuses the complete Workbench hydration and classification
 * path instead of maintaining a second admission projection.
 */
export async function getWorkbenchQueueForHeldRecoveryReadmission(
  input: GetWorkbenchQueueInput & { user: { id: string; email?: string | null } },
): Promise<WorkbenchQueuePayload> {
  return getWorkbenchQueueInternal(input, true)
}

export const __testing = {
  hasActionableEvidence,
  synthesizeFindingsForWorkbench,
  scopeFromCoordinates: resolveEvidenceLocationScope,
  hasPlaceholderCoordinates,
  duplicateOpportunityIds,
  humanizeCoordinateSlug,
  cleanLocationRef,
  cleanAuthorFacingText,
  firstSentence,
}
