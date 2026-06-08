/**
 * Candidate Quality Gate — RevisionGrade
 *
 * Supports two call sites:
 * - reviseAdmissionGate object-based candidate evaluation
 * - revision opportunity ledger string-based A/B/C quality evaluation
 *
 * Privacy contract: only reason codes are emitted. No prose is exposed in
 * telemetry/analytics.
 */

export type CandidateKey = 'A' | 'B' | 'C';

export type CandidateQualityReason =
  | 'EMPTY_CANDIDATE'
  | 'TOO_SHORT'
  | 'GENERIC_PROSE'
  | 'NON_EXECUTABLE_PROSE'
  | 'NOT_EXECUTABLE'
  | 'ANCHOR_ECHO'
  | 'UNSUPPORTED_FACT'
  | 'CONTEXT_MISMATCH'
  | 'VOICE_DRIFT'
  | 'CANON_DRIFT'
  | 'REVISION_QUALITY_FAILED';

export interface CandidateQualityInput {
  key: CandidateKey;
  text: string | null | undefined;
  anchor?: string | null;
  beforeContext?: string | null;
  afterContext?: string | null;
  voiceFingerprint?: string[];
  knownEntities?: string[];
  allowedNewEntities?: string[];
}

export interface AdmissionCandidateQualityResult {
  key: CandidateKey;
  passed: boolean;
  reasons: CandidateQualityReason[];
  score: number;
}

export interface AdmissionCardQualityResult {
  passed: boolean;
  passedCandidateCount: number;
  candidateResults: AdmissionCandidateQualityResult[];
  reasons: CandidateQualityReason[];
}

const GENERIC_PATTERNS = [
  /\bthe silence stretched\b/i,
  /\bthe air (grew heavy|went still)\b/i,
  /\bsomething shifted\b/i,
  /\bthe room seemed smaller\b/i,
  /\bthe moment (settled|tightened|claimed its price)\b/i,
  /\bhe looked away first\b/i,
  /\bthe weight settled\b/i,
];

const COMMENTARY_PATTERNS = [
  /^here(?:'s| is) (?:a|the) (?:revision|rewrite)/i,
  /\bthis revision\b/i,
  /\bthe passage should\b/i,
  /\bconsider (?:changing|adding|removing)\b/i,
  /\bto improve this\b/i,
  /\bas an ai\b/i,
];

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function wordCount(value: string): number {
  return normalize(value).split(' ').filter(Boolean).length;
}

function similarityRatio(a: string, b: string): number {
  const aw = new Set(normalize(a).toLowerCase().split(/\W+/).filter(Boolean));
  const bw = new Set(normalize(b).toLowerCase().split(/\W+/).filter(Boolean));
  if (aw.size === 0 || bw.size === 0) return 0;
  let overlap = 0;
  for (const token of aw) if (bw.has(token)) overlap += 1;
  return overlap / Math.min(aw.size, bw.size);
}

function candidateLooksGeneric(text: string): boolean {
  return GENERIC_PATTERNS.some((pattern) => pattern.test(text));
}

function candidateLooksLikeCommentary(text: string): boolean {
  return COMMENTARY_PATTERNS.some((pattern) => pattern.test(text));
}

function hasUnsupportedEntity(input: CandidateQualityInput, text: string): boolean {
  const known = new Set([...(input.knownEntities ?? []), ...(input.allowedNewEntities ?? [])].map((x) => x.toLowerCase()));
  if (known.size === 0) return false;
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
  return properNouns.some((name) => !known.has(name.toLowerCase()));
}

function evaluateAdmissionCandidateQuality(input: CandidateQualityInput): AdmissionCandidateQualityResult {
  const text = normalize(input.text);
  const reasons: CandidateQualityReason[] = [];

  if (!text) reasons.push('EMPTY_CANDIDATE');
  if (text && wordCount(text) < 8) reasons.push('TOO_SHORT');
  if (candidateLooksGeneric(text)) reasons.push('GENERIC_PROSE');
  if (candidateLooksLikeCommentary(text)) reasons.push('NON_EXECUTABLE_PROSE');
  if (/\[[^\]]+\]|\bINSERT\b|\bLOCATION\b|\bTODO\b/i.test(text)) reasons.push('NOT_EXECUTABLE');
  if (input.anchor && similarityRatio(text, input.anchor) > 0.82) reasons.push('ANCHOR_ECHO');
  if (hasUnsupportedEntity(input, text)) reasons.push('UNSUPPORTED_FACT');

  const before = normalize(input.beforeContext);
  const after = normalize(input.afterContext);
  if ((before || after) && text.length > 0) {
    const contextSimilarity = Math.max(similarityRatio(text, before), similarityRatio(text, after));
    if (contextSimilarity < 0.03 && wordCount(text) > 25) reasons.push('CONTEXT_MISMATCH');
  }

  const score = Math.max(0, 5 - reasons.length);
  return { key: input.key, passed: reasons.length === 0, reasons, score };
}

export function evaluateCardCandidateQuality(candidates: CandidateQualityInput[]): AdmissionCardQualityResult {
  const candidateResults = candidates.map(evaluateAdmissionCandidateQuality);
  const passedCandidateCount = candidateResults.filter((result) => result.passed).length;
  const reasons = Array.from(new Set(candidateResults.flatMap((result) => result.reasons)));

  return {
    passed: passedCandidateCount >= 2,
    passedCandidateCount,
    candidateResults,
    reasons: passedCandidateCount >= 2 ? [] : [...reasons, 'REVISION_QUALITY_FAILED'],
  };
}

// ── Ledger quality API ────────────────────────────────────────────────────────

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

function isNotCopyReady(text: string): boolean {
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

function evaluateLedgerCandidateQuality(
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

export function evaluateCandidateQuality(input: CandidateQualityInput): AdmissionCandidateQualityResult;
export function evaluateCandidateQuality(candidate: string, anchor: string, rationale: string): CandidateQualityReasonCode[];
export function evaluateCandidateQuality(
  inputOrCandidate: CandidateQualityInput | string,
  anchor?: string,
  rationale?: string,
): AdmissionCandidateQualityResult | CandidateQualityReasonCode[] {
  if (typeof inputOrCandidate === 'string') {
    return evaluateLedgerCandidateQuality(inputOrCandidate, anchor ?? '', rationale ?? '');
  }
  return evaluateAdmissionCandidateQuality(inputOrCandidate);
}

export type LedgerCardQualityResult =
  | { pass: true; passingCount: number }
  | { pass: false; passingCount: number; reasons: CandidateQualityReasonCode[] };

export function evaluateCardQuality(
  candidateA: string,
  candidateB: string,
  candidateC: string,
  anchor: string,
  rationale: string,
): LedgerCardQualityResult {
  if (!candidateA || !candidateB || !candidateC) {
    return { pass: false, passingCount: 0, reasons: ['candidate_quality_not_copy_ready'] };
  }

  const resultsPerCandidate = [
    evaluateLedgerCandidateQuality(candidateA, anchor, rationale),
    evaluateLedgerCandidateQuality(candidateB, anchor, rationale),
    evaluateLedgerCandidateQuality(candidateC, anchor, rationale),
  ];

  const passingCount = resultsPerCandidate.filter((reasons) => reasons.length === 0).length;

  if (passingCount >= 2) {
    return { pass: true, passingCount };
  }

  const mergedReasons = [...new Set(resultsPerCandidate.flat())] as CandidateQualityReasonCode[];
  return { pass: false, passingCount, reasons: mergedReasons };
}
