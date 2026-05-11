/**
 * PUBLIC_SURFACE_CANON_v1 — Translation Boundary (Tier 2 → Tier 1)
 *
 * This module is the SOLE authorized translation point between internal
 * evaluation artifacts (EvaluationResultV2) and user-facing public schemas.
 *
 * Rules:
 *  1. All UI components, API routes, and export serializers MUST call
 *     translateToPublicReport() or translateToPublicHandoff().
 *  2. No other module may consume EvaluationResultV2 directly for display.
 *  3. This module explicitly drops all Tier 2 / protected IP before output.
 *  4. assertNoBannedTerms() must be called by all export serializers before
 *     writing user-downloadable files.
 *
 * See: docs/PUBLIC_SURFACE_CANON_v1.md §3, §5, §6
 */

import type { EvaluationResultV2, EvaluationCriterionV2 } from "@/schemas/evaluation-result-v2";
import type {
  PublicEvaluationReport,
  PublicRevisionHandoff,
  PublicEvaluationMetadata,
  PublicEvaluationStatus,
  PublicGovernanceSummary,
  PublicGovernanceStatus,
  PublicCoverageSummary,
  PublicCriterionScore,
  PublicRevisionPriority,
  PublicAnchorReference,
  PublicRevisionSuggestion,
} from "@/types/public-evaluation-report";

// ─── §5 Banned term patterns ────────────────────────────────────────────────

const BANNED_PATTERNS: RegExp[] = [
  /WAVE-[A-Z0-9_]+/,
  /\bWAVE_GUIDE\b/,
  /Gate\s+\d+[\.\d]*/,
  /RITUAL-[A-Z0-9_-]+/,
  /evaluation_result_v2/,
  /\bschema_version\b/,
  /\bpolicy_family\b/,
  /\brepro_anchor\b/,
  /\bartifact_validation_result\b/,
  /\bartifact_reason_codes\b/,
  /\bcriteria_plan\b/,
  /\bCRITERIA_13\b/,
  /\bprompt_version\b/,
  /\bevaluation_run_id\b/,
  /\bpipeline_stage\b/,
  /\bfailure_origin\b/,
  /\bAUTHORITY_CAP_APPLIED\b/,
  /\bscore_adjustments\b/,
  /\bNO_SIGNAL\b/,
  /\bINSUFFICIENT_SIGNAL\b/,
  /\bSCORABLE\b/,
  /\bNOT_APPLICABLE\b/,
  /\bMDM_WORK_TYPE_CANON\b/,
  /\bCANON_PHASE_STATUS\b/,
  /REC-1A/,
  /Volume [IVX-]+/,
  /Tsunami/i,
  /Ledger [AB]/,
  /\bSIPOC\b/,
  /Lost World/i,
];

/**
 * Asserts that a serialized public payload contains no banned internal terms.
 * Export serializers MUST call this before writing user-downloadable files.
 * Throws if any banned term is detected — never silently strips.
 */
export function assertNoBannedTerms(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error(
        `[PUBLIC_SURFACE_CANON_v1] Banned internal identifier detected in public payload: ${pattern.source}`
      );
    }
  }
}

// ─── §6 Criterion label mapping ──────────────────────────────────────────────

const CRITERION_LABELS: Record<string, string> = {
  concept: "Concept & Premise",
  narrativeDrive: "Narrative Drive",
  character: "Character",
  voice: "Voice",
  sceneConstruction: "Scene Construction",
  dialogue: "Dialogue",
  theme: "Theme",
  worldbuilding: "Worldbuilding",
  pacing: "Pacing",
  proseControl: "Prose Control",
  tone: "Tone",
  narrativeClosure: "Narrative Closure",
  marketability: "Market Fit",
  // MDM criterion keys
  hook: "Hook",
  conflict: "Conflict",
  stakes: "Stakes",
  linePolish: "Line Polish",
  marketFit: "Market Fit",
  keepGoing: "Keep Going",
  technical: "Technical Execution",
};

function criterionLabel(key: string): string {
  return CRITERION_LABELS[key] ?? toTitleCase(key);
}

function toTitleCase(s: string): string {
  return s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function derivePublicStatus(internal: EvaluationResultV2): PublicEvaluationStatus {
  switch (internal.overview.verdict) {
    case "pass":
      return "CERTIFIED";
    case "revise":
      return "CANDIDATE";
    case "fail":
      return "REJECTED";
  }
}

function deriveGovernanceStatus(internal: EvaluationResultV2): PublicGovernanceStatus {
  const hasBlocker =
    internal.governance.warnings.length > 0 ||
    internal.governance.confidence < 0.4;
  return hasBlocker ? "BLOCKED" : "VALID";
}

function buildMetadata(internal: EvaluationResultV2): PublicEvaluationMetadata {
  // evaluationId is an opaque public handle derived from the job; not the internal run ID.
  const publicId = internal.ids.job_id ?? `report-${Date.now()}`;
  return {
    evaluationId: publicId,
    manuscriptId: String(internal.ids.manuscript_id),
    createdAt: internal.generated_at,
    updatedAt: internal.generated_at,
    status: derivePublicStatus(internal),
  };
}

function buildCoverage(internal: EvaluationResultV2): PublicCoverageSummary {
  const processed = internal.metrics.processing.segment_count ?? 0;
  const total = processed; // segment_count is what was processed; adjust if total is available
  const coveragePct =
    total > 0 ? Math.round((processed / total) * 100) : 100;

  const insufficientKeys = internal.criteria
    .filter((c) => c.status === "NO_SIGNAL" || c.status === "INSUFFICIENT_SIGNAL")
    .map((c) => criterionLabel(c.key));

  return {
    manuscriptWords: internal.metrics.manuscript.word_count ?? 0,
    coveragePct,
    coverageNarrative: buildCoverageNarrative(coveragePct, insufficientKeys),
    criteriaWithInsufficientSignal: insufficientKeys,
  };
}

function buildCoverageNarrative(coveragePct: number, insufficient: string[]): string {
  const base = `Evaluated approximately ${coveragePct}% of the manuscript directly.`;
  if (insufficient.length === 0) return base;
  if (insufficient.length === 1) {
    return `${base} ${insufficient[0]} had insufficient signal to score.`;
  }
  return `${base} ${insufficient.join(", ")} had insufficient signal to score.`;
}

function buildGovernanceSummary(internal: EvaluationResultV2): PublicGovernanceSummary {
  const status = deriveGovernanceStatus(internal);
  const warnings = internal.governance.warnings;
  const limitations = internal.governance.limitations;

  let narrative: string;
  if (status === "VALID") {
    narrative = "Evaluation completed with sufficient evidence and coverage to support this report.";
  } else {
    const parts: string[] = [];
    if (warnings.length > 0) parts.push(...warnings.slice(0, 2));
    if (limitations.length > 0) parts.push(...limitations.slice(0, 1));
    narrative =
      parts.length > 0
        ? parts.join(" ")
        : "Evaluation completed with limited coverage. Review recommendations carefully.";
  }

  return { governanceStatus: status, statusNarrative: narrative };
}

function buildCriterionScore(c: EvaluationCriterionV2): PublicCriterionScore {
  const score = c.scorable ? (c as { score_0_10: number }).score_0_10 : null;
  const confidence = mapConfidence(c.confidence_band);

  // Map internal recommendations to public revision suggestions
  const revisionSuggestions: PublicRevisionSuggestion[] = c.recommendations
    .slice(0, 3)
    .map((r, i) => ({
      title: `Revision ${i + 1}: ${r.action.slice(0, 60)}`,
      description: `${r.action} ${r.expected_impact}`,
      anchors: buildAnchors(c),
      whyItMatters: r.expected_impact,
    }));

  // Derive fit/gap statements from rationale
  const rationale = c.rationale ?? "";
  const midpoint = Math.floor(rationale.length / 2);
  const fitStatement = rationale.slice(0, midpoint).trim() || rationale;
  const gapStatement =
    c.recommendations[0]?.action ?? "No specific gap identified at this signal level.";

  return {
    key: c.key,
    name: criterionLabel(c.key),
    score,
    fitStatement,
    gapStatement,
    readerImpact: `This criterion affects how readers experience the manuscript's ${criterionLabel(c.key).toLowerCase()}.`,
    confidence,
    coverageNote: buildCoverageNote(c),
    revisionSuggestions,
  };
}

function mapConfidence(band: string): "low" | "medium" | "high" {
  switch (band) {
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    default:
      return "low";
  }
}

function buildCoverageNote(c: EvaluationCriterionV2): string {
  const evidenceCount = c.evidence?.length ?? 0;
  if (!c.scorable) return "Insufficient signal to evaluate this criterion.";
  return evidenceCount > 0
    ? `Scored with ${evidenceCount} evidence point${evidenceCount !== 1 ? "s" : ""}.`
    : "Scored with available manuscript evidence.";
}

function buildAnchors(c: EvaluationCriterionV2): PublicAnchorReference[] {
  return (c.evidence ?? []).slice(0, 2).map((e) => ({
    label: e.location?.segment_id ? `Section ${e.location.segment_id}` : "Passage",
    excerpt: e.snippet.slice(0, 150),
  }));
}

function buildRevisionPriorities(
  internal: EvaluationResultV2
): PublicRevisionPriority[] {
  const allRecs = [
    ...internal.recommendations.quick_wins.map((r) => ({
      ...r,
      effort: r.effort,
      impact: r.impact,
      isStrategic: false,
    })),
    ...internal.recommendations.strategic_revisions.map((r) => ({
      ...r,
      effort: r.effort,
      impact: r.impact,
      isStrategic: true,
    })),
  ];

  // Take top 5, ordering strategic revisions first
  const ordered = [
    ...allRecs.filter((r) => r.isStrategic),
    ...allRecs.filter((r) => !r.isStrategic),
  ].slice(0, 5);

  return ordered.map((r, i) => ({
    id: `priority-${i + 1}`,
    title: r.action.slice(0, 80),
    description: r.action,
    rationale: r.why,
    whyFirst:
      i === 0
        ? "Highest impact relative to effort; addressable before other revisions."
        : "Follow-on from higher-priority changes.",
    anchors: [],
    estimatedEffort: r.effort,
    estimatedImpact: r.impact,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Translate an internal EvaluationResultV2 into a PublicEvaluationReport.
 *
 * This is the SOLE authorized path from Tier 2 → Tier 1 for evaluation data.
 * Call assertNoBannedTerms() on the result before writing to any export file.
 */
export function translateToPublicReport(
  internal: EvaluationResultV2
): PublicEvaluationReport {
  const report: PublicEvaluationReport = {
    metadata: buildMetadata(internal),
    coverage: buildCoverage(internal),
    criteria: internal.criteria.map(buildCriterionScore),
    revisionPriorities: buildRevisionPriorities(internal),
    governance: buildGovernanceSummary(internal),
  };

  // Defensive: assert no banned term leaked through mapping logic
  assertNoBannedTerms(report);

  return report;
}

/**
 * Translate an internal EvaluationResultV2 into a PublicRevisionHandoff.
 *
 * The sole authorized path from Tier 2 → Tier 1 for handoff payloads.
 */
export function translateToPublicHandoff(
  internal: EvaluationResultV2
): PublicRevisionHandoff {
  const handoff: PublicRevisionHandoff = {
    metadata: buildMetadata(internal),
    status: derivePublicStatus(internal),
    governance: buildGovernanceSummary(internal),
    coverage: buildCoverage(internal),
    criteriaSummary: internal.criteria.map((c) => {
      const score = c.scorable ? (c as { score_0_10: number }).score_0_10 : null;
      const rationale = c.rationale ?? "";
      const mid = Math.floor(rationale.length / 2);
      return {
        key: c.key,
        name: criterionLabel(c.key),
        score,
        fitSummary: rationale.slice(0, mid).trim() || rationale,
        gapSummary:
          c.recommendations[0]?.action ?? "No specific gap identified.",
      };
    }),
    revisionPriorities: buildRevisionPriorities(internal),
  };

  assertNoBannedTerms(handoff);

  return handoff;
}
