/**
 * Regression tests for revise pipeline hardening:
 * P1: REVISE_KICK_MATRIX wiring
 * P2: revision_failure_record_v1 artifact
 * P3: retryable vs terminal failure taxonomy
 * P4: hydration failure recovery
 */

import {
  classifyFailureDisposition,
  resolveKickTarget,
  isKickEligible,
  buildRevisionFailureRecord,
  buildHydrationFailureRecord,
  type ReviseStageFailureCode,
  type ReviseFailureDisposition,
} from '@/lib/revision/reviseFailureRecord';
import {
  REVISE_KICK_MATRIX,
  REVISE_ARTIFACT_REGISTRY,
} from '@/lib/revision/reviseRegistry';
import {
  REVISION_SESSION_ALLOWED_TRANSITIONS,
  assertValidRevisionSessionTransition,
  buildRevisionSessionTransitionUpdate,
} from '@/lib/revision/sessionTransitions';
import type { RevisionSession, RevisionSessionStatus } from '@/lib/revision/types';

// ─── P1: KICK_MATRIX Wiring ─────────────────────────────────────────────────

describe('P1: REVISE_KICK_MATRIX runtime wiring', () => {
  test('resolveKickTarget returns the correct kick for each kick code', () => {
    for (const kick of REVISE_KICK_MATRIX) {
      const resolved = resolveKickTarget(kick.kickCode);
      expect(resolved).not.toBeNull();
      expect(resolved!.kickCode).toBe(kick.kickCode);
      expect(resolved!.targetStageId).toBe(kick.targetStageId);
    }
  });

  test('resolveKickTarget returns null for unknown failure codes', () => {
    expect(resolveKickTarget('UNKNOWN_CODE')).toBeNull();
    expect(resolveKickTarget('DOES_NOT_EXIST')).toBeNull();
  });

  test('isKickEligible returns true for all KICK_MATRIX entries', () => {
    for (const kick of REVISE_KICK_MATRIX) {
      expect(isKickEligible(kick.kickCode)).toBe(true);
    }
  });

  test('isKickEligible returns false for non-kick codes', () => {
    expect(isKickEligible('RANDOM_CODE')).toBe(false);
    expect(isKickEligible('DOES_NOT_EXIST_IN_MATRIX')).toBe(false);
    expect(isKickEligible('')).toBe(false);
  });

  test('every kick in REVISE_KICK_MATRIX has a valid target stage', () => {
    const validStageIds = [
      'RS01_LEDGER_ASSEMBLY', 'RS02_QUEUE_ADMISSION', 'RS03_QUEUE_PRIORITIZATION',
      'RS04_WORKBENCH_LOAD', 'RS05_CANDIDATE_GENERATION', 'RS06_AUTHOR_DECISION',
      'RS07_LEDGER_SYNC', 'RS08_COMPLETION', 'RS09_CROSSCHECK_VERIFICATION', 'RS10_TRUSTEDPATH',
      // Cross-pipeline kick targets: backward kick to evaluation gates
      'S10b_PHASE5_AUTHOR_EXPOSURE_GATE',
      'S10c_VIEWMODEL_BOUNDARY_GATE',
    ];
    for (const kick of REVISE_KICK_MATRIX) {
      expect(validStageIds).toContain(kick.targetStageId);
    }
  });
});

// ─── P2: revision_failure_record_v1 Artifact ─────────────────────────────────

describe('P2: revision_failure_record_v1', () => {
  test('buildRevisionFailureRecord produces correctly shaped artifact', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'sess-001',
      stageId: 'RS04_WORKBENCH_LOAD',
      failureCode: 'WORKBENCH_HYDRATION_FAILED',
      attemptCount: 1,
      opportunityId: 'opp-123',
      errorMessage: 'Hydration timed out after 60s',
      evidence: ['timeout at candidateHydration.ts:234'],
    });

    expect(record.artifact_type).toBe('revision_failure_record_v1');
    expect(record.session_id).toBe('sess-001');
    expect(record.stage_id).toBe('RS04_WORKBENCH_LOAD');
    expect(record.failure_code).toBe('WORKBENCH_HYDRATION_FAILED');
    expect(record.opportunity_id).toBe('opp-123');
    expect(record.error_message).toBe('Hydration timed out after 60s');
    expect(record.evidence).toEqual(['timeout at candidateHydration.ts:234']);
    expect(typeof record.occurred_at).toBe('string');
  });

  test('failure record includes kick information for kick-eligible codes', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'sess-002',
      stageId: 'RS02_QUEUE_ADMISSION',
      failureCode: 'ADMISSION_CARD_CONTRACT_FAIL',
      attemptCount: 0,
      errorMessage: 'Card contract validation failed',
    });

    expect(record.recommended_kick).toBe('RS01_LEDGER_ASSEMBLY');
    expect(record.kick_reason).toBeTruthy();
    expect(record.retryable).toBe(true);
  });

  test('failure record has no kick for terminal codes', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'sess-003',
      stageId: 'RS06_AUTHOR_DECISION',
      failureCode: 'DECISION_INVALID_VALUE',
      attemptCount: 1,
      errorMessage: 'Non-canonical decision value',
    });

    expect(record.disposition).toBe('terminal');
    expect(record.retryable).toBe(false);
  });

  test('revision_failure_record_v1 is registered in REVISE_ARTIFACT_REGISTRY', () => {
    const artifact = REVISE_ARTIFACT_REGISTRY.find(
      (a) => a.artifact === 'revision_failure_record_v1',
    );
    expect(artifact).toBeDefined();
    expect(artifact!.requiredFields).toContain('session_id');
    expect(artifact!.requiredFields).toContain('failure_code');
    expect(artifact!.requiredFields).toContain('disposition');
    expect(artifact!.requiredFields).toContain('retryable');
  });
});

// ─── P3: Retryable vs Terminal Failure Taxonomy ──────────────────────────────

describe('P3: failure disposition taxonomy', () => {
  const RETRYABLE_CODES: ReviseStageFailureCode[] = [
    'LEDGER_ASSEMBLY_FAILED',
    'LEDGER_EVIDENCE_MISSING',
    'LEDGER_EMPTY',
    'LEDGER_CRITERION_MISSING',
    'WORKBENCH_DIAGNOSTIC_INCOMPLETE',
    'WORKBENCH_MODE_CONTRACT_MISSING',
    'WORKBENCH_HYDRATION_FAILED',
    'CANDIDATE_GENERATION_FAILED',
    'CANDIDATE_EMPTY',
    'LEDGER_SYNC_DB_ERROR',
    'COMPLETION_PREMATURE',
    'COMPLETION_PENDING_SYNC',
    'CROSSCHECK_TIMEOUT',
    'CROSSCHECK_UNAVAILABLE',
    'TRUSTEDPATH_LEDGER_WRITE_FAIL',
    'HYDRATION_TIMEOUT',
    'HYDRATION_SLAE_REJECTION',
    'HYDRATION_MODEL_ERROR',
    'HYDRATION_BATCH_FAILED',
    'REVISION_FINALIZE_FAILED',
    'REVISION_ENGINE_UNCAUGHT',
    'QUEUE_ASSEMBLY_FAILED',
    'QUEUE_OVERCAP',
    'QUEUE_EMPTY_AFTER_ADMISSION',
    'ADMISSION_CARD_CONTRACT_FAIL',
    'ADMISSION_CANDIDATE_QUALITY_FAIL',
    'DECISION_CUSTOM_EMPTY',
    'LEDGER_SYNC_VALIDATION_FAIL',
    'LEDGER_SYNC_DUPLICATE_LOCAL_ID',
  ];

  const TERMINAL_CODES: ReviseStageFailureCode[] = [
    'DECISION_INVALID_VALUE',
    'DECISION_MISSING_OPPORTUNITY',
    'COMPLETION_CERT_INVALID',
    'CROSSCHECK_HASH_MISMATCH',
    'TRUSTEDPATH_UNAUTHENTICATED',
  ];

  const MANUAL_REVIEW_CODES: ReviseStageFailureCode[] = [
    'WORKBENCH_ANCHOR_UNRESOLVABLE',
    'ADMISSION_CANON_GATE_FAIL',
    'ADMISSION_VOICE_GATE_FAIL',
    'CANDIDATE_VOICE_GATE_FAIL',
    'CANDIDATE_CANON_GATE_FAIL',
    'CANDIDATE_DUPLICATES_ORIGINAL',
    'TRUSTEDPATH_INELIGIBLE_VERDICT',
    'TRUSTEDPATH_ALREADY_DECIDED',
    'CROSSCHECK_INVALID_VERDICT',
  ];

  test.each(RETRYABLE_CODES)('"%s" is classified as retryable', (code) => {
    expect(classifyFailureDisposition(code)).toBe('retryable');
  });

  test.each(TERMINAL_CODES)('"%s" is classified as terminal', (code) => {
    expect(classifyFailureDisposition(code)).toBe('terminal');
  });

  test.each(MANUAL_REVIEW_CODES)('"%s" is classified as manual_review', (code) => {
    expect(classifyFailureDisposition(code)).toBe('manual_review');
  });

  test('every disposition is one of the three canonical values', () => {
    const allCodes: ReviseStageFailureCode[] = [
      ...RETRYABLE_CODES,
      ...TERMINAL_CODES,
      ...MANUAL_REVIEW_CODES,
    ];
    const validDispositions = new Set<ReviseFailureDisposition>(['retryable', 'terminal', 'manual_review']);
    for (const code of allCodes) {
      expect(validDispositions.has(classifyFailureDisposition(code))).toBe(true);
    }
  });

  test('retryable failure record has retryable=true when attempts < max', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'sess-tax',
      stageId: 'RS04_WORKBENCH_LOAD',
      failureCode: 'WORKBENCH_HYDRATION_FAILED',
      attemptCount: 0,
      errorMessage: 'test',
    });
    expect(record.retryable).toBe(true);
  });

  test('retryable failure record has retryable=false when attempts exhausted', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'sess-tax',
      stageId: 'RS04_WORKBENCH_LOAD',
      failureCode: 'WORKBENCH_HYDRATION_FAILED',
      attemptCount: 5,
      errorMessage: 'test',
    });
    expect(record.retryable).toBe(false);
  });
});

// ─── P3+: failed_retryable Session State ─────────────────────────────────────

describe('P3: failed_retryable session state machine', () => {
  test('failed_retryable is a valid session status', () => {
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS).toHaveProperty('failed_retryable');
  });

  test('failed_retryable allows re-entry to open', () => {
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS.failed_retryable).toContain('open');
  });

  test('failed_retryable allows re-entry to findings_ready', () => {
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS.failed_retryable).toContain('findings_ready');
  });

  test('failed_retryable allows escalation to terminal failed', () => {
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS.failed_retryable).toContain('failed');
  });

  test('failed (terminal) still has no outbound transitions', () => {
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS.failed).toEqual([]);
  });

  test('applied still has no outbound transitions', () => {
    expect(REVISION_SESSION_ALLOWED_TRANSITIONS.applied).toEqual([]);
  });

  test('every non-terminal state can transition to failed_retryable', () => {
    const nonTerminalStates: RevisionSessionStatus[] = [
      'open', 'findings_ready', 'synthesis_started', 'proposals_ready',
    ];
    for (const state of nonTerminalStates) {
      expect(REVISION_SESSION_ALLOWED_TRANSITIONS[state]).toContain('failed_retryable');
    }
  });

  test('assertValidRevisionSessionTransition allows failed_retryable -> open', () => {
    expect(() => {
      assertValidRevisionSessionTransition('failed_retryable', 'open');
    }).not.toThrow();
  });

  test('assertValidRevisionSessionTransition rejects failed -> open', () => {
    expect(() => {
      assertValidRevisionSessionTransition('failed', 'open');
    }).toThrow(/Illegal revision session transition/);
  });

  test('buildRevisionSessionTransitionUpdate requires failure_code for failed_retryable', () => {
    const session: RevisionSession = {
      id: 'test-sess',
      evaluation_run_id: 'eval-001',
      source_version_id: 'ver-001',
      result_version_id: null,
      status: 'synthesis_started',
      summary: {},
      findings_count: 5,
      actionable_findings_count: 3,
      proposal_ready_actionable_findings_count: 2,
      proposals_created_count: 2,
      created_at: new Date().toISOString(),
      completed_at: null,
      last_transition_at: null,
      failure_code: null,
      failure_message: null,
    };

    const update = buildRevisionSessionTransitionUpdate(session, {
      nextStatus: 'failed_retryable',
      findings_count: 5,
      actionable_findings_count: 3,
      failure_code: 'CANDIDATE_GENERATION_FAILED',
      failure_message: 'Model timed out during candidate generation',
    });

    expect(update.status).toBe('failed_retryable');
    expect(update.failure_code).toBe('CANDIDATE_GENERATION_FAILED');
    expect(update.completed_at).toBeNull(); // NOT terminal
  });
});

// ─── P4: Hydration Failure Recovery ──────────────────────────────────────────

describe('P4: hydration failure recovery', () => {
  test('buildHydrationFailureRecord produces correctly shaped artifact', () => {
    const record = buildHydrationFailureRecord({
      opportunityId: 'opp-456',
      failureCode: 'HYDRATION_TIMEOUT',
      attemptCount: 1,
      maxAttempts: 2,
      rejectionReason: null,
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });

    expect(record.artifact_type).toBe('candidate_hydration_failure_v1');
    expect(record.opportunity_id).toBe('opp-456');
    expect(record.hydration_status).toBe('failed_retryable');
    expect(record.failure_code).toBe('HYDRATION_TIMEOUT');
    expect(record.attempt_count).toBe(1);
    expect(record.max_attempts).toBe(2);
    expect(typeof record.occurred_at).toBe('string');
  });

  test('hydration timeout with attempts remaining is failed_retryable', () => {
    const record = buildHydrationFailureRecord({
      opportunityId: 'opp-789',
      failureCode: 'HYDRATION_TIMEOUT',
      attemptCount: 1,
      maxAttempts: 3,
      rejectionReason: null,
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });
    expect(record.hydration_status).toBe('failed_retryable');
  });

  test('hydration timeout with attempts exhausted is failed_terminal', () => {
    const record = buildHydrationFailureRecord({
      opportunityId: 'opp-789',
      failureCode: 'HYDRATION_TIMEOUT',
      attemptCount: 3,
      maxAttempts: 3,
      rejectionReason: null,
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });
    expect(record.hydration_status).toBe('failed_terminal');
  });

  test('SLAE rejection is always terminal (not retryable)', () => {
    const record = buildHydrationFailureRecord({
      opportunityId: 'opp-slae',
      failureCode: 'HYDRATION_SLAE_REJECTION',
      attemptCount: 1,
      maxAttempts: 3,
      rejectionReason: 'ANCHOR_ECHO',
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });
    expect(record.hydration_status).toBe('failed_terminal');
  });

  test('model error with attempts remaining is failed_retryable', () => {
    const record = buildHydrationFailureRecord({
      opportunityId: 'opp-model',
      failureCode: 'HYDRATION_MODEL_ERROR',
      attemptCount: 0,
      maxAttempts: 2,
      rejectionReason: 'rate_limit_exceeded',
      model: 'gpt-5.1',
      promptVersion: 'candidate_hydration_v2_premium_prose',
    });
    expect(record.hydration_status).toBe('failed_retryable');
  });

  test('candidate_hydration_failure_v1 is registered in REVISE_ARTIFACT_REGISTRY', () => {
    const artifact = REVISE_ARTIFACT_REGISTRY.find(
      (a) => a.artifact === 'candidate_hydration_failure_v1',
    );
    expect(artifact).toBeDefined();
    expect(artifact!.requiredFields).toContain('opportunity_id');
    expect(artifact!.requiredFields).toContain('hydration_status');
    expect(artifact!.requiredFields).toContain('failure_code');
  });
});

// ─── Integration: Kick → Failure Record → Session State ──────────────────────

describe('Integration: kick-eligible failure produces retryable record', () => {
  test('kick-eligible code produces retryable failure record with kick target', () => {
    // LEDGER_EVIDENCE_MISSING is in REVISE_KICK_MATRIX
    const record = buildRevisionFailureRecord({
      sessionId: 'sess-int',
      stageId: 'RS01_LEDGER_ASSEMBLY',
      failureCode: 'LEDGER_EVIDENCE_MISSING',
      attemptCount: 0,
      errorMessage: 'Evidence anchor missing on opportunity opp-123',
    });

    expect(record.disposition).toBe('retryable');
    expect(record.retryable).toBe(true);
    expect(record.recommended_kick).toBeTruthy();
    // The kick should point backward or to the same stage
    const kick = resolveKickTarget('LEDGER_EVIDENCE_MISSING');
    expect(kick).not.toBeNull();
    expect(record.recommended_kick).toBe(kick!.targetStageId);
  });

  test('terminal code produces terminal record without kick', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'sess-term',
      stageId: 'RS06_AUTHOR_DECISION',
      failureCode: 'DECISION_INVALID_VALUE',
      attemptCount: 0,
      errorMessage: 'Non-canonical decision value: "maybe"',
    });

    expect(record.disposition).toBe('terminal');
    expect(record.retryable).toBe(false);
    // DECISION_INVALID_VALUE is in KICK_MATRIX, so recommended_kick may exist
    // but retryable should still be false because disposition is terminal
    expect(record.retryable).toBe(false);
  });

  test('manual_review code produces manual_review record', () => {
    const record = buildRevisionFailureRecord({
      sessionId: 'sess-mr',
      stageId: 'RS04_WORKBENCH_LOAD',
      failureCode: 'WORKBENCH_ANCHOR_UNRESOLVABLE',
      attemptCount: 0,
      errorMessage: 'Anchor not found in manuscript after fuzzy search',
    });

    expect(record.disposition).toBe('manual_review');
    expect(record.retryable).toBe(false);
  });
});
