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

function selectDiverseByOpening(values: string[], maxItems: number): string[] {
  const selected: string[] = [];
  const seenOpenings = new Set<string>();

  for (const value of values) {
    if (selected.length >= maxItems) break;
    const fingerprint = openingFingerprint(value);
    if (!fingerprint || seenOpenings.has(fingerprint)) continue;
    seenOpenings.add(fingerprint);
    selected.push(value);
  }

  return selected;
}

function normalizeActionForTopRecommendations(action: string): string {
  const trimmed = action.trim();
  if (!trimmed) return "";

  // Avoid quintuplet-looking list items in the Top Recommendations surface
  // by removing repeated anchored-moment preamble.
  const withoutAnchorLeadIn = trimmed.replace(
    /^in the anchored moment\s+"[^"]+",\s*/i,
    "",
  );

  // Repair soft seam artifact that can appear after clamp in summary surfaces.
  return withoutAnchorLeadIn.replace(/\band\s+a\s+because\b/gi, "because");
}

function formatCrossCuttingRecommendation(
  recommendation: ArtifactRecommendation,
  label?: string,
): string | null {
  const action =
    typeof recommendation.action === "string"
      ? normalizeActionForTopRecommendations(recommendation.action)
      : "";
  if (!action) return null;

  const why = typeof recommendation.why === "string" ? recommendation.why.trim() : "";
  return `${label ? `${label}: ` : ""}${action}${why ? ` — ${why}` : ""}`;
}

function extractSummaryFallback(summary: string, maxItems: number): string[] {
  const lines = summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((line) => /^[-•*]\s+/.test(line))
    .map((line) => line.replace(/^[-•*]\s+/, ""));

  if (bullets.length > 0) {
    return bullets.slice(0, maxItems);
  }

  return summary
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
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

  const quickWins = hasStrategicRevisions
    ? quickWinItems.map((value) => `Quick win: ${value}`)
    : quickWinItems;

  const strategicRevisions = hasQuickWins
    ? strategicRevisionItems.map((value) => `Strategic revision: ${value}`)
    : strategicRevisionItems;

  const explicit = uniq([...quickWins, ...strategicRevisions]);
  if (explicit.length > 0) {
    return selectDiverseByOpening(explicit, maxItems);
  }

  const criteriaDerived = uniq(
    (artifact.criteria ?? []).flatMap((criterion) =>
      (criterion.recommendations ?? []).map((recommendation) => {
        const action =
          typeof recommendation.action === "string"
            ? normalizeActionForTopRecommendations(recommendation.action)
            : "";
        if (!action) return "";
        const impact =
          typeof recommendation.expected_impact === "string"
            ? recommendation.expected_impact.trim()
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
