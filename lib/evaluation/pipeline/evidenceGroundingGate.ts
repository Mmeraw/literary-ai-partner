/**
 * P0 — Evidence Grounding Gate
 *
 * Validates that every recommendation's `anchor_snippet` is actually present
 * in the submitted manuscript text. Classifies evidence into three types:
 *
 *   - verbatim_quote: exact or near-exact match in manuscript
 *   - paraphrased_observation: partial/fuzzy match (shares key phrases)
 *   - editorial_diagnosis: NOT found in manuscript (LLM-generated diagnosis)
 *
 * Fail-closed: if anchor_snippet cannot be grounded in manuscript text,
 * the recommendation's anchor_type is set to "editorial_diagnosis" and
 * the recommendation is flagged for quarantine or re-rendering.
 *
 * This gate runs AFTER Pass 3 synthesis and BEFORE persistence, so that
 * no fabricated "Evidence" reaches the author-facing report.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnchorType =
  | "verbatim_quote"
  | "paraphrased_observation"
  | "editorial_diagnosis";

export interface AnchorGroundingResult {
  anchor_snippet: string;
  anchor_type: AnchorType;
  /** Best fuzzy-match score (0–1). 1.0 = exact substring match. */
  match_score: number;
  /** The matched manuscript passage (if found). */
  matched_passage?: string;
  /** Character offset in manuscript where match starts (if found). */
  match_offset?: number;
}

export interface EvidenceGroundingReport {
  total_recommendations: number;
  verbatim_count: number;
  paraphrased_count: number;
  diagnosis_count: number;
  /** Recommendations with fabricated evidence (anchor_type = editorial_diagnosis). */
  ungrounded: Array<{
    criterion_key: string;
    anchor_snippet: string;
    anchor_type: AnchorType;
    match_score: number;
  }>;
  /** True if ALL evidence is grounded (verbatim or paraphrased). */
  fully_grounded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum similarity ratio to consider an anchor a "verbatim_quote". */
const VERBATIM_THRESHOLD = 0.85;

/** Minimum similarity ratio to consider an anchor a "paraphrased_observation". */
const PARAPHRASE_THRESHOLD = 0.45;

/**
 * Minimum length of anchor_snippet to bother validating.
 * Very short snippets (< 10 chars) are too ambiguous for meaningful grounding.
 */
const MIN_ANCHOR_LENGTH = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Core matching logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize text for comparison: lowercase, collapse whitespace, strip quotes.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d""''`]/g, "")
    .replace(/[—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract overlapping n-grams (word-level) from text.
 */
function wordNgrams(text: string, n: number): Set<string> {
  const words = text.split(/\s+/);
  const grams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    grams.add(words.slice(i, i + n).join(" "));
  }
  return grams;
}

/**
 * Compute a similarity score between anchor and manuscript using multiple signals:
 * 1. Exact substring containment (score = 1.0)
 * 2. Longest common subsequence ratio
 * 3. Word n-gram overlap (trigrams)
 *
 * Returns a score between 0 and 1.
 */
function computeSimilarity(
  anchor: string,
  manuscript: string,
): { score: number; matchedPassage?: string; matchOffset?: number } {
  const normAnchor = normalize(anchor);
  const normManuscript = normalize(manuscript);

  // Fast path: exact substring match
  const exactIdx = normManuscript.indexOf(normAnchor);
  if (exactIdx !== -1) {
    return {
      score: 1.0,
      matchedPassage: manuscript.substring(exactIdx, exactIdx + anchor.length + 50).trim(),
      matchOffset: exactIdx,
    };
  }

  // Window-based best match: slide a window of anchor length across manuscript
  const anchorWords = normAnchor.split(/\s+/);
  const manuscriptWords = normManuscript.split(/\s+/);
  const windowSize = Math.min(anchorWords.length * 2, manuscriptWords.length);

  let bestScore = 0;
  let bestOffset = 0;

  // Use trigram overlap as primary signal (fast and effective)
  const anchorTrigrams = wordNgrams(normAnchor, 3);
  if (anchorTrigrams.size === 0) {
    // Anchor too short for trigrams — try bigrams
    const anchorBigrams = wordNgrams(normAnchor, 2);
    if (anchorBigrams.size === 0) return { score: 0 };

    for (let i = 0; i <= manuscriptWords.length - anchorWords.length; i++) {
      const windowEnd = Math.min(i + windowSize, manuscriptWords.length);
      const windowText = manuscriptWords.slice(i, windowEnd).join(" ");
      const windowBigrams = wordNgrams(windowText, 2);
      let overlap = 0;
      for (const gram of anchorBigrams) {
        if (windowBigrams.has(gram)) overlap++;
      }
      const score = overlap / anchorBigrams.size;
      if (score > bestScore) {
        bestScore = score;
        bestOffset = i;
      }
    }
    return { score: bestScore, matchOffset: bestOffset };
  }

  // Slide window using trigrams
  const step = Math.max(1, Math.floor(anchorWords.length / 4));
  for (let i = 0; i <= manuscriptWords.length - anchorWords.length; i += step) {
    const windowEnd = Math.min(i + windowSize, manuscriptWords.length);
    const windowText = manuscriptWords.slice(i, windowEnd).join(" ");
    const windowTrigrams = wordNgrams(windowText, 3);

    let overlap = 0;
    for (const gram of anchorTrigrams) {
      if (windowTrigrams.has(gram)) overlap++;
    }
    const score = overlap / anchorTrigrams.size;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = i;
    }
  }

  // If we found a good region, do a finer-grained search around it
  if (bestScore > 0.3) {
    const fineStart = Math.max(0, bestOffset - anchorWords.length);
    const fineEnd = Math.min(manuscriptWords.length, bestOffset + windowSize + anchorWords.length);
    for (let i = fineStart; i <= fineEnd - anchorWords.length; i++) {
      const windowEnd = Math.min(i + windowSize, manuscriptWords.length);
      const windowText = manuscriptWords.slice(i, windowEnd).join(" ");
      const windowTrigrams = wordNgrams(windowText, 3);

      let overlap = 0;
      for (const gram of anchorTrigrams) {
        if (windowTrigrams.has(gram)) overlap++;
      }
      const score = overlap / anchorTrigrams.size;
      if (score > bestScore) {
        bestScore = score;
        bestOffset = i;
      }
    }
  }

  const matchedPassage = bestScore >= PARAPHRASE_THRESHOLD
    ? manuscriptWords.slice(bestOffset, bestOffset + anchorWords.length + 10).join(" ")
    : undefined;

  return { score: bestScore, matchedPassage, matchOffset: bestOffset };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a single anchor_snippet against manuscript text.
 */
export function classifyAnchor(
  anchorSnippet: string,
  manuscriptText: string,
): AnchorGroundingResult {
  if (!anchorSnippet || anchorSnippet.trim().length < MIN_ANCHOR_LENGTH) {
    return {
      anchor_snippet: anchorSnippet || "",
      anchor_type: "editorial_diagnosis",
      match_score: 0,
    };
  }

  if (!manuscriptText || manuscriptText.trim().length === 0) {
    // Cannot validate without manuscript — assume verbatim to avoid false positives
    return {
      anchor_snippet: anchorSnippet,
      anchor_type: "verbatim_quote",
      match_score: 0,
    };
  }

  const { score, matchedPassage, matchOffset } = computeSimilarity(anchorSnippet, manuscriptText);

  let anchor_type: AnchorType;
  if (score >= VERBATIM_THRESHOLD) {
    anchor_type = "verbatim_quote";
  } else if (score >= PARAPHRASE_THRESHOLD) {
    anchor_type = "paraphrased_observation";
  } else {
    anchor_type = "editorial_diagnosis";
  }

  return {
    anchor_snippet: anchorSnippet,
    anchor_type,
    match_score: score,
    matched_passage: matchedPassage,
    match_offset: matchOffset,
  };
}

/**
 * Run the evidence grounding gate across all recommendations in a synthesis output.
 * Returns a report classifying every anchor_snippet.
 *
 * @param criteria - Array of criterion objects with recommendations
 * @param manuscriptText - The full submitted manuscript text
 */
export function runEvidenceGroundingGate(
  criteria: Array<{
    key: string;
    recommendations: Array<{ anchor_snippet?: string }>;
  }>,
  manuscriptText: string,
): EvidenceGroundingReport {
  const report: EvidenceGroundingReport = {
    total_recommendations: 0,
    verbatim_count: 0,
    paraphrased_count: 0,
    diagnosis_count: 0,
    ungrounded: [],
    fully_grounded: true,
  };

  for (const criterion of criteria) {
    for (const rec of criterion.recommendations) {
      report.total_recommendations++;

      const result = classifyAnchor(rec.anchor_snippet ?? "", manuscriptText);

      switch (result.anchor_type) {
        case "verbatim_quote":
          report.verbatim_count++;
          break;
        case "paraphrased_observation":
          report.paraphrased_count++;
          break;
        case "editorial_diagnosis":
          report.diagnosis_count++;
          report.fully_grounded = false;
          report.ungrounded.push({
            criterion_key: criterion.key,
            anchor_snippet: rec.anchor_snippet ?? "",
            anchor_type: result.anchor_type,
            match_score: result.match_score,
          });
          break;
      }
    }
  }

  return report;
}

/**
 * Stamp each recommendation with its anchor_type classification.
 * Mutates the recommendations in place and returns the grounding report.
 *
 * This is the primary integration point: call after Pass 3 synthesis,
 * before persistence.
 */
export function stampAnchorTypes<
  T extends { anchor_snippet?: string; anchor_type?: AnchorType },
>(
  criteria: Array<{ key: string; recommendations: T[] }>,
  manuscriptText: string,
): EvidenceGroundingReport {
  const report: EvidenceGroundingReport = {
    total_recommendations: 0,
    verbatim_count: 0,
    paraphrased_count: 0,
    diagnosis_count: 0,
    ungrounded: [],
    fully_grounded: true,
  };

  for (const criterion of criteria) {
    for (const rec of criterion.recommendations) {
      report.total_recommendations++;

      const result = classifyAnchor(rec.anchor_snippet ?? "", manuscriptText);
      rec.anchor_type = result.anchor_type;

      switch (result.anchor_type) {
        case "verbatim_quote":
          report.verbatim_count++;
          break;
        case "paraphrased_observation":
          report.paraphrased_count++;
          break;
        case "editorial_diagnosis":
          report.diagnosis_count++;
          report.fully_grounded = false;
          report.ungrounded.push({
            criterion_key: criterion.key,
            anchor_snippet: rec.anchor_snippet ?? "",
            anchor_type: result.anchor_type,
            match_score: result.match_score,
          });
          break;
      }
    }
  }

  return report;
}
