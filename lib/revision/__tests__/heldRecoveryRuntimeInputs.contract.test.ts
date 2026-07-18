import { describe, it, expect } from '@jest/globals';
import {
  buildRecoveryExecutorInputFromCanonicalState,
  deriveCanonicalManuscriptChunkReference,
  deriveCanonicalManuscriptChunkReferences,
  executeHeldRecoveryRuntimeProof,
  heldRecoveryReason,
  listCanonicalRecoveryInputSourceMap,
  sourceHashForCanonicalChunkContent,
  type CanonicalRecoveryState,
} from '@/lib/revision/heldRecoveryRuntimeInputs';
import { computeRecoveryInputFingerprint, executeRecoveryAction } from '@/lib/revision/heldRecoveryExecutor';
import { candidateSetVersionFor, revisionOpportunityVersionFor } from '@/lib/revision/heldRecoveryVersioning';

const MANUSCRIPT_VERSION_SHA = 'mv-sha-1';

function chunkRow(content: string, index: number = 0) {
  return {
    id: `chunk-${index}`,
    manuscript_id: 44,
    chunk_index: index,
    char_start: index * 100,
    char_end: index * 100 + content.length,
    overlap_chars: 0,
    label: `Chunk ${index + 1}`,
    content,
    content_hash: sourceHashForCanonicalChunkContent(content),
  };
}

function baseState(overrides: Partial<CanonicalRecoveryState> = {}): CanonicalRecoveryState {
  const chunks = deriveCanonicalManuscriptChunkReferences(
    [
      chunkRow('Opening context. The quick brown fox watches the gate.', 0),
      chunkRow('Later context. The quick brown fox returns to the gate.', 1),
    ],
    { manuscriptVersionSha: MANUSCRIPT_VERSION_SHA },
  );
  const state: CanonicalRecoveryState = {
    opportunity: {
      opportunityId: 'op-ctx-1',
      ledgerSourceHash: 'ledger-source-sha',
      sourceText: 'Opening context. The quick brown fox watches the gate. Later context.',
      evidenceAnchor: 'quick brown fox',
      manuscriptCoordinates: 'chapter 1 / chunk 0',
      rationale: 'The surrounding scene context is needed before repair.',
      diagnostic: {
        symptom: 'The recommendation lacks context.',
        cause: 'The evidence window is too narrow.',
        fix_direction: 'Recover the surrounding canonical manuscript context.',
        reader_effect: 'The revision can stay grounded in the scene.',
      },
      existingCandidatesABC: { a: 'Alpha', b: 'Beta', c: 'Gamma' },
    },
    manuscript: {
      manuscriptId: 44,
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      chunks,
    },
  };
  return { ...state, ...overrides };
}

describe('held recovery runtime input provenance proof', () => {
  it('maps every executor input key to an existing canonical persisted authority', () => {
    expect(listCanonicalRecoveryInputSourceMap()).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'source_text', persistedAuthority: expect.stringContaining('revision opportunity ledger') }),
      expect.objectContaining({ key: 'manuscript_chunks', persistedAuthority: expect.stringContaining('manuscript_chunks') }),
      expect.objectContaining({ key: 'existing_candidates_a_b_c', persistedAuthority: expect.stringContaining('persisted opportunity ledger') }),
    ]));
  });

  it('derives typed chunk references from existing manuscript_chunks rows without creating a competing source of truth', () => {
    const ref = deriveCanonicalManuscriptChunkReference(chunkRow('Canonical text.', 0), {
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
    });

    expect(ref).toMatchObject({
      chunkId: 'chunk-0',
      manuscriptId: 44,
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      chunkIndex: 0,
      sourceStartOffset: 0,
      sourceEndOffset: 'Canonical text.'.length,
      content: 'Canonical text.',
      contentHash: sourceHashForCanonicalChunkContent('Canonical text.'),
      provenance: { source: 'manuscript_chunks', rowId: 'chunk-0' },
    });
  });

  it('rejects malformed or stale chunk rows before they become executor input', () => {
    expect(() => deriveCanonicalManuscriptChunkReference({
      ...chunkRow('Canonical text.'),
      content_hash: sourceHashForCanonicalChunkContent('forged text'),
    }, { manuscriptVersionSha: MANUSCRIPT_VERSION_SHA })).toThrow(/content_hash/);

    expect(() => deriveCanonicalManuscriptChunkReferences([
      chunkRow('first', 0),
      chunkRow('third', 2),
    ], { manuscriptVersionSha: MANUSCRIPT_VERSION_SHA })).toThrow(/contiguous/);
  });

  it('keeps chunk identity stable across reload when persisted row identity is unchanged', () => {
    const firstLoad = deriveCanonicalManuscriptChunkReferences([chunkRow('Stable text.', 0)], {
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
    });
    const secondLoad = deriveCanonicalManuscriptChunkReferences([chunkRow('Stable text.', 0)], {
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
    });

    expect(secondLoad).toEqual(firstLoad);
  });

  it('does not let untrusted request identity fields construct the authority snapshot', () => {
    const state = baseState();
    const input = buildRecoveryExecutorInputFromCanonicalState({
      reason: heldRecoveryReason('context_missing', 'preflight'),
      requestedIdentity: {
        ledgerSourceHash: 'forged-ledger',
        opportunityVersion: 'forged-opportunity-version',
        candidateSetVersion: 'forged-candidate-version',
        recoveryInputFingerprint: 'forged-fingerprint',
        manuscriptVersionSha: 'forged-manuscript-version',
      },
    }, state);

    const expectedCandidateSetVersion = candidateSetVersionFor({ a: 'Alpha', b: 'Beta', c: 'Gamma' });
    expect(input.ledgerSourceHash).toBe(state.opportunity.ledgerSourceHash);
    expect(input.opportunityVersion).toBe(revisionOpportunityVersionFor('op-ctx-1', 'ledger-source-sha'));
    expect(input.candidateSetVersion).toBe(expectedCandidateSetVersion);
    expect(input.recoveryInputFingerprint).toBe(computeRecoveryInputFingerprint('retrieve_context', input.inputs));
    expect(input.manuscriptVersionSha).toBe(MANUSCRIPT_VERSION_SHA);
    expect(input.authority).toEqual({
      canonicalLedgerSourceHash: state.opportunity.ledgerSourceHash,
      canonicalOpportunityVersion: input.opportunityVersion,
      canonicalCandidateSetVersion: expectedCandidateSetVersion,
      canonicalRecoveryInputFingerprint: input.recoveryInputFingerprint,
    });
  });

  it('proves forged request hashes and versions cannot satisfy executor authority validation', () => {
    const input = buildRecoveryExecutorInputFromCanonicalState({
      reason: heldRecoveryReason('context_missing', 'preflight'),
    }, baseState());

    expect(executeRecoveryAction({ ...input, ledgerSourceHash: 'forged-ledger' }).error).toBe('STALE_LEDGER_SOURCE_HASH');
    expect(executeRecoveryAction({ ...input, opportunityVersion: 'forged-opportunity' }).error).toBe('STALE_OPPORTUNITY_VERSION');
    expect(executeRecoveryAction({ ...input, candidateSetVersion: 'forged-candidates' }).error).toBe('STALE_CANDIDATE_SET_VERSION');
    expect(executeRecoveryAction({ ...input, recoveryInputFingerprint: 'forged-fingerprint' }).error).toBe('STALE_RECOVERY_INPUT_FINGERPRINT');
  });

  it('rejects caller supplied free-form chunk text at the executor boundary', () => {
    const input = buildRecoveryExecutorInputFromCanonicalState({
      reason: heldRecoveryReason('context_missing', 'preflight'),
    }, baseState());

    const result = executeRecoveryAction({
      ...input,
      inputs: { ...input.inputs, manuscript_chunks: ['quick brown fox'] },
      recoveryInputFingerprint: computeRecoveryInputFingerprint('retrieve_context', {
        ...input.inputs,
        manuscript_chunks: ['quick brown fox'],
      }),
      authority: {
        ...input.authority!,
        canonicalRecoveryInputFingerprint: computeRecoveryInputFingerprint('retrieve_context', {
          ...input.inputs,
          manuscript_chunks: ['quick brown fox'],
        }),
      },
    });

    expect(result.outcome).toBe('terminal_failure');
    expect(result.error).toBe('INVALID_CANONICAL_CHUNK_REFERENCES');
  });

  it('fails closed when canonical chunk references are bound to a stale manuscript version', () => {
    const staleChunks = deriveCanonicalManuscriptChunkReferences([chunkRow('The quick brown fox appears here.', 0)], {
      manuscriptVersionSha: 'old-manuscript-version',
    });
    const input = buildRecoveryExecutorInputFromCanonicalState({
      reason: heldRecoveryReason('context_missing', 'preflight'),
    }, baseState({
      manuscript: {
        manuscriptId: 44,
        manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
        chunks: staleChunks,
      },
    }));
    const result = executeRecoveryAction(input);

    expect(result.outcome).toBe('terminal_failure');
    expect(result.error).toBe('STALE_MANUSCRIPT_CHUNK_VERSION');
  });

  it('reconstructs context from exact canonical chunk text in stable chunk order', () => {
    const result = executeHeldRecoveryRuntimeProof({
      reason: heldRecoveryReason('context_missing', 'preflight'),
    }, baseState());

    expect(result.outcome).toBe('success');
    expect(result.output?.selectedChunks).toEqual([
      expect.objectContaining({
        chunkId: 'chunk-0',
        chunkIndex: 0,
        text: 'Opening context. The quick brown fox watches the gate.',
        contentHash: sourceHashForCanonicalChunkContent('Opening context. The quick brown fox watches the gate.'),
        provenance: { source: 'manuscript_chunks', rowId: 'chunk-0' },
      }),
      expect.objectContaining({
        chunkId: 'chunk-1',
        chunkIndex: 1,
        text: 'Later context. The quick brown fox returns to the gate.',
        contentHash: sourceHashForCanonicalChunkContent('Later context. The quick brown fox returns to the gate.'),
        provenance: { source: 'manuscript_chunks', rowId: 'chunk-1' },
      }),
    ]);
  });

  it('proves integration outcomes without mutating queues, ledgers, manuscripts, or final-review state', () => {
    const state = baseState();
    const before = JSON.stringify(state);

    expect(executeHeldRecoveryRuntimeProof({ reason: heldRecoveryReason('not_a_known_reason', 'preflight') }, state)).toMatchObject({
      outcome: 'terminal_failure',
      error: 'UNKNOWN_RECOVERY_CONTRACT',
    });

    expect(executeHeldRecoveryRuntimeProof({ reason: heldRecoveryReason('candidate_quality_failed', 'candidate_quality') }, state)).toMatchObject({
      outcome: 'deferred_work',
      error: 'LLM_ASSISTED_NOT_AUTHORIZED',
    });

    expect(executeHeldRecoveryRuntimeProof({ reason: heldRecoveryReason('truncated_anchor', 'preflight') }, state)).toMatchObject({
      outcome: 'deferred_work',
      error: 'ANCHOR_RECONSTRUCTION_REQUIRED',
    });

    const missingInput = buildRecoveryExecutorInputFromCanonicalState({ reason: heldRecoveryReason('context_missing', 'preflight') }, state);
    const missingInputs = { source_text: state.opportunity.sourceText };
    const missingFingerprint = computeRecoveryInputFingerprint('retrieve_context', missingInputs);
    expect(executeRecoveryAction({
      ...missingInput,
      inputs: missingInputs,
      recoveryInputFingerprint: missingFingerprint,
      authority: {
        ...missingInput.authority!,
        canonicalRecoveryInputFingerprint: missingFingerprint,
      },
    })).toMatchObject({
      outcome: 'retryable_failure',
      error: 'MISSING_REQUIRED_INPUTS',
    });

    expect(JSON.stringify(state)).toBe(before);
  });
});