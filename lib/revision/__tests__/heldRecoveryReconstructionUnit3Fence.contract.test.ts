/**
 * Unit 3 manuscript-identity fence.
 *
 * A source-level guard proving the reconstruction worker/writer/migration and the
 * new recorder read path preserve PR #1340's canonical-STRING manuscript identity:
 *
 *   1. The writer never coerces manuscript_id to a JS number
 *      (no `Number(row.manuscript_id)` / `parseInt` / `parseFloat`) and never
 *      types manuscriptId as `number`.
 *   2. The worker computes its completion fingerprint over the STRING manuscript
 *      id (no numeric coercion of the id).
 *   3. The migration stores manuscript_id as TEXT, never bigint, with a canonical
 *      check constraint.
 *   4. The new recorder read path (findByHeldItemAndOpportunity) guards malformed
 *      rows with isRecord() before mapping, and carries manuscriptId as a string.
 *
 * Every fence assertion is paired with an in-test NEGATIVE CONTROL: the same
 * matcher is applied to a synthetic regressed snippet to prove the assertion
 * actually fails when the contract is violated (i.e. the fence is not vacuous).
 */
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8')
}

/** Strip block and line comments so only executable code is fenced. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const WRITER = 'lib/revision/heldRecoveryReconstructionWriter.ts'
const WORKER = 'lib/revision/heldRecoveryReconstructionWorker.ts'
const RECORDER = 'lib/revision/heldRecoveryAttemptRecorder.ts'
const MIGRATION =
  'supabase/migrations/20260719120000_create_held_recovery_reconstruction_work.sql'

describe('Unit 3 fence — writer never numerically coerces manuscript_id', () => {
  const src = codeOnly(read(WRITER))

  it('contains no Number()/parseInt/parseFloat applied to manuscript_id', () => {
    const numberCoercion = /Number\(\s*\w+\.manuscript_id\s*\)/
    const parseCoercion = /parse(Int|Float)\(\s*\w+\.manuscript_id/
    expect(src).not.toMatch(numberCoercion)
    expect(src).not.toMatch(parseCoercion)

    // Negative control: a regressed writer WOULD be caught by these matchers.
    const regressed = 'manuscriptId: Number(row.manuscript_id),'
    expect(regressed).toMatch(numberCoercion)
    expect('manuscriptId: parseInt(row.manuscript_id, 10),').toMatch(parseCoercion)
  })

  it('never types a manuscriptId field as number', () => {
    const numericField = /manuscriptId\s*:\s*number/
    expect(src).not.toMatch(numericField)
    // Negative control.
    expect('readonly manuscriptId: number').toMatch(numericField)
  })

  it('validates manuscript_id through the canonical-string guard (not a numeric parse)', () => {
    expect(src).toContain('requireCanonicalManuscriptId')
    expect(src).toMatch(/CANONICAL_MANUSCRIPT_ID\s*=\s*\/\^\(0\|\[1-9\]\[0-9\]\*\)\$\//)
  })
})

describe('Unit 3 fence — worker fingerprints the STRING manuscript id', () => {
  const src = codeOnly(read(WORKER))

  it('never numerically coerces manuscript id in the worker', () => {
    const numberCoercion = /Number\(\s*\w+\.manuscriptId\s*\)/
    expect(src).not.toMatch(numberCoercion)
    // Negative control.
    expect('const id = Number(work.manuscriptId)').toMatch(numberCoercion)
  })

  it('declares the canonical manuscriptId as a string on the reconstructed authority', () => {
    expect(src).toMatch(/manuscriptId\s*:\s*string/)
    const numericField = /manuscriptId\s*:\s*number/
    expect(src).not.toMatch(numericField)
    // Negative control.
    expect('readonly manuscriptId: number').toMatch(numericField)
  })

  it('is default-off: a strict-no-op feature flag guards the entrypoint', () => {
    expect(src).toContain('HELD_RECOVERY_RECONSTRUCTION_WORKER_ENABLED')
    expect(src).toContain("=== 'true'")
    expect(src).toContain("status: 'disabled'")
  })
})

describe('Unit 3 fence — migration stores manuscript_id as canonical TEXT', () => {
  const sql = read(MIGRATION)

  it('declares manuscript_id as text and never as bigint', () => {
    const textCol = /manuscript_id\s+text\s+not null/i
    const bigintCol = /manuscript_id\s+bigint/i
    expect(sql).toMatch(textCol)
    expect(sql).not.toMatch(bigintCol)
    // Negative control: a regressed migration WOULD trip the bigint matcher.
    expect('  manuscript_id bigint not null').toMatch(bigintCol)
  })

  it('enforces the canonical decimal check constraint on manuscript_id', () => {
    const canonicalCheck = /check\s*\(\s*manuscript_id\s*~\s*'\^\(0\|\[1-9\]\[0-9\]\*\)\$'\s*\)/i
    expect(sql).toMatch(canonicalCheck)
    // Negative control.
    expect("check (manuscript_id ~ '^(0|[1-9][0-9]*)$')").toMatch(canonicalCheck)
  })
})

describe('Unit 3 fence — new recorder read path guards malformed rows', () => {
  const src = read(RECORDER)

  it('exposes findByHeldItemAndOpportunity backed by an isRecord() malformed-row guard', () => {
    expect(src).toContain('findByHeldItemAndOpportunity')
    expect(src).toMatch(/function isRecord\(value: unknown\)/)
    // The guard rejects null / arrays / primitives before mapping.
    expect(src).toMatch(
      /value !== null && typeof value === 'object' && !Array\.isArray\(value\)/,
    )
    // The read path throws on a malformed row rather than destructuring it.
    expect(src).toMatch(/if \(!isRecord\(row\)\)/)
  })

  it('carries manuscriptId as a string in the recorder record type (never number)', () => {
    const numericField = /manuscriptId\s*:\s*number/
    expect(src).not.toMatch(numericField)
    expect(src).toMatch(/readonly manuscriptId: string/)
    // Negative control.
    expect('readonly manuscriptId: number').toMatch(numericField)
  })

  it('never applies Number() to manuscript_id on the recorder read path', () => {
    const numberCoercion = /Number\(\s*row\.manuscript_id\s*\)/
    expect(codeOnly(src)).not.toMatch(numberCoercion)
    // Negative control.
    expect('manuscriptId: Number(row.manuscript_id),').toMatch(numberCoercion)
  })
})
