/**
 * PORT-BASELINE FENCE (source-level contract test).
 *
 * This suite exists because the resolve_anchor wiring work was historically
 * developed on a branch that PRE-DATED PR #1340 and, if ported wholesale, would
 * have silently reverted #1340's precision-safe manuscript-identity contract:
 *   - deleting heldRecoveryManuscriptIdFidelity.contract.test.ts,
 *   - re-introducing a direct `.from('manuscript_chunks')` read instead of the
 *     precision-safe `get_held_recovery_manuscript_chunks` RPC,
 *   - dropping the `isRecord()` malformed-RPC-row guard, and
 *   - retyping `manuscriptId` from the canonical decimal STRING back to `number`
 *     (plus `Number(row.manuscript_id)` coercion).
 *
 * Units 1 and 7 were ported as ISOLATED ADDITIONS that touch none of those
 * surfaces. This fence proves — at the source-text level, independent of runtime
 * import graphs — that the #1340 baseline is still intact on this branch after the
 * port. If a later port erodes any of these guarantees, THIS TEST FAILS FIRST.
 *
 * A source scan (not behavioural assertions) is used deliberately: the guarantee
 * must hold even for code paths never exercised in a given test process, and it
 * documents the exact non-negotiable tokens for future maintainers.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..', '..')

function readSource(relPath: string): string {
  const abs = join(REPO_ROOT, relPath)
  return readFileSync(abs, 'utf8')
}

/**
 * Strip `//` line comments and block comments so source-text assertions match
 * only EXECUTABLE code, not documentation that legitimately references a pattern.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const FIDELITY_TEST = 'lib/revision/__tests__/heldRecoveryManuscriptIdFidelity.contract.test.ts'
const ORCHESTRATOR = 'lib/revision/heldRecoveryRuntimeOrchestrator.ts'
const RUNTIME_INPUTS = 'lib/revision/heldRecoveryRuntimeInputs.ts'
const ATTEMPT_RECORDER = 'lib/revision/heldRecoveryAttemptRecorder.ts'

/**
 * The precision-safe read RPC. Reads MUST go through this RPC (which projects
 * manuscript_id::text) and MUST NOT fall back to a direct table read that would
 * round-trip the id through a JS number.
 */
const READ_RPC = 'get_held_recovery_manuscript_chunks'

describe('resolve_anchor port — PR #1340 baseline fence (source-level)', () => {
  it('the manuscript-id fidelity regression suite still exists (not deleted by the port)', () => {
    expect(existsSync(join(REPO_ROOT, FIDELITY_TEST))).toBe(true)
    const src = readSource(FIDELITY_TEST)
    // It must still be a real, populated suite — not an emptied stub.
    expect(src.length).toBeGreaterThan(1000)
    expect(/\bdescribe\s*\(/.test(src)).toBe(true)
    expect(/\bit\s*\(/.test(src)).toBe(true)
    // And it must still assert its two load-bearing guarantees.
    expect(src).toContain(READ_RPC)
    expect(src).toContain('Number(row.manuscript_id)')
  })

  it('reads still go through the precision-safe RPC, never a direct manuscript_chunks table read', () => {
    const orch = readSource(ORCHESTRATOR)
    expect(orch).toContain(`supabase.rpc('${READ_RPC}'`)
    // The regressed branch reverted this to `.from('manuscript_chunks')`. That
    // direct read must NOT be present as EXECUTABLE code. The canonical source
    // legitimately MENTIONS the pattern inside an explanatory comment, so we strip
    // line and block comments before asserting, to check real code only.
    const codeOnly = stripComments(orch)
    expect(codeOnly).not.toContain(".from('manuscript_chunks')")
    // Sanity: the RPC call itself survives comment-stripping (it is real code).
    expect(codeOnly).toContain(`supabase.rpc('${READ_RPC}'`)
  })

  it('the isRecord() malformed-RPC-row guard is still defined and applied in the orchestrator', () => {
    const orch = readSource(ORCHESTRATOR)
    expect(/function\s+isRecord\s*\(/.test(orch)).toBe(true)
    // The guard must be applied to each RPC row before it is destructured/mapped.
    expect(/if\s*\(\s*!isRecord\(\s*row\s*\)\s*\)/.test(orch)).toBe(true)
  })

  it('canonical manuscriptId is still typed as a STRING, never reverted to number', () => {
    const inputsRaw = readSource(RUNTIME_INPUTS)
    const inputs = stripComments(inputsRaw)
    expect(inputsRaw).toContain('readonly manuscriptId: string')
    expect(inputs).not.toContain('readonly manuscriptId: number')
    // The canonical decimal-string validator must still be present.
    expect(inputsRaw).toContain('CANONICAL_INTEGER_STRING')
    expect(/isCanonicalManuscriptId\s*\(/.test(inputsRaw)).toBe(true)
  })

  it('the attempt recorder never coerces manuscript_id through Number() and keeps the string type', () => {
    const recorderRaw = readSource(ATTEMPT_RECORDER)
    const recorder = stripComments(recorderRaw)
    expect(recorder).not.toContain('Number(row.manuscript_id)')
    expect(recorderRaw).toContain('readonly manuscriptId: string')
    expect(recorder).not.toContain('readonly manuscriptId: number')
  })

  it('the ported units add no numeric manuscript identity of their own', () => {
    // Positive proof that the two ported units are identity-clean additions.
    const portedFiles = [
      'lib/revision/heldRecoveryAnchorCasWriter.ts',
      'lib/revision/heldRecoveryResolveAnchorCaller.ts',
      'lib/revision/heldRecoveryResolveAnchorCallerCore.ts',
    ]
    for (const rel of portedFiles) {
      const src = stripComments(readSource(rel))
      expect(src).not.toContain('Number(row.manuscript_id)')
      expect(src).not.toContain('manuscriptId: number')
    }
  })
})
