import { stripRecommendationLeadIn } from "@/lib/text/authorFacingProse";

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
  reader_effect?: string;
  mechanism?: string;
};

type CanonicalRenderedOpportunity = {
  id?: string;
  issue_type?: string;
  fix_direction?: string;
  action?: string;
  reader_effect?: string;
  expected_impact?: string;
  primary_criterion?: string;
};

type ArtifactLike = {
  summary?: string;
  overview?: { one_paragraph_summary?: string };
  canonicalOpportunityLedger?: {
    rendered_opportunities?: CanonicalRenderedOpportunity[];
  };
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

  const withoutLeadIn = stripRecommendationLeadIn(trimmed);

  // Repair soft seam artifact that can appear after clamp in summary surfaces.
  return withoutLeadIn
    .replace(/\band\s+a\s+because\b/gi, "because")
    .replace(/;\s*At the scene level,\s*[^.;!?]{1,220}?\s+would benefit from one because\b/gi, "; This passage needs a concrete scene-level revision because")
    .replace(/;\s*At the scene level,\s*[^.;!?]{1,220}?\s+would because\b/gi, "; This passage needs a concrete scene-level revision because")
    .replace(/\bconcrete criterion-specific move\b/gi, "concrete revision move")
    .replace(/\bcriterion signal\b/gi, "reader signal")
    .trim();
}

function formatCrossCuttingRecommendation(
  recommendation: ArtifactRecommendation,
  label?: string,
): string | null {
  const action =
    typeof recommendation.action === "string"
      ? normalizeRecommendationActionForDisplay(recommendation.action)
      : "";
  if (!action) return null;

  const why = typeof recommendation.why === "string" ? recommendation.why.trim() : "";
  if (!why) return `${label ? `${label}: ` : ""}${action}`;

  // CMOS: period cannot precede em dash (period-em-dash is a CMOS violation).
  // Separate action and rationale as two distinct sentences.
  const actionBase = action.replace(/\.\s*$/, "");
  return `${label ? `${label}: ` : ""}${actionBase}. ${why}`;
}

function formatLedgerRecommendation(item: CanonicalRenderedOpportunity): string | null {
  const action = normalizeRecommendationActionForDisplay(item.fix_direction || item.action || "");
  if (!action) return null;
  const impact = typeof item.reader_effect === "string" && item.reader_effect.trim()
    ? item.reader_effect.trim()
    : typeof item.expected_impact === "string" && item.expected_impact.trim()
      ? item.expected_impact.trim()
      : "";
  const id = typeof item.id === "string" && item.id.trim() ? `[${item.id.trim()}] ` : "";
  const actionBase = action.replace(/\.\s*$/, "");
  return `${id}${actionBase}${impact ? `. ${impact}` : "."}`;
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

export function buildTopRecommendations(artifact: ArtifactLike | null | undefined, maxItems = 2): string[] {
  if (!artifact) return [];

  // Canonical recommendation authority: when a ledger is attached to the
  // unified document, top recommendations are projections from that ledger only.
  const ledgerItems = artifact.canonicalOpportunityLedger?.rendered_opportunities ?? [];
  const ledgerRecommendations = ledgerItems
    .filter((item) => item.issue_type !== "mechanics_typo")
    .map(formatLedgerRecommendation)
    .filter((value): value is string => Boolean(value));

  if (ledgerRecommendations.length > 0) {
    return selectDiverseByOpening(uniq(ledgerRecommendations), maxItems);
  }

  const quickWinItems = (artifact.recommendations?.quick_wins ?? [])
    .map((recommendation) => formatCrossCuttingRecommendation(recommendation))
    .filter((value): value is string => Boolean(value));

  const strategicRevisionItems = (artifact.recommendations?.strategic_revisions ?? [])
    .map((recommendation) => formatCrossCuttingRecommendation(recommendation))
    .filter((value): value is string => Boolean(value));

  const explicit = uniq([...quickWinItems, ...strategicRevisionItems]);
  if (explicit.length > 0) {
    return selectDiverseByOpening(explicit, maxItems);
  }

  const criteriaDerived = uniq(
    (artifact.criteria ?? []).flatMap((criterion) =>
      (criterion.recommendations ?? []).map((recommendation) => {
        const action =
          typeof recommendation.action === "string"
            ? normalizeRecommendationActionForDisplay(recommendation.action)
            : "";
        if (!action) return "";
        const readerSummary =
          typeof recommendation.reader_effect === "string" && recommendation.reader_effect.trim()
            ? recommendation.reader_effect.trim()
            : typeof recommendation.expected_impact === "string" && recommendation.expected_impact.trim()
              ? recommendation.expected_impact.trim()
              : "";
        // CMOS: avoid period-em-dash. Separate as two sentences.
        if (!readerSummary) return action;
        const actionBase = action.replace(/\.\s*$/, "");
        return `${actionBase}. ${readerSummary}`;
      }),
    ),
  );
  if (criteriaDerived.length > 0) {
    return selectDiverseByOpening(criteriaDerived, maxItems);
  }

  // No recommendations exist (e.g., near-flawless writing like Dracula).
  // Return empty — do not fabricate recommendations from the summary text.
  return [];
}
