export type RevisionEventType =
  | "session"
  | "proposal"
  | "apply"
  | "finalize"
  | "immutability"
  | "smoke"
  | "hydration";

export type RevisionEventSeverity =
  | "info"
  | "warn"
  | "error"
  | "critical";

export type RevisionEventCode =
  | "REVISION_SESSION_CREATED"
  | "REVISION_SESSION_FINDINGS_READY"
  | "REVISION_SESSION_SYNTHESIS_STARTED"
  | "REVISION_SESSION_PROPOSALS_READY"
  | "REVISION_SESSION_APPLIED"
  | "REVISION_SESSION_FAILED"
  | "REVISION_SESSION_TRANSITION_REJECTED"
  | "REVISION_SESSION_FINALIZED"
  | "REVISION_SESSION_FINALIZE_FAILED"
  | "PROPOSAL_SYNTHESIS_STARTED"
  | "PROPOSAL_SYNTHESIS_COMPLETED"
  | "PROPOSAL_GENERATED"
  | "PROPOSAL_ANCHOR_CREATED"
  | "PROPOSAL_ANCHOR_AMBIGUOUS"
  | "PROPOSAL_ANCHOR_MISSING"
  | "APPLY_ANCHORED_MISSING_OFFSETS"
  | "APPLY_ANCHORED_SUCCESS"
  | "APPLY_ANCHORED_SLICE_MISMATCH"
  | "APPLY_ANCHORED_CONTEXT_MISMATCH"
  | "APPLY_LEGACY_FALLBACK_SUCCESS"
  | "APPLY_LEGACY_NOT_FOUND"
  | "APPLY_LEGACY_AMBIGUOUS"
  | "SOURCE_IMMUTABLE_CONFIRMED"
  | "SOURCE_IMMUTABILITY_VIOLATION"
  | "SMOKE_STALE_RUN_REJECTED"
  | "SMOKE_FRESH_RUN_SELECTED"
  | "SMOKE_RUN_PASSED"
  | "SMOKE_RUN_FAILED"
  | "CANDIDATE_HYDRATION_REJECTED"
  | "REVISION_CANDIDATE_REJECTED"
  | "REVISION_SESSION_FAILED_RETRYABLE"
  | "REVISION_SESSION_RETRY_FROM_FAILED_RETRYABLE"
  | "REVISION_SESSION_RETRY_FAILED";

export type LogRevisionEventInput = {
  revision_session_id?: string | null;
  proposal_id?: string | null;
  manuscript_id?: number | null;
  manuscript_version_id?: string | null;
  evaluation_run_id?: string | null;
  event_type: RevisionEventType;
  severity?: RevisionEventSeverity;
  event_code: RevisionEventCode;
  message?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Privacy-safe structural dimensions recorded when a hydrated candidate is
 * rejected. Contains ONLY non-content identifiers and classification signals.
 *
 * MUST NOT include: candidate text (A/B/C), evidence_anchor, rationale,
 * source excerpt, or any manuscript prose.
 */
export type CandidateRejectionTelemetry = {
  /** Opaque opportunity identifier — no prose content. */
  opportunity_id: string;
  /** Canonical rejection reason codes (e.g. anchor_mismatch, canon_authority_blocked). */
  rejection_reasons: string[];
  /** Primary rejection reason for quick filtering. */
  rejection_reason_primary: string;
  /** Criterion key (e.g. "NARRATIVE_DRIVE"). No manuscript text. */
  criterion: string;
  /** Severity band. */
  severity: "must" | "should" | "could";
  /** Revision operation type. */
  revision_operation: string | null;
  /** Correlation identifier for the parent evaluation job. */
  job_id: string;

  /** Whether an anchor exists (text not logged). */
  anchor_found: boolean;
  /** Anchor length in words (numeric only). */
  anchor_length_words: number;
  /** Candidate word counts only — never candidate text. */
  candidate_word_counts: { a: number; b: number; c: number };
  /** Per-candidate overlap score vs anchor, normalized 0..1. */
  candidate_anchor_overlap_scores: { a: number; b: number; c: number };
  /** Whether a contextual passage was found for hydration. */
  context_found: boolean;
  /** True when coordinates are placeholder/non-targetable. */
  coordinates_placeholder: boolean;
  /** True when recommendation rationale appears contaminated. */
  rationale_contaminated: boolean;
  /** True when this opportunity was attempted by hydration runtime. */
  hydration_attempted: boolean;
  /** Hydration result class for this opportunity. */
  hydration_result: string;
  /** Hydration prompt contract version (no prompt text). */
  prompt_version: string;
  /** Model identifier used for hydration generation. */
  model: string | null;
  /** Candidate-generation lifecycle status from persisted artifact payload. */
  candidate_generation_status: string;
};
