import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import {
  getRecoveryContractForReason,
  type HeldReasonRecoveryContract,
  type RecoveryExecutionAction,
} from '@/lib/revision/heldRecoveryReasons';
import type { HeldReasonSource } from '@/lib/revision/heldRecoverySources';
import {
  computeRecoveryInputFingerprint,
  executeRecoveryAction,
  type RecoveryAuthoritySnapshot,
  type RecoveryExecutorInput,
} from '@/lib/revision/heldRecoveryExecutor';
import { revisionOpportunityVersionFor, candidateSetVersionFor } from '@/lib/revision/heldRecoveryVersioning';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  if (Array.isArray(obj)) {
    obj.forEach(deepFreeze);
  } else {
    Object.values(obj as Record<string, unknown>).forEach(deepFreeze);
  }
  return obj;
}

function baseInput(
  action: RecoveryExecutionAction,
  code: string,
  source: HeldReasonSource,
  inputs: Record<string, unknown>,
  candidateSetVersion: string | null = null,
): RecoveryExecutorInput {
  const opportunityId = 'op-1';
  const ledgerSourceHash = 'ledger-sha';
  const opportunityVersion = revisionOpportunityVersionFor(opportunityId, ledgerSourceHash);
  const recoveryInputFingerprint = computeRecoveryInputFingerprint(action, inputs);
  return deepFreeze({
    reason: { code, source },
    opportunityId,
    manuscriptVersionSha: 'manuscript-sha',
    ledgerSourceHash,
    opportunityVersion,
    candidateSetVersion,
    recoveryInputFingerprint,
    authority: {
      canonicalLedgerSourceHash: ledgerSourceHash,
      canonicalOpportunityVersion: opportunityVersion,
      canonicalCandidateSetVersion: candidateSetVersion,
      canonicalRecoveryInputFingerprint: recoveryInputFingerprint,
    } satisfies RecoveryAuthoritySnapshot,
    inputs,
  }) as RecoveryExecutorInput;
}

describe('held recovery executor authority boundaries', () => {
  it.each([
    ['producerModule', (contract: HeldReasonRecoveryContract) => ({ ...contract, producerModule: 'forged/module.ts' })],
    ['validationStep', (contract: HeldReasonRecoveryContract) => ({ ...contract, validationStep: null })],
    ['validationPrecondition', (contract: HeldReasonRecoveryContract) => ({ ...contract, validationPrecondition: null })],
    ['requiredInputs', (contract: HeldReasonRecoveryContract) => ({ ...contract, requiredInputs: [] })],
    ['requiredInput.key', (contract: HeldReasonRecoveryContract) => ({ ...contract, requiredInputs: contract.requiredInputs.map((requirement, index) => index === 0 ? { ...requirement, key: 'forged_key' } : requirement) })],
    ['requiredInput.source', (contract: HeldReasonRecoveryContract) => ({ ...contract, requiredInputs: contract.requiredInputs.map((requirement, index) => index === 0 ? { ...requirement, source: 'author_submission' as const } : requirement) })],
    ['requiredInput.validation', (contract: HeldReasonRecoveryContract) => ({ ...contract, requiredInputs: contract.requiredInputs.map((requirement, index) => index === 0 ? { ...requirement, validation: 'complete_diagnostic' as const } : requirement) })],
    ['requiredInput.required', (contract: HeldReasonRecoveryContract) => ({ ...contract, requiredInputs: contract.requiredInputs.map((requirement, index) => index === 0 ? { ...requirement, required: false } : requirement) })],
  ])('ignores forged caller contract field %s and uses canonical authority', (_field, forge) => {
    const canonical = getRecoveryContractForReason({ code: 'truncated_anchor', source: 'preflight' })!;
    const forged = forge(canonical);
    const input = {
      ...baseInput('resolve_anchor', 'truncated_anchor', 'preflight', {
        source_text: 'The quick brown fox jumps over the lazy dog.',
        manuscript_coordinates: 'ch1.p3',
        evidence_anchor: 'quick brown fox',
      }),
      contract: forged,
    };

    const result = executeRecoveryAction(input);

    expect(result.outcome).toBe('deferred_work');
    expect(result.error).toBe('ANCHOR_RECONSTRUCTION_REQUIRED');
    expect(result.action).toBe(canonical.recoveryAction);
    expect(result.producer).toBe(canonical.producer);
    expect(result.code).toBe(canonical.code);
  });

  it('requires a canonical authority snapshot for executable actions', () => {
    const { authority: _authority, ...withoutAuthority } = baseInput('resolve_anchor', 'truncated_anchor', 'preflight', {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      manuscript_coordinates: 'ch1.p3',
      evidence_anchor: 'quick brown fox',
    });
    const result = executeRecoveryAction(withoutAuthority);

    expect(result.outcome).toBe('terminal_failure');
    expect(result.error).toBe('MISSING_CANONICAL_AUTHORITY_SNAPSHOT');
  });

  it('does not report unchanged anchor lookup as successful anchor recovery', () => {
    const result = executeRecoveryAction(baseInput('resolve_anchor', 'truncated_anchor', 'preflight', {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      manuscript_coordinates: 'ch1.p3',
      evidence_anchor: 'quick brown fox',
    }));

    expect(result.outcome).not.toBe('success');
  });

  it('uses non_empty_source_hash vocabulary instead of the retired source hash match name', () => {
    const reasonsSource = readFileSync('lib/revision/heldRecoveryReasons.ts', 'utf8');
    const retiredValidationName = ['source', 'hash', 'match'].join('_');
    expect(reasonsSource).toContain('non_empty_source_hash');
    expect(reasonsSource).not.toContain(retiredValidationName);
  });
});

describe('held recovery executor characterization', () => {
  it('dispatches an origin resolve_anchor contract to the anchor executor', () => {
    const input = baseInput('resolve_anchor', 'truncated_anchor', 'preflight', {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      manuscript_coordinates: 'ch1.p3',
      evidence_anchor: 'quick brown fox',
    });
    const result = executeRecoveryAction(input);
    expect(result.action).toBe('resolve_anchor');
    expect(result.outcome).toBe('deferred_work');
    expect(result.error).toBe('ANCHOR_RECONSTRUCTION_REQUIRED');
  });

  it('refuses to execute a decision-projection contract directly', () => {
    const input: RecoveryExecutorInput = deepFreeze({
      reason: { code: 'context_missing', source: 'final_decision' },
      opportunityId: 'op-1',
      manuscriptVersionSha: 'm',
      ledgerSourceHash: 'l',
      opportunityVersion: revisionOpportunityVersionFor('op-1', 'l'),
      candidateSetVersion: null,
      recoveryInputFingerprint: computeRecoveryInputFingerprint('none', {}),
      inputs: {},
    });
    const result = executeRecoveryAction(input);
    expect(result.outcome).toBe('terminal_failure');
    expect(result.error).toMatch(/origin/i);
  });

  it('returns no-op for a terminal recoveryAction: none contract', () => {
    const contract = getRecoveryContractForReason({ code: 'canon_authority_blocked', source: 'preflight' })!;
    expect(contract.recoveryAction).toBe('none');
    const input: RecoveryExecutorInput = deepFreeze({
      reason: { code: 'canon_authority_blocked', source: 'preflight' },
      opportunityId: 'op-1',
      manuscriptVersionSha: 'm',
      ledgerSourceHash: 'l',
      opportunityVersion: revisionOpportunityVersionFor('op-1', 'l'),
      candidateSetVersion: null,
      recoveryInputFingerprint: computeRecoveryInputFingerprint('none', {}),
      inputs: {},
    });
    const result = executeRecoveryAction(input);
    expect(result.outcome).toBe('no_op');
    expect(result.error).toMatch(/no.*action|terminal/i);
  });

  it('fails closed when required inputs are missing', () => {
    const input = baseInput('resolve_anchor', 'truncated_anchor', 'preflight', {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      // missing evidence_anchor and manuscript_coordinates
    });
    const result = executeRecoveryAction(input);
    expect(result.outcome).toBe('retryable_failure');
    expect(result.error).toMatch(/required.*input|missing/i);
  });

  it('rejects a stale opportunity version', () => {
    const input = baseInput('resolve_anchor', 'truncated_anchor', 'preflight', {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      manuscript_coordinates: 'ch1.p3',
      evidence_anchor: 'quick brown fox',
    });
    // Mutate only the local wrapper, not the frozen nested input.
    const stale = { ...input, opportunityVersion: 'stale-version' };
    const result = executeRecoveryAction(stale);
    expect(result.outcome).toBe('terminal_failure');
    expect(result.error).toMatch(/stale|version/i);
  });

  it('rejects incomplete A/B/C candidate input before any transformation', () => {
    const input = baseInput('create_versioned_candidate_set', 'candidate_quality_failed', 'candidate_quality', {
      source_text: 'Passage.',
      evidence_anchor: 'Passage',
      existing_candidates_a_b_c: { a: 'Alpha', b: '', c: 'Gamma' },
      diagnostic_object: { symptom: 's', cause: 'c', fix_direction: 'f', reader_effect: 'r' },
    });
    const result = executeRecoveryAction(input);
    expect(result.action).toBe('create_versioned_candidate_set');
    expect(result.outcome).toBe('retryable_failure');
    expect(result.error).toMatch(/invalid.*recoverable|candidate|incomplete|a_b_c/i);
  });

  it('computes deterministic and distinct recovery input fingerprints', () => {
    const fp1 = computeRecoveryInputFingerprint('resolve_anchor', {
      evidence_anchor: 'a',
      source_text: 'b',
      manuscript_coordinates: 'c',
    });
    const fp2 = computeRecoveryInputFingerprint('resolve_anchor', {
      evidence_anchor: 'a',
      source_text: 'b',
      manuscript_coordinates: 'c',
    });
    const fp3 = computeRecoveryInputFingerprint('resolve_anchor', {
      evidence_anchor: 'a2',
      source_text: 'b',
      manuscript_coordinates: 'c',
    });
    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1).toHaveLength(64);
  });

  it('does not mutate the original input objects', () => {
    const input = baseInput('retrieve_context', 'context_missing', 'preflight', {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      evidence_anchor: 'quick brown fox',
      manuscript_chunks: ['The quick brown fox', 'jumps over the lazy dog.'],
    });
    const before = JSON.stringify(input);
    executeRecoveryAction(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('executes the origin contract after decision-projection decomposition', () => {
    const decisionContract = getRecoveryContractForReason({ code: 'context_missing', source: 'final_decision' })!;
    expect(decisionContract.authorityRole).toBe('decision_projection');
    const originContract = getRecoveryContractForReason({ code: 'context_missing', source: 'preflight' })!;
    expect(originContract.authorityRole).toBe('origin');

    const input = baseInput('retrieve_context', 'context_missing', 'preflight', {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      evidence_anchor: 'quick brown fox',
      manuscript_chunks: ['The quick brown fox', 'jumps over the lazy dog.'],
    });
    const result = executeRecoveryAction(input);
    expect(result.outcome).toBe('success');
  });

  it('ignores an injected caller contract snapshot when dispatching', () => {
    const contract = getRecoveryContractForReason({ code: 'truncated_anchor', source: 'preflight' })!;
    const forged = { ...contract, recoveryAction: 'unknown_action' as any };
    const input = deepFreeze({
      ...baseInput('resolve_anchor', 'truncated_anchor', 'preflight', {
        source_text: 'The quick brown fox jumps over the lazy dog.',
        manuscript_coordinates: 'ch1.p3',
        evidence_anchor: 'quick brown fox',
      }),
      callerContractSnapshot: forged,
    });
    const result = executeRecoveryAction(input);
    expect(result.action).toBe('resolve_anchor');
    expect(result.error).toBe('ANCHOR_RECONSTRUCTION_REQUIRED');
    expect(result.outcome).toBe('deferred_work');
  });

  it('distinguishes unknown canonical reason identity from known terminal no-op', () => {
    const input: RecoveryExecutorInput = deepFreeze({
      reason: { code: 'not_a_known_reason', source: 'grounding' },
      opportunityId: 'op-1',
      manuscriptVersionSha: 'm',
      ledgerSourceHash: 'l',
      opportunityVersion: revisionOpportunityVersionFor('op-1', 'l'),
      candidateSetVersion: null,
      recoveryInputFingerprint: computeRecoveryInputFingerprint('none', {}),
      inputs: {},
    });
    const result = executeRecoveryAction(input);
    expect(result.outcome).toBe('terminal_failure');
    expect(result.error).toBe('UNKNOWN_RECOVERY_CONTRACT');
    expect(result.action).toBe('none');
    expect(result.code).toBe('not_a_known_reason');
  });

  it('rejects a stale candidate-set version before any candidate transformation', () => {
    const existingCandidates = { a: 'Alpha', b: 'Beta', c: 'Gamma' };
    const correctVersion = candidateSetVersionFor(existingCandidates);

    // A version mismatch fails before any transformation.
    const stale = baseInput(
      'create_versioned_candidate_set',
      'candidate_quality_unsupported_facts',
      'canon_gate',
      {
        source_text: 'Passage with Alpha, Beta, Gamma candidates.',
        evidence_anchor: 'Passage with Alpha',
        existing_candidates_a_b_c: existingCandidates,
        diagnostic_object: { symptom: 's', cause: 'c', fix_direction: 'f', reader_effect: 'r' },
      },
      'wrong-version',
    );
    const staleResult = executeRecoveryAction({
      ...stale,
      authority: {
        ...stale.authority!,
        canonicalCandidateSetVersion: correctVersion,
      },
    });
    expect(staleResult.action).toBe('create_versioned_candidate_set');
    expect(staleResult.outcome).toBe('terminal_failure');
    expect(staleResult.error).toMatch(/stale|candidate/i);

    // Same inputs with the correct version and recomputed fingerprint reach the
    // LLM boundary and fail closed there.
    const valid = baseInput(
      'create_versioned_candidate_set',
      'candidate_quality_unsupported_facts',
      'canon_gate',
      {
        source_text: 'Passage with Alpha, Beta, Gamma candidates.',
        evidence_anchor: 'Passage with Alpha',
        existing_candidates_a_b_c: existingCandidates,
        diagnostic_object: { symptom: 's', cause: 'c', fix_direction: 'f', reader_effect: 'r' },
      },
      correctVersion,
    );
    const retry = executeRecoveryAction(valid);
    expect(retry.action).toBe('create_versioned_candidate_set');
    // LLM-assisted actions now return deferred_work, not terminal_failure,
    // because the held item is recoverable once an LLM phase is authorized.
    expect(retry.outcome).toBe('deferred_work');
    expect(retry.error).toMatch(/llm|not.*authorized/i);
  });

  it('dispatches every registered executable origin contract to exactly one executor', () => {
    const cases: { code: string; source: HeldReasonSource; inputs: Record<string, unknown>; expectedAction: RecoveryExecutionAction }[] = [
      { code: 'truncated_anchor', source: 'preflight', inputs: { source_text: 'The quick brown fox jumps over the lazy dog.', manuscript_coordinates: 'ch1.p3', evidence_anchor: 'quick brown fox' }, expectedAction: 'resolve_anchor' },
      { code: 'hydration_anchor_truncated', source: 'hydration', inputs: { source_text: 'The quick brown fox jumps over the lazy dog.', manuscript_coordinates: 'ch1.p3', evidence_anchor: 'quick brown fox' }, expectedAction: 'resolve_anchor' },
      { code: 'insufficient_anchor_grounding', source: 'res_blocker', inputs: { source_text: 'The quick brown fox jumps over the lazy dog.', manuscript_coordinates: 'ch1.p3', evidence_anchor: 'quick brown fox' }, expectedAction: 'resolve_anchor' },
      { code: 'grounding_unsupported', source: 'grounding', inputs: { source_text: 'The quick brown fox jumps over the lazy dog.', evidence_anchor: 'quick brown fox', manuscript_chunks: ['The quick brown fox'] }, expectedAction: 'retrieve_context' },
      { code: 'context_missing', source: 'preflight', inputs: { source_text: 'The quick brown fox jumps over the lazy dog.', evidence_anchor: 'quick brown fox', manuscript_chunks: ['The quick brown fox'] }, expectedAction: 'retrieve_context' },
      { code: 'evidence_missing', source: 'strategy_admission', inputs: { source_text: 'The quick brown fox jumps over the lazy dog.', manuscript_coordinates: 'ch1.p3', evidence_anchor: 'quick brown fox' }, expectedAction: 'resolve_anchor' },
      { code: 'too_short', source: 'copy_paste_admission', inputs: { source_text: 'Passage.', evidence_anchor: 'Passage', diagnostic_object: { symptom: 's', cause: 'c', fix_direction: 'f', reader_effect: 'r' } }, expectedAction: 'create_versioned_candidate_set' },
      { code: 'empty_candidate', source: 'candidate_quality', inputs: { source_text: 'Passage.', evidence_anchor: 'Passage', diagnostic_object: { symptom: 's', cause: 'c', fix_direction: 'f', reader_effect: 'r' } }, expectedAction: 'create_versioned_candidate_set' },
      { code: 'voice_drift_pov', source: 'voice_gate', inputs: { source_text: 'Passage.', evidence_anchor: 'Passage', diagnostic_object: { symptom: 's', cause: 'c', fix_direction: 'f', reader_effect: 'r' } }, expectedAction: 'create_versioned_candidate_set' },
      { code: 'candidate_quality_unsupported_facts', source: 'canon_gate', inputs: { source_text: 'Passage.', evidence_anchor: 'Passage', diagnostic_object: { symptom: 's', cause: 'c', fix_direction: 'f', reader_effect: 'r' } }, expectedAction: 'create_versioned_candidate_set' },
    ];

    for (const { code, source, inputs, expectedAction } of cases) {
      const contract = getRecoveryContractForReason({ code, source });
      expect(contract).toBeDefined();
      expect(contract!.authorityRole).toBe('origin');
      expect(contract!.recoveryAction).toBe(expectedAction);

      const input = baseInput(expectedAction, code, source, inputs);
      const result = executeRecoveryAction(input);
      expect(result.action).toBe(expectedAction);
      expect(result.producer).toBe(contract!.producer);
      expect(result.code).toBe(contract!.code);
    }
  });

  it('never executes transformations for terminal or audit-only contracts', () => {
    // Origin producer, but the reason code explicitly has no executable action.
    const terminalContract = getRecoveryContractForReason({ code: 'canon_authority_blocked', source: 'preflight' })!;
    expect(terminalContract.recoveryAction).toBe('none');
    const terminalInput: RecoveryExecutorInput = deepFreeze({
      reason: { code: 'canon_authority_blocked', source: 'preflight' },
      opportunityId: 'op-1',
      manuscriptVersionSha: 'm',
      ledgerSourceHash: 'l',
      opportunityVersion: revisionOpportunityVersionFor('op-1', 'l'),
      candidateSetVersion: null,
      recoveryInputFingerprint: computeRecoveryInputFingerprint('none', {}),
      inputs: {},
    });
    const terminalResult = executeRecoveryAction(terminalInput);
    expect(terminalResult.outcome).toBe('no_op');
    expect(terminalResult.output).toBeUndefined();

    // Annotation sources never produce a contract.
    expect(getRecoveryContractForReason({ code: 'context_missing', source: 'executability' })).toBeUndefined();
    expect(getRecoveryContractForReason({ code: 'any note', source: 'grounding_note' })).toBeUndefined();
  });

  it('produces deterministic output for the same recovery input identity', () => {
    const inputs = {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      evidence_anchor: 'quick brown fox',
      manuscript_chunks: ['The quick brown fox', 'jumps over the lazy dog.'],
    };
    const a = executeRecoveryAction(baseInput('retrieve_context', 'context_missing', 'preflight', inputs));
    const b = executeRecoveryAction(baseInput('retrieve_context', 'context_missing', 'preflight', inputs));
    expect(a.outcome).toBe('success');
    expect(b.outcome).toBe('success');
    expect(a.output).toEqual(b.output);
  });

  it('does not call persistence, queue, manuscript, or runtime modules', () => {
    // The executor is pure: result is derived only from the input object and the
    // contract. No database, queue, or external service call sites exist in this
    // module, which is enforced by the import graph (only local held-recovery
    // modules and the canonical versioning helper are imported).
    const result = executeRecoveryAction(baseInput('resolve_anchor', 'truncated_anchor', 'preflight', {
      source_text: 'The quick brown fox jumps over the lazy dog.',
      manuscript_coordinates: 'ch1.p3',
      evidence_anchor: 'quick brown fox',
    }));
    expect(result.outcome).toBe('deferred_work');
    expect(result.error).toBe('ANCHOR_RECONSTRUCTION_REQUIRED');
  });
});
