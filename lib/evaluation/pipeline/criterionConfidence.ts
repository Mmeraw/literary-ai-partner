// canon-audit-allow: vocabulary-detection
// CRITERION_TERMS contains prose-mechanic detection vocabulary (synonym strings for
// isCriterionSpecific() scoring) — NOT criterion key aliases. The banned-alias scanner
// is opted out for this file via the allow marker above.
import type { CriterionKey } from "@/schemas/criteria-keys";
import { normalizeAnchorText } from "@/lib/revision/anchorContract";

export type CriterionConfidenceLevel = "high" | "moderate" | "low";

export type CriterionScorabilityStatus =
  | "scorable"
  | "scorable_low_confidence"
  | "non_scorable";

export interface CriterionConfidenceResult {
  confidence_score_0_100: number;
  confidence_level: CriterionConfidenceLevel;
  confidence_reasons: string[];
  scorability_status: CriterionScorabilityStatus;
}

type EvidenceAnchorLike = {
  snippet?: string | null;
  char_start?: number;
  char_end?: number;
  segment_id?: string;
};

type RecommendationLike = {
  action?: string | null;
  expected_impact?: string | null;
  anchor_snippet?: string | null;
  issue_family?: string | null;
  strategic_lever?: string | null;
  revision_granularity?: string | null;
};

export interface CriterionConfidenceInput {
  key?: CriterionKey | string;
  final_score_0_10?: number | null;
  score_0_10?: number | null;
  score?: number | null;
  final_rationale?: string | null;
  rationale?: string | null;
  reasoning?: string | null;
  summary?: string | null;
  interpretation?: string | null;
  evidence?: EvidenceAnchorLike[] | string | null;
  recommendations?: RecommendationLike[] | null;
  recommendation?: string | null;
  meta_artifacts?: string[] | null;
  artifact_hygiene_issues?: string[] | null;
  notes?: string | null;
}

const HIGH_MIN = 85;
const MODERATE_MIN = 60;
const MODERATE_MIN_BY_KEY: Record<string, number> = {
  proseControl: 55,
};

const SUPPORT_FAMILY_MAX = 68; // coverage(40) + quality(28)
const EXPLANATION_FAMILY_MAX = 35; // reasoning(20) + recommendation(15)

const MEANINGFUL_ANCHOR_MIN_CHARS = 20;
const MEANINGFUL_ANCHOR_MAX_CHARS = 220;

const VAGUE_REASONING_PATTERNS: ReadonlyArray<RegExp> = [
  /\boverall\b/i,
  /\bgenerally\b/i,
  /\bsomewhat\b/i,
  /\bkind of\b/i,
  /\bsort of\b/i,
  /\bworks well\b/i,
  /\bcould be (stronger|improved)\b/i,
  /\bneeds work\b/i,
];

const GENERIC_EVIDENCE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bthe (chapter|scene|story|manuscript|submission) (is|has|shows|uses)\b/i,
  /\bstrong writing\b/i,
  /\bgood writing\b/i,
  /\beffective writing\b/i,
  /\bshows promise\b/i,
  /\bcould be improved\b/i,
];

const META_ARTIFACT_PATTERNS: ReadonlyArray<RegExp> = [
  /<\s*ChatGPT\b[^>]*>/i,
  /\[\s*(TODO|NOTE|FIXME|AUTHOR|EDITOR|CHATGPT)\b[^\]]*\]/i,
  /\(\s*(TODO|NOTE|FIXME|AUTHOR|EDITOR|CHATGPT)\b[^)]*\)/i,
];

const CRITERION_TERMS: Record<string, readonly string[]> = {
  concept: ["premise", "hook", "concept", "dilemma", "engine", "risk", "promise"],
  narrativeDrive: ["propulsion", "drive", "goal", "pressure", "tension", "escalation", "turn"],
  character: ["character", "motivation", "choice", "arc", "interiority", "conflict", "change", "agency"],
  voice: ["voice", "pov", "point of view", "diction", "syntax", "register", "focalization", "cadence"],
  sceneConstruction: ["scene", "beat", "turn", "goal", "reversal", "entry", "exit", "conflict", "outcome"],
  dialogue: ["dialogue", "speech", "subtext", "attribution", "tag", "beat", "exchange", "speaker"],
  theme: ["theme", "motif", "symbol", "moral", "idea", "meaning", "pattern"],
  worldbuilding: ["world", "setting", "environment", "logic", "system", "rules", "place", "ritual"],
  pacing: ["pacing", "pace", "tempo", "compression", "drag", "acceleration", "rhythm", "movement"],
  proseControl: [
    "prose",
    "sentence",
    "syntax",
    "diction",
    "imagery",
    "metaphor",
    "cadence",
    "line",
    "paragraph",
    "register",
    "rhythm",
    "control",
    "technique",  // prose mechanism synonym (replaces banned alias)
    "crisp",
    "terse",
    "tactile",
    "verb",
    "fragment",
    "beat",
    "phrasing",
    "word choice",
    "image-forward",
    "abstract",
    "concrete",
    "voice",
    "tone",
    "lucidity",  // prose mechanism synonym (replaces banned alias)
    "precision",
    "linebreak",
    "repetition",
  ],
  tone: ["tone", "affect", "register", "atmosphere", "consistency", "control"],
  narrativeClosure: ["closure", "closeout", "aftermath", "consequence", "promise", "climax", "thread"],
  marketability: ["market", "audience", "positioning", "pitch", "genre", "queryability", "readiness"],
};

const CRAFT_MECHANISM_TERMS = Array.from(new Set(Object.values(CRITERION_TERMS).flat()));

const READER_EFFECT_TERMS = [
  "reader",
  "specificity",
  "immersion",
  "empathy",
  "suspense",
  "tension",
  "propulsion",
  "consequence",
  "engagement",
  "readability",
  "impact",
  "risk",
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeComparable(value: string): string {
  return normalizeAnchorText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getScore(criterion: CriterionConfidenceInput): number | null {
  const score = criterion.final_score_0_10 ?? criterion.score_0_10 ?? criterion.score ?? null;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function getReasoningText(criterion: CriterionConfidenceInput): string {
  return normalizeText(
    criterion.final_rationale ??
      criterion.rationale ??
      criterion.reasoning ??
      criterion.summary ??
      criterion.interpretation ??
      "",
  );
}

function getEvidenceAnchors(criterion: CriterionConfidenceInput): EvidenceAnchorLike[] {
  if (Array.isArray(criterion.evidence)) return criterion.evidence;
  if (typeof criterion.evidence === "string") {
    const value = normalizeText(criterion.evidence);
    if (!value || /^n\/?a$/i.test(value)) return [];
    return [{ snippet: value }];
  }
  return [];
}

function getAnchorText(anchor: EvidenceAnchorLike): string {
  return normalizeText(anchor.snippet ?? "");
}

function getRecommendations(criterion: CriterionConfidenceInput): RecommendationLike[] {
  const recommendations = Array.isArray(criterion.recommendations) ? criterion.recommendations : [];
  const single = normalizeText(criterion.recommendation);
  return single ? [...recommendations, { action: single }] : recommendations;
}

function getRecommendationText(rec: RecommendationLike): string {
  return normalizeText(rec.action ?? rec.expected_impact ?? "");
}

function getRecommendationAnchor(rec: RecommendationLike): string {
  return normalizeText(rec.anchor_snippet ?? "");
}

function sourceContains(sourceText: string | undefined, snippet: string): boolean {
  if (!sourceText || !snippet || snippet.trim().length < 12) return false;
  const normalizedSource = normalizeComparable(sourceText);
  const normalizedSnippet = normalizeComparable(snippet);

  if (!normalizedSnippet) return false;
  if (normalizedSource.includes(normalizedSnippet)) return true;

  const sourceWords = normalizedSource.split(" ").filter(Boolean);
  const snippetWords = normalizedSnippet.split(" ").filter(Boolean);
  if (snippetWords.length < 4 || sourceWords.length === 0) return false;

  const sourceWordSet = new Set(sourceWords);
  const overlap = snippetWords.filter((word) => sourceWordSet.has(word)).length;
  return overlap / snippetWords.length >= 0.8;
}

function isMeaningfulAnchorLength(text: string): boolean {
  const len = normalizeText(text).length;
  return len >= MEANINGFUL_ANCHOR_MIN_CHARS && len <= MEANINGFUL_ANCHOR_MAX_CHARS;
}

function looksGeneric(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  return GENERIC_EVIDENCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function containsAny(text: string, terms: readonly string[]): boolean {
  const normalized = normalizeText(text).toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

function criterionTerms(key: unknown): readonly string[] {
  if (typeof key !== "string") return CRAFT_MECHANISM_TERMS;
  return CRITERION_TERMS[key] ?? CRAFT_MECHANISM_TERMS;
}

function isCriterionSpecific(criterion: CriterionConfidenceInput, text: string): boolean {
  if (!text.trim()) return false;
  return containsAny(text, criterionTerms(criterion.key));
}

const META_COMMENTARY_MARKERS: ReadonlyArray<RegExp> = [
  /\bappears duplicated\b/i,
  /\bimage-forward\b/i,
  /\babstract or\b/i,
  /\bover-specified\b/i,
  /\bdrafting residue\b/i,
  /\bactive-voice\b/i,
];

function looksLikeMetaCommentary(text: string): boolean {
  return META_COMMENTARY_MARKERS.some((pattern) => pattern.test(text));
}

function looksLikeExplicitExcerpt(text: string): boolean {
  return (
    /["'`“”‘’]/.test(text) ||
    /^\s{0,3}>\s+\S/m.test(text) ||
    /(^|\s)(["“‘`]).+\2($|\s)/.test(text)
  );
}

function isVerbatimAnchor(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length <= 20) return false;
  if (!/\s/.test(normalized)) return false;
  if (looksLikeMetaCommentary(normalized)) return false;

  const normalizedAnchor = normalizeAnchorText(text);
  if (normalizedAnchor.length <= 20) return false;
  if (!/\s/.test(normalizedAnchor)) return false;

  return looksLikeExplicitExcerpt(text);
}

function isCriterionSpecificFromRationaleOrRecs(criterion: CriterionConfidenceInput): boolean {
  const terms = criterionTerms(criterion.key);
  const rationale = getReasoningText(criterion);
  if (rationale && containsAny(rationale, terms)) return true;
  const recommendations = getRecommendations(criterion);
  return recommendations.some((rec) => {
    const actionText = normalizeText(rec.action ?? "");
    return Boolean(actionText) && containsAny(actionText, terms);
  });
}

function hasMetaArtifact(text: string): boolean {
  return META_ARTIFACT_PATTERNS.some((pattern) => pattern.test(text));
}

function hasArtifactHygieneIssue(criterion: CriterionConfidenceInput): boolean {
  const notes = normalizeText(criterion.notes);
  const meta = criterion.meta_artifacts ?? [];
  const hygiene = criterion.artifact_hygiene_issues ?? [];

  return (
    meta.length > 0 ||
    hygiene.length > 0 ||
    hasMetaArtifact(notes) ||
    getEvidenceAnchors(criterion).some((anchor) => hasMetaArtifact(getAnchorText(anchor)))
  );
}

function computeEvidenceCoverage(anchorCount: number): { score: number; reasons: string[] } {
  if (anchorCount <= 0) {
    return { score: 0, reasons: ["No evidence anchors were provided"] };
  }
  if (anchorCount === 1) {
    return { score: 20, reasons: ["Only one evidence anchor was provided"] };
  }
  if (anchorCount === 2) {
    return { score: 35, reasons: ["Two evidence anchors were provided"] };
  }
  return { score: 40, reasons: ["Three or more evidence anchors were provided"] };
}

function computeEvidenceQuality(
  criterion: CriterionConfidenceInput,
  anchors: EvidenceAnchorLike[],
  sourceText?: string,
): { score: number; reasons: string[] } {
  const anchorTexts = anchors.map(getAnchorText).filter(Boolean);
  const reasons: string[] = [];
  let score = 0;

  const sourceMatched = anchorTexts.filter((text) => sourceContains(sourceText, text));
  const nonGeneric = anchorTexts.filter((text) => !looksGeneric(text));
  const meaningfulLength = anchorTexts.filter(isMeaningfulAnchorLength);
  const verbatimAnchors = anchorTexts.filter(isVerbatimAnchor);
  const criterionSpecificFromContext = isCriterionSpecificFromRationaleOrRecs(criterion);

  if (sourceMatched.length > 0) {
    score += 10;
    reasons.push("Anchor includes verbatim text from the submission");
  } else if (sourceText && anchorTexts.length > 0) {
    reasons.push("Evidence anchors were not verified against the submitted text");
  }

  if (criterionSpecificFromContext) {
    score += 5;
    reasons.push("Rationale or recommendations name a craft mechanism specific to this story area");
  } else if (anchorTexts.length > 0) {
    reasons.push("Rationale does not name a craft mechanism specific to this story area");
  }

  if (verbatimAnchors.length > 0) {
    score += 3;
    reasons.push("Evidence contains verbatim manuscript sentences rather than meta-commentary");
  }

  if (nonGeneric.length > 0) {
    score += 5;
    reasons.push("Evidence avoids generic summary language");
  } else if (anchorTexts.length > 0) {
    reasons.push("Evidence appears generic rather than criterion-specific");
  }

  if (meaningfulLength.length > 0) {
    score += 5;
    reasons.push("Evidence example length is meaningful and readable");
  }

  const genericCount = anchorTexts.length - nonGeneric.length;
  if (genericCount >= 2) {
    score -= 5;
    reasons.push("Multiple evidence anchors appear generic");
  }

  const uniqueSnippets = new Set(anchorTexts.map(normalizeComparable));
  const duplicateCount = anchorTexts.length - uniqueSnippets.size;
  if (duplicateCount > 0) {
    score -= Math.min(duplicateCount * 5, 15);
    reasons.push("Some evidence anchors are duplicates");
  }

  return { score: clamp(score, 0, 28), reasons };
}

function computeReasoningSpecificity(
  criterion: CriterionConfidenceInput,
): { score: number; reasons: string[] } {
  const reasoning = getReasoningText(criterion);
  const reasons: string[] = [];
  let score = 0;

  if (!reasoning || /^n\/?a$/i.test(reasoning)) {
    return { score: 0, reasons: ["No reasoning summary was provided"] };
  }

  if (containsAny(reasoning, criterionTerms(criterion.key))) {
    score += 10;
    reasons.push("Reasoning names a concrete craft mechanism");
  } else {
    reasons.push("Reasoning does not name a concrete craft mechanism");
  }

  if (containsAny(reasoning, READER_EFFECT_TERMS)) {
    score += 5;
    reasons.push("Reasoning explains effect on reader or story");
  } else {
    reasons.push("Reasoning does not explain effect on reader or story");
  }

  if (!VAGUE_REASONING_PATTERNS.some((pattern) => pattern.test(reasoning))) {
    score += 5;
    reasons.push("Reasoning avoids vague language");
  } else {
    reasons.push("Reasoning uses vague evaluative language");
  }

  return { score: clamp(score, 0, 20), reasons };
}

function computeRecommendationAnchoring(
  criterion: CriterionConfidenceInput,
  sourceText?: string,
): { score: number; reasons: string[] } {
  const recommendations = getRecommendations(criterion);
  const reasons: string[] = [];

  if (recommendations.length === 0) {
    return { score: 0, reasons: ["No recommendation was provided"] };
  }

  const anchorSnippets = recommendations.map(getRecommendationAnchor).filter(Boolean);
  const hasVerifiedAnchor = anchorSnippets.some((snippet) => sourceContains(sourceText, snippet));
  const hasAnchor = anchorSnippets.length > 0;
  const combinedText = recommendations.map(getRecommendationText).join(" ");
  const hasSpecificIssue =
    isCriterionSpecific(criterion, combinedText) ||
    anchorSnippets.some((snippet) => isCriterionSpecific(criterion, snippet));

  if (hasVerifiedAnchor && hasSpecificIssue) {
    return {
      score: 15,
      reasons: ["Recommendation references a specific verified text issue"],
    };
  }

  if (hasAnchor && hasSpecificIssue) {
    return {
      score: 12,
      reasons: ["Recommendation references a specific text issue"],
    };
  }

  if (hasAnchor) {
    return {
      score: 8,
      reasons: ["Recommendation includes a text anchor but remains broad"],
    };
  }

  if (hasSpecificIssue) {
    return {
      score: 6,
      reasons: ["Recommendation is useful but general"],
    };
  }

  return {
    score: 0,
    reasons: ["Recommendation is generic rather than anchored to the text"],
  };
}

function computeConfidenceLevel(score: number): CriterionConfidenceLevel {
  if (score >= HIGH_MIN) return "high";
  if (score >= MODERATE_MIN) return "moderate";
  return "low";
}

function computeConfidenceLevelForCriterion(
  criterion: CriterionConfidenceInput,
  score: number,
): CriterionConfidenceLevel {
  if (score >= HIGH_MIN) return "high";
  const key = typeof criterion.key === "string" ? criterion.key : "";
  const moderateMin = MODERATE_MIN_BY_KEY[key] ?? MODERATE_MIN;
  if (score >= moderateMin) return "moderate";
  return "low";
}

function computeScorabilityStatus(
  criterion: CriterionConfidenceInput,
  confidenceLevel: CriterionConfidenceLevel,
): CriterionScorabilityStatus {
  const score = getScore(criterion);
  const reasoning = getReasoningText(criterion);
  const anchors = getEvidenceAnchors(criterion);
  const recommendations = getRecommendations(criterion);

  const hasAnySignal =
    score !== null ||
    Boolean(reasoning && !/^n\/?a$/i.test(reasoning)) ||
    anchors.some((anchor) => Boolean(getAnchorText(anchor))) ||
    recommendations.length > 0;

  if (!hasAnySignal) return "non_scorable";
  if (confidenceLevel === "low") return "scorable_low_confidence";
  return "scorable";
}

export function computeCriterionConfidence(
  criterion: CriterionConfidenceInput,
  sourceText?: string,
): CriterionConfidenceResult {
  const anchors = getEvidenceAnchors(criterion);

  const coverage = computeEvidenceCoverage(anchors.length);
  const quality = computeEvidenceQuality(criterion, anchors, sourceText);
  const reasoning = computeReasoningSpecificity(criterion);
  const recommendation = computeRecommendationAnchoring(criterion, sourceText);

  const supportFamilyScore = coverage.score + quality.score;
  const explanationFamilyScore = reasoning.score + recommendation.score;

  let confidenceScore = clamp(supportFamilyScore + explanationFamilyScore);

  const supportRatio = supportFamilyScore / SUPPORT_FAMILY_MAX;
  const explanationRatio = explanationFamilyScore / EXPLANATION_FAMILY_MAX;
  if (supportRatio < 0.4 && explanationRatio > 0.7) {
    confidenceScore = Math.min(confidenceScore, 84);
  }

  const confidence_level = computeConfidenceLevelForCriterion(criterion, confidenceScore);
  const scorability_status = computeScorabilityStatus(criterion, confidence_level);

  const confidence_reasons = unique([
    ...coverage.reasons,
    ...quality.reasons,
    ...reasoning.reasons,
    ...recommendation.reasons,
    ...(supportRatio < 0.4 && explanationRatio > 0.7
      ? [
          "Confidence capped at moderate because explanation quality exceeded evidence support",
        ]
      : []),
    ...(hasArtifactHygieneIssue(criterion)
      ? [
          "Artifact hygiene issues were detected separately and did not erase the craft score",
        ]
      : []),
  ]);

  return {
    confidence_score_0_100: confidenceScore,
    confidence_level,
    confidence_reasons,
    scorability_status,
  };
}
