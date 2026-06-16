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
  /\bmoment to claim its price\b/i,
  /\bhe looked away first\b/i,
  /\bthe weight settled\b/i,
  /\bhesitated,? and\b/i,
  /\bsmall delay told\b/i,
  /\bpressure (?:no one else had to name|of the moment)\b/i,
  /\bchoice land before\b/i,
  /^\s*after\s+(?:hesitated|looked|waited|paused)\b/i,
];

const COMMENTARY_PATTERNS = [
  /^here(?:'s| is) (?:a|the) (?:revision|rewrite)/i,
  /\bthis revision\b/i,
  /\bthe passage should\b/i,
  /\bconsider (?:changing|adding|removing)\b/i,
  /\bto improve this\b/i,
  /\bas an ai\b/i,
  // Editorial meta-language: the candidate tells the author what to do
  // instead of providing executable prose
  /\bthe reader (?:would|will|could|should|needs? to)\b/i,
  /\bthis scene should\b/i,
  /\bthe passage would be (?:stronger|better|improved)\b/i,
  /\bthe author (?:should|could|would|needs? to)\b/i,
  /\bwould benefit from\b/i,
  /\bit would be beneficial to\b/i,
  /\ba revision here could\b/i,
  /\bone might (?:improve|strengthen|enhance|consider)\b/i,
  /\bshowed? rather than (?:told|telling)\b/i,
  /\b(?:should|could) be expanded\b/i,
  /\b(?:needs?|lacks?|is missing) (?:an? )?(?:emotional|narrative|structural)\b/i,
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
  const properNouns: string[] = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
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

export const LEDGER_MIN_CONTEXT_JACCARD = 0.03;

const UNIT_NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

const TEEN_NUMBER_WORDS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS_NUMBER_WORDS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALE_NUMBER_WORDS = new Set(['hundred', 'thousand']);
const ALL_NUMBER_WORDS = new Set([
  ...Object.keys(UNIT_NUMBER_WORDS),
  ...Object.keys(TEEN_NUMBER_WORDS),
  ...Object.keys(TENS_NUMBER_WORDS),
  ...SCALE_NUMBER_WORDS,
]);

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

const SPELLED_NUMBER_PATTERN = /\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\s](?:one|two|three|four|five|six|seven|eight|nine))?\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s+(?:hundred|thousand|million|billion)(?:\s+(?:and\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))?\b/gi;

function extractSpelledNumberPhrases(text: string): Set<string> {
  const matches = text.match(SPELLED_NUMBER_PATTERN) ?? [];
  return new Set(
    matches
      .map((value) => value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  );
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

function numericDigitFacts(raw: string): Set<string> {
  return new Set((raw.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) ?? []).map((num) => num.replace(/,/g, '')));
}

function writtenNumberValue(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let sawNumber = false;

  for (const token of tokens) {
    if (token in UNIT_NUMBER_WORDS) {
      current += UNIT_NUMBER_WORDS[token]!;
      sawNumber = true;
      continue;
    }
    if (token in TEEN_NUMBER_WORDS) {
      current += TEEN_NUMBER_WORDS[token]!;
      sawNumber = true;
      continue;
    }
    if (token in TENS_NUMBER_WORDS) {
      current += TENS_NUMBER_WORDS[token]!;
      sawNumber = true;
      continue;
    }
    if (token === 'hundred') {
      current = (current || 1) * 100;
      sawNumber = true;
      continue;
    }
    if (token === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      sawNumber = true;
      continue;
    }
    return null;
  }

  return sawNumber ? total + current : null;
}

function writtenNumberQualifies(tokens: string[]): boolean {
  if (tokens.length > 1) return true;
  const [token] = tokens;
  if (!token) return false;
  return token in TEEN_NUMBER_WORDS || token in TENS_NUMBER_WORDS || SCALE_NUMBER_WORDS.has(token);
}

function writtenNumberFacts(raw: string): Set<string> {
  const tokens = raw
    .toLowerCase()
    .replace(/[\u2010-\u2015-]/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const facts = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    if (!ALL_NUMBER_WORDS.has(tokens[i]!)) continue;
    const phrase: string[] = [];
    let j = i;
    while (j < tokens.length && ALL_NUMBER_WORDS.has(tokens[j]!)) {
      phrase.push(tokens[j]!);
      j += 1;
    }
    if (writtenNumberQualifies(phrase)) {
      const value = writtenNumberValue(phrase);
      if (value !== null) facts.add(String(value));
    }
    i = Math.max(i, j - 1);
  }
  return facts;
}

function numericFacts(raw: string): Set<string> {
  return new Set([...numericDigitFacts(raw), ...writtenNumberFacts(raw)]);
}

function introducesUnsupportedFacts(candidate: string, anchor: string): boolean {
  const anchorTokens = contentTokenSet(anchor);
  const candidateNumbers = numericFacts(candidate);
  const anchorNumbers = numericFacts(anchor);
  for (const num of candidateNumbers) {
    if (!anchorNumbers.has(num)) return true;
  }

  const candidateSpelledNumbers = extractSpelledNumberPhrases(candidate);
  const anchorSpelledNumbers = extractSpelledNumberPhrases(anchor);
  for (const phrase of candidateSpelledNumbers) {
    if (!anchorSpelledNumbers.has(phrase)) return true;
  }

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
  return anchorOverlap < LEDGER_MIN_CONTEXT_JACCARD && rationaleOverlap < LEDGER_MIN_CONTEXT_JACCARD;
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

  const hasHardFillerFailure = resultsPerCandidate.some((reasons) =>
    reasons.includes('candidate_quality_generic_filler'),
  );

  if (hasHardFillerFailure) {
    const mergedReasons = [...new Set(resultsPerCandidate.flat())] as CandidateQualityReasonCode[];
    return { pass: false, passingCount: 0, reasons: mergedReasons };
  }

  const passingCount = resultsPerCandidate.filter((reasons) => reasons.length === 0).length;

  if (passingCount >= 2) {
    return { pass: true, passingCount };
  }

  const mergedReasons = [...new Set(resultsPerCandidate.flat())] as CandidateQualityReasonCode[];
  return { pass: false, passingCount, reasons: mergedReasons };
}
