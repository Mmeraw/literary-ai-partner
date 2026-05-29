// canon-audit-allow: vocabulary-detection
// Reason: 'commercial' below is a DREAM subscore dimension (publishing shelf axis),
// not a canonical evaluation criterion key alias.
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";
import {
  CRITERIA_KEYS,
  type CriterionKey,
  getCriterionDisplayLabel as getCanonicalCriterionLabel,
} from "@/schemas/criteria-keys";

export type DreamScoreDimension = "quality" | "readiness" | "commercial" | "literary";

/** Case-insensitive lookup: "NARRATIVECLOSURE" → "narrativeClosure" */
function resolveCanonicalKey(key: string): CriterionKey | null {
  if ((CRITERIA_KEYS as readonly string[]).includes(key)) return key as CriterionKey;
  const lower = key.toLowerCase();
  const found = (CRITERIA_KEYS as readonly string[]).find(
    (k) => k.toLowerCase() === lower,
  );
  return found ? (found as CriterionKey) : null;
}

/**
 * Maps any criterion key string to its author-facing display label.
 * Uses the canonical 13-criteria schema when available (case-insensitive);
 * falls back to camelCase → Title Case conversion for unknown keys.
 */
export function getCriterionDisplayLabel(key: string): string {
  const canonical = resolveCanonicalKey(key);
  if (canonical) {
    return getCanonicalCriterionLabel(canonical);
  }
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function getDisplayRecord(value: unknown): Record<string, unknown> | null {
  return asRecord(value);
}

export function getDisplayText(value: unknown, fallback = "—"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

export function getDisplayDateTime(isoLike: string | null | undefined, fallback = "Unknown"): string {
  if (typeof isoLike !== "string" || isoLike.trim().length === 0) {
    return fallback;
  }

  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toLocaleString();
}

export function getDisplayDreamScore(
  dreamDoc: LongformDreamDocument | null | undefined,
  dimension: DreamScoreDimension,
): string {
  const value = asRecord((dreamDoc as unknown as Record<string, unknown> | null)?.dream_scores)?.[dimension];
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "—";
}

export function getDisplayDreamList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export function getDisplayObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

/**
 * Ensure text does not end mid-word or mid-punctuation.
 * If the text appears truncated (ends without sentence-terminal punctuation),
 * trim back to the last complete word boundary and append an ellipsis.
 */
export function safeTruncateToWordBoundary(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Already ends with sentence-terminal punctuation — no truncation needed.
  if (/[.!?;:—"')\]]\s*$/.test(trimmed)) return trimmed;

  // Ends cleanly on a complete word (letter/digit followed by whitespace boundary) — likely fine.
  // But if it ends mid-word (no space before the final char cluster), trim to last word boundary.
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return trimmed;

  // Check if the very end looks like a partial word (no terminal punctuation).
  const lastSegment = trimmed.slice(lastSpace + 1);
  // If last segment is a complete word ending in a letter/digit, the text is merely
  // missing a period — that is acceptable, just append one.
  // If last segment looks partial (short, no vowel, or clearly mid-word), trim it.
  if (lastSegment.length <= 3 && !/[aeiou]/i.test(lastSegment)) {
    // Likely mid-word truncation — trim to previous word boundary.
    const upToLastSpace = trimmed.slice(0, lastSpace).trimEnd();
    // Remove trailing conjunctions/prepositions that dangle after trimming.
    const cleaned = upToLastSpace.replace(/\s+(and|or|but|the|a|an|in|on|at|to|of|for|with|by)\s*$/i, "");
    return cleaned.replace(/[,;:\s]+$/, "") + "…";
  }

  return trimmed;
}

/**
 * Ensure evidence quote text does not cut off mid-word or mid-punctuation.
 * Trims to the last complete word and adds ellipsis if truncated.
 */
export function safeEvidenceQuote(snippet: string): string {
  const trimmed = snippet.trim();
  if (!trimmed) return trimmed;

  // Already ends with closing punctuation — no fix needed.
  if (/[.!?;:—"')\]]\s*$/.test(trimmed)) return trimmed;

  // Ends with a complete word — append ellipsis to signal continuation.
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return trimmed + "…";

  const lastWord = trimmed.slice(lastSpace + 1);
  // Partial word: trim back.
  if (lastWord.length <= 2 && !/[aeiou]/i.test(lastWord)) {
    return trimmed.slice(0, lastSpace).replace(/[,;:\s]+$/, "") + "…";
  }

  return trimmed + "…";
}

export function getDisplayDreamMarketField(
  dreamDoc: LongformDreamDocument | null | undefined,
  field: "best_shelf" | "marketable_hook" | "market_danger",
): string | null {
  const marketShelf = asRecord((dreamDoc as unknown as Record<string, unknown> | null)?.market_shelf);
  if (!marketShelf) return null;

  const value = getDisplayText(marketShelf[field], "").trim();
  return value.length > 0 ? value : null;
}

const INTERNAL_DIAGNOSTIC_PATTERNS: RegExp[] = [
  /source[-\s]?integrity/i,
  /relationship\s+network\s+representation/i,
  /threat\s*\/?\s*pressure/i,
  /location\s*\/?\s*timeline/i,
  /object\s*\/?\s*symbol/i,
  /extraction\s+diagnostic/i,
  /repair\s+relationship\s+network/i,
  /layer\s+contamination/i,
  /taxonomy\s+repair/i,
  /no\s+qualifying\s+relationship\s+pairs/i,
  /renderer\s+defect|schema\s+defect|ontology\s+repair/i,
];

export type AuthorFacingRevisionPlanItem = {
  priority: number;
  title: string;
  goal: string;
  actions: string[];
  acceptance_check: string;
};

export function isInternalDiagnosticText(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return INTERNAL_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(text));
}

export function filterAuthorFacingTextList(value: unknown): string[] {
  return getDisplayDreamList(value).filter((entry) => !isInternalDiagnosticText(entry));
}

export function getAuthorFacingRevisionPlan(value: unknown): AuthorFacingRevisionPlanItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => {
      const rawPriority = entry.priority;
      const priority = typeof rawPriority === "number" && Number.isFinite(rawPriority)
        ? rawPriority
        : Number.parseInt(getDisplayText(rawPriority, "0"), 10) || 0;

      const title = getDisplayText(entry.title, "");
      const goal = getDisplayText(entry.goal, "");
      const actions = filterAuthorFacingTextList(entry.actions);
      const acceptance_check = getDisplayText(entry.acceptance_check, "");

      return {
        priority,
        title,
        goal,
        actions,
        acceptance_check,
      };
    })
    .filter((item) => {
      const combined = [item.title, item.goal, item.acceptance_check, ...item.actions].join(" ");
      return combined.trim().length > 0 && !isInternalDiagnosticText(combined);
    });
}

export function getRenumberedAuthorFacingRevisionPlan(
  value: unknown,
): Array<AuthorFacingRevisionPlanItem & { displayPriority: number }> {
  return getAuthorFacingRevisionPlan(value).map((item, idx) => ({
    ...item,
    displayPriority: idx + 1,
  }));
}