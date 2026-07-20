import { jest } from '@jest/globals'
import { completeHeldRecoveryProductionAuthority } from '@/lib/revision/heldRecoveryProductionCompletionAuthority'
import { decideHeldQueueTransitionFromAuthority } from '@/lib/revision/heldRecoveryQueueTransitionPolicy'

const identity = {
  jobId: 'job-proof-1',
  heldItemId: 'held-1',
  opportunityId: 'opportunity-1',
  manuscriptId: '9007199254740993',
  userId: 'proof-user',
}

function workbench(count = 1) {
  const opportunity = {
    id: identity.opportunityId,
    finalDecision: { cardType: 'copy_paste_rewrite', reasons: [] },
  }
  return {
    ok: true,
    error: null,
    opportunities: count === 0 ? [] : Array.from({ length: count }, () => opportunity),
    needsTargeting: [],
    withheldUnsupported: [],
  } as never
}

describe('Held Recovery production completion authority', () => {
  it('uses the canonical state machine for reconstruction completion edges', () => {
    expect(decideHeldQueueTransitionFromAuthority({
      from: 'recovery_attempt_running',
      requestedTo: 'recovered_pending_reclassification',
      authorityVersion: 'authority-1',
    })).toMatchObject({ allowed: true })
    expect(decideHeldQueueTransitionFromAuthority({
      from: 'recovery_attempt_running',
      requestedTo: 'reclassified',
      authorityVersion: 'authority-1',
    })).toMatchObject({
      allowed: false,
      reason: 'canonical_state_machine_denies_transition',
    })
  })

  it('does not transition when Readmission did not verify canonical authority', async () => {
    const loadQueueAuthority = jest.fn(async () => null)
    const result = await completeHeldRecoveryProductionAuthority({
      ...identity,
      readmission: { status: 'rejected_stale', reason: 'reconstruction_missing' },
    }, { loadQueueAuthority })
    expect(result).toEqual({
      status: 'readmission_not_authoritative',
      readmissionStatus: 'rejected_stale',
    })
    expect(loadQueueAuthority).not.toHaveBeenCalled()
  })

  it('moves running through recovered-pending to reclassified after one terminal Workbench projection', async () => {
    const writes: any[] = []
    const applyTransition = jest.fn(async (record: any) => {
      writes.push(record)
      return { status: 'applied' as const, record }
    })
    const result = await completeHeldRecoveryProductionAuthority({
      ...identity,
      readmission: {
        status: 'admitted',
        opportunityVersion: 'op-version',
        anchorChanged: true,
        admission: { admission_status: 'admission_passed', passedCandidateCount: 3 } as never,
      },
    }, {
      supabase: {} as never,
      loadQueueAuthority: async () => ({ state: 'recovery_attempt_running', authorityVersion: 'authority-1' }),
      applyTransition: applyTransition as never,
      loadWorkbench: async () => workbench(),
    })
    expect(result).toMatchObject({ status: 'reclassified', finalCardType: 'copy_paste_rewrite' })
    expect(writes.map((write) => [write.from, write.to])).toEqual([
      ['recovery_attempt_running', 'recovered_pending_reclassification'],
      ['recovered_pending_reclassification', 'reclassified'],
    ])
    expect(writes[1].decisionAuthorityVersion).toBe(writes[0].nextAuthorityVersion)
  })

  it('fails closed before terminal transition when Workbench authority is absent or duplicated', async () => {
    for (const count of [0, 2]) {
      const applyTransition = jest.fn(async (record: any) => ({ status: 'applied' as const, record }))
      await expect(completeHeldRecoveryProductionAuthority({
        ...identity,
        readmission: {
          status: 'unchanged',
          opportunityVersion: 'op-version',
          admission: { admission_status: 'admission_passed', passedCandidateCount: 3 } as never,
        },
      }, {
        supabase: {} as never,
        loadQueueAuthority: async () => ({ state: 'recovery_attempt_running', authorityVersion: 'authority-1' }),
        applyTransition,
        loadWorkbench: async () => workbench(count),
      })).rejects.toThrow(/Workbench authority count/)
      expect(applyTransition).toHaveBeenCalledTimes(1)
    }
  })

  it('replay from reclassified performs no write and verifies the same Workbench identity', async () => {
    const applyTransition = jest.fn()
    const result = await completeHeldRecoveryProductionAuthority({
      ...identity,
      readmission: {
        status: 'unchanged',
        opportunityVersion: 'op-version',
        admission: { admission_status: 'admission_passed', passedCandidateCount: 3 } as never,
      },
    }, {
      supabase: {} as never,
      loadQueueAuthority: async () => ({ state: 'reclassified', authorityVersion: 'authority-final' }),
      applyTransition: applyTransition as never,
      loadWorkbench: async () => workbench(),
    })
    expect(result).toEqual({ status: 'already_reclassified', finalCardType: 'copy_paste_rewrite' })
    expect(applyTransition).not.toHaveBeenCalled()
  })
})
