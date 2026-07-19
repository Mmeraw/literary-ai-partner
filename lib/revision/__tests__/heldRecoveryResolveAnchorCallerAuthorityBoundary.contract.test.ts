/**
 * AUTHORITY-BOUNDARY CONTRACT TEST.
 *
 * The injectable core `heldRecoveryResolveAnchorCallerCore.ts` exposes an
 * executor-capable dependency seam. If any production module imported it, that
 * module could substitute the recovery executor and bypass the canonical authority
 * path — defeating the entire seam-hardening effort.
 *
 * This test scans the repository's PRODUCTION source (excluding tests) and fails if
 * anything other than the single canonical wrapper imports the core module. It also
 * asserts the complementary direction: that the canonical wrapper's PUBLIC surface
 * exports no executor-capable symbol, and that no barrel re-exports the core or the
 * test harness.
 *
 * A source scan is deliberately used (not a runtime import graph) so the guarantee
 * holds even for modules that are never loaded in this test process.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Repo root = four levels up from lib/revision/__tests__/<this file>.
const REPO_ROOT = join(__dirname, '..', '..', '..')

const CORE_MODULE_BASENAME = 'heldRecoveryResolveAnchorCallerCore'
const WRAPPER_MODULE_BASENAME = 'heldRecoveryResolveAnchorCaller'
const TEST_HARNESS_BASENAME = 'resolveAnchorCallerTestHarness'

// Only the canonical wrapper may import the core. (Tests/helpers under __tests__
// are excluded from the production scan below.)
const CANONICAL_WRAPPER_RELATIVE = join('lib', 'revision', 'heldRecoveryResolveAnchorCaller.ts')

// Production source roots to scan. We intentionally exclude any __tests__ segment,
// node_modules, build output, and non-source dirs.
const SOURCE_ROOTS = ['lib', 'app', 'components', 'pages', 'src', 'server', 'workers']
const EXCLUDED_DIR_SEGMENTS = new Set([
  'node_modules',
  '__tests__',
  '.next',
  'dist',
  'build',
  'coverage',
  '.git',
])
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

function isExcludedPath(absPath: string): boolean {
  const rel = relative(REPO_ROOT, absPath)
  return rel.split(sep).some((segment) => EXCLUDED_DIR_SEGMENTS.has(segment))
}

function listProductionSourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      const abs = join(dir, entry)
      if (isExcludedPath(abs)) continue
      let st
      try {
        st = statSync(abs)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(abs)
      } else if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        out.push(abs)
      }
    }
  }
  for (const root of SOURCE_ROOTS) {
    const abs = join(REPO_ROOT, root)
    try {
      if (statSync(abs).isDirectory()) walk(abs)
    } catch {
      /* root does not exist in this repo layout; skip */
    }
  }
  return out
}

/**
 * True if `source` imports/requires/exports-from a module whose specifier ends in
 * exactly `<...>/<moduleBasename>` (optionally with a source extension). The
 * trailing `(?:\.[a-z]+)?` plus the closing quote anchor prevents matching a
 * LONGER basename that merely starts with `moduleBasename` (e.g. scanning for the
 * wrapper must not match `...CallerCore`). The required leading `/` ensures we only
 * match a path segment boundary, never a substring inside another identifier.
 */
function referencesModule(source: string, moduleBasename: string): boolean {
  const specifier = new RegExp(
    String.raw`['"][^'"]*/` + moduleBasename + String.raw`(?:\.[a-zA-Z]+)?['"]`,
  )
  return specifier.test(source)
}

describe('resolve_anchor caller — authority boundary contract', () => {
  const productionFiles = listProductionSourceFiles()

  it('the production scan actually found source files (sanity)', () => {
    expect(productionFiles.length).toBeGreaterThan(0)
    // The core, wrapper, and harness must be discoverable in the tree.
    const allText = productionFiles.map((f) => relative(REPO_ROOT, f))
    expect(allText.some((f) => f.includes(WRAPPER_MODULE_BASENAME))).toBe(true)
  })

  it('no production file imports the injectable core except the canonical wrapper', () => {
    const offenders: string[] = []
    for (const abs of productionFiles) {
      const rel = relative(REPO_ROOT, abs)
      // The core module itself and the canonical wrapper are the only allowed files
      // that may reference the core basename.
      if (rel === CANONICAL_WRAPPER_RELATIVE) continue
      if (rel.endsWith(`${CORE_MODULE_BASENAME}.ts`)) continue
      const src = readFileSync(abs, 'utf8')
      if (referencesModule(src, CORE_MODULE_BASENAME)) {
        offenders.push(rel)
      }
    }
    expect(offenders).toEqual([])
  })

  it('no production file imports the test-only harness', () => {
    const offenders: string[] = []
    for (const abs of productionFiles) {
      const src = readFileSync(abs, 'utf8')
      if (referencesModule(src, TEST_HARNESS_BASENAME)) {
        offenders.push(relative(REPO_ROOT, abs))
      }
    }
    expect(offenders).toEqual([])
  })

  it('the canonical wrapper imports the core (so it is the single bridge)', () => {
    const wrapperAbs = join(REPO_ROOT, CANONICAL_WRAPPER_RELATIVE)
    const src = readFileSync(wrapperAbs, 'utf8')
    expect(referencesModule(src, CORE_MODULE_BASENAME)).toBe(true)
  })

  it('the canonical wrapper public surface exports no executor-capable symbol', () => {
    const wrapperAbs = join(REPO_ROOT, CANONICAL_WRAPPER_RELATIVE)
    const src = readFileSync(wrapperAbs, 'utf8')
    // The wrapper must not re-export the core's injectable entrypoint or its
    // executor-capable dependency type, nor define its own executor-taking export,
    // nor re-export the executor function or the generic orchestrator-dependencies
    // type through its public surface.
    const forbiddenExports = [
      'runResolveAnchorRecoveryCallerCore',
      'ResolveAnchorCallerCoreDependencies',
      'runResolveAnchorRecoveryCallerInternal',
      'ResolveAnchorCallerInternalDeps',
      'executeRecoveryAction',
      'HeldRecoveryRuntimeDependencies',
    ]
    // We check for `export ... <name>` occurrences (export statements), not mere
    // mentions in comments. The wrapper legitimately IMPORTS executeRecoveryAction
    // (a non-export line), so restricting the match to lines beginning with `export`
    // avoids a false positive on that import.
    const offenders = forbiddenExports.filter((name) => {
      const re = new RegExp(String.raw`^\s*export[^\n]*\b${name}\b`, 'm')
      return re.test(src)
    })
    expect(offenders).toEqual([])
    // Sanity: the wrapper still exports the public entrypoint.
    expect(/export\s+async\s+function\s+runResolveAnchorRecoveryCaller\b/.test(src)).toBe(true)
  })

  it('the injectable core exposes no generic orchestrator-dependencies pass-through', () => {
    const coreAbs = join(REPO_ROOT, 'lib', 'revision', `${CORE_MODULE_BASENAME}.ts`)
    const src = readFileSync(coreAbs, 'utf8')
    // The narrowed seam requires a single `executeRecoveryAction` function. The core
    // must NOT declare a `dependencies` PROPERTY on its dependency type (the old
    // generic HeldRecoveryRuntimeDependencies pass-through). We look specifically for
    // a `readonly dependencies` member declaration, not for the internal orchestrator
    // call site (which legitimately builds `{ executeRecoveryAction }` and passes it
    // under the orchestrator's own `dependencies:` option name).
    expect(/readonly\s+dependencies\b/.test(src)).toBe(false)
    // It also must not import the generic orchestrator-dependencies TYPE for use as a
    // caller seam.
    expect(/\bHeldRecoveryRuntimeDependencies\b/.test(src)).toBe(false)
    // The one approved capability is present and required (no `?`).
    expect(/readonly\s+executeRecoveryAction\s*:/.test(src)).toBe(true)
    // And the internal orchestrator call binds exactly that one capability.
    expect(/dependencies:\s*\{\s*executeRecoveryAction:/.test(src)).toBe(true)
  })
})
