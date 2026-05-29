const INVALID_EXACT_TOKENS = new Set([
  'he',
  'him',
  'she',
  'her',
  'they',
  'them',
  'i',
  'me',
  'sir',
  'madam',
  'old chap',
  'dear boy',
  'the boy',
  'the man',
  'the convict',
  'the stranger',
]);

const RELATIONSHIP_DESCRIPTOR_PATTERNS: RegExp[] = [
  /\b\w+\s+and\s+\w+'?s\s+(son|daughter|child)\b/i,
  /\bson\s+of\b/i,
  /\bdaughter\s+of\b/i,
  /\bchild\s+of\b/i,
];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeIdentityToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = normalizeWhitespace(value);
  return cleaned.length > 0 ? cleaned : null;
}

export function isInvalidIdentityNameToken(value: string): boolean {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return true;

  if (INVALID_EXACT_TOKENS.has(normalized)) return true;
  if (RELATIONSHIP_DESCRIPTOR_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return false;
}

export function sanitizeIdentityNameToken(value: unknown): string | null {
  const normalized = normalizeIdentityToken(value);
  if (!normalized) return null;
  if (isInvalidIdentityNameToken(normalized)) return null;
  return normalized;
}

export function sanitizeIdentityNameList(values: unknown): string[] {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of source) {
    const sanitized = sanitizeIdentityNameToken(value);
    if (!sanitized) continue;
    const key = sanitized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sanitized);
  }

  return result;
}
