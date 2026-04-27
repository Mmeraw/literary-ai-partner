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


// ── Single-axis criterion result (Pass 1 or 2) ──────────────────────────────

export type AxisCriterionResult = {
  key: CriterionKey;
  /** Integer 0-10, no half-points (Canon) */
  score_0_10: number;
  rationale: string;
  evidence: EvidenceAnchor[];
  recommendations: {
    priority: "high" | "medium" | "low";
    /** 50-300 chars, must reference anchor_snippet */
    action: string;
    expected_impact: string;
    /** The specific text this recommendation targets */
    anchor_snippet: string;
    /** Broad craft/problem class (canonical vocabulary) */
    issue_family: IssueFamily;
    /** Higher-order editorial lever — semantic dedupe handle (canonical vocabulary) */
    strategic_lever: StrategicLever;
    /** Where the fix primarily operates */
    revision_granularity: RevisionGranularity;
  }[];
};

// ── Pass 1 / Pass 2 output ───────────────────────────────────────────────────

export type SinglePassOutput = {
  pass: 1 | 2;
  axis: "craft_execution" | "editorial_literary";
  criteria: AxisCriterionResult[];
  model: string;
  prompt_version: string;
  temperature: number;
  generated_at: string; // ISO 8601
};

// ── Pass 3: Synthesized criterion ────────────────────────────────────────────

export type SynthesizedCriterion = {
  key: CriterionKey;
  craft_score: number;
  editorial_score: number;
  /** Reconciled score, not a simple average (spec §3.3) */
  final_score_0_10: number;
  /** |craft_score - editorial_score| */
  score_delta: number;
  /** Required when score_delta > 2 */
  delta_explanation?: string;
  final_rationale: string;
  /** Where narrative pressure enters or accumulates for this criterion */
  pressure_points: string[];
  /** Where a decision (or non-decision) is reached */
  decision_points: string[];
  /** Whether consequence lands now, is deferred, or dissipates */
  consequence_status: "landed" | "deferred" | "dissipated";
  /** Required when consequence_status is deferred */
  deferred_consequence_risk?: string;
  evidence: EvidenceAnchor[];
  recommendations: {
    priority: "high" | "medium" | "low";
    action: string;
    expected_impact: string;
    anchor_snippet: string;
    /** Which pass originated this recommendation */
    source_pass: 1 | 2 | 3;
    /** Broad craft/problem class (canonical vocabulary) */
    issue_family: IssueFamily;
    /** Higher-order editorial lever — semantic dedupe handle (canonical vocabulary) */
    strategic_lever: StrategicLever;
    /** Where the fix primarily operates */
    revision_granularity: RevisionGranularity;
    /**
     * Deterministic collapse key for semantic dedup.
     * Format: issue_family:strategic_lever:revision_granularity
     * Built by buildRedundancyKey() after normalization.
     */
    redundancy_key?: string;
    /** Number of distinct evidence spans supporting this recommendation */
    evidence_span_count?: number;
  }[];
  /** Deterministic confidence score derived from evidence support + explanation quality (0-100). */
  confidence_score_0_100?: number;
  /** Confidence bucket for user-facing trust rendering. */
  confidence_level?: "high" | "moderate" | "low";
  /** Explainability breadcrumbs for confidence classification. */
  confidence_reasons?: string[];
  /** Scorability semantics separated from confidence semantics. */
  scorability_status?: "scorable" | "scorable_low_confidence" | "non_scorable";
};

// ── Pass 3 output ────────────────────────────────────────────────────────────

export type SynthesisOutput = {
  criteria: SynthesizedCriterion[];
  overall: {
    /** Computed via Vol II-A §WCS */
    overall_score_0_100: number;
    verdict: "pass" | "revise" | "fail";
    /** ≤500 chars */
    one_paragraph_summary: string;
    top_3_strengths: string[];
    top_3_risks: string[];
    /**
     * Writer-facing submission readiness posture.
     * queryable_now — strong enough to submit
     * close — one focused revision pass would materially improve requestability
     * not_yet — substantial issues prevent strong submission posture
     */
    submission_readiness: "queryable_now" | "close" | "not_yet";
  };
  metadata: {
    pass1_model: string;
    pass2_model: string;
    pass3_model: string;
    generated_at: string;
  };
  /** TRUTH ENFORCEMENT: Was manuscript truncated/sampled for evaluation? */
  partial_evaluation: boolean;
  /** Coverage metadata: proves system doesn't lie about what was analyzed */
  coverage_scope?: {
    sourceChars: number;
    sourceWords: number;
    analyzedChars: number;
    analyzedWords: number;
    strategy: "full_text" | "sampled_beginning_middle_end";
  };
};

// ── Pass 4: Quality gate result ──────────────────────────────────────────────

export type QualityGateCheck = {
  check_id: string;
  passed: boolean;
  error_code?: string;
  details?: string;
  diagnostics?: unknown;
};

export type QualityGateResult = {
  pass: boolean;
  checks: QualityGateCheck[];
  warnings: string[];
};

// ── Completion capture / usage telemetry ───────────────────────────────────

export type CompletionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type PassCompletionCapture = {
  pass: 1 | 2 | 3;
  raw_text: string;
  model: string;
  usage?: CompletionUsage;
  finish_reason?: string;
  request_id?: string;
  generated_at: string;
};

// ── Pipeline result ──────────────────────────────────────────────────────────

export type PipelineResult =
  | {
      ok: true;
      synthesis: SynthesisOutput;
      quality_gate: QualityGateResult;
      /** Populated when perplexityApiKey provided and cross-check succeeded */
      cross_check?: import("./perplexityCrossCheck").CrossCheckOutput;
      /** Always present after quality gate passes; undefined only if evaluatePass4Governance throws */
      pass4_governance?: import("@/lib/evaluation/governance/evaluatePass4Governance").GovernanceDecision;
    }
  | {
      ok: false;
      error: string;
      error_code: string;
      failed_at: "pass1" | "pass2" | "pass3" | "pass4";
      failure_details?: {
        json_boundary?: {
          code: string;
          candidates_found?: number;
          raw_head?: string;
          raw_tail?: string;
          normalized_tail?: string;
          candidate_tail?: string;
        };
        llr_diagnostic_snapshot?: {
          stage: "post_convergence" | "pre_artifact_generation";
          blocked_rule_ids: string[];
          convergence_result: SynthesisOutput;
        };
      };
    };

// ── Artifact Validation Layer ─────────────────────────────────────────────────
// GOVERNANCE: ArtifactValidationResult is pipeline-internal ONLY.
// It MUST NOT be conflated with JobStatus (queued|running|complete|failed).

export type ArtifactGateResult = "PASS" | "HOLD" | "FAIL";

export type ArtifactReasonCode =
  | "CRIT-MISSING-ALL"       // no criteria at all
  | "CRIT-MISSING-1"         // wrong count or missing expected keys
  | "SCORE-NON-INTEGER-1"    // non-integer score
  | "SCORE-OUT-OF-RANGE-1"   // <0 or >10
  | "EVIDENCE-MISSING-1"     // empty/whitespace evidence
  | "REASONING-MISSING-1"    // empty/whitespace reasoning
  | "INTERP-MISSING-1"       // empty/whitespace interpretation
  | "SCORE-NORM-1"           // ledger inconsistent with criteria
  | "EFG-MISMATCH-1";        // verdict or blockers don't match deterministic builder

export interface CriterionEvaluation {
  key: CriterionKey;
  final_score_0_10: number;
  reasoning: string;
  evidence: string;
  interpretation: string;
}

export interface ArtifactScoreLedger {
  rawTotal: number;
  maxTotal: number;
  normalized: number;
  weighting: "equal";
}

export type SubmissionReadiness =
  | "submission-ready"
  | "close-but-not-ready"
  | "not-yet-ready";

export interface ExcellenceFilterFooter {
  verdict: SubmissionReadiness;
  blockingCriteria: CriterionKey[];
}

export interface EvaluationArtifact {
  criteria: CriterionEvaluation[];
  ledger: ArtifactScoreLedger;
  efg: ExcellenceFilterFooter;
}

export interface ArtifactValidationSummary {
  result: ArtifactGateResult;
  reasonCodes: ArtifactReasonCode[];
}

// ── Advisory Plan Layer ───────────────────────────────────────────────────────

export type AdvisorySeverity = "blocking" | "advisory";

export type AdvisoryLane =
  | "clarify_premise_hook"
  | "increase_escalation_consequence"
  | "deepen_character_pressure"
  | "tighten_voice_control"
  | "strengthen_scene_turns"
  | "increase_dialogue_subtext"
  | "dramatize_theme"
  | "sharpen_environmental_function"
  | "compress_pacing_drag"
  | "tighten_line_level_prose"
  | "stabilize_tonal_contract"
  | "strengthen_promise_delivery"
  | "clarify_market_positioning";

export interface AdvisoryPlanItem {
  criterion: CriterionKey;
  score: number;
  severity: AdvisorySeverity;
  advisoryLane: AdvisoryLane;
  requiredRevisionScope: "line" | "beat" | "scene" | "chapter" | "manuscript";
}
