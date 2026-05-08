import { normalizeChicagoSurfaceText } from "@/lib/evaluation/style/chicagoSurface";

type ArtifactRecommendation = {
  action?: string;
  why?: string;
  effort?: string;
  impact?: string;
};

type CriterionRecommendation = {
  action?: string;
  priority?: "high" | "medium" | "low";
  expected_impact?: string;
};

type ArtifactLike = {
  summary?: string;
  overview?: { one_paragraph_summary?: string };
  criteria?: Array<{
    recommendations?: CriterionRecommendation[];
  }>;
  recommendations?: {
    quick_wins?: ArtifactRecommendation[];
    strategic_revisions?: ArtifactRecommendation[];
  };
};

function uniq(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function openingFingerprint(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/^\s*(quick win|strategic revision):\s*/i, "")
    .replace(/^in the anchored moment\s+"[^"]+",\s*/i, "")
    .trim();

  return normalized.split(/\s+/).slice(0, 5).join(" ");
}

type RecommendationShape = "imperative" | "contrastive" | "observational" | "reader_effect" | "opportunity" | "structural";

function classifyRecommendationShape(text: string): RecommendationShape {
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

function openingVerb(text: string): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/^(quick win|strategic revision):\s*/i, "");
  return normalized.split(/\s+/)[0] || "";
}

function selectDiverseByOpening(values: string[], maxItems: number): string[] {
  const maxSameShape = 1;
  const maxImperativeOpenings = 2;
  const maxSameOpeningVerb = 1;

  const selected: string[] = [];
  const seenOpenings = new Set<string>();
  const shapeCounts = new Map<RecommendationShape, number>();
  const openingVerbCounts = new Map<string, number>();
  let imperativeCount = 0;

  for (const value of values) {
    if (selected.length >= maxItems) break;

    const shape = classifyRecommendationShape(value);
    const shapeCount = shapeCounts.get(shape) ?? 0;
    if (shapeCount >= maxSameShape) continue;

    const verb = openingVerb(value);
    const verbCount = openingVerbCounts.get(verb) ?? 0;
    if (verb && verbCount >= maxSameOpeningVerb) continue;

    if (shape === "imperative" && imperativeCount >= maxImperativeOpenings) continue;

    const fingerprint = openingFingerprint(value);
    if (!fingerprint || seenOpenings.has(fingerprint)) continue;

    seenOpenings.add(fingerprint);
    selected.push(value);
    shapeCounts.set(shape, shapeCount + 1);
    if (verb) openingVerbCounts.set(verb, verbCount + 1);
    if (shape === "imperative") imperativeCount += 1;
  }

  if (selected.length >= maxItems) {
    return selected;
  }

  // Relaxed fill pass: keep opening uniqueness, but stop enforcing shape caps.
  for (const value of values) {
    if (selected.length >= maxItems) break;
    const fingerprint = openingFingerprint(value);
    if (!fingerprint || seenOpenings.has(fingerprint)) continue;
    seenOpenings.add(fingerprint);
    selected.push(value);
  }

  return selected;
}

export function normalizeRecommendationActionForDisplay(action: string): string {
  const trimmed = action.trim();
  if (!trimmed) return "";

  let withoutFamilyPrefix = trimmed;

  // Remove leading bullet markers and recommendation family labels repeatedly,
  // so surface rendering never shows "Quick win:" or "Strategic revision:".
  const familyPrefixPattern = /^\s*[•*\-]?\s*(quick win|strategic revision)\s*:\s*/i;
  while (familyPrefixPattern.test(withoutFamilyPrefix)) {
    withoutFamilyPrefix = withoutFamilyPrefix.replace(familyPrefixPattern, "");
  }

  // Avoid quintuplet-looking list items in the Top Recommendations surface
  // by removing repeated anchored-moment preamble.
  const withoutAnchorLeadIn = withoutFamilyPrefix
    .replace(/^in the anchored moment\s+"[^"]+",\s*/i, "")
    .replace(/^at the passage beginning\s+"[^"]+",\s*/i, "")
    .replace(/^in the closing beat beginning\s+"[^"]+",\s*/i, "")
    .replace(/^starting from\s+"[^"]+",\s*/i, "")
    .replace(/^at the line\s+"[^"]+",\s*/i, "");

  // Repair soft seam artifact that can appear after clamp in summary surfaces.
  return withoutAnchorLeadIn
    .replace(/\band\s+a\s+because\b/gi, "because")
    .trim();
}

function formatCrossCuttingRecommendation(
  recommendation: ArtifactRecommendation,
  label?: string,
): string | null {
  const action =
    typeof recommendation.action === "string"
      ? normalizeChicagoSurfaceText(normalizeRecommendationActionForDisplay(recommendation.action))
      : "";
  if (!action) return null;

  const why =
    typeof recommendation.why === "string"
      ? normalizeChicagoSurfaceText(recommendation.why)
      : "";
  return `${label ? `${label}: ` : ""}${action}${why ? ` — ${why}` : ""}`;
}

function extractSummaryFallback(summary: string, maxItems: number): string[] {
  const lines = summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((line) => /^[-•*]\s+/.test(line))
    .map((line) => normalizeChicagoSurfaceText(line.replace(/^[-•*]\s+/, "")));

  if (bullets.length > 0) {
    return bullets.slice(0, maxItems);
  }

  return summary
    .split(/(?<=[.!?])\s+/)
    .map((line) => normalizeChicagoSurfaceText(line))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function buildTopRecommendations(artifact: ArtifactLike | null | undefined, maxItems = 5): string[] {
  if (!artifact) return [];

  const quickWinItems = (artifact.recommendations?.quick_wins ?? [])
    .map((recommendation) => formatCrossCuttingRecommendation(recommendation))
    .filter((value): value is string => Boolean(value));

  const strategicRevisionItems = (artifact.recommendations?.strategic_revisions ?? [])
    .map((recommendation) => formatCrossCuttingRecommendation(recommendation))
    .filter((value): value is string => Boolean(value));

  const hasQuickWins = quickWinItems.length > 0;
  const hasStrategicRevisions = strategicRevisionItems.length > 0;

  const explicit = uniq([...quickWinItems, ...strategicRevisionItems]);
  if (explicit.length > 0) {
    return selectDiverseByOpening(explicit, maxItems);
  }

  const criteriaDerived = uniq(
    (artifact.criteria ?? []).flatMap((criterion) =>
      (criterion.recommendations ?? []).map((recommendation) => {
        const action =
          typeof recommendation.action === "string"
            ? normalizeChicagoSurfaceText(normalizeRecommendationActionForDisplay(recommendation.action))
            : "";
        if (!action) return "";
        const impact =
          typeof recommendation.expected_impact === "string"
            ? normalizeChicagoSurfaceText(recommendation.expected_impact)
            : "";
        return `${action}${impact ? ` — ${impact}` : ""}`;
      }),
    ),
  );
  if (criteriaDerived.length > 0) {
    return selectDiverseByOpening(criteriaDerived, maxItems);
  }

  const summary = artifact.summary || artifact.overview?.one_paragraph_summary || "";
  return extractSummaryFallback(summary, maxItems);
}
