/**
 * Executable failure recovery policy for process-stage governance audits.
 *
 * This intentionally separates failure disposition from kick coverage:
 * - mapped kick failures recover by rolling back to a certified checkpoint and
 *   passing the failure delta as diagnostic evidence;
 * - non-kick failures must still have an explicit terminal/retry/log policy;
 * - failed artifacts are audit evidence only, never replacement authority.
 */

export type FailureRecoveryPolicyMode =
  | 'rollback_to_certified_checkpoint'
  | 'retry_then_terminal_block'
  | 'terminal_block'
  | 'log_only';

export type FailureRecoveryPolicy = {
  mode: FailureRecoveryPolicyMode;
  checkpointArtifact: 'unified_evaluation_document_v1' | null;
  diagnosticPacket: 'stage_failure_delta_v1' | null;
  retryLimit: number;
  escalation: 'redo_target_from_kick_matrix' | 'terminal_block_after_retry' | 'terminal_block' | 'passive_observability';
  retainFailedAttemptSnapshot: boolean;
  mutationPolicy: 'no_in_place_mutation_of_certified_artifacts';
  failedArtifactAuthority: 'audit_evidence_only';
  authorExposure: boolean;
};

export type FailureRecoveryDefinition = {
  failureCode: string;
  recoveryPolicy: FailureRecoveryPolicy;
};

const LOG_ONLY_FAILURE_CODES = [
  'FINAL_AUDIT_LOW_COVERAGE',
  'QG_DUPLICATE_REC',
  'QG_GENERIC_REC',
  'REC_INTEGRITY_GENERIC',
  'WORKBENCH_DIAGNOSTIC_INCOMPLETE',
] as const;

const RETRY_THEN_TERMINAL_BLOCK_FAILURE_CODES = [
  'ACCESS_LOG_WRITE_FAILED',
  'CANDIDATE_GENERATION_FAILED',
  'CLAIM_RPC_FAILED',
  'CROSSCHECK_TIMEOUT',
  'CROSSCHECK_UNAVAILABLE',
  'DB_WRITE_FAILED',
  'DOWNLOAD_RENDER_FAILED',
  'DREAM_TIMEOUT',
  'GENERATION_TIMEOUT',
  'LEASE_OVERLAP_DETECTED',
  'LEDGER_SYNC_DUPLICATE_LOCAL_ID',
  'PASS1_TIMEOUT',
  'PASS2_INDEPENDENCE_REWRITE_FAILED',
  'PASS2_TIMEOUT',
  'PASS3_TIMEOUT',
  'PHASE1A_HANDOFF_TRANSITION_FAILED',
  'PHASE3_TEXT_CONTRACT_FAILED',
  'PHASE2_PASS12_FAILED',
  'PHASE2_PASS1_MISSING',
  'HANDOFF_INCOMPLETE_SENTENCE',
  'HANDOFF_SCAFFOLD_RESIDUE',
  'HANDOFF_BROKEN_MODAL',
  'HANDOFF_MISSING_EVIDENCE_ANCHOR',
  'HANDOFF_ORPHANED_CONJUNCTION',
  'HANDOFF_DANGLING_REFERENCE',
  'REVISE_AUTHOR_DECISION_NOT_PERSISTED', // deferred: governance-only, no runtime emit site exists yet (Revise RS06 write path not yet throwing)
  'REVISE_SEED_GENERATION_FAILED',         // deferred: governance-only, Revise-scoped seed failure; emit site pending RS05 hardening
  'REVISION_LEDGER_ASSEMBLY_FAILED',       // deferred: governance-only, retry disposition declared but no throw site confirmed; see LEDGER_ASSEMBLY_FAILED (terminal) for RS01 coverage
  'REVOCATION_NOT_PERSISTED',              // deferred: governance-only, persistence write failure in Revise revocation path; emit site not yet implemented
  'SEED_GENERATION_FAILED',
  'TRUSTEDPATH_UNAUTHENTICATED',
  'WAVE_EXECUTION_TIMEOUT',
  'WORKBENCH_HYDRATION_FAILED',
] as const;

const ROLLBACK_TO_CERTIFIED_CHECKPOINT_FAILURE_CODES = [
  'ACCESS_CONTROL_BYPASS',
  'ACCESS_GRANT_MISSING',
  'ACCESS_REQUEST_NOT_CREATED',
  'ADMISSION_CANON_GATE_FAIL',
  'ADMISSION_CARD_CONTRACT_FAIL',
  'AGENT_PACKAGE_RENDERER_OUTPUT_INVALID',
  'APPROVAL_ACTOR_NOT_AUTHORIZED',
  'ARTIFACT_NOT_ALLOWED',
  'CANDIDATE_CANON_GATE_FAIL',
  'CANDIDATE_VOICE_GATE_FAIL',
  'COMPLETION_PREMATURE',
  'CROSSCHECK_INVALID_VERDICT',
  'DB_WRITE_FAILURE', // Deprecated: use DB_WRITE_FAILED (retry_then_terminal) as canonical runtime code
  'DECISION_INVALID_VALUE',
  'DIALOGUE_CANON_EXECUTION_FAILED',
  'DOWNLOAD_PARITY_FAILED',
  'DREAM_SYNTHESIS_FAILED',
  'EDITORIAL_META_LANGUAGE',
  'FINAL_AUDIT_CONTRADICTION',
  'FORBIDDEN_SCOPE_REQUESTED',
  'GATE15_EXECUTION_FAILED',
  'HANDOFF_GENERIC_LANGUAGE',
  'HANDOFF_MIDSENTENCE_TERMINATION', // Author-facing prose ended mid-sentence; kick-eligible Pass 3 re-synthesis.
  'INELIGIBLE_MANUSCRIPT', // Separate-subsystem HTTP gate (Agent Readiness AR01, HTTP 422); not an evaluation job processor failure. No markFailed() path.
  'INVALID_FORMAT',
  'LEDGER_EVIDENCE_MISSING',
  'LEDGER_SYNC_DB_ERROR',
  'LEDGER_SYNC_VALIDATION_FAIL',
  'LISTING_ALREADY_EXISTS',
  'MANUSCRIPT_NOT_FINAL', // Separate-subsystem HTTP gate (Storygate SG08, HTTP 400); listing activation subsystem, not evaluation pipeline. Route uncertified in current snapshot.
  'MARKET_COMPARABLES_MISSING',
  'MISSING_CONTEXT',
  'MISSING_REQUIRED_FIELDS',
  'NO_COMPLETED_EVALUATION',
  'OUTPUT_TOO_SHORT',
  'OUTPUT_TOO_THIN',
  'PACKAGE_AUTHORITY_INVALID',
  'PACKAGE_GATE_FAILED',
  'PHASE5_BANNED_ENTITY', // Certification return-value gate; enforced through validateDownloadParity() and author exposure certification, not a thrown runtime failure.
  'PHASE5_MISSING_AUDIT', // Certification return-value gate; enforced through finalExternalAuditAllowsAuthorExposure() in author exposure certification, not a thrown runtime failure.
  'PHASE5_RENDER_PARITY_FAIL', // Certification return-value gate; enforced through author exposure certification, not a thrown runtime failure.
  'PHASE5_TEMPLATE_CONTRACT_FAIL', // Certification return-value gate; enforced through author exposure certification (decision_not_certified / blocking_reasons_present), not a thrown runtime failure.
  'PHASE5_UNCERTIFIED_OUTPUT', // Certification return-value gate; enforced through author exposure certification (decision_not_certified), not a thrown runtime failure.
  'QG_ARTIFACT_GATE_FAIL',
  'QG_CONSEQUENCE_CONTRACT',
  'QG_MISSING_REQUIRED_EVIDENCE',
  'QG_SUMMARY_OMITS_WEAKNESS',
  // U4-001: U3-001 summary↔criterion consistency gate — kick-eligible, 1 retry (U4-001, 2026-07-07).
  // Re-synthesis may produce consistent reasoning. Mirrors QG_SUMMARY_OMITS_WEAKNESS policy.
  'QG_SUMMARY_CRITERION_CONTRADICTION',
  'QUALITY_GATE_NOT_PASSED',          // governance alias: generic rollup; QG_* codes cover all runtime gate surfaces; redundant unless a non-QG_ gate surface is identified
  'REC_INTEGRITY_FUSED_FIELDS', // Recommendation fields fused without sentence boundary; kick-eligible Pass 3 re-synthesis.
  'REC_INTEGRITY_LOWERCASE_OPENING', // Recommendation text opened lowercase; kick-eligible Pass 3 re-synthesis.
  'REVIEW_GATE_QUALITY_HARD_FAIL', // Governance alias; kick-matrix label for degraded long-form layer scenario. No runtime emit site found.
  'REVIEW_GATE_REJECTED', // Governance alias; runtime emits REVIEW_GATE_REJECTED_BY_AUTHOR on author rejection. No classifyError() path.
  'REVISE_ABC_NOT_DISTINCT', // A/B/C candidate set is duplicate/near-duplicate, empty-shape, or not evidence-grounded. Kick-eligible: regeneration against the certified opportunity may produce a distinct, grounded, non-empty set (1 retry).
  'REVISE_HANDOFF_RENDERER_OUTPUT_INVALID',
  'REVISION_LEDGER_EVIDENCE_MISSING', // governance alias: maps to bare LEDGER_EVIDENCE_MISSING already wired in REVISE_KICK_MATRIX; do not add a separate failures.ts bridge
  'RIGHTS_DECLARATION_MISSING',
  'RIGHTS_GATE_FAILED',
  'SCORE_BELOW_THRESHOLD',
  'SECTIONS_NOT_ALL_APPROVED',
  'SEED_FIT_GAP_BLOCKED',
  'SHORT_FORM_COPY_DEFECT', // Short-form author-facing prose has capitalization/duplicate-word defects; kick-eligible Pass 3 re-synthesis.
  'SHORT_FORM_INTERNAL_PROCESS_LEAK', // Pass 3 short-form output leaked internal pipeline stage labels; kick-eligible re-synthesis (S07_PASS3, 1 retry).
  'SHORT_FORM_LONGFORM_ARTIFACT_LEAK', // Pass 3 short-form output leaked long-form artifact terms (WAVE/Golden Spine/Phase 5); kick-eligible re-synthesis (S07_PASS3, 1 retry).
  'SHORT_FORM_MIDSENTENCE_TERMINATION', // Short-form diagnostic prose ended mid-sentence; kick-eligible Pass 3 re-synthesis.
  'SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM', // Pass 3 short-form output made whole-manuscript claims unsupportable from the excerpt; kick-eligible re-synthesis (S07_PASS3, 1 retry).
  'CRITERION_OPPORTUNITY_COVERAGE_INVALID', // Pass 3 recommendation cardinality/disposition contradiction; kick once to synthesis before terminal block.
  'STRUCTURED_AUDIT_FIELDS_MISSING',
  'TRUSTEDPATH_INELIGIBLE_VERDICT',
  'TRUSTEDPATH_LEDGER_WRITE_FAIL',
  'UNAUTHENTICATED', // Platform HTTP gate; enforced by middleware (HTTP 401) across all subsystems. Never reaches evaluation job processor or markFailed().
  'UNRESOLVED_PLACEHOLDER',
  'UNVERIFIED_INDUSTRY_USER',
  'VERIFICATION_STATE_UNAUDITED',
  'VIEWMODEL_BOUNDARY_CONTAMINATION', // CI/static structural gate; enforced by ViewModel boundary tests, not emitted at runtime.
  'WAVE_DERIVATION_EMPTY',
  'WORD_LIMIT_EXCEEDED',
  'WORKBENCH_ANCHOR_UNRESOLVABLE',
] as const;

const TERMINAL_BLOCK_FAILURE_CODES = [
  '400',
  '401',
  '403',
  '413',
  '429',
  '500',
  'ACCESS_REQUEST_NOT_FOUND',
  'AUTHOR_FACING_TEXT_INTEGRITY_FAILED',
  'ADMISSION_CANDIDATE_QUALITY_FAIL',
  'ADMISSION_VOICE_GATE_FAIL',
  'AUDIT_EVENT_MISSING',
  'CANDIDATE_DUPLICATES_ORIGINAL',
  'CANDIDATE_EMPTY',
  'CANONICAL_STATUS_VIOLATION',
  'COMPLETION_CERT_INVALID',
  'COMPLETION_PENDING_SYNC',
  'CROSSCHECK_HASH_MISMATCH',
  'DECISION_CUSTOM_EMPTY',
  'DECISION_MISSING_OPPORTUNITY',
  'DOWNLOAD_FORMAT_UNSUPPORTED',
  'DREAM_NO_CHUNKS',
  'DREAM_NO_EVAL_RESULT',
  'ELIGIBILITY_NOT_PROVEN',
  'ENTITY_CONTAMINATION_REJECTED',
  'EQUIVALENT_ASSESSMENT_UNVERIFIED',
  'EVALUATION_ARTIFACT_VALIDATION_FAILED',
  'EVALUATION_GATE_REJECTED',
  'FINAL_AUDIT_MISSING_DREAM',
  'FINAL_AUDIT_SCHEMA_INVALID',
  'GOLDEN_SPINE_EXECUTION_FAILED',
  'LEDGER_ASSEMBLY_FAILED',
  'LEDGER_CRITERION_MISSING',
  'LEDGER_EMPTY',
  'LISTING_NOT_ACTIVE',
  'MISSING_SECTIONS',
  'MISSING_TIER_DECISION',
  'NON_ADMIN_VERIFICATION_ATTEMPT',
  'NON_CANONICAL_ACCESS_DECISION',
  'NON_CANONICAL_TIER',
  'NO_PACKAGE_HISTORY',
  'PASS1_FAILED',
  'PASS2_FAILED',
  'PASS3_FAILED',
  'PHASE0_AUTHORITY_MISSING',
  'PHASE0_BASELINE_CHECKSUM_FAILED',
  'PHASE5_SCORE_DRIFT',
  'PIPELINE_INPUT_INVALID',
  'PLACEHOLDER_TEXT_DETECTED',
  'PRIVATE_LISTING_BLOCKED',
  'QG_CRITERIA_SCOPE_SHAPE_MISMATCH',
  'QG_CRITERIA_MISSING',
  'QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH',
  'QG_INDEPENDENCE_VIOLATION',
  'QG_PROPAGATION_INTEGRITY',
  'QG_SCORE_RANGE',
  'QUEUE_ASSEMBLY_FAILED',
  'QUEUE_EMPTY_AFTER_ADMISSION',
  'QUEUE_OVERCAP',
  'REC_INTEGRITY_NO_EVIDENCE',
  'REVIEW_GATE_QUALITY_TECHNICAL_BLOCK',
  'REVIEW_GATE_TIMEOUT',
  'REVISE_ABC_NOT_PROSE',
  'REVISE_ADMISSION_FAILED',
  'REVISE_EVIDENCE_MISSING',
  'REVISE_QUEUE_EMPTY',
  'REVISE_SEED_AUTHORITY_PROOF_MISSING',
  'REVISION_CANON_METADATA_FAILED',
  'REVISION_LEDGER_EMPTY',
  'SECTION_NOT_FOUND',
  'SEED_AUTHORITY_PROOF_MISSING',
  'TEMPLATE_COMPLETENESS_GATE_FAILED', // Generic structural/template defect; a code fix is required rather than model re-synthesis.
  'TRUSTEDPATH_ALREADY_DECIDED',
  'VIEWMODEL_SANITIZATION_INCOMPLETE',
  'WAVE_PLAN_FAILED',
  'WORKBENCH_MODE_CONTRACT_MISSING',
] as const;

function defineFailure(
  failureCode: string,
  mode: FailureRecoveryPolicyMode,
  retryLimit: number,
  escalation: FailureRecoveryPolicy['escalation'],
): FailureRecoveryDefinition {
  return {
    failureCode,
    recoveryPolicy: {
      mode,
      checkpointArtifact: mode === 'rollback_to_certified_checkpoint' ? 'unified_evaluation_document_v1' : null,
      diagnosticPacket: mode === 'rollback_to_certified_checkpoint' || mode === 'retry_then_terminal_block'
        ? 'stage_failure_delta_v1'
        : null,
      retryLimit,
      escalation,
      retainFailedAttemptSnapshot: true,
      mutationPolicy: 'no_in_place_mutation_of_certified_artifacts',
      failedArtifactAuthority: 'audit_evidence_only',
      authorExposure: mode === 'log_only',
    },
  };
}

function definitionsFor(
  codes: readonly string[],
  mode: FailureRecoveryPolicyMode,
  retryLimit: number,
  escalation: FailureRecoveryPolicy['escalation'],
): FailureRecoveryDefinition[] {
  return codes.map((code) => defineFailure(code, mode, retryLimit, escalation));
}

export const FAILURE_RECOVERY_DEFINITIONS: readonly FailureRecoveryDefinition[] = [
  ...definitionsFor(ROLLBACK_TO_CERTIFIED_CHECKPOINT_FAILURE_CODES, 'rollback_to_certified_checkpoint', 1, 'redo_target_from_kick_matrix'),
  ...definitionsFor(RETRY_THEN_TERMINAL_BLOCK_FAILURE_CODES, 'retry_then_terminal_block', 1, 'terminal_block_after_retry'),
  ...definitionsFor(TERMINAL_BLOCK_FAILURE_CODES, 'terminal_block', 0, 'terminal_block'),
  ...definitionsFor(LOG_ONLY_FAILURE_CODES, 'log_only', 0, 'passive_observability'),
];

const FAILURE_RECOVERY_DEFINITION_BY_CODE = new Map(
  FAILURE_RECOVERY_DEFINITIONS.map((definition) => [definition.failureCode, definition]),
);

export function getFailureRecoveryDefinition(failureCode: string): FailureRecoveryDefinition | undefined {
  return FAILURE_RECOVERY_DEFINITION_BY_CODE.get(failureCode);
}

export function getFailureRecoveryDefinitionsForCodes(failureCodes: readonly string[]): FailureRecoveryDefinition[] {
  return failureCodes.map((failureCode) => {
    const definition = getFailureRecoveryDefinition(failureCode);
    if (!definition) {
      throw new Error(`Missing failure recovery definition for ${failureCode}`);
    }
    return definition;
  });
}

export function getFailureRecoveryPolicy(input: {
  failureCode: string;
  hasKick: boolean;
}): FailureRecoveryPolicy {
  const definition = getFailureRecoveryDefinition(input.failureCode);
  if (!definition) {
    throw new Error(`Missing failure recovery definition for ${input.failureCode}`);
  }

  if (input.hasKick && definition.recoveryPolicy.mode !== 'rollback_to_certified_checkpoint') {
    throw new Error(`Kick-mapped failure ${input.failureCode} must declare rollback_to_certified_checkpoint recovery`);
  }

  return definition.recoveryPolicy;
}
