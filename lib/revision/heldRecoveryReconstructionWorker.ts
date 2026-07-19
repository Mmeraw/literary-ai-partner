/**
 * Held Recovery Reconstruction Worker (bounded first skeleton — Option B)
 *
 * A single-iteration worker that: claims one reconstruction work item, re-derives
 * the located anchor content under a scoped lease heartbeat, normalizes canonical
 * authority itself, and completes it through the persistence adapter. It returns
 * the persisted canonical authority for a LATER, SEPARATE continuation stage.
 *
 * DEFAULT-OFF (no production wiring): the worker is gated behind a default-off
 * feature flag and performs a STRICT no-op (returns { status: 'disabled' }
 * without contacting persistence) unless explicitly enabled. It is NOT wired into
 * any entrypoint, cron, or queue consumer.
 *
 * AUTHORITY / SCOPE BOUNDARY (must not be crossed here):
 *   This worker MUST NOT derive or persist: producer, recovery action, admission
 *   result, classification result, queue destination, cardType, or finalDecision.
 *   It depends ONLY on the persistence adapter + a pure reconstruction function.
 *   No queue writer, admission fn, classification fn, or final-review decision
 *   writer is accepted. No re-admission, reclassification, or queue transition is
 *   performed. No polling loop, process entrypoint, cron wiring, or caller handoff.
 *
 * IDENTITY NORMALIZATION:
 *   The reconstruction dependency returns located anchor CONTENT only. It may NOT
 *   redefine canonical identity. The worker builds authority from the CLAIMED
 *   manuscript/held-item versions + the reconstructed location, and computes the
 *   completion fingerprint from that normalized authority. manuscriptId is a
 *   canonical decimal STRING throughout (PR #1340) and is never numerically coerced.
 *
 * LEASE POLICY (Option B — scoped renewal heartbeat):
 *   Reconstruction is an arbitrary async dependency, so completion within the
 *   initial lease cannot be assumed. A heartbeat local to THIS claimed item renews
 *   the lease periodically. It may ONLY call renewLease — never claim/complete/
 *   fail/supersede/enqueue. On lease_lost / not_found / RPC exception it aborts
 *   reconstruction and marks ownership lost; no write happens after that. This is
 *   NOT a generic job framework.
 *
 * RETRY POLICY:
 *   A reconstruction exception is NEVER automatically retryable. Recognized
 *   deterministic and unknown failures go to failTerminal (only while ownership is
 *   still valid). Stack traces / raw messages are never persisted as reasons.
 */

import { createHash } from 'crypto'
import type {
  ClaimedReconstructionWork,
  HeldRecoveryReconstructionPersistenceAdapter,
} from './heldRecoveryReconstructionWriter'

// ── Default-off feature flag (no production wiring) ────────────────────────────

export const HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG =
  'HELD_RECOVERY_RECONSTRUCTION_WORKER_ENABLED'

/** Default-off: enabled ONLY when the flag is exactly the string 'true'. */
export function isHeldRecoveryReconstructionWorkerEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[HELD_RECOVERY_RECONSTRUCTION_WORKER_FLAG] === 'true'
}

// ── Reconstructed content, normalized authority, and fingerprint ──────────────

/** Located anchor CONTENT only. Deliberately NO manuscript/held-item version fields. */
export type ReconstructedAnchorLocation = {
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly recoveryMethod: 'source_text_location_only'
}

export type ReconstructedAnchorAuthority = {
  /** Canonical decimal manuscript-id STRING (bigint fidelity); never a number. */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly recoveryMethod: 'source_text_location_only'
  readonly completionFingerprint: string
}

/**
 * Deterministic fingerprint over the canonical identity + located-authority fields
 * ONLY. Deliberately excludes timestamp, worker id, attempt count, and claim token
 * so the same normalized authority always yields the same fingerprint. The
 * manuscriptId is hashed as its canonical STRING form — never a numeric value.
 */
export function fingerprintReconstructedAnchorAuthority(
  authority: Omit<ReconstructedAnchorAuthority, 'completionFingerprint'>,
): string {
  const canonical = {
    boundary: 'held_recovery_reconstructed_anchor_authority_v1',
    manuscriptId: authority.manuscriptId,
    manuscriptVersionSha: authority.manuscriptVersionSha,
    heldItemPersistedVersion: authority.heldItemPersistedVersion,
    sourceHash: authority.sourceHash,
    sourceStartOffset: authority.sourceStartOffset,
    sourceEndOffset: authority.sourceEndOffset,
    recoveryMethod: authority.recoveryMethod,
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

// ── Reconstruction failure seam (narrow) ──────────────────────────────────────

export type ReconstructionFailure =
  | { readonly kind: 'terminal'; readonly reason: string }
  | { readonly kind: 'lease_lost' }

/** Thrown by a reconstruction dependency to signal a modeled, classified failure. */
export class ReconstructionFailureError extends Error {
  readonly failure: ReconstructionFailure
  constructor(failure: ReconstructionFailure) {
    super(failure.kind === 'terminal' ? failure.reason : 'lease_lost')
    this.name = 'ReconstructionFailureError'
    this.failure = failure
  }
}

/** Fail-closed error for impossible/undermodeled persistence outcomes. */
export class ReconstructionWorkerContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReconstructionWorkerContractError'
  }
}

const UNKNOWN_TERMINAL_REASON = 'reconstruction_failed_unknown_error'

// ── Dependencies + result ─────────────────────────────────────────────────────

export type HeldRecoveryReconstructionWorkerDependencies = {
  readonly persistence: HeldRecoveryReconstructionPersistenceAdapter
  readonly reconstructAnchorAuthority: (
    work: ClaimedReconstructionWork,
    signal: AbortSignal,
  ) => Promise<ReconstructedAnchorLocation>
  readonly workerId: string
  readonly leaseSeconds: number
  readonly renewalIntervalMs?: number
  /**
   * Explicit enable override (tests / callers). Defaults to the default-off
   * feature flag. When false (the default), the worker is a strict no-op.
   */
  readonly enabled?: boolean
}

export type RunReconstructionWorkerOnceResult =
  | { readonly status: 'disabled' }
  | { readonly status: 'idle' }
  | {
      readonly status: 'completed'
      readonly workItemId: string
      readonly authority: ReconstructedAnchorAuthority
    }
  | { readonly status: 'already_completed'; readonly workItemId: string }
  | {
      readonly status: 'superseded'
      readonly workItemId: string
      readonly reason: 'canonical_version_moved' | 'superseded_by_later_attempt'
    }
  | { readonly status: 'lease_lost'; readonly workItemId: string }
  | { readonly status: 'failed_terminal'; readonly workItemId: string; readonly reason: string }

// ── Lease heartbeat (scoped to one claimed item; renewLease-only) ─────────────

async function runLeaseHeartbeat(
  persistence: HeldRecoveryReconstructionPersistenceAdapter,
  work: ClaimedReconstructionWork,
  leaseSeconds: number,
  intervalMs: number,
  controller: AbortController,
  onLeaseLost: () => void,
  onFailure: (error: unknown) => void,
): Promise<void> {
  // Bounded sleep that resolves early if the controller aborts.
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      if (controller.signal.aborted) return resolve()
      const timer = setTimeout(() => {
        controller.signal.removeEventListener('abort', onAbort)
        resolve()
      }, ms)
      const onAbort = () => {
        clearTimeout(timer)
        resolve()
      }
      controller.signal.addEventListener('abort', onAbort, { once: true })
    })

  while (!controller.signal.aborted) {
    await sleep(intervalMs)
    if (controller.signal.aborted) return

    let result
    try {
      result = await persistence.renewLease({
        workItemId: work.workItemId,
        claimToken: work.claimToken,
        leaseSeconds,
      })
    } catch (error) {
      // Ownership is no longer certain — do NOT convert into terminal failure.
      onFailure(error)
      onLeaseLost()
      controller.abort()
      return
    }

    switch (result.status) {
      case 'renewed':
        continue
      case 'lease_lost':
      case 'not_found':
        onLeaseLost()
        controller.abort()
        return
      default: {
        // Impossible via the typed adapter; treat as ownership-uncertain.
        onFailure(
          new ReconstructionWorkerContractError(
            `Unexpected renewLease result: ${JSON.stringify(result)}`,
          ),
        )
        onLeaseLost()
        controller.abort()
        return
      }
    }
  }
}

// ── Single-iteration entrypoint ───────────────────────────────────────────────

export async function runHeldRecoveryReconstructionWorkerOnce(
  deps: HeldRecoveryReconstructionWorkerDependencies,
): Promise<RunReconstructionWorkerOnceResult> {
  const { persistence, reconstructAnchorAuthority, workerId, leaseSeconds } = deps

  // Default-off strict no-op: return BEFORE any persistence contact or validation.
  const enabled = deps.enabled ?? isHeldRecoveryReconstructionWorkerEnabled()
  if (!enabled) {
    return { status: 'disabled' }
  }

  if (!(leaseSeconds > 0)) {
    throw new ReconstructionWorkerContractError('leaseSeconds must be a positive number')
  }
  const renewalIntervalMs =
    deps.renewalIntervalMs ?? Math.max(1_000, Math.floor((leaseSeconds * 1_000) / 3))
  if (!(renewalIntervalMs > 0)) {
    throw new ReconstructionWorkerContractError('renewalIntervalMs must be a positive number')
  }
  if (!(renewalIntervalMs < leaseSeconds * 1_000)) {
    throw new ReconstructionWorkerContractError(
      'renewalIntervalMs must be below the lease duration',
    )
  }

  const claim = await persistence.claimNext({ workerId, leaseSeconds })
  if (claim.status === 'no_work_available') {
    return { status: 'idle' }
  }
  const work = claim.work
  const workItemId = work.workItemId

  // ── Scoped heartbeat + reconstruction under ownership tracking ──────────────
  const controller = new AbortController()
  let ownershipLost = false
  let heartbeatFailure: unknown
  const onLeaseLost = () => {
    ownershipLost = true
  }
  const onFailure = (error: unknown) => {
    heartbeatFailure = error
  }
  const heartbeatPromise = runLeaseHeartbeat(
    persistence,
    work,
    leaseSeconds,
    renewalIntervalMs,
    controller,
    onLeaseLost,
    onFailure,
  )

  let reconstructed: ReconstructedAnchorLocation
  let reconstructionError: unknown
  let reconstructionThrew = false
  try {
    reconstructed = await reconstructAnchorAuthority(work, controller.signal)
  } catch (error) {
    reconstructionThrew = true
    reconstructionError = error
    reconstructed = undefined as unknown as ReconstructedAnchorLocation
  } finally {
    // No timer may survive the worker invocation.
    controller.abort()
    await heartbeatPromise
  }

  if (heartbeatFailure !== undefined) {
    // Ownership uncertain due to a renewal RPC exception: do not write further.
    // (The worker may log heartbeatFailure operationally; it is not persisted.)
    return { status: 'lease_lost', workItemId }
  }
  if (ownershipLost) {
    return { status: 'lease_lost', workItemId }
  }

  if (reconstructionThrew) {
    return await failFromReconstructionError(persistence, work, reconstructionError)
  }

  // ── Normalize authority: claimed identity/version + reconstructed location. ──
  const authority: ReconstructedAnchorAuthority = {
    manuscriptId: work.manuscriptId,
    manuscriptVersionSha: work.manuscriptVersionSha,
    heldItemPersistedVersion: work.heldItemPersistedVersion,
    sourceHash: reconstructed.sourceHash,
    sourceStartOffset: reconstructed.sourceStartOffset,
    sourceEndOffset: reconstructed.sourceEndOffset,
    recoveryMethod: reconstructed.recoveryMethod,
    completionFingerprint: '',
  }
  const completionFingerprint = fingerprintReconstructedAnchorAuthority(authority)

  // ── Complete using CLAIMED canonical versions + worker-computed fingerprint. ─
  const completion = await persistence.complete({
    workItemId,
    claimToken: work.claimToken,
    manuscriptVersionSha: work.manuscriptVersionSha,
    heldItemPersistedVersion: work.heldItemPersistedVersion,
    completionFingerprint,
  })

  switch (completion.status) {
    case 'completed':
      // Prefer the DB-returned persisted authority; attach worker-computed fingerprint.
      return {
        status: 'completed',
        workItemId,
        authority: {
          manuscriptId: completion.authority.manuscriptId,
          manuscriptVersionSha: completion.authority.manuscriptVersionSha,
          heldItemPersistedVersion: completion.authority.heldItemPersistedVersion,
          sourceHash: completion.authority.sourceHash,
          sourceStartOffset: completion.authority.sourceStartOffset,
          sourceEndOffset: completion.authority.sourceEndOffset,
          recoveryMethod: completion.authority.recoveryMethod,
          completionFingerprint,
        },
      }

    case 'already_completed':
      return { status: 'already_completed', workItemId }

    case 'rejected_stale':
      return await supersedeStale(persistence, workItemId, completion.reason)

    case 'lease_lost':
      return { status: 'lease_lost', workItemId }

    case 'idempotency_conflict':
      return await failTerminal(persistence, work, 'completion_fingerprint_mismatch')

    case 'rejected_terminal':
      throw new ReconstructionWorkerContractError(
        `complete returned rejected_terminal for work item ${workItemId}`,
      )

    case 'not_found':
      throw new ReconstructionWorkerContractError(
        `complete returned not_found for a claimed work item ${workItemId}`,
      )

    default: {
      const _exhaustive: never = completion
      throw new ReconstructionWorkerContractError(
        `Unexpected completion result: ${JSON.stringify(_exhaustive)}`,
      )
    }
  }
}

// ── Supersession handling (every branch inspected) ────────────────────────────

async function supersedeStale(
  persistence: HeldRecoveryReconstructionPersistenceAdapter,
  workItemId: string,
  reason: 'canonical_version_moved' | 'superseded_by_later_attempt',
): Promise<RunReconstructionWorkerOnceResult> {
  const supersession = await persistence.supersede({ workItemId, reason })
  switch (supersession.status) {
    case 'superseded':
    case 'already_superseded':
      return { status: 'superseded', workItemId, reason }
    case 'rejected_terminal':
      throw new ReconstructionWorkerContractError(
        `supersede returned rejected_terminal for work item ${workItemId}`,
      )
    case 'not_found':
      throw new ReconstructionWorkerContractError(
        `supersede returned not_found for work item ${workItemId}`,
      )
    default: {
      const _exhaustive: never = supersession
      throw new ReconstructionWorkerContractError(
        `Unexpected supersession result: ${JSON.stringify(_exhaustive)}`,
      )
    }
  }
}

// ── Failure handling ──────────────────────────────────────────────────────────

async function failFromReconstructionError(
  persistence: HeldRecoveryReconstructionPersistenceAdapter,
  work: ClaimedReconstructionWork,
  error: unknown,
): Promise<RunReconstructionWorkerOnceResult> {
  if (error instanceof ReconstructionFailureError) {
    if (error.failure.kind === 'lease_lost') {
      return { status: 'lease_lost', workItemId: work.workItemId }
    }
    return await failTerminal(persistence, work, sanitizeTerminalReason(error.failure.reason))
  }
  // Unknown exception → terminal with a sanitized deterministic code.
  // Never persist a stack trace or raw message as the terminal reason.
  return await failTerminal(persistence, work, UNKNOWN_TERMINAL_REASON)
}

async function failTerminal(
  persistence: HeldRecoveryReconstructionPersistenceAdapter,
  work: ClaimedReconstructionWork,
  reason: string,
): Promise<RunReconstructionWorkerOnceResult> {
  const result = await persistence.failTerminal({
    workItemId: work.workItemId,
    claimToken: work.claimToken,
    terminalReason: reason,
  })
  switch (result.status) {
    case 'failed_terminal':
      return { status: 'failed_terminal', workItemId: work.workItemId, reason: result.terminalReason }
    case 'already_failed_terminal':
      return { status: 'failed_terminal', workItemId: work.workItemId, reason }
    case 'lease_lost':
      return { status: 'lease_lost', workItemId: work.workItemId }
    case 'not_found':
      throw new ReconstructionWorkerContractError(
        `failTerminal returned not_found for a claimed work item ${work.workItemId}`,
      )
    default: {
      const _exhaustive: never = result
      throw new ReconstructionWorkerContractError(
        `Unexpected failTerminal result: ${JSON.stringify(_exhaustive)}`,
      )
    }
  }
}

/** Keep terminal reasons short, deterministic, and free of stack traces / PII. */
function sanitizeTerminalReason(reason: string): string {
  // Take only the first line so multi-line stack traces cannot leak. A modeled
  // terminal reason is expected to be a single short code/phrase.
  const firstLine = reason.split(/\r?\n/, 1)[0] ?? ''
  // Drop anything from an inline stack-frame marker (" at ") onward, defensively.
  const beforeFrame = firstLine.split(/\s+at\s+/, 1)[0] ?? firstLine
  const collapsed = beforeFrame
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  const trimmed = collapsed.slice(0, 120)
  return trimmed.length > 0 ? trimmed : UNKNOWN_TERMINAL_REASON
}
