/**
 * Generic Recommendation Guard
 *
 * Prevents author-facing evaluations from emitting vague editorial advice.
 * Enforced at the Pass 3 parse boundary before quality gate.
 *
 * A recommendation is "generic" if it:
 *  1. Contains a cliché editorial directive phrase, AND
 *  2. Does not carry all 7 required supporting fields:
 *       evidence (anchor_snippet), symptom, cause (mechanism),
 *       fix direction (specific_fix), reader effect, mistake-proofing,
 *       and potential damage (harm test)
 *
 * Hardcoded acceptance test: "Strengthening dialogue improves the reader's
 * experience" MUST be classified as generic and suppressed.
 */

// ── Cliché phrase patterns ────────────────────────────────────────────────────
//
// These are editor clichés that do not answer: Where? Why? What is the
// mechanism? What should the author protect?
// Presence alone does not suppress; presence WITHOUT 7-part evidence does.

export const GENERIC_DIRECTIVE_PATTERNS = [
  // Verb-only momentum directives
  /\bstrengthen(?:ing)?\s+dialogue\b/i,
  /\bimprove\s+(?:the\s+)?reader(?:'s)?\s+experience\b/i,
  /\bimprove\s+pacing\b/i,
  /\bincrease\s+momentum\b/i,
  /\bclarify\s+(?:the\s+)?stakes\b/i,
  /\bdeepen\s+character\b/i,
  /\bheighten\s+tension\b/i,
  /\bmake\s+(?:it\s+)?clearer\b/i,
  /\badd\s+specificity\b/i,
  /\btighten\s+(?:the\s+)?prose\b/i,
  /\benhance\s+engagement\b/i,
  // Generic scope phrases that float free of evidence
  /\bstrengthen(?:ing)?\s+(?:the\s+)?(?:overall\s+)?narrative\b/i,
  /\bimprove(?:s)?\s+(?:the\s+)?overall\b/i,
  /\bconsider\s+(?:revising|revisiting|reworking)\b/i,
] as const;

// ── 7-part contract ───────────────────────────────────────────────────────────

export type RecommendationContractStatus =
  | "passes_all"
  | "missing_evidence"
  | "missing_symptom"
  | "missing_cause"
  | "missing_fix_direction"
  | "missing_reader_effect"
  | "generic_no_mechanism"
  | "generic_no_evidence";

export type GenericGuardDecision = {
  suppress: boolean;
  reasons: RecommendationContractStatus[];
  /** Which specific generic phrase matched (if any). */
  matchedPattern?: string;
};

export type RecommendationForGenericCheck = {
  action: string;
  expected_impact?: string;
  anchor_snippet?: string;
  mechanism?: string;
  specific_fix?: string;
  reader_effect?: string;
  symptom?: string;
  mistake_proofing?: string;
  /** Harm test — what strength could this revision damage? */
  potential_damage?: string[];
};

const MECHANISM_CAUSE_RE =
  /\b(because|since|so\s+that|thereby|which\s+(?:prevents|causes|diffuses|breaks|reduces|creates|forces|stalls|weakens|undermines)|this\s+(?:prevents|causes|creates|forces)|as\s+a\s+result|the\s+reason|the\s+cause)\b/i;

const SYMPTOM_SIGNAL_RE =
  /\b(lacks?|missing|unclear|confus(?:ed|ing)?|flat|generic|drag(?:s|ging)?|repetit(?:ion|ive)|abrupt|weak|underdeveloped|overwritten|diffuse|stalled|not\s+yet|fails?|without|reader\s+(?:loses?|lost)|breaks?|dissolves?|dissipates?|thinly|blandly|abstractly)\b/i;

const FIX_VERB_RE =
  /\b(rewrite|replace|cut|trim|split|merge|move|reorder|expand|compress|clarify|specify|anchor|insert|delete|foreshadow|escalate|tighten|seed|stage|show|name|shift|ground|contextualize|reframe|focus|connect|develop|resolve|surface|thread|motivate|concretize|externalize|recast|frontload|backload|echo|contrast)\b/i;

const READER_EFFECT_RE =
  /\b(reader|readers|clarity|comprehension|urgency|momentum|immersion|engagement|stakes|tension|payoff|coherence|trust|forward\s+pull|narrative\s+drive)\b/i;

const CONTEXTUAL_ACTION_LEAD_RE = /^(?:In|Within|During|When|Where)\s+[^,]{3,120},\s+\S+/i;
const CONCRETE_CONTEXTUAL_MOVE_RE =
  /\b(add(?:ing)?|balance|deepen|inject|streamline|rewrite|replace|cut|trim|split|merge|move|reorder|expand|compress|clarify|specify|anchor|insert|delete|foreshadow|escalate|tighten|seed|stage|show|name|shift|ground|contextualize|reframe|focus|connect|develop|resolve|surface|thread|motivate|concretize|externalize|recast|frontload|backload|echo|contrast)\b/i;

function hasSufficientEvidence(rec: RecommendationForGenericCheck): boolean {
  return (rec.anchor_snippet ?? "").trim().length > 10;
}

function hasSufficientCause(rec: RecommendationForGenericCheck): boolean {
  const texts = [rec.action, rec.mechanism ?? "", rec.expected_impact ?? ""].join(" ");
  return MECHANISM_CAUSE_RE.test(texts) || (rec.mechanism ?? "").trim().length > 10;
}

function hasSufficientSymptom(rec: RecommendationForGenericCheck): boolean {
  const texts = [rec.action, rec.symptom ?? "", rec.expected_impact ?? ""].join(" ");
  return SYMPTOM_SIGNAL_RE.test(texts) || (rec.symptom ?? "").trim().length > 5;
}

function hasSufficientFix(rec: RecommendationForGenericCheck): boolean {
  const texts = [rec.action, rec.specific_fix ?? ""].join(" ");
  return FIX_VERB_RE.test(texts) || (rec.specific_fix ?? "").trim().length > 10;
}

function hasSufficientReaderEffect(rec: RecommendationForGenericCheck): boolean {
  const texts = [rec.expected_impact ?? "", rec.reader_effect ?? ""].join(" ");
  return READER_EFFECT_RE.test(texts) || (rec.reader_effect ?? "").trim().length > 5;
}

function matchedGenericPattern(action: string): string | undefined {
  for (const pattern of GENERIC_DIRECTIVE_PATTERNS) {
    if (pattern.test(action)) {
      return pattern.source;
    }
  }
  return undefined;
}

function hasAnchoredContextualAction(rec: RecommendationForGenericCheck): boolean {
  return hasSufficientEvidence(rec)
    && CONTEXTUAL_ACTION_LEAD_RE.test(rec.action)
    && CONCRETE_CONTEXTUAL_MOVE_RE.test(rec.action);
}

/**
 * Evaluate a single recommendation against the 7-part contract.
 *
 * A recommendation is suppressed when it matches a generic-phrase pattern AND
 * is missing one or more of the 7 required structural fields.
 *
 * Passing all 7 fields exempts the recommendation even when a generic phrase is
 * present — e.g., a recommendation that says "strengthen dialogue" but anchors
 * to a specific passage, names the mechanism, and states a harm test passes.
 */
export function evaluateRecommendationGenericContract(
  rec: RecommendationForGenericCheck,
): GenericGuardDecision {
  const matchedPattern = matchedGenericPattern(rec.action);

  if (!matchedPattern) {
    return { suppress: false, reasons: ["passes_all"] };
  }

  if (hasAnchoredContextualAction(rec)) {
    return { suppress: false, reasons: ["passes_all"], matchedPattern };
  }

  const reasons: RecommendationContractStatus[] = [];

  if (!hasSufficientEvidence(rec)) reasons.push("missing_evidence");
  if (!hasSufficientSymptom(rec)) reasons.push("missing_symptom");
  if (!hasSufficientCause(rec)) reasons.push("missing_cause");
  if (!hasSufficientFix(rec)) reasons.push("missing_fix_direction");
  if (!hasSufficientReaderEffect(rec)) reasons.push("missing_reader_effect");

  if (reasons.length === 0) {
    return { suppress: false, reasons: ["passes_all"] };
  }

  return {
    suppress: true,
    reasons,
    matchedPattern,
  };
}

/**
 * Batch-evaluate all recommendations for a criterion.
 * Returns only the recommendations that pass the generic-contract check.
 */
export function filterGenericRecommendations<T extends RecommendationForGenericCheck>(
  recommendations: T[],
  onSuppressed?: (rec: T, decision: GenericGuardDecision) => void,
): T[] {
  return recommendations.filter((rec) => {
    const decision = evaluateRecommendationGenericContract(rec);
    if (decision.suppress) {
      onSuppressed?.(rec, decision);
      return false;
    }
    return true;
  });
}
