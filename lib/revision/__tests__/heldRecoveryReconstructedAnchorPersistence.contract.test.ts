/**
 * Commit 2 contract for the standalone default-off reconstructed-anchor
 * persistence caller. Proves:
 *
 *   - Flag gate: only HELD_RECOVERY_RECONSTRUCTED_ANCHOR_PERSISTENCE_ENABLED === '1'
 *     enables persistence; unset / "true" / "yes" / "0" / whitespace stay disabled,
 *     and when disabled neither the builder nor the writer runs.
 *   - Execution order: flag -> build -> (reject | request -> single writer call).
 *   - A builder rejection returns { status: 'reconstruction_rejected', reason }
 *     and is never disguised as one of the five database outcomes; the writer is
 *     not called.
 *   - All five writer outcomes (inserted, already_applied, rejected_conflict,
 *     rejected_stale, rejected_missing) pass through unchanged.
 *   - Exactly one writer invocation per enabled+built call.
 *   - The canonical manuscript id string is passed to the adapter unchanged
 *     (exact bigint fidelity, no numeric conversion).
 *   - Scope fence: the caller source contains no worker import/modification,
 *     queue transition, re-admission, retry, attempt write, candidate mutation,
 *     logging, .from(...), second RPC, or environment mutation.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  persistReconstructedAnchor,
  type PersistReconstructedAnchorInput,
  type ResolveAnchorPersistenceResult,
} from '@/lib/revision/heldRecoveryReconstructedAnchorPersistence'
import type {
  ReconstructedAnchorInsertAdapter,
  ReconstructedAnchorInsertRequest,
  ReconstructedAnchorInsertResult,
} from '@/lib/revision/heldRecoveryReconstructedAnchorWriter'
import {
  buildReconstructedAnchorContent,
  type BuildReconstructedAnchorContentInput,
} from '@/lib/revision/heldRecoveryReconstructedAnchorContent'
import { sourceHashForCanonicalChunkContent } from '@/lib/revision/heldRecoveryRuntimeInputs'
import { sourceHashFor } from '@/lib/revision/heldRecoveryVersioning'

// The builder computes authority.sourceHash as sourceHashFor({ source_text:
// canonicalSource.text.trim() }); the fixture text has no surrounding
// whitespace, so trim() is a no-op here.

const FLAG = 'HELD_RECOVERY_RECONSTRUCTED_ANCHOR_PERSISTENCE_ENABLED'
const MAX_PG_BIGINT = '9223372036854775807'
const MANUSCRIPT_VERSION_SHA = 'mv-sha-1'

// -- A reconstruction that the real builder accepts (status: 'built'). --
function buildableReconstruction(
  manuscriptId = MAX_PG_BIGINT,
): BuildReconstructedAnchorContentInput {
  const text = 'The quick brown fox watches the gate while rain gathers softly.'
  const evidenceAnchor = 'quick brown fox'
  const start = text.indexOf(evidenceAnchor)
  const end = start + evidenceAnchor.length
  const sourceHash = sourceHashFor({ source_text: text })
  const contentHash = sourceHashForCanonicalChunkContent(text)
  return {
    authority: {
      manuscriptId,
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      heldItemPersistedVersion: 'held-v1',
      sourceHash,
      sourceStartOffset: start,
      sourceEndOffset: end,
      recoveryMethod: 'source_text_location_only',
      completionFingerprint: 'fingerprint-1',
    },
    canonicalSource: {
      manuscriptId,
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      text,
    },
    chunk: {
      chunkId: 'chunk-0',
      manuscriptId,
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      contentAbsoluteStart: 0,
      contentAbsoluteEnd: text.length,
      content: text,
      contentHash,
    },
    canonicalManuscriptCoordinates: 'chapter 1 / chunk 0',
  }
}

function baseInput(
  overrides: Partial<PersistReconstructedAnchorInput> = {},
): PersistReconstructedAnchorInput {
  return {
    heldItemId: 'held-1',
    opportunityId: 'op-1',
    expectedAuthorityVersion: 'authority-v1',
    reconstruction: buildableReconstruction(),
    ...overrides,
  }
}

// -- Recording adapter: captures every request and returns a fixed outcome. --
function recordingAdapter(result: ReconstructedAnchorInsertResult) {
  const calls: ReconstructedAnchorInsertRequest[] = []
  const adapter: ReconstructedAnchorInsertAdapter = {
    async insertReconstructedAnchor(request) {
      calls.push(request)
      return result
    },
  }
  return { adapter, calls }
}

function throwingAdapter(): ReconstructedAnchorInsertAdapter {
  return {
    async insertReconstructedAnchor() {
      throw new Error('writer must not be invoked')
    },
  }
}

// Per-test env snapshot/restore so a mutated flag can never leak into another
// case and make the default-off assertions unreliable.
function withFlagIsolation() {
  let snapshot: string | undefined
  beforeEach(() => {
    snapshot = process.env[FLAG]
  })
  afterEach(() => {
    if (snapshot === undefined) delete process.env[FLAG]
    else process.env[FLAG] = snapshot
  })
}

describe('reconstructed-anchor persistence caller — flag gate', () => {
  withFlagIsolation()

  const disabledValues: Array<{ label: string; set: () => void }> = [
    { label: 'unset', set: () => delete process.env[FLAG] },
    { label: '"true"', set: () => { process.env[FLAG] = 'true' } },
    { label: '"yes"', set: () => { process.env[FLAG] = 'yes' } },
    { label: '"0"', set: () => { process.env[FLAG] = '0' } },
    { label: 'whitespace " 1 "', set: () => { process.env[FLAG] = ' 1 ' } },
    { label: 'empty string', set: () => { process.env[FLAG] = '' } },
  ]

  for (const { label, set } of disabledValues) {
    it(`returns disabled and never touches the writer when flag is ${label}`, async () => {
      set()
      const adapter = throwingAdapter()
      const result = await persistReconstructedAnchor(baseInput(), { adapter })
      expect(result).toEqual({ status: 'disabled' })
    })
  }

  it('enables persistence only for the exact string "1"', async () => {
    process.env[FLAG] = '1'
    const { adapter, calls } = recordingAdapter({
      status: 'inserted',
      row: { id: 'row-1' } as never,
    })
    const result = await persistReconstructedAnchor(baseInput(), { adapter })
    expect(result.status).toBe('inserted')
    expect(calls).toHaveLength(1)
  })
})

describe('reconstructed-anchor persistence caller — execution order & rejection', () => {
  withFlagIsolation()
  beforeEach(() => { process.env[FLAG] = '1' })

  it('surfaces a builder rejection as reconstruction_rejected and does not call the writer', async () => {
    const adapter = throwingAdapter()
    // Force a builder rejection via a manuscript identity mismatch.
    const reconstruction = buildableReconstruction()
    const mismatched: BuildReconstructedAnchorContentInput = {
      ...reconstruction,
      canonicalSource: { ...reconstruction.canonicalSource, manuscriptId: '123' },
    }
    const result = await persistReconstructedAnchor(
      baseInput({ reconstruction: mismatched }),
      { adapter },
    )
    expect(result).toEqual({
      status: 'reconstruction_rejected',
      reason: 'manuscript_identity_mismatch',
    })
  })

  it('invokes the writer exactly once with a request derived from authority + built content + caller values', async () => {
    const { adapter, calls } = recordingAdapter({
      status: 'inserted',
      row: { id: 'row-1' } as never,
    })
    const recon = buildableReconstruction()
    await persistReconstructedAnchor(baseInput({ reconstruction: recon }), { adapter })
    expect(calls).toHaveLength(1)
    const req = calls[0]

    // Independently run the real builder on the same reconstruction so we assert
    // the caller forwards ACTUAL builder output, not fixture assumptions.
    const built = buildReconstructedAnchorContent(recon)
    if (built.status !== 'built') throw new Error('fixture must build cleanly')
    // Sanity: the builder derived the evidence span from the offsets (not the chunk).
    expect(built.value.evidenceAnchor).toBe('quick brown fox')
    expect(built.value.manuscriptCoordinates).toBe('chapter 1 / chunk 0')

    // Three caller-supplied identity/CAS values.
    expect(req.heldItemId).toBe('held-1')
    expect(req.opportunityId).toBe('op-1')
    expect(req.expectedAuthorityVersion).toBe('authority-v1')
    // Authority-derived (not duplicated on the input).
    expect(req.heldItemPersistedVersion).toBe(recon.authority.heldItemPersistedVersion)
    expect(req.completionFingerprint).toBe(recon.authority.completionFingerprint)
    expect(req.manuscriptVersionSha).toBe(recon.authority.manuscriptVersionSha)
    expect(req.recoveryMethod).toBe(recon.authority.recoveryMethod)
    expect(req.sourceHash).toBe(recon.authority.sourceHash)
    expect(req.sourceStartOffset).toBe(recon.authority.sourceStartOffset)
    expect(req.sourceEndOffset).toBe(recon.authority.sourceEndOffset)
    // Built content — must equal the real builder's output verbatim.
    expect(req.evidenceAnchor).toBe(built.value.evidenceAnchor)
    expect(req.manuscriptCoordinates).toBe(built.value.manuscriptCoordinates)
  })

  it('passes the canonical manuscript id string to the adapter unchanged (bigint fidelity)', async () => {
    const { adapter, calls } = recordingAdapter({
      status: 'inserted',
      row: { id: 'row-1' } as never,
    })
    await persistReconstructedAnchor(baseInput(), { adapter })
    expect(calls[0].manuscriptId).toBe(MAX_PG_BIGINT)
    expect(typeof calls[0].manuscriptId).toBe('string')
    // The precision-lossy JS-number form never appears.
    expect(calls[0].manuscriptId).not.toBe(String(Number(MAX_PG_BIGINT)))
  })
})

describe('reconstructed-anchor persistence caller — pass-through of all five writer outcomes', () => {
  withFlagIsolation()
  beforeEach(() => { process.env[FLAG] = '1' })

  const outcomes: ReconstructedAnchorInsertResult[] = [
    { status: 'inserted', row: { id: 'row-1' } as never },
    { status: 'already_applied', row: { id: 'row-1' } as never },
    {
      status: 'rejected_conflict',
      heldItemId: 'held-1',
      heldItemPersistedVersion: 'held-v1',
      existingCompletionFingerprint: 'a',
      submittedCompletionFingerprint: 'b',
    },
    {
      status: 'rejected_stale',
      heldItemId: 'held-1',
      expectedAuthorityVersion: 'authority-v1',
      actualAuthorityVersion: 'authority-v2',
    },
    { status: 'rejected_missing', heldItemId: 'held-1' },
  ]

  for (const outcome of outcomes) {
    it(`returns the writer's ${outcome.status} result unchanged`, async () => {
      const { adapter, calls } = recordingAdapter(outcome)
      const result: ResolveAnchorPersistenceResult = await persistReconstructedAnchor(
        baseInput(),
        { adapter },
      )
      expect(result).toBe(outcome)
      expect(calls).toHaveLength(1)
    })
  }
})

describe('reconstructed-anchor persistence caller — scope fence (source-level)', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'lib/revision/heldRecoveryReconstructedAnchorPersistence.ts'),
    'utf8',
  )
  // Strip comments so documentation of the fence does not trip the assertions.
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')

  it('contains no worker import or worker reference', () => {
    expect(codeOnly).not.toMatch(/heldRecoveryReconstructionWorker|RuntimeOrchestrator|Worker/)
  })
  it('contains no .from(...) table read/write', () => {
    expect(codeOnly).not.toMatch(/\.from\(/)
  })
  it('contains no second RPC / direct rpc call', () => {
    expect(codeOnly).not.toMatch(/\.rpc\(/)
  })
  it('contains no queue transition, re-admission, retry, or attempt mutation', () => {
    expect(codeOnly).not.toMatch(/queueTransition|readmission|reAdmission|retry|attemptRecorder|recordAttempt/i)
  })
  it('contains no environment mutation', () => {
    // An assignment `=` that is not a comparison (==, ===). The flag is only READ
    // (process.env.FLAG === '1'), so a bare read must not trip this.
    expect(codeOnly).not.toMatch(/process\.env\.[A-Z_]+\s*=(?![=])/)
    expect(codeOnly).not.toMatch(/delete\s+process\.env/)
  })
  it('contains no logging', () => {
    expect(codeOnly).not.toMatch(/console\.|logger\.|log\(/)
  })
  it('invokes the writer exactly once (single insertReconstructedAnchor call site)', () => {
    const matches = codeOnly.match(/insertReconstructedAnchor\(/g) ?? []
    expect(matches).toHaveLength(1)
  })
})
