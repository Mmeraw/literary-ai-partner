// canon-audit-allow: vocabulary-detection
// Reason: 'commercial' below is a DREAM subscore dimension (publishing shelf axis),
// not a canonical evaluation criterion key alias.
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";
import { sanitizeCMOS } from "@/lib/evaluation/cmosSanitizer";
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
  return sanitizeCMOS(key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim());
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
    return trimmed.length > 0 ? sanitizeCMOS(trimmed) : fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

/**
 * For long-form manuscripts (≥25k words), replace misleading "chapter" scope
 * references with "manuscript" in author-facing text. The LLM sometimes says
 * "this chapter" when it evaluated a full novel.
 */
export function correctScopeLanguage(text: string, isLongForm: boolean): string {
  const scoped = isLongForm
    ? text
        .replace(/\bthis chapter\b/gi, 'this manuscript')
        .replace(/\bthe chapter\b/gi, 'the manuscript')
        .replace(/\bchapter-level\b/gi, 'manuscript-level')
        .replace(/\bper[- ]chapter\b/gi, 'overall')
    : text;
  return sanitizeCMOS(scoped);
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
    .map((entry) => (typeof entry === "string" ? sanitizeCMOS(entry.trim()) : ""))
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
  const trimmed = sanitizeCMOS(text.trim());
  if (!trimmed) return trimmed;

  // Already ends with sentence-terminal punctuation — no truncation needed.
  if (/[.!?;:—"')\]]\s*$/.test(trimmed)) return trimmed;

  // Dangling connectors: if text ends with a conjunction, preposition, comparative,
  // or other connector word, trim back to the last complete thought.
  const DANGLING_TAIL = /\s+(and|or|but|the|a|an|in|on|at|to|of|for|with|by|than|from|into|as|that|which|who|whose|where|when|while|although|because|before|after|during|between|among|through|about|like|more|less|over|under|also|yet|so|if|whether|not|nor|both|either|neither|each|every|some|any|most|such)\s*$/i;

  let result = trimmed;
  // Iteratively strip dangling connectors.
  while (DANGLING_TAIL.test(result)) {
    result = result.replace(DANGLING_TAIL, "");
  }
  result = result.replace(/[,;:\s]+$/, "");

  // If we stripped something, add ellipsis.
  if (result.length < trimmed.length) {
    return sanitizeCMOS(result + "…");
  }

  // Ends cleanly on a complete word — likely fine, but check for partial words.
  const lastSpace = result.lastIndexOf(" ");
  if (lastSpace === -1) return result;

  const lastSegment = result.slice(lastSpace + 1);
  if (lastSegment.length <= 3 && !/[aeiou]/i.test(lastSegment)) {
    const upToLastSpace = result.slice(0, lastSpace).trimEnd();
    const cleaned = upToLastSpace.replace(DANGLING_TAIL, "").replace(/[,;:\s]+$/, "");
    return sanitizeCMOS(cleaned + "…");
  }

  return result;
}

/**
 * Ensure evidence quote text does not cut off mid-word or mid-punctuation.
 * Trims to the last complete word and adds ellipsis if truncated.
 */
export function safeEvidenceQuote(snippet: string): string {
  const trimmed = sanitizeCMOS(snippet.trim());
  if (!trimmed) return trimmed;

  // Already ends with closing punctuation — no fix needed.
  if (/[.!?;:—"')\]]\s*$/.test(trimmed)) return trimmed;

  // Ends with a complete word — append ellipsis to signal continuation.
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) return sanitizeCMOS(trimmed + "…");

  const lastWord = trimmed.slice(lastSpace + 1);
  // Partial word: trim back.
  if (lastWord.length <= 2 && !/[aeiou]/i.test(lastWord)) {
    return sanitizeCMOS(trimmed.slice(0, lastSpace).replace(/[,;:\s]+$/, "") + "…");
  }

  return sanitizeCMOS(trimmed + "…");
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

export function getDisplayDreamMarketList(
  dreamDoc: LongformDreamDocument | null | undefined,
  field: "shelf_neighbors" | "comparison_space",
): string[] {
  const marketShelf = asRecord((dreamDoc as unknown as Record<string, unknown> | null)?.market_shelf);
  if (!marketShelf) return [];
  return getDisplayDreamList(marketShelf[field]);
}

/**
 * Split a long prose block into paragraphs for structured rendering.
 * Uses double-newlines if present; otherwise splits at ~150-word boundaries
 * on sentence endings.
 */
export function splitIntoParagraphs(text: string): string[] {
  const trimmed = sanitizeCMOS(text.trim());
  if (!trimmed) return [];

  // If the text already has double-newlines, respect those.
  if (/\n\s*\n/.test(trimmed)) {
    return trimmed.split(/\n\s*\n/).map((p) => sanitizeCMOS(p.trim())).filter((p) => p.length > 0);
  }

  // If the text has single newlines, use those as paragraph breaks.
  if (/\n/.test(trimmed)) {
    return trimmed.split(/\n/).map((p) => sanitizeCMOS(p.trim())).filter((p) => p.length > 0);
  }

  // Single block of text: split at sentence boundaries around 150 words.
  const sentences = trimmed.match(/[^.!?]+[.!?]+[\s]*/g) || [trimmed];
  const paragraphs: string[] = [];
  let current = "";
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    if (wordCount > 0 && wordCount + sentenceWords > 150) {
      paragraphs.push(sanitizeCMOS(current.trim()));
      current = sentence;
      wordCount = sentenceWords;
    } else {
      current += sentence;
      wordCount += sentenceWords;
    }
  }
  if (current.trim()) paragraphs.push(sanitizeCMOS(current.trim()));

  return paragraphs.length > 0 ? paragraphs : [trimmed];
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
  /\bHARD_FAIL\b/,
  /\bDEGRADED_EXTRACTION\b/,
  /\bSOURCE_INTEGRITY_REVIEW_REQUIRED\b/,
  /\bpipeline\s+(failure|error|status|diagnostic)/i,
  /\bextraction\s+semantics?\b/i,
  /\bschema\s+validation\b/i,
  /\bWAVE\s*(I{1,4}|[1-4])\b/,
  /\bPass\s*[0-9][A-Za-z]?\b/,
  /\bgate[-_]?identifier\b/i,
  /\bdoctrine[-_]?id\b/i,
  /\bvalidator[-_]?name\b/i,
  /\bprompt[-_]?mechanic/i,
  /\bgovernance[-_]?machinery\b/i,
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

/**
 * Strip leading numeric prefixes ("1. ", "2) ", "3 - ") from list items.
 * LLM-generated revision queues often include numbering that duplicates
 * the `<ol>` list-decimal rendering, producing "1. 1." artifacts.
 */
function stripLeadingNumberPrefix(text: string): string {
  return text.replace(/^\d+[\.\)\-:]\s*/, '').trim();
}

export function filterAuthorFacingTextList(value: unknown): string[] {
  return getDisplayDreamList(value)
    .filter((entry) => !isInternalDiagnosticText(entry))
    .map(stripLeadingNumberPrefix)
    .map(sanitizeCMOS)
    .filter((entry) => entry.length > 0);
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