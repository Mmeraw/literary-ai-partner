import fs from 'node:fs'
import path from 'node:path'

import {
  createSupabaseHeldRecoveryAnchorCasPersistenceAdapter,
  AnchorCasPersistenceContractError,
} from '@/lib/revision/heldRecoveryAnchorCasWriter'

function makeSupabase(response: { data?: unknown; error?: { message: string } | null }) {
  const rpc = jest.fn().mockResolvedValue({ data: response.data ?? null, error: response.error ?? null })
  return { rpc }
}

const VALID_INPUT = {
  jobId: 'job-1',
  opportunityId: 'workbench:1',
  expectedLedgerSourceHash: 'rol:hash',
  expectedAnchorFingerprint: 'fp-current',
  newEvidenceAnchor: 'new anchor',
  newManuscriptCoordinates: 'p:1',
}

describe('held recovery anchor CAS writer (adapter)', () => {
  it('calls the corrected RPC with the disambiguated request vocabulary', async () => {
    const supabase = makeSupabase({
      data: {
        status: 'anchor_updated',
        job_id: 'job-1',
        opportunity_id: 'workbench:1',
        opportunity_version: 'ver',
        previous_anchor_fingerprint: 'fp-old',
        anchor_fingerprint: 'fp-new',
        ledger_source_hash: 'rol:hash',
        evidence_anchor: 'new anchor',
        manuscript_coordinates: 'p:1',
      },
    })
    const adapter = createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(supabase as never)

    const result = await adapter.applyAnchorCas(VALID_INPUT)

    expect(supabase.rpc).toHaveBeenCalledWith('apply_held_recovery_anchor_cas_atomic', {
      p_request: {
        job_id: 'job-1',
        opportunity_id: 'workbench:1',
        expected_ledger_source_hash: 'rol:hash',
        expected_anchor_fingerprint: 'fp-current',
        new_evidence_anchor: 'new anchor',
        new_manuscript_coordinates: 'p:1',
      },
    })
    expect(result.status).toBe('anchor_updated')
    if (result.status === 'anchor_updated') {
      expect(result.opportunityVersion).toBe('ver')
      expect(result.previousAnchorFingerprint).toBe('fp-old')
      expect(result.anchorFingerprint).toBe('fp-new')
    }
  })

  it('maps an unchanged status with the opportunity_version', async () => {
    const supabase = makeSupabase({
      data: {
        status: 'unchanged',
        job_id: 'job-1',
        opportunity_id: 'workbench:1',
        opportunity_version: 'ver',
        anchor_fingerprint: 'fp',
        ledger_source_hash: 'rol:hash',
      },
    })
    const adapter = createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(supabase as never)
    const result = await adapter.applyAnchorCas(VALID_INPUT)
    expect(result.status).toBe('unchanged')
    if (result.status === 'unchanged') {
      expect(result.opportunityVersion).toBe('ver')
    }
  })

  it.each([
    'ledger_source_hash_conflict',
    'anchor_fingerprint_conflict',
    'artifact_not_found',
    'opportunity_not_found',
    'duplicate_opportunity_id',
    'malformed_request',
  ])('maps RPC RAISE EXCEPTION %s to a typed persistence_conflict', async (token) => {
    const supabase = makeSupabase({
      error: { message: `held_recovery_anchor_cas ${token} for job_id job-1 ...` },
    })
    const adapter = createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(supabase as never)
    const result = await adapter.applyAnchorCas(VALID_INPUT)
    expect(result.status).toBe('persistence_conflict')
    if (result.status === 'persistence_conflict') {
      expect(result.reason).toBe(token)
    }
  })

  it('FAILS CLOSED (throws) on an unrecognized RPC error rather than coercing to a conflict', async () => {
    const supabase = makeSupabase({ error: { message: 'some totally unexpected db failure' } })
    const adapter = createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(supabase as never)
    await expect(adapter.applyAnchorCas(VALID_INPUT)).rejects.toBeInstanceOf(
      AnchorCasPersistenceContractError,
    )
  })

  it('FAILS CLOSED on an unexpected success status', async () => {
    const supabase = makeSupabase({ data: { status: 'weird_new_status' } })
    const adapter = createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(supabase as never)
    await expect(adapter.applyAnchorCas(VALID_INPUT)).rejects.toBeInstanceOf(
      AnchorCasPersistenceContractError,
    )
  })

  it('FAILS CLOSED on a non-object RPC payload', async () => {
    const supabase = makeSupabase({ data: 'not-an-object' })
    const adapter = createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(supabase as never)
    await expect(adapter.applyAnchorCas(VALID_INPUT)).rejects.toBeInstanceOf(
      AnchorCasPersistenceContractError,
    )
  })

  it.each([
    ['jobId', { ...VALID_INPUT, jobId: '' }],
    ['opportunityId', { ...VALID_INPUT, opportunityId: '  ' }],
    ['expectedLedgerSourceHash', { ...VALID_INPUT, expectedLedgerSourceHash: '' }],
    ['expectedAnchorFingerprint', { ...VALID_INPUT, expectedAnchorFingerprint: '' }],
    ['newEvidenceAnchor', { ...VALID_INPUT, newEvidenceAnchor: '' }],
    ['newManuscriptCoordinates', { ...VALID_INPUT, newManuscriptCoordinates: '' }],
  ])('validates required input %s before hitting the RPC', async (_field, input) => {
    const supabase = makeSupabase({ data: { status: 'unchanged' } })
    const adapter = createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(supabase as never)
    await expect(adapter.applyAnchorCas(input as never)).rejects.toBeInstanceOf(
      AnchorCasPersistenceContractError,
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe('anchor CAS writer source scope guard', () => {
  const rawSource = fs.readFileSync(
    path.join(process.cwd(), 'lib/revision/heldRecoveryAnchorCasWriter.ts'),
    'utf8',
  )
  // Strip comments + string literals so guards target executable code, not the module's own
  // prohibitive prose (e.g. a comment that literally says "NO .from(table)...").
  const source = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')

  it('invokes RPC only — no direct table DML', () => {
    expect(source).not.toMatch(/\.from\(/)
    expect(source).toMatch(/\.rpc\(/)
  })

  it('does not import classification / queue / final-review / re-admission modules', () => {
    for (const mod of [
      'workbenchQueueProjection',
      'heldRecoveryQueueTransitionWriter',
      'finalReviewTextApplication',
      'heldRecoveryReconstructionReadmission',
    ]) {
      expect(source).not.toContain(mod)
    }
  })
})
