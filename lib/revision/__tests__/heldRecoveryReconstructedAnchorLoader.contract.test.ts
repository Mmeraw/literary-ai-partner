import { jest } from '@jest/globals'
import {
  createSupabaseReconstructedAnchorLoader,
  mapReconstructedAnchorLoadResponse,
  ReconstructedAnchorLoadContractError,
} from '@/lib/revision/heldRecoveryReconstructedAnchorLoader'

const loadedRow = {
  status: 'loaded',
  id: 'row-1',
  held_item_id: 'held-1',
  opportunity_id: 'opportunity-1',
  manuscript_id_text: '9007199254740993',
  manuscript_version_sha: 'manuscript-sha',
  held_item_persisted_version: 'held-version-1',
  completion_fingerprint: 'completion-fingerprint',
  recovery_method: 'source_text_location_only',
  source_hash: 'source-hash',
  source_start_offset: 10,
  source_end_offset: 20,
  evidence_anchor: 'canonical reconstructed evidence',
  manuscript_coordinates: 'chapter 2, paragraph 4',
}

describe('reconstructed-anchor loader mapping', () => {
  it('maps the complete canonical authority without numeric manuscript coercion', () => {
    const result = mapReconstructedAnchorLoadResponse(loadedRow)
    expect(result).toEqual({
      status: 'loaded',
      value: {
        id: 'row-1',
        heldItemId: 'held-1',
        opportunityId: 'opportunity-1',
        manuscriptId: '9007199254740993',
        manuscriptVersionSha: 'manuscript-sha',
        heldItemPersistedVersion: 'held-version-1',
        completionFingerprint: 'completion-fingerprint',
        recoveryMethod: 'source_text_location_only',
        sourceHash: 'source-hash',
        sourceStartOffset: 10,
        sourceEndOffset: 20,
        evidenceAnchor: 'canonical reconstructed evidence',
        manuscriptCoordinates: 'chapter 2, paragraph 4',
      },
    })
    expect(result.status === 'loaded' && typeof result.value.manuscriptId).toBe('string')
  })

  it('maps missing without fabricating content', () => {
    expect(mapReconstructedAnchorLoadResponse({ status: 'missing' })).toEqual({ status: 'missing' })
  })

  it.each([
    null,
    [],
    { status: 'unknown' },
    { ...loadedRow, manuscript_id_text: 42 },
    { ...loadedRow, manuscript_id_text: '09007199254740993' },
    { ...loadedRow, recovery_method: 'invented' },
    { ...loadedRow, source_end_offset: 10 },
    { ...loadedRow, evidence_anchor: '' },
  ])('fails closed on malformed response %#', (row) => {
    expect(() => mapReconstructedAnchorLoadResponse(row)).toThrow(
      ReconstructedAnchorLoadContractError,
    )
  })
})

describe('reconstructed-anchor loader RPC boundary', () => {
  it('calls the read RPC once with identity only', async () => {
    const rpc = jest.fn(async () => ({ data: loadedRow, error: null }))
    const loader = createSupabaseReconstructedAnchorLoader({ rpc } as never)
    await expect(
      loader({ heldItemId: 'held-1', heldItemPersistedVersion: 'held-version-1' }),
    ).resolves.toMatchObject({ status: 'loaded' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('get_held_recovery_reconstructed_anchor', {
      p_held_item_id: 'held-1',
      p_held_item_persisted_version: 'held-version-1',
    })
  })

  it('does not call the RPC for a malformed key', async () => {
    const rpc = jest.fn()
    const loader = createSupabaseReconstructedAnchorLoader({ rpc } as never)
    await expect(
      loader({ heldItemId: '', heldItemPersistedVersion: 'held-version-1' }),
    ).rejects.toBeInstanceOf(ReconstructedAnchorLoadContractError)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fails closed on an RPC error', async () => {
    const rpc = jest.fn(async () => ({ data: null, error: { message: 'permission denied' } }))
    const loader = createSupabaseReconstructedAnchorLoader({ rpc } as never)
    await expect(
      loader({ heldItemId: 'held-1', heldItemPersistedVersion: 'held-version-1' }),
    ).rejects.toThrow(/permission denied/)
  })
})
