/**
 * CMOS (Chicago Manual of Style, 17th Edition) Deterministic Sanitizer
 *
 * Post-processes LLM-generated text to enforce CMOS conventions.
 * Applied to all author-facing output before storage/display.
 *
 * Handles:
 * - Em dashes: closed up (no surrounding spaces)
 * - Double hyphens converted to em dashes
 * - Quotation mark punctuation placement
 * - Latin abbreviation expansion in prose context
 */

/**
 * Fix period immediately followed by em dash: ".—" → ". "
 * CMOS violation: a sentence-ending period cannot precede an em dash.
 * The correct form is either two separate sentences (period + space)
 * or an em dash without a preceding period.
 * Example: "action.—Rationale" → "action. Rationale"
 */
function fixPeriodEmDash(text: string): string {
  return text.replace(/\.—/g, '. ');
}

/**
 * Fix spaced em dashes: " — " or " —" or "— " → "—"
 * CMOS 6.85: The em dash is set closed (no spaces on either side).
 */
function fixEmDashes(text: string): string {
  return text
    .replace(/\s*—\s*/g, (match) => {
      if (match.startsWith("\n")) return "\n—";
      return "—";
    });
}

/**
 * Fix double hyphens used as em dashes: " -- " → "—"
 * Common LLM artifact.
 */
function fixDoubleHyphens(text: string): string {
  return text.replace(/\s*--\s*/g, "—");
}

/**
 * Fix periods and commas outside closing quotation marks.
 * CMOS 6.9: Periods and commas precede closing quotation marks.
 *
 * Handles: "word". → "word." and "word", → "word,"
 */
function fixQuotePunctuation(text: string): string {
  text = text.replace(/([^.])([""\u201d])\.(\s|$)/g, "$1.$2$3");
  text = text.replace(/([^,])([""\u201d]),(\s|$)/g, "$1,$2$3");
  return text;
}

/**
 * Replace common Latin abbreviations with English equivalents.
 * CMOS 10.42: In running text, prefer English.
 * Only replaces outside parentheses (CMOS allows Latin inside parens).
 */
function expandLatinAbbreviations(text: string): string {
  return text
    .replace(/(?<!\()e\.g\.\s*/gi, "for example, ")
    .replace(/(?<!\()i\.e\.\s*/gi, "that is, ")
    .replace(/(?<!\()viz\.\s*/gi, "namely, ");
}

/**
 * Apply all CMOS sanitization rules to a single text string.
 * Safe to call on any string; returns the input unchanged if no fixes needed.
 */
export function sanitizeCMOS(text: string): string {
  if (!text || typeof text !== "string") return text;
  let result = text;
  result = fixPeriodEmDash(result);
  result = fixEmDashes(result);
  result = fixDoubleHyphens(result);
  result = fixQuotePunctuation(result);
  result = expandLatinAbbreviations(result);
  return result;
}

/**
 * Apply CMOS sanitization to all string fields in a recommendation object.
 */
export function sanitizeCMOSRecommendation<T extends Record<string, unknown>>(rec: T): T {
  const result = { ...rec };
  const textFields = [
    "action", "expected_impact", "reader_effect", "mechanism",
    "symptom", "mistake_proofing", "specific_fix", "anchor_snippet",
  ];
  for (const field of textFields) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field] = sanitizeCMOS(result[field] as string);
    }
  }
  return result;
}

/**
 * Apply CMOS sanitization to all author-facing text fields in a criterion object.
 */
export function sanitizeCMOSCriterion<T extends Record<string, unknown>>(criterion: T): T {
  const result = { ...criterion };

  if (typeof result.final_rationale === "string") {
    (result as Record<string, unknown>).final_rationale = sanitizeCMOS(result.final_rationale as string);
  }

  if (typeof result.fit_summary === "string") {
    (result as Record<string, unknown>).fit_summary = sanitizeCMOS(result.fit_summary as string);
  }

  if (typeof result.gap_summary === "string") {
    (result as Record<string, unknown>).gap_summary = sanitizeCMOS(result.gap_summary as string);
  }

  if (typeof result.delta_explanation === "string") {
    (result as Record<string, unknown>).delta_explanation = sanitizeCMOS(result.delta_explanation as string);
  }

  if (typeof result.deferred_consequence_risk === "string") {
    (result as Record<string, unknown>).deferred_consequence_risk = sanitizeCMOS(result.deferred_consequence_risk as string);
  }

  if (Array.isArray(result.recommendations)) {
    (result as Record<string, unknown>).recommendations = (result.recommendations as Record<string, unknown>[]).map(
      (r) => sanitizeCMOSRecommendation(r),
    );
  }

  return result;
}

/**
 * Keys that contain non-prose data and should not be sanitized.
 */
const SKIP_KEYS = new Set([
  "key", "model", "model_version", "prompt_version", "generated_at",
  "pass1_model", "pass2_model", "pass3_model", "updated_at", "created_at",
  "id", "job_id", "artifact_id", "finding_id", "option_key",
  "issue_family", "strategic_lever", "revision_granularity",
  "status", "signal_strength", "consequence_status", "verdict",
  "recommendation_status", "gate_ready_status", "score_delta",
]);

/**
 * Recursively apply CMOS sanitization to all string values in an object/array.
 * Skips keys that contain non-prose data (timestamps, model names, IDs, enums).
 */
export function sanitizeCMOSDeep<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeCMOS(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCMOSDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result = { ...value } as Record<string, unknown>;
    for (const k of Object.keys(result)) {
      if (SKIP_KEYS.has(k)) continue;
      result[k] = sanitizeCMOSDeep(result[k]);
    }
    return result as T;
  }
  return value;
}

/**
 * Apply CMOS sanitization to the overall summary section.
 */
export function sanitizeCMOSOverall<T extends Record<string, unknown>>(overall: T): T {
  const result = { ...overall };

  if (typeof result.one_paragraph_summary === "string") {
    (result as Record<string, unknown>).one_paragraph_summary = sanitizeCMOS(result.one_paragraph_summary as string);
  }

  if (Array.isArray(result.top_3_strengths)) {
    (result as Record<string, unknown>).top_3_strengths = (result.top_3_strengths as string[]).map(
      (s) => typeof s === "string" ? sanitizeCMOS(s) : s,
    );
  }

  if (Array.isArray(result.top_3_risks)) {
    (result as Record<string, unknown>).top_3_risks = (result.top_3_risks as string[]).map(
      (s) => typeof s === "string" ? sanitizeCMOS(s) : s,
    );
  }

  return result;
}
