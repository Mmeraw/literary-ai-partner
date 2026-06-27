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
  retainFailedAttemptSnapshot: boolean;
  mutationPolicy: 'no_in_place_mutation_of_certified_artifacts';
  failedArtifactAuthority: 'audit_evidence_only';
  authorExposure: boolean;
};

const TRANSIENT_RETRY_PATTERN = /(TIMEOUT|RPC|DB|WRITE|CLAIM|LEASE|GENERATION_FAILED|SYNTHESIS_FAILED|RENDER_FAILED|HYDRATION_FAILED|UNAVAILABLE|NOT_PERSISTED|NOT_CREATED|SYNC)/;

const LOG_ONLY_FAILURE_CODES = new Set<string>([
  'FINAL_AUDIT_LOW_COVERAGE',
  'REC_INTEGRITY_GENERIC',
  'QG_GENERIC_REC',
  'QG_DUPLICATE_REC',
  'WORKBENCH_DIAGNOSTIC_INCOMPLETE',
]);

function basePolicy(mode: FailureRecoveryPolicyMode, authorExposure: boolean): FailureRecoveryPolicy {
  return {
    mode,
    checkpointArtifact: mode === 'rollback_to_certified_checkpoint' ? 'unified_evaluation_document_v1' : null,
    diagnosticPacket: mode === 'rollback_to_certified_checkpoint' || mode === 'retry_then_terminal_block'
      ? 'stage_failure_delta_v1'
      : null,
    retainFailedAttemptSnapshot: true,
    mutationPolicy: 'no_in_place_mutation_of_certified_artifacts',
    failedArtifactAuthority: 'audit_evidence_only',
    authorExposure,
  };
}

export function getFailureRecoveryPolicy(input: {
  failureCode: string;
  hasKick: boolean;
}): FailureRecoveryPolicy {
  if (input.hasKick) {
    return basePolicy('rollback_to_certified_checkpoint', false);
  }

  if (LOG_ONLY_FAILURE_CODES.has(input.failureCode)) {
    return basePolicy('log_only', true);
  }

  if (TRANSIENT_RETRY_PATTERN.test(input.failureCode)) {
    return basePolicy('retry_then_terminal_block', false);
  }

  return basePolicy('terminal_block', false);
}
