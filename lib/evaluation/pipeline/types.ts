/**
 * Phase 2.7 — Evaluation Uplift: 4-Pass Pipeline
 * Type contracts for the dual-axis multi-pass evaluation pipeline.
 *
 * Non-Goals (see PHASE_2_7_SPEC.md §2):
 *   - no new DB tables, no schema migrations
 *   - no UI changes, no WAVE, no multi-chunk (2.8), no provider switching (2.10)
 */

import type { CriterionKey } from "@/schemas/criteria-keys";

// ── Recommendation semantic vocabulary ───────────────────────────────────────

/**
 * Broad craft/problem class. Controlled vocabulary — do not use free-form strings.
 * Add new values here before using them in Pass 3 output.
 */
export type IssueFamily =
  | "pacing"
  | "dialogue"
  | "closure"
  | "characterization"
  | "exposition"
  | "tension"
  | "prose_control"
  | "scene_structure"
  | "voice"
  | "market_positioning"
  | "concept"
  | "theme"
  | "worldbuilding";

/**
 * Higher-order editorial lever — the main semantic dedupe handle.
 * Two recommendations sharing the same strategic_lever are candidates for collapse.
 * Controlled vocabulary — do not use free-form strings.
 */
export type StrategicLever =
  | "momentum_visibility"
  | "dialogue_exposition_density"
  | "scene_goal_clarity"
  | "closure_state_lock"
  | "character_voice_differentiation"
  | "tension_escalation"
  | "exposition_load_reduction"
  | "prose_compression"
  | "market_signal_clarity"
  | "pov_rendering_precision"
  | "structural_commitment"
  | "thematic_grounding"
  | "sensory_specificity";

/**
 * Where the revision fix primarily operates.
 * Controls whether same-lever recommendations are truly distinct.
 */
export type RevisionGranularity = "line" | "beat" | "scene" | "chapter" | "manuscript";

// ── Evidence ─────────────────────────────────────────────────────────────────

export type EvidenceAnchor = {
  /** ≤200 chars, verbatim from manuscript text */
  snippet: string;
  char_start?: number;
  char_end?: number;
  segment_id?: string;
};

// ── Dialogue Attribution Diagnostics (FR-1: Canonical shared type) ───────────

/**
 * Structured diagnostic signals for dialogue attribution and rendering.
 * Single source of truth imported by: quality gate, Pass 3 backfill, fallback logic, tests.
 * Prevents lexical-semantic mismatch between enforcement layers.
 * Canonical import: lib/evaluation/pipeline/types.ts
 */
export type DialogueAttributionDiagnostics = {
  /** Count of quoted speech segments in manuscript */
  quotedSpeechCount: number;
  /** Number of dialogue turn transitions */
  dialogueTurnCount: number;
  /** Explicit attribution tags (said, asked, replied, etc.) */
  explicitTagCount: number;
  /** Action beats adjacent to or replacing attribution */
  actionBeatCount: number;
  /** Attribution tag frequency per 1000 words */
  tagDensity: number;
  /** Action beat frequency per 1000 words */
  actionBeatDensity: number;
  /** Speaker identification clarity across narrative */
  turnTakingClarity: "clear" | "mixed" | "unclear";
  /** Risk of speaker confusion or ambiguity */
  speakerAmbiguityRisk: "low" | "medium" | "high";
  /** Observable rendering techniques found in dialogue */
  renderingModesDetected: Array<
    | "direct_speech"
    | "indirect_speech"
    | "reported_speech"
    | "interiority_during_dialogue"
    | "action_beat_attribution"
    | "tagged_speech"
    | "tagless_exchange"
  >;
  /** How the manuscript attributes or renders speaker identity */
  speakerAttributionStrategy: Array<
    | "explicit_tags"
    | "action_beats"
    | "voice_differentiation"
    | "alternating_turns"
    | "contextual_anchoring"
  >;
  /** Human-readable summary of dialogue attribution mechanisms */
  diagnosticSummary: string;
};

// (file unchanged above this line for brevity in patch)

export interface ArtifactScoreLedger {
  rawTotal: number;
  maxTotal: number;
  normalized: number;
  weighting: "equal" | "weighted";
}

// (rest of file unchanged)
