import { describe, it, expect } from '@jest/globals';
import {
  HELD_REASON_SOURCE_REGISTRY,
  getHeldReasonInfo,
  getRecoveryContractForReason,
  type HeldReasonProducer,
  type RecoveryExecutionAction,
  type RecoveryValidationStep,
  type HeldReasonRecoveryContract,
  type RecoveryAttempt,
  type RecoveryAttemptSnapshot,
  type RecoveryAuditEvent,
  type RecoverySeriesKey,
  revisionOpportunityVersionFor,
  candidateSetVersionFor,
  sourceHashFor,
} from '@/lib/revision/heldRecoveryInventory';

const ORIGIN_PRODUCERS: HeldReasonProducer[] = [
  'grounding',
  'preflight',
  'hydration',
  'res_blocker',
  'copy_paste_admission',
  'strategy_admission',
  'integrity',
  'candidate_quality',
  'voice_gate',
  'canon_gate',
];

const DECISION_PROJECTION_PRODUCERS: HeldReasonProducer[] = ['base_decision', 'final_decision'];

const ANNOTATION_SOURCES = ['grounding_note', 'executability'] as const;

function contractFor(code: string, source: any): HeldReasonRecoveryContract | undefined {
  return getRecoveryContractForReason({ code, source });
}

describe('Held recovery contract invariants', () => {
  it('uses a stable producer enum plus module path, never a file path as canonical identity', () => {
    for (const entry of HELD_REASON_SOURCE_REGISTRY) {
      expect(entry.producer).not.toContain('/');
      expect(typeof entry.producerModule).toBe('string');
      expect(entry.producerModule.length).toBeGreaterThan(0);
    }
  });

  it('assigns origin authority role to origin producers and decision_projection to routing producers', () => {
    for (const entry of HELD_REASON_SOURCE_REGISTRY) {
      if ((ANNOTATION_SOURCES as readonly string[]).includes(entry.source)) {
        expect(entry.authorityRole).toBe('annotation');
      } else if (ORIGIN_PRODUCERS.includes(entry.producer as HeldReasonProducer)) {
        expect(entry.authorityRole).toBe('origin');
      } else if (DECISION_PROJECTION_PRODUCERS.includes(entry.producer as HeldReasonProducer)) {
        expect(entry.authorityRole).toBe('decision_projection');
      }
    }
  });

  it('never returns a contract for annotation sources', () => {
    for (const source of ANNOTATION_SOURCES) {
      expect(contractFor('context_missing', source)).toBeUndefined();
    }
  });

  it('maps origin source + code to an actionable recovery contract', () => {
    const contract = contractFor('truncated_anchor', 'preflight');
    expect(contract).toBeDefined();
    expect(contract!.producer).toBe('preflight');
    expect(contract!.authorityRole).toBe('origin');
    expect(contract!.recoveryAction).toBe('resolve_anchor');
    expect(contract!.executionMode).toBe('deterministic');
    expect(contract!.validationStep).toBe('rerun_admission');
    expect(contract!.validationPrecondition).toBe('execution_action_changed_inputs');
  });

  it('maps final_decision + passage_too_long to a non-recoverative validation contract', () => {
    const contract = contractFor('passage_too_long', 'final_decision');
    expect(contract).toBeDefined();
    expect(contract!.producer).toBe('final_decision');
    expect(contract!.authorityRole).toBe('decision_projection');
    expect(contract!.recoveryAction).toBe('none');
    expect(contract!.validationStep).toBe('rerun_admission');
    expect(contract!.validationPrecondition).toBe('new_canonical_version');
    expect(contract!.executionMode).toBe('none');
  });

  it('does not let decision projection summary codes select an independent repair action', () => {
    const copyPaste = contractFor('copy_paste_admission_failed', 'base_decision');
    expect(copyPaste).toBeDefined();
    expect(copyPaste!.recoveryAction).toBe('none');
    expect(copyPaste!.validationStep).toBeNull();

    const strategy = contractFor('strategy_admission_failed', 'base_decision');
    expect(strategy).toBeDefined();
    expect(strategy!.recoveryAction).toBe('none');
    expect(strategy!.validationStep).toBeNull();
  });

  it('decomposes decision projection codes into upstream origin contracts when available', () => {
    // final_decision is a projection, but the code context_missing has an origin
    // planning source (preflight). buildRecoveryPlan decomposes it; here we verify
    // the per-occurrence source contract is a decision projection.
    const finalContract = contractFor('context_missing', 'final_decision');
    expect(finalContract).toBeDefined();
    expect(finalContract!.authorityRole).toBe('decision_projection');

    const originContract = contractFor('context_missing', 'preflight');
    expect(originContract).toBeDefined();
    expect(originContract!.authorityRole).toBe('origin');
    expect(originContract!.recoveryAction).toBe('retrieve_context');
  });

  it('fails closed on unknown reason codes', () => {
    const contract = contractFor('totally_unknown_reason_xyz', 'preflight');
    expect(contract).toBeDefined();
    expect(contract!.recoveryAction).toBe('none');
    expect(contract!.executionMode).toBe('none');
    expect(contract!.validationStep).toBeNull();
    expect(contract!.requiredInputs).toEqual([]);
  });

  it('does not include rerun_admission in RecoveryExecutionAction', () => {
    const actions: RecoveryExecutionAction[] = [
      'resolve_anchor',
      'retrieve_context',
      'repair_diagnosis',
      'create_versioned_candidate_set',
      'none',
    ];
    expect(actions).not.toContain('rerun_admission' as any);
  });

  it('keeps validation separate from execution actions', () => {
    const steps: RecoveryValidationStep[] = ['rerun_admission', 'reclassify'];
    expect(steps).toContain('rerun_admission');
    const executionActions: RecoveryExecutionAction[] = [
      'resolve_anchor',
      'retrieve_context',
      'repair_diagnosis',
      'create_versioned_candidate_set',
      'none',
    ];
    expect(executionActions).not.toContain('rerun_admission' as any);
  });

  it('records structured audit events instead of free-form strings', () => {
    const event: RecoveryAuditEvent = {
      at: new Date().toISOString(),
      event: 'action_started',
      action: 'resolve_anchor',
      producer: 'preflight',
      code: 'truncated_anchor',
      opportunityVersionBefore: 'v1',
      candidateSetVersionBefore: 'cs1',
      recoveryInputFingerprintBefore: 'fp1',
      details: { anchor: 'abc' },
    };
    expect(event).toBeDefined();
    expect(event.event).toBe('action_started');
  });

  it('snapshot uses explicit opportunity/candidate/fingerprint versions, not generic sourceHash', () => {
    const snapshot: RecoveryAttemptSnapshot = {
      idempotencyKey: 'k',
      manuscriptVersionSha: 'sha',
      opportunityId: 'op1',
      trigger: 'request_reanalysis',
      canonicalReasons: [],
      originalBaseReasons: [],
      originalFinalReasons: [],
      promotionTransitionReason: null,
      opportunityVersionBefore: 'v1',
      candidateSetVersionBefore: 'cs1',
      recoveryInputFingerprintBefore: 'fp1',
    };
    expect(snapshot).not.toHaveProperty('sourceHashBefore');
  });

  it('retry identity separates series key from action input fingerprint', () => {
    const seriesKey: RecoverySeriesKey = {
      opportunityVersion: 'v1',
      candidateSetVersion: 'cs1',
      producer: 'preflight',
      code: 'truncated_anchor',
      recoveryAction: 'resolve_anchor',
    };
    const attempt: RecoveryAttempt = {
      seriesKey,
      recoveryInputFingerprint: 'fingerprint-of-action-inputs',
      attemptNumber: 1,
      maxAttempts: 3,
      status: 'recovery_attempt_pending',
      outcome: 'pending',
      terminalCardType: null,
      terminalTrustedPathStatus: null,
      snapshot: {} as any,
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(attempt.seriesKey.opportunityVersion).toBe('v1');
    expect(attempt.recoveryInputFingerprint).toBe('fingerprint-of-action-inputs');
  });
});

describe('Held recovery versioning helpers', () => {
  it('revisionOpportunityVersionFor is deterministic and differs with inputs', () => {
    const a = revisionOpportunityVersionFor('op1', 'sha1');
    const b = revisionOpportunityVersionFor('op1', 'sha1');
    const c = revisionOpportunityVersionFor('op1', 'sha2');
    const d = revisionOpportunityVersionFor('op2', 'sha1');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(c).not.toBe(a);
    expect(d).not.toBe(a);
  });

  it('revisionOpportunityVersionFor reuses the canonical ledger source hash helper', () => {
    const v = revisionOpportunityVersionFor('op1', 'sha1');
    expect(v).toBe(sourceHashFor({ opportunityId: 'op1', ledgerSourceHash: 'sha1' }));
  });

  it('candidateSetVersionFor returns null for incomplete sets', () => {
    expect(candidateSetVersionFor({ a: 'one', b: '', c: 'three' })).toBeNull();
    expect(candidateSetVersionFor({ a: 'one', b: 'two', c: '   ' })).toBeNull();
  });

  it('candidateSetVersionFor is stable for complete sets and changes with text', () => {
    const v1 = candidateSetVersionFor({ a: 'Alpha', b: 'Beta', c: 'Gamma' });
    const v2 = candidateSetVersionFor({ a: 'Alpha', b: 'Beta', c: 'Gamma' });
    const v3 = candidateSetVersionFor({ a: 'Alpha 2', b: 'Beta', c: 'Gamma' });
    expect(v1).toBe(v2);
    expect(v1).not.toBe(v3);
    expect(v1).toHaveLength(64);
  });

  it('candidateSetVersionFor includes options in the identity', () => {
    const v1 = candidateSetVersionFor({
      a: 'Alpha',
      b: 'Beta',
      c: 'Gamma',
      options: { a: { tone: 'dark' } },
    });
    const v2 = candidateSetVersionFor({
      a: 'Alpha',
      b: 'Beta',
      c: 'Gamma',
      options: { a: { tone: 'light' } },
    });
    const v3 = candidateSetVersionFor({ a: 'Alpha', b: 'Beta', c: 'Gamma' });
    expect(v1).not.toBe(v2);
    expect(v1).not.toBe(v3);
  });
});

describe('Held recovery contract required inputs', () => {
  it('anchor action requires source text, coordinates, and evidence anchor', () => {
    const contract = contractFor('truncated_anchor', 'preflight')!;
    const keys = contract.requiredInputs.map((i) => i.key);
    expect(keys).toContain('source_text');
    expect(keys).toContain('manuscript_coordinates');
    expect(keys).toContain('evidence_anchor');
    for (const input of contract.requiredInputs) {
      expect(input.source).toBeDefined();
      expect(typeof input.required).toBe('boolean');
      expect(input.validation).toBeDefined();
    }
  });

  it('create_versioned_candidate_set makes existing A/B/C optional', () => {
    const contract = contractFor('candidate_quality_failed', 'candidate_quality')!;
    expect(contract.recoveryAction).toBe('create_versioned_candidate_set');
    const existing = contract.requiredInputs.find((i) => i.key === 'existing_candidates_a_b_c');
    expect(existing).toBeDefined();
    expect(existing!.required).toBe(false);
    expect(existing!.validation).toBe('complete_candidate_set');
  });

  it('diagnosis action requires complete diagnostic object', () => {
    const contract = contractFor('diagnosis_unsupported', 'strategy_admission')!;
    expect(contract.recoveryAction).toBe('repair_diagnosis');
    const keys = contract.requiredInputs.map((i) => i.key);
    expect(keys).toContain('symptom');
    expect(keys).toContain('cause');
    expect(keys).toContain('fix_direction');
    expect(keys).toContain('reader_effect');
  });
});

describe('Held reason info keeps policy authority separate from execution contract', () => {
  it(' HeldReasonInfo still governs recoverability, terminal outcomes, and author actions', () => {
    const info = getHeldReasonInfo('truncated_anchor');
    expect(info.recoverable).toBe(true);
    expect(info.automaticRecoveryAllowed).toBe(true);
    expect(info.allowedTerminalOutcomes).toContain('copy_paste_rewrite');
    expect(info.allowedAuthorActions.length).toBeGreaterThan(0);
  });

  it('getRecoveryContractForReason returns a contract whose action matches the repair family', () => {
    const anchorContract = contractFor('truncated_anchor', 'preflight')!;
    expect(anchorContract.recoveryAction).toBe('resolve_anchor');

    const contextContract = contractFor('context_missing', 'preflight')!;
    expect(contextContract.recoveryAction).toBe('retrieve_context');

    const diagnosisContract = contractFor('diagnosis_unsupported', 'strategy_admission')!;
    expect(diagnosisContract.recoveryAction).toBe('repair_diagnosis');

    const candidatesContract = contractFor('candidate_quality_failed', 'candidate_quality')!;
    expect(candidatesContract.recoveryAction).toBe('create_versioned_candidate_set');
  });
});
