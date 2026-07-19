import { describe, it, expect, jest } from '@jest/globals'
import {
  createSupabaseHeldRecoveryRuntimeLoaders,
  runHeldRecoveryRuntimeOrchestration,
  runHeldRecoveryRuntimeOrchestrationWithAttemptRecording,
  type CanonicalCandidateStateLoadResult,
  type CanonicalHeldItem,
  type CanonicalHeldItemLoadResult,
  type CanonicalManuscriptChunkRowsLoadResult,
  type CanonicalOpportunityLoadResult,
  type HeldRecoveryRuntimeLoaders,
} from '@/lib/revision/heldRecoveryRuntimeOrchestrator'
import {
  buildRecoveryExecutorInputFromCanonicalState,
  sourceHashForCanonicalChunkContent,
  type HeldRecoveryRuntimeRequest,
  type CanonicalRecoveryState,
} from '@/lib/revision/heldRecoveryRuntimeInputs'
import type { RecoveryExecutorInput } from '@/lib/revision/heldRecoveryExecutor'
import type {
  HeldRecoveryAttemptPersistenceAdapter,
  RecordRecoveryAttemptInput,
  RecordRecoveryAttemptResult,
} from '@/lib/revision/heldRecoveryAttemptRecorder'

const MANUSCRIPT_VERSION_SHA = 'runtime-manuscript-sha'

function baseHeldItem(overrides: Partial<CanonicalHeldItem> = {}): CanonicalHeldItem {
  return {
    heldItemId: 'held-1',
    opportunityId: 'op-1',
    reason: { code: 'context_missing', source: 'preflight' },
    producer: 'preflight',
    persistedVersion: 'held-v1',
    manuscriptId: '77',
    manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
    ...overrides,
  }
}

function baseOpportunity(): CanonicalOpportunityLoadResult {
  return {
    status: 'loaded',
    value: {
      opportunityId: 'op-1',
      ledgerSourceHash: 'ledger-source-hash',
      sourceText: 'The quick brown fox watches the gate while rain gathers.',
      evidenceAnchor: 'quick brown fox',
      manuscriptCoordinates: 'chapter 1 / chunk 0',
      rationale: 'Recover the surrounding context before generating revised prose.',
      diagnostic: {
        symptom: 'The recommendation lacks enough local context.',
        cause: 'The evidence window is too narrow for a grounded change.',
        fix_direction: 'Retrieve the surrounding manuscript passage.',
        reader_effect: 'The proposed recovery can stay grounded in the scene.',
      },
    },
  }
}

function baseCandidates(): CanonicalCandidateStateLoadResult {
  return { status: 'loaded', value: { a: 'Alpha', b: 'Beta', c: 'Gamma' } }
}

function chunk(content: string, index = 0) {
  return {
    id: `chunk-${index}`,
    manuscript_id: '77',
    chunk_index: index,
    char_start: index * 100,
    char_end: index * 100 + content.length,
    overlap_chars: 0,
    label: `Chunk ${index + 1}`,
    content,
    content_hash: sourceHashForCanonicalChunkContent(content),
  }
}

function baseChunks(): CanonicalManuscriptChunkRowsLoadResult {
  return {
    status: 'loaded',
    value: [
      chunk('The quick brown fox watches the gate while rain gathers.', 0),
      chunk('Elsewhere, the guard listens for footsteps.', 1),
    ],
  }
}

function loadersWith(overrides: Partial<{
  held: CanonicalHeldItemLoadResult
  opportunity: CanonicalOpportunityLoadResult
  candidates: CanonicalCandidateStateLoadResult
  chunks: CanonicalManuscriptChunkRowsLoadResult
}> = {}) {
  const calls: string[] = []
  const loaders: HeldRecoveryRuntimeLoaders = {
    async loadHeldItem() {
      calls.push('loadHeldItem')
      return overrides.held ?? { status: 'loaded', value: baseHeldItem() }
    },
    async loadOpportunityLedger() {
      calls.push('loadOpportunityLedger')
      return overrides.opportunity ?? baseOpportunity()
    },
    async loadCandidateState() {
      calls.push('loadCandidateState')
      return overrides.candidates ?? baseCandidates()
    },
    async loadManuscriptChunks() {
      calls.push('loadManuscriptChunks')
      return overrides.chunks ?? baseChunks()
    },
  }
  return { loaders, calls }
}

describe('bounded held recovery runtime orchestration', () => {
  it('rejects an unknown held reason after held-item resolution and before other loaders or executor invocation', async () => {
    const { loaders, calls } = loadersWith({
      held: { status: 'loaded', value: baseHeldItem({ reason: { code: 'not_a_known_reason', source: 'preflight' } }) },
    })
    const build = jest.fn<typeof buildRecoveryExecutorInputFromCanonicalState>()
    const execute = jest.fn()

    const result = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders, {
      buildExecutorInputFromCanonicalState: build,
      executeRecoveryAction: execute as never,
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') throw new Error('expected rejected result')
    expect(result.reason).toBe('unknown_held_reason')
    expect(calls).toEqual(['loadHeldItem'])
    expect(build).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects a missing opportunity without invoking the adapter or executor', async () => {
    const { loaders, calls } = loadersWith({ opportunity: { status: 'missing' } })
    const build = jest.fn<typeof buildRecoveryExecutorInputFromCanonicalState>()
    const execute = jest.fn()

    const result = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders, {
      buildExecutorInputFromCanonicalState: build,
      executeRecoveryAction: execute as never,
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') throw new Error('expected rejected result')
    expect(result.reason).toBe('missing_canonical_input')
    expect(calls).toEqual(['loadHeldItem', 'loadOpportunityLedger'])
    expect(build).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects legacy-only opportunity authority explicitly and never silently promotes it', async () => {
    const { loaders, calls } = loadersWith({
      opportunity: { status: 'legacy_only', legacyArtifactId: 'legacy-ledger-1' },
    })
    const build = jest.fn<typeof buildRecoveryExecutorInputFromCanonicalState>()
    const execute = jest.fn()

    const result = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders, {
      buildExecutorInputFromCanonicalState: build,
      executeRecoveryAction: execute as never,
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') throw new Error('expected rejected result')
    expect(result.reason).toBe('legacy_artifact_unsupported')
    expect(result.details).toEqual({ legacyArtifactId: 'legacy-ledger-1' })
    expect(calls).toEqual(['loadHeldItem', 'loadOpportunityLedger'])
    expect(build).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects conflicting current and legacy persisted authority before executor invocation', async () => {
    const { loaders, calls } = loadersWith({
      opportunity: { status: 'conflict', reason: 'current and legacy artifacts disagree' },
    })
    const build = jest.fn<typeof buildRecoveryExecutorInputFromCanonicalState>()
    const execute = jest.fn()

    const result = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders, {
      buildExecutorInputFromCanonicalState: build,
      executeRecoveryAction: execute as never,
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') throw new Error('expected rejected result')
    expect(result.reason).toBe('conflicting_persisted_authority')
    expect(calls).toEqual(['loadHeldItem', 'loadOpportunityLedger'])
    expect(build).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects mixed current opportunity plus legacy candidate authority before loading chunks or executing', async () => {
    const { loaders, calls } = loadersWith({
      opportunity: baseOpportunity(),
      candidates: { status: 'legacy_only', legacyArtifactId: 'legacy-candidate-artifact' },
      chunks: baseChunks(),
    })
    const build = jest.fn<typeof buildRecoveryExecutorInputFromCanonicalState>()
    const execute = jest.fn()

    const result = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders, {
      buildExecutorInputFromCanonicalState: build,
      executeRecoveryAction: execute as never,
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') throw new Error('expected rejected result')
    expect(result.reason).toBe('legacy_artifact_unsupported')
    expect(result.details).toEqual({ legacyArtifactId: 'legacy-candidate-artifact' })
    expect(calls).toEqual(['loadHeldItem', 'loadOpportunityLedger', 'loadCandidateState'])
    expect(build).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })

  it('loads canonical state in defined order, delegates to the #1326 adapter, executes once, and classifies success', async () => {
    const { loaders, calls } = loadersWith()
    const states: CanonicalRecoveryState[] = []
    const build = jest.fn((request: HeldRecoveryRuntimeRequest, state: CanonicalRecoveryState) => {
      states.push(state)
      return buildRecoveryExecutorInputFromCanonicalState(request, state)
    })
    const execute = jest.fn((input: RecoveryExecutorInput) => ({
      outcome: 'success' as const,
      action: input.reason.code === 'context_missing' ? 'retrieve_context' as const : 'none' as const,
      producer: 'preflight' as const,
      code: input.reason.code,
      output: { selectedChunks: [] },
    }))

    const result = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders, {
      buildExecutorInputFromCanonicalState: build,
      executeRecoveryAction: execute,
    })

    expect(result.status).toBe('completed')
    expect(calls).toEqual(['loadHeldItem', 'loadOpportunityLedger', 'loadCandidateState', 'loadManuscriptChunks'])
    expect(build).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(states[0]).toMatchObject({
      opportunity: {
        opportunityId: 'op-1',
        ledgerSourceHash: 'ledger-source-hash',
        existingCandidatesABC: { a: 'Alpha', b: 'Beta', c: 'Gamma' },
      },
      manuscript: {
        manuscriptId: '77',
        manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      },
    })
    expect(states[0].manuscript.chunks[0]).toMatchObject({
      chunkId: 'chunk-0',
      provenance: { source: 'manuscript_chunks', rowId: 'chunk-0' },
    })
  })

  it('classifies repeated unchanged execution deterministically without mutations or persistence calls', async () => {
    const frozenOpportunity = Object.freeze(baseOpportunity())
    const frozenCandidates = Object.freeze(baseCandidates())
    const frozenChunks = Object.freeze(baseChunks())
    const { loaders, calls } = loadersWith({
      opportunity: frozenOpportunity,
      candidates: frozenCandidates,
      chunks: frozenChunks,
    })

    const first = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders)
    const second = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders)

    expect(first).toEqual(second)
    expect(first.status).toBe('completed')
    expect(calls).toEqual([
      'loadHeldItem', 'loadOpportunityLedger', 'loadCandidateState', 'loadManuscriptChunks',
      'loadHeldItem', 'loadOpportunityLedger', 'loadCandidateState', 'loadManuscriptChunks',
    ])
    expect(frozenOpportunity).toEqual(baseOpportunity())
    expect(frozenCandidates).toEqual(baseCandidates())
    expect(frozenChunks).toEqual(baseChunks())
  })

  it('derives identical CanonicalRecoveryState across repeated loads of unchanged persisted authority', async () => {
    const calls: string[] = []
    const loaders: HeldRecoveryRuntimeLoaders = {
      async loadHeldItem() {
        calls.push('loadHeldItem')
        return { status: 'loaded', value: { ...baseHeldItem() } }
      },
      async loadOpportunityLedger() {
        calls.push('loadOpportunityLedger')
        const result = baseOpportunity()
        if (result.status !== 'loaded') throw new Error('expected loaded base opportunity')
        return { status: 'loaded', value: { ...result.value, diagnostic: result.value.diagnostic ? { ...result.value.diagnostic } : undefined } }
      },
      async loadCandidateState() {
        calls.push('loadCandidateState')
        return { status: 'loaded', value: { a: 'Alpha', b: 'Beta', c: 'Gamma' } }
      },
      async loadManuscriptChunks() {
        calls.push('loadManuscriptChunks')
        const result = baseChunks()
        if (result.status !== 'loaded') throw new Error('expected loaded base chunks')
        return { status: 'loaded', value: [...result.value] }
      },
    }
    const states: CanonicalRecoveryState[] = []
    const build = jest.fn((request: HeldRecoveryRuntimeRequest, state: CanonicalRecoveryState) => {
      states.push(state)
      return buildRecoveryExecutorInputFromCanonicalState(request, state)
    })

    const first = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders, {
      buildExecutorInputFromCanonicalState: build,
    })
    const second = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders, {
      buildExecutorInputFromCanonicalState: build,
    })

    expect(first).toEqual(second)
    expect(states).toHaveLength(2)
    expect(states[1]).toEqual(states[0])
    expect(states[1]).not.toBe(states[0])
    expect(calls).toEqual([
      'loadHeldItem', 'loadOpportunityLedger', 'loadCandidateState', 'loadManuscriptChunks',
      'loadHeldItem', 'loadOpportunityLedger', 'loadCandidateState', 'loadManuscriptChunks',
    ])
  })
})

describe('bounded held recovery runtime attempt recording boundary', () => {
  function attemptPersistence(): HeldRecoveryAttemptPersistenceAdapter {
    return {
      findByIdempotencyKey: jest.fn(async () => null),
      countAttemptsForSeries: jest.fn(async () => 0),
      insertAttempt: jest.fn(async () => { throw new Error('direct insert must not be called by wiring test') }),
      findByHeldItemAndOpportunity: jest.fn(async () => null),
    }
  }

  it('records a runtime attempt after canonical input construction and executor classification', async () => {
    const { loaders, calls } = loadersWith()
    const adapter = attemptPersistence()
    const recordedInputs: RecordRecoveryAttemptInput[] = []
    const recordRecoveryAttempt = jest.fn(async (_adapter, input: RecordRecoveryAttemptInput): Promise<RecordRecoveryAttemptResult> => {
      recordedInputs.push(input)
      return {
        status: 'recorded',
        record: {
          idempotencyKey: 'recorded-key',
          heldItemId: input.heldItem.heldItemId,
          opportunityId: input.heldItem.opportunityId,
          manuscriptId: input.heldItem.manuscriptId,
          manuscriptVersionSha: input.heldItem.manuscriptVersionSha,
          heldItemPersistedVersion: input.heldItem.persistedVersion,
          runtimeOutcomeStatus: input.runtimeOutcome.status,
          runtimeRejectionReason: undefined,
          executorResult: input.runtimeOutcome.result,
          attempt: {
            seriesKey: {
              opportunityVersion: input.executorInput.opportunityVersion,
              candidateSetVersion: input.executorInput.candidateSetVersion,
              producer: input.runtimeOutcome.result.producer,
              code: input.runtimeOutcome.result.code,
              recoveryAction: input.runtimeOutcome.result.action,
            },
            recoveryInputFingerprint: input.executorInput.recoveryInputFingerprint,
            attemptNumber: 1,
            maxAttempts: 3,
            status: 'recovered_pending_reclassification',
            outcome: 'succeeded',
            terminalCardType: null,
            terminalTrustedPathStatus: null,
            snapshot: {
              idempotencyKey: 'recorded-key',
              manuscriptVersionSha: input.heldItem.manuscriptVersionSha,
              opportunityId: input.heldItem.opportunityId,
              trigger: input.trigger,
              canonicalReasons: [],
              originalBaseReasons: [],
              originalFinalReasons: [],
              promotionTransitionReason: null,
              opportunityVersionBefore: input.executorInput.opportunityVersion,
              candidateSetVersionBefore: input.executorInput.candidateSetVersion,
              recoveryInputFingerprintBefore: input.executorInput.recoveryInputFingerprint,
            },
            events: [],
            createdAt: input.nowIso ?? 'now',
            updatedAt: input.nowIso ?? 'now',
          },
        },
      }
    })

    const result = await runHeldRecoveryRuntimeOrchestrationWithAttemptRecording(
      { heldItemId: 'held-1' },
      loaders,
      adapter,
      { trigger: 'system', nowIso: '2026-07-18T03:00:00.000Z', recordRecoveryAttempt },
    )

    expect(result.runtimeOutcome.status).toBe('completed')
    expect(result.attemptRecording?.status).toBe('recorded')
    expect(result.runtimeOutcome).not.toHaveProperty('attemptRecording')
    expect(result.runtimeOutcome).not.toHaveProperty('recordingSkippedReason')
    expect(result.attemptRecording).not.toHaveProperty('runtimeOutcome')
    expect(recordRecoveryAttempt).toHaveBeenCalledTimes(1)
    expect(recordRecoveryAttempt).toHaveBeenCalledWith(adapter, expect.objectContaining({
      heldItem: expect.objectContaining({ heldItemId: 'held-1', persistedVersion: 'held-v1' }),
      runtimeOutcome: expect.objectContaining({ status: 'completed' }),
      trigger: 'system',
      nowIso: '2026-07-18T03:00:00.000Z',
    }))
    expect(recordedInputs[0].executorInput).toMatchObject({
      opportunityId: 'op-1',
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      authority: expect.objectContaining({
        canonicalRecoveryInputFingerprint: recordedInputs[0].executorInput.recoveryInputFingerprint,
      }),
    })
    expect(calls).toEqual(['loadHeldItem', 'loadOpportunityLedger', 'loadCandidateState', 'loadManuscriptChunks'])
  })

  it('skips attempt recording when canonical authority is rejected before executor invocation', async () => {
    const { loaders, calls } = loadersWith({ opportunity: { status: 'legacy_only', legacyArtifactId: 'legacy-ledger-1' } })
    const recordRecoveryAttempt = jest.fn()

    const result = await runHeldRecoveryRuntimeOrchestrationWithAttemptRecording(
      { heldItemId: 'held-1' },
      loaders,
      attemptPersistence(),
      { trigger: 'system', recordRecoveryAttempt: recordRecoveryAttempt as never },
    )

    expect(result.runtimeOutcome).toEqual({
      status: 'rejected',
      reason: 'legacy_artifact_unsupported',
      details: { legacyArtifactId: 'legacy-ledger-1' },
    })
    expect(result.attemptRecording).toBeNull()
    expect(result.recordingSkippedReason).toBe('executor_not_invoked')
    expect(recordRecoveryAttempt).not.toHaveBeenCalled()
    expect(calls).toEqual(['loadHeldItem', 'loadOpportunityLedger'])
  })

  it('records executor-produced rejected outcomes without queue transitions or retry scheduling', async () => {
    const { loaders } = loadersWith()
    const recordRecoveryAttempt = jest.fn(async (_adapter, input: RecordRecoveryAttemptInput): Promise<RecordRecoveryAttemptResult> => ({
      status: 'already_recorded',
      record: {
        idempotencyKey: 'existing-key',
        heldItemId: input.heldItem.heldItemId,
        opportunityId: input.heldItem.opportunityId,
        manuscriptId: input.heldItem.manuscriptId,
        manuscriptVersionSha: input.heldItem.manuscriptVersionSha,
        heldItemPersistedVersion: input.heldItem.persistedVersion,
        runtimeOutcomeStatus: input.runtimeOutcome.status,
        runtimeRejectionReason: input.runtimeOutcome.status === 'rejected' ? input.runtimeOutcome.reason : undefined,
        executorResult: input.runtimeOutcome.result,
        attempt: {
          seriesKey: {
            opportunityVersion: input.executorInput.opportunityVersion,
            candidateSetVersion: input.executorInput.candidateSetVersion,
            producer: input.runtimeOutcome.result.producer,
            code: input.runtimeOutcome.result.code,
            recoveryAction: input.runtimeOutcome.result.action,
          },
          recoveryInputFingerprint: input.executorInput.recoveryInputFingerprint,
          attemptNumber: 1,
          maxAttempts: 3,
          status: 'recovery_attempt_failed_terminal',
          outcome: 'failed_terminal',
          terminalCardType: null,
          terminalTrustedPathStatus: null,
          snapshot: {
            idempotencyKey: 'existing-key',
            manuscriptVersionSha: input.heldItem.manuscriptVersionSha,
            opportunityId: input.heldItem.opportunityId,
            trigger: input.trigger,
            canonicalReasons: [],
            originalBaseReasons: [],
            originalFinalReasons: [],
            promotionTransitionReason: null,
            opportunityVersionBefore: input.executorInput.opportunityVersion,
            candidateSetVersionBefore: input.executorInput.candidateSetVersion,
            recoveryInputFingerprintBefore: input.executorInput.recoveryInputFingerprint,
          },
          events: [],
          createdAt: 'now',
          updatedAt: 'now',
        },
      },
    }))

    const result = await runHeldRecoveryRuntimeOrchestrationWithAttemptRecording(
      { heldItemId: 'held-1' },
      loaders,
      attemptPersistence(),
      {
        trigger: 'request_reanalysis',
        recordRecoveryAttempt,
        dependencies: {
          executeRecoveryAction: (input) => ({
            outcome: 'terminal_failure',
            action: 'retrieve_context',
            producer: 'preflight',
            code: input.reason.code,
            error: 'STALE_OPPORTUNITY_VERSION',
            details: { expected: input.opportunityVersion, actual: 'newer-version' },
          }),
        },
      },
    )

    expect(result.runtimeOutcome.status).toBe('rejected')
    if (result.runtimeOutcome.status !== 'rejected') throw new Error('expected rejected runtime outcome')
    expect(result.runtimeOutcome.reason).toBe('stale_authority')
    expect(result.attemptRecording?.status).toBe('already_recorded')
    expect(recordRecoveryAttempt).toHaveBeenCalledTimes(1)
    expect(recordRecoveryAttempt.mock.calls[0][1]).not.toHaveProperty('queueTransition')
    expect(recordRecoveryAttempt.mock.calls[0][1]).not.toHaveProperty('retrySchedule')
    expect(recordRecoveryAttempt.mock.calls[0][1]).not.toHaveProperty('candidateMutation')
    expect(recordRecoveryAttempt.mock.calls[0][1]).not.toHaveProperty('manuscriptMutation')
    expect(recordRecoveryAttempt.mock.calls[0][1]).not.toHaveProperty('finalReviewMutation')
  })

  it('rejects the opt-in recording wrapper when persistence fails after executor invocation', async () => {
    const { loaders } = loadersWith()
    const persistenceFailure = new Error('attempt persistence unavailable')
    const recordRecoveryAttempt = jest.fn(async () => { throw persistenceFailure })

    await expect(runHeldRecoveryRuntimeOrchestrationWithAttemptRecording(
      { heldItemId: 'held-1' },
      loaders,
      attemptPersistence(),
      { trigger: 'system', recordRecoveryAttempt: recordRecoveryAttempt as never },
    )).rejects.toThrow('attempt persistence unavailable')

    expect(recordRecoveryAttempt).toHaveBeenCalledTimes(1)
  })
})

describe('read-only Supabase held recovery loaders', () => {
  function query(data: unknown, error: unknown = null) {
    const chain: Record<string, jest.Mock> = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      order: jest.fn(() => Promise.resolve({ data, error })),
      insert: jest.fn(() => { throw new Error('mutation insert must not be called') }),
      update: jest.fn(() => { throw new Error('mutation update must not be called') }),
      upsert: jest.fn(() => { throw new Error('mutation upsert must not be called') }),
      delete: jest.fn(() => { throw new Error('mutation delete must not be called') }),
      rpc: jest.fn(() => { throw new Error('mutation rpc must not be called') }),
    }
    return chain
  }

  it('returns legacy_only rather than falling back when only legacy ledger shape exists', async () => {
    const legacy = {
      id: 'legacy-artifact',
      artifact_type: 'revision_opportunity_ledger_v1',
      content: {
        artifact_type: 'revision_opportunity_ledger_v1',
        artifact_version: 'v1',
        source_hash: 'legacy-hash',
        opportunities: [{ opportunity_id: 'op-1' }],
      },
    }
    const artifactQuery = query([legacy])
    const supabase = { from: jest.fn(() => artifactQuery) }
    const loaders = createSupabaseHeldRecoveryRuntimeLoaders({ supabase: supabase as never, jobId: 'job-1' })

    const result = await loaders.loadOpportunityLedger('op-1', baseHeldItem())

    expect(result).toEqual({ status: 'legacy_only', legacyArtifactId: 'legacy-artifact' })
    expect(artifactQuery.insert).not.toHaveBeenCalled()
    expect(artifactQuery.update).not.toHaveBeenCalled()
    expect(artifactQuery.upsert).not.toHaveBeenCalled()
    expect(artifactQuery.delete).not.toHaveBeenCalled()
  })

  it('fails closed when current and legacy artifacts are not identity-equivalent', async () => {
    const current = {
      id: 'current-artifact',
      artifact_type: 'revision_opportunity_ledger_v1',
      content: {
        artifact_type: 'revision_opportunity_ledger_v1',
        artifact_version: 'v1',
        source_hash: 'current-hash',
        opportunity_source_authority: 'unified_evaluation_document_v1.canonicalOpportunityLedger.opportunities',
        revise_queue_preflight: {},
        quality_manifest: {},
        opportunities: [{ opportunity_id: 'op-1' }],
      },
    }
    const legacy = {
      id: 'legacy-artifact',
      artifact_type: 'revision_opportunity_ledger_v1',
      content: {
        artifact_type: 'revision_opportunity_ledger_v1',
        artifact_version: 'v1',
        source_hash: 'legacy-hash',
        opportunities: [{ opportunity_id: 'op-2' }],
      },
    }
    const artifactQuery = query([current, legacy])
    const supabase = { from: jest.fn(() => artifactQuery) }
    const loaders = createSupabaseHeldRecoveryRuntimeLoaders({ supabase: supabase as never, jobId: 'job-1' })

    const result = await loaders.loadOpportunityLedger('op-1', baseHeldItem())

    expect(result.status).toBe('conflict')
    if (result.status !== 'conflict') throw new Error('expected conflict result')
    expect(result.reason).toMatch(/current and legacy/)
    expect(artifactQuery.insert).not.toHaveBeenCalled()
    expect(artifactQuery.update).not.toHaveBeenCalled()
    expect(artifactQuery.upsert).not.toHaveBeenCalled()
    expect(artifactQuery.delete).not.toHaveBeenCalled()
  })
})