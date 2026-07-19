/**
 * INJECTABLE CORE for the bounded resolve_anchor production caller.
 *
 * ⚠️ AUTHORITY BOUNDARY ⚠️
 * This module exposes the single executor-capable dependency seam
 * (`ResolveAnchorCallerCoreDependencies.executeRecoveryAction`). Any code that
 * imports this module can, in principle, substitute the recovery executor and
 * thereby bypass the canonical authority path. It therefore MUST NOT be imported by
 * production code.
 *
 * The ONLY permitted importers are:
 *   - lib/revision/heldRecoveryResolveAnchorCaller.ts  (the canonical wrapper, which
 *     hard-binds the canonical executor by explicitly supplying executeRecoveryAction)
 *   - lib/revision/__tests__/**                        (tests / test helpers)
 *
 * This boundary is enforced by an authority-boundary contract test
 * (heldRecoveryResolveAnchorCallerAuthorityBoundary.contract.test.ts) that scans
 * production source and fails if any other file imports this core.
 *
 * SCOPE FENCE (do not widen in this file):
 *  - Handles the `resolve_anchor` recovery action ONLY. Any other recovery family
 *    is rejected before the executor is invoked.
 *  - Accepts STABLE IDENTITY ONLY. It never accepts caller-supplied producer,
 *    reasonCode, recoveryAction, authoritySnapshot, recommendation, cardType,
 *    retryDisposition, or appliedAt. All authority is loaded from canonical state.
 *  - Queue state changes go EXCLUSIVELY through
 *    apply_held_recovery_queue_transition_atomic (via applyHeldQueueTransition).
 *  - It does not schedule retries, mutate the retry RPC, write finalDecision /
 *    cardType / classification surfaces, render UI, or expand the dispatcher.
 *  - Default-OFF feature gate. With the gate off it is a strict no-op: loaders are
 *    never called, no executor runs, and nothing is written.
 *  - `applied_at` is intentionally omitted so the database assigns now().
 *
 * O-B1: the retry-schedule residual race is a consciously accepted operational
 * residual for this first caller (see held-recovery-ob1-decision-record.md). This
 * caller performs no retry scheduling.
 */

import {
  runHeldRecoveryRuntimeOrchestrationWithAttemptRecording,
  type HeldItemReference,
  type HeldRecoveryRuntimeLoaders,
  type HeldRecoveryRuntimeOutcome,
} from './heldRecoveryRuntimeOrchestrator'
import type { executeRecoveryAction } from './heldRecoveryExecutor'
import {
  getRecoveryContractForReason,
  type HeldReasonRecoveryContract,
} from './heldRecoveryReasons'
import type {
  HeldRecoveryAttemptPersistenceAdapter,
  HeldRecoveryAttemptRecord,
  RecoveryAttemptTrigger,
} from './heldRecoveryAttemptRecorder'
import {
  decideHeldQueueTransition,
  type HeldQueueState,
} from './heldRecoveryQueueTransitionPolicy'
import {
  applyHeldQueueTransition,
  type HeldQueueTransitionPersistenceAdapter,
  type HeldQueueTransitionWriteResult,
} from './heldRecoveryQueueTransitionWriter'

/**
 * Identity-only request. The caller reloads all authority from canonical state
 * using this identity; it MUST NOT carry producer, reason, action, authority
 * version, candidate text, recommendation, cardType, retry disposition, or
 * applied_at.
 */
export type ResolveAnchorRecoveryRequest = {
  readonly evaluationId: string
  readonly opportunityId: string
  readonly heldItemId: string
}

/**
 * Shared, executor-FREE dependency surface. This is re-exported by the canonical
 * wrapper as `ResolveAnchorProductionDependencies`. It has NO executor parameter
 * and NO orchestrator `dependencies` pass-through.
 */
export type ResolveAnchorCallerBaseDependencies = {
  readonly loaders: HeldRecoveryRuntimeLoaders
  readonly attemptPersistence: HeldRecoveryAttemptPersistenceAdapter
  readonly queueTransitionPersistence: HeldQueueTransitionPersistenceAdapter
  /** Defaults to the process env gate; injectable for tests of the gate only. */
  readonly isEnabled?: () => boolean
  /** Trigger recorded on the attempt; defaults to the system caller trigger. */
  readonly trigger?: RecoveryAttemptTrigger
  readonly nowIso?: string
}

/**
 * CORE dependency surface = base surface PLUS exactly ONE additional, required,
 * narrowly-typed capability: the recovery executor function.
 *
 * This is the ONLY typed surface in the codebase that admits an executor override,
 * and it exists solely in this non-production-importable core. It deliberately does
 * NOT accept the orchestrator's generic runtime-dependencies object: an input-builder
 * override could change what reaches the executor and thereby alter the effective
 * canonical recovery input, which is broader than the approved executor-only seam.
 *
 * `executeRecoveryAction` is REQUIRED (not optional): the production wrapper must
 * explicitly supply the canonical function, so the guarantee survives any future
 * change to the orchestrator's own defaulting. Tests may substitute this one
 * function; they cannot replace loaders, input construction, contract resolution,
 * or queue decisions.
 */
export type ResolveAnchorCallerCoreDependencies = ResolveAnchorCallerBaseDependencies & {
  /** The recovery executor. Required. The sole replaceable capability. */
  readonly executeRecoveryAction: typeof executeRecoveryAction
}

export type ResolveAnchorCallerResult =
  | { readonly status: 'gate_disabled' }
  | { readonly status: 'not_anchor'; readonly recoveryAction: string | 'unresolved' }
  | {
      readonly status: 'ran'
      readonly runtimeOutcome: HeldRecoveryRuntimeOutcome
      readonly recordedAttempt: HeldRecoveryAttemptRecord | null
      readonly queueTransition: HeldQueueTransitionWriteResult | null
    }

/** Default-off feature gate, matching the repo's `=== 'true'` opt-in convention. */
export const RESOLVE_ANCHOR_CALLER_FLAG = 'HELD_RECOVERY_RESOLVE_ANCHOR_CALLER_ENABLED'

function defaultIsEnabled(): boolean {
  return process.env[RESOLVE_ANCHOR_CALLER_FLAG] === 'true'
}

/**
 * The queue transition this caller is permitted to request: an in-flight recovery
 * attempt that completed moves the queue head to reclassification-pending. The
 * caller does NOT choose target states for other outcomes; only a `completed`
 * runtime outcome with a recorded attempt drives a transition.
 */
const CALLER_FROM_STATE: HeldQueueState = 'recovery_attempt_running'
const CALLER_TO_STATE: HeldQueueState = 'recovered_pending_reclassification'

/**
 * INJECTABLE CORE implementation. Accepts an executor-capable dependency surface.
 * Do NOT import this from production code; use the canonical wrapper
 * `runResolveAnchorRecoveryCaller` instead (it passes no `dependencies`, so the
 * orchestrator uses its canonical executor).
 */
export async function runResolveAnchorRecoveryCallerCore(
  request: ResolveAnchorRecoveryRequest,
  deps: ResolveAnchorCallerCoreDependencies,
): Promise<ResolveAnchorCallerResult> {
  const isEnabled = deps.isEnabled ?? defaultIsEnabled

  // 1. Feature gate, default OFF. Strict no-op: no loaders, no executor, no writes.
  if (!isEnabled()) {
    return { status: 'gate_disabled' }
  }

  const reference: HeldItemReference = { heldItemId: request.heldItemId }

  // 2. Load canonical held item independently to resolve its authoritative
  //    reason/producer. Admission for a non-anchor family is refused BEFORE the
  //    executor is invoked. (The orchestrator re-loads canonical state itself for
  //    execution; this pre-check enforces the resolve_anchor-only fence up front.)
  const heldItemResult = await deps.loaders.loadHeldItem(reference)
  if (heldItemResult.status !== 'loaded') {
    // Not loadable as canonical authority -> not an anchor admission; defer the
    // typed rejection to the orchestrator, which classifies load failures.
    return await runOrchestrationAndMaybeTransition(request, reference, deps)
  }

  const contract: HeldReasonRecoveryContract | undefined = getRecoveryContractForReason({
    code: heldItemResult.value.reason.code,
    source: heldItemResult.value.reason.source,
  })

  // 3. resolve_anchor-only admission. Refuse any other family without invoking
  //    the executor or writing anything.
  if (!contract || contract.recoveryAction !== 'resolve_anchor') {
    return { status: 'not_anchor', recoveryAction: contract?.recoveryAction ?? 'unresolved' }
  }

  return await runOrchestrationAndMaybeTransition(request, reference, deps)
}

async function runOrchestrationAndMaybeTransition(
  request: ResolveAnchorRecoveryRequest,
  reference: HeldItemReference,
  deps: ResolveAnchorCallerCoreDependencies,
): Promise<ResolveAnchorCallerResult> {
  // 4. Invoke the existing runtime orchestrator + recorder. The orchestrator
  //    independently reloads canonical state and resolves the contract; the caller
  //    injects no authority. The executor is the canonical function in production
  //    (supplied explicitly by the wrapper) and may be substituted only by tests.
  const recording = await runHeldRecoveryRuntimeOrchestrationWithAttemptRecording(
    reference,
    deps.loaders,
    deps.attemptPersistence,
    {
      trigger: deps.trigger ?? 'system',
      nowIso: deps.nowIso,
      // Construct the orchestrator dependency object INTERNALLY from exactly the
      // one approved capability. We never forward an arbitrary orchestrator
      // dependencies object, so the input builder / contract resolution / loaders
      // remain canonical and cannot be replaced through this caller.
      dependencies: { executeRecoveryAction: deps.executeRecoveryAction },
    },
  )

  const recordedAttempt =
    recording.attemptRecording && recording.attemptRecording.status !== undefined
      ? recording.attemptRecording.record
      : null

  // 5. Queue transition ONLY on a completed recovery with a recorded attempt, and
  //    ONLY via the atomic RPC. No transition for rejected/deferred/unchanged.
  if (recording.runtimeOutcome.status !== 'completed' || !recordedAttempt) {
    return {
      status: 'ran',
      runtimeOutcome: recording.runtimeOutcome,
      recordedAttempt,
      queueTransition: null,
    }
  }

  const decision = decideHeldQueueTransition({
    recordedAttempt,
    from: CALLER_FROM_STATE,
    requestedTo: CALLER_TO_STATE,
  })

  // 6. Apply via the atomic queue-transition RPC. applied_at is intentionally
  //    OMITTED so the database assigns now().
  const queueTransition = await applyHeldQueueTransition(deps.queueTransitionPersistence, {
    heldItemId: request.heldItemId,
    decision,
    // appliedAt intentionally omitted (DB assigns now()).
  })

  return {
    status: 'ran',
    runtimeOutcome: recording.runtimeOutcome,
    recordedAttempt,
    queueTransition,
  }
}
