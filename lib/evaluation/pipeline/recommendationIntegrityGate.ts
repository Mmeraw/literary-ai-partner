/**
 * Recommendation Integrity Gate — shared SIPOC-aligned admission gate.
 *
 * Governs all author-facing recommendation text:
 *   - Evaluation report recommendations (qualityGate.ts)
 *   - Revise Queue / workbench cards (reviseAdmissionGate.ts)
 *
 * Three validation layers:
 *   Layer 1 — Required fields present and populated
 *   Layer 2 — Sentence completeness (no fragments, orphans, splices, truncations)
 *   Layer 3 — Editorial usefulness (field-specific strictness + specificity scoring)
 *
 * Four quality tiers derived from component-based scoring:
 *   FAIL (0–2)          → reject, never author-facing
 *   PASS_MINIMUM (3–4)  → evaluation reports only
 *   PASS_STRONG (5–6)   → evaluation reports + Revise Queue
 *   PASS_DREAM_STANDARD (7+) → preferred, benchmark, training corpus
 *
 * Governance reference:
 *   docs/gold-standards/recommendation-integrity-dream-standard.md
 *
 * Fail-closed: reject → regenerate once → if still failing → quarantine (admin-only).
 * Principle: better 8 excellent recommendations than 14 with one broken sentence.
 */

/** Governance artifact path — prompts/gates must not drift from this standard. */
export const DREAM_STANDARD_DOC =
  "docs/gold-standards/recommendation-integrity-dream-standard.md";

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2: Sentence Completeness
// ─────────────────────────────────────────────────────────────────────────────

/** Orphan conjunctions at field start signal stitched LLM output. */
const ORPHAN_CONJUNCTIONS = [
  "however", "nonetheless", "nevertheless", "therefore", "meanwhile",
  "because", "although", "while", "whereas", "furthermore", "moreover",
  "thus", "hence",
];

/** Multi-word malformed connectors observed in Sister eval (777afd5d). */
const MALFORMED_CONNECTORS: RegExp[] = [
  /\bcan nonetheless,?\s/i,
  /\bwould some\b/i,
  /\bhelping the passage however\b/i,
  /\bcan nevertheless,?\s/i,
  /\bwould the\s+\w+\s+however\b/i,
  /\band can\s+\w+\s+nonetheless\b/i,
];

/** Fragment patterns indicating broken LLM stitching. */
const FRAGMENT_PATTERNS: RegExp[] = [
  /^(which|who|whom)\s+/i,
  /\b(can|would|should|could|might)\s+(nonetheless|nevertheless|however|some)\b/i,
];

const TRUNCATION_ENDINGS = /[,—–\-]\s*$/;
const TRUNCATION_CONJUNCTION_ENDINGS =
  /\b(and|or|but|so|because|although|however|nonetheless|while|that|which|whether)\s*$/i;

function hasRepeatedClause(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  if (words.length < 12) return false;
  const windowSize = 6;
  const seen = new Set<string>();
  for (let i = 0; i <= words.length - windowSize; i++) {
    const chunk = words.slice(i, i + windowSize).join(" ");
    if (seen.has(chunk)) return true;
    seen.add(chunk);
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3: Field-Specific Strictness
// ─────────────────────────────────────────────────────────────────────────────

/** Causal language required in `cause` field. */
const CAUSAL_MARKERS =
  /\b(because|since|due to|as a result|caused by|results from|stems from|arises from|given that|so that|leads to|the reason|produces|creates|prevents|occurs when|happens when)\b/i;

/** Reader-facing consequence language required in `reader_effect` field. */
const READER_EFFECT_MARKERS =
  /\b(reader|clarity|engagement|immersion|momentum|tension|empathy|investment|pacing|rhythm|understanding|experience|emotional|trust|satisfaction|impact|stakes|suspense|urgency|coherence|compelling|resonance)\b/i;

/** Manuscript-evidence markers required in `symptom` field. */
const SYMPTOM_EVIDENCE_MARKERS =
  /\b(passage|scene|chapter|paragraph|line|sentence|page|section|dialogue|narrative|exposition|beat|moment|exchange|description|near|around|at|in the)\b|[""\u201c\u201d]/i;

/** Vague anchor phrases that don't locate anything in the manuscript. */
const VAGUE_ANCHOR_PATTERNS: RegExp[] = [
  /^(the passage|the scene|the section|the text|the writing|the prose|the chapter|the manuscript)\.?$/i,
  /^(in the passage|in the scene|in the section|in the text)\.?$/i,
  /^(this passage|this scene|this section)\.?$/i,
];

/** Generic workshop language — insufficient by itself without concrete evidence. */
const GENERIC_WORKSHOP_PHRASES: RegExp[] = [
  /^insert (one |a )?concrete stakes beat\.?$/i,
  /^add (a |one )?sensory detail(s)?\.?$/i,
  /^tighten (the )?prose\.?$/i,
  /^strengthen (the )?dialogue\.?$/i,
  /^add more tension\.?$/i,
  /^improve (the )?(pacing|scene|writing)\.?$/i,
  /^show,? don'?t tell\.?$/i,
  /^deepen (the )?characterization\.?$/i,
  /^raise the stakes\.?$/i,
  /^increase (the )?(conflict|tension|engagement)\.?$/i,
  /^add (an? )?(external )?action (beat|trigger)\.?$/i,
  /^cut (one |a )?reflective sentence\.?$/i,
  /^improve (the )?scene\.?$/i,
  // P2: expanded generic prescription detection
  /^deepen (the )?(thematic )?exploration of .{0,30}\.?$/i,
  /^incorporate more .{0,30}\.?$/i,
  /^add more subtext\.?$/i,
  /^strengthen (the )?emotional stakes\.?$/i,
  /^add more (sensory|concrete|specific) detail(s)?\.?$/i,
  /^increase (narrative )?(urgency|momentum|propulsion)\.?$/i,
  /^develop (the )?(character|theme|conflict) (more|further)\.?$/i,
  /^make (the )?(scene|dialogue|prose) (stronger|more engaging|more vivid)\.?$/i,
  /^heighten (the )?(dramatic|emotional|narrative) (tension|stakes|impact)\.?$/i,
  /^introduce more (conflict|tension|subtext) (in|to) (the )?dialogue\.?$/i,
  /^add (a )?dramatic question\.?$/i,
  /^create (a |more )?sense of urgency\.?$/i,
];

/** Generic effect phrases that are too vague to be useful standalone. */
const GENERIC_EFFECT_PHRASES: RegExp[] = [
  /^improves? (engagement|clarity|pacing|flow|immersion|impact)\.?$/i,
  /^increases? (engagement|clarity|tension|momentum)\.?$/i,
  /^enhances? (engagement|clarity|impact|flow)\.?$/i,
  /^strengthens? (the )?(scene|passage|pacing|narrative)\.?$/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared: Mid-sentence proper noun detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if text contains at least one mid-sentence capitalized word
 * (proper noun / character name / place name).
 *
 * Rule: a capitalized word counts as specificity ONLY if it is NOT the first
 * token of a sentence. Sentence-initial capitals ("Add", "The", "Insert") are
 * just grammar, not manuscript evidence.
 *
 * "After Nicolas tells Mike..." → true (Nicolas, Mike are mid-sentence)
 * "Add one visible consequence..." → false (Add is sentence-initial)
 * "In the Toronto experiment..." → true (Toronto is mid-sentence)
 */
/**
 * Exported for testing. Name follows user's preferred convention.
 */
export function hasNonInitialProperNounReference(text: string): boolean {
  // A capitalized word preceded by a lowercase letter, comma, or semicolon + space.
  // This excludes sentence-initial caps like "Add", "The", "Insert".
  return /[a-z,;]\s+[A-Z][a-z]{2,}/.test(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrityField = {
  name: string;
  value: string;
};

export type IntegrityViolationCode =
  | "INCOMPLETE_FIELD"
  | "ORPHAN_CONJUNCTION"
  | "MALFORMED_CONNECTOR"
  | "SENTENCE_FRAGMENT"
  | "NO_LOWERCASE_OPENING"
  | "MISSING_TERMINAL_PUNCTUATION"
  | "REPEATED_CLAUSE"
  | "MID_SENTENCE_TRUNCATION"
  | "GENERIC_WORKSHOP_LANGUAGE"
  | "MISSING_SPECIFIC_ANCHOR"
  | "VAGUE_ANCHOR"
  | "MISSING_CAUSAL_LANGUAGE"
  | "MISSING_READER_CONSEQUENCE"
  | "MISSING_MANUSCRIPT_EVIDENCE"
  | "GENERIC_EFFECT_PHRASE";

export type IntegrityViolation = {
  field: string;
  code: IntegrityViolationCode;
  detail: string;
};

export type QualityTier =
  | "FAIL"
  | "PASS_MINIMUM"
  | "PASS_STRONG"
  | "PASS_DREAM_STANDARD";

export type RecommendationOriginQuality =
  | "RAW_PASS3"
  | "REGENERATED"
  | "HEALED"
  | "QUARANTINED";

export type DreamStandardFeature =
  | "character_named"
  | "scene_referenced"
  | "quoted_anchor"
  | "decision_identified"
  | "consequence_identified"
  | "reader_effect_explained"
  | "theme_connected";

export type IntegrityResult = {
  passed: boolean;
  tier: QualityTier;
  quality_score: number;
  violations: IntegrityViolation[];
  dream_standard_features: DreamStandardFeature[];
  origin_quality?: RecommendationOriginQuality;
};

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 + 3: Field-level checking
// ─────────────────────────────────────────────────────────────────────────────

function checkSentenceCompleteness(name: string, value: string): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];
  const trimmed = value.trim();
  if (trimmed.length === 0) return violations;

  const lowerTrimmed = trimmed.toLowerCase();

  // Malformed connector chains (exact Sister eval patterns)
  for (const pattern of MALFORMED_CONNECTORS) {
    if (pattern.test(trimmed)) {
      const match = trimmed.match(pattern);
      violations.push({
        field: name,
        code: "MALFORMED_CONNECTOR",
        detail: `Malformed connector: "${match?.[0] ?? trimmed.substring(0, 40)}"`,
      });
    }
  }

  // Orphan conjunction at field start
  // Field-aware exemptions: certain conjunctions are natural starters for specific fields.
  //   cause/mechanism:     may start with "because", "since" (causal language)
  //   reader_effect:       may start with "while", "although" (contrast is valid editorial prose)
  //   symptom:             may start with "while", "although" (describing manuscript state)
  //   action/fix_direction: no exemptions — should not start with vague connectors
  const fieldAppropriatConjunctions: Record<string, string[]> = {
    cause: ["because", "since", "although", "while"],
    mechanism: ["because", "since"],
    reader_effect: ["while", "although", "furthermore", "moreover"],
    expected_impact: ["while", "although", "furthermore", "moreover"],
    symptom: ["while", "although"],
  };
  const exemptions = fieldAppropriatConjunctions[name] ?? [];
  for (const orphan of ORPHAN_CONJUNCTIONS) {
    if (exemptions.includes(orphan)) continue;
    if (lowerTrimmed.startsWith(orphan + " ") || lowerTrimmed.startsWith(orphan + ",")) {
      violations.push({
        field: name,
        code: "ORPHAN_CONJUNCTION",
        detail: `Starts with orphan conjunction "${orphan}"`,
      });
      break;
    }
  }

  // Fragment patterns per sentence
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (s.length < 5) continue;
    for (const pattern of FRAGMENT_PATTERNS) {
      if (pattern.test(s)) {
        violations.push({
          field: name,
          code: "SENTENCE_FRAGMENT",
          detail: `Fragment: "${s.substring(0, 80)}${s.length > 80 ? "..." : ""}"`,
        });
        break;
      }
    }
  }

  // Lowercase opening (A3/A4/D2). Author-facing recommendation prose must open
  // with a capital letter. anchor_snippet is exempt — it is a verbatim quote and
  // may legitimately begin mid-sentence with a lowercase word.
  if (name !== "anchor_snippet") {
    const firstAlphaIdx = trimmed.search(/[A-Za-z]/);
    if (firstAlphaIdx !== -1 && /[a-z]/.test(trimmed[firstAlphaIdx])) {
      violations.push({
        field: name,
        code: "NO_LOWERCASE_OPENING",
        detail: `Opens with a lowercase letter: "${trimmed.substring(0, 40)}"`,
      });
    }
  }

  // Terminal punctuation
  if (!/[.!?)"']\s*$/.test(trimmed)) {
    violations.push({
      field: name,
      code: "MISSING_TERMINAL_PUNCTUATION",
      detail: `No terminal punctuation: "...${trimmed.slice(-40)}"`,
    });
  }

  // Repeated clause
  if (hasRepeatedClause(trimmed)) {
    violations.push({
      field: name,
      code: "REPEATED_CLAUSE",
      detail: "Contains repeated 6-word clause (copy artifact)",
    });
  }

  // Mid-sentence truncation
  if (TRUNCATION_ENDINGS.test(trimmed) || TRUNCATION_CONJUNCTION_ENDINGS.test(trimmed)) {
    violations.push({
      field: name,
      code: "MID_SENTENCE_TRUNCATION",
      detail: `Truncated: "...${trimmed.slice(-50)}"`,
    });
  }

  return violations;
}

function checkFieldStrictness(name: string, value: string): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];
  const trimmed = value.trim();
  if (trimmed.length === 0) return violations;

  // Field-specific strictness rules
  switch (name) {
    case "cause":
    case "mechanism":
      if (!CAUSAL_MARKERS.test(trimmed)) {
        violations.push({
          field: name,
          code: "MISSING_CAUSAL_LANGUAGE",
          detail: "Cause/mechanism field lacks causal language (because, due to, since, etc.)",
        });
      }
      break;

    case "reader_effect":
    case "expected_impact":
      if (!READER_EFFECT_MARKERS.test(trimmed)) {
        violations.push({
          field: name,
          code: "MISSING_READER_CONSEQUENCE",
          detail: "Reader effect field lacks reader-facing consequence language",
        });
      }
      // Generic effect phrase check
      for (const pattern of GENERIC_EFFECT_PHRASES) {
        if (pattern.test(trimmed)) {
          violations.push({
            field: name,
            code: "GENERIC_EFFECT_PHRASE",
            detail: `Generic effect phrase: "${trimmed.substring(0, 60)}"`,
          });
          break;
        }
      }
      break;

    case "symptom":
      if (!SYMPTOM_EVIDENCE_MARKERS.test(trimmed)) {
        violations.push({
          field: name,
          code: "MISSING_MANUSCRIPT_EVIDENCE",
          detail: "Symptom field lacks manuscript-facing evidence (no passage/scene/quote reference)",
        });
      }
      break;

    case "action":
    case "fix_direction":
    case "specific_fix":
      // Generic workshop language
      for (const pattern of GENERIC_WORKSHOP_PHRASES) {
        if (pattern.test(trimmed)) {
          violations.push({
            field: name,
            code: "GENERIC_WORKSHOP_LANGUAGE",
            detail: `Generic workshop phrase: "${trimmed.substring(0, 60)}"`,
          });
          break;
        }
      }
      break;

    case "anchor_snippet":
      // Vague anchor check
      for (const pattern of VAGUE_ANCHOR_PATTERNS) {
        if (pattern.test(trimmed)) {
          violations.push({
            field: name,
            code: "VAGUE_ANCHOR",
            detail: `Vague anchor: "${trimmed}" — must include quoted text or specific scene context`,
          });
          break;
        }
      }
      break;
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quality Scoring (component-based)
// ─────────────────────────────────────────────────────────────────────────────

function computeQualityScore(
  fields: IntegrityField[],
  violations: IntegrityViolation[],
  context?: { anchorSnippet?: string },
): { score: number; features: DreamStandardFeature[] } {
  let score = 0;
  const features: DreamStandardFeature[] = [];
  const allText = fields.map((f) => f.value).join(" ");

  // ── Positive signals (+1 each) ──────────────────────────────────────────

  // Character named: mid-sentence capitalized word (proper noun, not sentence-initial)
  if (hasNonInitialProperNounReference(allText)) {
    score += 1;
    features.push("character_named");
  }

  // Scene referenced — only counts when paired with a proper noun or quoted anchor.
  // Generic "the scene" alone is not specificity.
  const hasQuotedText = /[""\u201c\u201d][^"""\u201c\u201d]{5,}[""\u201c\u201d]/.test(allText) ||
    (context?.anchorSnippet != null && context.anchorSnippet.length > 10);
  const hasSceneWord = /\b(scene|chapter|passage|section|paragraph|beat|moment|exchange)\b/i.test(allText);
  if (hasSceneWord && (hasNonInitialProperNounReference(allText) || hasQuotedText)) {
    score += 1;
    features.push("scene_referenced");
  }

  // Quoted anchor
  if (/[""\u201c\u201d][^"""\u201c\u201d]{5,}[""\u201c\u201d]/.test(allText) || (context?.anchorSnippet && context.anchorSnippet.length > 10)) {
    score += 1;
    features.push("quoted_anchor");
  }

  // Decision identified
  if (/\b(decide|decision|choose|choice|confront|force|require|must|whether)\b/i.test(allText)) {
    score += 1;
    features.push("decision_identified");
  }

  // Consequence identified
  if (/\b(consequence|result|outcome|cost|impact|effect|shows?|reveals?|externaliz|dramatiz|converts?)\b/i.test(allText)) {
    score += 1;
    features.push("consequence_identified");
  }

  // Reader effect explained (non-generic)
  const readerEffectField = fields.find((f) => f.name === "reader_effect" || f.name === "expected_impact");
  if (readerEffectField && readerEffectField.value.trim().length >= 20 && READER_EFFECT_MARKERS.test(readerEffectField.value)) {
    const isGeneric = GENERIC_EFFECT_PHRASES.some((p) => p.test(readerEffectField.value.trim()));
    if (!isGeneric) {
      score += 1;
      features.push("reader_effect_explained");
    }
  }

  // Theme connected
  if (/\b(theme|thematic|recurring|question|argument|central|motif|underly|manuscript's)\b/i.test(allText)) {
    score += 1;
    features.push("theme_connected");
  }

  // ── Negative signals ────────────────────────────────────────────────────

  // Generic workshop language penalty
  if (violations.some((v) => v.code === "GENERIC_WORKSHOP_LANGUAGE")) {
    score -= 2;
  }

  // Missing anchor penalty — fatal only when no other specific evidence exists.
  // If character/scene/decision/consequence are present, it's a mild penalty (-1).
  // If no other evidence at all, it's a strong penalty (-3).
  if (!context?.anchorSnippet || context.anchorSnippet.length < 10) {
    if (!features.includes("quoted_anchor") && !features.includes("scene_referenced")) {
      const hasOtherEvidence =
        features.includes("character_named") ||
        features.includes("decision_identified") ||
        features.includes("consequence_identified");
      score -= hasOtherEvidence ? 1 : 3;
    }
  }

  // Vague anchor penalty
  if (violations.some((v) => v.code === "VAGUE_ANCHOR")) {
    score -= 2;
  }

  // Any sentence completeness violation is an automatic floor
  const sentenceViolations = violations.filter((v) =>
    v.code === "MALFORMED_CONNECTOR" ||
    v.code === "ORPHAN_CONJUNCTION" ||
    v.code === "SENTENCE_FRAGMENT" ||
    v.code === "REPEATED_CLAUSE" ||
    v.code === "MID_SENTENCE_TRUNCATION",
  );
  if (sentenceViolations.length > 0) {
    score = Math.min(score, 0);
  }

  return { score, features };
}

function deriveTier(score: number, violations: IntegrityViolation[]): QualityTier {
  // Hard fail: any sentence completeness violation = FAIL regardless of score
  const hardFailCodes: IntegrityViolationCode[] = [
    "MALFORMED_CONNECTOR",
    "ORPHAN_CONJUNCTION",
    "SENTENCE_FRAGMENT",
    "REPEATED_CLAUSE",
    "MID_SENTENCE_TRUNCATION",
    "INCOMPLETE_FIELD",
  ];
  if (violations.some((v) => hardFailCodes.includes(v.code))) {
    return "FAIL";
  }

  if (score <= 2) return "FAIL";
  if (score <= 4) return "PASS_MINIMUM";
  if (score <= 6) return "PASS_STRONG";
  return "PASS_DREAM_STANDARD";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the Recommendation Integrity Gate.
 *
 * Shared between qualityGate.ts and reviseAdmissionGate.ts.
 * Same rule set, same failure codes, same scoring.
 *
 * @param fields - { name, value } pairs for all author-facing text fields
 * @param context - Optional anchor snippet for editorial usefulness checks
 * @returns IntegrityResult with tier, score, violations, and dream standard features
 */
export function runRecommendationIntegrityGate(
  fields: IntegrityField[],
  context?: { anchorSnippet?: string; surface?: "evaluation_report" | "revise_queue" },
): IntegrityResult {
  const violations: IntegrityViolation[] = [];
  const surface = context?.surface ?? "revise_queue";

  // ── Layer 1: Required fields ──────────────────────────────────────────────
  // "action" and "fix_direction"/"specific_fix" are alternatives — at least one must be present.
  // "reader_effect" and "expected_impact" are alternatives.
  // For evaluation_report surface: symptom/cause are optional (eval recs may not carry full diagnostics).
  // For revise_queue surface: all fields required (full diagnostic schema).
  const coreRequired = surface === "evaluation_report" ? [] as string[] : ["symptom", "cause"];
  for (const req of coreRequired) {
    const field = fields.find((f) => f.name === req);
    if (!field || !field.value || field.value.trim().length < 10) {
      violations.push({
        field: req,
        code: "INCOMPLETE_FIELD",
        detail: field
          ? `"${req}" too short (${field.value?.trim().length ?? 0} chars, min 10)`
          : `Required field "${req}" is missing`,
      });
    }
  }
  // Action or fix_direction or specific_fix — at least one
  const actionField = fields.find((f) => f.name === "action" && f.value?.trim().length >= 10);
  const fixField = fields.find(
    (f) => (f.name === "fix_direction" || f.name === "specific_fix") && f.value?.trim().length >= 10,
  );
  if (!actionField && !fixField) {
    violations.push({
      field: "action",
      code: "INCOMPLETE_FIELD",
      detail: `Required field "action" (or "fix_direction"/"specific_fix") is missing or too short`,
    });
  }
  // Reader effect or expected_impact — at least one
  const readerField = fields.find((f) => f.name === "reader_effect" && f.value?.trim().length >= 10);
  const impactField = fields.find((f) => f.name === "expected_impact" && f.value?.trim().length >= 10);
  if (!readerField && !impactField) {
    violations.push({
      field: "reader_effect",
      code: "INCOMPLETE_FIELD",
      detail: `Required field "reader_effect" (or "expected_impact") is missing or too short`,
    });
  }

  // ── Layer 2: Sentence completeness ────────────────────────────────────────
  for (const field of fields) {
    if (field.value) {
      violations.push(...checkSentenceCompleteness(field.name, field.value));
    }
  }

  // ── Layer 3: Field-specific strictness + editorial usefulness ─────────────
  for (const field of fields) {
    if (field.value) {
      violations.push(...checkFieldStrictness(field.name, field.value));
    }
  }

  // ── Layer 3b: Repair action must reference anchor when available ────────
  // Normalize action / fix_direction / specific_fix → repairAction
  const actionFld = fields.find((f) => f.name === "action");
  const fixFld = fields.find((f) => f.name === "fix_direction" || f.name === "specific_fix");
  const repairAction = actionFld?.value || fixFld?.value || "";
  if (
    repairAction.length > 0 &&
    context?.anchorSnippet &&
    context.anchorSnippet.length > 10
  ) {
    // Proper noun: mid-sentence capitalized word (not sentence-initial).
    const hasProperNoun = hasNonInitialProperNounReference(repairAction);

    // Quoted text
    const hasQuote = /[""\u201c\u201d]/.test(repairAction);

    // Generic scene nouns only count as specificity when paired with a proper noun or quote.
    // "scene", "passage", "section", "moment", "transition" alone don't count.
    const SCENE_LOCATORS = /\b(scene|chapter|passage|paragraph|section|near|after|before|when|during)\b/i;
    const hasSceneRef = SCENE_LOCATORS.test(repairAction) && (hasProperNoun || hasQuote);

    const hasAnchorRef = hasProperNoun || hasQuote || hasSceneRef;
    if (!hasAnchorRef) {
      violations.push({
        field: actionFld ? "action" : "fix_direction",
        code: "MISSING_SPECIFIC_ANCHOR",
        detail: "Action/fix does not reference a specific scene, character, or passage — anchor available but unused",
      });
    }
  }

  // ── Deduplicate (same field + code) ───────────────────────────────────────
  const seen = new Set<string>();
  const deduped = violations.filter((v) => {
    const key = `${v.field}:${v.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── Quality scoring + tier derivation ─────────────────────────────────────
  const { score, features } = computeQualityScore(fields, deduped, context);
  const tier = deriveTier(score, deduped);

  return {
    passed: tier !== "FAIL",
    tier,
    quality_score: score,
    violations: deduped,
    dream_standard_features: features,
  };
}

/**
 * Convenience: check a single recommendation's author-facing fields.
 * Works for both Pass 2/3 pipeline recs and Revise Queue opportunity cards.
 */
export function checkRecommendationIntegrity(rec: {
  action?: string;
  symptom?: string;
  cause?: string;
  fix_direction?: string;
  specific_fix?: string;
  reader_effect?: string;
  mechanism?: string;
  expected_impact?: string;
  anchor_snippet?: string;
  /** Surface determines field strictness: eval recs don't require full diagnostic fields. */
  surface?: "evaluation_report" | "revise_queue";
}): IntegrityResult {
  const fields: IntegrityField[] = [];

  if (rec.action) fields.push({ name: "action", value: rec.action });
  if (rec.symptom) fields.push({ name: "symptom", value: rec.symptom });
  if (rec.cause) fields.push({ name: "cause", value: rec.cause });
  if (rec.fix_direction) fields.push({ name: "fix_direction", value: rec.fix_direction });
  if (rec.specific_fix) fields.push({ name: "specific_fix", value: rec.specific_fix });
  if (rec.reader_effect) fields.push({ name: "reader_effect", value: rec.reader_effect });
  if (rec.mechanism) fields.push({ name: "mechanism", value: rec.mechanism });
  if (rec.expected_impact) fields.push({ name: "expected_impact", value: rec.expected_impact });

  return runRecommendationIntegrityGate(fields, {
    anchorSnippet: rec.anchor_snippet,
    surface: rec.surface,
  });
}

/**
 * Check if a recommendation meets the minimum tier for a given surface.
 *
 * Governance control:
 *   - Evaluation reports: PASS_MINIMUM+ (tier >= PASS_MINIMUM)
 *   - Revise Queue:      PASS_STRONG+   (tier >= PASS_STRONG)
 *
 * Note: Generic workshop language is additionally caught by the GENERIC_WORKSHOP_LANGUAGE
 * violation code + the P2 specificity check in qualityGate.ts, which operates independently
 * of tier thresholds.
 */
export function meetsMinimumTier(
  result: IntegrityResult,
  surface: "evaluation_report" | "revise_queue",
): boolean {
  const tierOrder: Record<QualityTier, number> = {
    FAIL: 0,
    PASS_MINIMUM: 1,
    PASS_STRONG: 2,
    PASS_DREAM_STANDARD: 3,
  };
  const minTier: QualityTier = surface === "evaluation_report" ? "PASS_MINIMUM" : "PASS_STRONG";
  return tierOrder[result.tier] >= tierOrder[minTier];
}
