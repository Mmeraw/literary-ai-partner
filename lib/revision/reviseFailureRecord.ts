/**
 * Revision Failure Record — revision_failure_record_v1
 *
 * Structured failure artifact for every non-trivial failure in the Revise pipeline.
 * Every failure is classified, every failure produces an artifact, and every
 * artifact has authority over the recovery path.
 *
 * SIPOC Authority: docs/SIPOC_REVISE_PROCESS.md
 * Registry: lib/revision/reviseRegistry.ts
 *
 * Doctrine: "downstream may repair absence, not falsehood."
 * Failures are classified as retryable | terminal | manual_review.
 * Retryable failures trigger a backward kick. Terminal failures stop the session.
 * Manual review failures surface in Admin for human triage.
 */

import {
  REVISE_KICK_MATRIX,
  type ReviseKick,
} from './reviseRegistry';

// ─── Failure Taxonomy ────────────────────────────────────────────────────────

export type ReviseFailureDisposition = 'retryable' | 'terminal' | 'manual_review';

export type ReviseStageFailureCode =
  // RS01 Ledger Assembly
  | 'LEDGER_ASSEMBLY_FAILED'
  | 'LEDGER_EVIDENCE_MISSING'
  | 'LEDGER_EMPTY'
  | 'LEDGER_CRITERION_MISSING'
  // RS02 Queue Admission
  | 'ADMISSION_CARD_CONTRACT_FAIL'
  | 'ADMISSION_CANON_GATE_FAIL'
  | 'ADMISSION_VOICE_GATE_FAIL'
  | 'ADMISSION_CANDIDATE_QUALITY_FAIL'
  // RS03 Queue Prioritization
  | 'QUEUE_ASSEMBLY_FAILED'
  | 'QUEUE_OVERCAP'
  | 'QUEUE_EMPTY_AFTER_ADMISSION'
  // RS04 Workbench Load
  | 'WORKBENCH_ANCHOR_UNRESOLVABLE'
  | 'WORKBENCH_DIAGNOSTIC_INCOMPLETE'
  | 'WORKBENCH_MODE_CONTRACT_MISSING'
  | 'WORKBENCH_HYDRATION_FAILED'
  // RS05 Candidate Generation
  | 'CANDIDATE_GENERATION_FAILED'
  | 'CANDIDATE_VOICE_GATE_FAIL'
  | 'CANDIDATE_CANON_GATE_FAIL'
  | 'CANDIDATE_EMPTY'
  | 'CANDIDATE_DUPLICATES_ORIGINAL'
  // RS06 Author Decision
  | 'DECISION_INVALID_VALUE'
  | 'DECISION_MISSING_OPPORTUNITY'
  | 'DECISION_CUSTOM_EMPTY'
  // RS07 Ledger Sync
  | 'LEDGER_SYNC_VALIDATION_FAIL'
  | 'LEDGER_SYNC_DB_ERROR'
  | 'LEDGER_SYNC_DUPLICATE_LOCAL_ID'
  // RS08 Completion
  | 'COMPLETION_PREMATURE'
  | 'COMPLETION_PENDING_SYNC'
  | 'COMPLETION_CERT_INVALID'
  // RS09 Cross-Check
  | 'CROSSCHECK_TIMEOUT'
  | 'CROSSCHECK_INVALID_VERDICT'
  | 'CROSSCHECK_HASH_MISMATCH'
  | 'CROSSCHECK_UNAVAILABLE'
  // RS10 TrustedPath
  | 'TRUSTEDPATH_UNAUTHENTICATED'
  | 'TRUSTEDPATH_INELIGIBLE_VERDICT'
  | 'TRUSTEDPATH_ALREADY_DECIDED'
  | 'TRUSTEDPATH_LEDGER_WRITE_FAIL'
  // Hydration-specific
  | 'HYDRATION_TIMEOUT'
  | 'HYDRATION_SLAE_REJECTION'
  | 'HYDRATION_MODEL_ERROR'
  | 'HYDRATION_BATCH_FAILED'
  // Engine-level
  | 'REVISION_FINALIZE_FAILED'
  | 'REVISION_ENGINE_UNCAUGHT';

// ─── Failure Disposition Classification ──────────────────────────────────────

const TERMINAL_CODES = new Set<ReviseStageFailureCode>([
  'DECISION_INVALID_VALUE',
  'DECISION_MISSING_OPPORTUNITY',
  'COMPLETION_CERT_INVALID',
  'CROSSCHECK_HASH_MISMATCH',
  'TRUSTEDPATH_UNAUTHENTICATED',
]);

const MANUAL_REVIEW_CODES = new Set<ReviseStageFailureCode>([
  'WORKBENCH_ANCHOR_UNRESOLVABLE',
  'ADMISSION_CANON_GATE_FAIL',
  'ADMISSION_VOICE_GATE_FAIL',
  'CANDIDATE_VOICE_GATE_FAIL',
  'CANDIDATE_CANON_GATE_FAIL',
  'CANDIDATE_DUPLICATES_ORIGINAL',
  'TRUSTEDPATH_INELIGIBLE_VERDICT',
  'TRUSTEDPATH_ALREADY_DECIDED',
  'CROSSCHECK_INVALID_VERDICT',
]);

export function classifyFailureDisposition(code: ReviseStageFailureCode): ReviseFailureDisposition {
  if (TERMINAL_CODES.has(code)) return 'terminal';
  if (MANUAL_REVIEW_CODES.has(code)) return 'manual_review';
  return 'retryable';
}

// ─── Kick Resolution ─────────────────────────────────────────────────────────

export function resolveKickTarget(failureCode: string): ReviseKick | null {
  return REVISE_KICK_MATRIX.find((kick) => kick.kickCode === failureCode) ?? null;
}

export function isKickEligible(failureCode: string): boolean {
  return resolveKickTarget(failureCode) !== null;
}

// ─── Revision Failure Record v1 ──────────────────────────────────────────────

export type RevisionFailureRecordV1 = {
  artifact_type: 'revision_failure_record_v1';
  session_id: string;
  stage_id: string;
  failure_code: ReviseStageFailureCode;
  disposition: ReviseFailureDisposition;
  retryable: boolean;
  recommended_kick: string | null;
  kick_reason: string | null;
  attempt_count: number;
  max_attempts: number;
  evidence: string[];
  opportunity_id: string | null;
  error_message: string;
  occurred_at: string;
};

export function buildRevisionFailureRecord(input: {
  sessionId: string;
  stageId: string;
  failureCode: ReviseStageFailureCode;
  attemptCount: number;
  opportunityId?: string | null;
  errorMessage: string;
  evidence?: string[];
}): RevisionFailureRecordV1 {
  const disposition = classifyFailureDisposition(input.failureCode);
  const kick = resolveKickTarget(input.failureCode);
  const maxAttempts = disposition === 'retryable' ? (kick?.severity === 'blocking' ? 1 : 2) : 0;

  return {
    artifact_type: 'revision_failure_record_v1',
    session_id: input.sessionId,
    stage_id: input.stageId,
    failure_code: input.failureCode,
    disposition,
    retryable: disposition === 'retryable' && input.attemptCount < maxAttempts,
    recommended_kick: kick?.targetStageId ?? null,
    kick_reason: kick?.resolution ?? null,
    attempt_count: input.attemptCount,
    max_attempts: maxAttempts,
    evidence: input.evidence ?? [],
    opportunity_id: input.opportunityId ?? null,
    error_message: input.errorMessage,
    occurred_at: new Date().toISOString(),
  };
}

// ─── Hydration Failure Status ────────────────────────────────────────────────

export type HydrationStatus = 'pending' | 'hydrated' | 'failed_retryable' | 'failed_terminal';

export type HydrationFailureRecordV1 = {
  artifact_type: 'candidate_hydration_failure_v1';
  opportunity_id: string;
  hydration_status: HydrationStatus;
  failure_code: ReviseStageFailureCode | null;
  attempt_count: number;
  max_attempts: number;
  rejection_reason: string | null;
  model: string;
  prompt_version: string;
  occurred_at: string;
};

export function buildHydrationFailureRecord(input: {
  opportunityId: string;
  failureCode: ReviseStageFailureCode;
  attemptCount: number;
  maxAttempts: number;
  rejectionReason: string | null;
  model: string;
  promptVersion: string;
}): HydrationFailureRecordV1 {
  const isRetryable = input.attemptCount < input.maxAttempts
    && (input.failureCode === 'HYDRATION_TIMEOUT' || input.failureCode === 'HYDRATION_MODEL_ERROR');

  return {
    artifact_type: 'candidate_hydration_failure_v1',
    opportunity_id: input.opportunityId,
    hydration_status: isRetryable ? 'failed_retryable' : 'failed_terminal',
    failure_code: input.failureCode,
    attempt_count: input.attemptCount,
    max_attempts: input.maxAttempts,
    rejection_reason: input.rejectionReason,
    model: input.model,
    prompt_version: input.promptVersion,
    occurred_at: new Date().toISOString(),
  };
}
