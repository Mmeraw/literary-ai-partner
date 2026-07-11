import { createHash, randomUUID } from 'crypto';
import {
  REVISION_OPERATIONS,
  candidateTextIsCopyPasteReady,
  inferRevisionOperation,
  type RevisionOperation,
} from './reviseCardContract';
import { type SlaeGroundingStatus } from './slae';
import { modeContractForMetadata, resolveRevisionModeContract } from './modeContract';
import { extractGenreExpectationMetadataFromEvaluationPayload } from '@/lib/evaluation/genreExpectationProfiles';
import { normalizeEnglishVariant, resolvedEnglishVariantLabel } from '@/lib/evaluation/englishVariant';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import {
  buildCompactCognitiveInitializationBlock,
  getConstitutionalAuthorityStatus,
} from '@/lib/evaluation/dreamTemplateLoader';
import {
  hydrateLedgerCandidates,
  HYDRATION_MODEL,
  HYDRATION_PROMPT_VERSION,
  type HydrationOpportunity,
} from './candidateHydration';
import { evaluateCardQuality } from './candidateQuality';
import { regenerateCandidatesForQualityFailed } from './candidateRegeneration';
import { enrichDiagnosticFields, needsDiagnosticEnrichment, type EnrichmentOpportunity } from './diagnosticEnrichment';
import { logRevisionEvent } from './logRevisionEvent';
import type { CandidateRejectionTelemetry } from './telemetry';
import { getArtifact } from '@/lib/evaluation/fipocRegistry';

type LedgerSeverity = 'must' | 'should' | 'could';
type LedgerConfidence = 'low' | 'medium' | 'high';
type ReviseContextQuality = 'clean' | 'limited' | 'blocked';
type RecommendationPreflightStatus = 'passed' | 'limited_context' | 'blocked';

const REVISE_QUEUE_PREFLIGHT_GATE_VERSION = 'revise_queue_preflight_gate_v1' as const;

const BLOCKED_CARD_ADMIN_ACTIONS = [
  'Regenerate recommendation',
  'Rewrite anchor',
  'Discard unsafe card',
] as const;

const HYDRATION_INPUT_INCOMPLETE_ADMIN_ACTION = 'Regenerate from source manuscript context' as const;
const REGENERATE_CANDIDATE_PROSE_ADMIN_ACTION = 'Regenerate candidate prose' as const;

type RevisionOpportunity = {
  opportunity_id: string;
  source_opportunity_id?: string;
  source_criterion?: string;
  source_ued_hash?: string;
  finding_id?: string;
  criterion: string;
  severity: LedgerSeverity;
  rationale: string;
  evidence_anchor: string;
  manuscript_coordinates: string;
  provenance: string;
  confidence: LedgerConfidence;
  decision_state: 'open';
  revision_operation?: RevisionOperation;
  candidate_text_a?: string;
  candidate_text_b?: string;
  candidate_text_c?: string;
  grounding_status?: SlaeGroundingStatus;
  grounding_note?: string | null;
  context_quality?: ReviseContextQuality;
  preflight_status?: RecommendationPreflightStatus;
  preflight_reasons?: string[];
  preflight_note?: string;
  hydration_eligible?: boolean;
  hydration_ineligibility_reasons?: string[];
  admin_actions?: string[];
  symptom?: string;
  cause?: string;
  fix_direction?: string;
  reader_effect?: string;
  mistake_proofing?: string;
  /**
   * Structured, human-readable diagnostics explaining every preflight decision
   * (why an opportunity was blocked or admitted). Populated by the anchor-coherence
   * evaluation so future debugging does not require reverse-engineering the gate.
   */
  preflight_diagnostic?: AnchorCoherenceDiagnostic;
};

/**
 * Diagnostic record explaining the anchor-coherence decision for one opportunity.
 * Stored so a blocked opportunity carries its own "why" rather than a bare reason code.
 */
type AnchorCoherenceDiagnostic = {
  check: 'anchor_coherence';
  lexical_overlap: number;
  criterion: string;
  concrete_action: boolean;
  valid_anchor: boolean;
  structural_target: boolean;
  coherent_fix_or_effect: boolean;
  decision: 'admitted' | 'rejected_incoherent';
  reason: string;
};

type WorkbenchLikeOpportunity = {
  id?: unknown;
  criterion?: unknown;
  severity?: unknown;
  fixDirection?: unknown;
  symptom?: unknown;
  title?: unknown;
  quoteHighlight?: unknown;
  quoteRest?: unknown;
  anchor?: unknown;
  meta?: unknown;
  source?: unknown;
  confidence?: unknown;
};

type EnsureLedgerResult = {
  artifactId: string | null;
  opportunities: RevisionOpportunity[];
};

export const REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD = 25_000 as const;
export const REVISE_QUEUE_MAX_SHORT_FORM = 50 as const;
export const REVISE_QUEUE_MAX_LONG_FORM = 100 as const;

type CandidateBuildInput = {
  criterion: string;
  anchor: string;
  rationale: string;
  action?: string;
  expectedImpact?: string;
  fixDirection?: string;
  symptom?: string;
  revisionOperation?: RevisionOperation;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function getReviseQueueMaxOpportunities(wordCount: number | null | undefined): number {
  return typeof wordCount === 'number' && Number.isFinite(wordCount) && wordCount >= REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD
    ? REVISE_QUEUE_MAX_LONG_FORM
    : REVISE_QUEUE_MAX_SHORT_FORM;
}

function capRevisionOpportunities(
  opportunities: RevisionOpportunity[],
  wordCount: number | null | undefined,
): RevisionOpportunity[] {
  const maxOpportunities = getReviseQueueMaxOpportunities(wordCount);
  if (opportunities.length <= maxOpportunities) return opportunities;

  return [...opportunities]
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3))
    .slice(0, maxOpportunities);
}

function sourceHashFor(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function normalizeSeverity(raw: unknown, scoreOverride?: unknown): LedgerSeverity {
  if (typeof scoreOverride === 'number' && Number.isFinite(scoreOverride)) {
    if (scoreOverride <= 4) return 'must';
    if (scoreOverride <= 7) return 'should';
    return 'could';
  }
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['must', 'high', 'critical', 'major', 'blocker'].includes(normalized)) return 'must';
  if (['could', 'low', 'minor', 'optional'].includes(normalized)) return 'could';
  return 'should';
}

function normalizeConfidence(raw: unknown): LedgerConfidence {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw >= 0.8) return 'high';
    if (raw >= 0.5) return 'medium';
    return 'low';
  }
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (['high', 'strong'].includes(normalized)) return 'high';
  if (['low', 'weak'].includes(normalized)) return 'low';
  return 'medium';
}

function capLedgerConfidence(confidence: LedgerConfidence, max: LedgerConfidence): LedgerConfidence {
  const rank: Record<LedgerConfidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[confidence] > rank[max] ? max : confidence;
}

function normalizeCriterion(raw: unknown): string {
  const criterion = firstNonEmptyString(raw, 'GENERAL');
  return criterion.replace(/\s+/g, '_').toUpperCase();
}

function normalizeOptionalText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const clean = raw.trim();
  return clean.length > 0 ? clean : undefined;
}

function normalizeProseSentence(raw: string): string {
  const clean = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["\u201c]+|["\u201d]+$/g, '')
    .trim();

  if (!clean) return '';
  return /[.!?]["\u201d']?$/.test(clean) ? clean : `${clean}.`;
}

function stripEvidenceWrapper(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^Evidence:\s*/i, '')
    .replace(/^Original Passage\s*/i, '')
    .replace(/^Recommendation:\s*/i, '')
    .replace(/^["\u201c](.+)["\u201d]$/u, '$1')
    .trim();
}

function sentenceUnits(raw: string): string[] {
  const clean = stripEvidenceWrapper(raw);
  const matches = clean.match(/[^.!?]+[.!?][\u201d"']?/g);
  if (matches && matches.length > 0) {
    return matches.map((item) => item.trim()).filter(Boolean);
  }
  return clean ? [clean] : [];
}

function trimWords(value: string, maxWords: number): string {
  const clean = normalizeProseSentence(value);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return clean;
  const shortened = words.slice(0, maxWords).join(' ').replace(/[,;:\u2014\u2013-]+$/, '').trim();
  return normalizeProseSentence(shortened);
}

function extractQuotedSpan(raw: string): string {
  if (!raw) return '';
  const matches = [...raw.matchAll(/["\u201c\u201d]([^"\u201c\u201d]{4,220})["\u201c\u201d]/g)]
    .map((match) => (match[1] ?? '').trim())
    .filter(Boolean);

  if (matches.length === 0) return '';
  return matches.sort((a, b) => b.length - a.length)[0] ?? '';
}

function extractLeadName(raw: string): string {
  if (!raw) return '';

  const tokens = raw.match(/\b[A-Z][a-zA-Z\u2019'-]{2,}\b/g) ?? [];
  const banned = new Set([
    'Chapter', 'Line', 'Scene', 'Passage', 'Structural', 'Manuscript', 'Move', 'Small',
    'Fry', 'Why', 'There', 'The', 'This', 'That', 'At', 'In', 'Item', 'Concept',
    'Core', 'Premise', 'Needs', 'Targeting',
    // Editorial instruction verbs that may be capitalized at sentence start
    'Deepen', 'Expand', 'Clarify', 'Strengthen', 'Tighten', 'Compress', 'Heighten',
    'Foreground', 'Surface', 'Sharpen', 'Simplify', 'Brighten', 'Replace', 'Repair',
    'Rewrite', 'Restructure', 'Dramatize', 'Intensify', 'Underscore', 'Anchor',
    'Ground', 'Dial', 'Trim', 'Cut', 'Develop', 'Revise', 'Remove', 'Break',
    'Insert', 'Weave', 'Highlight', 'Show', 'Add', 'Fix',
  ]);
  for (const token of tokens) {
    const clean = token.replace(/\u2019s$/, '');
    if (!banned.has(clean)) return clean;
  }
  return '';
}

function escapeRegExp(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeActionIntent(raw: string): string {
  if (!raw) return '';
  const clean = raw
    .replace(/^\s*(?:In|At)\s+the\s+[^,]+,\s*/i, '')
    .replace(/^\s*where\s+[^,]+,\s*/i, '')
    .replace(/\b(?:replace|repair|fix|clarify|strengthen|insert|weave|expand|compress|tighten|trim|cut)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return clean;
}

function inferLedgerRevisionOperation(input: CandidateBuildInput): RevisionOperation {
  if (input.revisionOperation) return input.revisionOperation;
  return inferRevisionOperation({
    scope: input.fixDirection,
    mode: undefined,
    fixDirection: input.fixDirection,
    recommendation: `${input.rationale} ${input.action ?? ''}`,
  });
}

function extractSpeech(raw: string): { setup: string; speaker: string; verb: string; speech: string } | null {
  const clean = stripEvidenceWrapper(raw);
  const match = clean.match(/^(.*?)([A-Z][A-Za-z\u2019'\-]+)\s+(said|asked|whispered|muttered|shouted|called|cried),\s*[\u201c"](.+?)[\u201d"]\.?$/u);
  if (!match) return null;
  return {
    setup: (match[1] ?? '').replace(/,\s*$/, '').trim(),
    speaker: match[2],
    verb: match[3],
    speech: (match[4] ?? '').trim(),
  };
}

function quoteSpeech(value: string): string {
  const clean = value.trim().replace(/^["\u201c\u201d]+|["\u201c\u201d]+$/g, '');
  return `“${clean}”`;
}

function firstSpeechSentence(value: string): string {
  const first = value.split(/(?<=[.!?])\s+/)[0]?.trim() ?? value.trim();
  return normalizeProseSentence(first).replace(/^\s*["\u201c]|\s*["\u201d]$/g, '');
}

function ensureDistinctCandidates(candidates: { a: string; b: string; c: string }, seed: string): { a: string; b: string; c: string } {
  const normalized = new Set<string>();
  const names = ['a', 'b', 'c'] as const;
  const repaired = { ...candidates };

  for (const name of names) {
    const clean = normalizeProseSentence(repaired[name]);
    const key = clean.toLowerCase();
    if (!clean || clean.split(/\s+/).length < 5 || normalized.has(key)) {
      // Use the seed (evidence passage) directly when available rather than
      // generating unrelated generic literary prose.
      repaired[name] = seed && seed.split(/\s+/).length >= 5 ? seed : clean || seed;
    }
    normalized.add(repaired[name].toLowerCase());
  }

  return repaired;
}

function buildCompressCandidates(input: CandidateBuildInput): { a: string; b: string; c: string } {
  const anchor = stripEvidenceWrapper(input.anchor);
  const speech = extractSpeech(anchor);
  if (speech) {
    const speechLine = firstSpeechSentence(speech.speech);
    const addressee = extractLeadName(`${input.rationale} ${input.action ?? ''}`) || 'the others';
    return ensureDistinctCandidates({
      a: normalizeProseSentence(`${speech.setup ? `${speech.setup}, ` : ''}${speech.speaker} ${speech.verb}, ${quoteSpeech(speechLine)}`),
      b: normalizeProseSentence(`${speech.setup ? `${speech.setup}. ` : ''}${quoteSpeech(speechLine)} ${speech.speaker} ${speech.verb}.`),
      c: normalizeProseSentence(`${speech.speaker} waited for the air to clear, then looked toward ${addressee} and ${speech.verb}, ${quoteSpeech(speechLine)}`),
    }, normalizeProseSentence(anchor));
  }

  const sentences = sentenceUnits(anchor);
  const first = sentences[0] ?? anchor;
  const second = sentences[1] ?? '';
  return ensureDistinctCandidates({
    a: trimWords(first, 32),
    b: trimWords(second ? `${first} ${second}` : first, 42),
    c: trimWords(first.replace(/\b(very|really|just|seemed to)\b/gi, '').replace(/\s+/g, ' '), 26),
  }, normalizeProseSentence(first));
}

function buildReplacementCandidates(input: CandidateBuildInput): { a: string; b: string; c: string } {
  const anchor = stripEvidenceWrapper(input.anchor);
  const speech = extractSpeech(anchor);
  if (speech) return buildCompressCandidates(input);

  const sentences = sentenceUnits(anchor);
  const first = sentences[0] ?? anchor;
  const second = sentences[1] ?? '';
  const leadName = extractLeadName(`${input.rationale} ${input.action ?? ''} ${anchor}`) || 'The moment';
  const concreteObject = extractQuotedSpan(anchor) || first;
  const seed = trimWords(concreteObject, 32);

  return ensureDistinctCandidates({
    a: trimWords(second ? `${first} ${second}` : first, 48),
    b: trimWords(`${first} ${normalizeActionIntent(input.action ?? input.rationale)}`, 40),
    c: trimWords(second || first, 30),
  }, seed);
}

function buildInsertionCandidates(input: CandidateBuildInput): { a: string; b: string; c: string } {
  const anchor = stripEvidenceWrapper(input.anchor);
  const leadName = extractLeadName(`${input.rationale} ${input.action ?? ''} ${anchor}`) || 'He';
  const secondName = extractLeadName(anchor.replace(new RegExp(`\\b${escapeRegExp(leadName)}\\b`, 'g'), '')) || 'the others';
  const quoted = extractQuotedSpan(anchor);
  const seed = quoted
    ? `${leadName} heard the words again: ${quoteSpeech(quoted)}`
    : trimWords(stripEvidenceWrapper(anchor), 24);

  return ensureDistinctCandidates({
    a: normalizeProseSentence(`${leadName} paused, and the delay told ${secondName} more than he meant to reveal.`),
    b: normalizeProseSentence(`${seed} This time, the answer stayed in his body before it reached his mouth.`),
    c: normalizeProseSentence(`${leadName} looked toward ${secondName} before answering, and the silence carried what he had not said.`),
  }, normalizeProseSentence(seed));
}

function buildFallbackCandidateTexts(input: CandidateBuildInput): { a: string; b: string; c: string } {
  const operation = inferLedgerRevisionOperation(input);

  if (
    operation === 'insert_before_selected_passage' ||
    operation === 'insert_after_selected_passage'
  ) {
    return buildInsertionCandidates(input);
  }

  if (
    operation === 'compress_selected_passage' ||
    /\b(compress|tighten|trim|cut|shorten|condense)\b/i.test(`${input.action ?? ''} ${input.fixDirection ?? ''} ${input.rationale}`)
  ) {
    return buildCompressCandidates(input);
  }

  return buildReplacementCandidates(input);
}

function normalizedForComparison(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function candidateEchoesAnchor(candidate: string, anchor: string): boolean {
  const normCandidate = normalizedForComparison(candidate);
  const normAnchor = normalizedForComparison(anchor);
  if (!normCandidate || !normAnchor) return false;
  // Exact match or one is a substring of the other (handles truncation)
  if (normCandidate === normAnchor) return true;
  if (normAnchor.length >= 20 && normCandidate.includes(normAnchor)) return true;
  if (normCandidate.length >= 20 && normAnchor.includes(normCandidate)) return true;
  return false;
}

type ReviseContextQualityDecision = {
  status: ReviseContextQuality;
  source: 'ledger_quality_report_v1' | 'missing';
  gate_ready_status: string | null;
  blocking_reasons: string[];
  degraded_layers: string[];
};

function stringArrayFromUnknown(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];
}

export function resolveReviseContextQuality(ledgerQualityReportContent: unknown, evaluationMode?: string): ReviseContextQualityDecision {
  if (!isRecord(ledgerQualityReportContent)) {
    return {
      status: 'clean',
      source: 'missing',
      gate_ready_status: null,
      blocking_reasons: [],
      degraded_layers: [],
    };
  }

  const report = isRecord(ledgerQualityReportContent.quality_report)
    ? ledgerQualityReportContent.quality_report
    : ledgerQualityReportContent;
  const gateReadyStatus = typeof report.gate_ready_status === 'string'
    ? report.gate_ready_status.trim()
    : null;
  const layerTruthStatus = isRecord(report.layer_truth_status) ? report.layer_truth_status : {};
  const degradedLayers = Object.entries(layerTruthStatus)
    .filter(([, status]) => typeof status === 'string' && status.trim().toLowerCase() !== 'clean' && status.trim().toLowerCase() !== 'reviewable')
    .map(([layer]) => layer);
  const blockingReasons = stringArrayFromUnknown(report.blocking_reasons);

  if (gateReadyStatus === 'blocked_retryable_technical') {
    return {
      status: 'limited',
      source: 'ledger_quality_report_v1',
      gate_ready_status: gateReadyStatus,
      blocking_reasons: blockingReasons,
      degraded_layers: degradedLayers,
    };
  }

  // repair_required means "fragmented identity or zero antagonist coverage;
  // ledger may be incomplete but not critically broken". This should degrade
  // to 'limited' — not 'blocked' — so opportunities can still reach the
  // Revise Queue with advisory warnings. Only true hard-fail statuses
  // (blocked, blocked_content_hard_fail) should fully block the queue.
  if (gateReadyStatus === 'repair_required') {
    return {
      status: 'limited',
      source: 'ledger_quality_report_v1',
      gate_ready_status: gateReadyStatus,
      blocking_reasons: blockingReasons,
      degraded_layers: degradedLayers,
    };
  }

  if (
    gateReadyStatus === 'blocked' ||
    gateReadyStatus === 'blocked_content_hard_fail'
  ) {
    // In TESTIMONY mode (memoir, personal essay), "no POV characters" is
    // expected — the unnamed first-person narrator IS the protagonist.
    // Downgrade from 'blocked' to 'limited' so the Revise queue can proceed.
    const isTestimonyPovSoftening =
      evaluationMode?.toUpperCase() === 'TESTIMONY' &&
      blockingReasons.length > 0 &&
      blockingReasons.every((reason) =>
        /\bno pov\b|no protagonist\b|narrator is unnamed\b/i.test(reason),
      );

    if (isTestimonyPovSoftening) {
      return {
        status: 'limited',
        source: 'ledger_quality_report_v1',
        gate_ready_status: gateReadyStatus,
        blocking_reasons: blockingReasons,
        degraded_layers: degradedLayers,
      };
    }

    return {
      status: 'blocked',
      source: 'ledger_quality_report_v1',
      gate_ready_status: gateReadyStatus,
      blocking_reasons: blockingReasons,
      degraded_layers: degradedLayers,
    };
  }

  return {
    status: degradedLayers.length > 0 ? 'limited' : 'clean',
    source: 'ledger_quality_report_v1',
    gate_ready_status: gateReadyStatus,
    blocking_reasons: blockingReasons,
    degraded_layers: degradedLayers,
  };
}

function normalizedTokenSet(raw: string): Set<string> {
  const stop = new Set([
    'about', 'after', 'again', 'against', 'before', 'being', 'between', 'could', 'every', 'from', 'have', 'into',
    'more', 'should', 'that', 'their', 'there', 'these', 'this', 'those', 'through', 'with', 'would', 'while',
    'where', 'which', 'when', 'what', 'will', 'without', 'within', 'because', 'passage', 'selected', 'revision',
  ]);
  const tokens = normalizedForComparison(raw)
    .split(' ')
    .filter((token) => token.length >= 4 && !stop.has(token));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function anchorLooksTruncated(anchor: string): boolean {
  const clean = stripEvidenceWrapper(anchor);
  if (clean.length < 50) return false;
  if (/[.!?][\u201d"']?$/.test(clean)) return false;
  if (/[,:;\u2014\u2013-]\s*$/.test(clean)) return true;

  const lastWord = clean.match(/([A-Za-z][A-Za-z'\u2019-]*)\s*$/u)?.[1]?.toLowerCase() ?? '';
  if (!lastWord) return false;
  return /^(hav|basem|becaus|althou|withou|throug|everythin|someth|anythin|beginn|lookin|talkin|playin|workin)$/i.test(lastWord);
}

function hasPlaceholderCoordinates(opportunity: RevisionOpportunity): boolean {
  const coordinates = (opportunity.manuscript_coordinates ?? '').trim();
  if (!coordinates) return true;
  if (/^[A-Z_]+:recommendation$/i.test(coordinates)) return true;
  if (/\b(?:recommendation|criteria\.recommendations|evaluation_result)\b/i.test(coordinates) && !/\b(?:chunk|chapter|scene|paragraph|line|passage|act|page)\b/i.test(coordinates)) {
    return true;
  }
  if (!opportunity.revision_operation || opportunity.revision_operation === 'needs_targeting') return true;
  return false;
}

/** Known template meta-phrases that indicate a density-repair-generated action leaked into rationale. */
const TEMPLATE_CONTAMINATION_PATTERNS = [
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
];

function hasContaminatedRationale(opportunity: RevisionOpportunity): boolean {
  const rationale = `${opportunity.rationale} ${opportunity.fix_direction ?? ''} ${opportunity.symptom ?? ''}`.trim();
  if (!rationale) return true;
  const normalizedRationale = normalizedForComparison(rationale);
  const normalizedAnchor = normalizedForComparison(opportunity.evidence_anchor);
  if (!normalizedAnchor) return true;

  // Detect template-generated action text that leaked into rationale.
  if (TEMPLATE_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(rationale))) return true;

  const rationaleTokens = normalizedRationale.split(' ').filter(Boolean);
  const anchorTokens = normalizedAnchor.split(' ').filter(Boolean);
  const shortTail = /(\s|^)[a-z]{1,3}\s*$/i.test(rationale) || /[\u2026…]\s*$/.test(rationale);

  // Rationale that embeds most of the anchor tends to yield echo prose in hydration.
  const overlap = jaccardSimilarity(new Set(rationaleTokens), new Set(anchorTokens));
  if (overlap >= 0.72) return true;

  // Semicolon joins often indicate recommendation + leaked excerpt concatenation.
  if (rationale.includes(';') && overlap >= 0.5) return true;

  return shortTail;
}

function blockedAdminActions(reasons: string[]): string[] {
  const actions = new Set<string>(BLOCKED_CARD_ADMIN_ACTIONS);
  if (reasons.some((reason) => reason.startsWith('hydration_') || reason === 'rationale_contaminated')) {
    actions.add(HYDRATION_INPUT_INCOMPLETE_ADMIN_ACTION);
  }
  if (reasons.includes('candidate_quality_failed')) {
    actions.add(REGENERATE_CANDIDATE_PROSE_ADMIN_ACTION);
  }
  return [...actions];
}

function hasDirectSpeech(raw: string): boolean {
  return /["\u201c][^"\u201d]{2,}["\u201d]/u.test(raw);
}

function hasDialogueIntent(opportunity: RevisionOpportunity): boolean {
  return /\b(dialogue|conversation|exchange|direct interaction|spoken|talked|spoke|said|asked)\b/i.test(
    `${opportunity.criterion} ${opportunity.rationale} ${opportunity.fix_direction ?? ''} ${opportunity.symptom ?? ''}`,
  );
}

function hasConcreteAction(opportunity: RevisionOpportunity): boolean {
  if (opportunity.revision_operation && opportunity.revision_operation !== 'needs_targeting') return true;
  return /\b(replace|compress|insert|dramatize|bridge|clarify|cut|trim|tighten|expand|convert|surface|foreground|frame|reorder|move|add|delete|remove|rewrite|strengthen|sharpen|condense)\b/i.test(
    `${opportunity.rationale} ${opportunity.fix_direction ?? ''} ${opportunity.symptom ?? ''}`,
  );
}

/** Minimum chars for an evidence anchor to count as a real, targetable manuscript quote. */
const MIN_VALID_ANCHOR_CHARS = 12;

/**
 * Is the evidence anchor a real, substantive manuscript quote (not empty/placeholder)?
 * A valid anchor is the primary evidence that a recommendation is genuinely grounded.
 */
function hasValidManuscriptAnchor(opportunity: RevisionOpportunity): boolean {
  const clean = stripEvidenceWrapper(opportunity.evidence_anchor ?? '');
  if (clean.length < MIN_VALID_ANCHOR_CHARS) return false;
  // Must contain real word content, not just punctuation/whitespace/coordinates.
  return /[A-Za-z]{3,}/.test(clean);
}

/**
 * Does the rationale carry a coherent fix direction OR reader effect?
 * Substantive editorial reasoning about the fix/impact is evidence of a real anchor
 * relationship even when the commentary shares no vocabulary with the quoted prose.
 */
function hasCoherentFixOrReaderEffect(opportunity: RevisionOpportunity): boolean {
  const MIN_LEN = 20;
  const fix = (opportunity.fix_direction ?? '').trim();
  const effect = (opportunity.reader_effect ?? '').trim();
  return fix.length >= MIN_LEN || effect.length >= MIN_LEN;
}

/**
 * Build the structured anchor-coherence diagnostic for one opportunity. This records
 * every input the decision considered (lexical overlap, criterion, concrete action,
 * valid anchor, structural target, coherent fix/effect) plus the final decision, so a
 * blocked opportunity carries a self-describing "why" instead of a bare reason code.
 */
export function buildAnchorCoherenceDiagnostic(opportunity: RevisionOpportunity): AnchorCoherenceDiagnostic {
  const anchorTokens = normalizedTokenSet(opportunity.evidence_anchor);
  const rationaleTokens = normalizedTokenSet(
    `${opportunity.rationale} ${opportunity.fix_direction ?? ''} ${opportunity.symptom ?? ''}`,
  );
  const lexicalOverlap =
    anchorTokens.size === 0 || rationaleTokens.size === 0
      ? 0
      : Number(jaccardSimilarity(anchorTokens, rationaleTokens).toFixed(4));
  const validAnchor = hasValidManuscriptAnchor(opportunity);
  const concreteAction = hasConcreteAction(opportunity);
  const structuralTarget = recommendationCanTargetStructuralIssue(opportunity);
  const coherentFixOrEffect = hasCoherentFixOrReaderEffect(opportunity);
  const hasCriterion = typeof opportunity.criterion === 'string' && opportunity.criterion.trim().length > 0;

  // Evidence-based coherence: a recommendation is genuinely anchored when there is
  // enough independent evidence tying it to the passage — a real anchor plus a
  // concrete editorial action, a recognized criterion, and coherent fix/reader-effect
  // (or a structural target). Lexical overlap between verbatim prose and abstract
  // editorial commentary is NOT required and is not evidence of incoherence: valid
  // Marketability/Concept/Theme/Voice/Dialogue notes naturally share no tokens with
  // the quoted text. The gate still fires when the anchoring evidence is genuinely absent.
  const anchoredByEvidence =
    validAnchor && concreteAction && hasCriterion && (coherentFixOrEffect || structuralTarget);
  // A meaningful lexical overlap independently confirms coherence.
  const anchoredByOverlap = lexicalOverlap >= 0.05;
  const coherent = anchoredByEvidence || anchoredByOverlap;

  const reason = coherent
    ? anchoredByOverlap && !anchoredByEvidence
      ? 'Admitted by lexical overlap between anchor and rationale.'
      : 'Admitted: valid anchor + concrete action + recognized criterion + coherent fix/reader-effect (token overlap not required).'
    : `Rejected: insufficient anchoring evidence (valid_anchor=${validAnchor}, concrete_action=${concreteAction}, criterion=${hasCriterion}, coherent_fix_or_effect=${coherentFixOrEffect}, structural_target=${structuralTarget}, lexical_overlap=${lexicalOverlap}).`;

  return {
    check: 'anchor_coherence',
    lexical_overlap: lexicalOverlap,
    criterion: hasCriterion ? opportunity.criterion : '',
    concrete_action: concreteAction,
    valid_anchor: validAnchor,
    structural_target: structuralTarget,
    coherent_fix_or_effect: coherentFixOrEffect,
    decision: coherent ? 'admitted' : 'rejected_incoherent',
    reason,
  };
}

/**
 * Evidence-based anchor coherence. Replaces the prior lexical-overlap heuristic, which
 * equated "rationale reuses anchor words" with "editorial coherence" and wrongly blocked
 * valid abstract recommendations. The safety gate is preserved for genuinely incoherent
 * anchor/rationale pairs — see buildAnchorCoherenceDiagnostic for the full decision inputs.
 */
export function anchorRationaleIsCoherent(opportunity: RevisionOpportunity): boolean {
  return buildAnchorCoherenceDiagnostic(opportunity).decision === 'admitted';
}

function recommendationCanTargetStructuralIssue(opportunity: RevisionOpportunity): boolean {
  return /\b(insert|bridge|transition|stakes|pacing|compress|tighten|cut|trim|scene|dialogue|exposition|restructure|coherence|clarity|orientation|causal|momentum|consequence|reader signal|reader orientation)\b/i.test(
    `${opportunity.rationale} ${opportunity.fix_direction ?? ''} ${opportunity.symptom ?? ''} ${opportunity.revision_operation ?? ''}`,
  );
}

function candidateSetHasLowDiversity(opportunity: RevisionOpportunity): boolean {
  const candidates = [opportunity.candidate_text_a, opportunity.candidate_text_b, opportunity.candidate_text_c]
    .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
  if (candidates.length < 3) return false;

  const sets = candidates.map(normalizedTokenSet);
  return (
    jaccardSimilarity(sets[0], sets[1]) >= 0.9 ||
    jaccardSimilarity(sets[0], sets[2]) >= 0.9 ||
    jaccardSimilarity(sets[1], sets[2]) >= 0.9
  );
}

function tokenArray(raw: string): string[] {
  return normalizedForComparison(raw).split(' ').filter(Boolean);
}

function candidateLooksGenericAdvice(text: string): boolean {
  return /\b(should|needs to|must|try to|consider|revise|rewrite|replace|insert|add|improve|clarify|strengthen|tighten)\b/i.test(text)
    || /\b(this (passage|scene|paragraph|section)|the reader|narrative|manuscript|revision)\b/i.test(text);
}

function candidateLooksSummaryNotProse(text: string): boolean {
  return /\b(this (shows|demonstrates|indicates|suggests)|the scene (shows|demonstrates|indicates)|the passage (shows|demonstrates|indicates))\b/i.test(text)
    || /\b(summary|in summary|overall|ultimately)\b/i.test(text);
}

function candidateLooksStilted(text: string): boolean {
  if (/\b(very\s+very|really\s+really|just\s+just)\b/i.test(text)) return true;
  if (/[,;:]{2,}|\.{3,}/.test(text)) return true;
  return false;
}

function candidateLooksRepetitive(text: string): boolean {
  const tokens = tokenArray(text).filter((token) => token.length >= 3);
  if (tokens.length < 10) return false;
  const unique = new Set(tokens);
  return unique.size / tokens.length < 0.45;
}

function candidateIntroducesUnsupportedFacts(candidate: string, anchor: string): boolean {
  const anchorTokens = normalizedTokenSet(anchor);
  const candidateTokens = normalizedTokenSet(candidate);
  const candidateNumbers = candidate.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) ?? [];
  const anchorNumbers = new Set(anchor.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) ?? []);
  if (candidateNumbers.some((num) => !anchorNumbers.has(num))) return true;

  const candidateNames = new Set((candidate.match(/\b[A-Z][a-zA-Z'\u2019-]{2,}\b/g) ?? []).map((name) => name.toLowerCase()));
  const anchorNames = new Set((anchor.match(/\b[A-Z][a-zA-Z'\u2019-]{2,}\b/g) ?? []).map((name) => name.toLowerCase()));
  let unseenNames = 0;
  for (const name of candidateNames) {
    if (!anchorNames.has(name) && !anchorTokens.has(name) && !candidateTokens.has('i')) {
      unseenNames += 1;
    }
  }
  return unseenNames >= 2;
}

function candidateVoiceMismatch(text: string): boolean {
  return /\b(reader|narrative|theme|arc|stakes|craft|manuscript|criterion|diagnostic)\b/i.test(text);
}

function candidateFitsContext(candidate: string, anchor: string, rationale: string): boolean {
  const candidateTokens = normalizedTokenSet(candidate);
  const anchorTokens = normalizedTokenSet(anchor);
  const rationaleTokens = normalizedTokenSet(rationale);
  if (candidateTokens.size === 0) return false;
  const overlapAnchor = jaccardSimilarity(candidateTokens, anchorTokens);
  const overlapRationale = jaccardSimilarity(candidateTokens, rationaleTokens);
  return overlapAnchor >= 0.05 || overlapRationale >= 0.05;
}

function candidateQualityFailureCodes(opportunity: RevisionOpportunity, candidate: string): string[] {
  const reasons: string[] = [];
  if (!candidateTextIsCopyPasteReady(candidate)) reasons.push('candidate_quality_not_copy_ready');

  const words = tokenArray(candidate);
  if (words.length < 8) reasons.push('candidate_quality_too_short');

  if (candidateLooksGenericAdvice(candidate)) reasons.push('candidate_quality_generic');
  if (candidateLooksSummaryNotProse(candidate)) reasons.push('candidate_quality_summary');
  if (candidateLooksStilted(candidate)) reasons.push('candidate_quality_stilted');
  if (candidateLooksRepetitive(candidate)) reasons.push('candidate_quality_repetitive');

  const overlap = overlapScoreWithAnchor(candidate, opportunity.evidence_anchor);
  if (overlap >= 0.82) reasons.push('candidate_quality_anchor_overlap');
  if (overlap >= 0.92) reasons.push('candidate_quality_weak_improvement');

  if (candidateIntroducesUnsupportedFacts(candidate, opportunity.evidence_anchor)) {
    reasons.push('candidate_quality_unsupported_facts');
  }

  if (candidateVoiceMismatch(candidate)) reasons.push('candidate_quality_voice_mismatch');
  if (!candidateFitsContext(candidate, opportunity.evidence_anchor, opportunity.rationale)) {
    reasons.push('candidate_quality_context_mismatch');
  }

  return [...new Set(reasons)];
}

function candidateQualityReasons(opportunity: RevisionOpportunity): string[] {
  const candidates = [
    opportunity.candidate_text_a,
    opportunity.candidate_text_b,
    opportunity.candidate_text_c,
  ];

  if (candidates.some((candidate) => typeof candidate !== 'string' || candidate.trim().length === 0)) {
    return [];
  }

  const result = evaluateCardQuality(
    candidates[0] ?? '',
    candidates[1] ?? '',
    candidates[2] ?? '',
    opportunity.evidence_anchor,
    opportunity.rationale,
  );
  if (result.pass) return [];

  return ['candidate_quality_failed', ...('reasons' in result ? result.reasons : [])];
}

function candidateComplianceReasons(opportunity: RevisionOpportunity, evaluationMode?: string): string[] {
  const candidates = [opportunity.candidate_text_a, opportunity.candidate_text_b, opportunity.candidate_text_c];
  if (candidates.some((candidate) => typeof candidate !== 'string' || candidate.trim().length === 0)) return [];

  const reasons: string[] = [];
  if (candidates.some((candidate) => !candidateTextIsCopyPasteReady(candidate))) {
    reasons.push('candidate_noncompliant');
  }
  if (candidateSetHasLowDiversity(opportunity)) {
    reasons.push('candidate_low_diversity');
  }
  const qualityReasons = candidateQualityReasons(opportunity);
  if (qualityReasons.length > 0) {
    reasons.push(...qualityReasons);
  }
  if (
    evaluationMode === 'TESTIMONY' &&
    hasDialogueIntent(opportunity) &&
    !hasDirectSpeech(opportunity.evidence_anchor) &&
    candidates.some((candidate) => typeof candidate === 'string' && hasDirectSpeech(candidate))
  ) {
    reasons.push('testimony_fabrication_risk');
  }
  return [...new Set(reasons)];
}

function blockOpportunityByPreflight(opportunity: RevisionOpportunity, reasons: string[]): RevisionOpportunity {
  const combinedReasons = [...new Set([...(opportunity.preflight_reasons ?? []), ...reasons])];
  return {
    ...opportunity,
    grounding_status: 'unsupported_blocked',
    grounding_note: `Blocked by ${REVISE_QUEUE_PREFLIGHT_GATE_VERSION}: ${combinedReasons.join(', ')}`,
    preflight_status: 'blocked',
    preflight_reasons: combinedReasons,
    preflight_note: 'Recommendation requires rewrite or admin review before it can become a user-facing Revise Queue card.',
    admin_actions: blockedAdminActions(combinedReasons),
  };
}

/**
 * Six-part diagnostic completeness check per canon:
 * docs/canon/revise-queue-six-part-diagnostic.md
 *
 * Required layers: symptom, cause, fix_direction, reader_effect, evidence_anchor, revision_operation
 * Optional (recommended): mistake_proofing
 *
 * A recommendation without all six diagnostic layers cannot enter the Revise queue
 * because the author cannot trust a recommendation that doesn't explain WHY.
 */
function diagnosticCompletenessReasons(opportunity: RevisionOpportunity): string[] {
  const reasons: string[] = [];
  const MIN_DIAGNOSTIC_LENGTH = 10; // minimum chars to count as populated

  // Layer 1: Symptom — the visible problem on the page
  if (!opportunity.symptom || opportunity.symptom.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    reasons.push('diagnostic_missing_symptom');
  }

  // Layer 2: Cause — craft mechanism creating the problem
  if (!opportunity.cause || opportunity.cause.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    reasons.push('diagnostic_missing_cause');
  }

  // Layer 3: Fix Strategy — repair approach
  if (!opportunity.fix_direction || opportunity.fix_direction.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    reasons.push('diagnostic_missing_fix_direction');
  }

  // Layer 4: Reader Impact — what the reader gains or loses
  if (!opportunity.reader_effect || opportunity.reader_effect.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    reasons.push('diagnostic_missing_reader_effect');
  }

  // Layer 5: Evidence — manuscript text (already required by evidence_anchor field)
  if (!opportunity.evidence_anchor || opportunity.evidence_anchor.trim().length < MIN_DIAGNOSTIC_LENGTH) {
    reasons.push('diagnostic_missing_evidence');
  }

  // Layer 6: Operation / Targeting — what action applied where
  if (!opportunity.revision_operation) {
    reasons.push('diagnostic_missing_operation');
  }

  return reasons;
}

function preflightReasonsForOpportunity(
  opportunity: RevisionOpportunity,
  contextQuality: ReviseContextQuality,
  evaluationMode?: string,
): string[] {
  const reasons: string[] = [];
  const preservedReasons = (opportunity.preflight_reasons ?? []).filter(
    (reason) => reason === 'hydration_candidate_rejected_overlap' || reason === 'candidate_quality_failed_after_regen',
  );
  reasons.push(...preservedReasons);
  if (contextQuality === 'blocked') reasons.push('canon_authority_blocked');
  if (anchorLooksTruncated(opportunity.evidence_anchor)) reasons.push('truncated_anchor');
  if (!hasConcreteAction(opportunity)) reasons.push('recommendation_requires_rewrite');
  // Evidence-based anchor coherence. The diagnostic captures every decision input and
  // is attached to the opportunity so the block/admit reason is self-describing.
  const coherenceDiagnostic = buildAnchorCoherenceDiagnostic(opportunity);
  opportunity.preflight_diagnostic = coherenceDiagnostic;
  if (coherenceDiagnostic.decision === 'rejected_incoherent') reasons.push('anchor_mismatch');
  if (opportunity.hydration_eligible === false) {
    reasons.push(...(opportunity.hydration_ineligibility_reasons ?? []));
  }
  if (evaluationMode === 'TESTIMONY' && hasDialogueIntent(opportunity) && !hasDirectSpeech(opportunity.evidence_anchor)) {
    reasons.push('testimony_fabrication_risk');
  }

  // Rationale quality gate — the WHY must be real editorial reasoning, not template text
  if (hasContaminatedRationale(opportunity)) {
    reasons.push('rationale_contaminated');
  }

  return [...new Set(reasons)];
}

function applyReviseQueuePreflight(
  opportunities: RevisionOpportunity[],
  options?: { contextQuality?: ReviseContextQuality; evaluationMode?: string },
): RevisionOpportunity[] {
  const contextQuality = options?.contextQuality ?? 'clean';
  return opportunities.map((opportunity) => {
    const reasons = preflightReasonsForOpportunity(opportunity, contextQuality, options?.evaluationMode);
    if (reasons.length > 0) {
      return {
        ...blockOpportunityByPreflight(opportunity, reasons),
        context_quality: contextQuality,
      };
    }

    const candidateReasons = candidateComplianceReasons(opportunity, options?.evaluationMode);
    if (candidateReasons.length > 0) {
      return {
        ...blockOpportunityByPreflight(opportunity, candidateReasons),
        context_quality: contextQuality,
      };
    }

    return {
      ...opportunity,
      context_quality: contextQuality,
      confidence: contextQuality === 'limited'
        ? capLedgerConfidence(opportunity.confidence, 'medium')
        : opportunity.confidence,
      preflight_status: contextQuality === 'limited' ? 'limited_context' : 'passed',
      preflight_reasons: contextQuality === 'limited' ? ['limited_context_due_to_degraded_canon'] : [],
      preflight_note: contextQuality === 'limited'
        ? 'Generated under limited context because ledger_quality_report_v1 did not certify clean story canon.'
        : undefined,
      admin_actions: undefined,
    };
  });
}

function summarizePreflight(opportunities: RevisionOpportunity[]): Record<string, unknown> {
  const summary = {
    total: opportunities.length,
    passed: 0,
    limited_context: 0,
    blocked: 0,
    reasons: {} as Record<string, number>,
  };
  for (const opportunity of opportunities) {
    if (opportunity.preflight_status === 'blocked') summary.blocked++;
    else if (opportunity.preflight_status === 'limited_context') summary.limited_context++;
    else summary.passed++;

    for (const reason of opportunity.preflight_reasons ?? []) {
      summary.reasons[reason] = (summary.reasons[reason] ?? 0) + 1;
    }
  }
  return summary;
}

function wordCount(raw: string | undefined): number {
  if (!raw || !raw.trim()) return 0;
  return raw.trim().split(/\s+/).filter(Boolean).length;
}

function overlapScoreWithAnchor(candidate: string | undefined, anchor: string): number {
  if (!candidate || !candidate.trim() || !anchor.trim()) return 0;
  const candidateTokens = normalizedTokenSet(candidate);
  const anchorTokens = normalizedTokenSet(anchor);
  if (candidateTokens.size === 0 || anchorTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of candidateTokens) {
    if (anchorTokens.has(token)) overlap++;
  }
  return overlap / Math.max(Math.min(candidateTokens.size, anchorTokens.size), 1);
}

function deriveTelemetryRejectionReasons(opportunity: RevisionOpportunity): string[] {
  const base = [...new Set(opportunity.preflight_reasons ?? [])];
  const hydrationInputReasons = [
    'hydration_context_not_found',
    'hydration_anchor_truncated',
    'hydration_placeholder_coordinates',
    'hydration_input_contaminated',
  ];
  if (base.some((reason) => hydrationInputReasons.includes(reason))) {
    base.push('hydration_input_incomplete');
  }
  if (base.length === 0 && opportunity.preflight_status === 'blocked') {
    base.push('blocked_preflight');
  }
  if (base.length === 0 && opportunity.grounding_status !== 'supported') {
    base.push('grounding_unsupported');
  }
  return [...new Set(base)];
}

function selectPrimaryRejectionReason(reasons: string[]): string {
  const priority = [
    'canon_authority_blocked',
    'candidate_quality_failed',
    'anchor_mismatch',
    'truncated_anchor',
    'testimony_fabrication_risk',
    'hydration_input_incomplete',
    'hydration_context_not_found',
    'hydration_placeholder_coordinates',
    'hydration_input_contaminated',
    'hydration_candidate_rejected_overlap',
  ];
  for (const key of priority) {
    if (reasons.includes(key)) return key;
  }
  return reasons[0] ?? 'blocked_preflight';
}

function hydrationResultForTelemetry(input: {
  opportunity: RevisionOpportunity;
  reasons: string[];
  hydrationAttempted: boolean;
}): string {
  if (input.opportunity.grounding_status === 'supported') return 'supported';
  if (input.reasons.includes('hydration_candidate_rejected_overlap')) return 'rejected_overlap';
  if (input.reasons.includes('hydration_input_incomplete')) return 'input_incomplete';
  if (input.hydrationAttempted) return 'attempted_rejected_or_unresolved';
  if (input.opportunity.preflight_status === 'blocked') return 'blocked_preflight';
  return 'not_attempted';
}

function buildRevisionCandidateRejectionTelemetry(input: {
  opportunity: RevisionOpportunity;
  jobId: string;
  hydrationAttempted: boolean;
  contextFound: boolean;
  candidateGenerationStatus: string;
}): CandidateRejectionTelemetry {
  const { opportunity } = input;
  const reasons = deriveTelemetryRejectionReasons(opportunity);
  return {
    opportunity_id: opportunity.opportunity_id,
    rejection_reasons: reasons,
    rejection_reason_primary: selectPrimaryRejectionReason(reasons),
    criterion: opportunity.criterion,
    severity: opportunity.severity,
    revision_operation: opportunity.revision_operation ?? null,
    job_id: input.jobId,
    anchor_found: opportunity.evidence_anchor.trim().length > 0,
    anchor_length_words: wordCount(opportunity.evidence_anchor),
    candidate_word_counts: {
      a: wordCount(opportunity.candidate_text_a),
      b: wordCount(opportunity.candidate_text_b),
      c: wordCount(opportunity.candidate_text_c),
    },
    candidate_anchor_overlap_scores: {
      a: overlapScoreWithAnchor(opportunity.candidate_text_a, opportunity.evidence_anchor),
      b: overlapScoreWithAnchor(opportunity.candidate_text_b, opportunity.evidence_anchor),
      c: overlapScoreWithAnchor(opportunity.candidate_text_c, opportunity.evidence_anchor),
    },
    context_found: input.contextFound,
    coordinates_placeholder: hasPlaceholderCoordinates(opportunity),
    rationale_contaminated: hasContaminatedRationale(opportunity),
    hydration_attempted: input.hydrationAttempted,
    hydration_result: hydrationResultForTelemetry({
      opportunity,
      reasons,
      hydrationAttempted: input.hydrationAttempted,
    }),
    prompt_version: HYDRATION_PROMPT_VERSION,
    model: input.hydrationAttempted ? HYDRATION_MODEL : null,
    candidate_generation_status: input.candidateGenerationStatus,
  };
}

function explicitCandidateOrFallback(
  raw: unknown,
  _fallback: string,
  issueStatement: string,
  anchorSnippet?: string,
): string {
  const candidate = normalizeOptionalText(raw);
  if (candidate) {
    const words = candidate.split(/\s+/);
    if (words.length >= 5 && candidate.toLowerCase() !== issueStatement.trim().toLowerCase()) {
      // Reject candidates that merely echo the anchor/original passage
      if (anchorSnippet && candidateEchoesAnchor(candidate, anchorSnippet)) {
        return '';
      }
      return candidate;
    }
  }
  // SLAE enforcement: fail closed when explicit prose is missing/malformed.
  // Backend-generated fallback prose is not allowed to become executable A/B/C text.
  return '';
}

function normalizeRevisionOperation(raw: unknown): RevisionOperation | undefined {
  if (typeof raw !== 'string') return undefined;
  const clean = raw.trim();
  return (REVISION_OPERATIONS as readonly string[]).includes(clean)
    ? (clean as RevisionOperation)
    : undefined;
}

function buildOpportunityId(parts: { criterion: string; rationale: string; anchor: string; location: string }): string {
  const digest = createHash('sha256')
    .update(`${parts.criterion}|${parts.rationale}|${parts.anchor}|${parts.location}`)
    .digest('hex')
    .slice(0, 18);
  return `rol:${digest}`;
}

function normalizeConfidenceFromUnknown(raw: unknown): LedgerConfidence {
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized.includes('high')) return 'high';
    if (normalized.includes('low')) return 'low';
    if (normalized.includes('medium')) return 'medium';
  }
  return normalizeConfidence(raw);
}

function isCanonicalRevisionOpportunity(value: unknown): value is RevisionOpportunity {
  if (!isRecord(value)) return false;
  const revisionOperation = value.revision_operation;
  const candidateTextA = value.candidate_text_a;
  const candidateTextB = value.candidate_text_b;
  const candidateTextC = value.candidate_text_c;
  return (
    typeof value.opportunity_id === 'string' && value.opportunity_id.trim().length > 0 &&
    typeof value.criterion === 'string' && value.criterion.trim().length > 0 &&
    typeof value.severity === 'string' && ['must', 'should', 'could'].includes(value.severity) &&
    typeof value.rationale === 'string' && value.rationale.trim().length > 0 &&
    typeof value.evidence_anchor === 'string' && value.evidence_anchor.trim().length > 0 &&
    typeof value.manuscript_coordinates === 'string' && value.manuscript_coordinates.trim().length > 0 &&
    typeof value.provenance === 'string' && value.provenance.trim().length > 0 &&
    typeof value.confidence === 'string' && ['low', 'medium', 'high'].includes(value.confidence) &&
    value.decision_state === 'open' &&
    (revisionOperation === undefined || normalizeRevisionOperation(revisionOperation) !== undefined) &&
    (candidateTextA === undefined || typeof candidateTextA === 'string') &&
    (candidateTextB === undefined || typeof candidateTextB === 'string') &&
    (candidateTextC === undefined || typeof candidateTextC === 'string')
  );
}

function ensureOpportunityCandidates(opportunity: RevisionOpportunity): RevisionOpportunity {
  const findingId = firstNonEmptyString(
    opportunity.finding_id,
    `${opportunity.provenance}:${opportunity.criterion}:${opportunity.manuscript_coordinates}`,
  );
  const operation = opportunity.revision_operation ?? inferLedgerRevisionOperation({
    criterion: opportunity.criterion,
    anchor: opportunity.evidence_anchor,
    rationale: opportunity.rationale,
    fixDirection: opportunity.fix_direction,
    symptom: opportunity.symptom,
  });

  const fallbackCandidates = buildFallbackCandidateTexts({
    criterion: opportunity.criterion,
    anchor: opportunity.evidence_anchor,
    rationale: opportunity.rationale,
    action: opportunity.rationale,
    fixDirection: opportunity.fix_direction,
    symptom: opportunity.symptom,
    revisionOperation: operation,
  });

  const anchor = opportunity.evidence_anchor;
  const candidateA = explicitCandidateOrFallback(opportunity.candidate_text_a, fallbackCandidates.a, opportunity.rationale, anchor);
  const candidateB = explicitCandidateOrFallback(opportunity.candidate_text_b, fallbackCandidates.b, opportunity.rationale, anchor);
  const candidateC = explicitCandidateOrFallback(opportunity.candidate_text_c, fallbackCandidates.c, opportunity.rationale, anchor);
  const blocked = !candidateA || !candidateB || !candidateC;

  return {
    ...opportunity,
    finding_id: findingId,
    revision_operation: operation,
    candidate_text_a: candidateA,
    candidate_text_b: candidateB,
    candidate_text_c: candidateC,
    grounding_status: blocked ? 'unsupported_blocked' : (opportunity.grounding_status ?? 'supported'),
    grounding_note: blocked
      ? 'Explicit candidate prose missing or malformed; backend fallback prose blocked by SLAE.'
      : (opportunity.grounding_note ?? null),
  };
}

function buildRevisionLedgerQualityManifest(input: {
  opportunities: RevisionOpportunity[];
  wordCount: number | null | undefined;
  contextQualityDecision: ReviseContextQualityDecision;
  candidateGenerationStatus: string;
}): Record<string, unknown> {
  const registry = getArtifact('revision_opportunity_ledger_v1');
  const total = input.opportunities.length;
  const ready = input.opportunities.filter((o) => o.preflight_status === 'passed' && o.grounding_status === 'supported').length;
  const needsTargeting = input.opportunities.filter((o) => o.preflight_status === 'blocked' || o.grounding_status !== 'supported').length;
  const limitedContext = input.opportunities.filter((o) => o.preflight_status === 'limited_context').length;
  const withEvidence = input.opportunities.filter((o) => Boolean(o.evidence_anchor?.trim())).length;
  const withFinding = input.opportunities.filter((o) => Boolean(o.finding_id?.trim())).length;
  const withLocation = input.opportunities.filter((o) => Boolean(o.manuscript_coordinates?.trim())).length;
  const withOperation = input.opportunities.filter((o) => Boolean(o.revision_operation?.trim())).length;
  const withCandidateSet = input.opportunities.filter((o) =>
    Boolean(o.candidate_text_a?.trim()) && Boolean(o.candidate_text_b?.trim()) && Boolean(o.candidate_text_c?.trim()),
  ).length;
  const missingFieldsByOpportunity = input.opportunities
    .map((o) => {
      const missing: string[] = [];
      if (!o.opportunity_id?.trim()) missing.push('opportunity_id');
      if (!o.finding_id?.trim()) missing.push('finding_id');
      if (!o.criterion?.trim()) missing.push('criterion');
      if (!o.severity?.trim()) missing.push('severity');
      if (!o.evidence_anchor?.trim()) missing.push('evidence_anchor');
      if (!o.manuscript_coordinates?.trim()) missing.push('manuscript_coordinates');
      if (!o.revision_operation?.trim()) missing.push('revision_operation');
      if (!o.preflight_status?.trim()) missing.push('preflight_status');
      return { opportunity_id: o.opportunity_id, missing };
    })
    .filter((row) => row.missing.length > 0);

  const dcipBlock = buildCompactCognitiveInitializationBlock();
  const constitutionalAuthorityStatus = getConstitutionalAuthorityStatus();
  return {
    artifact_type: 'revision_opportunity_ledger_v1',
    producer_stage_id: registry?.producerStageId ?? 'ADJACENT_REVISION_LEDGER',
    completeness_metric: registry?.completenessMetric ?? null,
    accuracy_metric: registry?.accuracyMetric ?? null,
    dirty_data_rule: registry?.dirtyDataRule ?? null,
    regeneration_owner_stage_id: registry?.regenerationOwnerStageId ?? 'ADJACENT_REVISION_LEDGER',
    contract_status: missingFieldsByOpportunity.length > 0 || total === 0 || needsTargeting > 0 || input.contextQualityDecision.status === 'blocked'
      ? 'degraded'
      : 'clean',
    opportunity_limits: {
      cap: getReviseQueueMaxOpportunities(input.wordCount),
      word_count: input.wordCount ?? null,
      long_form_threshold: REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD,
    },
    metrics: {
      total_opportunities: total,
      ready_for_revise: ready,
      needs_targeting: needsTargeting,
      limited_context: limitedContext,
      ready_rate: total === 0 ? 0 : ready / total,
      finding_id_coverage: total === 0 ? 0 : withFinding / total,
      evidence_anchor_coverage: total === 0 ? 0 : withEvidence / total,
      manuscript_location_coverage: total === 0 ? 0 : withLocation / total,
      revision_operation_coverage: total === 0 ? 0 : withOperation / total,
      candidate_option_coverage: total === 0 ? 0 : withCandidateSet / total,
    },
    dcip_compliance: {
      status: dcipBlock ? 'pass' : 'fail',
      canonical_path: 'docs/governance/DREAM-COGNITIVE-INITIALIZATION-PROTOCOL-V1.md',
      block_hash: dcipBlock ? canonicalJsonSha256(dcipBlock) : null,
      reasons: dcipBlock ? [] : ['dcip_block_unavailable'],
    },
    constitutional_authority_registry: {
      path: constitutionalAuthorityStatus.registryPath,
      status: constitutionalAuthorityStatus.status,
      loaded_required_authorities: constitutionalAuthorityStatus.loadedRequiredAuthorities,
      missing_required_authorities: constitutionalAuthorityStatus.missingRequiredAuthorities,
    },
    context_quality: input.contextQualityDecision.status,
    gate_ready_status: input.contextQualityDecision.gate_ready_status,
    candidate_generation_status: input.candidateGenerationStatus,
    missing_fields_by_opportunity: missingFieldsByOpportunity,
  };
}

function normalizeLegacyWorkbenchOpportunity(value: unknown): RevisionOpportunity | null {
  if (!isRecord(value)) return null;
  const workbench = value as WorkbenchLikeOpportunity;

  const criterion = normalizeCriterion(workbench.criterion);
  const rationale = firstNonEmptyString(workbench.fixDirection, workbench.symptom, workbench.title);
  const quoteHighlight = firstNonEmptyString(workbench.quoteHighlight);
  const quoteRest = firstNonEmptyString(workbench.quoteRest);
  const evidenceAnchor = firstNonEmptyString(
    `${quoteHighlight}${quoteRest}`.trim(),
    quoteHighlight,
    workbench.symptom,
    workbench.title,
  );
  const manuscriptCoordinates = firstNonEmptyString(workbench.anchor, workbench.meta, `${criterion}:recommendation`);
  const provenance = firstNonEmptyString(workbench.source, 'workbench_queue_synthesis');

  if (!rationale || !evidenceAnchor || !manuscriptCoordinates) {
    return null;
  }

  const opportunityId = firstNonEmptyString(
    workbench.id,
    buildOpportunityId({ criterion, rationale, anchor: evidenceAnchor, location: manuscriptCoordinates }),
  );

  return ensureOpportunityCandidates({
    opportunity_id: opportunityId,
    criterion,
    severity: normalizeSeverity(workbench.severity),
    rationale,
    evidence_anchor: evidenceAnchor,
    manuscript_coordinates: manuscriptCoordinates,
    provenance,
    confidence: normalizeConfidenceFromUnknown(workbench.confidence),
    decision_state: 'open',
  });
}

function normalizeExistingLedgerOpportunities(raw: unknown): RevisionOpportunity[] | null {
  if (!Array.isArray(raw)) return null;

  const canonical: RevisionOpportunity[] = [];
  for (const row of raw) {
    if (isCanonicalRevisionOpportunity(row)) {
      canonical.push(ensureOpportunityCandidates(row));
      continue;
    }
    const normalized = normalizeLegacyWorkbenchOpportunity(row);
    if (!normalized) {
      return null;
    }
    canonical.push(normalized);
  }

  return canonical;
}

function recommendationCandidateInput(args: {
  criterion: string;
  evidenceAnchor: string;
  rationale: string;
  recommendationRow: Record<string, unknown>;
  revisionOperation?: RevisionOperation;
}): CandidateBuildInput {
  return {
    criterion: args.criterion,
    anchor: args.evidenceAnchor,
    rationale: args.rationale,
    action: normalizeOptionalText(args.recommendationRow.action),
    expectedImpact: normalizeOptionalText(args.recommendationRow.expected_impact),
    fixDirection:
      normalizeOptionalText(args.recommendationRow.fix_direction) ??
      normalizeOptionalText(args.recommendationRow.specific_fix),
    symptom:
      normalizeOptionalText(args.recommendationRow.symptom) ??
      normalizeOptionalText(args.recommendationRow.diagnosis),
    revisionOperation: args.revisionOperation,
  };
}

function extractCriteriaRecommendations(payload: Record<string, unknown>): RevisionOpportunity[] {
  const opportunities: RevisionOpportunity[] = [];
  const criteria = Array.isArray(payload.criteria) ? payload.criteria : [];

  for (const criterionRow of criteria) {
    if (!isRecord(criterionRow)) continue;

    const criterion = normalizeCriterion(criterionRow.criterion_id ?? criterionRow.key ?? criterionRow.criterion_key);
    const criterionScore = criterionRow.score_0_10;
    const criterionEvidenceRaw = Array.isArray(criterionRow.evidence) ? criterionRow.evidence[0] : null;
    const criterionEvidenceSnippet = isRecord(criterionEvidenceRaw)
      ? firstNonEmptyString(
          criterionEvidenceRaw.snippet,
          criterionEvidenceRaw.text,
        )
      : '';

    const recommendations = Array.isArray(criterionRow.recommendations)
      ? criterionRow.recommendations
      : [];

    for (const recommendationRow of recommendations) {
      if (!isRecord(recommendationRow)) continue;

      const evidenceAnchor = firstNonEmptyString(
        recommendationRow.evidence_anchor,
        recommendationRow.anchor_snippet,
        recommendationRow.evidence_snippet,
        recommendationRow.snippet,
        recommendationRow.quote,
        criterionEvidenceSnippet,
      );

      if (!evidenceAnchor) continue;

      const rationale = firstNonEmptyString(
        recommendationRow.rationale,
        recommendationRow.diagnosis,
        recommendationRow.why,
        recommendationRow.justification,
        recommendationRow.recommendation,
        recommendationRow.action,
        criterionRow.rationale,
      );

      if (!rationale) continue;

      const manuscriptCoordinates = firstNonEmptyString(
        recommendationRow.manuscript_coordinates,
        recommendationRow.location_ref,
        recommendationRow.locationRef,
        `${criterion}:recommendation`,
      );

      const revisionOperation =
        normalizeRevisionOperation(recommendationRow.revision_operation) ??
        inferLedgerRevisionOperation({
          criterion,
          anchor: evidenceAnchor,
          rationale,
          action: normalizeOptionalText(recommendationRow.action),
          fixDirection: normalizeOptionalText(recommendationRow.fix_direction) ?? normalizeOptionalText(recommendationRow.specific_fix),
        });

      const fallbackCandidates = buildFallbackCandidateTexts(recommendationCandidateInput({
        criterion,
        evidenceAnchor,
        rationale,
        recommendationRow,
        revisionOperation,
      }));

      opportunities.push(ensureOpportunityCandidates({
        opportunity_id: buildOpportunityId({
          criterion,
          rationale,
          anchor: evidenceAnchor,
          location: manuscriptCoordinates,
        }),
        criterion,
        severity: normalizeSeverity(recommendationRow.severity ?? recommendationRow.priority, criterionScore),
        rationale,
        evidence_anchor: evidenceAnchor,
        manuscript_coordinates: manuscriptCoordinates,
        provenance: 'evaluation_result.criteria.recommendations',
        confidence: normalizeConfidence(recommendationRow.confidence),
        decision_state: 'open',
        revision_operation: revisionOperation,
        candidate_text_a: explicitCandidateOrFallback(recommendationRow.candidate_text_a, fallbackCandidates.a, rationale, evidenceAnchor),
        candidate_text_b: explicitCandidateOrFallback(recommendationRow.candidate_text_b, fallbackCandidates.b, rationale, evidenceAnchor),
        candidate_text_c: explicitCandidateOrFallback(recommendationRow.candidate_text_c, fallbackCandidates.c, rationale, evidenceAnchor),
        symptom: normalizeOptionalText(recommendationRow.symptom),
        cause: normalizeOptionalText(recommendationRow.cause) ?? normalizeOptionalText(recommendationRow.mechanism),
        fix_direction: normalizeOptionalText(recommendationRow.fix_direction) ?? normalizeOptionalText(recommendationRow.specific_fix),
        reader_effect: normalizeOptionalText(recommendationRow.reader_effect),
        mistake_proofing: normalizeOptionalText(recommendationRow.mistake_proofing),
      }));
    }
  }

  return opportunities;
}

function extractTopLevelRecommendations(payload: Record<string, unknown>): RevisionOpportunity[] {
  const recRoot = payload.recommendations;
  const recommendations = Array.isArray(recRoot)
    ? recRoot
    : isRecord(recRoot)
      ? [
          ...(Array.isArray(recRoot.quick_wins) ? recRoot.quick_wins : []),
          ...(Array.isArray(recRoot.strategic_revisions) ? recRoot.strategic_revisions : []),
          ...(Array.isArray(recRoot.items) ? recRoot.items : []),
        ]
      : [];

  const opportunities: RevisionOpportunity[] = [];

  for (const recommendationRow of recommendations) {
    if (!isRecord(recommendationRow)) continue;

    const evidenceAnchor = firstNonEmptyString(
      recommendationRow.evidence_anchor,
      recommendationRow.anchor_snippet,
      recommendationRow.evidence_snippet,
      recommendationRow.snippet,
      recommendationRow.quote,
    );

    if (!evidenceAnchor) continue;

    const criterion = normalizeCriterion(recommendationRow.criterion ?? recommendationRow.rule);
    const rationale = firstNonEmptyString(
      recommendationRow.rationale,
      recommendationRow.diagnosis,
      recommendationRow.why,
      recommendationRow.justification,
      recommendationRow.recommendation,
      recommendationRow.action,
    );

    if (!rationale) continue;

    const manuscriptCoordinates = firstNonEmptyString(
      recommendationRow.manuscript_coordinates,
      recommendationRow.location_ref,
      recommendationRow.locationRef,
      `${criterion}:recommendation`,
    );

    const revisionOperation =
      normalizeRevisionOperation(recommendationRow.revision_operation) ??
      inferLedgerRevisionOperation({
        criterion,
        anchor: evidenceAnchor,
        rationale,
        action: normalizeOptionalText(recommendationRow.action),
        fixDirection: normalizeOptionalText(recommendationRow.fix_direction) ?? normalizeOptionalText(recommendationRow.specific_fix),
      });

    const fallbackCandidates = buildFallbackCandidateTexts(recommendationCandidateInput({
      criterion,
      evidenceAnchor,
      rationale,
      recommendationRow,
      revisionOperation,
    }));

    opportunities.push(ensureOpportunityCandidates({
      opportunity_id: buildOpportunityId({
        criterion,
        rationale,
        anchor: evidenceAnchor,
        location: manuscriptCoordinates,
      }),
      criterion,
      severity: normalizeSeverity(recommendationRow.severity ?? recommendationRow.priority),
      rationale,
      evidence_anchor: evidenceAnchor,
      manuscript_coordinates: manuscriptCoordinates,
      provenance: 'evaluation_result.recommendations',
      confidence: normalizeConfidence(recommendationRow.confidence),
      decision_state: 'open',
      revision_operation: revisionOperation,
      candidate_text_a: explicitCandidateOrFallback(recommendationRow.candidate_text_a, fallbackCandidates.a, rationale, evidenceAnchor),
      candidate_text_b: explicitCandidateOrFallback(recommendationRow.candidate_text_b, fallbackCandidates.b, rationale, evidenceAnchor),
      candidate_text_c: explicitCandidateOrFallback(recommendationRow.candidate_text_c, fallbackCandidates.c, rationale, evidenceAnchor),
      symptom: normalizeOptionalText(recommendationRow.symptom),
      cause: normalizeOptionalText(recommendationRow.cause) ?? normalizeOptionalText(recommendationRow.mechanism),
      fix_direction: normalizeOptionalText(recommendationRow.fix_direction) ?? normalizeOptionalText(recommendationRow.specific_fix),
      reader_effect: normalizeOptionalText(recommendationRow.reader_effect),
      mistake_proofing: normalizeOptionalText(recommendationRow.mistake_proofing),
    }));
  }

  return opportunities;
}

const MAX_OPPORTUNITIES_SHORT_FORM = REVISE_QUEUE_MAX_SHORT_FORM;
const MAX_OPPORTUNITIES_LONG_FORM = REVISE_QUEUE_MAX_LONG_FORM;
const LONG_FORM_WORD_THRESHOLD = REVISE_QUEUE_LONG_FORM_WORD_THRESHOLD;

const SEVERITY_RANK: Record<string, number> = { must: 0, should: 1, could: 2 };

type CanonicalRevisionSourceMode = 'canonical_full' | 'legacy_rendered_degraded';

type CertifiedUedOpportunityProjection = {
  opportunities: RevisionOpportunity[];
  sourceUedHash: string;
  /**
   * Count of items in the report-display `rendered_opportunities` array (curated,
   * capped at 7/10 by capRenderedOpportunities). Retained for observability/telemetry
   * ONLY. This is NOT the Revise supply — Revise consumes the full canonical
   * `opportunities` array (see extractCanonicalRevisionOpportunities).
   */
  renderedOpportunityCount: number;
  /** Count of items in the authoritative canonical `opportunities` array. */
  canonicalOpportunityCount: number;
  /**
   * Which array actually supplied the Revise opportunities:
   *  - 'canonical_full': normal path, sourced from canonicalOpportunityLedger.opportunities
   *  - 'legacy_rendered_degraded': fallback for legacy artifacts that lack a full
   *    `opportunities` array; sourced from rendered_opportunities and explicitly
   *    flagged as degraded so downstream never assumes the full ledger was available.
   */
  sourceMode: CanonicalRevisionSourceMode;
};

function severityFromCanonicalOpportunity(raw: unknown): LedgerSeverity {
  if (raw === 'high') return 'must';
  if (raw === 'low') return 'could';
  return 'should';
}

function confidenceFromCanonicalOpportunity(raw: unknown): LedgerConfidence {
  if (raw === 'high') return 'high';
  if (raw === 'low') return 'medium';
  return 'medium';
}

function canonicalUedOpportunityToRevisionOpportunity(
  item: Record<string, unknown>,
  sourceUedHash: string,
  provenance: string,
): RevisionOpportunity | null {
  const opportunityId = firstNonEmptyString(item.id, item.opportunity_id);
  const sourceCriterion = firstNonEmptyString(item.primary_criterion, item.criterion);
  const criterion = normalizeCriterion(sourceCriterion);
  const evidenceAnchor = firstNonEmptyString(item.evidence, item.anchor_snippet, item.evidence_anchor);
  const rationale = firstNonEmptyString(item.fix_direction, item.action, item.symptom);
  const manuscriptCoordinates = firstNonEmptyString(item.location, item.manuscript_coordinates, `${criterion}:recommendation`);

  if (!opportunityId || !sourceCriterion || !evidenceAnchor || !rationale) return null;

  return ensureOpportunityCandidates({
    opportunity_id: opportunityId,
    source_opportunity_id: opportunityId,
    source_criterion: sourceCriterion,
    source_ued_hash: sourceUedHash,
    criterion,
    severity: severityFromCanonicalOpportunity(item.severity),
    rationale,
    evidence_anchor: evidenceAnchor,
    manuscript_coordinates: manuscriptCoordinates,
    provenance,
    confidence: confidenceFromCanonicalOpportunity(item.severity),
    decision_state: 'open',
    candidate_text_a: normalizeOptionalText(item.candidate_text_a),
    symptom: normalizeOptionalText(item.symptom),
    cause: normalizeOptionalText(item.cause),
    fix_direction: normalizeOptionalText(item.fix_direction),
    reader_effect: normalizeOptionalText(item.reader_effect),
    mistake_proofing: normalizeOptionalText(item.mistake_proofing),
  });
}

type CanonicalRevisionExtraction = {
  /** Authoritative opportunities to feed into the Revise projection. */
  items: Record<string, unknown>[];
  /** Which array supplied `items` — normal canonical vs. degraded legacy fallback. */
  sourceMode: CanonicalRevisionSourceMode;
  /** Size of the report-display rendered_opportunities array (telemetry only). */
  renderedCount: number;
  /** Size of the full canonical opportunities array (telemetry only). */
  canonicalCount: number;
};

/**
 * Extract the opportunities that Revise should consume from a certified UED.
 *
 * AUTHORITY CONTRACT:
 *   Revise is an execution surface and must receive the FULL canonical opportunity
 *   supply (`canonicalOpportunityLedger.opportunities`), independently capped later
 *   by the 50/100 Revise-queue policy (capRevisionOpportunities).
 *
 *   It must NOT read `rendered_opportunities` on the normal path — that array is the
 *   report/PDF's curated 7/10 display selection produced by capRenderedOpportunities,
 *   a different consumer with a different purpose. Reading it here previously truncated
 *   the Revise supply to 10 before the 50/100 policy could ever apply.
 *
 * LEGACY FALLBACK:
 *   Some older certified artifacts predate the full `opportunities` array and only
 *   carry `rendered_opportunities`. For those we fall back to the rendered array but
 *   flag the extraction as 'legacy_rendered_degraded' so downstream telemetry/provenance
 *   never pretends the full ledger was available. The normal path is never silently
 *   downgraded to the report array.
 */
export function extractCanonicalRevisionOpportunities(unifiedDocument: unknown): CanonicalRevisionExtraction {
  const empty: CanonicalRevisionExtraction = {
    items: [],
    sourceMode: 'canonical_full',
    renderedCount: 0,
    canonicalCount: 0,
  };
  if (!isRecord(unifiedDocument)) return empty;
  const ledger = isRecord(unifiedDocument.canonicalOpportunityLedger)
    ? unifiedDocument.canonicalOpportunityLedger
    : null;

  const canonicalPresent = Array.isArray(ledger?.opportunities);
  const canonical = Array.isArray(ledger?.opportunities)
    ? ledger.opportunities.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
  const rendered = Array.isArray(ledger?.rendered_opportunities)
    ? ledger.rendered_opportunities.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];

  // Normal path: the full canonical opportunities array is present and authoritative.
  if (canonicalPresent) {
    return {
      items: canonical,
      sourceMode: 'canonical_full',
      renderedCount: rendered.length,
      canonicalCount: canonical.length,
    };
  }

  // Degraded legacy fallback: no full canonical array on this artifact. Use the
  // rendered array but mark it explicitly so nothing downstream assumes full supply.
  if (rendered.length > 0) {
    return {
      items: rendered,
      sourceMode: 'legacy_rendered_degraded',
      renderedCount: rendered.length,
      canonicalCount: 0,
    };
  }

  return empty;
}

async function loadCertifiedUedOpportunityProjection(
  supabase: any,
  jobId: string,
): Promise<CertifiedUedOpportunityProjection | null> {
  const [{ data: unifiedRow, error: unifiedError }, { data: certificationRow, error: certificationError }] = await Promise.all([
    supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'unified_evaluation_document_v1')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'author_exposure_certification_v1')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (unifiedError || certificationError) {
    throw new Error(`Failed to read certified UED for revision opportunity ledger: ${unifiedError?.message ?? certificationError?.message}`);
  }

  const unifiedDocument = unifiedRow?.content;
  if (!unifiedDocument) return null;

  const certification = isRecord(certificationRow?.content) ? certificationRow.content : null;
  if (!certification) {
    throw new Error('Certified UED is present but author_exposure_certification_v1 is missing for revision opportunity ledger.');
  }
  if (
    certification.schema_version !== 'author_exposure_certification_v1' ||
    certification.decision !== 'certified' ||
    typeof certification.unified_document_hash !== 'string' ||
    certification.unified_document_hash.trim().length === 0
  ) {
    throw new Error('Certified UED is present but author_exposure_certification_v1 is not certified for revision opportunity ledger.');
  }

  const sourceUedHash = canonicalJsonSha256(unifiedDocument);
  if (sourceUedHash !== certification.unified_document_hash) {
    throw new Error(`Certified UED hash mismatch for revision opportunity ledger: expected=${certification.unified_document_hash} actual=${sourceUedHash}`);
  }

  const extraction = extractCanonicalRevisionOpportunities(unifiedDocument);
  const provenance = extraction.sourceMode === 'canonical_full'
    ? 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities'
    : 'unified_evaluation_document_v1.canonicalOpportunityLedger.rendered_opportunities';
  const opportunities = extraction.items
    .map((item) => canonicalUedOpportunityToRevisionOpportunity(item, sourceUedHash, provenance))
    .filter((item): item is RevisionOpportunity => item !== null);

  if (extraction.items.length > 0 && opportunities.length === 0) {
    throw new Error('Certified UED canonical opportunity ledger contains no revision-usable opportunities.');
  }

  return {
    opportunities,
    sourceUedHash,
    renderedOpportunityCount: extraction.renderedCount,
    canonicalOpportunityCount: extraction.canonicalCount,
    sourceMode: extraction.sourceMode,
  };
}

export type CanonicalRevisionProjectionResult = {
  opportunities: RevisionOpportunity[];
  sourceMode: CanonicalRevisionSourceMode;
  renderedCount: number;
  canonicalCount: number;
};

/**
 * Pure, Supabase-free composition of the exact Revise projection sequence:
 *   extractCanonicalRevisionOpportunities -> canonicalUedOpportunityToRevisionOpportunity
 *   -> filter unusable -> capRevisionOpportunities(50/100 policy).
 *
 * This mirrors loadCertifiedUedOpportunityProjection + the capRevisionOpportunities
 * call in ensureRevisionOpportunityLedgerArtifact, exposed for deterministic unit
 * tests of the authority contract (report display vs. full Revise supply).
 */
export function projectCanonicalRevisionOpportunities(
  unifiedDocument: unknown,
  sourceUedHash: string,
  wordCount: number | null | undefined,
): CanonicalRevisionProjectionResult {
  const extraction = extractCanonicalRevisionOpportunities(unifiedDocument);
  const provenance = extraction.sourceMode === 'canonical_full'
    ? 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities'
    : 'unified_evaluation_document_v1.canonicalOpportunityLedger.rendered_opportunities';
  const mapped = extraction.items
    .map((item) => canonicalUedOpportunityToRevisionOpportunity(item, sourceUedHash, provenance))
    .filter((item): item is RevisionOpportunity => item !== null);
  const capped = capRevisionOpportunities(mapped, wordCount);
  return {
    opportunities: capped,
    sourceMode: extraction.sourceMode,
    renderedCount: extraction.renderedCount,
    canonicalCount: extraction.canonicalCount,
  };
}

function extractChunkCacheRecommendations(chunkCachePayload: unknown): RevisionOpportunity[] {
  if (!isRecord(chunkCachePayload)) return [];

  const chunksRaw = chunkCachePayload.chunks;
  if (!isRecord(chunksRaw)) return [];

  const opportunities: RevisionOpportunity[] = [];

  for (const [chunkIdx, chunkData] of Object.entries(chunksRaw)) {
    if (!isRecord(chunkData)) continue;
    const result = chunkData.result;
    if (!isRecord(result)) continue;

    const criteria = Array.isArray(result.criteria) ? result.criteria : [];
    for (const criterionRow of criteria) {
      if (!isRecord(criterionRow)) continue;

      const criterion = normalizeCriterion(criterionRow.criterion_id ?? criterionRow.key ?? criterionRow.criterion_key);
      const criterionScore = criterionRow.score_0_10;
      const recommendations = Array.isArray(criterionRow.recommendations)
        ? criterionRow.recommendations
        : [];

      for (const rec of recommendations) {
        if (!isRecord(rec)) continue;

        const evidenceAnchor = firstNonEmptyString(
          rec.anchor_snippet,
          rec.evidence_anchor,
          rec.evidence_snippet,
          rec.snippet,
          rec.quote,
        );

        if (!evidenceAnchor) continue;

        const rationale = firstNonEmptyString(
          rec.rationale,
          rec.diagnosis,
          rec.why,
          rec.justification,
          rec.recommendation,
          rec.action,
        );

        if (!rationale) continue;

        const manuscriptCoordinates = firstNonEmptyString(
          rec.manuscript_coordinates,
          rec.location_ref,
          rec.locationRef,
          `chunk_${chunkIdx}:${criterion}:recommendation`,
        );

        const revisionOperation =
          normalizeRevisionOperation(rec.revision_operation) ??
          inferLedgerRevisionOperation({
            criterion,
            anchor: evidenceAnchor,
            rationale,
            action: normalizeOptionalText(rec.action),
            fixDirection: normalizeOptionalText(rec.fix_direction) ?? normalizeOptionalText(rec.specific_fix),
          });

        const fallbackCandidates = buildFallbackCandidateTexts(recommendationCandidateInput({
          criterion,
          evidenceAnchor,
          rationale,
          recommendationRow: rec,
          revisionOperation,
        }));

        opportunities.push(ensureOpportunityCandidates({
          opportunity_id: buildOpportunityId({
            criterion,
            rationale,
            anchor: evidenceAnchor,
            location: manuscriptCoordinates,
          }),
          criterion,
          severity: normalizeSeverity(rec.severity ?? rec.priority, criterionScore),
          rationale,
          evidence_anchor: evidenceAnchor,
          manuscript_coordinates: manuscriptCoordinates,
          provenance: `pass2_chunk_cache.chunk_${chunkIdx}.criteria.recommendations`,
          confidence: normalizeConfidence(rec.confidence),
          decision_state: 'open',
          revision_operation: revisionOperation,
          candidate_text_a: explicitCandidateOrFallback(rec.candidate_text_a, fallbackCandidates.a, rationale, evidenceAnchor),
          candidate_text_b: explicitCandidateOrFallback(rec.candidate_text_b, fallbackCandidates.b, rationale, evidenceAnchor),
          candidate_text_c: explicitCandidateOrFallback(rec.candidate_text_c, fallbackCandidates.c, rationale, evidenceAnchor),
          symptom: normalizeOptionalText(rec.symptom),
          cause: normalizeOptionalText(rec.cause) ?? normalizeOptionalText(rec.mechanism),
          fix_direction: normalizeOptionalText(rec.fix_direction) ?? normalizeOptionalText(rec.specific_fix),
          reader_effect: normalizeOptionalText(rec.reader_effect),
          mistake_proofing: normalizeOptionalText(rec.mistake_proofing),
        }));
      }
    }
  }

  return opportunities;
}

/**
 * Extract revision opportunities from the longform document's criterion_analyses
 * revision_queue items. These are specific, chapter-located, operation-tagged
 * revision instructions generated by the DREAM narrative synthesis.
 */
function extractLongformCriterionRevisionQueue(longformPayload: unknown): RevisionOpportunity[] {
  if (!isRecord(longformPayload)) return [];

  const doc = isRecord(longformPayload.longform_document)
    ? longformPayload.longform_document
    : longformPayload;

  const criterionAnalyses = Array.isArray(doc.criterion_analyses) ? doc.criterion_analyses : [];
  const opportunities: RevisionOpportunity[] = [];

  for (const ca of criterionAnalyses) {
    if (!isRecord(ca)) continue;

    const criterion = normalizeCriterion(ca.key ?? ca.criterion);
    const criterionScore = ca.score;
    const revisionQueue = Array.isArray(ca.revision_queue) ? ca.revision_queue : [];

    for (const item of revisionQueue) {
      if (!isRecord(item) && typeof item !== 'string') continue;

      const itemText = typeof item === 'string' ? item : '';
      const itemRecord = isRecord(item) ? item : null;

      const rawText = itemRecord
        ? firstNonEmptyString(itemRecord.text, itemRecord.description, itemRecord.action) ?? itemText
        : itemText;

      if (!rawText || rawText.length < 10) continue;

      const locationMatch = rawText.match(/\[LOCATION:\s*([^\]]+)\]/i);
      const operationMatch = rawText.match(/\[OPERATION:\s*([^\]]+)\]/i);
      const location = locationMatch?.[1]?.trim() ?? (itemRecord ? firstNonEmptyString(itemRecord.location, itemRecord.chapter) : null) ?? `${criterion}:longform_revision_queue`;
      const operation = operationMatch?.[1]?.trim() ?? (itemRecord ? firstNonEmptyString(itemRecord.operation) : null) ?? null;

      const cleanText = rawText
        .replace(/\[LOCATION:\s*[^\]]+\]\s*/gi, '')
        .replace(/\[OPERATION:\s*[^\]]+\]\s*/gi, '')
        .replace(/^—\s*/, '')
        .trim();

      if (!cleanText || cleanText.length < 10) continue;

      const anchor = cleanText.length > 120 ? cleanText.slice(0, 120) : cleanText;

      const revisionOperation =
        normalizeRevisionOperation(operation) ??
        inferLedgerRevisionOperation({
          criterion,
          anchor,
          rationale: cleanText,
          action: operation,
          fixDirection: null,
        });

      const fallbackCandidates = buildFallbackCandidateTexts(recommendationCandidateInput({
        criterion,
        evidenceAnchor: anchor,
        rationale: cleanText,
        recommendationRow: {},
        revisionOperation,
      }));

      opportunities.push(ensureOpportunityCandidates({
        opportunity_id: buildOpportunityId({
          criterion,
          rationale: cleanText,
          anchor,
          location,
        }),
        criterion,
        severity: normalizeSeverity(itemRecord?.severity ?? itemRecord?.priority, criterionScore),
        rationale: cleanText,
        evidence_anchor: anchor,
        manuscript_coordinates: location,
        provenance: `longform_document.criterion_analyses.${criterion}.revision_queue`,
        confidence: normalizeConfidence(itemRecord?.confidence),
        decision_state: 'open',
        revision_operation: revisionOperation,
        candidate_text_a: '',
        candidate_text_b: '',
        candidate_text_c: '',
        grounding_status: 'unsupported_blocked',
        grounding_note: 'Longform revision queue item had no explicit candidate prose; backend fallback blocked by SLAE.',
        symptom: null,
        cause: null,
        fix_direction: operation,
        reader_effect: null,
        mistake_proofing: null,
      }));
    }
  }

  return opportunities;
}

/**
 * Extract revision opportunities from the longform document's revision_plan
 * actions. These are prioritized, chapter-located revision tasks generated
 * by the DREAM narrative synthesis.
 */
function extractLongformRevisionPlan(longformPayload: unknown): RevisionOpportunity[] {
  if (!isRecord(longformPayload)) return [];

  const doc = isRecord(longformPayload.longform_document)
    ? longformPayload.longform_document
    : longformPayload;

  const revisionPlan = Array.isArray(doc.revision_plan) ? doc.revision_plan : [];
  const opportunities: RevisionOpportunity[] = [];

  for (const planItem of revisionPlan) {
    if (!isRecord(planItem)) continue;

    const planTitle = firstNonEmptyString(planItem.title, planItem.name) ?? '';
    const priority = planItem.priority;
    const actions = Array.isArray(planItem.actions) ? planItem.actions : [];

    for (const action of actions) {
      const actionText = typeof action === 'string' ? action : (isRecord(action) ? firstNonEmptyString(action.text, action.description, action.action) ?? '' : '');
      if (!actionText || actionText.length < 10) continue;

      const locationMatch = actionText.match(/\[Ch\.\s*([^\]]+)\]/i);
      const operationMatch = actionText.match(/\b(compress|add|replace|refine|rewrite|merge|tighten|echo)\b/i);
      const location = locationMatch ? `Chapters ${locationMatch[1].trim()}` : `revision_plan:priority_${priority}`;
      const operation = operationMatch?.[1]?.trim() ?? null;

      const cleanText = actionText
        .replace(/\[Ch\.\s*[^\]]+\]\s*/gi, '')
        .replace(/^(compress|add|replace|refine|rewrite|merge|tighten|echo)—\s*/i, '')
        .trim();

      if (!cleanText || cleanText.length < 10) continue;

      const anchor = cleanText.length > 120 ? cleanText.slice(0, 120) : cleanText;

      const criterion = inferCriterionFromRevisionPlanTitle(planTitle);

      const revisionOperation =
        normalizeRevisionOperation(operation) ??
        inferLedgerRevisionOperation({
          criterion,
          anchor,
          rationale: cleanText,
          action: operation,
          fixDirection: null,
        });

      const fallbackCandidates = buildFallbackCandidateTexts(recommendationCandidateInput({
        criterion,
        evidenceAnchor: anchor,
        rationale: cleanText,
        recommendationRow: {},
        revisionOperation,
      }));

      opportunities.push(ensureOpportunityCandidates({
        opportunity_id: buildOpportunityId({
          criterion,
          rationale: cleanText,
          anchor,
          location,
        }),
        criterion,
        severity: normalizeSeverity(
          typeof priority === 'number'
            ? (priority <= 2 ? 'high' : priority <= 4 ? 'medium' : 'low')
            : 'medium',
          undefined,
        ),
        rationale: cleanText,
        evidence_anchor: anchor,
        manuscript_coordinates: location,
        provenance: `longform_document.revision_plan.priority_${priority}`,
        confidence: normalizeConfidence(null),
        decision_state: 'open',
        revision_operation: revisionOperation,
        candidate_text_a: '',
        candidate_text_b: '',
        candidate_text_c: '',
        grounding_status: 'unsupported_blocked',
        grounding_note: 'Longform revision-plan action had no explicit candidate prose; backend fallback blocked by SLAE.',
        symptom: null,
        cause: null,
        fix_direction: `${planTitle} (Priority ${priority})`,
        reader_effect: null,
        mistake_proofing: null,
      }));
    }
  }

  return opportunities;
}

function inferCriterionFromRevisionPlanTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('pacing')) return 'pacing';
  if (lower.includes('dialogue')) return 'dialogue';
  if (lower.includes('character') || lower.includes('relationship') || lower.includes('interiori')) return 'character';
  if (lower.includes('prose') || lower.includes('voice')) return 'proseControl';
  if (lower.includes('scene')) return 'sceneConstruction';
  if (lower.includes('closure') || lower.includes('payoff') || lower.includes('symbolic')) return 'narrativeClosure';
  if (lower.includes('narrativedrive')) return 'narrativeDrive';
  if (lower.includes('world')) return 'worldbuilding';
  if (lower.includes('theme')) return 'theme';
  if (lower.includes('tone')) return 'tone';
  if (lower.includes('market') || lower.includes('accessib')) return 'marketability';
  if (lower.includes('concept')) return 'concept';
  return 'general';
}

export function buildRevisionOpportunitiesFromEvaluationPayload(
  payload: unknown,
  chunkCachePayload?: unknown,
  longformPayload?: unknown,
  options?: { wordCount?: number },
): RevisionOpportunity[] {
  if (!isRecord(payload)) {
    return [];
  }

  const merged = [
    ...extractCriteriaRecommendations(payload),
    ...extractTopLevelRecommendations(payload),
    ...extractChunkCacheRecommendations(chunkCachePayload),
    ...extractLongformCriterionRevisionQueue(longformPayload),
    ...extractLongformRevisionPlan(longformPayload),
  ];

  const deduped = new Map<string, RevisionOpportunity>();
  for (const opportunity of merged) {
    const canonical = ensureOpportunityCandidates(opportunity);
    if (!deduped.has(canonical.opportunity_id)) {
      deduped.set(canonical.opportunity_id, canonical);
    }
  }

  const all = [...deduped.values()];

  // Second-pass dedup: same anchor + same operation across different criteria creates
  // redundant cards for the user. Keep only the highest-severity opportunity per
  // (anchor_fingerprint, revision_operation) pair.
  const SEVERITY_RANK: Record<string, number> = { must: 3, should: 2, could: 1 };
  const anchorOpKey = (o: RevisionOpportunity) =>
    `${o.revision_operation ?? 'replace'}::${o.evidence_anchor.trim().toLowerCase().slice(0, 80)}`;
  const anchorOpDeduped = new Map<string, RevisionOpportunity>();
  for (const opp of all) {
    const key = anchorOpKey(opp);
    const existing = anchorOpDeduped.get(key);
    if (!existing) {
      anchorOpDeduped.set(key, opp);
    } else {
      const oppRank = SEVERITY_RANK[opp.severity] ?? 0;
      const existingRank = SEVERITY_RANK[existing.severity] ?? 0;
      if (oppRank > existingRank) {
        anchorOpDeduped.set(key, opp);
      }
    }
  }

  return capRevisionOpportunities([...anchorOpDeduped.values()], options?.wordCount);
}

export async function ensureRevisionOpportunityLedgerArtifact(
  supabase: any,
  jobId: string,
  options?: { forceRebuild?: boolean; allowLegacyEvaluationProjection?: boolean },
): Promise<EnsureLedgerResult> {
  const { data: existingLedgerRow, error: existingLedgerError } = await supabase
    .from('evaluation_artifacts')
    .select('id, content')
    .eq('job_id', jobId)
    .eq('artifact_type', 'revision_opportunity_ledger_v1')
    .maybeSingle();

  if (existingLedgerError) {
    throw new Error(`Failed to read revision_opportunity_ledger_v1: ${existingLedgerError.message}`);
  }

  const existingOpportunities = normalizeExistingLedgerOpportunities(
    existingLedgerRow?.content?.opportunities,
  );

  const { data: jobRow, error: jobReadError } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, evaluation_project_id, evaluation_result, policy_family, voice_preservation_level, english_variant')
    .eq('id', jobId)
    .maybeSingle();

  if (jobReadError || !jobRow) {
    throw new Error(`Failed to resolve evaluation job for revision opportunity ledger: ${jobReadError?.message ?? 'job not found'}`);
  }

  const { data: evaluationResultRow, error: evaluationResultError } = await supabase
    .from('evaluation_artifacts')
    .select('content, source_hash')
    .eq('job_id', jobId)
    .in('artifact_type', ['evaluation_result_v2', 'evaluation_result_v1'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const evaluationPayload =
    evaluationResultRow?.content ??
    (isRecord(jobRow.evaluation_result) ? jobRow.evaluation_result : null);
  const jobEvaluationPayloadRecord = isRecord(evaluationPayload) ? evaluationPayload : {};
  const jobOverviewRecord = isRecord(jobEvaluationPayloadRecord.overview) ? jobEvaluationPayloadRecord.overview : {};
  const jobWordCount = typeof jobOverviewRecord.word_count === 'number'
    ? jobOverviewRecord.word_count
    : typeof jobEvaluationPayloadRecord.word_count === 'number'
      ? jobEvaluationPayloadRecord.word_count
      : 0;
  const modeContract = resolveRevisionModeContract({
    evaluationPayload,
    job: jobRow,
  });
  const selectedEnglishVariant = normalizeEnglishVariant(jobRow.english_variant);
  const genreExpectationContext = extractGenreExpectationMetadataFromEvaluationPayload(evaluationPayload);

  let ledgerQualityReportContent: unknown = null;
  try {
    const { data: ledgerQualityRow } = await supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'ledger_quality_report_v1')
      .maybeSingle();
    ledgerQualityReportContent = ledgerQualityRow?.content ?? null;
  } catch {
    // Non-blocking: absence of the quality report preserves legacy behavior,
    // but a present degraded report must constrain Revise below.
  }

  const contextQualityDecision = resolveReviseContextQuality(ledgerQualityReportContent, modeContract.evaluation_mode);
  // A job has exactly one authoritative Revise Queue ledger, but the persisted
  // row is not a cache authority. Always rebuild from the canonical evaluation
  // artifacts for this job and upsert over the existing row. This prevents stale
  // candidate prose, stale preflight outcomes, or old admission rules from being
  // reused after governance changes.

  if (evaluationResultError || !evaluationPayload) {
    throw new Error(
      `Failed to build revision opportunity ledger: evaluation result artifact missing (${evaluationResultError?.message ?? 'no evaluation result'})`,
    );
  }

  // Load pass2 chunk cache for granular per-chunk recommendations
  let chunkCachePayload: unknown = undefined;
  try {
    const { data: chunkCacheRow } = await supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'pass2_chunk_cache_v1')
      .maybeSingle();
    if (chunkCacheRow?.content) {
      chunkCachePayload = chunkCacheRow.content;
    }
  } catch {
    // Non-blocking: chunk cache enrichment degrades gracefully
  }

  // Load longform document for revision_plan + criterion revision_queue items
  let longformPayload: unknown = undefined;
  try {
    const { data: longformRow } = await supabase
      .from('evaluation_artifacts')
      .select('content')
      .eq('job_id', jobId)
      .eq('artifact_type', 'longform_document_v1')
      .maybeSingle();
    if (longformRow?.content) {
      longformPayload = longformRow.content;
    }
  } catch {
    // Non-blocking: longform enrichment degrades gracefully
  }

  // Determine word count for short/long-form opportunity cap (50 vs 100)
  const evalPayloadRecord = isRecord(evaluationPayload) ? evaluationPayload : {};
  const overviewRecord = isRecord(evalPayloadRecord.overview) ? evalPayloadRecord.overview : {};
  const wordCount = typeof overviewRecord.word_count === 'number'
    ? overviewRecord.word_count
    : typeof evalPayloadRecord.word_count === 'number'
      ? evalPayloadRecord.word_count
      : jobWordCount;

  const uedProjection = await loadCertifiedUedOpportunityProjection(supabase, jobId);
  if (!uedProjection?.opportunities.length && !options?.allowLegacyEvaluationProjection) {
    throw new Error(
      'Certified UED canonicalOpportunityLedger.opportunities is required for revision_opportunity_ledger_v1. Legacy evaluation_result recommendation projection is disabled for author-facing Revise packages.',
    );
  }

  const opportunities = uedProjection?.opportunities.length
    ? capRevisionOpportunities(uedProjection.opportunities, wordCount)
    : buildRevisionOpportunitiesFromEvaluationPayload(
        evaluationPayload, chunkCachePayload, longformPayload, { wordCount },
      );
  const opportunitySourceAuthority = uedProjection?.opportunities.length
    ? uedProjection.sourceMode === 'legacy_rendered_degraded'
      ? 'unified_evaluation_document_v1.canonicalOpportunityLedger.rendered_opportunities_legacy_degraded'
      : 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities'
    : 'legacy_evaluation_result_projection_explicit_backfill_only';

  const preflightedOpportunities = applyReviseQueuePreflight(opportunities, {
    contextQuality: contextQualityDecision.status,
    evaluationMode: modeContract.evaluation_mode,
  });
  opportunities.splice(0, opportunities.length, ...preflightedOpportunities);
  let preflightSummary = summarizePreflight(opportunities);

  // ── AI Candidate Hydration Pass ────────────────────────────────────────────
  // For each opportunity that SLAE blocked (no explicit candidate prose from
  // the evaluation pipeline), generate A/B/C prose via a single batched OpenAI
  // call.  Failures are non-fatal — blocked opportunities stay blocked.

  // Load manuscript chunks once (non-fatal) to provide surrounding prose context
  // to the hydration prompt. This significantly improves SLAE pass rate because
  // OpenAI can match voice/style and avoid echoing the anchor.
  let manuscriptChunksByContent: Array<{ content: string }> = [];
  try {
    const { data: chunkRows } = await supabase
      .from('manuscript_chunks')
      .select('content')
      .eq('manuscript_id', Number(jobRow.manuscript_id))
      .order('chunk_index', { ascending: true });
    if (Array.isArray(chunkRows)) {
      manuscriptChunksByContent = chunkRows as Array<{ content: string }>;
    }
  } catch {
    // Non-blocking — hydration degrades gracefully without chunk context
  }

  /**
   * Find the chunk whose content contains the most characters of the anchor,
   * falling back to substring inclusion, then to the longest content overlap.
   */
  function findChunkForAnchor(anchor: string): string | undefined {
    if (!anchor || manuscriptChunksByContent.length === 0) return undefined;
    const normalizeHydrationText = (raw: string): string =>
      raw
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2026…]/g, ' ')
        .replace(/\.\.\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const normAnchor = normalizeHydrationText(anchor).slice(0, 200);
    if (!normAnchor) return undefined;

    // Exact substring match (most reliable)
    const exact = manuscriptChunksByContent.find((c) =>
      normalizeHydrationText(c.content).includes(normAnchor),
    );
    if (exact) return exact.content;

    // Prefix match for truncated anchors (e.g., trailing ellipsis)
    const anchorPrefix = normAnchor.split(/[.!?]/)[0]?.trim() ?? '';
    if (anchorPrefix.length >= 24) {
      const prefixMatch = manuscriptChunksByContent.find((c) =>
        normalizeHydrationText(c.content).includes(anchorPrefix),
      );
      if (prefixMatch) return prefixMatch.content;
    }

    // Guarded fuzzy fallback for long, non-truncated anchors only.
    if (!anchorLooksTruncated(anchor) && normAnchor.length >= 80) {
      const anchorTokens = new Set(normAnchor.split(' ').filter((token) => token.length >= 4));
      let best: { chunk: string; overlap: number; matchedTokens: number } | null = null;

      for (const c of manuscriptChunksByContent) {
        const chunkNorm = normalizeHydrationText(c.content);
        const chunkTokens = new Set(chunkNorm.split(' ').filter((token) => token.length >= 4));
        if (chunkTokens.size === 0 || anchorTokens.size === 0) continue;

        let matched = 0;
        for (const token of anchorTokens) {
          if (chunkTokens.has(token)) matched++;
        }
        const overlap = matched / Math.max(anchorTokens.size, 1);
        if (!best || overlap > best.overlap) best = { chunk: c.content, overlap, matchedTokens: matched };
      }

      if (best && best.overlap >= 0.55 && best.matchedTokens >= 6) {
        return best.chunk;
      }
    }

    return undefined;
  }

  // ── SIPOC Kick-Backward: Diagnostic Enrichment ────────────────────────────
  // Before hydrating candidates, ensure every opportunity has complete diagnostic
  // fields (symptom, cause, fix_direction, reader_effect). If any are missing,
  // ask the LLM to produce them — telling it WHAT is missing, WHY it's needed,
  // and showing the GOLD STANDARD example from the Sister dream ledger.
  if (opportunities.length > 0 && process.env.OPENAI_API_KEY?.trim()) {
    const needsEnrichment = opportunities.filter((o) =>
      o.preflight_status !== 'blocked' && needsDiagnosticEnrichment({
        opportunity_id: o.opportunity_id,
        evidence_anchor: o.evidence_anchor,
        rationale: o.rationale,
        criterion: o.criterion,
        revision_operation: o.revision_operation,
        symptom: o.symptom,
        cause: o.cause,
        fix_direction: o.fix_direction,
        reader_effect: o.reader_effect,
      }),
    );

    if (needsEnrichment.length > 0) {
      const enrichmentInput: EnrichmentOpportunity[] = needsEnrichment.map((o) => ({
        opportunity_id: o.opportunity_id,
        evidence_anchor: o.evidence_anchor,
        rationale: o.rationale,
        criterion: o.criterion,
        revision_operation: o.revision_operation,
        symptom: o.symptom,
        cause: o.cause,
        fix_direction: o.fix_direction,
        reader_effect: o.reader_effect,
        english_variant: selectedEnglishVariant,
      }));

      const enrichmentResult = await enrichDiagnosticFields(enrichmentInput);

      // Apply enriched diagnostic fields back to opportunities
      for (const [oppId, enriched] of enrichmentResult.results) {
        const opp = opportunities.find((o) => o.opportunity_id === oppId);
        if (!opp) continue;
        if (enriched.symptom && enriched.symptom.length >= 10) opp.symptom = enriched.symptom;
        if (enriched.cause && enriched.cause.length >= 10) opp.cause = enriched.cause;
        if (enriched.fix_direction && enriched.fix_direction.length >= 10) opp.fix_direction = enriched.fix_direction;
        if (enriched.reader_effect && enriched.reader_effect.length >= 10) opp.reader_effect = enriched.reader_effect;
      }

      console.info(
        `[DiagnosticEnrichment] ${enrichmentResult.enrichedCount} enriched, ${enrichmentResult.failedCount} failed (of ${needsEnrichment.length} needing enrichment)`,
      );
    }
  }

  let hydrationStatusSuffix = '';
  const hydrationAttemptedByOpportunityId = new Set<string>();
  const hydrationContextFoundByOpportunityId = new Map<string, boolean>();
  if (opportunities.length > 0) {
    const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiApiKey) {
      const blockedOpps: HydrationOpportunity[] = [];

      for (const o of opportunities) {
        const needsCandidates = !o.candidate_text_a || !o.candidate_text_b || !o.candidate_text_c;
        const preflightAllowsHydration = o.preflight_status === 'passed' || o.preflight_status === 'limited_context';
        // KICKBACK FIX: hydrate whenever B or C are empty, regardless of grounding_status.
        // The old condition (grounding_status !== 'supported') meant items that PASSED
        // grounding but had empty B/C from the LLM never triggered hydration — silent gap.
        // Now: any item with preflight passed AND missing any candidate fires hydration.
        const needsHydration = preflightAllowsHydration && needsCandidates;
        if (!needsHydration) continue;

        const manuscriptContext = findChunkForAnchor(o.evidence_anchor);
        const eligibilityReasons: string[] = [];

        const contextNotFound = !o.evidence_anchor.trim() || !manuscriptContext?.trim();
        const anchorTruncated = anchorLooksTruncated(o.evidence_anchor);
        const placeholderCoordinates = hasPlaceholderCoordinates(o);
        const inputContaminated = hasContaminatedRationale(o);

        if (contextNotFound) eligibilityReasons.push('hydration_context_not_found');
        if (anchorTruncated) eligibilityReasons.push('hydration_anchor_truncated');
        if (inputContaminated) eligibilityReasons.push('hydration_input_contaminated');
        // Placeholder coordinates are a hydration blocker only when paired with
        // unrecoverable context contamination/missing context. Placeholder labels
        // alone can still be safely hydrated when anchor+context are strong.
        if (placeholderCoordinates && (contextNotFound || inputContaminated)) {
          eligibilityReasons.push('hydration_placeholder_coordinates');
        }

        if (eligibilityReasons.length > 0) {
          o.hydration_eligible = false;
          o.hydration_ineligibility_reasons = [...new Set(eligibilityReasons)];
          o.preflight_reasons = [...new Set([...(o.preflight_reasons ?? []), ...o.hydration_ineligibility_reasons])];
          o.preflight_status = 'blocked';
          o.preflight_note = 'Needs hydration repair: anchor/context or targeting metadata is not recoverable for safe candidate generation.';
          o.grounding_status = 'unsupported_blocked';
          o.grounding_note = `Hydration input incomplete: ${o.hydration_ineligibility_reasons.join(', ')}`;
          o.admin_actions = blockedAdminActions(o.preflight_reasons);
          o.candidate_text_a = '';
          o.candidate_text_b = '';
          o.candidate_text_c = '';
          continue;
        }

        o.hydration_eligible = true;
        hydrationAttemptedByOpportunityId.add(o.opportunity_id);
        hydrationContextFoundByOpportunityId.set(o.opportunity_id, Boolean(manuscriptContext?.trim()));
        blockedOpps.push({
          opportunity_id: o.opportunity_id,
          evidence_anchor: o.evidence_anchor,
          rationale: o.rationale,
          revision_operation: o.revision_operation,
          evaluation_mode: modeContract.evaluation_mode,
          manuscript_context: manuscriptContext,
          english_variant: selectedEnglishVariant,
        });
      }

      preflightSummary = summarizePreflight(opportunities);

      if (blockedOpps.length > 0) {
        try {
          const hydration = await hydrateLedgerCandidates(blockedOpps, openaiApiKey);
          if (!hydration || !(hydration.candidates instanceof Map)) {
            console.warn(`[CandidateHydration] ${jobId}: hydration returned no usable result`);
          } else {
            for (const opp of opportunities) {
              const filled = hydration.candidates.get(opp.opportunity_id);
              if (filled) {
                opp.candidate_text_a = filled.candidate_text_a;
                opp.candidate_text_b = filled.candidate_text_b;
                opp.candidate_text_c = filled.candidate_text_c;
                opp.grounding_status = 'supported';
                opp.grounding_note = null;
                opp.hydration_ineligibility_reasons = undefined;
                opp.hydration_eligible = true;
                opp.preflight_reasons = (opp.preflight_reasons ?? []).filter((reason) => !reason.startsWith('hydration_'));
                continue;
              }

              const rejectionReason = hydration.rejectionReasons?.get(opp.opportunity_id);
              if (rejectionReason === 'hydration_candidate_rejected_overlap') {
                const mergedReasons = [...new Set([...(opp.preflight_reasons ?? []), rejectionReason])];
                opp.preflight_status = 'blocked';
                opp.preflight_reasons = mergedReasons;
                opp.preflight_note = 'Needs hydration repair: generated candidates echoed anchor evidence and were blocked for safety.';
                opp.grounding_status = 'unsupported_blocked';
                opp.grounding_note = 'Hydration candidates were rejected for anchor overlap.';
                opp.admin_actions = blockedAdminActions(mergedReasons);
                opp.candidate_text_a = '';
                opp.candidate_text_b = '';
                opp.candidate_text_c = '';
              }
            }

            // Surface hydration failure records for admin diagnostics
            if (hydration.failureRecords && hydration.failureRecords.length > 0) {
              void logRevisionEvent({
                evaluation_run_id: jobId,
                event_type: 'hydration',
                severity: 'warn',
                event_code: 'CANDIDATE_HYDRATION_REJECTED',
                message: `${hydration.failureRecords.length} hydration failure(s) across ${blockedOpps.length} blocked opportunities`,
                metadata: {
                  failure_count: hydration.failureRecords.length,
                  blocked_count: blockedOpps.length,
                  hydrated_count: hydration.hydratedCount,
                  failure_codes: [...new Set(hydration.failureRecords.map((r) => r.failure_code))],
                  failure_records: hydration.failureRecords,
                },
              });
            }

            const postHydrationPreflighted = applyReviseQueuePreflight(opportunities, {
              contextQuality: contextQualityDecision.status,
              evaluationMode: modeContract.evaluation_mode,
            });
            opportunities.splice(0, opportunities.length, ...postHydrationPreflighted);
            preflightSummary = summarizePreflight(opportunities);

            // ── Quality Regeneration Pass ─────────────────────────────────────
            // Cards that were hydration-attempted but whose AI prose failed the
            // quality gate get one regeneration attempt before final withholding.
            // Fail closed: if the second attempt also fails quality the card
            // remains blocked and is never shown to the user.
            const qualityBlockedForRegen = opportunities.filter(
              (o) =>
                hydrationAttemptedByOpportunityId.has(o.opportunity_id) &&
                o.preflight_status === 'blocked' &&
                (o.preflight_reasons ?? []).includes('candidate_quality_failed'),
            );
            if (qualityBlockedForRegen.length > 0) {
              const regenInput = qualityBlockedForRegen.map((o) => ({
                opportunity_id: o.opportunity_id,
                evidence_anchor: o.evidence_anchor,
                rationale: o.rationale,
                revision_operation: o.revision_operation,
                evaluation_mode: modeContract.evaluation_mode,
                manuscript_context: findChunkForAnchor(o.evidence_anchor),
                english_variant: selectedEnglishVariant,
              }));
              try {
                const regenResult = await regenerateCandidatesForQualityFailed(regenInput, openaiApiKey);
                for (const opp of opportunities) {
                  const healedCandidates = regenResult.healed.get(opp.opportunity_id);
                  if (healedCandidates) {
                    opp.candidate_text_a = healedCandidates.candidate_text_a;
                    opp.candidate_text_b = healedCandidates.candidate_text_b;
                    opp.candidate_text_c = healedCandidates.candidate_text_c;
                    opp.grounding_status = 'supported';
                    opp.grounding_note = null;
                    opp.preflight_status = 'passed';
                    opp.preflight_reasons = [];
                    opp.preflight_note = undefined;
                    opp.admin_actions = undefined;
                    continue;
                  }
                  const stillFailedReasons = regenResult.stillFailed.get(opp.opportunity_id);
                  if (stillFailedReasons) {
                    opp.preflight_reasons = [...new Set([...(opp.preflight_reasons ?? []), ...stillFailedReasons])];
                    opp.admin_actions = blockedAdminActions(opp.preflight_reasons);
                  }
                }
                // Re-run preflight so healed cards are correctly classified.
                const postRegenPreflighted = applyReviseQueuePreflight(opportunities, {
                  contextQuality: contextQualityDecision.status,
                  evaluationMode: modeContract.evaluation_mode,
                });
                opportunities.splice(0, opportunities.length, ...postRegenPreflighted);
                preflightSummary = summarizePreflight(opportunities);
                console.log(
                  `[CandidateRegen] ${jobId}: regen attempted=${qualityBlockedForRegen.length}` +
                  ` healed=${regenResult.healed.size} stillFailed=${regenResult.stillFailed.size}`,
                );
              } catch (regenErr) {
                console.error(
                  `[CandidateRegen] ${jobId}: non-fatal regeneration error`,
                  regenErr instanceof Error ? regenErr.message : String(regenErr),
                );
              }
            }

            // Use 'complete' only when every blocked opportunity was successfully
            // hydrated — this gates the stable-artifact cache guard. If any
            // opportunity is still blocked, use 'partial' so the next workbench
            // load retries rather than caching the incomplete result permanently.
            const stillBlocked = opportunities.filter(
              (o) => o.preflight_status === 'blocked' || o.grounding_status !== 'supported',
            ).length;
            hydrationStatusSuffix = stillBlocked === 0
              ? '_ai_hydrated_complete_res_preflight_complete'
              : '_ai_hydrated_partial';
          }
          if (hydration) {
            console.log(
              `[CandidateHydration] ${jobId}: hydrated=${hydration.hydratedCount}` +
              ` of ${blockedOpps.length} blocked; suffix=${hydrationStatusSuffix || '(none)'}`,
            );
          }
        } catch (hydrationErr) {
          console.error(
            `[CandidateHydration] ${jobId}: non-fatal error`,
            hydrationErr instanceof Error ? hydrationErr.message : String(hydrationErr),
          );
        }
      }
    }
  }

  if (!hydrationStatusSuffix) {
    const remainingHydratableBlocked = opportunities.filter(
      (o) => o.preflight_status !== 'blocked' && o.grounding_status !== 'supported',
    ).length;
    if (remainingHydratableBlocked === 0) {
      hydrationStatusSuffix = '_res_preflight_complete';
    }
  }

  if (existingOpportunities && existingOpportunities.length === 0 && opportunities.length === 0) {
    return {
      artifactId: typeof existingLedgerRow?.id === 'string' ? existingLedgerRow.id : null,
      opportunities: existingOpportunities,
    };
  }

  const now = new Date().toISOString();
  const artifactId = `revision_opportunity_ledger_v1:${randomUUID().slice(0, 16)}`;
  const candidateGenerationStatus = (longformPayload
    ? 'backend_filled_abc_v1_chunk_enriched_longform_enriched'
    : chunkCachePayload
      ? 'backend_filled_abc_v1_chunk_enriched'
      : 'backend_filled_abc_v1') + hydrationStatusSuffix;

  const qualityManifest = buildRevisionLedgerQualityManifest({
    opportunities,
    wordCount,
    contextQualityDecision,
    candidateGenerationStatus,
  });

  for (const opportunity of opportunities) {
    if (!(opportunity.grounding_status !== 'supported' || opportunity.preflight_status === 'blocked')) continue;

    const telemetry = buildRevisionCandidateRejectionTelemetry({
      opportunity,
      jobId,
      hydrationAttempted: hydrationAttemptedByOpportunityId.has(opportunity.opportunity_id),
      contextFound: hydrationContextFoundByOpportunityId.get(opportunity.opportunity_id) ?? !deriveTelemetryRejectionReasons(opportunity).includes('hydration_context_not_found'),
      candidateGenerationStatus,
    });

    void logRevisionEvent({
      evaluation_run_id: jobId,
      event_type: 'proposal',
      severity: 'warn',
      event_code: 'REVISION_CANDIDATE_REJECTED',
      message: `Revision candidate blocked (${telemetry.rejection_reason_primary}).`,
      metadata: telemetry,
    });
  }

  const sourceHash = sourceHashFor({
    job_id: jobId,
    evaluation_source_hash: evaluationResultRow.source_hash ?? null,
    mode_contract: modeContractForMetadata(modeContract),
    genre_expectation_context: genreExpectationContext,
    revise_queue_preflight: {
      version: REVISE_QUEUE_PREFLIGHT_GATE_VERSION,
      context_quality: contextQualityDecision.status,
      ledger_quality_report_source: contextQualityDecision.source,
      gate_ready_status: contextQualityDecision.gate_ready_status,
      degraded_layers: contextQualityDecision.degraded_layers,
      blocking_reasons: contextQualityDecision.blocking_reasons,
      summary: preflightSummary,
    },
    quality_manifest: qualityManifest,
    opportunity_source_authority: opportunitySourceAuthority,
    source_ued_hash: uedProjection?.sourceUedHash ?? null,
    ued_rendered_opportunity_count: uedProjection?.renderedOpportunityCount ?? null,
    ued_canonical_opportunity_count: uedProjection?.canonicalOpportunityCount ?? null,
    revise_source_mode: uedProjection?.sourceMode ?? null,
    opportunities,
  });

  const payload = {
    job_id: jobId,
    evaluation_project_id: jobRow.evaluation_project_id ?? null,
    manuscript_id: Number(jobRow.manuscript_id),
    manuscript_version_hash: `manuscript_${String(jobRow.manuscript_id)}_${jobId}`,
    artifact_id: artifactId,
    artifact_type: 'revision_opportunity_ledger_v1',
    artifact_version: 'v1',
    source_hash: sourceHash,
    generated_at: now,
    candidate_generation_status: candidateGenerationStatus,
    quality_manifest: qualityManifest,
    opportunity_source_authority: opportunitySourceAuthority,
    source_ued_hash: uedProjection?.sourceUedHash ?? null,
    ued_rendered_opportunity_count: uedProjection?.renderedOpportunityCount ?? null,
    ued_canonical_opportunity_count: uedProjection?.canonicalOpportunityCount ?? null,
    revise_source_mode: uedProjection?.sourceMode ?? null,
    mode_contract: modeContractForMetadata(modeContract),
    genre_expectation_context: genreExpectationContext,
    resolved_english_variant: resolvedEnglishVariantLabel(selectedEnglishVariant),
    revise_queue_preflight: {
      version: REVISE_QUEUE_PREFLIGHT_GATE_VERSION,
      context_quality: contextQualityDecision.status,
      ledger_quality_report_source: contextQualityDecision.source,
      gate_ready_status: contextQualityDecision.gate_ready_status,
      degraded_layers: contextQualityDecision.degraded_layers,
      blocking_reasons: contextQualityDecision.blocking_reasons,
      summary: preflightSummary,
    },
    opportunities,
  };

  const { data: upsertRows, error: upsertError } = await supabase
    .from('evaluation_artifacts')
    .upsert(
      {
        job_id: jobId,
        manuscript_id: Number(jobRow.manuscript_id),
        evaluation_project_id: jobRow.evaluation_project_id ?? null,
        artifact_type: 'revision_opportunity_ledger_v1',
        artifact_version: 'v1',
        source_hash: sourceHash,
        content: payload,
        created_at: now,
      },
      { onConflict: 'job_id,artifact_type', ignoreDuplicates: false },
    )
    .select('id')
    .limit(1);

  if (upsertError) {
    console.error('Failed to persist revision_opportunity_ledger_v1', upsertError);

    return {
      artifactId: typeof existingLedgerRow?.id === 'string' ? existingLedgerRow.id : null,
      opportunities,
    };
  }

  const persistedArtifactId =
    (Array.isArray(upsertRows) && typeof upsertRows[0]?.id === 'string')
      ? upsertRows[0].id
      : null;

  return {
    artifactId: persistedArtifactId,
    opportunities,
  };
}
