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

export interface CandidateQualityResult {
  key: CandidateKey;
  passed: boolean;
  reasons: CandidateQualityReason[];
  score: number;
}

export interface CardQualityResult {
  passed: boolean;
  passedCandidateCount: number;
  candidateResults: CandidateQualityResult[];
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

export function evaluateCandidateQuality(input: CandidateQualityInput): CandidateQualityResult {
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

export function evaluateCardCandidateQuality(candidates: CandidateQualityInput[]): CardQualityResult {
  const candidateResults = candidates.map(evaluateCandidateQuality);
  const passedCandidateCount = candidateResults.filter((result) => result.passed).length;
  const reasons = Array.from(new Set(candidateResults.flatMap((result) => result.reasons)));

  return {
    passed: passedCandidateCount >= 2,
    passedCandidateCount,
    candidateResults,
    reasons: passedCandidateCount >= 2 ? [] : [...reasons, 'REVISION_QUALITY_FAILED'],
  };
}
