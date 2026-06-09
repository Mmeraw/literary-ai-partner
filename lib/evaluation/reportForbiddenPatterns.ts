/**
 * Single source of truth for forbidden-text patterns used by:
 *   - downloadParityGate.ts        (detection / validation)
 *   - downloadReadTimeSanitizer.ts  (read-time cleanup)
 *   - persistEvaluationResultV2.ts  (write-time cleanup)
 *
 * Adding a pattern here automatically makes the parity gate reject it
 * AND both sanitizers clean it — no drift possible.
 *
 * Order matters: more specific patterns must come before their shorter
 * counterparts so the sanitizer replaces the longest match first.
 */

export type ForbiddenPattern = {
  /** Machine-readable violation code (e.g. 'MALFORMED_WOULD_BECAUSE'). */
  code: string;
  /** Regex source string (no delimiters, no flags). */
  source: string;
  /** Human-readable label for parity-gate violation messages. */
  label: string;
  /** Replacement text used by sanitizers. */
  replacement: string;
};

/**
 * Canonical forbidden-pattern registry.
 *
 * ORDER CONTRACT: patterns are applied top-to-bottom by sanitizers.
 * Place longer / more specific patterns before shorter / broader ones
 * to prevent partial matches from clobbering the longer replacement.
 */
export const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
  // ── Malformed modal / conjunction fragments ──
  {
    code: 'MALFORMED_DOUBLE_MODAL',
    source: String.raw`\b(would|could|should)\s+(would|could|should)\b`,
    label: 'contains doubled modal verb sequence',
    replacement: '$1',
  },
  {
    code: 'MALFORMED_WOULD_BENEFIT_BECAUSE',
    source: String.raw`\bwould\s+benefit\s+from\s+one\s+because\b`,
    label: 'contains malformed "would benefit from one because" fragment',
    replacement: 'would benefit because',
  },
  {
    code: 'MALFORMED_BENEFIT_FROM_ONE_BECAUSE',
    source: String.raw`\bbenefit\s+from\s+one\s+because\b`,
    label: 'contains malformed "benefit from one because" fragment',
    replacement: 'benefit because',
  },
  {
    code: 'MALFORMED_WOULD_BECAUSE',
    source: String.raw`\b(?:would|could|should)\s+because\b`,
    label: 'contains malformed "would/could/should because" fragment',
    replacement: 'because',
  },

  // ── Off-topic contamination (manuscript bleed-through) ──
  // Long form first: "studies are mixed on the success of safe injection sites"
  // Uses same family code so the gate never reports duplicates for the same span.
  {
    code: 'OFF_TOPIC_STUDIES_ARE_MIXED',
    source: String.raw`\bstudies\s+are\s+mixed\s+on\s+the\s+success\s+of\s+safe\s+injection\s+sites?\b`,
    label: 'contains off-topic contamination phrase "studies are mixed on the success of"',
    replacement: 'scene-specific evidence is mixed',
  },
  // Short form fallback: "studies are mixed on the success of" (any suffix).
  // Same code — sanitizer handles both; gate deduplicates by code.
  {
    code: 'OFF_TOPIC_STUDIES_ARE_MIXED',
    source: String.raw`\bstudies\s+are\s+mixed\s+on\s+the\s+success\s+of\b`,
    label: 'contains off-topic contamination phrase "studies are mixed on the success of"',
    replacement: 'evidence is mixed on the effectiveness of',
  },
  // Standalone "safe injection sites" (catches any remaining after above)
  {
    code: 'OFF_TOPIC_SAFE_INJECTION_SITES',
    source: String.raw`\bsafe\s+injection\s+sites?\b`,
    label: 'contains off-topic contamination phrase "safe injection sites"',
    replacement: 'scene-specific evidence',
  },
] as const;

// ── Derived helpers ──

/** Compiled detection regexes for the parity gate (case-insensitive, non-global). */
export function getForbiddenDetectors(): Array<{ code: string; re: RegExp; label: string }> {
  return FORBIDDEN_PATTERNS.map((p) => ({
    code: p.code,
    re: new RegExp(p.source, 'i'),
    label: p.label,
  }));
}

/** Compiled replacement regexes for sanitizers (global, case-insensitive). */
export function getForbiddenReplacements(): Array<{ code: string; re: RegExp; replacement: string }> {
  return FORBIDDEN_PATTERNS.map((p) => ({
    code: p.code,
    re: new RegExp(p.source, 'gi'),
    replacement: p.replacement,
  }));
}

/** All unique violation codes (useful for metrics initialization). */
export function getForbiddenCodes(): string[] {
  return [...new Set(FORBIDDEN_PATTERNS.map((p) => p.code))];
}
