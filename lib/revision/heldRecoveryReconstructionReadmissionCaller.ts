/**
 * Bounded runtime handoff from canonical reconstructed-anchor persistence to
 * the existing Held Recovery Readmission authority.
 *
 * The outer function composes the already-existing persistence caller with one
 * identity-only Readmission call. Readmission never receives reconstructed
 * prose, anchor coordinates, versions, fingerprints, evidence, manuscript
 * identity, candidates, classification, or queue state from this caller. It
 * reloads those values from canonical persistence and fails closed itself.
 *
 * Scope fence: no worker registration, API/cron route, classification, queue
 * transition, new persistence model, retry scheduling, UI work, or Unit 8 work.
 */

import { logger } from '@/lib/observability/logger'
import {
  persistReconstructedAnchor,
  type PersistReconstructedAnchorDependencies,
  type PersistReconstructedAnchorInput,
  type ResolveAnchorPersistenceResult,
} from './heldRecoveryReconstructedAnchorPersistence'
import {
  runHeldRecoveryReconstructionReadmission,
  type ReadmissionDependencies,
  type ReadmissionResult,
  type RunReadmissionInput,
} from './heldRecoveryReconstructionReadmission'

/**
 * Default-off exact-job allowlist. Only one evaluation job can be enabled at a
 * time; boolean values and comma-separated lists are deliberately unsupported.
 */
export const HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG =
  'HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_ID'

export function isHeldRecoveryReconstructionReadmissionEnabledForJob(
  jobId: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const targetJobId = env[HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG]
  return typeof targetJobId === 'string' && targetJobId.length > 0 && targetJobId === jobId
}

export type HeldRecoveryReadmissionAuditEvent = {
  readonly boundary: 'held_recovery_reconstruction_readmission_runtime_v1'
  readonly event:
    | 'reconstruction_persisted'
    | 'canonical_anchor_verified'
    | 'readmission_rejected'
    | 'workbench_admission_evaluated'
    | 'readmission_failed_closed'
  readonly jobId: string
  readonly heldItemId: string
  readonly opportunityId: string
  readonly persistenceStatus?: 'inserted' | 'already_applied'
  readonly readmissionStatus?: ReadmissionResult['status']
  readonly opportunityVersion?: string
  readonly admissionStatus?: 'admission_passed' | 'withheld'
  readonly passedCandidateCount?: number
  readonly canonicalAnchorVerified?: boolean
  readonly existingOpportunityOnly?: true
  readonly duplicateOpportunityCreated?: false
  readonly failureType?: string
}

export type HeldRecoveryReadmissionAuditSink = (
  event: HeldRecoveryReadmissionAuditEvent,
) => void

export type HeldRecoveryReconstructionReadmissionCallerDependencies = {
  readonly persistence?: PersistReconstructedAnchorDependencies
  readonly readmission: ReadmissionDependencies
  /** Test seam for the exact-job feature gate only. */
  readonly isEnabledForJob?: (jobId: string) => boolean
  /** Optional structured sink. Defaults to the repository JSON logger. */
  readonly audit?: HeldRecoveryReadmissionAuditSink
}

export type RunPersistedReconstructionReadmissionInput = {
  readonly jobId: string
  readonly persistence: PersistReconstructedAnchorInput
}

export type PersistedReconstructionReadmissionResult =
  | {
      readonly status: 'persistence_not_completed'
      readonly persistence: Exclude<
        ResolveAnchorPersistenceResult,
        { readonly status: 'inserted' | 'already_applied' }
      >
    }
  | {
      readonly status: 'readmission_gate_disabled'
      readonly persistence: Extract<
        ResolveAnchorPersistenceResult,
        { readonly status: 'inserted' | 'already_applied' }
      >
    }
  | {
      readonly status: 'readmission_completed'
      readonly persistence: Extract<
        ResolveAnchorPersistenceResult,
        { readonly status: 'inserted' | 'already_applied' }
      >
      readonly readmission: ReadmissionResult
    }

export class HeldRecoveryReadmissionCallerContractError extends Error {
  constructor(message: string) {
    super(`Held Recovery Readmission caller contract violated: ${message}`)
    this.name = 'HeldRecoveryReadmissionCallerContractError'
  }
}

function requireIdentity(value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HeldRecoveryReadmissionCallerContractError(`${field} must be a non-empty string`)
  }
}

function defaultAudit(event: HeldRecoveryReadmissionAuditEvent): void {
  logger.info('Held Recovery reconstruction Readmission audit', {
    event: event.event,
    boundary: event.boundary,
    job_id: event.jobId,
    held_item_id: event.heldItemId,
    opportunity_id: event.opportunityId,
    persistence_status: event.persistenceStatus,
    readmission_status: event.readmissionStatus,
    opportunity_version: event.opportunityVersion,
    admission_status: event.admissionStatus,
    passed_candidate_count: event.passedCandidateCount,
    canonical_anchor_verified: event.canonicalAnchorVerified,
    existing_opportunity_only: event.existingOpportunityOnly,
    duplicate_opportunity_created: event.duplicateOpportunityCreated,
    failure_type: event.failureType,
  })
}

function emitAudit(
  sink: HeldRecoveryReadmissionAuditSink | undefined,
  event: HeldRecoveryReadmissionAuditEvent,
): void {
  try {
    const audit = sink ?? defaultAudit
    audit(event)
  } catch {
    // Observability is evidence, not a second authority; it cannot alter flow.
    logger.warn('Held Recovery Readmission audit sink failed', {
      event: 'held_recovery.readmission.audit_sink_failed',
      job_id: event.jobId,
      held_item_id: event.heldItemId,
      opportunity_id: event.opportunityId,
    })
  }
}

function auditBase(input: RunReadmissionInput) {
  return {
    boundary: 'held_recovery_reconstruction_readmission_runtime_v1' as const,
    jobId: input.jobId,
    heldItemId: input.heldItemId,
    opportunityId: input.opportunityId,
  }
}

function opportunityVersionOf(result: ReadmissionResult): string | undefined {
  return 'opportunityVersion' in result ? result.opportunityVersion : undefined
}

function admissionOf(result: ReadmissionResult) {
  return 'admission' in result ? result.admission : undefined
}

/**
 * The only function that invokes Readmission. Its runtime input is exactly the
 * three identities authorized by the Readmission contract.
 */
export async function runHeldRecoveryReconstructionReadmissionCaller(
  input: RunReadmissionInput,
  deps: Pick<
    HeldRecoveryReconstructionReadmissionCallerDependencies,
    'readmission' | 'audit'
  >,
): Promise<ReadmissionResult> {
  requireIdentity(input.jobId, 'jobId')
  requireIdentity(input.heldItemId, 'heldItemId')
  requireIdentity(input.opportunityId, 'opportunityId')

  const base = auditBase(input)
  let result: ReadmissionResult
  try {
    result = await runHeldRecoveryReconstructionReadmission(input, deps.readmission)
  } catch (error) {
    emitAudit(deps.audit, {
      ...base,
      event: 'readmission_failed_closed',
      canonicalAnchorVerified: false,
      existingOpportunityOnly: true,
      duplicateOpportunityCreated: false,
      failureType: error instanceof Error ? error.name : 'UnknownError',
    })
    throw error
  }

  const admission = admissionOf(result)
  const opportunityVersion = opportunityVersionOf(result)
  const canonicalAnchorVerified =
    result.status === 'admitted' ||
    result.status === 'not_admitted' ||
    result.status === 'unchanged'

  emitAudit(deps.audit, canonicalAnchorVerified
    ? {
        ...base,
        event: 'canonical_anchor_verified',
        readmissionStatus: result.status,
        opportunityVersion,
        canonicalAnchorVerified: true,
        existingOpportunityOnly: true,
        duplicateOpportunityCreated: false,
      }
    : {
        ...base,
        event: 'readmission_rejected',
        readmissionStatus: result.status,
        canonicalAnchorVerified: false,
        existingOpportunityOnly: true,
        duplicateOpportunityCreated: false,
      })

  if (admission) {
    emitAudit(deps.audit, {
      ...base,
      event: 'workbench_admission_evaluated',
      readmissionStatus: result.status,
      opportunityVersion,
      admissionStatus: admission.admission_status,
      passedCandidateCount: admission.passedCandidateCount,
      canonicalAnchorVerified: true,
      existingOpportunityOnly: true,
      duplicateOpportunityCreated: false,
    })
  }

  return result
}

/**
 * Runtime composition boundary: persist the reconstructed anchor first, then
 * invoke the identity-only caller exactly once for inserted/idempotent success.
 * Every failure status halts before Readmission. The feature gate controls only
 * the new handoff, so disabled operation preserves existing persistence behavior.
 */
export async function persistReconstructedAnchorAndReadmit(
  input: RunPersistedReconstructionReadmissionInput,
  deps: HeldRecoveryReconstructionReadmissionCallerDependencies,
): Promise<PersistedReconstructionReadmissionResult> {
  requireIdentity(input.jobId, 'jobId')

  const persistence = await persistReconstructedAnchor(input.persistence, deps.persistence)
  if (persistence.status !== 'inserted' && persistence.status !== 'already_applied') {
    return { status: 'persistence_not_completed', persistence }
  }

  const identity: RunReadmissionInput = {
    jobId: input.jobId,
    heldItemId: input.persistence.heldItemId,
    opportunityId: input.persistence.opportunityId,
  }
  const enabledForJob = deps.isEnabledForJob ??
    isHeldRecoveryReconstructionReadmissionEnabledForJob
  if (!enabledForJob(identity.jobId)) {
    return { status: 'readmission_gate_disabled', persistence }
  }

  emitAudit(deps.audit, {
    ...auditBase(identity),
    event: 'reconstruction_persisted',
    persistenceStatus: persistence.status,
    existingOpportunityOnly: true,
    duplicateOpportunityCreated: false,
  })

  const readmission = await runHeldRecoveryReconstructionReadmissionCaller(identity, deps)
  return { status: 'readmission_completed', persistence, readmission }
}
