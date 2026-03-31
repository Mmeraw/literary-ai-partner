/**
 * Passage Classifier — structural and semantic classification of literary text passages.
 *
 * Distinguishes between:
 *   - "inventory": list-form content (named items, noun sequences, low verb density)
 *   - "behavioral_contradiction": character agency/emotion (pronouns, action verbs)
 *   - "prose": general narrative text (neither pattern dominates)
 *
 * Generic — no benchmark-specific branching. Works on any literary passage.
 */

export type PassageClass = "inventory" | "behavioral_contradiction" | "prose";

export interface ClassificationSignals {
  sentenceCount: number;
  avgWordsPerSentence: number;
  shortItemCount: number;
  shortItemRatio: number;
  agencyVerbCount: number;
  characterPronounCount: number;
  fillerWordCount: number;
  properNounDensity: number;
}

export interface ClassificationResult {
  classification: PassageClass;
  confidence: number;
  signals: ClassificationSignals;
}

// Verbs that indicate character agency or deliberate action.
const AGENCY_VERB_RE =
  /\b(chose|decided|committed|grabbed|fought|refused|pushed|pulled|lunged|fled|seized|demanded|defied|resisted|insisted|forced|challenged|claimed|declared|gathered|struggled|recoiled|exhaled|commanded)\b/gi;

// Character pronouns at word boundary (case-insensitive).
const CHARACTER_PRONOUN_RE = /\b(he|she|they|I)\b/g;

// Filler adverbs commonly removed in prose compression.
const FILLER_WORD_RE =
  /\b(very|really|just|somehow|perhaps|actually|basically|simply|quite|somewhat|rather|maybe|indeed|certainly)\b/gi;

function countMatches(text: string, regex: RegExp): number {
  const copy = new RegExp(regex.source, regex.flags.replace("g", "") + "g");
  return (text.match(copy) ?? []).length;
}

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*|[^.!?]+$/g);
  if (!parts) {
    const trimmed = text.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Classify a passage of literary text.
 *
 * Returns a PassageClass, a confidence score, and the raw signals that drove
 * the classification. Confidence is in [0, 1].
 */
export function classifyPassage(text: string): ClassificationResult {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentences = splitSentences(normalized);
  const sentenceCount = Math.max(1, sentences.length);
  const totalWords = wordCount(normalized);
  const avgWordsPerSentence = totalWords / sentenceCount;

  // Short items: sentences with ≤ 4 words (bare nouns, list entries, one-word fragments).
  const shortItemCount = sentences.filter((s) => wordCount(s) <= 4).length;
  const shortItemRatio = shortItemCount / sentenceCount;

  const agencyVerbCount = countMatches(normalized, AGENCY_VERB_RE);
  const characterPronounCount = countMatches(normalized, CHARACTER_PRONOUN_RE);
  const fillerWordCount = countMatches(normalized, FILLER_WORD_RE);

  // Crude proper noun density: capitalised words that don't start a sentence.
  const properNounMatches = normalized.match(/(?<=[.!?]\s+|—)[A-Z][a-z]+|(?<=\s)[A-Z][a-z]{1,}/g) ?? [];
  const properNounDensity = totalWords > 0 ? properNounMatches.length / totalWords : 0;

  const signals: ClassificationSignals = {
    sentenceCount,
    avgWordsPerSentence,
    shortItemCount,
    shortItemRatio,
    agencyVerbCount,
    characterPronounCount,
    fillerWordCount,
    properNounDensity,
  };

  // --- Scoring ---
  // Inventory: many short items, no agency verbs, list-like structure.
  const inventoryScore =
    shortItemRatio * 0.6 +
    (agencyVerbCount === 0 ? 0.3 : 0) +
    (avgWordsPerSentence < 6 ? 0.2 : 0);

  // Behavioral contradiction: character pronouns + agency verbs, longer complex sentences.
  const behavioralScore =
    Math.min(0.4, agencyVerbCount * 0.12) +
    Math.min(0.35, characterPronounCount * 0.08) +
    (avgWordsPerSentence > 8 ? 0.2 : 0);

  let classification: PassageClass;
  let confidence: number;

  if (inventoryScore > 0.5 && inventoryScore > behavioralScore) {
    classification = "inventory";
    confidence = Math.min(0.95, 0.5 + inventoryScore * 0.4);
  } else if (behavioralScore > 0.3) {
    classification = "behavioral_contradiction";
    confidence = Math.min(0.95, 0.45 + behavioralScore * 0.5);
  } else {
    classification = "prose";
    confidence = 0.55;
  }

  return { classification, confidence, signals };
}
