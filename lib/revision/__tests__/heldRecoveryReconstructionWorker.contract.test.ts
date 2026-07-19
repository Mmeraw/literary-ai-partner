import { describe, it, expect, jest } from '@jest/globals'
import {
  runHeldRecoveryReconstructionWorkerOnce,
  fingerprintReconstructedAnchorAuthority,
  isHeldRecoveryReconstructionWorkerEnabled,
  HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG,
  ReconstructionFailureError,
  type HeldRecoveryReconstructionWorkerDependencies,
  type ReconstructedAnchorLocation,
} from '@/lib/revision/heldRecoveryReconstructionWorker'
import type {
  ClaimedReconstructionWork,
  HeldRecoveryReconstructionPersistenceAdapter,
} from '@/lib/revision/heldRecoveryReconstructionWriter'

// 2^53 + 1 — the first integer a JS number cannot represent exactly.
const BIG_MANUSCRIPT_ID = '9007199254740993'

function claimedWork(overrides: Partial<ClaimedReconstructionWork> = {}): ClaimedReconstructionWork {
  return {
    workItemId: 'w1',
    claimToken: 't1',
    claimedBy: 'worker-1',
    leaseExpiresAt: '2026-07-19T00:00:30.000Z',
    attemptCount: 1,
    heldItemId: 'held-1',
    opportunityId: 'op-1',
    manuscriptId: BIG_MANUSCRIPT_ID,
    manuscriptVersionSha: 'msha-1',
    heldItemPersistedVersion: 'hv-1',
    sourceHash: 'source-hash-1',
    sourceStartOffset: 10,
    sourceEndOffset: 42,
    recoveryMethod: 'source_text_location_only',
    ...overrides,
  }
}

function location(overrides: Partial<ReconstructedAnchorLocation> = {}): ReconstructedAnchorLocation {
  return {
    sourceHash: 'source-hash-1',
    sourceStartOffset: 10,
    sourceEndOffset: 42,
    recoveryMethod: 'source_text_location_only',
    ...overrides,
  }
}

/**
 * Fully-stubbed adapter. Every method throws by default so any unexpected call
 * fails the test loudly; individual tests override only what they exercise.
 */
function stubAdapter(
  overrides: Partial<HeldRecoveryReconstructionPersistenceAdapter> = {},
): HeldRecoveryReconstructionPersistenceAdapter {
  const forbid = (name: string) =>
    jest.fn(async () => {
      throw new Error(`unexpected adapter call: ${name}`)
    })
  return {
    recordDeferredAttemptAndEnqueue: forbid('recordDeferredAttemptAndEnqueue') as never,
    claimNext: forbid('claimNext') as never,
    renewLease: forbid('renewLease') as never,
    complete: forbid('complete') as never,
    failTerminal: forbid('failTerminal') as never,
    supersede: forbid('supersede') as never,
    ...overrides,
  }
}

function deps(
  overrides: Partial<HeldRecoveryReconstructionWorkerDependencies> = {},
): HeldRecoveryReconstructionWorkerDependencies {
  return {
    persistence: stubAdapter(),
    reconstructAnchorAuthority: jest.fn(async () => location()) as never,
    workerId: 'worker-1',
    leaseSeconds: 30,
    renewalIntervalMs: 5_000,
    enabled: true,
    ...overrides,
  }
}

describe('held recovery reconstruction worker — default-off feature flag', () => {
  it('is disabled unless the flag is exactly "true"', () => {
    expect(isHeldRecoveryReconstructionWorkerEnabled({})).toBe(false)
    expect(
      isHeldRecoveryReconstructionWorkerEnabled({
        [HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG]: 'false',
      }),
    ).toBe(false)
    expect(
      isHeldRecoveryReconstructionWorkerEnabled({
        [HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG]: '1',
      }),
    ).toBe(false)
    expect(
      isHeldRecoveryReconstructionWorkerEnabled({
        [HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG]: 'true',
      }),
    ).toBe(true)
  })

  it('is a STRICT no-op when disabled: returns { status: disabled } and never touches persistence', async () => {
    const persistence = stubAdapter()
    const reconstruct = jest.fn(async () => location())
    const result = await runHeldRecoveryReconstructionWorkerOnce(
      deps({ persistence, reconstructAnchorAuthority: reconstruct as never, enabled: false }),
    )

    expect(result).toEqual({ status: 'disabled' })
    expect(persistence.claimNext).not.toHaveBeenCalled()
    expect(persistence.complete).not.toHaveBeenCalled()
    expect(reconstruct).not.toHaveBeenCalled()
  })

  it('defaults to disabled (no explicit enabled flag, env unset) — strict no-op', async () => {
    const prev = process.env[HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG]
    delete process.env[HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG]
    try {
      const persistence = stubAdapter()
      const d = deps({ persistence })
      // Remove the explicit override so it falls through to the env-based default.
      const { enabled: _drop, ...rest } = d
      const result = await runHeldRecoveryReconstructionWorkerOnce(
        rest as HeldRecoveryReconstructionWorkerDependencies,
      )
      expect(result).toEqual({ status: 'disabled' })
      expect(persistence.claimNext).not.toHaveBeenCalled()
    } finally {
      if (prev === undefined) delete process.env[HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG]
      else process.env[HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG] = prev
    }
  })
})

describe('held recovery reconstruction worker — single-iteration flow', () => {
  it('returns idle when no work is available (and does not reconstruct)', async () => {
    const reconstruct = jest.fn(async () => location())
    const persistence = stubAdapter({
      claimNext: jest.fn(async () => ({ status: 'no_work_available' })) as never,
    })
    const result = await runHeldRecoveryReconstructionWorkerOnce(
      deps({ persistence, reconstructAnchorAuthority: reconstruct as never }),
    )
    expect(result).toEqual({ status: 'idle' })
    expect(reconstruct).not.toHaveBeenCalled()
  })

  it('claims -> reconstructs -> completes, carrying the > 2^53 manuscript id as a string', async () => {
    const completeArgs: unknown[] = []
    const persistence = stubAdapter({
      claimNext: jest.fn(async () => ({ status: 'claimed', work: claimedWork() })) as never,
      complete: jest.fn(async (input: unknown) => {
        completeArgs.push(input)
        return {
          status: 'completed',
          authority: {
            workItemId: 'w1',
            manuscriptId: BIG_MANUSCRIPT_ID,
            manuscriptVersionSha: 'msha-1',
            heldItemPersistedVersion: 'hv-1',
            sourceHash: 'source-hash-1',
            sourceStartOffset: 10,
            sourceEndOffset: 42,
            recoveryMethod: 'source_text_location_only',
          },
        }
      }) as never,
    })

    const result = await runHeldRecoveryReconstructionWorkerOnce(
      deps({ persistence, reconstructAnchorAuthority: jest.fn(async () => location()) as never }),
    )

    expect(result.status).toBe('completed')
    if (result.status !== 'completed') throw new Error('unreachable')
    expect(typeof result.authority.manuscriptId).toBe('string')
    expect(result.authority.manuscriptId).toBe(BIG_MANUSCRIPT_ID)
    // A numeric round-trip would have corrupted the identity.
    expect(Number(result.authority.manuscriptId).toString()).not.toBe(result.authority.manuscriptId)
    // The worker completes using the CLAIMED canonical versions.
    expect(completeArgs[0]).toMatchObject({
      workItemId: 'w1',
      claimToken: 't1',
      manuscriptVersionSha: 'msha-1',
      heldItemPersistedVersion: 'hv-1',
    })
  })

  it('fingerprint is deterministic and derived from the STRING manuscript id (no numeric collapse)', () => {
    const base = {
      manuscriptId: BIG_MANUSCRIPT_ID,
      manuscriptVersionSha: 'msha-1',
      heldItemPersistedVersion: 'hv-1',
      sourceHash: 'source-hash-1',
      sourceStartOffset: 10,
      sourceEndOffset: 42,
      recoveryMethod: 'source_text_location_only' as const,
    }
    const a = fingerprintReconstructedAnchorAuthority(base)
    const b = fingerprintReconstructedAnchorAuthority({ ...base })
    expect(a).toBe(b)
    // The precision-colliding neighbour must yield a DIFFERENT fingerprint, proving
    // the id is hashed as its exact string and never coerced to a JS number.
    const neighbour = fingerprintReconstructedAnchorAuthority({
      ...base,
      manuscriptId: '9007199254740992',
    })
    expect(neighbour).not.toBe(a)
  })

  it('a modeled terminal reconstruction failure fails the item terminally (never retried)', async () => {
    const failArgs: unknown[] = []
    const persistence = stubAdapter({
      claimNext: jest.fn(async () => ({ status: 'claimed', work: claimedWork() })) as never,
      failTerminal: jest.fn(async (input: unknown) => {
        failArgs.push(input)
        return { status: 'failed_terminal', workItemId: 'w1', terminalReason: 'anchor_not_locatable' }
      }) as never,
    })
    const reconstruct = jest.fn(async () => {
      throw new ReconstructionFailureError({ kind: 'terminal', reason: 'anchor_not_locatable' })
    })

    const result = await runHeldRecoveryReconstructionWorkerOnce(
      deps({ persistence, reconstructAnchorAuthority: reconstruct as never }),
    )

    expect(result).toEqual({
      status: 'failed_terminal',
      workItemId: 'w1',
      reason: 'anchor_not_locatable',
    })
    expect(failArgs[0]).toMatchObject({ workItemId: 'w1', claimToken: 't1' })
  })

  it('an unknown reconstruction exception fails terminally with a sanitized code (no stack leak)', async () => {
    let sentReason: string | undefined
    const persistence = stubAdapter({
      claimNext: jest.fn(async () => ({ status: 'claimed', work: claimedWork() })) as never,
      failTerminal: jest.fn(async (input: { terminalReason: string }) => {
        sentReason = input.terminalReason
        return { status: 'failed_terminal', workItemId: 'w1', terminalReason: input.terminalReason }
      }) as never,
    })
    const reconstruct = jest.fn(async () => {
      throw new Error('kaboom\n    at somewhere (secret.ts:42:1)')
    })

    const result = await runHeldRecoveryReconstructionWorkerOnce(
      deps({ persistence, reconstructAnchorAuthority: reconstruct as never }),
    )

    expect(result.status).toBe('failed_terminal')
    expect(sentReason).toBe('reconstruction_failed_unknown_error')
    // The raw message / stack trace is never persisted as the terminal reason.
    expect(sentReason).not.toContain('kaboom')
    expect(sentReason).not.toContain('secret.ts')
  })

  it('a stale completion (canonical_version_moved) supersedes the item', async () => {
    const persistence = stubAdapter({
      claimNext: jest.fn(async () => ({ status: 'claimed', work: claimedWork() })) as never,
      complete: jest.fn(async () => ({
        status: 'rejected_stale',
        reason: 'canonical_version_moved',
      })) as never,
      supersede: jest.fn(async () => ({
        status: 'superseded',
        workItemId: 'w1',
        terminalReason: 'canonical_version_moved',
      })) as never,
    })

    const result = await runHeldRecoveryReconstructionWorkerOnce(deps({ persistence }))

    expect(result).toEqual({
      status: 'superseded',
      workItemId: 'w1',
      reason: 'canonical_version_moved',
    })
  })

  it('a completion idempotency conflict fails the item terminally', async () => {
    const persistence = stubAdapter({
      claimNext: jest.fn(async () => ({ status: 'claimed', work: claimedWork() })) as never,
      complete: jest.fn(async () => ({
        status: 'idempotency_conflict',
        reason: 'completion_fingerprint_mismatch',
      })) as never,
      failTerminal: jest.fn(async () => ({
        status: 'failed_terminal',
        workItemId: 'w1',
        terminalReason: 'completion_fingerprint_mismatch',
      })) as never,
    })

    const result = await runHeldRecoveryReconstructionWorkerOnce(deps({ persistence }))

    expect(result.status).toBe('failed_terminal')
    if (result.status !== 'failed_terminal') throw new Error('unreachable')
    expect(result.reason).toBe('completion_fingerprint_mismatch')
  })

  it('a lost lease on completion is surfaced as lease_lost (no terminal write)', async () => {
    const persistence = stubAdapter({
      claimNext: jest.fn(async () => ({ status: 'claimed', work: claimedWork() })) as never,
      complete: jest.fn(async () => ({ status: 'lease_lost' })) as never,
    })

    const result = await runHeldRecoveryReconstructionWorkerOnce(deps({ persistence }))

    expect(result).toEqual({ status: 'lease_lost', workItemId: 'w1' })
  })
})
