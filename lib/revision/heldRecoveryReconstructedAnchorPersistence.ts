/**
 * Standalone, default-off caller that turns a validated reconstruction into a
 * single reconstructed-anchor persistence attempt.
 *
 * Scope fence (deliberate, do NOT widen): this unit contains NO worker import or
 * worker modification, NO queue transition, NO re-admission, NO retry, NO
 * attempt write, NO candidate mutation, NO logging policy, NO `.from(...)`, NO
 * second RPC, and NO environment mutation. It performs exactly one writer
 * invocation and returns the writer's typed result unchanged. Wiring this into
 * the runtime worker is a later, separate step.
 *
 * Execution order (fixed):
 *   1. flag check      -> if disabled, return { status: 'disabled' }
 *   2. build canonical content
 *   3. if the builder rejects, return { status: 'reconstruction_rejected', reason }
 *      (a build rejection is NEVER disguised as one of the five database outcomes)
 *   4. construct the exact adapter request (authority + built content + the three
 *      caller-supplied identity/CAS values; authority is not duplicated)
 *   5. invoke the writer once
 *   6. return the writer result unchanged
 *
 * Rejection behaviour: fail closed and surface the typed result. The five writer
 * outcomes (inserted, already_applied, rejected_conflict, rejected_stale,
 * rejected_missing) are passed through verbatim so the caller halts with a
 * precise reason, with no queue mutation and no recovery continuation.
 */
import {
  buildReconstructedAnchorContent,
  type BuildReconstructedAnchorContentInput,
  type BuildReconstructedAnchorContentRejectionReason,
} from './heldRecoveryReconstructedAnchorContent'
import {
  createSupabaseReconstructedAnchorInsertAdapter,
  type ReconstructedAnchorInsertAdapter,
  type ReconstructedAnchorInsertRequest,
  type ReconstructedAnchorInsertResult,
} from './heldRecoveryReconstructedAnchorWriter'

/**
 * Caller input. The persistence request is derived only from
 * `reconstruction.authority`, the built content, and these three
 * identity/CAS values — authority is never duplicated on this input.
 */
export type PersistReconstructedAnchorInput = {
  readonly heldItemId: string
  readonly opportunityId: string
  readonly expectedAuthorityVersion: string
  readonly reconstruction: BuildReconstructedAnchorContentInput
}

/**
 * Typed caller result:
 *   - `disabled`               the runtime kill switch is off
 *   - `reconstruction_rejected` the content builder rejected the reconstruction
 *   - the five writer outcomes  passed through unchanged
 */
export type ResolveAnchorPersistenceResult =
  | { readonly status: 'disabled' }
  | {
      readonly status: 'reconstruction_rejected'
      readonly reason: BuildReconstructedAnchorContentRejectionReason
    }
  | ReconstructedAnchorInsertResult

/**
 * Runtime kill switch. Default OFF is sufficient: the flag is read from the
 * environment on every call so it can be flipped without a redeploy. Only the
 * exact string "1" enables persistence; unset, or any other value ("true",
 * "yes", "0", whitespace, ...), leaves it disabled.
 */
function isPersistenceEnabled(): boolean {
  return process.env.HELD_RECOVERY_RECONSTRUCTED_ANCHOR_PERSISTENCE_ENABLED === '1'
}

export type PersistReconstructedAnchorDependencies = {
  readonly adapter?: ReconstructedAnchorInsertAdapter
}

/**
 * Persist a reconstructed anchor if — and only if — the runtime flag is on and
 * the reconstruction builds cleanly. Performs exactly one writer invocation.
 */
export async function persistReconstructedAnchor(
  input: PersistReconstructedAnchorInput,
  dependencies: PersistReconstructedAnchorDependencies = {},
): Promise<ResolveAnchorPersistenceResult> {
  // 1. Flag check, before any builder or writer work.
  if (!isPersistenceEnabled()) {
    return { status: 'disabled' }
  }

  // 2. Build canonical content.
  const built = buildReconstructedAnchorContent(input.reconstruction)

  // 3. Builder rejection is surfaced as its own typed outcome — never disguised
  //    as one of the five database outcomes.
  if (built.status === 'rejected') {
    return { status: 'reconstruction_rejected', reason: built.reason }
  }

  // 4. Construct the exact adapter request. Every field except the three
  //    caller-supplied identity/CAS values and the two built-content values is
  //    taken from reconstruction.authority; authority is not duplicated. The
  //    canonical manuscript id string is passed through unchanged.
  const { authority } = input.reconstruction
  const request: ReconstructedAnchorInsertRequest = {
    heldItemId: input.heldItemId,
    opportunityId: input.opportunityId,
    expectedAuthorityVersion: input.expectedAuthorityVersion,
    heldItemPersistedVersion: authority.heldItemPersistedVersion,
    completionFingerprint: authority.completionFingerprint,
    manuscriptId: authority.manuscriptId,
    manuscriptVersionSha: authority.manuscriptVersionSha,
    recoveryMethod: authority.recoveryMethod,
    sourceHash: authority.sourceHash,
    sourceStartOffset: authority.sourceStartOffset,
    sourceEndOffset: authority.sourceEndOffset,
    evidenceAnchor: built.value.evidenceAnchor,
    manuscriptCoordinates: built.value.manuscriptCoordinates,
  }

  // 5. Invoke the writer exactly once.
  const adapter = dependencies.adapter ?? createSupabaseReconstructedAnchorInsertAdapter()

  // 6. Return the writer result unchanged.
  return adapter.insertReconstructedAnchor(request)
}
