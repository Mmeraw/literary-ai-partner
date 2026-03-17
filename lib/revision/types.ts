export type ProposalAction = "preserve" | "refine" | "replace";
export type ProposalSeverity = "low" | "medium" | "high";
export type ProposalDecision = "accepted" | "rejected" | "modified";
export type RevisionSessionStatus =
  | "open"
  | "findings_ready"
  | "synthesis_started"
  | "proposals_ready"
  | "applied"
  | "failed";
export type FindingActionHint = ProposalAction;
export type FindingStatus = "open" | "resolved" | "ignored";

export type RevisionSession = {
  id: string;
  evaluation_run_id: string;
  source_version_id: string;
  result_version_id: string | null;
  status: RevisionSessionStatus;
  summary: Record<string, unknown>;
  findings_count: number;
  actionable_findings_count: number;
  proposal_ready_actionable_findings_count: number;
  proposals_created_count: number;
  created_at: string;
  completed_at: string | null;
  last_transition_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
};

export type ChangeProposal = {
  id: string;
  revision_session_id: string;
  location_ref: string;
  rule: string;
  action: ProposalAction;
  original_text: string;
  proposed_text: string;
  justification: string;
  severity: ProposalSeverity;
  decision: ProposalDecision | null;
  modified_text: string | null;
  anchor_start: number | null;
  anchor_end: number | null;
  anchor_context: string | null;
  created_at: string;
};

export type DiagnosticFinding = {
  id: string;
  evaluation_job_id: string;
  manuscript_version_id: string | null;
  artifact_id: string | null;
  criterion_key: string;
  wave_id: string | null;
  finding_type: string;
  severity: ProposalSeverity;
  confidence: number | null;
  location_ref: string | null;
  chunk_id: string | null;
  chapter_index: number | null;
  paragraph_index: number | null;
  sentence_index: number | null;
  original_text: string | null;
  evidence_excerpt: string | null;
  diagnosis: string;
  recommendation: string | null;
  action_hint: FindingActionHint | null;
  status: FindingStatus;
  created_at: string;
};

export type CreateRevisionSessionInput = {
  evaluation_run_id: string;
  source_version_id: string;
};

export type CreateChangeProposalInput = {
  revision_session_id: string;
  location_ref: string;
  rule: string;
  action: ProposalAction;
  original_text: string;
  proposed_text: string;
  justification: string;
  severity: ProposalSeverity;
  anchor_start?: number | null;
  anchor_end?: number | null;
  anchor_context?: string | null;
};

export type CreateDiagnosticFindingInput = {
  evaluation_job_id: string;
  manuscript_version_id?: string | null;
  artifact_id?: string | null;
  criterion_key: string;
  wave_id?: string | null;
  finding_type: string;
  severity: ProposalSeverity;
  confidence?: number | null;
  location_ref?: string | null;
  chunk_id?: string | null;
  chapter_index?: number | null;
  paragraph_index?: number | null;
  sentence_index?: number | null;
  original_text?: string | null;
  evidence_excerpt?: string | null;
  diagnosis: string;
  recommendation?: string | null;
  action_hint?: FindingActionHint | null;
  status?: FindingStatus;
};

export type ApplyRevisionSessionResult = {
  revision_session_id: string;
  source_version_id: string;
  result_version_id: string;
  accepted_count: number;
  modified_count: number;
};

export type EvaluationProposalCandidate = {
  location_ref?: string | null;
  rule?: string | null;
  action?: ProposalAction | null;
  original_text?: string | null;
  proposed_text?: string | null;
  justification?: string | null;
  severity?: ProposalSeverity | null;
};
