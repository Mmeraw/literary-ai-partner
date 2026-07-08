/**
 * Evaluation Certification Gate (ECG)
 *
 * The single certification authority that every completed evaluation must pass
 * before it becomes a customer-visible artifact.
 *
 * Design principles:
 *   1. Single source of truth — no downstream component may invent authoritative data.
 *   2. Renderer is presentation only — renderers may never repair, infer, or calculate.
 *   3. Dirty data never reaches customers — reject before persistence, not after.
 *
 * Runs immediately before evaluation_result_v2 and unified_evaluation_document_v1
 * are persisted. If status !== "CERTIFIED" the processor must not persist, must not
 * expose downloads, and must not expose Revise.
 *
 * Invariant taxonomy:
 *   FATAL      — block certification; require regeneration of the affected section.
 *   REPAIRABLE — auto-normalize inline; do not block certification.
 *
 * Error code prefix convention:
 *   ECG_AUTH_*   — authority / score consistency
 *   ECG_IDENT_*  — identity separation between sections
 *   ECG_EXEC_*   — executive summary contract
 *   ECG_OPP_*    — opportunity integrity
 *   ECG_TEXT_*   — text integrity
 *   ECG_REC_*    — recommendation integrity
 *   ECG_ART_*    — artifact completeness
 *   ECG_NORM_*   — repairable normalization (not fatal)
 */

/** Minimum Jaccard similarity that triggers an identity duplication fatal. */
const IDENTITY_OVERLAP_THRESHOLD = 0.72;

/** Minimum chars for a meaningful text field. */
const MIN_MEANINGFUL_LENGTH = 20;

/** Regex that matches a score-like number that does NOT equal the canonical score. */
const SCORE_MENTION_RE = /\b(\d{1,3})\/100\b/g;

/** Broken-word detector: non-whitespace chars run that ends mid-word (no punctuation, not end of string). */
const TRUNCATED_WORD_RE = /[a-z]{4,}[^a-z\s.!?,;:'")\]}\-—–]\s/i;

/** Placeholder phrases that indicate unfilled template slots. */
const PLACEHOLDER_PATTERNS = [
  /\[insert\b/i,
  /\bTBD\b/,
  /\bfiller\b/i,
  /lorem ipsum/i,
  /\bPlaceholder\b/i,
  /\bN\/A\b/,
  /\bundefined\b/,
  /\bnull\b/,
];

export type ECGSeverity = 'FATAL' | 'REPAIRABLE';

export interface ECGInvariant {
  /** Unique invariant identifier. */
  code: string;
  severity: ECGSeverity;
  /** Human-readable failure message. */
  message: string;
  /** Section of the artifact that failed. */
  section: string;
}

export interface ECGRepair {
  /** Which ECG_NORM_* code was auto-applied. */
  code: string;
  field: string;
  before: string;
  after: string;
}

export type ECGStatus = 'CERTIFIED' | 'CERTIFICATION_FAILED';

export interface ECGResult {
  status: ECGStatus;
  /** All invariant violations found, fatal and repairable. */
  violations: ECGInvariant[];
  /** Auto-applied cosmetic repairs (only when status === CERTIFIED). */
  repairs: ECGRepair[];
  /** Subset of violations with severity FATAL. */
  fatal: ECGInvariant[];
  /** Subset of violations with severity REPAIRABLE (applied inline). */
  repairable: ECGInvariant[];
  /** ISO timestamp of certification attempt. */
  certified_at: string;
  /** Summary string for logging. */
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function norm(text: string | null | undefined): string {
  return (text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function meaningful(text: string | null | undefined, minLen = MIN_MEANINGFUL_LENGTH): boolean {
  return (text ?? '').trim().length >= minLen;
}

function jaccardWords(a: string, b: string): number {
  const wordsA = new Set(norm(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(norm(b).split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / (wordsA.size + wordsB.size - intersection);
}

function isSubstantiallyIdentical(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return jaccardWords(a, b) >= IDENTITY_OVERLAP_THRESHOLD;
}

function firstChar(text: string): string {
  return (text ?? '').trim().charAt(0);
}

function lastChar(text: string): string {
  const t = (text ?? '').trim();
  return t.charAt(t.length - 1);
}

function capitalizeFirst(text: string): string {
  const t = (text ?? '').trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function ensureTerminalPunctuation(text: string): string {
  const t = (text ?? '').trim();
  if (!t) return t;
  const last = t.charAt(t.length - 1);
  if ('.!?'.includes(last)) return t;
  return t + '.';
}

function hasTruncatedWord(text: string): boolean {
  // Check for words ending mid-token — common sign of a 750-char substr truncation.
  // Look for: a word that ends without space/punctuation before end-of-string,
  // and the string ends on a non-sentence-ending character.
  const t = (text ?? '').trim();
  if (!t) return false;
  const lastChar2 = t.charAt(t.length - 1);
  // If it ends with ellipsis we already repaired it upstream — pass.
  if (t.endsWith('…') || t.endsWith('...')) return false;
  // If it ends in a letter and the last "word" is suspiciously short or cut, flag it.
  if (/[a-z]$/i.test(lastChar2)) {
    // Last token — check if the final word looks complete (has vowels, reasonable length)
    const tokens = t.split(/\s+/);
    const last = tokens[tokens.length - 1];
    // A word ending mid-token: fewer than 3 chars or ends abruptly on a consonant cluster
    if (last.length < 3) return true;
    // If the string ends on a recognizable fragment like "occasiona" (vowel-ending abbreviation)
    // We check: does the last word pass a basic dictionary-suffix heuristic?
    // Simple heuristic: if the last char is 'a','e','i','o','u' and the word is 5+ chars,
    // it might be truncated (e.g. "occasiona", "particula", "specifica").
    if (last.length >= 5 && /[aeiou]$/i.test(last) && !/(?:tion|ance|ence|ure|age|ive|ize|ise|ate|ous|ful|ness|ment|ity|ary|ory|ery|ery|ing|ed|er|est|al|ic|ical)$/i.test(last)) {
      return true;
    }
  }
  return TRUNCATED_WORD_RE.test(text);
}

function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(text));
}

function extractScoreMentions(text: string): number[] {
  const matches: number[] = [];
  const re = new RegExp(SCORE_MENTION_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push(parseInt(m[1], 10));
  }
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input shape (subset of evaluation_result_v2 we need to certify)
// ─────────────────────────────────────────────────────────────────────────────

export interface ECGOverview {
  overall_score_0_100?: number | null;
  verdict?: string | null;
  one_paragraph_summary?: string | null;
  one_sentence_pitch?: string | null;
  one_paragraph_pitch?: string | null;
  top_3_strengths?: string[] | null;
  top_3_risks?: string[] | null;
}

export interface ECGEnrichment {
  premise?: string | null;
  diagnosed_genre?: string | null;
  target_audience?: string | null;
}

export interface ECGRecommendation {
  action?: string | null;
  why?: string | null;
}

export interface ECGRecommendations {
  quick_wins?: ECGRecommendation[] | null;
  strategic_revisions?: ECGRecommendation[] | null;
}

export interface ECGCriterion {
  key?: string | null;
  final_score_0_10?: number | null;
  final_rationale?: string | null;
  recommendations?: Array<{ action?: string | null }> | null;
}

export interface ECGGovernance {
  confidence?: number | null;
  confidence_label?: string | null;
}

export interface ECGInput {
  /** The computed canonical overall score — the only authority. */
  canonicalScore: number;
  overview: ECGOverview;
  enrichment?: ECGEnrichment | null;
  recommendations?: ECGRecommendations | null;
  criteria?: ECGCriterion[] | null;
  governance?: ECGGovernance | null;
  /** Raw manuscript text for anchor verification (optional — ECG degrades gracefully). */
  manuscriptText?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization helpers (REPAIRABLE auto-repairs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a recommendation action string:
 *   - Capitalize first letter
 *   - Ensure terminal punctuation
 *   - Collapse multiple spaces
 */
export function normalizeRecommendationText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let t = text.trim().replace(/\s+/g, ' ');
  t = capitalizeFirst(t);
  t = ensureTerminalPunctuation(t);
  return t;
}

/**
 * Rewrite score mentions in the executive summary to match the canonical score.
 * Only touches /\d{1,3}\/100/ patterns — never alters surrounding prose.
 */
export function injectCanonicalScore(summary: string, canonicalScore: number): string {
  if (!summary) return summary;
  return summary.replace(/\b\d{1,3}\/100\b/g, `${canonicalScore}/100`);
}

/**
 * Trim a text string to at most `maxLength` chars at a word boundary,
 * appending an ellipsis. Never cuts mid-word.
 */
export function trimAtWordBoundary(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  // Find the last space before maxLength - 1 (leave room for ellipsis char)
  const candidate = text.substring(0, maxLength - 1);
  const lastSpace = candidate.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.6) {
    // Trim trailing punctuation before ellipsis
    return candidate.substring(0, lastSpace).replace(/[\s,;:.\u2014\-]+$/u, '') + '\u2026';
  }
  // No good space found — trim at boundary and append ellipsis
  return candidate.replace(/[\s,;:.\u2014\-]+$/u, '') + '\u2026';
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual invariant checkers
// ─────────────────────────────────────────────────────────────────────────────

function checkScoreAuthority(input: ECGInput): ECGInvariant[] {
  const violations: ECGInvariant[] = [];
  const reported = input.overview.overall_score_0_100;

  // AUTH-1: Overview score must equal canonical
  if (reported !== input.canonicalScore) {
    violations.push({
      code: 'ECG_AUTH_SCORE_MISMATCH',
      severity: 'FATAL',
      message: `Overview score ${reported} does not equal canonical score ${input.canonicalScore}. These must be identical.`,
      section: 'overview.overall_score_0_100',
    });
  }

  // AUTH-2: Executive summary must not reference a different score
  const summary = input.overview.one_paragraph_summary ?? '';
  const mentions = extractScoreMentions(summary);
  const wrongMentions = mentions.filter((s) => s !== input.canonicalScore);
  if (wrongMentions.length > 0) {
    violations.push({
      code: 'ECG_AUTH_EXEC_SUMMARY_SCORE_MISMATCH',
      severity: 'FATAL',
      message: `Executive summary references score(s) ${wrongMentions.join(', ')}/100 but canonical score is ${input.canonicalScore}/100. Executive summary may not independently determine the score.`,
      section: 'overview.one_paragraph_summary',
    });
  }

  // AUTH-3: Criterion scores must be in valid range
  const badCriteria = (input.criteria ?? []).filter((c) => {
    const s = c.final_score_0_10;
    return s !== null && s !== undefined && (!Number.isInteger(s) || s < 0 || s > 10);
  });
  if (badCriteria.length > 0) {
    violations.push({
      code: 'ECG_AUTH_CRITERION_SCORE_RANGE',
      severity: 'FATAL',
      message: `${badCriteria.length} criterion/criteria have scores outside 0–10 integer range: ${badCriteria.map((c) => `${c.key}=${c.final_score_0_10}`).join(', ')}.`,
      section: 'criteria[].final_score_0_10',
    });
  }

  return violations;
}

function checkIdentitySeparation(input: ECGInput): ECGInvariant[] {
  const violations: ECGInvariant[] = [];
  const summary = input.overview.one_paragraph_summary ?? '';
  const sentence = input.overview.one_sentence_pitch ?? '';
  const paragraph = input.overview.one_paragraph_pitch ?? '';
  const premise = input.enrichment?.premise ?? '';

  // Only check non-empty pairs — empty fields are caught by completeness checks.
  const pairs: Array<[string, string, string, string]> = [
    [sentence, paragraph, 'one_sentence_pitch', 'one_paragraph_pitch'],
    [sentence, summary, 'one_sentence_pitch', 'one_paragraph_summary'],
    [paragraph, summary, 'one_paragraph_pitch', 'one_paragraph_summary'],
    [sentence, premise, 'one_sentence_pitch', 'premise'],
    [paragraph, premise, 'one_paragraph_pitch', 'premise'],
  ];

  for (const [a, b, aLabel, bLabel] of pairs) {
    if (!meaningful(a) || !meaningful(b)) continue;
    if (isSubstantiallyIdentical(a, b)) {
      violations.push({
        code: 'ECG_IDENT_DUPLICATION',
        severity: 'FATAL',
        message: `"${aLabel}" and "${bLabel}" are substantially identical (Jaccard ≥ ${IDENTITY_OVERLAP_THRESHOLD} or containment). These fields serve distinct editorial purposes and must not share content.`,
        section: `${aLabel} / ${bLabel}`,
      });
    }
  }

  return violations;
}

function checkExecutiveSummaryContract(input: ECGInput): ECGInvariant[] {
  const violations: ECGInvariant[] = [];
  const summary = (input.overview.one_paragraph_summary ?? '').trim();

  if (!meaningful(summary)) {
    violations.push({
      code: 'ECG_EXEC_MISSING',
      severity: 'FATAL',
      message: 'Executive summary (one_paragraph_summary) is absent or too short. It must answer: why this score, strongest craft elements, principal blocker, first revision priority.',
      section: 'overview.one_paragraph_summary',
    });
    return violations;
  }

  // EXEC-2: Must not read like a pitch (marketing / back-cover language)
  const pitchPhrases = [
    /\ba\s+\w+[\w\s]+\b(must|will|can)\b/i,
    /\bgrab\b.*\breader\b/i,
    /\bpage-turner\b/i,
    /\bcan't put it down\b/i,
  ];
  const hasPitchLanguage = pitchPhrases.some((p) => p.test(summary));
  if (hasPitchLanguage) {
    violations.push({
      code: 'ECG_EXEC_PITCH_LANGUAGE',
      severity: 'FATAL',
      message: 'Executive summary contains marketing/pitch language. It must be an editorial diagnostic, not jacket copy.',
      section: 'overview.one_paragraph_summary',
    });
  }

  // EXEC-3: Should contain evaluation language (criterion reference, score language)
  const hasEvalLanguage = /\b(criterion|criteria|score|revision|craft|narrative|prose|pacing|voice|dialogue|character)\b/i.test(summary);
  if (!hasEvalLanguage) {
    violations.push({
      code: 'ECG_EXEC_NO_EVAL_LANGUAGE',
      severity: 'FATAL',
      message: 'Executive summary does not contain evaluation language (criterion names, score references, or revision direction). It must diagnose, not describe.',
      section: 'overview.one_paragraph_summary',
    });
  }

  // EXEC-4: Truncation check
  if (hasTruncatedWord(summary)) {
    violations.push({
      code: 'ECG_TEXT_TRUNCATED_WORD',
      severity: 'FATAL',
      message: `Executive summary appears to contain a truncated word or incomplete sentence. Likely caused by a hard character-count cut mid-token. Regenerate or trim at a word boundary.`,
      section: 'overview.one_paragraph_summary',
    });
  }

  // EXEC-5: Placeholder text
  if (hasPlaceholder(summary)) {
    violations.push({
      code: 'ECG_TEXT_PLACEHOLDER',
      severity: 'FATAL',
      message: 'Executive summary contains placeholder text (e.g. [insert], TBD, N/A). Replace with generated content.',
      section: 'overview.one_paragraph_summary',
    });
  }

  return violations;
}

function checkTextIntegrity(input: ECGInput): ECGInvariant[] {
  const violations: ECGInvariant[] = [];

  const textFields: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'one_sentence_pitch', value: input.overview.one_sentence_pitch },
    { label: 'one_paragraph_pitch', value: input.overview.one_paragraph_pitch },
    { label: 'premise', value: input.enrichment?.premise },
    ...(input.overview.top_3_strengths ?? []).map((s, i) => ({ label: `top_3_strengths[${i}]`, value: s })),
    ...(input.overview.top_3_risks ?? []).map((s, i) => ({ label: `top_3_risks[${i}]`, value: s })),
  ];

  for (const { label, value } of textFields) {
    if (!value?.trim()) continue;
    if (hasTruncatedWord(value)) {
      violations.push({
        code: 'ECG_TEXT_TRUNCATED_WORD',
        severity: 'FATAL',
        message: `Field "${label}" appears to contain a truncated word or incomplete sentence. Trim at a word boundary before persistence.`,
        section: label,
      });
    }
    if (hasPlaceholder(value)) {
      violations.push({
        code: 'ECG_TEXT_PLACEHOLDER',
        severity: 'FATAL',
        message: `Field "${label}" contains placeholder text. Replace with generated content.`,
        section: label,
      });
    }
  }

  // Criterion rationales
  for (const criterion of input.criteria ?? []) {
    const r = criterion.final_rationale ?? '';
    if (r.trim().length > 0 && hasPlaceholder(r)) {
      violations.push({
        code: 'ECG_TEXT_PLACEHOLDER',
        severity: 'FATAL',
        message: `Criterion "${criterion.key}" rationale contains placeholder text.`,
        section: `criteria[${criterion.key}].final_rationale`,
      });
    }
  }

  return violations;
}

function checkRecommendationIntegrity(input: ECGInput): ECGInvariant[] {
  const violations: ECGInvariant[] = [];
  const allRecs: Array<{ action: string; source: string }> = [];

  for (const rec of input.recommendations?.quick_wins ?? []) {
    if (rec.action?.trim()) allRecs.push({ action: rec.action.trim(), source: 'quick_wins' });
  }
  for (const rec of input.recommendations?.strategic_revisions ?? []) {
    if (rec.action?.trim()) allRecs.push({ action: rec.action.trim(), source: 'strategic_revisions' });
  }

  for (const { action, source } of allRecs) {
    // REC-1: Must start with capital letter (after normalization — warn only if somehow still wrong)
    if (firstChar(action) !== firstChar(action).toUpperCase()) {
      violations.push({
        code: 'ECG_REC_LOWERCASE_START',
        severity: 'REPAIRABLE',
        message: `Recommendation in "${source}" starts with a lowercase letter: "${action.substring(0, 60)}…". Capitalizing automatically.`,
        section: `recommendations.${source}[].action`,
      });
    }

    // REC-2: Must end with punctuation
    const last = lastChar(action);
    if (!'.!?)'.includes(last)) {
      violations.push({
        code: 'ECG_REC_MISSING_TERMINAL_PUNCT',
        severity: 'REPAIRABLE',
        message: `Recommendation in "${source}" does not end with punctuation: "…${action.substring(Math.max(0, action.length - 40))}". Adding period automatically.`,
        section: `recommendations.${source}[].action`,
      });
    }

    // REC-3: Must be substantive (min length)
    if (action.length < 50) {
      violations.push({
        code: 'ECG_REC_TOO_SHORT',
        severity: 'FATAL',
        message: `Recommendation in "${source}" is shorter than 50 chars: "${action}". Must be actionable.`,
        section: `recommendations.${source}[].action`,
      });
    }

    // REC-4: Must not be a placeholder
    if (hasPlaceholder(action)) {
      violations.push({
        code: 'ECG_REC_PLACEHOLDER',
        severity: 'FATAL',
        message: `Recommendation in "${source}" contains placeholder text: "${action.substring(0, 80)}".`,
        section: `recommendations.${source}[].action`,
      });
    }
  }

  return violations;
}

function checkArtifactCompleteness(input: ECGInput): ECGInvariant[] {
  const violations: ECGInvariant[] = [];

  // ART-1: Required overview fields
  if (!meaningful(input.overview.one_paragraph_summary)) {
    violations.push({
      code: 'ECG_ART_MISSING_EXEC_SUMMARY',
      severity: 'FATAL',
      message: 'Required field overview.one_paragraph_summary is absent or empty.',
      section: 'overview.one_paragraph_summary',
    });
  }
  if (!meaningful(input.overview.one_sentence_pitch)) {
    violations.push({
      code: 'ECG_ART_MISSING_SENTENCE_PITCH',
      severity: 'FATAL',
      message: 'Required field overview.one_sentence_pitch is absent or empty. Pass 3 must generate a distinct market hook.',
      section: 'overview.one_sentence_pitch',
    });
  }
  if (!meaningful(input.overview.one_paragraph_pitch)) {
    violations.push({
      code: 'ECG_ART_MISSING_PARAGRAPH_PITCH',
      severity: 'FATAL',
      message: 'Required field overview.one_paragraph_pitch is absent or empty. Pass 3 must generate a distinct story synopsis.',
      section: 'overview.one_paragraph_pitch',
    });
  }
  if (!meaningful(input.enrichment?.premise)) {
    violations.push({
      code: 'ECG_ART_MISSING_PREMISE',
      severity: 'FATAL',
      message: 'Required field enrichment.premise is absent or empty.',
      section: 'enrichment.premise',
    });
  }

  // ART-2: Strengths and risks
  const strengths = (input.overview.top_3_strengths ?? []).filter((s) => meaningful(s));
  if (strengths.length < 1) {
    violations.push({
      code: 'ECG_ART_MISSING_STRENGTHS',
      severity: 'FATAL',
      message: 'top_3_strengths is absent or has no meaningful entries.',
      section: 'overview.top_3_strengths',
    });
  }
  const risks = (input.overview.top_3_risks ?? []).filter((s) => meaningful(s));
  if (risks.length < 1) {
    violations.push({
      code: 'ECG_ART_MISSING_RISKS',
      severity: 'FATAL',
      message: 'top_3_risks is absent or has no meaningful entries.',
      section: 'overview.top_3_risks',
    });
  }

  // ART-3: Criteria rationales
  const criteriaWithoutRationale = (input.criteria ?? []).filter(
    (c) => c.final_score_0_10 !== null && c.final_score_0_10 !== undefined && !meaningful(c.final_rationale),
  );
  if (criteriaWithoutRationale.length > 0) {
    violations.push({
      code: 'ECG_ART_MISSING_RATIONALE',
      severity: 'FATAL',
      message: `${criteriaWithoutRationale.length} scored criterion/criteria missing rationale: ${criteriaWithoutRationale.map((c) => c.key).join(', ')}.`,
      section: 'criteria[].final_rationale',
    });
  }

  // ART-4: Governance confidence must be present
  if (input.governance?.confidence === null || input.governance?.confidence === undefined) {
    violations.push({
      code: 'ECG_ART_MISSING_CONFIDENCE',
      severity: 'FATAL',
      message: 'governance.confidence is absent. Confidence must be set before certification.',
      section: 'governance.confidence',
    });
  }

  // ART-5: At least one recommendation
  const totalRecs =
    (input.recommendations?.quick_wins?.length ?? 0) +
    (input.recommendations?.strategic_revisions?.length ?? 0);
  if (totalRecs === 0) {
    violations.push({
      code: 'ECG_ART_MISSING_RECOMMENDATIONS',
      severity: 'FATAL',
      message: 'No quick_wins or strategic_revisions present. Every evaluation must produce at least one actionable recommendation.',
      section: 'recommendations',
    });
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-repair pass (REPAIRABLE invariants only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply all safe (REPAIRABLE) normalizations to the input in-place.
 * Returns a list of repairs made.
 *
 * Called only when there are no FATAL violations — we do not repair dirty artifacts.
 */
export function applyECGRepairs(input: ECGInput): ECGRepair[] {
  const repairs: ECGRepair[] = [];

  // Repair recommendation capitalization + terminal punctuation
  function repairRecs(recs: ECGRecommendation[] | null | undefined, source: string) {
    for (const rec of recs ?? []) {
      if (!rec.action?.trim()) continue;
      const before = rec.action;
      const after = normalizeRecommendationText(before);
      if (after !== before) {
        rec.action = after;
        repairs.push({ code: 'ECG_NORM_REC_TEXT', field: `recommendations.${source}[].action`, before, after });
      }
    }
  }

  repairRecs(input.recommendations?.quick_wins, 'quick_wins');
  repairRecs(input.recommendations?.strategic_revisions, 'strategic_revisions');

  // Repair exec summary score references — inject canonical score
  const rawSummary = input.overview.one_paragraph_summary ?? '';
  if (rawSummary) {
    const repaired = injectCanonicalScore(rawSummary, input.canonicalScore);
    if (repaired !== rawSummary) {
      input.overview.one_paragraph_summary = repaired;
      repairs.push({
        code: 'ECG_NORM_SCORE_INJECT',
        field: 'overview.one_paragraph_summary',
        before: rawSummary,
        after: repaired,
      });
    }
  }

  return repairs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main gate function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the Evaluation Certification Gate.
 *
 * @param input  - Subset of evaluation_result_v2 needed for certification.
 * @param repair - When true, auto-apply REPAIRABLE normalizations to `input` in-place
 *                 (only when no FATAL violations exist). Default: true.
 *
 * @returns ECGResult — check `status` first. Only persist when status === 'CERTIFIED'.
 */
export function runEvaluationCertificationGate(
  input: ECGInput,
  repair = true,
): ECGResult {
  const certified_at = new Date().toISOString();
  const violations: ECGInvariant[] = [];

  // ── Run all invariant checkers ──────────────────────────────────────────
  violations.push(...checkScoreAuthority(input));
  violations.push(...checkIdentitySeparation(input));
  violations.push(...checkExecutiveSummaryContract(input));
  violations.push(...checkTextIntegrity(input));
  violations.push(...checkRecommendationIntegrity(input));
  violations.push(...checkArtifactCompleteness(input));

  const fatal = violations.filter((v) => v.severity === 'FATAL');
  const repairable = violations.filter((v) => v.severity === 'REPAIRABLE');

  // ── Apply repairs only when no fatal violations ─────────────────────────
  let repairs: ECGRepair[] = [];
  if (fatal.length === 0 && repair) {
    repairs = applyECGRepairs(input);
  }

  const status: ECGStatus = fatal.length === 0 ? 'CERTIFIED' : 'CERTIFICATION_FAILED';

  const summary =
    status === 'CERTIFIED'
      ? `ECG CERTIFIED — ${repairs.length} cosmetic repair(s) applied. Score=${input.canonicalScore}.`
      : `ECG CERTIFICATION_FAILED — ${fatal.length} fatal violation(s), ${repairable.length} repairable. Score=${input.canonicalScore}. Fatal: ${fatal.map((v) => v.code).join(', ')}.`;

  return {
    status,
    violations,
    repairs,
    fatal,
    repairable,
    certified_at,
    summary,
  };
}

/**
 * Build an ECGInput from a fully-assembled evaluation_result_v2 object
 * and the canonicalScore computed by the weighted scoring engine.
 */
export function buildECGInput(
  result: {
    overview?: ECGOverview | null;
    enrichment?: ECGEnrichment | null;
    recommendations?: ECGRecommendations | null;
    criteria?: ECGCriterion[] | null;
    governance?: ECGGovernance | null;
  },
  canonicalScore: number,
  manuscriptText?: string | null,
): ECGInput {
  return {
    canonicalScore,
    overview: result.overview ?? {},
    enrichment: result.enrichment ?? null,
    recommendations: result.recommendations ?? null,
    criteria: result.criteria ?? null,
    governance: result.governance ?? null,
    manuscriptText: manuscriptText ?? null,
  };
}
