function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const FAMILY_PREFIX_PATTERN = /^\s*[•*\-]?\s*(quick win|strategic revision)\s*:\s*/i;

const RECOMMENDATION_LEAD_IN_PATTERNS = [
  /^in the anchored moment\s+"[^"]+",\s*/i,
  /^at the passage beginning\s+"[^"]+",\s*/i,
  /^in the closing beat beginning\s+"[^"]+",\s*/i,
  /^starting from\s+"[^"]+",\s*/i,
  /^at the line\s+"[^"]+",\s*/i,
  /^in the (?:section|passage|paragraph) (?:where|beginning|starting|containing)\b[^,]*,\s*/i,
];

const REPETITIVE_LEAD_IN_PATTERNS = [
  /^(?:in|at) the anchored moment\b/i,
  /^(?:in|at) the (?:section|passage|paragraph|line|scene) (?:where|beginning|starting|containing)\b/i,
  /^there (?:is|was) (?:a|an) (?:section|passage|paragraph) where\b/i,
  /^in the section where\b/i,
];

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [];
}

function sentenceOpeningFingerprint(sentence: string, tokens = 4): string {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, tokens)
    .join(" ");
}

export function stripRecommendationLeadIn(action: string): string {
  const trimmed = action.trim();
  if (!trimmed) return "";

  let out = trimmed;
  while (FAMILY_PREFIX_PATTERN.test(out)) {
    out = out.replace(FAMILY_PREFIX_PATTERN, "");
  }
  for (const pattern of RECOMMENDATION_LEAD_IN_PATTERNS) {
    out = out.replace(pattern, "");
  }

  return normalizeWhitespace(out);
}

export function canonicalizeRecommendationAction(action: string): string {
  return stripRecommendationLeadIn(action).toLowerCase();
}

export function startsWithRepetitiveLeadIn(text: string): boolean {
  const clean = normalizeWhitespace(text);
  if (!clean) return false;
  return REPETITIVE_LEAD_IN_PATTERNS.some((pattern) => pattern.test(clean));
}

export function hasRepeatedSentenceOpenings(
  text: string,
  openingTokens = 4,
  allowedRepeats = 1,
): boolean {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return false;

  const openingCounts = new Map<string, number>();
  for (const sentence of sentences) {
    const opening = sentenceOpeningFingerprint(sentence, openingTokens);
    if (!opening) continue;

    const tokenCount = opening.split(" ").filter(Boolean).length;
    if (tokenCount < openingTokens) continue;

    const next = (openingCounts.get(opening) ?? 0) + 1;
    openingCounts.set(opening, next);
    if (next > allowedRepeats) {
      return true;
    }
  }

  return false;
}

export function removeConsecutiveDuplicateSentences(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) return text.trim();

  const kept: string[] = [];
  let last = "";
  for (const sentence of sentences) {
    const normalized = normalizeWhitespace(sentence).toLowerCase();
    if (!normalized || normalized === last) continue;
    kept.push(sentence);
    last = normalized;
  }

  return kept.join(" ").replace(/\s+/g, " ").trim();
}

export function sanitizeAuthorFacingProse(text: string): string {
  const compact = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return removeConsecutiveDuplicateSentences(compact);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure, idempotent copy-polish helpers.
//
// These transform or INSPECT a string. They make NO kick-back / retry /
// certify-fail decision — that authority lives entirely in the existing gates
// (KICK_MATRIX + selfCorrectionPolicy + evaluationCertificationGate +
// shortFormFinalSanityCheck). Implemented ONCE here and reused everywhere.
// Every helper is idempotent: running it twice yields the same result as once.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capitalize the first alphabetic character of a string, leaving any leading
 * punctuation/whitespace/numbering untouched. (A3, A4, D2)
 * Idempotent: an already-capitalized opening is unchanged.
 */
export function capitalizeFirstAlpha(text: string): string {
  if (!text) return text;
  const idx = text.search(/[a-zA-Z]/);
  if (idx === -1) return text;
  const ch = text[idx];
  const upper = ch.toUpperCase();
  if (ch === upper) return text;
  return text.slice(0, idx) + upper + text.slice(idx + 1);
}

// A terminal sentence punctuation mark, optionally followed by a closing
// quote/bracket, at the very end of the (trimmed) string.
const TERMINAL_PUNCTUATION_AT_END = /[.!?…]["'”’)\]]*$/u;

/**
 * Ensure the string ends with terminal sentence punctuation. (A3, A4)
 * If it already ends with . ! ? … (optionally + closing quote/bracket), it is
 * returned unchanged (idempotent). A trailing comma/semicolon/colon/dash is
 * replaced with a period. Otherwise a period is appended.
 */
export function ensureTerminalPunctuation(text: string): string {
  if (!text) return text;
  const trimmed = text.replace(/\s+$/u, "");
  if (!trimmed) return text;
  if (TERMINAL_PUNCTUATION_AT_END.test(trimmed)) return trimmed;
  // Replace a dangling clause-level punctuation mark with a period.
  const withoutDangling = trimmed.replace(/[,;:—\-]+$/u, "");
  return (withoutDangling || trimmed) + ".";
}

/**
 * Ensure exactly one space after a label colon. (D1)
 * Collapses zero-or-many spaces after a colon into a single space. Does NOT
 * touch colons that already have exactly one space (idempotent) and leaves
 * time-like or ratio-like "digit:digit" sequences untouched.
 */
export function ensureSingleSpaceAfterColon(text: string): string {
  if (!text) return text;
  return text.replace(/([^\s\d]):(?=\S)(?!\d)\s*/g, "$1: ").replace(/([^\s\d]):[ \t]{2,}/g, "$1: ");
}

// Function words whose IMMEDIATE doubling ("the the") is essentially always an
// accidental copy artifact. Deliberately excludes words that legitimately double
// in English ("had had", "that that", "is is" as a stammer, etc.).
const SAFE_IMMEDIATE_DUP_WORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "at", "for", "and", "or", "but",
  "with", "as", "by", "from", "into", "onto",
]);

/**
 * Conservatively collapse an accidental adjacent duplicate word. (A4)
 * Handles two accidental shapes only:
 *   - immediate repeat of a safe function word: "the the" → "the"
 *   - repeat straddling one word:  "passage reflective passage" → "reflective passage"
 * Case/punctuation-insensitive on the compared token. Deliberately narrow so it
 * never collapses legitimate repetition ("had had", "that that" are left to the
 * qualityGate's duplication semantics) and never touches proper-noun echoes.
 */
export function collapseAdjacentDuplicateWords(text: string): string {
  if (!text) return text;
  let out = text;
  // Immediate repeat: only for safe function words, and only when both tokens
  // share case (so "The the" style is left alone — likely a sentence boundary).
  out = out.replace(/\b([A-Za-z]+)(\s+)\1\b/g, (match, word: string) => {
    if (!SAFE_IMMEDIATE_DUP_WORDS.has(word.toLowerCase())) return match;
    return word;
  });
  // Repeat straddling exactly one intervening word: A x A → x A (drop the leading dup).
  out = out.replace(/\b([A-Za-z]+)\s+([A-Za-z]+)\s+\1\b/g, (match, first: string, middle: string) => {
    // Only collapse when the duplicated token is a lowercase common word
    // (avoids touching intentional proper-noun echoes like "New … New").
    if (/[A-Z]/.test(first[0])) return match;
    return `${middle} ${first}`;
  });
  return out;
}

// A leading A/B/C strategy-label token: a single letter A, B, or C followed by
// a colon, em-dash, or hyphen separator. Used to recognize the INTENTIONAL
// strategy labels ("A: Recommended", "B — Rhythm Variant", "C: Bolder Shift")
// so only an ACCIDENTAL immediate repeat is collapsed. (D3)
const STRATEGY_LABEL_PREFIX = /^[ABC]\s*[:—-]/;

/**
 * Collapse an ACCIDENTALLY doubled A/B/C strategy label at the head of a card
 * header, preserving the single intended label. (D3)
 *
 * Surgical + conservative: only collapses when the header BEGINS with a valid
 * strategy-label token (A/B/C + separator) that is then immediately repeated
 * verbatim. Never strips the intended single label; never touches non-strategy
 * text. Idempotent.
 *   "A: Recommended A: Recommended"     → "A: Recommended"
 *   "A — Rhythm Variant A — Rhythm Variant more" → "A — Rhythm Variant more"
 *   "A: Recommended"                    → unchanged
 */
export function collapseDuplicatedStrategyLabel(text: string): string {
  if (!text) return text;
  const compact = text.replace(/\s+/g, " ").trim();
  const dup = compact.match(/^(.+?)\s+\1(\s+.*)?$/);
  if (dup && STRATEGY_LABEL_PREFIX.test(dup[1])) {
    return (dup[1] + (dup[2] ?? "")).trim();
  }
  return text;
}

// Sentinel strings deliberately emitted by buildReportPitches when a distinct
// pitch could not be generated. detectRawFallbackSentinel treats these as
// "absent" so a gate can regenerate/suppress rather than expose them. (A2)
const FALLBACK_SENTINEL_PATTERNS = [
  /\bdistinct (?:market hook|story synopsis) was not generated\b/i,
  /\bmarket hook was not generated\b/i,
  /\bstory synopsis was not generated\b/i,
];

/**
 * Detect whether a pitch/summary string is a raw fallback sentinel (or empty).
 * Returns true when the text must be treated as MISSING. (A2)
 * Pure predicate — makes no decision about what to do about it.
 */
export function detectRawFallbackSentinel(text: string | null | undefined): boolean {
  if (text == null) return true;
  const clean = normalizeWhitespace(text);
  if (!clean) return true;
  return FALLBACK_SENTINEL_PATTERNS.some((p) => p.test(clean));
}

const PROSE_SCORE_PATTERN = /\b(\d{1,3})\s*\/\s*100\b/g;

export type ProseScoreDivergence = {
  /** Every "NN/100" mention found in the prose. */
  proseScores: number[];
  /** The canonical displayed score passed in. */
  canonicalScore: number;
  /** True if any prose score differs from the canonical score. */
  diverges: boolean;
  /** True if any prose score EXCEEDS the canonical score (inflation — never allowed). */
  inflates: boolean;
};

/**
 * Detect a prose-cited "NN/100" score that diverges from the canonical
 * displayed score. (A1)
 *
 * Pure inspector — makes NO decision. The certification gate decides whether a
 * divergence is a kick-back. Distinguishes the two directions:
 *   - inflates: prose score > canonical (violates the floor "never inflate" law)
 *   - diverges: prose score != canonical (e.g. the legitimate floor-vs-round
 *     64-vs-68 case, which the gate treats as a mismatch to reconcile).
 */
export function detectProseScoreDivergence(
  prose: string | null | undefined,
  canonicalScore: number,
): ProseScoreDivergence {
  const proseScores: number[] = [];
  if (prose) {
    for (const match of prose.matchAll(PROSE_SCORE_PATTERN)) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n)) proseScores.push(n);
    }
  }
  const diverges = proseScores.some((s) => s !== canonicalScore);
  const inflates = proseScores.some((s) => s > canonicalScore);
  return { proseScores, canonicalScore, diverges, inflates };
}

// A dangling connective/opening that must never end author-facing prose.
const DANGLING_TAIL_WORDS = [
  "and", "or", "but", "so", "yet", "nor", "for",
  "because", "which", "that", "who", "whom", "whose", "where", "when", "while",
  "if", "as", "than", "then", "with", "to", "of", "in", "on", "at", "by",
  "from", "into", "onto", "the", "a", "an", "this", "these", "those",
];
const DANGLING_TAIL_PATTERN = new RegExp(
  `(?:\\b(?:${DANGLING_TAIL_WORDS.join("|")})\\b|,|:|;|\\u2014|\\(|\\[)\\s*$`,
  "iu",
);

/**
 * Detect whether author-facing prose ends mid-sentence. (global invariant)
 * True when the trimmed text does NOT end with terminal punctuation, OR ends
 * with a dangling connective / comma / colon / semicolon / em-dash / open
 * bracket. Pure predicate — the gate decides whether to kick back.
 *
 * Use this for KNOWN full-sentence prose (summary, pitches, rationales). For a
 * broad sweep across mixed segments that may include short label fields, prefer
 * endsWithDanglingConnective to avoid flagging label-style text.
 */
export function endsMidSentence(text: string | null | undefined): boolean {
  if (text == null) return false;
  const trimmed = normalizeWhitespace(text);
  if (!trimmed) return false;
  if (DANGLING_TAIL_PATTERN.test(trimmed)) return true;
  return !TERMINAL_PUNCTUATION_AT_END.test(trimmed);
}

/**
 * Strong-signal subset of endsMidSentence: true ONLY when the text ends on a
 * dangling connective, comma, colon, semicolon, em-dash, or open bracket — i.e.
 * unambiguously incomplete. Does NOT flag mere absence of terminal punctuation,
 * so it is safe to run across mixed segments including short label fields.
 */
export function endsWithDanglingConnective(text: string | null | undefined): boolean {
  if (text == null) return false;
  const trimmed = normalizeWhitespace(text);
  if (!trimmed) return false;
  return DANGLING_TAIL_PATTERN.test(trimmed);
}

// Matches a sentence terminator (. ! ? …) plus any trailing closing
// quote/bracket, at a position followed by whitespace or end-of-string.
const SENTENCE_TERMINATOR = /[.!?…]["'”’)\]]*(?=\s|$)/gu;

function trimAtWordBoundaryLocal(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  const candidate = text.substring(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.6) {
    return candidate.substring(0, lastSpace).replace(/[\s,;:.—\-]+$/u, "") + "…";
  }
  return candidate.replace(/[\s,;:.—\-]+$/u, "") + "…";
}

/**
 * Trim author-facing prose back to the last COMPLETE sentence. (global invariant)
 *
 * Sentence boundary > word boundary. When `maxLength` is provided, trims within
 * that budget; when omitted, returns the whole run of complete sentences
 * (dropping only a trailing incomplete fragment). Never leaves a dangling
 * connective, comma, colon, semicolon, em-dash, or open bracket. Idempotent.
 *
 * If NO complete sentence fits within `maxLength`, falls back to a word-boundary
 * trim (the only branch that appends an ellipsis) so we never cut mid-word.
 */
export function trimAtSentenceBoundary(text: string, maxLength?: number): string {
  if (!text) return text;

  // Hard-cap mode: with a budget, author prose within the cap is returned
  // UNCHANGED ("more is more" — never touch content or trailing whitespace).
  // Only over-budget text is shortened, always at a complete-sentence boundary.
  if (maxLength !== undefined && text.length <= maxLength) return text;

  if (maxLength === undefined) {
    // "Complete sentences" mode: drop only a trailing incomplete fragment.
    if (!endsMidSentence(text)) return text.trimEnd();
    let lastEnd = -1;
    for (const match of text.matchAll(SENTENCE_TERMINATOR)) {
      lastEnd = match.index + match[0].length;
    }
    return lastEnd > 0 ? text.substring(0, lastEnd).trimEnd() : text.trimEnd();
  }

  // Over-budget mode: trim within the window to the last complete sentence.
  const window = text.substring(0, maxLength);
  let lastEnd = -1;
  for (const match of window.matchAll(SENTENCE_TERMINATOR)) {
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd > 0) return text.substring(0, lastEnd).trimEnd();
  return trimAtWordBoundaryLocal(text, maxLength);
}
