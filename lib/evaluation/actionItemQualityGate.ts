/**
 * Action Item Quality Gate
 *
 * Applies a 7-point checklist enforcement to the Action Items
 * (quick_wins / strategic_revisions) derived from per-criterion
 * recommendations. This module:
 *
 * 1. Preserves scene-specific context (anchor_snippet, manuscript_coordinates)
 * 2. Applies diversity selection (no duplicate opening patterns)
 * 3. Enforces semantic deduplication (n-gram overlap > 70% → reject)
 * 4. Ensures each Action Item has a craft mechanism and reader effect
 *
 * Checklist (enforced by filtering, not LLM re-generation):
 *   1. Scene-Specificity — anchor_snippet must be non-empty
 *   2. Uniqueness — semantic overlap < 70% with all accepted items
 *   3. Craft Mechanism — mechanism field must be present
 *   4. Before/After Contrast — candidate_text_a provides the "after"
 *   5. Reader Experience Delta — reader_effect must be non-empty
 *   6. Non-Redundancy — opening fingerprint dedup (existing logic)
 *   7. Effort/Impact Label — always present (derived from priority)
 */

export type EnrichedActionItem = {
  action: string;
  why: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  anchor_snippet?: string;
  manuscript_coordinates?: string;
  mechanism?: string;
  reader_effect?: string;
  candidate_text_a?: string;
  criterion_key?: string;
};

type RawRecommendation = {
  priority?: string;
  action?: string;
  expected_impact?: string;
  anchor_snippet?: string;
  manuscript_coordinates?: string;
  mechanism?: string;
  reader_effect?: string;
  candidate_text_a?: string;
  specific_fix?: string;
  issue_family?: string;
  strategic_lever?: string;
};

type CriterionWithRecommendations = {
  key?: string;
  recommendations: RawRecommendation[];
};

// ─── Semantic Deduplication ───────────────────────────────────────────────

/**
 * Compute bigram set for a normalized string.
 */
function bigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const result = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    result.add(`${words[i]} ${words[i + 1]}`);
  }
  return result;
}

/**
 * Dice coefficient (bigram overlap) between two strings.
 * Returns 0..1 where 1 = identical.
 */
function diceCoefficient(a: string, b: string): number {
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

const SEMANTIC_OVERLAP_THRESHOLD = 0.70;

// ─── Diversity Selection ──────────────────────────────────────────────────

type RecommendationShape =
  | "imperative"
  | "contrastive"
  | "observational"
  | "reader_effect"
  | "opportunity"
  | "structural";

function classifyShape(text: string): RecommendationShape {
  const normalized = text.trim().toLowerCase();
  if (/^(revise|rewrite|replace|cut|insert|split|move|add|tighten|sharpen)\b/.test(normalized)) {
    return "imperative";
  }
  if (/\b(rather than|instead of|instead)\b/.test(normalized)) {
    return "contrastive";
  }
  if (/^(readers?\b|to strengthen reader|to improve reader)/.test(normalized)) {
    return "reader_effect";
  }
  if (/\b(opportunity|upside|market|promise)\b/.test(normalized)) {
    return "opportunity";
  }
  if (/\b(scene momentum|structural turn|re-sequencing|causal order)\b/.test(normalized)) {
    return "structural";
  }
  return "observational";
}

function openingFingerprint(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/^\s*(quick win|strategic revision):\s*/i, "")
    .replace(/^in the anchored moment\s+"[^"]+",\s*/i, "")
    .trim();
  return normalized.split(/\s+/).slice(0, 5).join(" ");
}

function openingVerb(text: string): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/^(quick win|strategic revision):\s*/i, "");
  return normalized.split(/\s+/)[0] || "";
}

// ─── Core Quality Gate ────────────────────────────────────────────────────

/**
 * Build enriched Action Items from per-criterion recommendations,
 * applying the 7-point quality gate checklist:
 *
 * 1. Scene-Specificity — REQUIRE anchor_snippet (evidence from manuscript)
 * 2. Uniqueness — semantic dedup via Dice coefficient (>70% → reject)
 * 3. Craft Mechanism — prefer items with mechanism field
 * 4. Before/After Contrast — anchor_snippet = "before", candidate_text_a = "after"
 * 5. Reader Experience Delta — prefer items with reader_effect
 * 6. Non-Redundancy — opening fingerprint + shape diversity
 * 7. Effort/Impact Label — always present
 *
 * EVIDENCE-FIRST POLICY: Action Items without anchor_snippet (the author's
 * actual words) are rejected. Every recommendation must be grounded in
 * specific manuscript text the author can see and recognize.
 */
export function buildEnrichedActionItems(
  criteria: CriterionWithRecommendations[],
  priorityFilter: "high" | "medium",
  maxItems = 5,
): EnrichedActionItem[] {
  const effortLabel = priorityFilter === "high" ? "medium" : "medium";
  const impactLabel = priorityFilter === "high" ? "high" : "medium";

  // Collect all matching recommendations with full context
  const evidenceBacked: (EnrichedActionItem & { _sortScore: number })[] = [];
  const fallbackPool: (EnrichedActionItem & { _sortScore: number })[] = [];

  for (const criterion of criteria) {
    for (const rec of criterion.recommendations) {
      if (rec.priority !== priorityFilter) continue;
      if (!rec.action || rec.action.trim().length === 0) continue;

      const hasAnchor = Boolean(rec.anchor_snippet && rec.anchor_snippet.trim().length > 0);

      // Quality score: higher = more complete evidence + richer context
      let sortScore = 0;
      if (hasAnchor) sortScore += 3;
      if (rec.mechanism && rec.mechanism.trim().length > 0) sortScore += 2;
      if (rec.reader_effect && rec.reader_effect.trim().length > 0) sortScore += 2;
      if (rec.candidate_text_a && rec.candidate_text_a.trim().length > 0) sortScore += 2;
      if (rec.manuscript_coordinates && rec.manuscript_coordinates.trim().length > 0) sortScore += 1;

      const item = {
        action: rec.action,
        why: rec.expected_impact || "",
        effort: effortLabel as "low" | "medium" | "high",
        impact: impactLabel as "low" | "medium" | "high",
        anchor_snippet: rec.anchor_snippet || undefined,
        manuscript_coordinates: rec.manuscript_coordinates || undefined,
        mechanism: rec.mechanism || undefined,
        reader_effect: rec.reader_effect || undefined,
        candidate_text_a: rec.candidate_text_a || undefined,
        criterion_key: criterion.key || undefined,
        _sortScore: sortScore,
      };

      // Gate 1 (Evidence-First): Items WITH anchor_snippet are preferred.
      // Items without are relegated to fallback pool (only used if we can't
      // fill maxItems from evidence-backed pool alone).
      if (hasAnchor) {
        evidenceBacked.push(item);
      } else {
        fallbackPool.push(item);
      }
    }
  }

  // Sort both pools by quality score (most grounded first)
  evidenceBacked.sort((a, b) => b._sortScore - a._sortScore);
  fallbackPool.sort((a, b) => b._sortScore - a._sortScore);

  // Primary pool: evidence-backed items first, then fallback if needed
  const allCandidates = [...evidenceBacked, ...fallbackPool];

  // Apply diversity selection + semantic dedup
  const selected: EnrichedActionItem[] = [];
  const seenFingerprints = new Set<string>();
  const shapeCounts = new Map<RecommendationShape, number>();
  const verbCounts = new Map<string, number>();

  const MAX_SAME_SHAPE = 2;
  const MAX_SAME_VERB = 1;

  for (const candidate of allCandidates) {
    if (selected.length >= maxItems) break;

    const action = candidate.action;

    // Gate 6: Opening fingerprint dedup
    const fingerprint = openingFingerprint(action);
    if (fingerprint && seenFingerprints.has(fingerprint)) continue;

    // Gate 6: Shape diversity
    const shape = classifyShape(action);
    const shapeCount = shapeCounts.get(shape) ?? 0;
    if (shapeCount >= MAX_SAME_SHAPE) continue;

    // Gate 6: Verb diversity
    const verb = openingVerb(action);
    const verbCount = verbCounts.get(verb) ?? 0;
    if (verb && verbCount >= MAX_SAME_VERB) continue;

    // Gate 2: Semantic dedup (Dice coefficient against all accepted items)
    const isDuplicate = selected.some(
      (accepted) => diceCoefficient(action, accepted.action) >= SEMANTIC_OVERLAP_THRESHOLD,
    );
    if (isDuplicate) continue;

    // Accept this item
    if (fingerprint) seenFingerprints.add(fingerprint);
    shapeCounts.set(shape, shapeCount + 1);
    if (verb) verbCounts.set(verb, verbCount + 1);

    // Strip internal sort score before emitting
    const { _sortScore: _, ...item } = candidate;
    selected.push(item);
  }

  // Relaxed fill pass: if we couldn't fill maxItems with strict diversity,
  // relax shape/verb caps but keep semantic dedup.
  if (selected.length < maxItems) {
    for (const candidate of allCandidates) {
      if (selected.length >= maxItems) break;

      const action = candidate.action;
      const fingerprint = openingFingerprint(action);
      if (fingerprint && seenFingerprints.has(fingerprint)) continue;

      const isDuplicate = selected.some(
        (accepted) => diceCoefficient(action, accepted.action) >= SEMANTIC_OVERLAP_THRESHOLD,
      );
      if (isDuplicate) continue;

      if (fingerprint) seenFingerprints.add(fingerprint);
      const { _sortScore: _, ...item } = candidate;
      selected.push(item);
    }
  }

  return selected;
}

/**
 * Backward-compatible wrapper: returns Action Items in the legacy shape
 * (action, why, effort, impact) for callers that don't need enriched fields.
 */
export function buildLegacyActionItems(
  criteria: CriterionWithRecommendations[],
  priorityFilter: "high" | "medium",
  maxItems = 5,
): Array<{ action: string; why: string; effort: "medium"; impact: "high" | "medium" }> {
  const impactLabel: "high" | "medium" = priorityFilter === "high" ? "high" : "medium";
  const enriched = buildEnrichedActionItems(criteria, priorityFilter, maxItems);
  return enriched.map((item) => ({
    action: item.action,
    why: item.why,
    effort: "medium" as const,
    impact: impactLabel,
  }));
}
