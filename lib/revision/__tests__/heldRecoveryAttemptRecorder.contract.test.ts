import { describe, it, expect, jest } from '@jest/globals'
import {
  buildHeldRecoveryAttemptIdempotencyKey,
  buildHeldRecoveryAttemptRecord,
  createSupabaseHeldRecoveryAttemptPersistenceAdapter,
  recordHeldRecoveryAttempt,
  type HeldRecoveryAttemptPersistenceAdapter,
  type HeldRecoveryAttemptRecord,
} from '@/lib/revision/heldRecoveryAttemptRecorder'
import type { CanonicalHeldItem, HeldRecoveryRuntimeOutcome } from '@/lib/revision/heldRecoveryRuntimeOrchestrator'
import type { RecoveryExecutionResult, RecoveryExecutorInput } from '@/lib/revision/heldRecoveryExecutor'
import { computeRecoveryInputFingerprint } from '@/lib/revision/heldRecoveryExecutor'
import { revisionOpportunityVersionFor } from '@/lib/revision/heldRecoveryVersioning'

const NOW = '2026-07-18T02:10:00.000Z'

function heldItem(): CanonicalHeldItem {
  return {
    heldItemId: 'held-1',
    opportunityId: 'op-1',
    reason: { code: 'context_missing', source: 'preflight' },
    producer: 'preflight',
    persistedVersion: 'held-version-1',
    manuscriptId: '77',
    manuscriptVersionSha: 'manuscript-sha-1',
  }
}

function executorInput(overrides: Partial<RecoveryExecutorInput> = {}): RecoveryExecutorInput {
  const inputs = {
    source_text: 'The quick brown fox watches the gate.',
    evidence_anchor: 'quick brown fox',
    manuscript_chunks: [],
  }
  const recoveryInputFingerprint = computeRecoveryInputFingerprint('retrieve_context', inputs)
  const opportunityVersion = revisionOpportunityVersionFor('op-1', 'ledger-source-sha')
  return {
    reason: { code: 'context_missing', source: 'preflight' },
    opportunityId: 'op-1',
    manuscriptVersionSha: 'manuscript-sha-1',
    ledgerSourceHash: 'ledger-source-sha',
    opportunityVersion,
    candidateSetVersion: null,
    recoveryInputFingerprint,
    authority: {
      canonicalLedgerSourceHash: 'ledger-source-sha',
      canonicalOpportunityVersion: opportunityVersion,
      canonicalCandidateSetVersion: null,
      canonicalRecoveryInputFingerprint: recoveryInputFingerprint,
    },
    inputs,
    ...overrides,
  }
}

function executionResult(overrides: Partial<RecoveryExecutionResult> = {}): RecoveryExecutionResult {
  return {
    outcome: 'success',
    action: 'retrieve_context',
    producer: 'preflight',
    code: 'context_missing',
    output: { matchingChunkCount: 1 },
    ...overrides,
  }
}

function runtimeOutcome(overrides: Partial<HeldRecoveryRuntimeOutcome> = {}): HeldRecoveryRuntimeOutcome & { result: RecoveryExecutionResult } {
  const result = executionResult()
  return {
    status: 'completed',
    result,
    ...overrides,
  } as HeldRecoveryRuntimeOutcome & { result: RecoveryExecutionResult }
}

function buildRecord(overrides: Partial<Parameters<typeof buildHeldRecoveryAttemptRecord>[0]> = {}): HeldRecoveryAttemptRecord {
  return buildHeldRecoveryAttemptRecord({
    heldItem: heldItem(),
    executorInput: executorInput(),
    runtimeOutcome: runtimeOutcome(),
    trigger: 'system',
    attemptNumber: 1,
    nowIso: NOW,
    ...overrides,
  })
}

describe('held recovery attempt recorder', () => {
  it('builds a deterministic immutable attempt record from runtime outcome without queue or downstream mutation fields', () => {
    const first = buildRecord()
    const second = buildRecord()

    expect(second).toEqual(first)
    expect(first.idempotencyKey).toHaveLength(64)
    expect(first.attempt.seriesKey).toEqual({
      opportunityVersion: executorInput().opportunityVersion,
      candidateSetVersion: null,
      producer: 'preflight',
      code: 'context_missing',
      recoveryAction: 'retrieve_context',
    })
    expect(first.attempt.status).toBe('recovered_pending_reclassification')
    expect(first.attempt.outcome).toBe('succeeded')
    expect(first.attempt.snapshot).toMatchObject({
      idempotencyKey: first.idempotencyKey,
      manuscriptVersionSha: 'manuscript-sha-1',
      opportunityId: 'op-1',
      trigger: 'system',
      opportunityVersionBefore: executorInput().opportunityVersion,
      candidateSetVersionBefore: null,
      recoveryInputFingerprintBefore: executorInput().recoveryInputFingerprint,
    })
    expect(first.attempt.events.map((event) => event.event)).toEqual([
      'snapshot_created',
      'action_started',
      'action_succeeded',
    ])
    expect(first).not.toHaveProperty('queueTransition')
    expect(first).not.toHaveProperty('retrySchedule')
    expect(first).not.toHaveProperty('candidateMutation')
    expect(first).not.toHaveProperty('manuscriptMutation')
    expect(first).not.toHaveProperty('finalReviewMutation')
  })

  it('uses a stable idempotency key for repeated unchanged runtime execution', () => {
    const keyA = buildHeldRecoveryAttemptIdempotencyKey({
      heldItem: heldItem(),
      executorInput: executorInput(),
      runtimeOutcome: runtimeOutcome(),
      trigger: 'system',
      nowIso: NOW,
    })
    const keyB = buildHeldRecoveryAttemptIdempotencyKey({
      heldItem: heldItem(),
      executorInput: executorInput(),
      runtimeOutcome: runtimeOutcome(),
      trigger: 'system',
      nowIso: '2099-01-01T00:00:00.000Z',
    })
    const changedInput = executorInput({ recoveryInputFingerprint: 'different-fingerprint' })
    const keyC = buildHeldRecoveryAttemptIdempotencyKey({
      heldItem: heldItem(),
      executorInput: changedInput,
      runtimeOutcome: runtimeOutcome(),
      trigger: 'system',
    })

    expect(keyA).toBe(keyB)
    expect(keyC).not.toBe(keyA)
  })

  it('does not derive idempotency from attempt number, timestamps, insertion order, or result payload details', () => {
    const first = buildRecord({ attemptNumber: 1, nowIso: NOW })
    const repeatedLater = buildRecord({
      attemptNumber: 99,
      nowIso: '2099-01-01T00:00:00.000Z',
      runtimeOutcome: runtimeOutcome({
        result: executionResult({ output: { matchingChunkCount: 7, runtimeGeneratedUuid: 'ignored-runtime-detail' } }),
      }),
    })
    const differentAuthority = buildRecord({
      attemptNumber: 1,
      heldItem: { ...heldItem(), persistedVersion: 'held-version-2' },
    })

    expect(repeatedLater.idempotencyKey).toBe(first.idempotencyKey)
    expect(differentAuthority.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it('stores deep copies of canonical snapshots and executor results for audit immutability', () => {
    const canonicalReasons = [
      {
        code: 'context_missing',
        raw: 'Context missing',
        source: 'base_decision' as const,
        authorityRole: 'origin' as const,
      },
    ]
    const originalBaseReasons = ['base reason']
    const originalFinalReasons = ['final reason']
    const result = executionResult({ output: { matchingChunkCount: 1 } })
    const record = buildRecord({
      canonicalReasons,
      originalBaseReasons,
      originalFinalReasons,
      runtimeOutcome: runtimeOutcome({ result }),
    })

    canonicalReasons[0].raw = 'mutated after record construction'
    originalBaseReasons.push('late base reason')
    originalFinalReasons.push('late final reason')
    ;(result.output as Record<string, unknown>).matchingChunkCount = 99

    expect(record.attempt.snapshot.canonicalReasons).toEqual([
      {
        code: 'context_missing',
        raw: 'Context missing',
        source: 'base_decision',
        authorityRole: 'origin',
      },
    ])
    expect(record.attempt.snapshot.originalBaseReasons).toEqual(['base reason'])
    expect(record.attempt.snapshot.originalFinalReasons).toEqual(['final reason'])
    expect(record.executorResult.output).toEqual({ matchingChunkCount: 1 })
  })

  it('returns an existing attempt without recounting or inserting when the idempotency key already exists', async () => {
    const existing = buildRecord({ attemptNumber: 2 })
    const adapter: HeldRecoveryAttemptPersistenceAdapter = {
      findByIdempotencyKey: jest.fn(async () => existing),
      countAttemptsForSeries: jest.fn(async () => { throw new Error('count must not run for existing attempt') }),
      insertAttempt: jest.fn(async () => { throw new Error('insert must not run for existing attempt') }),
    }

    const result = await recordHeldRecoveryAttempt(adapter, {
      heldItem: heldItem(),
      executorInput: executorInput(),
      runtimeOutcome: runtimeOutcome(),
      trigger: 'system',
      nowIso: NOW,
    })

    expect(result).toEqual({ status: 'already_recorded', record: existing })
    expect(adapter.findByIdempotencyKey).toHaveBeenCalledTimes(1)
    expect(adapter.countAttemptsForSeries).not.toHaveBeenCalled()
    expect(adapter.insertAttempt).not.toHaveBeenCalled()
  })

  it('assigns the next attempt number within the same series before inserting a new record', async () => {
    const inserted: HeldRecoveryAttemptRecord[] = []
    const adapter: HeldRecoveryAttemptPersistenceAdapter = {
      findByIdempotencyKey: jest.fn(async () => null),
      countAttemptsForSeries: jest.fn(async () => 2),
      insertAttempt: jest.fn(async (record: HeldRecoveryAttemptRecord) => {
        inserted.push(record)
        return record
      }),
    }

    const result = await recordHeldRecoveryAttempt(adapter, {
      heldItem: heldItem(),
      executorInput: executorInput(),
      runtimeOutcome: runtimeOutcome(),
      trigger: 'request_reanalysis',
      nowIso: NOW,
    })

    expect(result.status).toBe('recorded')
    expect(inserted).toHaveLength(1)
    expect(inserted[0].attempt.attemptNumber).toBe(3)
    expect(inserted[0].attempt.snapshot.trigger).toBe('request_reanalysis')
    expect(adapter.countAttemptsForSeries).toHaveBeenCalledWith(inserted[0].attempt.seriesKey)
  })

  it('records deferred and rejected outcomes without scheduling retries or mutating downstream state', () => {
    const deferred = buildRecord({
      runtimeOutcome: {
        status: 'deferred',
        reason: 'llm_assisted_action_not_authorized',
        result: executionResult({ outcome: 'deferred_work', action: 'create_versioned_candidate_set', error: 'LLM_ASSISTED_NOT_AUTHORIZED' }),
      },
    })
    const rejected = buildRecord({
      runtimeOutcome: {
        status: 'rejected',
        reason: 'stale_authority',
        result: executionResult({ outcome: 'terminal_failure', error: 'STALE_OPPORTUNITY_VERSION' }),
      },
    })

    expect(deferred.attempt.status).toBe('held')
    expect(deferred.attempt.outcome).toBe('pending')
    expect(deferred.attempt.events.at(-1)?.event).toBe('action_failed')
    expect(rejected.attempt.status).toBe('recovery_attempt_failed_terminal')
    expect(rejected.attempt.outcome).toBe('failed_terminal')
    expect(rejected.runtimeRejectionReason).toBe('stale_authority')
    expect(rejected.attempt.events.at(-1)?.details).toMatchObject({ runtimeRejectionReason: 'stale_authority' })
  })
})

describe('held recovery attempt Supabase persistence adapter', () => {
  it('persists only to held_recovery_attempts and performs no queue, retry, ledger, candidate, manuscript, or Final Review mutations', async () => {
    const record = buildRecord()
    const fromCalls: string[] = []
    const forbiddenMutation = jest.fn(() => { throw new Error('forbidden mutation path') })
    const findChain = {
      select: jest.fn(() => findChain),
      eq: jest.fn(() => findChain),
      maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      update: forbiddenMutation,
      upsert: forbiddenMutation,
      delete: forbiddenMutation,
      rpc: forbiddenMutation,
    }
    const countChain = {
      select: jest.fn(() => countChain),
      eq: jest.fn(async () => ({ count: 0, error: null })),
      update: forbiddenMutation,
      upsert: forbiddenMutation,
      delete: forbiddenMutation,
      rpc: forbiddenMutation,
    }
    const insertChain = {
      insert: jest.fn(() => insertChain),
      select: jest.fn(() => insertChain),
      single: jest.fn(async () => ({
        data: {
          idempotency_key: record.idempotencyKey,
          held_item_id: record.heldItemId,
          opportunity_id: record.opportunityId,
          manuscript_id: record.manuscriptId,
          manuscript_version_sha: record.manuscriptVersionSha,
          held_item_persisted_version: record.heldItemPersistedVersion,
          runtime_outcome_status: record.runtimeOutcomeStatus,
          runtime_rejection_reason: record.runtimeRejectionReason ?? null,
          executor_result: record.executorResult,
          series_key: record.attempt.seriesKey,
          recovery_input_fingerprint: record.attempt.recoveryInputFingerprint,
          attempt_number: record.attempt.attemptNumber,
          max_attempts: record.attempt.maxAttempts,
          status: record.attempt.status,
          outcome: record.attempt.outcome,
          terminal_card_type: record.attempt.terminalCardType,
          terminal_trusted_path_status: record.attempt.terminalTrustedPathStatus,
          snapshot: record.attempt.snapshot,
          events: record.attempt.events,
          created_at: record.attempt.createdAt,
          updated_at: record.attempt.updatedAt,
        },
        error: null,
      })),
      update: forbiddenMutation,
      upsert: forbiddenMutation,
      delete: forbiddenMutation,
      rpc: forbiddenMutation,
    }
    const chains = [findChain, countChain, insertChain]
    const supabase = {
      from: jest.fn((table: string) => {
        fromCalls.push(table)
        const next = chains.shift()
        if (!next) throw new Error(`unexpected table read: ${table}`)
        return next
      }),
    }
    const adapter = createSupabaseHeldRecoveryAttemptPersistenceAdapter(supabase as never)

    expect(await adapter.findByIdempotencyKey(record.idempotencyKey)).toBeNull()
    expect(await adapter.countAttemptsForSeries(record.attempt.seriesKey)).toBe(0)
    await expect(adapter.insertAttempt(record)).resolves.toEqual(record)

    expect(fromCalls).toEqual(['held_recovery_attempts', 'held_recovery_attempts', 'held_recovery_attempts'])
    expect(insertChain.insert).toHaveBeenCalledTimes(1)
    expect(forbiddenMutation).not.toHaveBeenCalled()
  })
})