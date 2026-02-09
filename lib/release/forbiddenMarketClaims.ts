export const FORBIDDEN_MARKET_CLAIM_PATTERNS: RegExp[] = [
  /\bguarantee(d|s)?\b/i,
  /\bwill sell\b/i,
  /\bbest-?seller\b/i,
  /\bbestseller\b/i,
  /\bsurefire\b/i,
  /\bcertain to sell\b/i,
  /\bagent will\b/i,
  /\bpublisher will\b/i,
  /\bwill get picked up\b/i,
  /\bwill be acquired\b/i
];

export function containsForbiddenMarketClaims(text: string): boolean {
  return FORBIDDEN_MARKET_CLAIM_PATTERNS.some((re) => re.test(text));
}

/**
 * Conservative scan over a JSON-like object for any string values containing forbidden patterns.
 * Only scans strings (ignores keys). This is intended for fail-closed rendering.
 *
 * Handles circular references safely via a Set of visited nodes.
 * Returns true if any forbidden pattern is detected.
 */
export function scanObjectForForbiddenMarketClaims(obj: unknown): boolean {
  const seen = new Set<unknown>();

  function walk(node: unknown): boolean {
    if (node == null) return false;
    if (typeof node === 'string') return containsForbiddenMarketClaims(node);
    if (typeof node !== 'object') return false;
    if (seen.has(node)) return false;
    seen.add(node);

    if (Array.isArray(node)) return node.some(walk);

    for (const value of Object.values(node as Record<string, unknown>)) {
      if (walk(value)) return true;
    }
    return false;
  }

  return walk(obj);
}
