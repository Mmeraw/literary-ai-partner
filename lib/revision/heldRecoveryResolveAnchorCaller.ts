/**
 * CANONICAL WRAPPER for the bounded, feature-gated resolve_anchor production caller.
 *
 * This is the ONLY module application/production code may import to run the caller.
 * Its public surface is deliberately minimal and executor-FREE:
 *   - runResolveAnchorRecoveryCaller      (the production entrypoint)
 *   - ResolveAnchorRecoveryRequest        (identity-only request type)
 *   - ResolveAnchorProductionDependencies (executor-free dependency surface)
 *   - ResolveAnchorCallerResult           (result union, for typing call sites)
 *   - RESOLVE_ANCHOR_CALLER_FLAG          (the feature-gate env key)
 *
 * The executor-capable injectable core lives in a SEPARATE module
 * (`heldRecoveryResolveAnchorCallerCore.ts`) that production code must not import.
 * That boundary is enforced by an authority-boundary contract test. This wrapper
 * hard-binds the canonical executor path by delegating to the core WITHOUT ever
 * supplying an orchestrator `dependencies` override, so the orchestrator always
 * uses its canonical `executeRecoveryAction`.
 *
 * There is intentionally NO exported function or dependency type here that accepts
 * an executor, orchestrator dependencies, or any generic pass-through capable of
 * replacing the executor. Naming something "internal" is not enforcement; isolation
 * of the core module plus the import-boundary test is.
 */

import {
  runResolveAnchorRecoveryCallerCore,
  type ResolveAnchorCallerBaseDependencies,
  type ResolveAnchorRecoveryRequest,
  type ResolveAnchorCallerResult,
} from './heldRecoveryResolveAnchorCallerCore'
import { executeRecoveryAction } from './heldRecoveryExecutor'

export type { ResolveAnchorRecoveryRequest, ResolveAnchorCallerResult }
export { RESOLVE_ANCHOR_CALLER_FLAG } from './heldRecoveryResolveAnchorCallerCore'

/**
 * PRODUCTION dependency surface for the resolve_anchor caller.
 *
 * Structurally identical to the core's executor-FREE base surface: it has NO
 * `dependencies`, `executeRecoveryAction`, `executor`, or `orchestratorDependencies`
 * field. Production code that constructs these deps therefore cannot choose or
 * replace the executor.
 */
export type ResolveAnchorProductionDependencies = ResolveAnchorCallerBaseDependencies

/**
 * PRODUCTION entrypoint. Accepts identity-only requests and an executor-free
 * dependency surface. Delegates to the injectable core while EXPLICITLY supplying
 * the canonical `executeRecoveryAction` imported directly from the executor module.
 *
 * This is a hard binding, not defaulting: the guarantee that production runs the
 * canonical executor does not depend on the orchestrator's internal fallback and
 * therefore survives future changes to that fallback. Application code MUST use
 * this function.
 */
export async function runResolveAnchorRecoveryCaller(
  request: ResolveAnchorRecoveryRequest,
  deps: ResolveAnchorProductionDependencies,
): Promise<ResolveAnchorCallerResult> {
  return runResolveAnchorRecoveryCallerCore(request, {
    ...deps,
    executeRecoveryAction,
  })
}
