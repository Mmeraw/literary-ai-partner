/**
 * Candidate Quality Gate — RevisionGrade
 *
 * Determines whether A/B/C prose candidates are good enough to show a paying author.
 * A card is quality-passed when at least 2 of 3 candidates pass all quality checks.
 *
 * Rules are intentionally conservative. Generic advice, canned literary filler,
 * editorial summaries, voice-mismatch prose, and unsupported facts all fail here.
 *
 * Privacy contract:
 * - Only reason codes are emitted. No prose is exposed in telemetry/analytics.
 */

// ── Shared helpers ─────────────────────────────────────────────────────────────

function normalizeForQuality(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentTokenSet(raw: string): Set<string> {
  const stop = new Set([
    'about', 'after', 'again', 'against', 'before', 'being', 'between', 'could', 'every', 'from',
    'have', 'into', 'more', 'should', 'that', 'their', 'there', 'these', 'this', 'those',
    'through', 'with', 'would', 'while', 'where', 'which', 'when', 'what', 'will',
    'without', 'within', 'because', 'passage', 'selected', 'revision',
  ]);
  return new Set(
    normalizeForQuality(raw)
      .split(' ')
      .filter((token) => token.length >= 4 && !stop.has(token)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

function overlapRatio(a: string, b: string): number {
  const aTokens = contentTokenSet(a);
  const bTokens = contentTokenSet(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap / Math.min(aTokens.size, bTokens.size);
}

// ── Individual quality checks ──────────────────────────────────────────────────

function isNotCopyReady(text: string): boolean {
  // Must contain at least one alphabetic character and be non-trivial
  return !/[a-zA-Z]{3,}/.test(text) || text.trim().length < 20;
}

function isTooShort(text: string): boolean {
  return text.split(/\s+/).filter(Boolean).length < 8;
}

function isGenericAdvice(text: string): boolean {
  return (
    /\b(should|needs to|must|try to|consider|revise|rewrite|replace|insert|add|improve|clarify|strengthen|tighten)\b/i.test(text) ||
    /\b(this (passage|scene|paragraph|section)|the reader|narrative|manuscript|revision)\b/i.test(text)
  );
}

function isSummaryNotProse(text: string): boolean {
  return (
    /\b(this (shows|demonstrates|indicates|suggests)|the scene (shows|demonstrates|indicates)|the passage (shows|demonstrates|indicates))\b/i.test(text) ||
    /\b(summary|in summary|overall|ultimately)\b/i.test(text)
  );
}

function isStilted(text: string): boolean {
  if (/\b(very\s+very|really\s+really|just\s+just)\b/i.test(text)) return true;
  if (/[,;:]{2,}|\.{3,}/.test(text)) return true;
  return false;
}

function isRepetitive(text: string): boolean {
  const tokens = normalizeForQuality(text).split(' ').filter((token) => token.length >= 3);
  if (tokens.length < 10) return false;
  const unique = new Set(tokens);
  return unique.size / tokens.length < 0.45;
}

function hasHighAnchorOverlap(candidate: string, anchor: string): boolean {
  return overlapRatio(candidate, anchor) >= 0.82;
}

function isGenericLiteraryFiller(text: string): boolean {
  return /\b(moment (?:tightened|claimed|held|shifted)|air (?:still|tightened|changed)|weight (?:settled|registered)|looked away first|hesitated,? and|small delay told|pressure of the moment|kept the air still|moment to claim its price)\b/i.test(text);
}

function introducesUnsupportedFacts(candidate: string, anchor: string): boolean {
  const anchorTokens = contentTokenSet(anchor);
  const candidateNumbers = candidate.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) ?? [];
  const anchorNumbers = new Set(anchor.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) ?? []);
  if (candidateNumbers.some((num) => !anchorNumbers.has(num))) return true;

  const candidateNames = (candidate.match(/\b[A-Z][a-zA-Z'\u2019-]{2,}\b/g) ?? []).map((n) => n.toLowerCase());
  const anchorNames = new Set((anchor.match(/\b[A-Z][a-zA-Z'\u2019-]{2,}\b/g) ?? []).map((n) => n.toLowerCase()));
  let unseenNames = 0;
  for (const name of candidateNames) {
    if (!anchorNames.has(name) && !anchorTokens.has(name)) {
      unseenNames++;
    }
  }
  return unseenNames >= 2;
}

function isVoiceMismatch(text: string): boolean {
  return /\b(reader|narrative|theme|arc|stakes|craft|manuscript|criterion|diagnostic)\b/i.test(text);
}

function lacksContextFit(candidate: string, anchor: string, rationale: string): boolean {
  const candidateTokens = contentTokenSet(candidate);
  if (candidateTokens.size === 0) return true;
  const anchorOverlap = jaccardSimilarity(candidateTokens, contentTokenSet(anchor));
  const rationaleOverlap = jaccardSimilarity(candidateTokens, contentTokenSet(rationale));
  return anchorOverlap < 0.05 && rationaleOverlap < 0.05;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Reason codes emitted when a candidate fails quality.
 * These are privacy-safe identifiers — never prose strings.
 */
export type CandidateQualityReasonCode =
  | 'candidate_quality_not_copy_ready'
  | 'candidate_quality_too_short'
  | 'candidate_quality_generic'
  | 'candidate_quality_summary'
  | 'candidate_quality_stilted'
  | 'candidate_quality_repetitive'
  | 'candidate_quality_anchor_overlap'
  | 'candidate_quality_generic_filler'
  | 'candidate_quality_unsupported_facts'
  | 'candidate_quality_voice_mismatch'
  | 'candidate_quality_context_mismatch';

/**
 * Evaluate a single candidate string against all quality rules.
 * Returns an array of reason codes. Empty array = candidate passes.
 */
export function evaluateCandidateQuality(
  candidate: string,
  anchor: string,
  rationale: string,
): CandidateQualityReasonCode[] {
  const reasons: CandidateQualityReasonCode[] = [];

  if (isNotCopyReady(candidate)) reasons.push('candidate_quality_not_copy_ready');
  if (isTooShort(candidate)) reasons.push('candidate_quality_too_short');
  if (isGenericAdvice(candidate)) reasons.push('candidate_quality_generic');
  if (isSummaryNotProse(candidate)) reasons.push('candidate_quality_summary');
  if (isStilted(candidate)) reasons.push('candidate_quality_stilted');
  if (isRepetitive(candidate)) reasons.push('candidate_quality_repetitive');
  if (hasHighAnchorOverlap(candidate, anchor)) reasons.push('candidate_quality_anchor_overlap');
  if (isGenericLiteraryFiller(candidate)) reasons.push('candidate_quality_generic_filler');
  if (introducesUnsupportedFacts(candidate, anchor)) reasons.push('candidate_quality_unsupported_facts');
  if (isVoiceMismatch(candidate)) reasons.push('candidate_quality_voice_mismatch');
  if (lacksContextFit(candidate, anchor, rationale)) reasons.push('candidate_quality_context_mismatch');

  return [...new Set(reasons)];
}

export type CardQualityResult =
  | { pass: true; passingCount: number }
  | { pass: false; passingCount: number; reasons: CandidateQualityReasonCode[] };

/**
 * Evaluate all three candidates for a revision card.
 * A card passes if at least 2 of 3 candidates pass all quality checks.
 * Returns reason codes merged across failing candidates only.
 */
export function evaluateCardQuality(
  candidateA: string,
  candidateB: string,
  candidateC: string,
  anchor: string,
  rationale: string,
): CardQualityResult {
  // If any candidate is absent, not enough prose to evaluate
  if (!candidateA || !candidateB || !candidateC) {
    return { pass: false, passingCount: 0, reasons: ['candidate_quality_not_copy_ready'] };
  }

  const resultsPerCandidate = [
    evaluateCandidateQuality(candidateA, anchor, rationale),
    evaluateCandidateQuality(candidateB, anchor, rationale),
    evaluateCandidateQuality(candidateC, anchor, rationale),
  ];

  const passingCount = resultsPerCandidate.filter((reasons) => reasons.length === 0).length;

  if (passingCount >= 2) {
    return { pass: true, passingCount };
  }

  const mergedReasons = [...new Set(resultsPerCandidate.flat())] as CandidateQualityReasonCode[];
  return { pass: false, passingCount, reasons: mergedReasons };
}
