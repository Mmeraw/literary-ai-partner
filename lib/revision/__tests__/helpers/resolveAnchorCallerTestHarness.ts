/**
 * TEST-ONLY harness for the resolve_anchor caller's executor seam.
 *
 * This module lives under `__tests__/helpers` and is imported ONLY by tests. It is
 * one of the two permitted importers of the injectable core
 * (`heldRecoveryResolveAnchorCallerCore.ts`); the other is the canonical wrapper.
 * Production code cannot reach the executor seam: the public wrapper
 * (`heldRecoveryResolveAnchorCaller.ts`) exposes no executor parameter, and the
 * authority-boundary contract test fails if any production file imports the core.
 *
 * The injected executor proves caller RECORDING and QUEUE-TRANSITION MECHANICS when
 * the orchestrator receives a given result. It does NOT prove that the canonical
 * `executeResolveAnchor` can currently produce `completed` — in production it
 * returns `deferred_work` on its happy path (see held-recovery-continuation-trace.md).
 */

import {
  runResolveAnchorRecoveryCallerCore,
  type ResolveAnchorRecoveryRequest,
  type ResolveAnchorCallerResult,
  type ResolveAnchorCallerCoreDependencies,
} from '@/lib/revision/heldRecoveryResolveAnchorCallerCore'

/**
 * Test-only override surface. It is exactly the CORE dependency surface, whose only
 * capability beyond the production base surface is the single `executeRecoveryAction`
 * function. Tests may substitute that one function to drive synthetic executor
 * results; they cannot replace loaders, input construction, contract resolution, or
 * queue decisions (no generic orchestrator-dependencies object is exposed).
 */
export type ResolveAnchorCallerTestOverrides = ResolveAnchorCallerCoreDependencies

/**
 * Build a bound runner that invokes the injectable CORE with a test executor seam.
 * Use only in tests.
 */
export function buildResolveAnchorRecoveryCallerForTest(
  overrides: ResolveAnchorCallerTestOverrides,
): (request: ResolveAnchorRecoveryRequest) => Promise<ResolveAnchorCallerResult> {
  return (request: ResolveAnchorRecoveryRequest) =>
    runResolveAnchorRecoveryCallerCore(request, overrides)
}

/**
 * Convenience one-shot: run the injectable core once with the given overrides.
 */
export function runResolveAnchorRecoveryCallerWithTestSeam(
  request: ResolveAnchorRecoveryRequest,
  overrides: ResolveAnchorCallerTestOverrides,
): Promise<ResolveAnchorCallerResult> {
  return runResolveAnchorRecoveryCallerCore(request, overrides)
}
