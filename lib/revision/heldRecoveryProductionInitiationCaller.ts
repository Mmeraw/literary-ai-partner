/**
 * Exact-job production initiation for the bounded Held Recovery proof.
 *
 * Authority chain:
 * canonical Workbench held projection -> one origin-owned resolve_anchor reason
 * -> canonical held identity -> deferred attempt + reconstruction work (atomic)
 * -> initial durable queue authority.
 *
 * No caller supplies prose, candidates, coordinates, versions, fingerprints,
 * reason codes, producers, or queue destinations. Those are loaded or derived
 * from canonical persisted state.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/observability/logger'
import {
  buildHeldRecoveryAttemptIdempotencyKey,
  buildHeldRecoveryAttemptRecord,
  createSupabaseHeldRecoveryAttemptPersistenceAdapter,
  type HeldRecoveryAttemptPersistenceAdapter,
  type RecordRecoveryAttemptInput,
  type RecordRecoveryAttemptResult,
} from './heldRecoveryAttemptRecorder'
import { collectCanonicalReasons, buildRecoveryPlan, type HeldOpportunityInput } from './heldRecoveryPlan'
import { getRecoveryContractForReason } from './heldRecoveryReasons'
import {
  createSupabaseHeldRecoveryQueueAuthorityInitializer,
  type HeldRecoveryQueueAuthorityInitializer,
  type InitializeHeldRecoveryQueueAuthorityResult,
} from './heldRecoveryQueueAuthorityInitializer'
import {
  createSupabaseHeldRecoveryReconstructionPersistenceAdapter,
  type AnchorReconstructionContinuation,
  type HeldRecoveryReconstructionPersistenceAdapter,
} from './heldRecoveryReconstructionWriter'
import {
  createSupabaseHeldRecoveryRuntimeLoaders,
  loadCanonicalRevisionOpportunityRecord,
  runHeldRecoveryRuntimeOrchestrationWithAttemptRecording,
  type CanonicalHeldItem,
  type HeldRecoveryRuntimeLoaders,
  type HeldRecoveryRuntimeOutcome,
} from './heldRecoveryRuntimeOrchestrator'
import { sourceHashFor } from './heldRecoveryVersioning'
import {
  HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG,
  isHeldRecoveryReconstructionReadmissionEnabledForJob,
} from './heldRecoveryReconstructionReadmissionCaller'
import {
  getWorkbenchQueueForHeldRecoveryReadmission,
  type WorkbenchQueuePayload,
} from './workbenchQueue'
import type { ClassifiedWorkbenchOpportunity } from './workbenchQueueProjection'
import {
  loadHeldRecoveryProofJobContext,
  type HeldRecoveryProofJobContext,
} from './heldRecoveryProofJobAuthority'

type ProofJobContext = HeldRecoveryProofJobContext

type CanonicalAnchorHeldSelection = {
  readonly opportunity: ClassifiedWorkbenchOpportunity
  readonly reason: CanonicalHeldItem['reason']
  readonly producer: CanonicalHeldItem['producer']
  readonly canonicalReasonSet: readonly {
    readonly code: string
    readonly source: CanonicalHeldItem['reason']['source']
    readonly producer: CanonicalHeldItem['producer']
  }[]
}

export type HeldRecoveryProductionInitiationResult =
  | { readonly status: 'target_disabled' }
  | { readonly status: 'proof_job_not_ready'; readonly reason: string }
  | { readonly status: 'workbench_unavailable'; readonly reason: string }
  | { readonly status: 'no_recoverable_anchor_hold' }
  | { readonly status: 'ambiguous_recoverable_anchor_holds'; readonly opportunityIds: readonly string[] }
  | { readonly status: 'canonical_opportunity_unavailable'; readonly reason: string }
  | {
      readonly status: 'deferred_reconstruction_admitted'
      readonly heldItemId: string
      readonly opportunityId: string
      readonly attempt: RecordRecoveryAttemptResult
      readonly queueAuthority: InitializeHeldRecoveryQueueAuthorityResult
      readonly runtimeOutcome: HeldRecoveryRuntimeOutcome
    }

export type HeldRecoveryProductionInitiationDependencies = {
  readonly supabase?: SupabaseClient
  readonly isEnabledForJob?: (jobId: string) => boolean
  readonly loadProofJobContext?: (jobId: string) => Promise<ProofJobContext | null>
  readonly loadWorkbench?: (context: ProofJobContext) => Promise<WorkbenchQueuePayload>
  readonly loadCanonicalOpportunity?: (
    jobId: string,
    opportunityId: string,
  ) => ReturnType<typeof loadCanonicalRevisionOpportunityRecord>
  readonly attemptPersistence?: HeldRecoveryAttemptPersistenceAdapter
  readonly reconstructionPersistence?: HeldRecoveryReconstructionPersistenceAdapter
  readonly initializeQueueAuthority?: HeldRecoveryQueueAuthorityInitializer
  readonly runtimeLoadersFor?: (
    jobId: string,
    heldItem: CanonicalHeldItem,
  ) => HeldRecoveryRuntimeLoaders
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function heldInputFor(opportunity: ClassifiedWorkbenchOpportunity): HeldOpportunityInput {
  return {
    ...opportunity,
    copyPasteAdmissionReasons: opportunity.classification.copyPasteAdmissionReasons,
    strategyAdmissionReasons: opportunity.classification.strategyAdmissionReasons,
    baseDecision: opportunity.baseDecision,
    finalDecision: opportunity.finalDecision,
  }
}

export function selectCanonicalAnchorHeldOpportunities(
  queue: Pick<WorkbenchQueuePayload, 'needsTargeting' | 'withheldUnsupported'>,
): CanonicalAnchorHeldSelection[] {
  const held = [...queue.needsTargeting, ...queue.withheldUnsupported] as ClassifiedWorkbenchOpportunity[]
  const selected: CanonicalAnchorHeldSelection[] = []

  for (const opportunity of held) {
    if (!opportunity.classification || !opportunity.finalDecision) continue
    const input = heldInputFor(opportunity)
    const plan = buildRecoveryPlan(input)
    if (!plan.recoverable || !plan.automaticRecoveryAllowed || !plan.requiredRepairs.includes('expand_anchor')) {
      continue
    }

    const origins = collectCanonicalReasons(input).canonicalReasons
      .map((occurrence) => ({
        occurrence,
        contract: getRecoveryContractForReason({
          code: occurrence.code,
          source: occurrence.source,
        }),
      }))
      .filter(({ contract }) =>
        contract?.authorityRole === 'origin' && contract.recoveryAction === 'resolve_anchor',
      )

    const unique = new Map(origins.map(({ occurrence, contract }) => [
      `${occurrence.code}:${occurrence.source}:${contract!.producer}`,
      { occurrence, contract: contract! },
    ]))
    if (unique.size === 0) continue
    const reasonPriority = new Map([
      ['hydration_anchor_truncated', 0],
      ['truncated_anchor', 1],
      ['insufficient_anchor_grounding', 2],
    ])
    const ordered = [...unique.values()].sort((a, b) => {
      const priority = (reasonPriority.get(a.occurrence.code) ?? 100) -
        (reasonPriority.get(b.occurrence.code) ?? 100)
      if (priority !== 0) return priority
      return `${a.occurrence.code}:${a.occurrence.source}:${a.contract.producer}`
        .localeCompare(`${b.occurrence.code}:${b.occurrence.source}:${b.contract.producer}`)
    })
    const [{ occurrence, contract }] = ordered
    selected.push({
      opportunity,
      reason: { code: occurrence.code, source: occurrence.source },
      producer: contract.producer,
      canonicalReasonSet: ordered.map((item) => ({
        code: item.occurrence.code,
        source: item.occurrence.source,
        producer: item.contract.producer,
      })),
    })
  }

  return selected.sort((a, b) => a.opportunity.id.localeCompare(b.opportunity.id))
}

function continuationFor(outcome: HeldRecoveryRuntimeOutcome): AnchorReconstructionContinuation {
  if (outcome.status !== 'deferred' || outcome.result.outcome !== 'deferred_work') {
    throw new Error('Held Recovery initiation did not produce deferred reconstruction work')
  }
  const details = recordOf(outcome.result.details)
  const sourceHash = nonEmpty(details?.sourceHash)
  const sourceStartOffset = details?.sourceStartOffset
  const sourceEndOffset = details?.sourceEndOffset
  if (
    !sourceHash ||
    !Number.isInteger(sourceStartOffset) ||
    !Number.isInteger(sourceEndOffset) ||
    details?.recoveryMethod !== 'source_text_location_only'
  ) {
    throw new Error('Held Recovery deferred reconstruction authority is malformed')
  }
  return {
    sourceHash,
    sourceStartOffset: sourceStartOffset as number,
    sourceEndOffset: sourceEndOffset as number,
    recoveryMethod: 'source_text_location_only',
  }
}

function deferredRecorder(
  attempts: HeldRecoveryAttemptPersistenceAdapter,
  reconstruction: HeldRecoveryReconstructionPersistenceAdapter,
): (adapter: HeldRecoveryAttemptPersistenceAdapter, input: RecordRecoveryAttemptInput) => Promise<RecordRecoveryAttemptResult> {
  return async (_adapter, input) => {
    const key = buildHeldRecoveryAttemptIdempotencyKey(input)
    const existing = await attempts.findByIdempotencyKey(key)
    const priorAttempts = existing ? 0 : await attempts.countAttemptsForSeries({
      opportunityVersion: input.executorInput.opportunityVersion,
      candidateSetVersion: input.executorInput.candidateSetVersion,
      producer: input.runtimeOutcome.result.producer,
      code: input.runtimeOutcome.result.code,
      recoveryAction: input.runtimeOutcome.result.action,
    })
    const canonicalRecord = existing ?? buildHeldRecoveryAttemptRecord({
      ...input,
      attemptNumber: priorAttempts + 1,
    })
    const enqueue = await reconstruction.recordDeferredAttemptAndEnqueue({
      attempt: {
        idempotencyKey: canonicalRecord.idempotencyKey,
        heldItemId: canonicalRecord.heldItemId,
        opportunityId: canonicalRecord.opportunityId,
        manuscriptId: canonicalRecord.manuscriptId,
        manuscriptVersionSha: canonicalRecord.manuscriptVersionSha,
        heldItemPersistedVersion: canonicalRecord.heldItemPersistedVersion,
        runtimeOutcomeStatus: 'deferred',
        executorResult: canonicalRecord.executorResult,
        seriesKey: canonicalRecord.attempt.seriesKey,
        recoveryInputFingerprint: canonicalRecord.attempt.recoveryInputFingerprint,
        attemptNumber: canonicalRecord.attempt.attemptNumber,
        maxAttempts: canonicalRecord.attempt.maxAttempts,
        status: canonicalRecord.attempt.status,
        outcome: canonicalRecord.attempt.outcome,
        snapshot: canonicalRecord.attempt.snapshot,
      },
      continuation: continuationFor(input.runtimeOutcome),
    })
    if (enqueue.status === 'idempotency_conflict' || enqueue.status === 'rejected_stale') {
      throw new Error(`Held Recovery deferred handoff rejected: ${enqueue.reason}`)
    }
    return {
      status: existing ? 'already_recorded' : 'recorded',
      record: canonicalRecord,
    }
  }
}

function runtimeLoaders(
  jobId: string,
  heldItem: CanonicalHeldItem,
  supabase: SupabaseClient,
): HeldRecoveryRuntimeLoaders {
  const canonical = createSupabaseHeldRecoveryRuntimeLoaders({ jobId, supabase })
  return {
    async loadHeldItem(reference) {
      return reference.heldItemId === heldItem.heldItemId
        ? { status: 'loaded', value: heldItem }
        : { status: 'missing' }
    },
    loadOpportunityLedger: canonical.loadOpportunityLedger,
    loadCandidateState: canonical.loadCandidateState,
    loadManuscriptChunks: canonical.loadManuscriptChunks,
  }
}

export async function runHeldRecoveryProductionInitiation(
  input: { readonly jobId: string },
  dependencies: HeldRecoveryProductionInitiationDependencies = {},
): Promise<HeldRecoveryProductionInitiationResult> {
  const enabled = dependencies.isEnabledForJob ?? isHeldRecoveryReconstructionReadmissionEnabledForJob
  if (!enabled(input.jobId)) return { status: 'target_disabled' }

  const supabase = dependencies.supabase ?? createAdminClient()
  const context = await (dependencies.loadProofJobContext ?? ((jobId) =>
    loadHeldRecoveryProofJobContext(supabase, jobId)))(input.jobId)
  if (!context) return { status: 'proof_job_not_ready', reason: 'complete marked proof job authority is unavailable' }

  const queue = await (dependencies.loadWorkbench ?? ((proof) =>
    getWorkbenchQueueForHeldRecoveryReadmission({
      manuscriptId: proof.manuscriptId,
      evaluationJobId: proof.jobId,
      user: { id: proof.userId },
    })))(context)
  if (!queue.ok) return { status: 'workbench_unavailable', reason: queue.error ?? 'Workbench projection failed' }

  const selections = selectCanonicalAnchorHeldOpportunities(queue)
  if (selections.length === 0) return { status: 'no_recoverable_anchor_hold' }
  if (selections.length !== 1) {
    return {
      status: 'ambiguous_recoverable_anchor_holds',
      opportunityIds: selections.map((selection) => selection.opportunity.id),
    }
  }

  const selection = selections[0]
  const canonical = await (dependencies.loadCanonicalOpportunity
    ? dependencies.loadCanonicalOpportunity(input.jobId, selection.opportunity.id)
    : loadCanonicalRevisionOpportunityRecord({
        jobId: input.jobId,
        opportunityId: selection.opportunity.id,
        supabase,
      }))
  if (canonical.status !== 'loaded') {
    return { status: 'canonical_opportunity_unavailable', reason: canonical.reason ?? canonical.status }
  }

  const opportunityVersion = sourceHashFor({
    boundary: 'held_recovery_canonical_held_item_v1',
    jobId: input.jobId,
    opportunityId: selection.opportunity.id,
    ledgerSourceHash: canonical.value.ledgerSourceHash,
    manuscriptVersionSha: canonical.value.manuscriptVersionSha,
    reason: selection.reason,
    producer: selection.producer,
    canonicalReasonSet: selection.canonicalReasonSet,
  })
  const heldItem: CanonicalHeldItem = {
    heldItemId: sourceHashFor({
      boundary: 'held_recovery_identity_v1',
      jobId: input.jobId,
      opportunityId: selection.opportunity.id,
      recoveryAction: 'resolve_anchor',
    }),
    opportunityId: selection.opportunity.id,
    reason: selection.reason,
    producer: selection.producer,
    persistedVersion: opportunityVersion,
    manuscriptId: context.manuscriptId,
    manuscriptVersionSha: canonical.value.manuscriptVersionSha,
  }

  const attempts = dependencies.attemptPersistence ??
    createSupabaseHeldRecoveryAttemptPersistenceAdapter(supabase)
  const reconstruction = dependencies.reconstructionPersistence ??
    createSupabaseHeldRecoveryReconstructionPersistenceAdapter(supabase, {
      opportunityIds: [heldItem.opportunityId],
    })
  const loaders = dependencies.runtimeLoadersFor?.(input.jobId, heldItem) ??
    runtimeLoaders(input.jobId, heldItem, supabase)
  const recording = await runHeldRecoveryRuntimeOrchestrationWithAttemptRecording(
    { heldItemId: heldItem.heldItemId },
    loaders,
    attempts,
    {
      trigger: 'system',
      recordRecoveryAttempt: deferredRecorder(attempts, reconstruction),
    },
  )
  if (!recording.attemptRecording) {
    throw new Error(`Held Recovery initiation did not record an attempt: ${recording.recordingSkippedReason}`)
  }

  const initialize = dependencies.initializeQueueAuthority ??
    createSupabaseHeldRecoveryQueueAuthorityInitializer(supabase)
  const queueAuthority = await initialize({
    evaluationJobId: input.jobId,
    heldItemId: heldItem.heldItemId,
    opportunityId: heldItem.opportunityId,
    manuscriptId: heldItem.manuscriptId,
    manuscriptVersionSha: heldItem.manuscriptVersionSha,
    heldItemPersistedVersion: heldItem.persistedVersion,
    deferredAttemptIdempotencyKey: recording.attemptRecording.record.idempotencyKey,
  })
  if ('reason' in queueAuthority) {
    throw new Error(`Held Recovery initial queue authority rejected: ${queueAuthority.reason}`)
  }
  if (queueAuthority.heldItemId !== heldItem.heldItemId) {
    throw new Error('Held Recovery initial queue authority returned a foreign held identity')
  }

  logger.info('Held Recovery targeted production initiation finished', {
    event: 'held_recovery.production_initiation.finished',
    job_id: input.jobId,
    held_item_id: heldItem.heldItemId,
    opportunity_id: heldItem.opportunityId,
    attempt_status: recording.attemptRecording.status,
    queue_authority_status: queueAuthority.status,
    runtime_outcome: recording.runtimeOutcome.status,
    target_flag: HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG,
  })

  return {
    status: 'deferred_reconstruction_admitted',
    heldItemId: heldItem.heldItemId,
    opportunityId: heldItem.opportunityId,
    attempt: recording.attemptRecording,
    queueAuthority,
    runtimeOutcome: recording.runtimeOutcome,
  }
}
