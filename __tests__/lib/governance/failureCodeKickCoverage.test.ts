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

type StageLike = {
  stageId: string;
  failureCodes: readonly string[];
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
};

type FailureCodeClassification =
  | 'release-blocking'
  | 'author-facing'
  | 'persistence'
  | 'certification/governance'
  | 'terminal/expected'
  | 'diagnostic-only';

type FailureCodeClassificationCounts = Record<FailureCodeClassification, number>;

const EMPTY_CLASSIFICATION_COUNTS: FailureCodeClassificationCounts = {
  'release-blocking': 0,
  'author-facing': 0,
  persistence: 0,
  'certification/governance': 0,
  'terminal/expected': 0,
  'diagnostic-only': 0,
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
  'DOWNLOAD_PARITY_FAILED',
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
  'PHASE5_MISSING_AUDIT',
  'PHASE5_SCORE_DRIFT',
  'PHASE5_UNCERTIFIED_OUTPUT',
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
  'VIEWMODEL_BOUNDARY_CONTAMINATION',
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
  'LEDGER_SYNC_DB_ERROR',
  'LEDGER_SYNC_DUPLICATE_LOCAL_ID',
  'QUEUE_ASSEMBLY_FAILED',
  'QUEUE_EMPTY_AFTER_ADMISSION',
  'QUEUE_OVERCAP',
  'TRUSTEDPATH_ALREADY_DECIDED',
  'TRUSTEDPATH_LEDGER_WRITE_FAIL',
  'TRUSTEDPATH_UNAUTHENTICATED',
  'WORKBENCH_DIAGNOSTIC_INCOMPLETE',
  'WORKBENCH_HYDRATION_FAILED',
  'WORKBENCH_MODE_CONTRACT_MISSING',
] as const;

const AGENT_READINESS_UNMAPPED_FAILURE_CODES = [
  'DB_WRITE_FAILURE',
  'GENERATION_TIMEOUT',
  'MISSING_SECTIONS',
  'NO_PACKAGE_HISTORY',
  'QUALITY_GATE_NOT_PASSED',
  'SECTION_NOT_FOUND',
] as const;

const STORYGATE_UNMAPPED_FAILURE_CODES = [
  'ACCESS_CONTROL_BYPASS',
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
  'RIGHTS_GATE_FAILED',
  'VERIFICATION_STATE_UNAUDITED',
] as const;

const FAMILY_AUDITS: readonly FamilyAudit[] = [
  {
    family: 'Evaluation',
    stages: PROCESS_REGISTRY,
    kicks: KICK_MATRIX,
    kickCodeField: 'failureCode',
    expectedUnmappedFailureCodes: EVALUATION_UNMAPPED_FAILURE_CODES,
    expectedClassificationCounts: {
      'release-blocking': 16,
      'author-facing': 20,
      persistence: 5,
      'certification/governance': 29,
      'terminal/expected': 18,
      'diagnostic-only': 34,
    },
  },
  {
    family: 'Revise',
    stages: REVISE_PROCESS_REGISTRY,
    kicks: REVISE_KICK_MATRIX,
    kickCodeField: 'kickCode',
    expectedUnmappedFailureCodes: REVISE_UNMAPPED_FAILURE_CODES,
    expectedClassificationCounts: {
      'release-blocking': 3,
      'author-facing': 0,
      persistence: 4,
      'certification/governance': 2,
      'terminal/expected': 10,
      'diagnostic-only': 18,
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
      'release-blocking': 1,
      'author-facing': 3,
      persistence: 3,
      'certification/governance': 1,
      'terminal/expected': 3,
      'diagnostic-only': 0,
    },
  },
  {
    family: 'Storygate',
    stages: STORYGATE_PROCESS_REGISTRY,
    kicks: STORYGATE_KICK_MATRIX,
    kickCodeField: 'kickCode',
    expectedUnmappedFailureCodes: STORYGATE_UNMAPPED_FAILURE_CODES,
    expectedClassificationCounts: {
      'release-blocking': 7,
      'author-facing': 9,
      persistence: 3,
      'certification/governance': 8,
      'terminal/expected': 4,
      'diagnostic-only': 1,
    },
  },
];

describe('failure-code → kick-matrix coverage audit', () => {
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
    expect(totalUnmapped).toBe(114);
  });

  test.each(FAMILY_AUDITS)('$family unmapped failure codes have severity/risk classification counts', (audit) => {
    const failures = stageFailureCodes(audit.stages);
    const kicks = new Set(kickCodes(audit.kicks, audit.kickCodeField));
    const unmapped = failures.filter((code) => !kicks.has(code));

    expect(classificationCounts(unmapped)).toEqual(audit.expectedClassificationCounts);
  });

  test('high-risk unmapped classifications remain visible before Phase 5B', () => {
    const totals = FAMILY_AUDITS.reduce<FailureCodeClassificationCounts>((acc, audit) => {
      for (const [classification, count] of Object.entries(audit.expectedClassificationCounts) as Array<[FailureCodeClassification, number]>) {
        acc[classification] += count;
      }
      return acc;
    }, { ...EMPTY_CLASSIFICATION_COUNTS });

    expect(totals['release-blocking']).toBe(27);
    expect(totals['author-facing']).toBe(32);
    expect(totals.persistence).toBe(15);
    expect(totals['certification/governance']).toBe(40);
  });
});
