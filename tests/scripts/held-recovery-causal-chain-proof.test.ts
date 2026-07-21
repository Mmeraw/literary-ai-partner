import { describe, expect, it } from '@jest/globals'
import {
  HELD_RECOVERY_PROOF_REQUIRED_CONTROLS,
  HELD_RECOVERY_NEGATIVE_PROOF_ASSERTIONS,
  HELD_RECOVERY_POSITIVE_PROOF_ASSERTIONS,
  HELD_RECOVERY_PROOF_ALLOWED_OPERATIONS,
  HELD_RECOVERY_PROOF_FORBIDDEN_OPERATIONS,
  collectHeldRecoveryNamedEvidence,
  evaluateHeldRecoveryCausalChainProof,
  type HeldRecoveryCausalChainProof,
} from '../../scripts/revision/held-recovery-causal-chain-proof'

function snapshot(label: 'before_release' | 'after_continuation' | 'replay', overrides: Partial<HeldRecoveryCausalChainProof['after']> = {}): HeldRecoveryCausalChainProof['after'] {
  return {
    label,
    job: { id: 'job-1', status: 'complete', manuscript_id: '9007199254740993' },
    artifactCounts: { revision_opportunity_ledger_v1: 1 },
    attempts: [{ held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', status: 'reclassified' }],
    reconstructionWorkItems: [{ held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v1', status: 'completed', details: 'fingerprint-present' }],
    reconstructedAnchors: [{ held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v1', completion_fingerprint: 'fp', source_hash: 'sha256:abc', source_start_offset: 10, source_end_offset: 25 }],
    queueItems: [{ held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v1', queue_state: 'reclassified' }],
    transitionEvents: [{ id: 'transition-1', held_item_id: 'held-1', to_state: 'reclassified' }],
    decisionRows: [],
    ...overrides,
  }
}

function unrelatedCounts() {
  return {
    heldRecoveryAttempts: 10,
    reconstructionWorkItems: 10,
    reconstructedAnchors: 10,
    queueItems: 10,
    transitionEvents: 10,
    decisionRows: 10,
  }
}

function proof(overrides: Partial<HeldRecoveryCausalChainProof> = {}): HeldRecoveryCausalChainProof {
  return {
    jobId: 'job-1',
    manuscriptId: '9007199254740993',
    before: snapshot('before_release', { job: { id: 'job-1', status: 'queued' }, attempts: [], reconstructionWorkItems: [], reconstructedAnchors: [], queueItems: [] }),
    after: snapshot('after_continuation'),
    workerResponse: {
      success: true,
      targetJobId: 'job-1',
      heldRecoveryInitiation: { status: 'deferred_reconstruction_admitted' },
      heldRecoveryContinuation: {
        status: 'readmission_finished',
        readmission: { status: 'readmission_completed' },
        completionAuthority: { status: 'reclassified', finalCardType: 'copy_paste_rewrite' },
      },
    },
    trustedPathPreview: { ok: true, eligible: 1, alreadyDecided: 0, total: 1 },
    trustedPathReloadPreview: { ok: true, eligible: 1, alreadyDecided: 0, total: 1 },
    deployedSha: '188bed3',
    expectedDeployedSha: '188bed343c9988a7ecb79481a0f0640970cfaab8',
    unrelatedBefore: unrelatedCounts(),
    unrelatedAfter: unrelatedCounts(),
    ...overrides,
  }
}

describe('evaluateHeldRecoveryCausalChainProof', () => {
  it('declares a public-boundary-only proof scope', () => {
    expect(HELD_RECOVERY_PROOF_ALLOWED_OPERATIONS).toEqual([
      'observe_target_scoped_database_rows',
      'observe_deployment_health_sha',
      'invoke_admin_proof_job_runtime_boundary',
      'invoke_production_worker_runtime_boundary',
      'invoke_public_workbench_reader_boundary',
      'collect_evidence_artifact',
    ])
    expect(HELD_RECOVERY_PROOF_FORBIDDEN_OPERATIONS).toContain('repair_production_data')
    expect(HELD_RECOVERY_PROOF_FORBIDDEN_OPERATIONS).toContain('bypass_runtime_boundaries')
    expect(HELD_RECOVERY_PROOF_FORBIDDEN_OPERATIONS).toContain('call_internal_helpers_directly')
    expect(HELD_RECOVERY_PROOF_FORBIDDEN_OPERATIONS).toContain('create_corrupt_negative_production_state')
    expect(HELD_RECOVERY_PROOF_REQUIRED_CONTROLS).toContain('HELD_RECOVERY_PROOF_JOB_ID=<exact target job>')
    expect(HELD_RECOVERY_PROOF_REQUIRED_CONTROLS).toContain('HELD_RECOVERY_NO_REPAIR_BEHAVIOR_CONFIRMED=yes')
    expect(HELD_RECOVERY_POSITIVE_PROOF_ASSERTIONS).toContain('one_hydrated_workbench_card_observed_through_runtime_reader')
    expect(HELD_RECOVERY_NEGATIVE_PROOF_ASSERTIONS).toContain('wrong_fingerprint_fails_closed')
  })

  it('passes a complete identity-continuous Held Recovery proof', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof())
    expect(gates.filter((item) => !item.ok)).toEqual([])
  })

  it('fails when the hydrated Workbench terminal card is absent', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      workerResponse: {
        heldRecoveryContinuation: {
          status: 'readmission_finished',
          readmission: { status: 'readmission_completed' },
          completionAuthority: { status: 'reclassified' },
        },
      },
    }))
    expect(gates.find((item) => item.id === 'hydrated_workbench_card_terminal')).toMatchObject({ ok: false })
  })

  it('fails closed when public Workbench reader evidence is absent', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      trustedPathPreview: { ok: false, error: 'reader unavailable' },
    }))
    expect(gates.find((item) => item.id === 'public_workbench_reader_ok')).toMatchObject({ ok: false })
    expect(gates.find((item) => item.id === 'workbench_reader_returns_one_terminal_card')).toMatchObject({ ok: false })
  })

  it('fails closed when the deployed SHA does not match the expected production SHA', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      deployedSha: 'deadbee',
    }))
    expect(gates.find((item) => item.id === 'deployed_sha_matches_expected')).toMatchObject({ ok: false })
  })

  it('fails closed when the reclassification transition event is missing', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      after: snapshot('after_continuation', { transitionEvents: [] }),
    }))
    expect(gates.find((item) => item.id === 'transition_event_recorded')).toMatchObject({ ok: false })
    expect(gates.find((item) => item.id === 'transition_event_reclassified')).toMatchObject({ ok: false })
  })

  it('fails closed on identity drift between queue and reconstructed anchor', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      after: snapshot('after_continuation', {
        reconstructedAnchors: [{ held_item_id: 'foreign-held', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v1', completion_fingerprint: 'fp', source_hash: 'sha256:abc', source_start_offset: 10, source_end_offset: 25 }],
      }),
    }))
    expect(gates.find((item) => item.id === 'anchor_identity_matches_queue')).toMatchObject({ ok: false })
  })

  it('fails closed on wrong manuscript identity', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      after: snapshot('after_continuation', {
        queueItems: [{ held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740994', held_item_persisted_version: 'held-v1', queue_state: 'reclassified' }],
      }),
    }))
    expect(gates.find((item) => item.id === 'manuscript_identity_continuity')).toMatchObject({ ok: false })
  })

  it('fails closed on cross-job worker identity', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      workerResponse: { targetJobId: 'foreign-job' },
    }))
    expect(gates.find((item) => item.id === 'worker_target_job_exact')).toMatchObject({ ok: false })
  })

  it('fails closed on wrong persisted version', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      after: snapshot('after_continuation', {
        reconstructionWorkItems: [{ held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v2', status: 'completed', details: 'fingerprint-present' }],
      }),
    }))
    expect(gates.find((item) => item.id === 'held_version_continuity')).toMatchObject({ ok: false })
  })

  it('fails closed on missing anchor fingerprint', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      after: snapshot('after_continuation', {
        reconstructedAnchors: [{ held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v1', source_hash: 'sha256:abc', source_start_offset: 10, source_end_offset: 25 }],
      }),
    }))
    expect(gates.find((item) => item.id === 'anchor_fingerprint_present')).toMatchObject({ ok: false })
  })

  it('fails closed on missing reconstruction', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      after: snapshot('after_continuation', { reconstructionWorkItems: [] }),
    }))
    expect(gates.find((item) => item.id === 'one_reconstruction_work_item')).toMatchObject({ ok: false })
  })

  it('fails closed on duplicate readmission queue authority', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      after: snapshot('after_continuation', {
        queueItems: [
          { held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v1', queue_state: 'reclassified' },
          { held_item_id: 'held-2', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v1', queue_state: 'reclassified' },
        ],
      }),
    }))
    expect(gates.find((item) => item.id === 'one_queue_authority')).toMatchObject({ ok: false })
  })

  it('fails closed on stale persisted version during replay', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      unrelatedReplay: unrelatedCounts(),
      replay: snapshot('replay', {
        reconstructedAnchors: [{ held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v2', completion_fingerprint: 'fp', source_hash: 'sha256:abc', source_start_offset: 10, source_end_offset: 25 }],
      }),
    }))
    expect(gates.find((item) => item.id === 'replay_anchor_idempotent')).toMatchObject({ ok: true })
    expect(gates.find((item) => item.id === 'replay_anchor_state_identical')).toMatchObject({ ok: false })
  })

  it('checks replay idempotency when a replay snapshot is supplied', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      unrelatedReplay: unrelatedCounts(),
      replay: snapshot('replay', {
        reconstructionWorkItems: [
          { held_item_id: 'held-1', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v1', status: 'completed', details: 'fingerprint-present' },
          { held_item_id: 'held-2', opportunity_id: 'op-1', manuscript_id: '9007199254740993', held_item_persisted_version: 'held-v2', status: 'completed', details: 'fingerprint-present' },
        ],
      }),
    }))
    expect(gates.find((item) => item.id === 'replay_work_idempotent')).toMatchObject({ ok: false })
  })

  it('fails closed on unrelated mutation during the proof window', () => {
    const gates = evaluateHeldRecoveryCausalChainProof(proof({
      unrelatedAfter: { ...unrelatedCounts(), queueItems: 11 },
    }))
    expect(gates.find((item) => item.id === 'unrelated_mutation_count_zero')).toMatchObject({ ok: false })
  })

  it('emits named machine-readable evidence for the proof pack', () => {
    const evidence = collectHeldRecoveryNamedEvidence(proof({
      unrelatedReplay: unrelatedCounts(),
      replay: snapshot('replay'),
    }))
    expect(evidence).toEqual(expect.arrayContaining([
      { id: 'exact_evaluation_job_id', value: 'job-1' },
      { id: 'exact_manuscript_id', value: '9007199254740993' },
      { id: 'held_row_count', value: 1 },
      { id: 'reconstructed_anchor_fingerprint', value: 'fp' },
      { id: 'transition_event_to_state', value: 'reclassified' },
      { id: 'public_trusted_path_eligible_count', value: 1 },
      { id: 'unrelated_mutation_count', value: 0 },
    ]))
  })
})