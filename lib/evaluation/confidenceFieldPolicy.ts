/**
 * Confidence Field Policy
 *
 * Canonical source of truth for which fields show confidence labels and how.
 * No component may decide confidence display by inference.
 * Any field not listed here defaults to "none".
 *
 * Contract: docs/CONFIDENCE_LABEL_DISPLAY_CONTRACT (copilot-instructions attachment)
 */

// ── Display mode ──────────────────────────────────────────────────────────────

export type ConfidenceDisplayMode =
  | "none"              // Deterministic field — no confidence label
  | "inline_quiet"      // Interpretive field — quiet inline label
  | "warning_required"; // High-stakes / sample-size-sensitive — always show, with context

// ── Policy map ────────────────────────────────────────────────────────────────

export const CONFIDENCE_FIELD_POLICY = {
  // Deterministic metadata — no confidence
  report_type: "none",
  title: "none",
  reference_id: "none",
  date_generated: "none",
  submitted_word_count: "none",
  estimated_pages: "none",
  reading_grade_level: "none",
  dialogue_narrative_ratio: "none",

  // Interpretive header fields
  genre: "inline_quiet",
  target_audience: "warning_required",
  market_readiness: "inline_quiet",
  overall_score: "inline_quiet",

  // 13 criteria
  criterion_concept: "inline_quiet",
  criterion_narrative_drive: "inline_quiet",
  criterion_character: "inline_quiet",
  criterion_voice: "inline_quiet",
  criterion_scene_construction: "inline_quiet",
  criterion_dialogue: "inline_quiet",
  criterion_theme: "inline_quiet",
  criterion_worldbuilding: "inline_quiet",
  criterion_pacing: "inline_quiet",
  criterion_prose_control: "inline_quiet",
  criterion_tone: "inline_quiet",
  criterion_narrative_closure: "inline_quiet",
  criterion_marketability: "inline_quiet",

  // Multi-layer / Dream fields
  golden_spine: "inline_quiet",
  story_layer_map: "inline_quiet",
  character_continuity: "inline_quiet",
  plot_continuity_integrity: "inline_quiet",
  symbolic_thematic_architecture: "inline_quiet",
  canon_doctrine_alignment: "inline_quiet",
  revision_priority_stack: "inline_quiet",
  agent_readiness: "inline_quiet",
  storygate_eligibility: "warning_required",
} as const satisfies Record<string, ConfidenceDisplayMode>;

export type ConfidenceFieldKey = keyof typeof CONFIDENCE_FIELD_POLICY;

/** Any field not listed defaults to "none". */
export function getConfidenceDisplayMode(fieldKey: string): ConfidenceDisplayMode {
  if (fieldKey in CONFIDENCE_FIELD_POLICY) {
    return CONFIDENCE_FIELD_POLICY[fieldKey as ConfidenceFieldKey];
  }
  return "none";
}

// ── Canonical display labels ──────────────────────────────────────────────────

export type CanonicalConfidenceLabel =
  | "Very High Confidence"
  | "High Confidence"
  | "Moderate Confidence"
  | "Low Confidence"
  | "Insufficient Evidence";

function normalizeRawConfidenceLevel(
  confidenceLevel: string | null | undefined,
): CanonicalConfidenceLabel | null {
  const normalized = confidenceLevel?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? "";
  if (!normalized) return null;
  if (normalized === "very high" || normalized === "very high confidence") return "Very High Confidence";
  if (normalized === "moderate high" || normalized === "moderate high confidence") return "High Confidence";
  if (normalized === "high" || normalized === "high confidence") return "High Confidence";
  if (normalized === "moderate" || normalized === "medium" || normalized === "moderate confidence" || normalized === "medium confidence") return "Moderate Confidence";
  if (normalized === "low" || normalized === "low confidence") return "Low Confidence";
  if (normalized === "insufficient" || normalized === "insufficient evidence") return "Insufficient Evidence";
  return null;
}

/**
 * Map raw criterion confidence_level / confidence_score_0_100 to a canonical
 * display label. Returns null when no confidence signal is present.
 */
export function formatCriterionConfidenceLabel(
  confidenceLevel: string | null | undefined,
  confidenceScore: number | null | undefined,
): CanonicalConfidenceLabel | null {
  const labelFromLevel = normalizeRawConfidenceLevel(confidenceLevel);
  if (labelFromLevel) {
    return labelFromLevel;
  }

  if (typeof confidenceScore === "number") {
    if (confidenceScore >= 80) return "High Confidence";
    if (confidenceScore >= 60) return "Moderate Confidence";
    if (confidenceScore >= 0) return "Low Confidence";
  }
  return null;
}

/**
 * Export/web shared formatter for legacy render paths that still receive a raw
 * criterion confidence level. The derivation remains canonical here; renderers
 * only choose the fallback text for missing confidence.
 */
export function formatConfidenceLabelForExport(
  confidenceLevel: string | null | undefined,
  confidenceScore: number | null | undefined = undefined,
  fallback = "—",
): CanonicalConfidenceLabel | string {
  return formatCriterionConfidenceLabel(confidenceLevel, confidenceScore) ?? fallback;
}

// ── Per-field derivation functions ────────────────────────────────────────────
//
// Each interpretive header field derives confidence from its OWN evidence
// signal. No field borrows another field's confidence number.

/**
 * Derive Genre confidence from word count alone.
 *
 * Genre is inferred from textual evidence; short samples produce uncertain
 * classifications. Word count is the primary signal because the data model
 * does not carry a per-field genre confidence score.
 *
 * Returns null when we have no word count (hide the label rather than guess).
 */
export function deriveGenreConfidence(
  wordCount: number | null | undefined,
): CanonicalConfidenceLabel | null {
  if (typeof wordCount !== "number" || !Number.isFinite(wordCount)) return null;
  if (wordCount < 1000) return "Insufficient Evidence";
  if (wordCount < 5000) return "Low Confidence";
  if (wordCount < 15000) return "Moderate Confidence";
  if (wordCount < 40000) return "High Confidence";
  return "Very High Confidence";
}

/**
 * Derive Market Readiness confidence from the fraction of criteria that were
 * actually scorable (certified).
 *
 * Market Readiness is synthesised from the criteria set; fewer scorable
 * criteria means the verdict rests on less evidence.
 *
 * Returns null when no criteria are available.
 */
export function deriveMarketReadinessConfidence(
  scorableCriteriaCount: number,
  totalCriteriaCount: number,
): CanonicalConfidenceLabel | null {
  if (totalCriteriaCount === 0) return null;
  const fraction = scorableCriteriaCount / totalCriteriaCount;
  if (fraction >= 0.9) return "High Confidence";
  if (fraction >= 0.7) return "Moderate Confidence";
  if (fraction >= 0.4) return "Low Confidence";
  return "Insufficient Evidence";
}

/**
 * Derive Overall Score confidence by combining:
 *   1. Fraction of scorable criteria (primary evidence signal)
 *   2. Governance pipeline confidence (secondary floor / ceiling)
 *
 * The pipeline governance score is used as a floor: a high fraction of
 * scorable criteria cannot inflate confidence beyond what the pipeline audit
 * allows.
 */
export function deriveOverallScoreConfidence(
  scorableCriteriaCount: number,
  totalCriteriaCount: number,
  governanceConfidence01: number | null | undefined,
): CanonicalConfidenceLabel | null {
  if (totalCriteriaCount === 0) return null;

  const fraction = scorableCriteriaCount / totalCriteriaCount;

  // Start from criteria-based label
  let label: CanonicalConfidenceLabel;
  if (fraction >= 0.9) {
    label = "High Confidence";
  } else if (fraction >= 0.7) {
    label = "Moderate Confidence";
  } else if (fraction >= 0.4) {
    label = "Low Confidence";
  } else {
    return "Insufficient Evidence";
  }

  // Apply governance floor: if pipeline audit confidence is low, cap the label.
  // Check the most severe condition first so the else-if chain does not swallow it.
  if (typeof governanceConfidence01 === "number" && Number.isFinite(governanceConfidence01)) {
    if (governanceConfidence01 < 0.3) {
      // Critical pipeline failure — floor everything at Low Confidence.
      label = "Low Confidence";
    } else if (governanceConfidence01 < 0.5 && label === "High Confidence") {
      label = "Moderate Confidence";
    }
  }

  return label;
}

// ── Target Audience word-count gating ────────────────────────────────────────

export type AudienceConfidenceResult = {
  /** Whether to prefix the value with "Tentative:" */
  tentative: boolean;
  /** Canonical confidence label */
  label: CanonicalConfidenceLabel;
};

/**
 * Derive Target Audience confidence from word count.
 *
 * Target Audience is highly sample-size-sensitive; word count is the
 * authoritative gating signal. Policy contract:
 *
 *   0–999       → Insufficient Evidence (always tentative)
 *   1000–4999   → Low Confidence (tentative)
 *   5000–24999  → Moderate Confidence
 *   25000+      → High Confidence
 *
 * Never shown without a confidence label (warning_required policy).
 */
export function getAudienceConfidence(
  wordCount: number | null | undefined,
): AudienceConfidenceResult {
  const wc = typeof wordCount === "number" && Number.isFinite(wordCount) ? wordCount : 0;

  if (wc < 1000) return { tentative: true, label: "Insufficient Evidence" };
  if (wc < 5000) return { tentative: true, label: "Low Confidence" };
  if (wc < 25000) return { tentative: false, label: "Moderate Confidence" };
  return { tentative: false, label: "High Confidence" };
}

// ── CSS classes for canonical labels ─────────────────────────────────────────

export function getConfidenceLabelClasses(label: CanonicalConfidenceLabel): string {
  switch (label) {
    case "Very High Confidence":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300";
    case "High Confidence":
      return "bg-emerald-200 text-emerald-900 ring-1 ring-emerald-400";
    case "Moderate Confidence":
      return "bg-amber-200 text-amber-900 ring-1 ring-amber-400";
    case "Low Confidence":
      return "bg-rose-200 text-rose-900 ring-1 ring-rose-400";
    case "Insufficient Evidence":
      return "bg-stone-200 text-stone-700 ring-1 ring-stone-300";
  }
}

// ── Export palette classes/colors for canonical labels ──────────────────────
// PDF/HTML/DOCX/TXT exporters must not implement their own label → style rules.

export type ConfidenceExportPaletteClass =
  | "confidence-high"
  | "confidence-moderate"
  | "confidence-low"
  | "confidence-muted";

const CONFIDENCE_EXPORT_PALETTE: Record<
  CanonicalConfidenceLabel,
  { className: ConfidenceExportPaletteClass; color: string }
> = {
  "Very High Confidence": { className: "confidence-high", color: "#3A6B2A" },
  "High Confidence": { className: "confidence-high", color: "#3A6B2A" },
  "Moderate Confidence": { className: "confidence-moderate", color: "#8B5E1A" },
  "Low Confidence": { className: "confidence-low", color: "#8B2020" },
  "Insufficient Evidence": { className: "confidence-muted", color: "#5C5549" },
};

export function getConfidenceExportPaletteClass(
  label: string | null | undefined,
): ConfidenceExportPaletteClass {
  const canonical = normalizeRawConfidenceLevel(label);
  return canonical ? CONFIDENCE_EXPORT_PALETTE[canonical].className : "confidence-muted";
}

export function getConfidenceExportPaletteColor(label: string | null | undefined): string {
  const canonical = normalizeRawConfidenceLevel(label);
  return canonical ? CONFIDENCE_EXPORT_PALETTE[canonical].color : "#5C5549";
}
