/**
 * Default-unwired Held Recovery reconstruction re-admission stage.
 *
 * Authority rule: callers provide identity only. Reconstructed evidence and
 * coordinates are loaded from the immutable persisted authority row, validated
 * against the current held item, then applied through the existing anchor CAS.
 * Admission consumes a separately loaded, fully hydrated Workbench input so
 * candidate/readiness/context fields are never fabricated or silently omitted.
 *
 * This module performs no classification, queue transition, finalDecision
 * write, retry scheduling, worker registration, cron/API wiring, or Unit 8 work.
 */

import { createHash } from 'node:crypto'
import type {
  CanonicalHeldItem,
  CanonicalPersistedOpportunity,
  HeldItemReference,
  HeldRecoveryRuntimeLoaders,
} from './heldRecoveryRuntimeOrchestrator'
import type {
  ReconstructedAnchorLoader,
  ReconstructedAnchorRecord,
} from './heldRecoveryReconstructedAnchorLoader'
import type {
  ApplyAnchorCasResult,
  HeldRecoveryAnchorCasPersistenceAdapter,
} from './heldRecoveryAnchorCasWriter'
import {
  fingerprintReconstructedAnchorAuthority,
  type ReconstructedAnchorAuthority,
} from './heldRecoveryReconstructionWorker'
import { revisionOpportunityVersionFor } from './heldRecoveryVersioning'
import {
  runWorkbenchAdmissionGate,
  type ReviseAdmissionResult,
  type WorkbenchAdmissionInput,
} from './reviseAdmissionGate'

export type RunReadmissionInput = {
  readonly jobId: string
  readonly heldItemId: string
  readonly opportunityId: string
}

export type AdmissionOpportunityLoadResult =
  | {
      readonly status: 'loaded'
      readonly opportunityVersion: string
      readonly value: WorkbenchAdmissionInput
    }
  | { readonly status: 'missing' }
  | { readonly status: 'conflict'; readonly reason: string }
  | { readonly status: 'invalid'; readonly reason: string }

export type AdmissionOpportunityLoader = (input: {
  readonly jobId: string
  readonly opportunityId: string
}) => Promise<AdmissionOpportunityLoadResult>

export type ReadmissionDependencies = {
  readonly loaders: Pick<HeldRecoveryRuntimeLoaders, 'loadHeldItem' | 'loadOpportunityLedger'>
  readonly loadReconstructedAnchor: ReconstructedAnchorLoader
  readonly loadAdmissionOpportunity: AdmissionOpportunityLoader
  readonly casWriter: HeldRecoveryAnchorCasPersistenceAdapter
  readonly anchorFingerprintOf?: (input: AnchorFingerprintInput) => string
  readonly runAdmissionGate?: (input: WorkbenchAdmissionInput) => ReviseAdmissionResult
}

export type AnchorFingerprintInput = {
  readonly opportunityId: string
  readonly ledgerSourceHash: string
  readonly evidenceAnchor: string
  readonly manuscriptCoordinates: string
}

export type ReadmissionResult =
  | {
      readonly status: 'admitted'
      readonly opportunityVersion: string
      readonly admission: ReviseAdmissionResult
      readonly anchorChanged: true
    }
  | {
      readonly status: 'not_admitted'
      readonly opportunityVersion: string
      readonly admission: ReviseAdmissionResult
      readonly anchorChanged: true
    }
  | {
      readonly status: 'unchanged'
      readonly opportunityVersion: string
      readonly admission: ReviseAdmissionResult
    }
  | {
      readonly status: 'rejected_stale'
      readonly reason:
        | 'reconstruction_missing'
        | 'completion_fingerprint_mismatch'
        | 'held_item_version_changed'
    }
  | { readonly status: 'persistence_conflict'; readonly reason: string }

export class ReadmissionContractError extends Error {
  constructor(message: string) {
    super(`Held Recovery re-admission contract violated: ${message}`)
    this.name = 'ReadmissionContractError'
  }
}

export function defaultAnchorFingerprint(input: AnchorFingerprintInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        boundary: 'held_recovery_anchor_fingerprint_v1',
        opportunity_id: input.opportunityId,
        ledger_source_hash: input.ledgerSourceHash,
        evidence_anchor: input.evidenceAnchor,
        manuscript_coordinates: input.manuscriptCoordinates,
      }),
    )
    .digest('hex')
}

function requireIdentity(value: string, field: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ReadmissionContractError(`${field} must be a non-empty string`)
  }
}

async function reloadCanonical(
  loaders: Pick<HeldRecoveryRuntimeLoaders, 'loadHeldItem' | 'loadOpportunityLedger'>,
  input: RunReadmissionInput,
): Promise<{ heldItem: CanonicalHeldItem; opportunity: CanonicalPersistedOpportunity }> {
  const reference: HeldItemReference = { heldItemId: input.heldItemId }
  const heldResult = await loaders.loadHeldItem(reference)
  if (heldResult.status !== 'loaded') {
    throw new ReadmissionContractError(`canonical held item load returned ${heldResult.status}`)
  }
  if (heldResult.value.heldItemId !== input.heldItemId) {
    throw new ReadmissionContractError('loaded held item identity does not match the request')
  }
  if (heldResult.value.opportunityId !== input.opportunityId) {
    throw new ReadmissionContractError('loaded held item opportunity does not match the request')
  }

  const opportunityResult = await loaders.loadOpportunityLedger(
    input.opportunityId,
    heldResult.value,
  )
  if (opportunityResult.status !== 'loaded') {
    throw new ReadmissionContractError(
      `canonical opportunity load returned ${opportunityResult.status}`,
    )
  }
  if (opportunityResult.value.opportunityId !== input.opportunityId) {
    throw new ReadmissionContractError('loaded opportunity identity does not match the request')
  }
  return { heldItem: heldResult.value, opportunity: opportunityResult.value }
}

function verifyReconstructionIdentity(
  reconstructed: ReconstructedAnchorRecord,
  canonical: { heldItem: CanonicalHeldItem; opportunity: CanonicalPersistedOpportunity },
  input: RunReadmissionInput,
): void {
  if (
    reconstructed.heldItemId !== input.heldItemId ||
    reconstructed.opportunityId !== input.opportunityId ||
    reconstructed.heldItemPersistedVersion !== canonical.heldItem.persistedVersion ||
    reconstructed.manuscriptId !== canonical.heldItem.manuscriptId ||
    reconstructed.manuscriptVersionSha !== canonical.heldItem.manuscriptVersionSha
  ) {
    throw new ReadmissionContractError(
      'persisted reconstructed-anchor identity does not match canonical held authority',
    )
  }
}

function completionFingerprintFor(
  reconstructed: ReconstructedAnchorRecord,
  heldItem: CanonicalHeldItem,
): string {
  return fingerprintReconstructedAnchorAuthority({
    manuscriptId: heldItem.manuscriptId,
    manuscriptVersionSha: heldItem.manuscriptVersionSha,
    heldItemPersistedVersion: heldItem.persistedVersion,
    sourceHash: reconstructed.sourceHash,
    sourceStartOffset: reconstructed.sourceStartOffset,
    sourceEndOffset: reconstructed.sourceEndOffset,
    recoveryMethod: reconstructed.recoveryMethod,
  } satisfies Omit<ReconstructedAnchorAuthority, 'completionFingerprint'>)
}

function normalizedEvidence(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

async function loadVerifiedAdmissionInput(
  loader: AdmissionOpportunityLoader,
  input: RunReadmissionInput,
  canonicalOpportunity: CanonicalPersistedOpportunity,
  opportunityVersion: string,
): Promise<WorkbenchAdmissionInput> {
  const loaded = await loader({ jobId: input.jobId, opportunityId: input.opportunityId })
  if (loaded.status !== 'loaded') {
    const detail = 'reason' in loaded ? `: ${loaded.reason}` : ''
    throw new ReadmissionContractError(`admission opportunity load returned ${loaded.status}${detail}`)
  }
  const admissionInput = loaded.value
  if (loaded.opportunityVersion !== opportunityVersion) {
    throw new ReadmissionContractError(
      'admission opportunity version does not match reloaded canonical state',
    )
  }
  if (admissionInput.id !== input.opportunityId) {
    throw new ReadmissionContractError('admission opportunity identity does not match the request')
  }
  if (admissionInput.anchor !== canonicalOpportunity.manuscriptCoordinates) {
    throw new ReadmissionContractError(
      'admission opportunity coordinates do not match reloaded canonical state',
    )
  }
  const hydratedEvidence = `${admissionInput.quoteHighlight ?? ''}${admissionInput.quoteRest ?? ''}`
  if (normalizedEvidence(hydratedEvidence) !== normalizedEvidence(canonicalOpportunity.evidenceAnchor)) {
    throw new ReadmissionContractError(
      'admission opportunity evidence does not match reloaded canonical state',
    )
  }
  return admissionInput
}

function verifySuccessfulCas(
  casResult: Exclude<ApplyAnchorCasResult, { status: 'persistence_conflict' }>,
  reconstructed: ReconstructedAnchorRecord,
  after: { heldItem: CanonicalHeldItem; opportunity: CanonicalPersistedOpportunity },
  opportunityVersion: string,
): void {
  if (
    after.opportunity.evidenceAnchor !== reconstructed.evidenceAnchor ||
    after.opportunity.manuscriptCoordinates !== reconstructed.manuscriptCoordinates
  ) {
    throw new ReadmissionContractError(
      `post-CAS canonical anchor does not match persisted reconstruction after ${casResult.status}`,
    )
  }
  if (
    casResult.opportunityVersion !== opportunityVersion ||
    casResult.ledgerSourceHash !== after.opportunity.ledgerSourceHash
  ) {
    throw new ReadmissionContractError('CAS result does not match reloaded opportunity authority')
  }
}

export async function runHeldRecoveryReconstructionReadmission(
  input: RunReadmissionInput,
  deps: ReadmissionDependencies,
): Promise<ReadmissionResult> {
  requireIdentity(input.jobId, 'jobId')
  requireIdentity(input.heldItemId, 'heldItemId')
  requireIdentity(input.opportunityId, 'opportunityId')

  const before = await reloadCanonical(deps.loaders, input)
  const reconstructionResult = await deps.loadReconstructedAnchor({
    heldItemId: before.heldItem.heldItemId,
    heldItemPersistedVersion: before.heldItem.persistedVersion,
  })
  if (reconstructionResult.status === 'missing') {
    return { status: 'rejected_stale', reason: 'reconstruction_missing' }
  }
  const reconstructed = reconstructionResult.value
  verifyReconstructionIdentity(reconstructed, before, input)
  if (
    completionFingerprintFor(reconstructed, before.heldItem) !==
    reconstructed.completionFingerprint
  ) {
    return { status: 'rejected_stale', reason: 'completion_fingerprint_mismatch' }
  }

  const anchorChanged =
    before.opportunity.evidenceAnchor !== reconstructed.evidenceAnchor ||
    before.opportunity.manuscriptCoordinates !== reconstructed.manuscriptCoordinates

  let casResult: Exclude<ApplyAnchorCasResult, { status: 'persistence_conflict' }> | null = null
  if (anchorChanged) {
    const fingerprintOf = deps.anchorFingerprintOf ?? defaultAnchorFingerprint
    const applied = await deps.casWriter.applyAnchorCas({
      jobId: input.jobId,
      opportunityId: input.opportunityId,
      expectedLedgerSourceHash: before.opportunity.ledgerSourceHash,
      expectedAnchorFingerprint: fingerprintOf({
        opportunityId: before.opportunity.opportunityId,
        ledgerSourceHash: before.opportunity.ledgerSourceHash,
        evidenceAnchor: before.opportunity.evidenceAnchor,
        manuscriptCoordinates: before.opportunity.manuscriptCoordinates,
      }),
      newEvidenceAnchor: reconstructed.evidenceAnchor,
      newManuscriptCoordinates: reconstructed.manuscriptCoordinates,
    })
    if (applied.status === 'persistence_conflict') {
      return { status: 'persistence_conflict', reason: applied.reason }
    }
    casResult = applied
  }

  const after = await reloadCanonical(deps.loaders, input)
  if (after.heldItem.persistedVersion !== before.heldItem.persistedVersion) {
    return { status: 'rejected_stale', reason: 'held_item_version_changed' }
  }
  verifyReconstructionIdentity(reconstructed, after, input)

  const opportunityVersion = revisionOpportunityVersionFor(
    after.opportunity.opportunityId,
    after.opportunity.ledgerSourceHash,
  )
  if (casResult !== null) {
    verifySuccessfulCas(casResult, reconstructed, after, opportunityVersion)
  } else if (
    after.opportunity.evidenceAnchor !== reconstructed.evidenceAnchor ||
    after.opportunity.manuscriptCoordinates !== reconstructed.manuscriptCoordinates
  ) {
    throw new ReadmissionContractError(
      'unchanged pre-write anchor did not remain equal to persisted reconstruction',
    )
  }

  const admissionInput = await loadVerifiedAdmissionInput(
    deps.loadAdmissionOpportunity,
    input,
    after.opportunity,
    opportunityVersion,
  )
  const admission = (deps.runAdmissionGate ?? runWorkbenchAdmissionGate)(admissionInput)

  if (!anchorChanged) return { status: 'unchanged', opportunityVersion, admission }
  if (admission.admission_status === 'admission_passed') {
    return { status: 'admitted', opportunityVersion, admission, anchorChanged: true }
  }
  return { status: 'not_admitted', opportunityVersion, admission, anchorChanged: true }
}
