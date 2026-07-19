/**
 * Commit 1B fidelity + semantics contract for the precision-safe manuscriptId
 * path (DB read -> reconstruction). Proves:
 *
 *   1. The production loadManuscriptChunks reads through the text-returning RPC
 *      (get_held_recovery_manuscript_chunks), never a direct manuscript_chunks
 *      select, and performs only a transport-shape rename manuscript_id_text ->
 *      manuscript_id — no trimming, no normalization, no numeric conversion.
 *   2. The established orchestration classifications are unchanged:
 *        RPC error            -> invalid (load-error) result
 *        RPC success, no rows -> missing result
 *        RPC malformed row    -> invalid canonical derivation (rejected)
 *        RPC valid rows       -> canonical chunk derivation path
 *   3. The maximum PostgreSQL bigint reaches the executor input unchanged.
 *   4. manuscript_id_text that is missing, numeric, null, or non-canonical is
 *      rejected by the canonical derivation, not repaired.
 *   5. No Number(row.manuscript_id) remains in heldRecoveryAttemptRecorder.ts.
 *   6. No .from('manuscript_chunks') fallback remains in this Held Recovery path.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  createSupabaseHeldRecoveryRuntimeLoaders,
  runHeldRecoveryRuntimeOrchestration,
  type CanonicalHeldItem,
  type CanonicalHeldItemLoadResult,
  type CanonicalOpportunityLoadResult,
  type CanonicalCandidateStateLoadResult,
  type CanonicalManuscriptChunkRowsLoadResult,
  type HeldRecoveryRuntimeLoaders,
} from '@/lib/revision/heldRecoveryRuntimeOrchestrator'
import {
  deriveCanonicalManuscriptChunkReference,
  sourceHashForCanonicalChunkContent,
  type CanonicalManuscriptChunkRow,
  type CanonicalRecoveryState,
} from '@/lib/revision/heldRecoveryRuntimeInputs'

const MAX_PG_BIGINT = '9223372036854775807'
const NEIGHBOUR_BIGINT = '9223372036854775806'
const MANUSCRIPT_VERSION_SHA = 'mv-sha-1'

// -- RPC transport-row helper (mirrors what get_held_recovery_manuscript_chunks
//    returns: manuscript_id exposed as manuscript_id_text). --
function rpcRow(content: string, index: number, manuscriptIdText: unknown) {
  return {
    id: `chunk-${index}`,
    manuscript_id_text: manuscriptIdText,
    chunk_index: index,
    char_start: index * 100,
    char_end: index * 100 + content.length,
    overlap_chars: 0,
    label: `Chunk ${index + 1}`,
    content,
    content_hash: sourceHashForCanonicalChunkContent(content),
  }
}

function mockSupabaseRpc(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn(async () => result)
  const from = jest.fn(() => {
    throw new Error('loadManuscriptChunks must not read via .from() in the Held Recovery path')
  })
  return { supabase: { rpc, from } as never, rpc, from }
}

describe('Held Recovery manuscript_chunks read RPC mapping + semantics', () => {
  it('reads through the RPC (never .from) and renames manuscript_id_text -> manuscript_id unchanged', async () => {
    const { supabase, rpc, from } = mockSupabaseRpc({
      data: [rpcRow('The quick brown fox watches the gate.', 0, MAX_PG_BIGINT)],
      error: null,
    })
    const loaders = createSupabaseHeldRecoveryRuntimeLoaders({ supabase, jobId: 'job-1' })

    const result = await loaders.loadManuscriptChunks(MAX_PG_BIGINT, MANUSCRIPT_VERSION_SHA)

    expect(from).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('get_held_recovery_manuscript_chunks', {
      p_manuscript_id: MAX_PG_BIGINT,
    })
    expect(result.status).toBe('loaded')
    if (result.status !== 'loaded') throw new Error('expected loaded')
    // Transport-shape only: manuscript_id carries the exact text, no manuscript_id_text leaks.
    expect(result.value[0].manuscript_id).toBe(MAX_PG_BIGINT)
    expect((result.value[0] as Record<string, unknown>).manuscript_id_text).toBeUndefined()
  })

  it('maps an RPC error to the existing invalid (load-error) result', async () => {
    const { supabase } = mockSupabaseRpc({ data: null, error: { message: 'boom' } })
    const loaders = createSupabaseHeldRecoveryRuntimeLoaders({ supabase, jobId: 'job-1' })
    const result = await loaders.loadManuscriptChunks(MAX_PG_BIGINT, MANUSCRIPT_VERSION_SHA)
    expect(result).toEqual({ status: 'invalid', reason: 'boom' })
  })

  it('maps an empty RPC result to the existing missing result', async () => {
    const { supabase } = mockSupabaseRpc({ data: [], error: null })
    const loaders = createSupabaseHeldRecoveryRuntimeLoaders({ supabase, jobId: 'job-1' })
    const result = await loaders.loadManuscriptChunks(MAX_PG_BIGINT, MANUSCRIPT_VERSION_SHA)
    expect(result).toEqual({ status: 'missing' })
  })

  it('does not normalize a malformed manuscript_id_text at the transport boundary', async () => {
    // A non-canonical text value is passed straight through as manuscript_id; the
    // canonical derivation (not the transport map) is what rejects it.
    const { supabase } = mockSupabaseRpc({
      data: [rpcRow('text', 0, ' 01 ')],
      error: null,
    })
    const loaders = createSupabaseHeldRecoveryRuntimeLoaders({ supabase, jobId: 'job-1' })
    const result = await loaders.loadManuscriptChunks(MAX_PG_BIGINT, MANUSCRIPT_VERSION_SHA)
    expect(result.status).toBe('loaded')
    if (result.status !== 'loaded') throw new Error('expected loaded')
    expect(result.value[0].manuscript_id).toBe(' 01 ')
  })

  it('does not throw when the RPC returns a null array element, and still yields a loaded result', async () => {
    // The ReadonlyArray<Record<string, unknown>> cast on the RPC data is a
    // compile-time-only assertion; a real RPC response is untrusted at
    // runtime and could contain a non-object element. Destructuring such an
    // element directly (`const { manuscript_id_text, ...rest } = row`) would
    // throw a TypeError synchronously inside this mapping, well before the
    // existing canonical-derivation rejection path ever runs. This proves the
    // guard classifies the malformed element as an ordinary loaded row
    // (which canonical derivation will separately reject) rather than
    // crashing the read.
    const { supabase } = mockSupabaseRpc({
      data: [null, rpcRow('The quick brown fox watches the gate.', 1, MAX_PG_BIGINT)],
      error: null,
    })
    const loaders = createSupabaseHeldRecoveryRuntimeLoaders({ supabase, jobId: 'job-1' })

    // Calling this directly (no try/catch) is itself the proof: if the guard
    // regressed, the destructure would throw synchronously inside the async
    // mapping and this await would reject, failing the test outright.
    const result = await loaders.loadManuscriptChunks(MAX_PG_BIGINT, MANUSCRIPT_VERSION_SHA)

    expect(result.status).toBe('loaded')
    if (result.status !== 'loaded') throw new Error('expected loaded')
    expect(result.value).toHaveLength(2)
    // The malformed element is passed through as an empty shape, not repaired
    // and not silently dropped -- canonical derivation is the sole rejector.
    expect(result.value[0].manuscript_id).toBeUndefined()
    expect(result.value[0].id).toBeUndefined()
    // The well-formed neighbour row is unaffected by the malformed element.
    expect(result.value[1].manuscript_id).toBe(MAX_PG_BIGINT)
  })

  it('rejects a null-row response end-to-end as invalid_canonical_input, without throwing out of the orchestration', async () => {
    // End-to-end proof through the real production loaders factory (not a
    // hand-rolled loaders object): a null element from the RPC must resolve
    // to a rejected outcome classified as invalid_canonical_input, the exact
    // classification the malformed-row transport comment already promises --
    // not an unhandled rejection / thrown error out of runHeldRecoveryRuntimeOrchestration.
    const { supabase } = mockSupabaseRpc({
      data: [null],
      error: null,
    })
    const loaders = {
      ...createSupabaseHeldRecoveryRuntimeLoaders({ supabase, jobId: 'job-1' }),
      async loadHeldItem(): Promise<CanonicalHeldItemLoadResult> {
        return {
          status: 'loaded',
          value: {
            heldItemId: 'held-1',
            opportunityId: 'op-1',
            reason: { code: 'context_missing', source: 'preflight' },
            producer: 'preflight',
            persistedVersion: 'held-v1',
            manuscriptId: MAX_PG_BIGINT,
            manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
          },
        }
      },
      async loadOpportunityLedger(): Promise<CanonicalOpportunityLoadResult> {
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
      },
      async loadCandidateState(): Promise<CanonicalCandidateStateLoadResult> {
        return { status: 'loaded', value: { a: 'Alpha', b: 'Beta', c: 'Gamma' } }
      },
    }

    let outcome: unknown
    let thrown: unknown
    try {
      outcome = await runHeldRecoveryRuntimeOrchestration({ heldItemId: 'held-1' }, loaders)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeUndefined()
    expect(outcome).toMatchObject({ status: 'rejected', reason: 'invalid_canonical_input' })
  })
})

describe('canonical derivation rejects non-canonical manuscript_id (not repaired)', () => {
  const cases: Array<{ label: string; value: unknown }> = [
    { label: 'leading space', value: ' 1' },
    { label: 'leading zero', value: '01' },
    { label: 'plus sign', value: '+1' },
    { label: 'decimal', value: '1.0' },
    { label: 'exponent', value: '1e3' },
    { label: 'blank', value: '' },
    { label: 'whitespace', value: '   ' },
    { label: 'numeric (not string)', value: 44 },
    { label: 'max-bigint as number', value: Number(MAX_PG_BIGINT) },
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
  ]
  for (const { label, value } of cases) {
    it(`rejects ${label}`, () => {
      const row = {
        id: 'chunk-0',
        manuscript_id: value,
        chunk_index: 0,
        char_start: 0,
        char_end: 4,
        overlap_chars: 0,
        label: 'Chunk 1',
        content: 'text',
        content_hash: sourceHashForCanonicalChunkContent('text'),
      } as unknown as CanonicalManuscriptChunkRow
      expect(() =>
        deriveCanonicalManuscriptChunkReference(row, { manuscriptVersionSha: MANUSCRIPT_VERSION_SHA }),
      ).toThrow(/manuscript_id/)
    })
  }

  it('accepts the maximum PostgreSQL bigint as an exact canonical string', () => {
    const row = {
      id: 'chunk-0',
      manuscript_id: MAX_PG_BIGINT,
      chunk_index: 0,
      char_start: 0,
      char_end: 4,
      overlap_chars: 0,
      label: 'Chunk 1',
      content: 'text',
      content_hash: sourceHashForCanonicalChunkContent('text'),
    }
    const ref = deriveCanonicalManuscriptChunkReference(row, {
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
    })
    expect(ref.manuscriptId).toBe(MAX_PG_BIGINT)
    // Distinct from its JS-number-colliding neighbour.
    expect(Number(MAX_PG_BIGINT)).toBe(Number(NEIGHBOUR_BIGINT))
    expect(ref.manuscriptId).not.toBe(NEIGHBOUR_BIGINT)
  })
})

describe('max PostgreSQL bigint reaches the executor input unchanged', () => {
  function heldItem(overrides: Partial<CanonicalHeldItem> = {}): CanonicalHeldItem {
    return {
      heldItemId: 'held-1',
      opportunityId: 'op-1',
      reason: { code: 'context_missing', source: 'preflight' },
      producer: 'preflight',
      persistedVersion: 'held-v1',
      manuscriptId: MAX_PG_BIGINT,
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      ...overrides,
    }
  }

  function chunkRow(content: string, index: number): CanonicalManuscriptChunkRow {
    return {
      id: `chunk-${index}`,
      manuscript_id: MAX_PG_BIGINT,
      chunk_index: index,
      char_start: index * 100,
      char_end: index * 100 + content.length,
      overlap_chars: 0,
      label: `Chunk ${index + 1}`,
      content,
      content_hash: sourceHashForCanonicalChunkContent(content),
    }
  }

  it('carries the exact bigint string into the executor input manuscript identity', async () => {
    const loaders: HeldRecoveryRuntimeLoaders = {
      async loadHeldItem(): Promise<CanonicalHeldItemLoadResult> {
        return { status: 'loaded', value: heldItem() }
      },
      async loadOpportunityLedger(): Promise<CanonicalOpportunityLoadResult> {
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
      },
      async loadCandidateState(): Promise<CanonicalCandidateStateLoadResult> {
        return { status: 'loaded', value: { a: 'Alpha', b: 'Beta', c: 'Gamma' } }
      },
      async loadManuscriptChunks(): Promise<CanonicalManuscriptChunkRowsLoadResult> {
        return {
          status: 'loaded',
          value: [
            chunkRow('The quick brown fox watches the gate while rain gathers.', 0),
            chunkRow('Elsewhere, the guard listens for footsteps.', 1),
          ],
        }
      },
    }

    // Capture the canonical state (and thus the manuscript identity) that reaches
    // the executor via the buildExecutorInputFromCanonicalState dependency seam.
    let capturedState: CanonicalRecoveryState | undefined
    const outcome = await runHeldRecoveryRuntimeOrchestration(
      { heldItemId: 'held-1' },
      loaders,
      {
        buildExecutorInputFromCanonicalState: (_request, state) => {
          capturedState = state
          return {} as never
        },
        executeRecoveryAction: () => ({ outcome: 'no_op' }) as never,
      },
    )

    expect(outcome).toBeDefined()
    expect(capturedState?.manuscript.manuscriptId).toBe(MAX_PG_BIGINT)
    // Every derived chunk carries the exact bigint string too.
    for (const ref of capturedState?.manuscript.chunks ?? []) {
      expect(ref.manuscriptId).toBe(MAX_PG_BIGINT)
    }
    const serialized = JSON.stringify(capturedState)
    expect(serialized).toContain(MAX_PG_BIGINT)
    // The precision-lossy JS-number form must never appear.
    expect(serialized).not.toContain(String(Number(MAX_PG_BIGINT)))
  })
})

describe('no precision-lossy conversions remain in the source path', () => {
  const repoRoot = process.cwd()

  it('heldRecoveryAttemptRecorder.ts contains no Number(row.manuscript_id)', () => {
    const src = fs.readFileSync(
      path.join(repoRoot, 'lib/revision/heldRecoveryAttemptRecorder.ts'),
      'utf8',
    )
    expect(src).not.toMatch(/Number\(\s*row\.manuscript_id\s*\)/)
  })

  it('the orchestrator Held Recovery read has no .from(\'manuscript_chunks\') fallback', () => {
    const src = fs.readFileSync(
      path.join(repoRoot, 'lib/revision/heldRecoveryRuntimeOrchestrator.ts'),
      'utf8',
    )
    // Strip line and block comments so a doc-comment that names the removed read
    // pattern does not produce a false positive; only executable code is checked.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n')
    // The only chunk read is the RPC; no direct manuscript_chunks table read.
    expect(codeOnly).toContain("supabase.rpc('get_held_recovery_manuscript_chunks'")
    expect(codeOnly).not.toMatch(/\.from\(\s*['"]manuscript_chunks['"]\s*\)/)
  })
})
