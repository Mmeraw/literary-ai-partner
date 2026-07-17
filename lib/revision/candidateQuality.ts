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

export const ADMISSION_CANDIDATE_QUALITY_REASON = {
  EMPTY_CANDIDATE: 'EMPTY_CANDIDATE',
  TOO_SHORT: 'TOO_SHORT',
  GENERIC_PROSE: 'GENERIC_PROSE',
  NON_EXECUTABLE_PROSE: 'NON_EXECUTABLE_PROSE',
  NOT_EXECUTABLE: 'NOT_EXECUTABLE',
  ANCHOR_ECHO: 'ANCHOR_ECHO',
  UNSUPPORTED_FACT: 'UNSUPPORTED_FACT',
  CONTEXT_MISMATCH: 'CONTEXT_MISMATCH',
  REVISION_QUALITY_FAILED: 'REVISION_QUALITY_FAILED',
} as const;

export type AdmissionCandidateQualityReasonCode =
  (typeof ADMISSION_CANDIDATE_QUALITY_REASON)[keyof typeof ADMISSION_CANDIDATE_QUALITY_REASON];

export const ADMISSION_CANDIDATE_QUALITY_REASON_CODES: AdmissionCandidateQualityReasonCode[] =
  Object.values(ADMISSION_CANDIDATE_QUALITY_REASON);

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
  const reasons: AdmissionCandidateQualityReasonCode[] = [];

  if (!text) reasons.push(ADMISSION_CANDIDATE_QUALITY_REASON.EMPTY_CANDIDATE);
  if (text && wordCount(text) < 8) reasons.push(ADMISSION_CANDIDATE_QUALITY_REASON.TOO_SHORT);
  if (candidateLooksGeneric(text)) reasons.push(ADMISSION_CANDIDATE_QUALITY_REASON.GENERIC_PROSE);
  if (candidateLooksLikeCommentary(text)) reasons.push(ADMISSION_CANDIDATE_QUALITY_REASON.NON_EXECUTABLE_PROSE);
  if (/\[[^\]]+\]|\bINSERT\b|\bLOCATION\b|\bTODO\b/i.test(text)) reasons.push(ADMISSION_CANDIDATE_QUALITY_REASON.NOT_EXECUTABLE);
  if (input.anchor && similarityRatio(text, input.anchor) > 0.82) reasons.push(ADMISSION_CANDIDATE_QUALITY_REASON.ANCHOR_ECHO);
  if (hasUnsupportedEntity(input, text)) reasons.push(ADMISSION_CANDIDATE_QUALITY_REASON.UNSUPPORTED_FACT);

  const before = normalize(input.beforeContext);
  const after = normalize(input.afterContext);
  if ((before || after) && text.length > 0) {
    const contextSimilarity = Math.max(similarityRatio(text, before), similarityRatio(text, after));
    if (contextSimilarity < 0.03 && wordCount(text) > 25) reasons.push(ADMISSION_CANDIDATE_QUALITY_REASON.CONTEXT_MISMATCH);
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
    reasons: passedCandidateCount >= 2 ? [] : [...reasons, ADMISSION_CANDIDATE_QUALITY_REASON.REVISION_QUALITY_FAILED],
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

/**
 * Inter-candidate distinctiveness threshold.
 * A/B/C are meant to offer materially different revisions (Recommended /
 * Rhythm Variant / Bolder Shift). When two options share this fraction or more
 * of their content tokens — or are byte-identical after normalization — they
 * are effectively duplicate/triplicate content and provide no real choice.
 * 0.80 catches near-identical prose while tolerating options that legitimately
 * reuse the anchor's shared nouns/names.
 */
export const DUPLICATE_OPTION_OVERLAP = 0.8;

/**
 * Detect duplicate or near-duplicate options across the A/B/C set.
 * Returns the list of colliding pairs (e.g. ['B|C']) so callers can log which
 * options collapsed. An empty list means all three are sufficiently distinct.
 */
export function findDuplicateOptionPairs(
  candidateA: string,
  candidateB: string,
  candidateC: string,
): string[] {
  const options: Array<[CandidateKey, string]> = [
    ['A', candidateA],
    ['B', candidateB],
    ['C', candidateC],
  ];
  const collisions: string[] = [];
  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      const [keyI, textI] = options[i]!;
      const [keyJ, textJ] = options[j]!;
      const normI = normalizeForQuality(textI);
      const normJ = normalizeForQuality(textJ);
      if (!normI || !normJ) continue;
      const identical = normI === normJ;
      const nearIdentical = overlapRatio(textI, textJ) >= DUPLICATE_OPTION_OVERLAP;
      if (identical || nearIdentical) {
        collisions.push(`${keyI}|${keyJ}`);
      }
    }
  }
  return collisions;
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

export const LEDGER_CANDIDATE_QUALITY_REASON = {
  NOT_COPY_READY: 'candidate_quality_not_copy_ready',
  TOO_SHORT: 'candidate_quality_too_short',
  GENERIC: 'candidate_quality_generic',
  SUMMARY: 'candidate_quality_summary',
  STILTED: 'candidate_quality_stilted',
  REPETITIVE: 'candidate_quality_repetitive',
  ANCHOR_OVERLAP: 'candidate_quality_anchor_overlap',
  GENERIC_FILLER: 'candidate_quality_generic_filler',
  UNSUPPORTED_FACTS: 'candidate_quality_unsupported_facts',
  VOICE_MISMATCH: 'candidate_quality_voice_mismatch',
  CONTEXT_MISMATCH: 'candidate_quality_context_mismatch',
  DUPLICATE_OPTIONS: 'candidate_quality_duplicate_options',
  EMPTY_SHAPE: 'candidate_quality_empty_shape',
  NOT_EVIDENCE_GROUNDED: 'candidate_quality_not_evidence_grounded',
} as const;

export type CandidateQualityReasonCode =
  (typeof LEDGER_CANDIDATE_QUALITY_REASON)[keyof typeof LEDGER_CANDIDATE_QUALITY_REASON];

export const LEDGER_CANDIDATE_QUALITY_REASON_CODES: CandidateQualityReasonCode[] = Object.values(LEDGER_CANDIDATE_QUALITY_REASON);

export const LEDGER_CARD_QUALITY_FAILED = 'candidate_quality_failed' as const;

/**
 * Minimum jaccard overlap between a candidate option and the manuscript
 * evidence surface (anchor prose + rationale) for the option to count as
 * "grounded in evidence from the manuscript/chapter/story". This is a stricter,
 * first-class evidence-grounding gate than `lacksContextFit` (which fails only
 * when BOTH anchor and rationale overlap fall below LEDGER_MIN_CONTEXT_JACCARD).
 * An option that shares essentially no content tokens with the anchor passage
 * is invented rather than derived from the manuscript and must be rejected.
 */
export const EVIDENCE_GROUNDING_MIN_JACCARD = 0.05;

/**
 * SHAPE gate: an option must not be empty or structurally hollow. "Shape"
 * means the option carries real revised prose — at least a minimum count of
 * distinct content-bearing words — not whitespace, punctuation, or a stub.
 */
export const MIN_OPTION_SHAPE_TOKENS = 4;

/**
 * SHAPE check — the option must not be empty and must carry real content.
 * Returns true when the option FAILS the shape requirement (empty / hollow).
 */
function lacksOptionShape(text: string): boolean {
  const normalized = normalizeForQuality(text);
  if (!normalized) return true;
  const contentTokens = normalized.split(' ').filter((token) => token.length >= 3);
  return contentTokens.length < MIN_OPTION_SHAPE_TOKENS;
}

/**
 * EVIDENCE-GROUNDING check — the option must be derived from evidence in the
 * manuscript/chapter/story, represented here by the anchor passage plus the
 * rationale that cites it. Returns true when the option FAILS grounding (its
 * best overlap with either evidence surface is below the grounding threshold).
 */
function lacksEvidenceGrounding(candidate: string, anchor: string, rationale: string): boolean {
  const candidateTokens = contentTokenSet(candidate);
  if (candidateTokens.size === 0) return true;
  const anchorOverlap = jaccardSimilarity(candidateTokens, contentTokenSet(anchor));
  const rationaleOverlap = jaccardSimilarity(candidateTokens, contentTokenSet(rationale));
  return Math.max(anchorOverlap, rationaleOverlap) < EVIDENCE_GROUNDING_MIN_JACCARD;
}

function evaluateLedgerCandidateQuality(
  candidate: string,
  anchor: string,
  rationale: string,
): CandidateQualityReasonCode[] {
  const reasons: CandidateQualityReasonCode[] = [];

  if (lacksOptionShape(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.EMPTY_SHAPE);
  if (isNotCopyReady(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.NOT_COPY_READY);
  if (isTooShort(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.TOO_SHORT);
  if (isGenericAdvice(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.GENERIC);
  if (isSummaryNotProse(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.SUMMARY);
  if (isStilted(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.STILTED);
  if (isRepetitive(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.REPETITIVE);
  if (hasHighAnchorOverlap(candidate, anchor)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.ANCHOR_OVERLAP);
  if (isGenericLiteraryFiller(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.GENERIC_FILLER);
  if (introducesUnsupportedFacts(candidate, anchor)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.UNSUPPORTED_FACTS);
  if (isVoiceMismatch(candidate)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.VOICE_MISMATCH);
  if (lacksContextFit(candidate, anchor, rationale)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.CONTEXT_MISMATCH);
  if (lacksEvidenceGrounding(candidate, anchor, rationale)) reasons.push(LEDGER_CANDIDATE_QUALITY_REASON.NOT_EVIDENCE_GROUNDED);

  return [...new Set(reasons)];
}

// eslint-disable-next-line no-redeclare
export function evaluateCandidateQuality(input: CandidateQualityInput): AdmissionCandidateQualityResult;
// eslint-disable-next-line no-redeclare
export function evaluateCandidateQuality(candidate: string, anchor: string, rationale: string): CandidateQualityReasonCode[];
// eslint-disable-next-line no-redeclare
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
    return { pass: false, passingCount: 0, reasons: [LEDGER_CANDIDATE_QUALITY_REASON.NOT_COPY_READY] };
  }

  // SHAPE hard failure: every option must carry real revised prose. A blank or
  // hollow option is not a choice at all — the SHAPE of A/B/C must not be empty.
  // This is stricter than the empty-string guard above (it also catches
  // whitespace/punctuation-only or stub options) and fails the whole card so
  // regeneration re-runs.
  if (
    lacksOptionShape(candidateA) ||
    lacksOptionShape(candidateB) ||
    lacksOptionShape(candidateC)
  ) {
    return { pass: false, passingCount: 0, reasons: [LEDGER_CANDIDATE_QUALITY_REASON.EMPTY_SHAPE] };
  }

  const resultsPerCandidate = [
    evaluateLedgerCandidateQuality(candidateA, anchor, rationale),
    evaluateLedgerCandidateQuality(candidateB, anchor, rationale),
    evaluateLedgerCandidateQuality(candidateC, anchor, rationale),
  ];

  const hasHardFillerFailure = resultsPerCandidate.some((reasons) =>
    reasons.includes(LEDGER_CANDIDATE_QUALITY_REASON.GENERIC_FILLER),
  );

  if (hasHardFillerFailure) {
    const mergedReasons = [...new Set(resultsPerCandidate.flat())] as CandidateQualityReasonCode[];
    return { pass: false, passingCount: 0, reasons: mergedReasons };
  }

  // Hard failure: two or more options are duplicate / near-duplicate. A/B/C
  // must offer materially different revisions; collapsed options provide no
  // real choice and are the single biggest author-facing complaint. Fail the
  // whole card so the regeneration path re-runs with distinct variants.
  const duplicatePairs = findDuplicateOptionPairs(candidateA, candidateB, candidateC);
  if (duplicatePairs.length > 0) {
    const mergedReasons = [
      ...new Set([...resultsPerCandidate.flat(), LEDGER_CANDIDATE_QUALITY_REASON.DUPLICATE_OPTIONS]),
    ] as CandidateQualityReasonCode[];
    return { pass: false, passingCount: 0, reasons: mergedReasons };
  }

  // Evidence-grounding is enforced per candidate inside
  // evaluateLedgerCandidateQuality via `candidate_quality_not_evidence_grounded`
  // (an option that shares no content with the manuscript anchor/rationale is
  // invented, not derived). An ungrounded option therefore fails and lowers the
  // passing count — it does NOT hard-fail the whole card, so the 2-of-3
  // tolerance still applies: the card passes only if at least two options are
  // clean AND grounded. This keeps grounding aligned with the other per-
  // candidate signals rather than overriding the card admission rule.
  const passingCount = resultsPerCandidate.filter((reasons) => reasons.length === 0).length;

  if (passingCount >= 2) {
    return { pass: true, passingCount };
  }

  const mergedReasons = [...new Set(resultsPerCandidate.flat())] as CandidateQualityReasonCode[];
  return { pass: false, passingCount, reasons: mergedReasons };
}
