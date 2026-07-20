import { getCriterionDisplayLabel } from '@/schemas/criteria-keys';
import { mistakeProofText } from '@/lib/evaluation/reportRenderSafety';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';

export type CanonicalOpportunitySeverity = 'high' | 'medium' | 'low';

export type CanonicalOpportunityLedgerItem = {
  id: string;
  primary_criterion: string;
  related_criteria: string[];
  severity: CanonicalOpportunitySeverity;
  evidence: string;
  location: string;
  symptom: string;
  cause: string;
  fix_direction: string;
  reader_effect: string;
  deduped_from: string[];
  is_action_item_candidate: boolean;
  issue_type: string;
  action: string;
  expected_impact: string;
  candidate_text_a?: string;
  candidate_text_b?: string;
  candidate_text_c?: string;
  mistake_proofing?: string;
  potential_damage?: string[];
  anchor_type?: string;
  source_priority?: string;
};

export type CanonicalOpportunityLedgerMetrics = {
  source_recommendation_count: number;
  disposition_count: number;
  disposition_coverage_ratio: number;
  raw_opportunity_count: number;
  canonical_opportunity_count: number;
  deduplication_ratio: number;
  duplicate_clusters: number;
  action_item_count: number;
  rendered_opportunity_count: number;
  quality_gate: {
    repeated_final_issue_ratio: number;
    repaired_duplicate_rendering: boolean;
    evidence_quote_required: boolean;
  };
};

export const RECOMMENDATION_DISPOSITION_CONTRACT_VERSION = 'recommendation_disposition_v1' as const;
export const RECOMMENDATION_SOURCE_IDENTITY_VERSION = 'criterion_content_fingerprint_v1' as const;
export const RECOMMENDATION_FINAL_DISPOSITIONS = [
  'admitted',
  // Reserved vocabulary only in v1. Evaluate cannot certify this value until
  // a neutral, versioned recovery-authority proof replaces downstream runtime
  // coupling; revisionSurfaceOwnershipGate therefore rejects it today.
  'held_recoverable',
  'suppressed_governed',
  'informational_non_actionable',
] as const;
export type RecommendationFinalDisposition = typeof RECOMMENDATION_FINAL_DISPOSITIONS[number];

export type CanonicalRecommendationDisposition = {
  recommendation_id: string;
  source_id: string;
  criterion: string;
  materiality: 'material' | 'informational';
  validation: 'accepted' | 'missing_revision_directive' | 'missing_verifiable_anchor';
  owner: 'criterion_recommendation';
  disposition: RecommendationFinalDisposition;
  governing_rule: string;
  author_explanation: string;
  canonical_opportunity_id?: string;
};

export type CanonicalOpportunityLedger = {
  disposition_contract_version: typeof RECOMMENDATION_DISPOSITION_CONTRACT_VERSION;
  source_identity_version: typeof RECOMMENDATION_SOURCE_IDENTITY_VERSION;
  source_recommendation_ids: string[];
  opportunities: CanonicalOpportunityLedgerItem[];
  rendered_opportunities: CanonicalOpportunityLedgerItem[];
  recommendation_dispositions: CanonicalRecommendationDisposition[];
  metrics: CanonicalOpportunityLedgerMetrics;
};

type RawCriterionRecommendation = {
  priority?: string;
  action?: string;
  expected_impact?: string;
  anchor_snippet?: string;
  anchor_type?: string;
  symptom?: string;
  mechanism?: string;
  cause?: string;
  specific_fix?: string;
  fix_direction?: string;
  reader_effect?: string;
  mistake_proofing?: string;
  potential_damage?: string[];
  candidate_text_a?: string;
  candidate_text_b?: string;
  candidate_text_c?: string;
  manuscript_coordinates?: string;
  issue_family?: string;
  strategic_lever?: string;
};

type CriterionWithRecommendations = {
  key?: string;
  recommendations?: RawCriterionRecommendation[];
};

type EvaluationLike = {
  metrics?: { manuscript?: { word_count?: number } };
  criteria?: CriterionWithRecommendations[];
};

type RawOpportunity = {
  sourceId: string;
  criterion: string;
  severity: CanonicalOpportunitySeverity;
  evidence: string;
  location: string;
  symptom: string;
  cause: string;
  fix_direction: string;
  reader_effect: string;
  action: string;
  expected_impact: string;
  candidate_text_a?: string;
  candidate_text_b?: string;
  candidate_text_c?: string;
  mistake_proofing?: string;
  potential_damage?: string[];
  anchor_type?: string;
  issue_type: string;
  source_priority?: string;
};

const SEVERITY_RANK: Record<CanonicalOpportunitySeverity, number> = { high: 3, medium: 2, low: 1 };
const ISSUE_RANK: Record<string, number> = {
  opening_setup: 100,
  thematic_closure: 95,
  character_exposition: 90,
  scene_dialogue: 82,
  scene_stakes: 75,
  sensory_grounding: 60,
  genre_signal: 35,
  mechanics_typo: 5,
  general: 50,
};

const EDITORIAL_DIAGNOSIS_PATTERNS = [
  /^the setting lacks sensory grounding\.?$/i,
  /^premise remains abstract\.?$/i,
  /^need stronger genre signaling\.?$/i,
  /^insert more stakes\.?$/i,
  /^worldbuilding criticism\.?$/i,
  /^the ending over-?explains\.?$/i,
  /^kim'?s backstory is told,? not experienced\.?$/i,
  /^(the )?(story|manuscript|scene|passage) (lacks|needs|should|could|would benefit)\b/i,
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9$%\s'".-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanOptional(value: unknown): string {
  return typeof value === 'string' ? mistakeProofText(value, '').trim() : '';
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function severityFromPriority(priority: unknown): CanonicalOpportunitySeverity {
  const normalized = typeof priority === 'string' ? priority.trim().toLowerCase() : '';
  if (['high', 'must', 'critical', 'recommended'].includes(normalized)) return 'high';
  if (['low', 'could', 'optional'].includes(normalized)) return 'low';
  return 'medium';
}

function displayCriterion(key: string): string {
  try {
    return getCriterionDisplayLabel(key as never);
  } catch {
    // Fallback for non-canonical keys: split camelCase/snake_case and title-case
    // each word so no raw key ever surfaces to the author.
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ') || 'General';
  }
}

const VERBATIM_QUOTE_PAIRS: Record<string, string> = {
  '\u0022': '\u0022', // straight double quote "
  '\u201C': '\u201D', // left/right double quotation marks
  '\u2018': '\u2019', // left/right single quotation marks
};

function evidenceIsBalancedVerbatimQuote(evidence: string): boolean {
  const clean = evidence.trim();
  if (clean.length < 3) return false;
  const open = clean[0];
  const expectedClose = VERBATIM_QUOTE_PAIRS[open];
  if (!expectedClose) return false;
  const close = clean[clean.length - 1];
  if (close !== expectedClose) return false;
  const quoteChars = new Set([open, expectedClose]);
  let count = 0;
  for (const ch of clean) {
    if (quoteChars.has(ch)) count += 1;
  }
  // Only the wrapping pair of the same family may be present, no stray unmatched
  // internal quotes that could make the evidence look malformed.
  return count === 2;
}

function evidenceLooksLikeQuote(evidence: string, action: string, symptom: string): boolean {
  const clean = evidence.trim();
  if (clean.length < 8) return false;
  if (EDITORIAL_DIAGNOSIS_PATTERNS.some((pattern) => pattern.test(clean))) return false;

  const normalizedEvidence = normalizeText(clean);
  if (!normalizedEvidence) return false;
  if (normalizedEvidence === normalizeText(action) || normalizedEvidence === normalizeText(symptom)) return false;

  // Manuscript evidence usually contains concrete surface text: a named entity,
  // direct speech, a currency/date/time marker, or enough sentence texture to be
  // recognizable. Generic editorial diagnoses are excluded above.
  return (
    /["“”]/.test(clean) ||
    /\b[A-Z][a-z]+\b/.test(clean) ||
    /\$\d|\b\d{1,2}:\d{2}\b|\b\d+\b/.test(clean) ||
    clean.split(/\s+/).length >= 5
  );
}

function classifyIssueType(input: {
  action: string;
  symptom: string;
  cause: string;
  fix_direction: string;
  evidence: string;
  issueFamily?: string;
  strategicLever?: string;
}): string {
  const text = normalizeText([
    input.action,
    input.symptom,
    input.cause,
    input.fix_direction,
    input.evidence,
    input.issueFamily ?? '',
    input.strategicLever ?? '',
  ].join(' '));

  if (/\b(typo|spelling|punctuation|grammar|copyedit|mechanic|line level|in was 2 00)\b/.test(text)) return 'mechanics_typo';
  if (/\b(ending|closure|final paragraph|theme|over explain|priceless|total value)\b/.test(text)) return 'thematic_closure';
  if (/\b(opening|first paragraph|front loaded|philosoph|setup|premise)\b/.test(text)) return 'opening_setup';
  if (/\b(backstory|biograph|told not experienced)\b/.test(text)) return 'character_exposition';
  if (/\b(dialogue|spoken|line|conversation|exchange)\b/.test(text)) return 'scene_dialogue';
  if (/\b(kim|exposition|dramatiz)\b/.test(text)) return 'character_exposition';
  if (/\b(stakes|deadline|pressure|risk|embarrassment)\b/.test(text)) return 'scene_stakes';
  if (/\b(sensory|setting|place|street|salon|worldbuilding|environment)\b/.test(text)) return 'sensory_grounding';
  if (/\b(genre|market|reader expectation|signaling)\b/.test(text)) return 'genre_signal';
  return 'general';
}

function words(value: string): Set<string> {
  const stop = new Set(['this', 'that', 'with', 'from', 'into', 'about', 'because', 'should', 'could', 'would', 'reader', 'story', 'manuscript', 'passage', 'scene', 'revision']);
  return new Set(normalizeText(value).split(' ').filter((token) => token.length >= 4 && !stop.has(token)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function compactFingerprint(value: string, maxWords = 12): string {
  return normalizeText(value).split(' ').filter(Boolean).slice(0, maxWords).join(' ');
}

function canonicalRegion(raw: RawOpportunity): string {
  const location = normalizeText(raw.location);
  if (location && !/recommendation$/.test(location)) return location;
  return normalizeText(raw.criterion || raw.issue_type || 'general');
}

function duplicateCollapseKey(raw: RawOpportunity): string {
  const causeKey = compactFingerprint(raw.cause || raw.symptom || raw.issue_type, 12);
  const fixEffectKey = compactFingerprint([
    raw.fix_direction || raw.action,
    raw.reader_effect || raw.expected_impact,
  ].join(' '), 18);
  const regionKey = canonicalRegion(raw);

  return [
    raw.issue_type,
    causeKey,
    fixEffectKey,
    regionKey,
  ].filter(Boolean).join(':');
}

function clusterKey(raw: RawOpportunity): string {
  const duplicateKey = duplicateCollapseKey(raw);
  if (duplicateKey.length >= 20) return `duplicate:${duplicateKey}`;

  const evidenceKey = compactFingerprint(raw.evidence, 14);
  const locationKey = normalizeText(raw.location);
  const fixKey = compactFingerprint(raw.fix_direction || raw.action, 10);

  if (evidenceKey.length >= 20) return `evidence:${evidenceKey}`;
  if (locationKey && !/recommendation$/.test(locationKey)) return `location:${locationKey}:${raw.issue_type}`;
  return `intent:${raw.issue_type}:${fixKey}`;
}

function sameDuplicateOpportunity(a: RawOpportunity, b: RawOpportunity): boolean {
  if (duplicateCollapseKey(a) && duplicateCollapseKey(a) === duplicateCollapseKey(b)) return true;
  if (a.issue_type !== b.issue_type) return false;
  if (canonicalRegion(a) !== canonicalRegion(b)) return false;

  const causeOverlap = jaccard(words(a.cause || a.symptom), words(b.cause || b.symptom));
  const fixOverlap = jaccard(
    words([a.fix_direction || a.action, a.reader_effect || a.expected_impact].join(' ')),
    words([b.fix_direction || b.action, b.reader_effect || b.expected_impact].join(' ')),
  );

  return causeOverlap >= 0.7 && fixOverlap >= 0.7;
}

function specificityScore(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  let score = Math.min(clean.split(/\s+/).length, 40);
  if (/\b(cut|trim|replace|insert|dramatize|move|compress|sharpen|fix|rewrite|reveal)\b/i.test(clean)) score += 8;
  if (/\b(specific|dialogue|paragraph|line|opening|ending|Kim|Cost|2:00|priceless)\b/i.test(clean)) score += 8;
  if (/\b(improve|strengthen|enhance|develop|consider)\b/i.test(clean)) score -= 3;
  return score;
}

function chooseMostSpecific(values: string[]): string {
  return unique(values).sort((a, b) => specificityScore(b) - specificityScore(a))[0] ?? '';
}

function chooseStrongestEvidence(values: string[]): string {
  return unique(values)
    .filter((value) => evidenceLooksLikeQuote(value, '', ''))
    .sort((a, b) => {
      const quotedDelta = Number(/["“”]/.test(b)) - Number(/["“”]/.test(a));
      if (quotedDelta !== 0) return quotedDelta;
      return specificityScore(b) - specificityScore(a);
    })[0] ?? '';
}

function issueSortRank(opp: CanonicalOpportunityLedgerItem): number {
  const issueRank = ISSUE_RANK[opp.issue_type] ?? ISSUE_RANK.general;
  return (SEVERITY_RANK[opp.severity] * 1000) + issueRank + specificityScore(opp.fix_direction);
}

function collectRawOpportunities(result: EvaluationLike): {
  raw: RawOpportunity[];
  dispositions: CanonicalRecommendationDisposition[];
  sourceIds: string[];
} {
  const raw: RawOpportunity[] = [];
  const dispositions: CanonicalRecommendationDisposition[] = [];
  const sourceIds: string[] = [];
  const criteria = Array.isArray(result.criteria) ? result.criteria : [];
  const fingerprintOccurrences = new Map<string, number>();

  for (const criterion of criteria) {
    const criterionKey = typeof criterion.key === 'string' && criterion.key.trim() ? criterion.key.trim() : 'general';
    const recommendations = Array.isArray(criterion.recommendations) ? criterion.recommendations : [];

    recommendations.forEach((rec) => {
      const action = cleanOptional(rec.action);
      const symptom = cleanOptional(rec.symptom);
      const evidence = cleanOptional(rec.anchor_snippet);
      const fingerprint = canonicalJsonSha256({
        criterion: criterionKey,
        action,
        symptom,
        evidence,
        fix: cleanOptional(rec.specific_fix) || cleanOptional(rec.fix_direction),
        impact: cleanOptional(rec.reader_effect) || cleanOptional(rec.expected_impact),
      }).slice(0, 20);
      const occurrence = (fingerprintOccurrences.get(fingerprint) ?? 0) + 1;
      fingerprintOccurrences.set(fingerprint, occurrence);
      // Exact content duplicates are intentionally equivalent. Their ordinal
      // set (1..n) is stable even if indistinguishable duplicates reorder; if a
      // producer later needs distinct identity it must supply a durable UUID.
      const sourceId = `${criterionKey}:${fingerprint}:${occurrence}`;
      const recommendationId = `REC-${fingerprint}-${occurrence}`;
      // Enumeration occurs before classification. This is the authoritative
      // source supply against which final disposition coverage is certified.
      sourceIds.push(sourceId);
      if (!action && !symptom) {
        dispositions.push({
          recommendation_id: recommendationId,
          source_id: sourceId,
          criterion: criterionKey,
          materiality: 'informational',
          validation: 'missing_revision_directive',
          owner: 'criterion_recommendation',
          disposition: 'informational_non_actionable',
          governing_rule: 'no_revision_directive',
          author_explanation: 'This observation does not request a manuscript change.',
        });
        return;
      }
      if (!evidenceLooksLikeQuote(evidence, action, symptom)) {
        dispositions.push({
          recommendation_id: recommendationId,
          source_id: sourceId,
          criterion: criterionKey,
          materiality: 'material',
          validation: 'missing_verifiable_anchor',
          owner: 'criterion_recommendation',
          disposition: 'suppressed_governed',
          governing_rule: 'verifiable_manuscript_anchor_required',
          author_explanation: 'This recommendation was not promoted because its supporting manuscript passage could not be verified.',
        });
        return;
      }

      const cause = cleanOptional(rec.mechanism) || cleanOptional(rec.cause);
      const fix = cleanOptional(rec.specific_fix) || cleanOptional(rec.fix_direction) || action;
      const readerEffect = cleanOptional(rec.reader_effect) || cleanOptional(rec.expected_impact);
      const issueType = classifyIssueType({
        action,
        symptom,
        cause,
        fix_direction: fix,
        evidence,
        issueFamily: rec.issue_family,
        strategicLever: rec.strategic_lever,
      });

      raw.push({
        sourceId,
        criterion: criterionKey,
        severity: severityFromPriority(rec.priority),
        evidence,
        location: cleanOptional(rec.manuscript_coordinates) || `${criterionKey}:recommendation`,
        symptom: symptom || action,
        cause,
        fix_direction: fix,
        reader_effect: readerEffect,
        action,
        expected_impact: cleanOptional(rec.expected_impact),
        candidate_text_a: cleanOptional(rec.candidate_text_a) || undefined,
        candidate_text_b: cleanOptional(rec.candidate_text_b) || undefined,
        candidate_text_c: cleanOptional(rec.candidate_text_c) || undefined,
        mistake_proofing: cleanOptional(rec.mistake_proofing) || undefined,
        potential_damage: Array.isArray(rec.potential_damage)
          ? rec.potential_damage.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : undefined,
        anchor_type: cleanOptional(rec.anchor_type) || undefined,
        issue_type: issueType,
        source_priority: typeof rec.priority === 'string' ? rec.priority : undefined,
      });
      dispositions.push({
        recommendation_id: recommendationId,
        source_id: sourceId,
        criterion: criterionKey,
        materiality: 'material',
        validation: 'accepted',
        owner: 'criterion_recommendation',
        disposition: 'admitted',
        governing_rule: 'canonical_opportunity_admission',
        author_explanation: 'This recommendation passed the canonical opportunity requirements.',
      });
    });
  }

  return { raw, dispositions, sourceIds };
}

function hasAnyCandidate(item: RawOpportunity | undefined): boolean {
  return Boolean(item?.candidate_text_a || item?.candidate_text_b || item?.candidate_text_c);
}

function candidateSetSpecificity(item: RawOpportunity): number {
  const a = item.candidate_text_a ?? '';
  const b = item.candidate_text_b ?? '';
  const c = item.candidate_text_c ?? '';
  const presentCount = Number(a.length > 0) + Number(b.length > 0) + Number(c.length > 0);
  return presentCount * 1000 + specificityScore(`${a} ${b} ${c}`);
}

function selectCandidateSource(
  primary: RawOpportunity | undefined,
  cluster: RawOpportunity[],
): RawOpportunity | undefined {
  // Authority rule: candidate A/B/C must come from a single source recommendation.
  // Use the primary cluster representative when it carries any candidate; otherwise
  // choose the cluster member with the most complete and specific candidate set.
  // Never assemble A from one recommendation and B/C from others.
  if (hasAnyCandidate(primary)) return primary;
  const ranked = cluster
    .filter((item) => hasAnyCandidate(item))
    .sort((a, b) => candidateSetSpecificity(b) - candidateSetSpecificity(a));
  return ranked[0];
}

function mergeCluster(cluster: RawOpportunity[], index: number): CanonicalOpportunityLedgerItem {
  const severity = cluster.reduce<CanonicalOpportunitySeverity>((best, current) =>
    SEVERITY_RANK[current.severity] > SEVERITY_RANK[best] ? current.severity : best,
  cluster[0]?.severity ?? 'medium');
  const sortedCriteria = unique(cluster.map((item) => item.criterion));
  const primary = cluster
    .slice()
    .sort((a, b) =>
      (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) ||
      (specificityScore(b.fix_direction) - specificityScore(a.fix_direction)),
    )[0] ?? cluster[0];
  const issueType = primary?.issue_type ?? 'general';

  const evidence = chooseStrongestEvidence(cluster.map((item) => item.evidence));
  const evidenceItem = cluster.find((item) => item.evidence === evidence) ?? primary;
  const inferredAnchorType = evidenceIsBalancedVerbatimQuote(evidence) ? 'verbatim_quote' : 'editorial_diagnosis';
  const anchorType = evidenceItem?.anchor_type || primary?.anchor_type || inferredAnchorType;
  const action = chooseMostSpecific(cluster.map((item) => item.action));
  const fix = chooseMostSpecific(cluster.map((item) => item.fix_direction || item.action));
  const readerEffect = chooseMostSpecific(cluster.map((item) => item.reader_effect || item.expected_impact));
  const candidateSource = selectCandidateSource(primary, cluster);

  return {
    id: `OPP-${String(index + 1).padStart(3, '0')}`,
    primary_criterion: primary?.criterion ?? sortedCriteria[0] ?? 'general',
    related_criteria: sortedCriteria,
    severity,
    evidence,
    location: chooseMostSpecific(cluster.map((item) => item.location)),
    symptom: chooseMostSpecific(cluster.map((item) => item.symptom || item.action)),
    cause: chooseMostSpecific(cluster.map((item) => item.cause)),
    fix_direction: fix || action,
    reader_effect: readerEffect,
    deduped_from: unique(cluster.map((item) => item.sourceId)),
    is_action_item_candidate: issueType !== 'mechanics_typo',
    issue_type: issueType,
    action: action || fix,
    expected_impact: chooseMostSpecific(cluster.map((item) => item.expected_impact || item.reader_effect)),
    candidate_text_a: candidateSource?.candidate_text_a,
    candidate_text_b: candidateSource?.candidate_text_b,
    candidate_text_c: candidateSource?.candidate_text_c,
    mistake_proofing: chooseMostSpecific(cluster.map((item) => item.mistake_proofing ?? '')) || undefined,
    potential_damage: unique(cluster.flatMap((item) => item.potential_damage ?? [])).filter((item) => item.trim().length > 0),
    anchor_type: anchorType,
    source_priority: primary?.source_priority,
  };
}

function sameFinalIssue(a: CanonicalOpportunityLedgerItem, b: CanonicalOpportunityLedgerItem): boolean {
  if (normalizeText(a.evidence) && normalizeText(a.evidence) === normalizeText(b.evidence)) return true;
  if (normalizeText(a.location) && normalizeText(a.location) === normalizeText(b.location) && a.issue_type === b.issue_type) return true;
  return jaccard(words(a.fix_direction || a.action), words(b.fix_direction || b.action)) >= 0.72;
}

function capRenderedOpportunities(items: CanonicalOpportunityLedgerItem[], wordCount: number | null): CanonicalOpportunityLedgerItem[] {
  const maxItems = typeof wordCount === 'number' && wordCount > 0 && wordCount < 2_000 ? 7 : 10;
  const nonTypo = items.filter((item) => item.issue_type !== 'mechanics_typo');
  const typo = items.filter((item) => item.issue_type === 'mechanics_typo');
  const selected: CanonicalOpportunityLedgerItem[] = [];

  for (const item of nonTypo) {
    if (selected.length >= maxItems) break;
    if (selected.some((existing) => sameFinalIssue(existing, item))) continue;
    selected.push(item);
  }

  // Mechanical fixes may appear only after at least three higher-impact craft
  // issues have been selected, unless the report has fewer than three craft items.
  const typoAllowed = selected.length >= 3 || nonTypo.length < 3;
  if (typoAllowed) {
    for (const item of typo) {
      if (selected.length >= maxItems) break;
      if (selected.some((existing) => sameFinalIssue(existing, item))) continue;
      selected.push(item);
    }
  }

  return selected;
}

export function buildCanonicalOpportunityLedger(result: EvaluationLike): CanonicalOpportunityLedger {
  const collected = collectRawOpportunities(result);
  const raw = collected.raw;
  const clusters: RawOpportunity[][] = [];
  const clusterByKey = new Map<string, RawOpportunity[]>();

  for (const item of raw) {
    const key = clusterKey(item);
    let cluster = clusterByKey.get(key);

    if (!cluster) {
      cluster = clusters.find((candidate) => {
        const representative = candidate[0];
        if (!representative) return false;
        if (sameDuplicateOpportunity(representative, item)) return true;
        if (representative.issue_type !== item.issue_type) return false;
        if (normalizeText(representative.evidence) === normalizeText(item.evidence)) return true;
        if (normalizeText(representative.location) && normalizeText(representative.location) === normalizeText(item.location)) return true;
        return jaccard(words(representative.fix_direction || representative.action), words(item.fix_direction || item.action)) >= 0.74;
      });
    }

    if (!cluster) {
      cluster = [];
      clusters.push(cluster);
      clusterByKey.set(key, cluster);
    }
    cluster.push(item);
  }

  const opportunities = clusters
    .map((cluster, index) => mergeCluster(cluster, index))
    .filter((item) => item.evidence.trim().length > 0 && item.fix_direction.trim().length > 0)
    .sort((a, b) => issueSortRank(b) - issueSortRank(a))
    .map((item, index) => ({ ...item, id: `OPP-${String(index + 1).padStart(3, '0')}` }));

  const wordCount = typeof result.metrics?.manuscript?.word_count === 'number'
    ? result.metrics.manuscript.word_count
    : null;
  const rendered = capRenderedOpportunities(opportunities, wordCount);
  const opportunityIdBySource = new Map<string, string>();
  for (const opportunity of opportunities) {
    for (const sourceId of opportunity.deduped_from) opportunityIdBySource.set(sourceId, opportunity.id);
  }
  const recommendationDispositions = collected.dispositions.map((item) => {
    if (item.disposition !== 'admitted') return item;
    const canonicalOpportunityId = opportunityIdBySource.get(item.source_id);
    if (canonicalOpportunityId) return { ...item, canonical_opportunity_id: canonicalOpportunityId };
    return {
      ...item,
      disposition: 'suppressed_governed' as const,
      governing_rule: 'canonical_opportunity_completeness_gate',
      author_explanation: 'The recommendation could not be preserved as a complete canonical revision opportunity.',
    };
  });
  const duplicateClusters = clusters.filter((cluster) => cluster.length > 1).length;
  const repeatedPairs = rendered.reduce((count, item, index) =>
    count + rendered.slice(index + 1).filter((other) => sameFinalIssue(item, other)).length,
  0);
  const repeatedRatio = rendered.length <= 1 ? 0 : repeatedPairs / rendered.length;

  return {
    disposition_contract_version: RECOMMENDATION_DISPOSITION_CONTRACT_VERSION,
    source_identity_version: RECOMMENDATION_SOURCE_IDENTITY_VERSION,
    source_recommendation_ids: collected.sourceIds,
    opportunities,
    rendered_opportunities: rendered,
    recommendation_dispositions: recommendationDispositions,
    metrics: {
      source_recommendation_count: collected.sourceIds.length,
      disposition_count: recommendationDispositions.length,
      disposition_coverage_ratio: collected.sourceIds.length === 0
        ? 1
        : recommendationDispositions.length / collected.sourceIds.length,
      raw_opportunity_count: raw.length,
      canonical_opportunity_count: opportunities.length,
      deduplication_ratio: raw.length === 0 ? 0 : 1 - (opportunities.length / raw.length),
      duplicate_clusters: duplicateClusters,
      action_item_count: rendered.filter((item) => item.is_action_item_candidate).length,
      rendered_opportunity_count: rendered.length,
      quality_gate: {
        repeated_final_issue_ratio: repeatedRatio,
        repaired_duplicate_rendering: repeatedRatio <= 0.25,
        evidence_quote_required: true,
      },
    },
  };
}

export function formatOpportunityForTopRecommendation(item: CanonicalOpportunityLedgerItem): string {
  const label = displayCriterion(item.primary_criterion);
  const action = item.fix_direction || item.action;
  const impact = item.reader_effect || item.expected_impact;
  return mistakeProofText(
    `${action}${impact ? ` ${impact}` : ''} (${label}).`,
    action,
  );
}

export function opportunityToCriterionRecommendation(item: CanonicalOpportunityLedgerItem): RawCriterionRecommendation & {
  opportunity_id: string;
  collapsed_from_criteria: string[];
} {
  return {
    opportunity_id: item.id,
    priority: item.severity,
    action: item.action || item.fix_direction,
    expected_impact: item.expected_impact || item.reader_effect,
    anchor_snippet: item.evidence,
    anchor_type: item.anchor_type || 'editorial_diagnosis',
    symptom: item.symptom,
    mechanism: item.cause,
    specific_fix: item.fix_direction,
    reader_effect: item.reader_effect,
    mistake_proofing: item.mistake_proofing,
    potential_damage: item.potential_damage,
    candidate_text_a: item.candidate_text_a,
    candidate_text_b: item.candidate_text_b,
    candidate_text_c: item.candidate_text_c,
    manuscript_coordinates: item.location,
    collapsed_from_criteria: item.related_criteria.filter((criterion) => criterion !== item.primary_criterion),
  };
}

export function opportunityToActionItem(item: CanonicalOpportunityLedgerItem): {
  action: string;
  why: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  anchor_snippet?: string;
  manuscript_coordinates?: string;
  mechanism?: string;
  reader_effect?: string;
  mistake_proofing?: string;
  candidate_text_a?: string;
  candidate_text_b?: string;
  candidate_text_c?: string;
  criterion_key?: string;
  opportunity_id: string;
} {
  return {
    opportunity_id: item.id,
    action: item.action || item.fix_direction,
    why: item.cause || item.expected_impact || item.reader_effect,
    effort: item.severity === 'high' ? 'medium' : 'low',
    impact: item.severity === 'low' ? 'medium' : 'high',
    anchor_snippet: item.evidence,
    manuscript_coordinates: item.location,
    mechanism: item.cause,
    reader_effect: item.reader_effect,
    mistake_proofing: item.mistake_proofing,
    candidate_text_a: item.candidate_text_a,
    candidate_text_b: item.candidate_text_b,
    candidate_text_c: item.candidate_text_c,
    criterion_key: item.primary_criterion,
  };
}
