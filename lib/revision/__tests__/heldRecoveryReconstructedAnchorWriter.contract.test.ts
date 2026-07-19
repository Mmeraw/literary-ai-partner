import { describe, it, expect, jest } from '@jest/globals'
import {
  createSupabaseReconstructedAnchorInsertAdapter,
  normalizeReconstructedAnchorRequest,
  mapReconstructedAnchorResponse,
  ReconstructedAnchorRequestError,
  ReconstructedAnchorResponseError,
  type ReconstructedAnchorInsertRequest,
} from '@/lib/revision/heldRecoveryReconstructedAnchorWriter'

const validRequest: ReconstructedAnchorInsertRequest = {
  heldItemId: 'held-1',
  heldItemPersistedVersion: 'persisted-v1',
  expectedAuthorityVersion: 'authority-v1',
  completionFingerprint: 'fingerprint-1',
  opportunityId: 'opportunity-1',
  manuscriptId: '42',
  manuscriptVersionSha: 'sha-1',
  recoveryMethod: 'reconstructed_anchor',
  sourceHash: 'source-hash-1',
  sourceStartOffset: 10,
  sourceEndOffset: 20,
  evidenceAnchor: 'anchor-text',
  manuscriptCoordinates: 'coords-1',
}

/**
 * Minimal mocked Supabase client exposing only `rpc`. Returns whatever the test
 * configures and records the exact (fnName, args) it was called with.
 */
function mockSupabase(response: { data?: unknown; error?: { message: string } | null }) {
  const rpc = jest.fn(
    async (_fn: string, _args?: unknown) => ({
      data: response.data ?? null,
      error: response.error ?? null,
    }),
  )
  return { supabase: { rpc } as any, rpc }
}

describe('reconstructed-anchor writer — request normalization (fail closed before RPC)', () => {
  it('normalizes a valid request into the exact RPC key names', () => {
    expect(normalizeReconstructedAnchorRequest(validRequest)).toEqual({
      held_item_id: 'held-1',
      held_item_persisted_version: 'persisted-v1',
      expected_authority_version: 'authority-v1',
      completion_fingerprint: 'fingerprint-1',
      opportunity_id: 'opportunity-1',
      manuscript_id: '42',
      manuscript_version_sha: 'sha-1',
      recovery_method: 'reconstructed_anchor',
      source_hash: 'source-hash-1',
      source_start_offset: 10,
      source_end_offset: 20,
      evidence_anchor: 'anchor-text',
      manuscript_coordinates: 'coords-1',
    })
  })

  it('trims surrounding whitespace on string fields (mirrors RPC btrim)', () => {
    const normalized = normalizeReconstructedAnchorRequest({
      ...validRequest,
      heldItemId: '  held-1  ',
      evidenceAnchor: '\tanchor-text\n',
    })
    expect(normalized.held_item_id).toBe('held-1')
    expect(normalized.evidence_anchor).toBe('anchor-text')
  })

  it.each([
    ['heldItemId'],
    ['heldItemPersistedVersion'],
    ['expectedAuthorityVersion'],
    ['completionFingerprint'],
    ['opportunityId'],
    ['manuscriptVersionSha'],
    ['recoveryMethod'],
    ['sourceHash'],
    ['evidenceAnchor'],
    ['manuscriptCoordinates'],
  ] as const)('rejects blank string field %s', (field) => {
    expect(() =>
      normalizeReconstructedAnchorRequest({ ...validRequest, [field]: '   ' }),
    ).toThrow(ReconstructedAnchorRequestError)
  })

  it.each([
    ['sourceStartOffset'],
    ['sourceEndOffset'],
  ] as const)('rejects non-integer numeric field %s', (field) => {
    expect(() =>
      normalizeReconstructedAnchorRequest({ ...validRequest, [field]: 1.5 }),
    ).toThrow(ReconstructedAnchorRequestError)
    expect(() =>
      normalizeReconstructedAnchorRequest({ ...validRequest, [field]: Number.NaN }),
    ).toThrow(ReconstructedAnchorRequestError)
    expect(() =>
      normalizeReconstructedAnchorRequest({ ...validRequest, [field]: 'nope' as unknown as number }),
    ).toThrow(ReconstructedAnchorRequestError)
  })

  it('preserves manuscriptId verbatim as a canonical integer string (bigint fidelity)', () => {
    const big = '9223372036854775807' // max signed bigint — beyond JS safe integer range
    const normalized = normalizeReconstructedAnchorRequest({ ...validRequest, manuscriptId: big })
    expect(normalized.manuscript_id).toBe(big)
    expect(typeof normalized.manuscript_id).toBe('string')
  })

  it('trims surrounding whitespace on manuscriptId', () => {
    const normalized = normalizeReconstructedAnchorRequest({ ...validRequest, manuscriptId: '  42  ' })
    expect(normalized.manuscript_id).toBe('42')
  })

  it('accepts "0" as a canonical manuscriptId', () => {
    const normalized = normalizeReconstructedAnchorRequest({ ...validRequest, manuscriptId: '0' })
    expect(normalized.manuscript_id).toBe('0')
  })

  it.each([
    ['empty', '   '],
    ['leading zero', '007'],
    ['negative sign', '-5'],
    ['plus sign', '+5'],
    ['decimal', '4.0'],
    ['non-digit', '42abc'],
    ['thousands separator', '1,000'],
    ['float exponent', '1e3'],
  ] as const)('rejects non-canonical manuscriptId (%s)', (_label, value) => {
    expect(() =>
      normalizeReconstructedAnchorRequest({ ...validRequest, manuscriptId: value }),
    ).toThrow(ReconstructedAnchorRequestError)
  })

  it('rejects a numeric manuscriptId (must be a string at the boundary)', () => {
    expect(() =>
      normalizeReconstructedAnchorRequest({ ...validRequest, manuscriptId: 42 as unknown as string }),
    ).toThrow(ReconstructedAnchorRequestError)
  })

  it('does not call the RPC when the request is malformed', async () => {
    const { supabase, rpc } = mockSupabase({ data: { status: 'inserted' } })
    const adapter = createSupabaseReconstructedAnchorInsertAdapter(supabase)
    await expect(
      adapter.insertReconstructedAnchor({ ...validRequest, heldItemId: '' }),
    ).rejects.toBeInstanceOf(ReconstructedAnchorRequestError)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('reconstructed-anchor writer — RPC invocation contract', () => {
  it('calls the atomic RPC by name with the normalized p_request payload', async () => {
    const { supabase, rpc } = mockSupabase({
      data: {
        status: 'inserted',
        id: 'row-1',
        held_item_id: 'held-1',
        held_item_persisted_version: 'persisted-v1',
        completion_fingerprint: 'fingerprint-1',
      },
    })
    const adapter = createSupabaseReconstructedAnchorInsertAdapter(supabase)
    await adapter.insertReconstructedAnchor(validRequest)

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('insert_held_recovery_reconstructed_anchor_atomic', {
      p_request: normalizeReconstructedAnchorRequest(validRequest),
    })
  })

  it('throws when the Supabase client returns an error', async () => {
    const { supabase } = mockSupabase({ error: { message: 'permission denied' } })
    const adapter = createSupabaseReconstructedAnchorInsertAdapter(supabase)
    await expect(adapter.insertReconstructedAnchor(validRequest)).rejects.toThrow(
      /Failed to insert Held Recovery reconstructed anchor: permission denied/,
    )
  })
})

describe('reconstructed-anchor writer — five-outcome mapping', () => {
  it('maps inserted with the authority row', () => {
    expect(
      mapReconstructedAnchorResponse({
        status: 'inserted',
        id: 'row-1',
        held_item_id: 'held-1',
        held_item_persisted_version: 'persisted-v1',
        completion_fingerprint: 'fingerprint-1',
      }),
    ).toEqual({
      status: 'inserted',
      row: {
        id: 'row-1',
        heldItemId: 'held-1',
        heldItemPersistedVersion: 'persisted-v1',
        completionFingerprint: 'fingerprint-1',
      },
    })
  })

  it('maps already_applied with the authority row', () => {
    expect(
      mapReconstructedAnchorResponse({
        status: 'already_applied',
        id: 'row-1',
        held_item_id: 'held-1',
        held_item_persisted_version: 'persisted-v1',
        completion_fingerprint: 'fingerprint-1',
      }),
    ).toMatchObject({ status: 'already_applied', row: { id: 'row-1' } })
  })

  it('maps rejected_conflict with both fingerprints', () => {
    expect(
      mapReconstructedAnchorResponse({
        status: 'rejected_conflict',
        held_item_id: 'held-1',
        held_item_persisted_version: 'persisted-v1',
        existing_completion_fingerprint: 'fp-existing',
        submitted_completion_fingerprint: 'fp-submitted',
      }),
    ).toEqual({
      status: 'rejected_conflict',
      heldItemId: 'held-1',
      heldItemPersistedVersion: 'persisted-v1',
      existingCompletionFingerprint: 'fp-existing',
      submittedCompletionFingerprint: 'fp-submitted',
    })
  })

  it('maps rejected_stale with expected and actual authority versions', () => {
    expect(
      mapReconstructedAnchorResponse({
        status: 'rejected_stale',
        held_item_id: 'held-1',
        expected_authority_version: 'authority-v1',
        actual_authority_version: 'authority-v2',
      }),
    ).toEqual({
      status: 'rejected_stale',
      heldItemId: 'held-1',
      expectedAuthorityVersion: 'authority-v1',
      actualAuthorityVersion: 'authority-v2',
    })
  })

  it('maps rejected_stale with a null actual authority version', () => {
    expect(
      mapReconstructedAnchorResponse({
        status: 'rejected_stale',
        held_item_id: 'held-1',
        expected_authority_version: 'authority-v1',
        actual_authority_version: null,
      }),
    ).toMatchObject({ status: 'rejected_stale', actualAuthorityVersion: null })
  })

  it('maps rejected_missing', () => {
    expect(
      mapReconstructedAnchorResponse({ status: 'rejected_missing', held_item_id: 'held-1' }),
    ).toEqual({ status: 'rejected_missing', heldItemId: 'held-1' })
  })
})

describe('reconstructed-anchor writer — fail closed on malformed/unknown responses', () => {
  it('throws on an unknown status', () => {
    expect(() => mapReconstructedAnchorResponse({ status: 'exploded' })).toThrow(
      ReconstructedAnchorResponseError,
    )
  })

  it('throws when status is missing entirely', () => {
    expect(() => mapReconstructedAnchorResponse({ id: 'row-1' })).toThrow(
      ReconstructedAnchorResponseError,
    )
  })

  it('throws when the response is not an object', () => {
    expect(() => mapReconstructedAnchorResponse(null)).toThrow(ReconstructedAnchorResponseError)
    expect(() => mapReconstructedAnchorResponse('inserted')).toThrow(
      ReconstructedAnchorResponseError,
    )
    expect(() => mapReconstructedAnchorResponse([{ status: 'inserted' }])).toThrow(
      ReconstructedAnchorResponseError,
    )
  })

  it('throws when a success response is missing the authority row id', () => {
    expect(() =>
      mapReconstructedAnchorResponse({
        status: 'inserted',
        held_item_id: 'held-1',
        held_item_persisted_version: 'persisted-v1',
        completion_fingerprint: 'fingerprint-1',
      }),
    ).toThrow(ReconstructedAnchorResponseError)
  })

  it('throws when rejected_conflict omits a fingerprint', () => {
    expect(() =>
      mapReconstructedAnchorResponse({
        status: 'rejected_conflict',
        held_item_id: 'held-1',
        held_item_persisted_version: 'persisted-v1',
        existing_completion_fingerprint: 'fp-existing',
      }),
    ).toThrow(ReconstructedAnchorResponseError)
  })

  it('propagates a malformed RPC response as a thrown error through the adapter', async () => {
    const { supabase } = mockSupabase({ data: { status: 'nonsense' } })
    const adapter = createSupabaseReconstructedAnchorInsertAdapter(supabase)
    await expect(adapter.insertReconstructedAnchor(validRequest)).rejects.toBeInstanceOf(
      ReconstructedAnchorResponseError,
    )
  })
})
