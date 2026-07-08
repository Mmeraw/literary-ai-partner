/**
 * CMOS (Chicago Manual of Style, 17th Edition) Deterministic Sanitizer
 *
 * Post-processes LLM-generated text to enforce CMOS conventions.
 * Applied to all author-facing output before storage/display.
 *
 * Handles:
 * - Em dashes: closed up (no surrounding spaces)
 * - Double hyphens converted to em dashes
 * - Quotation mark punctuation placement (periods/commas inside quotes)
 * - Latin abbreviation expansion in prose context
 * - Straight quotes → curly (typographer's) quotes
 * - Repeated words ("the the") removal
 * - Double spaces → single space
 * - Common LLM grammar/spelling errors
 * - Bullet formatting (hyphens/asterisks → proper bullet characters)
 * - Heading case normalization (ALL CAPS → Title Case)
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
 * Convert straight quotes to curly (typographer's) quotes.
 * CMOS 6.115: Use curly quotation marks in published text.
 */
function fixStraightQuotes(text: string): string {
  let result = text;
  // Opening double quote: after whitespace/start or opening paren/bracket
  result = result.replace(/(^|[\s(\[])"/g, "$1\u201c");
  // Closing double quote: before whitespace/end or punctuation
  result = result.replace(/"([\s.,;:!?)}\]\n]|$)/g, "\u201d$1");
  // Opening single quote: after whitespace/start (careful not to hit apostrophes)
  result = result.replace(/(^|[\s(\[])'/g, "$1\u2018");
  // Closing single quote / apostrophe: between letters
  result = result.replace(/(\w)'(\w)/g, "$1\u2019$2");
  // Closing single quote after word
  result = result.replace(/'([\s.,;:!?)}\]\n]|$)/g, "\u2019$1");
  return result;
}

/**
 * Fix repeated words ("the the", "a a", "is is").
 * Common LLM artifact.
 */
function fixRepeatedWords(text: string): string {
  return text.replace(/\b(\w{2,})\s+\1\b/gi, "$1");
}

/**
 * Normalize multiple spaces to single space.
 * CMOS 2.12: One space after periods and all punctuation.
 */
function fixDoubleSpaces(text: string): string {
  return text.replace(/ {2,}/g, " ");
}

/**
 * Fix common LLM grammar/spelling errors that appear in editorial output.
 * These are mechanical corrections only — not style preferences.
 */
function fixCommonLLMErrors(text: string): string {
  let result = text;
  // "alot" → "a lot"
  result = result.replace(/\balot\b/gi, "a lot");
  // "alright" → "all right" (CMOS preference)
  result = result.replace(/\balright\b/gi, "all right");
  // Double period at end
  result = result.replace(/\.\.(\s|$)/g, ".$1");
  // Comma splice before "however" mid-sentence (common LLM error)
  // ", however," is correct; ", however " without second comma is wrong
  result = result.replace(/, however ([a-z])/g, "; however, $1");
  return result;
}

/**
 * Normalize bullet markers to consistent style.
 * CMOS 6.127–6.131: Lists should use consistent markers.
 * Convert hyphens used as bullets to proper bullet characters.
 */
function fixBulletFormatting(text: string): string {
  let result = text;
  // Lines starting with " - " or "- " (hyphen bullets) → "• " (proper bullet)
  result = result.replace(/^(\s*)-\s+/gm, "$1\u2022 ");
  // Lines starting with " * " (asterisk bullets) → "• "
  result = result.replace(/^(\s*)\*\s+/gm, "$1\u2022 ");
  return result;
}

/**
 * Enforce CMOS title case for headings embedded in text.
 * CMOS 8.159: Capitalize first and last words, and all major words.
 * Applied only to text that looks like a heading (ALL CAPS or Title Case with colon).
 */
function fixHeadingCase(text: string): string {
  // Don't modify running prose — only fix ALL-CAPS headings that appear as labels
  // e.g., "FIT SUMMARY:" → "Fit Summary:" 
  return text.replace(
    /^([A-Z][A-Z\s]{2,}):(\s)/gm,
    (_match, heading: string, trail: string) => {
      const minor = new Set(["a", "an", "the", "and", "but", "or", "nor", "for", "yet", "so", "in", "on", "at", "to", "of", "by", "up", "as"]);
      const words = heading.toLowerCase().split(/\s+/);
      const titleCased = words.map((w: string, i: number) => {
        if (i === 0 || i === words.length - 1 || !minor.has(w)) {
          return w.charAt(0).toUpperCase() + w.slice(1);
        }
        return w;
      }).join(" ");
      return `${titleCased}:${trail}`;
    },
  );
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
  result = fixStraightQuotes(result);
  result = fixRepeatedWords(result);
  result = fixDoubleSpaces(result);
  result = fixCommonLLMErrors(result);
  result = fixBulletFormatting(result);
  result = fixHeadingCase(result);
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
      let value = sanitizeCMOS(result[field] as string);
      // The `action` field is author-facing prose that must start with a capital
      // letter and end with terminal punctuation (CMOS §6.13, ECG ECG_REC_LOWERCASE_START).
      if (field === "action" && value.length > 0) {
        value = value.charAt(0).toUpperCase() + value.slice(1);
        if (!/[.!?\u2026]$/.test(value)) {
          value = value + ".";
        }
      }
      (result as Record<string, unknown>)[field] = value;
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
