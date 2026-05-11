/**
 * PUBLIC_SURFACE_CANON_v1 — Tier 1 Public Evaluation Schema
 *
 * This file defines the ONLY types that may appear in user-facing API responses,
 * UI renders, and file exports.
 *
 * DO NOT add internal fields (wave IDs, gate IDs, schema_version, policy_family,
 * prompt_version, criteria_plan, repro_anchor, score_adjustments, etc.).
 *
 * The sole authorized producer of these types is:
 *   lib/evaluation/translateToPublicReport.ts
 *
 * See: docs/PUBLIC_SURFACE_CANON_v1.md
 */

export type PublicEvaluationStatus = "CERTIFIED" | "CANDIDATE" | "REJECTED";
export type PublicGovernanceStatus = "VALID" | "BLOCKED";

export interface PublicAnchorReference {
  /** e.g. "Chapter 3, scene 2" or "Page 47, paragraph 2" */
  label: string;
  /** Short excerpt from the manuscript (user's own text). */
  excerpt: string;
}

export interface PublicRevisionSuggestion {
  title: string;
  description: string;
  anchors: PublicAnchorReference[];
  whyItMatters: string;
}

export interface PublicCriterionScore {
  /** Public criterion key from NOMENCLATURE_CANON_v1 (e.g. "voice", "pacing"). */
  key: string;
  /** Craft-language label (see PUBLIC_SURFACE_CANON_v1 §6). */
  name: string;
  /** 0–10; null when not scorable (insufficient signal or not applicable). */
  score: number | null;
  /** Plain-language "what's working" statement. */
  fitStatement: string;
  /** Plain-language "what needs work" statement. */
  gapStatement: string;
  /** How this criterion affects the reader. */
  readerImpact: string;
  confidence: "low" | "medium" | "high";
  /** e.g. "Scored on 11 scenes with strong evidence" */
  coverageNote: string;
  revisionSuggestions: PublicRevisionSuggestion[];
}

export interface PublicRevisionPriority {
  /** Stable public ID (opaque; not a wave, gate, or doctrine ID). */
  id: string;
  title: string;
  description: string;
  rationale: string;
  /** Dependency-aware editorial explanation of ordering — in craft language only. */
  whyFirst: string;
  anchors: PublicAnchorReference[];
  estimatedEffort: "low" | "medium" | "high";
  estimatedImpact: "low" | "medium" | "high";
}

export interface PublicCoverageSummary {
  manuscriptWords: number;
  /** 0–100 */
  coveragePct: number;
  /** Plain-language description of coverage scope. */
  coverageNarrative: string;
  criteriaWithInsufficientSignal: string[];
}

export interface PublicGovernanceSummary {
  governanceStatus: PublicGovernanceStatus;
  /** Why VALID or BLOCKED, in plain craft language. No gate IDs. */
  statusNarrative: string;
}

export interface PublicEvaluationMetadata {
  /** Opaque public report identifier. NOT the internal evaluation_run_id. */
  evaluationId: string;
  manuscriptId: string;
  createdAt: string;
  updatedAt: string;
  status: PublicEvaluationStatus;
}

/**
 * PublicEvaluationReport — the canonical Tier 1 evaluation report.
 *
 * This is the only type serialized to API responses, UI pages, and file exports.
 * All fields are in craft language. Internal IP identifiers are banned.
 */
export interface PublicEvaluationReport {
  metadata: PublicEvaluationMetadata;
  coverage: PublicCoverageSummary;
  /** All applicable story criteria (13 axes). */
  criteria: PublicCriterionScore[];
  /** Top 3–5 revision priorities in editorial order. */
  revisionPriorities: PublicRevisionPriority[];
  governance: PublicGovernanceSummary;
  /** Optional display notes. Must not contain internal IDs. */
  notes?: string;
}

/**
 * PublicRevisionHandoff — the canonical Tier 1 revision hand-off payload.
 *
 * Used by the revision UI and downstream export serializers.
 * See: docs/PUBLIC_SURFACE_CANON_v1.md §4.2
 */
export interface PublicRevisionHandoff {
  metadata: PublicEvaluationMetadata;
  status: PublicEvaluationStatus;
  governance: PublicGovernanceSummary;
  coverage: PublicCoverageSummary;
  criteriaSummary: Array<{
    key: string;
    name: string;
    score: number | null;
    fitSummary: string;
    gapSummary: string;
  }>;
  revisionPriorities: PublicRevisionPriority[];
}
