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

function formatCrossCuttingRecommendation(
  recommendation: ArtifactRecommendation,
  label?: string,
): string | null {
  const action =
    typeof recommendation.action === "string"
      ? normalizeChicagoSurfaceText(recommendation.action)
      : "";
  if (!action) return null;

  const why =
    typeof recommendation.why === "string"
      ? normalizeChicagoSurfaceText(recommendation.why)
      : "";
  return normalizeChicagoSurfaceText(`${label ? `${label}: ` : ""}${action}${why ? ` — ${why}` : ""}`);
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

  const quickWins = (artifact.recommendations?.quick_wins ?? [])
    .map((recommendation) => formatCrossCuttingRecommendation(recommendation, "Quick win"))
    .filter((value): value is string => Boolean(value));

  const strategicRevisions = (artifact.recommendations?.strategic_revisions ?? [])
    .map((recommendation) => formatCrossCuttingRecommendation(recommendation, "Strategic revision"))
    .filter((value): value is string => Boolean(value));

  const explicit = uniq([...quickWins, ...strategicRevisions]);
  if (explicit.length > 0) {
    return explicit.slice(0, maxItems);
  }

  const criteriaDerived = uniq(
    (artifact.criteria ?? []).flatMap((criterion) =>
      (criterion.recommendations ?? []).map((recommendation) => {
        const action =
          typeof recommendation.action === "string"
            ? normalizeChicagoSurfaceText(recommendation.action)
            : "";
        if (!action) return "";
        const impact =
          typeof recommendation.expected_impact === "string"
            ? normalizeChicagoSurfaceText(recommendation.expected_impact)
            : "";
        return normalizeChicagoSurfaceText(`${action}${impact ? ` — ${impact}` : ""}`);
      }),
    ),
  );
  if (criteriaDerived.length > 0) {
    return criteriaDerived.slice(0, maxItems);
  }

  const summary = artifact.summary || artifact.overview?.one_paragraph_summary || "";
  return extractSummaryFallback(summary, maxItems);
}
