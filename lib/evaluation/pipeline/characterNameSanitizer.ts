/**
 * Deterministic Character Name Sanitizer
 *
 * Post-processing gate that scans all free-text fields in Pass 3 synthesis
 * output and replaces blocked character names with canonical names from
 * the story ledger. This is the belt-and-suspenders layer — prompt
 * enforcement asks the LLM not to use blocked names, but this gate
 * deterministically catches any that leak through.
 *
 * Enforcement points:
 * - overall.one_paragraph_summary
 * - overall.one_sentence_pitch
 * - overall.one_paragraph_pitch
 * - overall.top_3_strengths[]
 * - overall.top_3_risks[]
 * - per-criterion: final_rationale, fit_summary, gap_summary
 * - per-recommendation: action, symptom, cause, rationale, fix_direction,
 *   specific_fix, reader_effect, mechanism, expected_impact, anchor_snippet,
 *   mistake_proofing, candidate_text_a/b/c
 */

import { BLOCKED_CANONICAL_NAMES } from "./pass1aQuarantine";

// ── Build replacement patterns ──────────────────────────────────────────────

/**
 * Build a regex that matches a blocked word used as a character name.
 * Matches patterns like:
 *   - "No's" (possessive)
 *   - "No/Michael" (slash-alias)
 *   - Standalone "No" at word boundary when followed by name-like context
 *     (e.g. "'s", "/", " is", " was", "'s ")
 *
 * We match case-insensitively on the blocked word but only when it appears
 * in a name-like position (possessive, slash-alias, or capitalized standalone
 * followed by a verb / action context).
 */
function buildBlockedNamePatterns(blockedWords: string[]): RegExp[] {
  const patterns: RegExp[] = [];
  for (const word of blockedWords) {
    // Escape special regex characters
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Case-sensitive: match capitalized form (as used for character names)
    const capitalized = escaped.charAt(0).toUpperCase() + escaped.slice(1);

    // Pattern 1: "No's" — possessive form (strong signal: dialogue word used as name)
    patterns.push(new RegExp(`\\b${capitalized}['’]s\\b`, "g"));

    // Pattern 2: "No/Name" — slash-alias form
    patterns.push(new RegExp(`\\b${capitalized}/[A-Z]\\w+`, "g"));

    // Pattern 3: "No notices", "No is", "No was" — subject position
    // Only for very common blocked words that the LLM frequently promotes
    if (["no", "yes", "oh", "hey", "well", "so", "cost"].includes(word.toLowerCase())) {
      patterns.push(
        new RegExp(
            `\\b${capitalized}(?= (?:[a-z]+ly )?(?:is|was|has|had|will|would|could|should|can|may|might|must|does|did|notices|realizes|sees|hears|feels|thinks|knows|finds|takes|makes|gives|comes|goes|runs|walks|looks|turns|moves|grabs|reaches|struggles|survives|escapes|arrives|discovers|understands|remembers|recognizes|decides|accepts|refuses|demands|pleads|whispers|shouts|screams|cries|laughs|smiles|nods|shakes|watches|waits|stands|sits|lies|falls|rises|begins|starts|stops|continues|remains|becomes|appears|seems|demonstrates|reveals|shows|exhibits|displays|maintains|develops|navigates|confronts|faces|endures|experiences|observes|reacts|responds|adapts|transforms|evolves|emerges|represents|embodies|possesses|lacks|needs|wants|tries|attempts|manages|fails|succeeds|learns|teaches|leads|follows|delivers|drives|anchors|contrasts|counts|tallies|calculates|fixes|meets|encounters|visits|enters|races|pays|spends|saves|loses|gains|earns))\\b`,
          "g",
        ),
      );
    }
  }
  return patterns;
}

function isLikelyNonCharacterCanonicalName(name: string): boolean {
  return [
    /^cost$/i,
    /\btotal\s+cost\b/i,
    /\bcost\s+(?:tall(?:y|ies)|figure|ledger|accounting)\b/i,
    /\b(?:product|kit|box|bottle|dye|bleach)\b/i,
    /\b(?:store|shop|salon|drug\s+mart|clinic|warehouse)\b/i,
  ].some((pattern) => pattern.test(name));
}

function resolvePrimaryName(canonicalNames: string[]): string {
  const cleaned = canonicalNames
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter((name) => name.length > 0);

  if (cleaned.length === 0) return "the narrator";

  const narratorCandidate = cleaned.find((name) => /\b(narrator|protagonist)\b/i.test(name));
  if (narratorCandidate) return "the narrator";

  const preferred = cleaned.find(
    (name) => !isBlockedCharacterName(name) && !isLikelyNonCharacterCanonicalName(name),
  );
  return preferred ?? cleaned[0];
}

function matchIsSentenceInitial(text: string, offset: number): boolean {
  const before = text.slice(0, offset).trimEnd();
  return before.length === 0 || /[.!?]\s*$/.test(before);
}

function preserveInitialCapitalization(replacement: string, text: string, offset: number): string {
  if (!matchIsSentenceInitial(text, offset)) return replacement;
  return replacement.charAt(0).toUpperCase() + replacement.slice(1);
}

function replaceCostSubjectFalseName(text: string, replacementName: string): string {
  const costSubjectPattern = /\bCost(?= (?:[a-z]+ly )?(?:is|was|has|had|needs|wants|tries|learns|counts|tallies|calculates|contrasts|fixes|meets|encounters|visits|enters|races|pays|spends|saves|loses|gains|remains|becomes|represents|embodies|anchors|drives|earns)\b)/g;
  costSubjectPattern.lastIndex = 0;
  return text.replace(costSubjectPattern, (_match, offset) =>
    preserveInitialCapitalization(replacementName, text, offset),
  );
}

// Pre-build patterns for the most dangerous blocked words
const TOP_BLOCKED_WORDS = [
  "no", "yes", "oh", "hey", "well", "so", "cost", "ok", "okay",
  "ah", "huh", "um", "uh", "sure", "right", "fine",
  "good", "bad", "please", "thanks", "sorry",
  "stop", "wait", "look", "listen", "come", "go", "run", "help",
];

const BLOCKED_NAME_PATTERNS = buildBlockedNamePatterns(TOP_BLOCKED_WORDS);

// ── Core sanitization ───────────────────────────────────────────────────────

/**
 * Sanitize a single text field: replace blocked character name references
 * with the best-matching canonical name from the ledger.
 *
 * @param text      The free-text field to sanitize
 * @param canonical Array of canonical character names from story ledger
 * @returns         Sanitized text with blocked names replaced
 */
export function sanitizeBlockedCharacterNames(
  text: string,
  canonicalNames: string[],
): string {
  if (!text) return text;
    if (!Array.isArray(canonicalNames) || canonicalNames.length === 0) return text;

  // The primary canonical name is the best replacement for any blocked word
  // used as a character reference (typically the protagonist).
  // We use the first canonical name as default fallback.
  const primaryName = resolvePrimaryName(canonicalNames);
  if (!primaryName) return text;

  let result = text;
  for (const pattern of BLOCKED_NAME_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    result = result.replace(pattern, (match, offset) => {
      const replacement = preserveInitialCapitalization(primaryName, result, offset);
      // For possessive: "No's" → "Michael Salter's"
      if (/[’']s$/i.test(match)) {
        return `${replacement}'s`;
      }
      // For slash-alias: "No/Michael" → "Michael Salter"
      if (match.includes("/")) {
        return replacement;
      }
      // For subject position: "No notices" → "Michael Salter notices"
      return replacement;
    });
  }

  result = replaceCostSubjectFalseName(result, primaryName);

  return result;
}

/**
 * Check whether a text field contains any blocked character name references.
 * Useful for diagnostics and testing.
 */
export function containsBlockedCharacterName(text: string): boolean {
  if (!text) return false;
  for (const pattern of BLOCKED_NAME_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}

/**
 * Deterministic guard: returns true when `name` is on the blocked list
 * and should never be used as a character name.
 */
export function isBlockedCharacterName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return BLOCKED_CANONICAL_NAMES.has(normalized);
}

// ── Synthesis output sanitization ───────────────────────────────────────────

/**
 * Sanitize all free-text fields in a Pass 3 synthesis output object.
 * This is the top-level entry point — call after parsing and before persistence.
 *
 * @param synthesis The SynthesisOutput object (mutated in place for efficiency)
 * @param canonical Array of canonical character names from story ledger
 * @returns         Count of fields that were modified
 */
export function sanitizeSynthesisCharacterNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  synthesis: any,
  canonicalNames: string[],
): number {
  if (!synthesis) return 0;

  let modified = 0;
  const clean = (text: string | undefined): string | undefined => {
    if (!text) return text;
    const cleaned = sanitizeBlockedCharacterNames(text, canonicalNames);
    if (cleaned !== text) modified++;
    return cleaned;
  };

  // ── Overall fields ──
  if (synthesis.overall) {
    synthesis.overall.one_paragraph_summary = clean(synthesis.overall.one_paragraph_summary) ?? synthesis.overall.one_paragraph_summary;
    synthesis.overall.one_sentence_pitch = clean(synthesis.overall.one_sentence_pitch);
    synthesis.overall.one_paragraph_pitch = clean(synthesis.overall.one_paragraph_pitch);
    if (Array.isArray(synthesis.overall.top_3_strengths)) {
      synthesis.overall.top_3_strengths = synthesis.overall.top_3_strengths.map(
        (s: string) => clean(s) ?? s,
      );
    }
    if (Array.isArray(synthesis.overall.top_3_risks)) {
      synthesis.overall.top_3_risks = synthesis.overall.top_3_risks.map(
        (s: string) => clean(s) ?? s,
      );
    }
  }

  // ── Per-criterion fields ──
  if (Array.isArray(synthesis.criteria)) {
    for (const criterion of synthesis.criteria) {
      criterion.final_rationale = clean(criterion.final_rationale) ?? criterion.final_rationale;
      criterion.fit_summary = clean(criterion.fit_summary);
      criterion.gap_summary = clean(criterion.gap_summary);

      if (Array.isArray(criterion.recommendations)) {
        for (const rec of criterion.recommendations) {
          rec.action = clean(rec.action) ?? rec.action;
          rec.symptom = clean(rec.symptom) ?? rec.symptom;
          rec.cause = clean(rec.cause);
          rec.rationale = clean(rec.rationale);
          rec.fix_direction = clean(rec.fix_direction);
          rec.specific_fix = clean(rec.specific_fix) ?? rec.specific_fix;
          rec.reader_effect = clean(rec.reader_effect) ?? rec.reader_effect;
          rec.mechanism = clean(rec.mechanism) ?? rec.mechanism;
          rec.expected_impact = clean(rec.expected_impact) ?? rec.expected_impact;
          rec.anchor_snippet = clean(rec.anchor_snippet) ?? rec.anchor_snippet;
          rec.mistake_proofing = clean(rec.mistake_proofing);
          rec.candidate_text_a = clean(rec.candidate_text_a);
          rec.candidate_text_b = clean(rec.candidate_text_b);
          rec.candidate_text_c = clean(rec.candidate_text_c);
        }
      }
    }
  }

  return modified;
}
