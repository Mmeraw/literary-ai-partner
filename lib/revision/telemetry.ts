export type RevisionEventType =
  | "session"
  | "proposal"
  | "apply"
  | "finalize"
  | "immutability"
  | "smoke";

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
  | "SMOKE_RUN_FAILED";

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
