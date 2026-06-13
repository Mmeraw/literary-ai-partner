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
