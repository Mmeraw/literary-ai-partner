/**
 * Guard suite: SIPOC/FIPOC failure-code → kick-matrix coverage
 *
 * This test intentionally does NOT assert one-to-one coverage today. The live
 * registries contain stage-local/system failure codes that do not have a
 * dedicated kick-matrix row. The governance requirement is stricter than the
 * current implementation: every unmapped code must be explicit and classified,
 * so future additions cannot silently widen the gap before Phase 5B.
 */

import { KICK_MATRIX, PROCESS_REGISTRY } from '../../../lib/evaluation/fipocRegistry';
import { REVISE_KICK_MATRIX, REVISE_PROCESS_REGISTRY } from '../../../lib/revision/reviseRegistry';
import { AGENT_READINESS_KICK_MATRIX, AGENT_READINESS_PROCESS_REGISTRY } from '../../../lib/agent-readiness/agentReadinessRegistry';
import { STORYGATE_KICK_MATRIX, STORYGATE_PROCESS_REGISTRY } from '../../../lib/storygate/storygateRegistry';
import {
  FAILURE_RECOVERY_DEFINITIONS,
  getFailureRecoveryDefinition,
  getFailureRecoveryPolicy,
  type FailureRecoveryPolicyMode,
} from '../../../lib/governance/failureRecoveryPolicy';

type StageLike = {
  stageId: string;
  inputMetrics: readonly string[];
  outputMetrics: readonly string[];
  dirtyDataRules: readonly string[];
  failureCodes: readonly string[];
  failureDefinitions: readonly { failureCode: string }[];
};

type KickLike = Record<string, unknown>;

type FamilyAudit = {
  family: string;
  stages: readonly StageLike[];
  kicks: readonly KickLike[];
  kickCodeField: string;
  expectedUnmappedFailureCodes: readonly string[];
  expectedKickRowsWithoutStageFailureCode?: readonly string[];
  expectedClassificationCounts: FailureCodeClassificationCounts;
  expectedNonKickRecoveryPolicyCounts: FailureRecoveryPolicyCounts;
};

type FailureCodeClassification =
  | 'release-blocking'
  | 'author-facing'
  | 'persistence'
  | 'certification/governance'
  | 'terminal/expected'
  | 'diagnostic-only';

type FailureCodeClassificationCounts = Record<FailureCodeClassification, number>;
type FailureRecoveryPolicyCounts = Record<FailureRecoveryPolicyMode, number>;

const EMPTY_CLASSIFICATION_COUNTS: FailureCodeClassificationCounts = {
  'release-blocking': 0,
  'author-facing': 0,
  persistence: 0,
  'certification/governance': 0,
  'terminal/expected': 0,
  'diagnostic-only': 0,
};

const EMPTY_RECOVERY_POLICY_COUNTS: FailureRecoveryPolicyCounts = {
  rollback_to_certified_checkpoint: 0,
  retry_then_terminal_block: 0,
  terminal_block: 0,
  log_only: 0,
};

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function stageFailureCodes(stages: readonly StageLike[]): string[] {
  return uniqueSorted(stages.flatMap((stage) => [...stage.failureCodes]));
}

function kickCodes(kicks: readonly KickLike[], kickCodeField: string): string[] {
  return uniqueSorted(
    kicks
      .map((kick) => kick[kickCodeField])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  );
}

function classifyUnmappedFailureCode(code: string): FailureCodeClassification[] {
  const classifications = new Set<FailureCodeClassification>();

  if (/^(PHASE5|VIEWMODEL|DOWNLOAD_PARITY|EVALUATION_ARTIFACT|EVALUATION_GATE|FINAL_AUDIT|GOLDEN_SPINE|AUTHORITY|PHASE0|CANONICAL|ELIGIBILITY|RIGHTS_GATE|ACCESS_CONTROL|PRIVATE_LISTING|PACKAGE|COMPLETION_CERT|TRUSTEDPATH_LEDGER_WRITE|LEDGER_SYNC_DB|DB_WRITE|DB_|ACCESS_LOG_WRITE|REVOCATION|VERIFICATION_STATE)/.test(code)) {
    classifications.add('release-blocking');
  }
  if (/(AUTHOR|DOWNLOAD|HANDOFF|REC_|REVISE|AGENT|VIEWMODEL|STORYGATE|ACCESS|LISTING|SECTION|MISSING_SECTIONS|QUALITY_GATE|PLACEHOLDER|PRIVATE_LISTING|RIGHTS|ELIGIBILITY)/.test(code)) {
    classifications.add('author-facing');
  }
  if (/(DB|RPC|WRITE|PERSIST|SYNC|CLAIM|LEASE|REVOCATION|ACCESS_LOG|HISTORY|NOT_CREATED|NOT_FOUND)/.test(code)) {
    classifications.add('persistence');
  }
  if (/(CERT|CANON|AUTHORITY|AUDIT|GATE|GOVERNANCE|PHASE|QG_|DREAM|WAVE|GOLDEN|TEMPLATE|VIEWMODEL|ELIGIBILITY|VERIFICATION|RIGHTS_GATE|EQUIVALENT)/.test(code)) {
    classifications.add('certification/governance');
  }
  if (/^(400|401|403|413|429|500)$|TIMEOUT|EMPTY|NOT_FOUND|ALREADY|UNAUTHENTICATED|UNAVAILABLE|INVALID|MISSING_TIER|NON_CANONICAL|DECISION_CUSTOM_EMPTY|TERMINAL|PENDING|NO_CHUNKS|NO_EVAL_RESULT|NO_PACKAGE_HISTORY|SECTION_NOT_FOUND/.test(code)) {
    classifications.add('terminal/expected');
  }
  if (/(DIAGNOSTIC|LOW_COVERAGE|SCHEMA|SCORE_RANGE|DUPLICATE|GENERIC|QUALITY_TECHNICAL|CROSSCHECK|VOICE|CANDIDATE|WORKBENCH|QUEUE|PASS\d|SEED|DREAM|WAVE|REVIEW_GATE|QG_|REC_INTEGRITY|FIDELITY|INDEPENDENCE|CRITERION|PLACEHOLDER|SCAFFOLD|MODAL)/.test(code)) {
    classifications.add('diagnostic-only');
  }
  if (classifications.size === 0) classifications.add('diagnostic-only');

  return [...classifications].sort();
}

function classificationCounts(codes: readonly string[]): FailureCodeClassificationCounts {
  const counts = { ...EMPTY_CLASSIFICATION_COUNTS };
  for (const code of codes) {
    for (const classification of classifyUnmappedFailureCode(code)) {
      counts[classification] += 1;
    }
  }
  return counts;
}

function recoveryPolicyCounts(codes: readonly string[], hasKick: boolean): FailureRecoveryPolicyCounts {
  const counts = { ...EMPTY_RECOVERY_POLICY_COUNTS };
  for (const code of codes) {
    counts[getFailureRecoveryPolicy({ failureCode: code, hasKick }).mode] += 1;
  }
  return counts;
}

const EVALUATION_UNMAPPED_FAILURE_CODES = [
  '400',
  '401',
  '403',
  '413',
  '429',
  '500',
  'CANONICAL_STATUS_VIOLATION',
  'CLAIM_RPC_FAILED',
  'DB_WRITE_FAILED',
  'DOWNLOAD_FORMAT_UNSUPPORTED',
  'DOWNLOAD_RENDER_FAILED',
  'DREAM_NO_CHUNKS',
  'DREAM_NO_EVAL_RESULT',
  'DREAM_TIMEOUT',
  'ENTITY_CONTAMINATION_REJECTED',
  'EVALUATION_ARTIFACT_VALIDATION_FAILED',
  'EVALUATION_GATE_REJECTED',
  'FINAL_AUDIT_LOW_COVERAGE',
  'FINAL_AUDIT_MISSING_DREAM',
  'FINAL_AUDIT_SCHEMA_INVALID',
  'GOLDEN_SPINE_EXECUTION_FAILED',
  'HANDOFF_BROKEN_MODAL',
  'HANDOFF_INCOMPLETE_SENTENCE',
  'HANDOFF_MISSING_EVIDENCE_ANCHOR',
  'HANDOFF_SCAFFOLD_RESIDUE',
  'LEASE_OVERLAP_DETECTED',
  'PASS1_FAILED',
  'PASS1_TIMEOUT',
  'PASS2_FAILED',
  'PASS2_INDEPENDENCE_REWRITE_FAILED',
  'PASS2_TIMEOUT',
  'PASS3_FAILED',
  'PASS3_TIMEOUT',
  'PHASE0_AUTHORITY_MISSING',
  'PHASE0_BASELINE_CHECKSUM_FAILED',
  'PHASE5_SCORE_DRIFT',
  'PIPELINE_INPUT_INVALID',
  'QG_CRITERIA_MISSING',
  'QG_DUPLICATE_REC',
  'QG_FIDELITY_SCORE_CONFIDENCE_MISMATCH',
  'QG_GENERIC_REC',
  'QG_INDEPENDENCE_VIOLATION',
  'QG_SCORE_RANGE',
  'REC_INTEGRITY_GENERIC',
  'REC_INTEGRITY_NO_EVIDENCE',
  'REVIEW_GATE_QUALITY_TECHNICAL_BLOCK',
  'REVIEW_GATE_TIMEOUT',
  'REVISE_ABC_NOT_PROSE',
  'REVISE_ADMISSION_FAILED',
  'REVISE_AUTHOR_DECISION_NOT_PERSISTED',
  'REVISE_EVIDENCE_MISSING',
  'REVISE_QUEUE_EMPTY',
  'REVISE_SEED_AUTHORITY_PROOF_MISSING',
  'REVISE_SEED_GENERATION_FAILED',
  'REVISION_CANON_METADATA_FAILED',
  'REVISION_LEDGER_ASSEMBLY_FAILED',
  'REVISION_LEDGER_EMPTY',
  'SEED_AUTHORITY_PROOF_MISSING',
  'SEED_GENERATION_FAILED',
  'VIEWMODEL_SANITIZATION_INCOMPLETE',
  'WAVE_EXECUTION_TIMEOUT',
  'WAVE_PLAN_FAILED',
] as const;

const REVISE_UNMAPPED_FAILURE_CODES = [
  'ADMISSION_CANDIDATE_QUALITY_FAIL',
  'ADMISSION_VOICE_GATE_FAIL',
  'CANDIDATE_DUPLICATES_ORIGINAL',
  'CANDIDATE_EMPTY',
  'CANDIDATE_GENERATION_FAILED',
  'COMPLETION_CERT_INVALID',
  'COMPLETION_PENDING_SYNC',
  'CROSSCHECK_HASH_MISMATCH',
  'CROSSCHECK_TIMEOUT',
  'CROSSCHECK_UNAVAILABLE',
  'DECISION_CUSTOM_EMPTY',
  'DECISION_MISSING_OPPORTUNITY',
  'LEDGER_ASSEMBLY_FAILED',
  'LEDGER_CRITERION_MISSING',
  'LEDGER_EMPTY',
  'LEDGER_SYNC_DUPLICATE_LOCAL_ID',
  'QUEUE_ASSEMBLY_FAILED',
  'QUEUE_EMPTY_AFTER_ADMISSION',
  'QUEUE_OVERCAP',
  'TRUSTEDPATH_ALREADY_DECIDED',
  'TRUSTEDPATH_UNAUTHENTICATED',
  'WORKBENCH_DIAGNOSTIC_INCOMPLETE',
  'WORKBENCH_HYDRATION_FAILED',
  'WORKBENCH_MODE_CONTRACT_MISSING',
] as const;

const AGENT_READINESS_UNMAPPED_FAILURE_CODES = [
  'GENERATION_TIMEOUT',
  'MISSING_SECTIONS',
  'NO_PACKAGE_HISTORY',
  'SECTION_NOT_FOUND',
] as const;

const STORYGATE_UNMAPPED_FAILURE_CODES = [
  'ACCESS_LOG_WRITE_FAILED',
  'ACCESS_REQUEST_NOT_FOUND',
  'AUDIT_EVENT_MISSING',
  'ELIGIBILITY_NOT_PROVEN',
  'EQUIVALENT_ASSESSMENT_UNVERIFIED',
  'LISTING_NOT_ACTIVE',
  'MISSING_TIER_DECISION',
  'NON_ADMIN_VERIFICATION_ATTEMPT',
  'NON_CANONICAL_ACCESS_DECISION',
  'NON_CANONICAL_TIER',
  'PLACEHOLDER_TEXT_DETECTED',
  'PRIVATE_LISTING_BLOCKED',
  'REVOCATION_NOT_PERSISTED',
] as const;

const FAMILY_AUDITS: readonly FamilyAudit[] = [
  {
    family: 'Evaluation',
    stages: PROCESS_REGISTRY,
    kicks: KICK_MATRIX,
    kickCodeField: 'failureCode',
    expectedUnmappedFailureCodes: EVALUATION_UNMAPPED_FAILURE_CODES,
    expectedClassificationCounts: {
      'release-blocking': 12,
      'author-facing': 18,
      persistence: 5,
      'certification/governance': 26,
      'terminal/expected': 18,
      'diagnostic-only': 34,
    },
    expectedNonKickRecoveryPolicyCounts: {
      rollback_to_certified_checkpoint: 0,
      retry_then_terminal_block: 18,
      terminal_block: 40,
      log_only: 4,
    },
  },
  {
    family: 'Revise',
    stages: REVISE_PROCESS_REGISTRY,
    kicks: REVISE_KICK_MATRIX,
    kickCodeField: 'kickCode',
    expectedUnmappedFailureCodes: REVISE_UNMAPPED_FAILURE_CODES,
    expectedClassificationCounts: {
      'release-blocking': 1,
      'author-facing': 0,
      persistence: 2,
      'certification/governance': 2,
      'terminal/expected': 10,
      'diagnostic-only': 18,
    },
    expectedNonKickRecoveryPolicyCounts: {
      rollback_to_certified_checkpoint: 0,
      retry_then_terminal_block: 6,
      terminal_block: 17,
      log_only: 1,
    },
  },
  {
    family: 'Agent Readiness',
    stages: AGENT_READINESS_PROCESS_REGISTRY,
    kicks: AGENT_READINESS_KICK_MATRIX,
    kickCodeField: 'kickCode',
    expectedUnmappedFailureCodes: AGENT_READINESS_UNMAPPED_FAILURE_CODES,
    expectedKickRowsWithoutStageFailureCode: ['CREATOR_APPROVAL_REQUIRED'],
    expectedClassificationCounts: {
      'release-blocking': 0,
      'author-facing': 2,
      persistence: 2,
      'certification/governance': 0,
      'terminal/expected': 3,
      'diagnostic-only': 0,
    },
    expectedNonKickRecoveryPolicyCounts: {
      rollback_to_certified_checkpoint: 0,
      retry_then_terminal_block: 1,
      terminal_block: 3,
      log_only: 0,
    },
  },
  {
    family: 'Storygate',
    stages: STORYGATE_PROCESS_REGISTRY,
    kicks: STORYGATE_KICK_MATRIX,
    kickCodeField: 'kickCode',
    expectedUnmappedFailureCodes: STORYGATE_UNMAPPED_FAILURE_CODES,
    expectedClassificationCounts: {
      'release-blocking': 4,
      'author-facing': 7,
      persistence: 3,
      'certification/governance': 6,
      'terminal/expected': 4,
      'diagnostic-only': 1,
    },
    expectedNonKickRecoveryPolicyCounts: {
      rollback_to_certified_checkpoint: 0,
      retry_then_terminal_block: 2,
      terminal_block: 11,
      log_only: 0,
    },
  },
];

describe('failure-code → kick-matrix coverage audit', () => {
  test('failure recovery definitions are unique and declaration-based', () => {
    const definitionCodes = FAILURE_RECOVERY_DEFINITIONS.map((definition) => definition.failureCode);
    expect(definitionCodes).toHaveLength(new Set(definitionCodes).size);
    expect(definitionCodes.length).toBe(189);
  });

  test.each(FAMILY_AUDITS)('$family stages declare input metrics, output metrics, dirty-data rules, and failure codes', (audit) => {
    for (const stage of audit.stages) {
      expect(stage.inputMetrics.length).toBeGreaterThan(0);
      expect(stage.outputMetrics.length).toBeGreaterThan(0);
      expect(stage.dirtyDataRules.length).toBeGreaterThan(0);
      expect(stage.failureCodes.length).toBeGreaterThan(0);
      expect(stage.failureDefinitions.length).toBe(stage.failureCodes.length);
    }
  });

  test.each(FAMILY_AUDITS)('$family stage contracts own explicit failure recovery definitions', (audit) => {
    for (const stage of audit.stages) {
      expect(stage.failureDefinitions.map((definition) => definition.failureCode)).toEqual(stage.failureCodes);
    }
  });

  test.each(FAMILY_AUDITS)('$family stage-owned failure definitions are registered with central governance validator', (audit) => {
    for (const stage of audit.stages) {
      for (const stageDefinition of stage.failureDefinitions) {
        const definition = getFailureRecoveryDefinition(stageDefinition.failureCode);
        expect(definition).toBeDefined();
        expect(definition).toEqual(stageDefinition);
      }
    }
  });

  test.each(FAMILY_AUDITS)('$family unmapped failure codes are explicit and audit-locked', (audit) => {
    const failures = stageFailureCodes(audit.stages);
    const kicks = new Set(kickCodes(audit.kicks, audit.kickCodeField));
    const unmapped = failures.filter((code) => !kicks.has(code));

    expect(unmapped).toEqual([...audit.expectedUnmappedFailureCodes].sort());
  });

  test.each(FAMILY_AUDITS)('$family kick rows are backed by stage failure codes or explicit cross-gate exceptions', (audit) => {
    const failures = new Set(stageFailureCodes(audit.stages));
    const orphanKicks = kickCodes(audit.kicks, audit.kickCodeField).filter((code) => !failures.has(code));

    expect(orphanKicks).toEqual([...(audit.expectedKickRowsWithoutStageFailureCode ?? [])].sort());
  });

  test('current audit proves the caveat: registries are metric-bearing but not one-to-one kick complete', () => {
    const totalUnmapped = FAMILY_AUDITS.reduce((total, audit) => total + audit.expectedUnmappedFailureCodes.length, 0);

    expect(totalUnmapped).toBeGreaterThan(0);
    expect(totalUnmapped).toBe(103);
  });

  test.each(FAMILY_AUDITS)('$family unmapped failure codes have severity/risk classification counts', (audit) => {
    const failures = stageFailureCodes(audit.stages);
    const kicks = new Set(kickCodes(audit.kicks, audit.kickCodeField));
    const unmapped = failures.filter((code) => !kicks.has(code));

    expect(classificationCounts(unmapped)).toEqual(audit.expectedClassificationCounts);
  });

  test.each(FAMILY_AUDITS)('$family kick-mapped failures use rollback-to-certified-checkpoint recovery', (audit) => {
    const failures = new Set(stageFailureCodes(audit.stages));
    const mappedKickCodes = kickCodes(audit.kicks, audit.kickCodeField).filter((code) => failures.has(code));

    expect(recoveryPolicyCounts(mappedKickCodes, true)).toEqual({
      ...EMPTY_RECOVERY_POLICY_COUNTS,
      rollback_to_certified_checkpoint: mappedKickCodes.length,
    });

    for (const code of mappedKickCodes) {
      const policy = getFailureRecoveryPolicy({ failureCode: code, hasKick: true });
      expect(policy).toEqual(expect.objectContaining({
        mode: 'rollback_to_certified_checkpoint',
        checkpointArtifact: 'unified_evaluation_document_v1',
        diagnosticPacket: 'stage_failure_delta_v1',
        retainFailedAttemptSnapshot: true,
        mutationPolicy: 'no_in_place_mutation_of_certified_artifacts',
        failedArtifactAuthority: 'audit_evidence_only',
        authorExposure: false,
      }));
    }
  });

  test.each(FAMILY_AUDITS)('$family non-kick failures have explicit recovery/terminal/log policy counts', (audit) => {
    const failures = stageFailureCodes(audit.stages);
    const kicks = new Set(kickCodes(audit.kicks, audit.kickCodeField));
    const unmapped = failures.filter((code) => !kicks.has(code));

    expect(recoveryPolicyCounts(unmapped, false)).toEqual(audit.expectedNonKickRecoveryPolicyCounts);
  });

  test.each(FAMILY_AUDITS)('$family non-kick failure artifacts remain evidence, not replacement authority', (audit) => {
    for (const code of audit.expectedUnmappedFailureCodes) {
      const policy = getFailureRecoveryPolicy({ failureCode: code, hasKick: false });
      expect(policy.retainFailedAttemptSnapshot).toBe(true);
      expect(policy.failedArtifactAuthority).toBe('audit_evidence_only');
      expect(policy.mutationPolicy).toBe('no_in_place_mutation_of_certified_artifacts');
      if (policy.mode === 'retry_then_terminal_block') {
        expect(policy.diagnosticPacket).toBe('stage_failure_delta_v1');
      }
      if (policy.mode === 'terminal_block') {
        expect(policy.authorExposure).toBe(false);
      }
    }
  });

  test('high-risk unmapped classifications remain visible before Phase 5B', () => {
    const totals = FAMILY_AUDITS.reduce<FailureCodeClassificationCounts>((acc, audit) => {
      for (const [classification, count] of Object.entries(audit.expectedClassificationCounts) as Array<[FailureCodeClassification, number]>) {
        acc[classification] += count;
      }
      return acc;
    }, { ...EMPTY_CLASSIFICATION_COUNTS });

    expect(totals['release-blocking']).toBe(17);
    expect(totals['author-facing']).toBe(27);
    expect(totals.persistence).toBe(12);
    expect(totals['certification/governance']).toBe(34);
  });
});

describe('governance must not over-block runtime flow', () => {
  // All kick codes across every family — used in multiple assertions below.
  const allKickCodes = new Set<string>([
    ...KICK_MATRIX.map((k) => k.failureCode).filter((c): c is string => typeof c === 'string' && c.length > 0),
    ...REVISE_KICK_MATRIX.map((k) => (k as Record<string, unknown>)['kickCode']).filter((c): c is string => typeof c === 'string' && c.length > 0),
    ...AGENT_READINESS_KICK_MATRIX.map((k) => (k as Record<string, unknown>)['kickCode']).filter((c): c is string => typeof c === 'string' && c.length > 0),
    ...STORYGATE_KICK_MATRIX.map((k) => (k as Record<string, unknown>)['kickCode']).filter((c): c is string => typeof c === 'string' && c.length > 0),
  ]);

  test('log_only failure count is locked — any addition requires explicit review', () => {
    const logOnlyDefinitions = FAILURE_RECOVERY_DEFINITIONS.filter(
      (definition) => definition.recoveryPolicy.mode === 'log_only',
    );
    expect(logOnlyDefinitions).toHaveLength(5);
  });

  test('log_only failures never block finalization: passive_observability escalation, zero retries', () => {
    for (const definition of FAILURE_RECOVERY_DEFINITIONS) {
      if (definition.recoveryPolicy.mode === 'log_only') {
        expect(definition.recoveryPolicy.escalation).toBe('passive_observability');
        expect(definition.recoveryPolicy.retryLimit).toBe(0);
        expect(definition.recoveryPolicy.authorExposure).toBe(true);
        expect(definition.recoveryPolicy.checkpointArtifact).toBeNull();
      }
    }
  });

  test('log_only failures are never kick-mapped — a kick would contradict passive observability', () => {
    const logOnlyCodes = new Set(
      FAILURE_RECOVERY_DEFINITIONS
        .filter((definition) => definition.recoveryPolicy.mode === 'log_only')
        .map((definition) => definition.failureCode),
    );
    for (const kickCode of allKickCodes) {
      expect(logOnlyCodes.has(kickCode)).toBe(false);
    }
  });

  test('terminal_block failures have zero retries and stop cleanly — no redo', () => {
    for (const definition of FAILURE_RECOVERY_DEFINITIONS) {
      if (definition.recoveryPolicy.mode === 'terminal_block') {
        expect(definition.recoveryPolicy.retryLimit).toBe(0);
        expect(definition.recoveryPolicy.escalation).toBe('terminal_block');
        expect(definition.recoveryPolicy.checkpointArtifact).toBeNull();
      }
    }
  });

  test('retry_then_terminal_block failures retry exactly once then stop — no redo loop', () => {
    for (const definition of FAILURE_RECOVERY_DEFINITIONS) {
      if (definition.recoveryPolicy.mode === 'retry_then_terminal_block') {
        expect(definition.recoveryPolicy.retryLimit).toBe(1);
        expect(definition.recoveryPolicy.escalation).toBe('terminal_block_after_retry');
        expect(definition.recoveryPolicy.checkpointArtifact).toBeNull();
      }
    }
  });

  test('only rollback_to_certified_checkpoint failures are kick-mapped — no terminal or log failure triggers redo', () => {
    const nonRollbackCodes = new Set(
      FAILURE_RECOVERY_DEFINITIONS
        .filter((definition) => definition.recoveryPolicy.mode !== 'rollback_to_certified_checkpoint')
        .map((definition) => definition.failureCode),
    );
    for (const kickCode of allKickCodes) {
      expect(nonRollbackCodes.has(kickCode)).toBe(false);
    }
  });
});
