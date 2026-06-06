import { createHash, randomUUID } from 'crypto';
import {
  REVISION_OPERATIONS,
  candidateTextIsCopyPasteReady,
  inferRevisionOperation,
  type RevisionOperation,
} from './reviseCardContract';
import { type SlaeGroundingStatus } from './slae';

type LedgerSeverity = 'must' | 'should' | 'could';
type LedgerConfidence = 'low' | 'medium' | 'high';

type RevisionOpportunity = {
  opportunity_id: string;
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
  symptom?: string;
  cause?: string;
  fix_direction?: string;
  reader_effect?: string;
  mistake_proofing?: string;
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
    b: normalizeProseSentence(`${leadName} held still long enough for the choice to register, and the moment tightened around it.`),
    c: normalizeProseSentence(`${leadName} knew it before anyone said it, and that weight was enough to keep the air still.`),
  }, seed);
}

function buildInsertionCandidates(input: CandidateBuildInput): { a: string; b: string; c: string } {
  const anchor = stripEvidenceWrapper(input.anchor);
  const leadName = extractLeadName(`${input.rationale} ${input.action ?? ''} ${anchor}`) || 'He';
  const secondName = extractLeadName(anchor.replace(new RegExp(`\\b${escapeRegExp(leadName)}\\b`, 'g'), '')) || 'the others';
  const quoted = extractQuotedSpan(anchor);
  const seed = quoted ? `${leadName} heard the words again: ${quoteSpeech(quoted)}` : `${leadName} paused inside the pressure of the moment.`;

  return ensureDistinctCandidates({
    a: normalizeProseSentence(`${leadName} hesitated, and the small delay told ${secondName} more than he meant to reveal.`),
    b: normalizeProseSentence(`${seed} This time, the answer stayed in his body before it reached his mouth.`),
    c: normalizeProseSentence(`${leadName} looked away first, and that was enough for the moment to claim its price.`),
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

    const criterion = normalizeCriterion(criterionRow.key ?? criterionRow.criterion_key);
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
        cause: normalizeOptionalText(recommendationRow.cause),
        fix_direction: normalizeOptionalText(recommendationRow.fix_direction),
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
      cause: normalizeOptionalText(recommendationRow.cause),
      fix_direction: normalizeOptionalText(recommendationRow.fix_direction),
      reader_effect: normalizeOptionalText(recommendationRow.reader_effect),
      mistake_proofing: normalizeOptionalText(recommendationRow.mistake_proofing),
    }));
  }

  return opportunities;
}

const MAX_OPPORTUNITIES_SHORT_FORM = 50;
const MAX_OPPORTUNITIES_LONG_FORM = 100;
const LONG_FORM_WORD_THRESHOLD = 25_000;

const SEVERITY_RANK: Record<string, number> = { must: 0, should: 1, could: 2 };

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

      const criterion = normalizeCriterion(criterionRow.key ?? criterionRow.criterion_key);
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
          cause: normalizeOptionalText(rec.cause),
          fix_direction: normalizeOptionalText(rec.fix_direction),
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

  // Enforce 50 for short-form (<25k words), 100 for long-form (≥25k words)
  const maxOpportunities = (options?.wordCount ?? 0) >= LONG_FORM_WORD_THRESHOLD
    ? MAX_OPPORTUNITIES_LONG_FORM
    : MAX_OPPORTUNITIES_SHORT_FORM;

  if (all.length <= maxOpportunities) return all;

  all.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3));
  return all.slice(0, maxOpportunities);
}

async function persistHealedExistingLedger(input: {
  supabase: any;
  rowId: string | null;
  currentContent: unknown;
  opportunities: RevisionOpportunity[];
}): Promise<void> {
  if (!input.rowId || !isRecord(input.currentContent)) return;

  const existing = input.currentContent.opportunities;
  if (stableStringify(existing) === stableStringify(input.opportunities)) return;

  await input.supabase
    .from('evaluation_artifacts')
    .update({
      content: {
        ...input.currentContent,
        opportunities: input.opportunities,
        candidate_generation_status: 'backend_filled_abc_v1',
        candidate_generation_updated_at: new Date().toISOString(),
      },
    })
    .eq('id', input.rowId);
}

export async function ensureRevisionOpportunityLedgerArtifact(supabase: any, jobId: string): Promise<EnsureLedgerResult> {
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

  const existingLedgerFullyEnriched =
    isRecord(existingLedgerRow?.content) &&
    typeof existingLedgerRow.content.candidate_generation_status === 'string' &&
    existingLedgerRow.content.candidate_generation_status.includes('longform_enriched');

  if (existingOpportunities && existingOpportunities.length > 0 && existingLedgerFullyEnriched) {
    const healed = existingOpportunities.map(ensureOpportunityCandidates);
    await persistHealedExistingLedger({
      supabase,
      rowId: typeof existingLedgerRow?.id === 'string' ? existingLedgerRow.id : null,
      currentContent: existingLedgerRow?.content,
      opportunities: healed,
    });

    return {
      artifactId: typeof existingLedgerRow?.id === 'string' ? existingLedgerRow.id : null,
      opportunities: healed,
    };
  }

  const { data: jobRow, error: jobReadError } = await supabase
    .from('evaluation_jobs')
    .select('id, manuscript_id, evaluation_project_id, evaluation_result')
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
      : 0;

  const opportunities = buildRevisionOpportunitiesFromEvaluationPayload(
    evaluationPayload, chunkCachePayload, longformPayload, { wordCount },
  );

  if (existingOpportunities && existingOpportunities.length === 0 && opportunities.length === 0) {
    return {
      artifactId: typeof existingLedgerRow?.id === 'string' ? existingLedgerRow.id : null,
      opportunities: existingOpportunities,
    };
  }

  const now = new Date().toISOString();
  const artifactId = `revision_opportunity_ledger_v1:${randomUUID().slice(0, 16)}`;
  const sourceHash = sourceHashFor({
    job_id: jobId,
    evaluation_source_hash: evaluationResultRow.source_hash ?? null,
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
    candidate_generation_status: longformPayload
      ? 'backend_filled_abc_v1_chunk_enriched_longform_enriched'
      : chunkCachePayload
        ? 'backend_filled_abc_v1_chunk_enriched'
        : 'backend_filled_abc_v1',
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
    throw new Error(`Failed to persist revision_opportunity_ledger_v1: ${upsertError.message}`);
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
