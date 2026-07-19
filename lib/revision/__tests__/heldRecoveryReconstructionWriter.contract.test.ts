import { describe, it, expect, jest } from '@jest/globals'
import {
  createSupabaseHeldRecoveryReconstructionPersistenceAdapter,
  ReconstructionPersistenceContractError,
  type AnchorReconstructionContinuation,
  type CanonicalDeferredAttemptRecord,
} from '@/lib/revision/heldRecoveryReconstructionWriter'

// 2^53 + 1 — the first integer a JS number cannot represent exactly. Any numeric
// coercion of this manuscript id would collapse it to 9007199254740992.
const BIG_MANUSCRIPT_ID = '9007199254740993'

function continuation(): AnchorReconstructionContinuation {
  return {
    sourceHash: 'source-hash-1',
    sourceStartOffset: 10,
    sourceEndOffset: 42,
    recoveryMethod: 'source_text_location_only',
  }
}

function attempt(
  overrides: Partial<CanonicalDeferredAttemptRecord> = {},
): CanonicalDeferredAttemptRecord {
  return {
    idempotencyKey: 'idem-1',
    heldItemId: 'held-1',
    opportunityId: 'op-1',
    manuscriptId: BIG_MANUSCRIPT_ID,
    manuscriptVersionSha: 'msha-1',
    heldItemPersistedVersion: 'hv-1',
    runtimeOutcomeStatus: 'deferred',
    executorResult: { kind: 'deferred_work', code: 'ANCHOR_RECONSTRUCTION_REQUIRED' },
    seriesKey: { a: 1 },
    recoveryInputFingerprint: 'fp-1',
    attemptNumber: 1,
    maxAttempts: 3,
    status: 'held',
    outcome: 'pending',
    snapshot: { s: 1 },
    ...overrides,
  }
}

function rpcMock(handler: (name: string, params: unknown) => { data: unknown; error: unknown }) {
  const calls: Array<{ name: string; params: unknown }> = []
  const supabase = {
    rpc: jest.fn(async (name: string, params: unknown) => {
      calls.push({ name, params })
      return handler(name, params)
    }),
    // A .from must never be reached: this adapter is RPC-only.
    from: jest.fn(() => {
      throw new Error('adapter must be RPC-only; .from() is forbidden')
    }),
  }
  return { supabase, calls }
}

describe('held recovery reconstruction writer — manuscript identity fidelity', () => {
  it('sends manuscript_id as the exact canonical string (incl. > 2^53) to the enqueue RPC', async () => {
    const { supabase, calls } = rpcMock(() => ({
      data: { status: 'enqueued', attempt_id: 'a1', work_item_id: 'w1' },
      error: null,
    }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)

    const result = await adapter.recordDeferredAttemptAndEnqueue({
      attempt: attempt(),
      continuation: continuation(),
    })

    expect(result).toEqual({
      status: 'enqueued',
      attemptId: 'a1',
      workItemId: 'w1',
      workItemStatus: 'pending',
    })
    const sent = (calls[0].params as { p_request: { attempt: { manuscript_id: unknown } } }).p_request
      .attempt.manuscript_id
    expect(typeof sent).toBe('string')
    expect(sent).toBe(BIG_MANUSCRIPT_ID)
  })

  it('reads manuscript_id from claim RPC as an exact canonical string (no Number coercion)', async () => {
    const { supabase } = rpcMock(() => ({
      data: {
        status: 'claimed',
        work_item_id: 'w1',
        claim_token: 't1',
        claimed_by: 'worker-1',
        lease_expires_at: '2026-07-19T00:00:00.000Z',
        attempt_count: 1,
        held_item_id: 'held-1',
        opportunity_id: 'op-1',
        manuscript_id: BIG_MANUSCRIPT_ID,
        manuscript_version_sha: 'msha-1',
        held_item_persisted_version: 'hv-1',
        source_hash: 'source-hash-1',
        source_start_offset: 10,
        source_end_offset: 42,
        recovery_method: 'source_text_location_only',
      },
      error: null,
    }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)

    const result = await adapter.claimNext({ workerId: 'worker-1', leaseSeconds: 30 })
    expect(result.status).toBe('claimed')
    if (result.status !== 'claimed') throw new Error('unreachable')
    expect(typeof result.work.manuscriptId).toBe('string')
    expect(result.work.manuscriptId).toBe(BIG_MANUSCRIPT_ID)
    // A numeric round-trip would have corrupted the identity.
    expect(Number(result.work.manuscriptId).toString()).not.toBe(result.work.manuscriptId)
  })

  it('returns the completed authority manuscript_id as an exact canonical string', async () => {
    const { supabase } = rpcMock(() => ({
      data: {
        status: 'completed',
        work_item_id: 'w1',
        manuscript_id: BIG_MANUSCRIPT_ID,
        manuscript_version_sha: 'msha-1',
        held_item_persisted_version: 'hv-1',
        source_hash: 'source-hash-1',
        source_start_offset: 10,
        source_end_offset: 42,
        recovery_method: 'source_text_location_only',
      },
      error: null,
    }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)

    const result = await adapter.complete({
      workItemId: 'w1',
      claimToken: 't1',
      manuscriptVersionSha: 'msha-1',
      heldItemPersistedVersion: 'hv-1',
      completionFingerprint: 'fp-1',
    })
    expect(result.status).toBe('completed')
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(result.authority.manuscriptId).toBe(BIG_MANUSCRIPT_ID)
  })

  it('rejects a non-canonical manuscript id in the enqueue input (never repairs / coerces)', async () => {
    const { supabase } = rpcMock(() => ({ data: { status: 'enqueued' }, error: null }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)

    for (const bad of ['01', ' 1', '+1', '1.0', '1e3', '-1', '', 'abc']) {
      await expect(
        adapter.recordDeferredAttemptAndEnqueue({
          attempt: attempt({ manuscriptId: bad }),
          continuation: continuation(),
        }),
      ).rejects.toBeInstanceOf(ReconstructionPersistenceContractError)
    }
    // A numeric id must be rejected outright (typed as string, but proven at runtime).
    await expect(
      adapter.recordDeferredAttemptAndEnqueue({
        attempt: attempt({ manuscriptId: 77 as unknown as string }),
        continuation: continuation(),
      }),
    ).rejects.toBeInstanceOf(ReconstructionPersistenceContractError)
  })

  it('fails closed if the claim RPC returns a numeric manuscript_id (no silent Number path)', async () => {
    const { supabase } = rpcMock(() => ({
      data: {
        status: 'claimed',
        work_item_id: 'w1',
        claim_token: 't1',
        claimed_by: 'worker-1',
        lease_expires_at: '2026-07-19T00:00:00.000Z',
        attempt_count: 1,
        held_item_id: 'held-1',
        opportunity_id: 'op-1',
        // eslint-disable-next-line no-loss-of-precision -- intentionally a numeric (not string) manuscript_id; the exact value is irrelevant, we only prove the numeric type is rejected.
        manuscript_id: 9007199254740993, // numeric — must be rejected
        manuscript_version_sha: 'msha-1',
        held_item_persisted_version: 'hv-1',
        source_hash: 'source-hash-1',
        source_start_offset: 10,
        source_end_offset: 42,
        recovery_method: 'source_text_location_only',
      },
      error: null,
    }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)
    await expect(adapter.claimNext({ workerId: 'worker-1', leaseSeconds: 30 })).rejects.toBeInstanceOf(
      ReconstructionPersistenceContractError,
    )
  })
})

describe('held recovery reconstruction writer — contract / fail-closed behavior', () => {
  it('preserves the completion idempotency_conflict union', async () => {
    const { supabase } = rpcMock(() => ({
      data: { status: 'idempotency_conflict', reason: 'completion_fingerprint_mismatch' },
      error: null,
    }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)
    const result = await adapter.complete({
      workItemId: 'w1',
      claimToken: 't1',
      manuscriptVersionSha: 'msha-1',
      heldItemPersistedVersion: 'hv-1',
      completionFingerprint: 'fp-1',
    })
    expect(result).toEqual({
      status: 'idempotency_conflict',
      reason: 'completion_fingerprint_mismatch',
    })
  })

  it('throws on a malformed (non-object) RPC payload', async () => {
    const { supabase } = rpcMock(() => ({ data: ['not', 'an', 'object'], error: null }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)
    await expect(adapter.claimNext({ workerId: 'w', leaseSeconds: 10 })).rejects.toBeInstanceOf(
      ReconstructionPersistenceContractError,
    )
  })

  it('fails closed on an unknown RPC status', async () => {
    const { supabase } = rpcMock(() => ({ data: { status: 'teleported' }, error: null }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)
    await expect(adapter.claimNext({ workerId: 'w', leaseSeconds: 10 })).rejects.toBeInstanceOf(
      ReconstructionPersistenceContractError,
    )
  })

  it('is RPC-only: the enqueue path never touches .from()', async () => {
    const { supabase } = rpcMock(() => ({
      data: { status: 'enqueued', attempt_id: 'a1', work_item_id: 'w1' },
      error: null,
    }))
    const adapter = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase as never)
    await adapter.recordDeferredAttemptAndEnqueue({ attempt: attempt(), continuation: continuation() })
    expect((supabase.from as jest.Mock)).not.toHaveBeenCalled()
    expect((supabase.rpc as jest.Mock)).toHaveBeenCalledTimes(1)
  })
})
