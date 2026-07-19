import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/observability/logger'
import { createSupabaseHeldRecoveryAttemptPersistenceAdapter } from './heldRecoveryAttemptRecorder'
import { createSupabaseHeldRecoveryAnchorCasPersistenceAdapter } from './heldRecoveryAnchorCasWriter'
import {
  HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG,
  persistReconstructedAnchorAndReadmit,
  type PersistedReconstructionReadmissionResult,
} from './heldRecoveryReconstructionReadmissionCaller'
import { createSupabaseReconstructedAnchorLoader } from './heldRecoveryReconstructedAnchorLoader'
import {
  runHeldRecoveryReconstructionWorkerOnce,
  type ReconstructedAnchorAuthority,
  type RunReconstructionWorkerOnceResult,
} from './heldRecoveryReconstructionWorker'
import {
  createSupabaseHeldRecoveryReconstructionPersistenceAdapter,
  type ClaimedReconstructionWork,
  type HeldRecoveryReconstructionPersistenceAdapter,
} from './heldRecoveryReconstructionWriter'
import {
  createSupabaseHeldRecoveryRuntimeLoaders,
  loadCanonicalRevisionOpportunityIdsForJob,
  loadCanonicalRevisionOpportunityRecord,
  type CanonicalHeldItem,
} from './heldRecoveryRuntimeOrchestrator'
import { sourceHashForCanonicalChunkContent } from './heldRecoveryRuntimeInputs'
import { revisionOpportunityVersionFor, sourceHashFor } from './heldRecoveryVersioning'
import { getWorkbenchQueueForHeldRecoveryReadmission } from './workbenchQueue'

export type HeldRecoveryProductionContinuationResult =
  | { readonly status: 'target_disabled' }
  | { readonly status: 'ledger_unavailable'; readonly reason: string }
  | { readonly status: 'worker_finished'; readonly worker: Exclude<RunReconstructionWorkerOnceResult, { status: 'completed' }> }
  | {
      readonly status: 'readmission_finished'
      readonly worker: Extract<RunReconstructionWorkerOnceResult, { status: 'completed' }>
      readonly readmission: PersistedReconstructionReadmissionResult
    }

function isTargetJob(
  jobId: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[HELD_RECOVERY_RECONSTRUCTION_READMISSION_TARGET_JOB_FLAG] === jobId
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function captureClaim(
  persistence: HeldRecoveryReconstructionPersistenceAdapter,
  onClaim: (work: ClaimedReconstructionWork) => void,
): HeldRecoveryReconstructionPersistenceAdapter {
  return {
    ...persistence,
    async claimNext(input) {
      const result = await persistence.claimNext(input)
      if (result.status === 'claimed') onClaim(result.work)
      return result
    },
  }
}

function canonicalHeldItemFor(
  work: ClaimedReconstructionWork,
  attempts: Awaited<ReturnType<ReturnType<typeof createSupabaseHeldRecoveryAttemptPersistenceAdapter>['findByHeldItemAndOpportunity']>>,
): CanonicalHeldItem | null {
  const matching = attempts
    .filter((attempt) =>
      attempt.heldItemPersistedVersion === work.heldItemPersistedVersion &&
      attempt.manuscriptVersionSha === work.manuscriptVersionSha,
    )
    .sort((a, b) => b.attempt.attemptNumber - a.attempt.attemptNumber)
  const attempt = matching[0]
  if (!attempt) return null
  const reason = attempt.attempt.snapshot.canonicalReasons.find((item) =>
    item.code === attempt.attempt.seriesKey.code && item.source,
  )
  if (!reason) return null
  return {
    heldItemId: work.heldItemId,
    opportunityId: work.opportunityId,
    reason: { code: reason.code, source: reason.source },
    producer: attempt.attempt.seriesKey.producer,
    persistedVersion: work.heldItemPersistedVersion,
    manuscriptId: work.manuscriptId,
    manuscriptVersionSha: work.manuscriptVersionSha,
  }
}

async function authorityVersionFor(
  supabase: Pick<SupabaseClient, 'from'>,
  heldItemId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('held_recovery_queue_items')
    .select('authority_version')
    .eq('held_item_id', heldItemId)
    .maybeSingle()
  if (error || !data || !nonEmpty(data.authority_version)) {
    throw new Error('Held Recovery queue authority version is unavailable')
  }
  return data.authority_version
}

async function proofJobUserIdFor(
  supabase: Pick<SupabaseClient, 'from'>,
  jobId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('evaluation_jobs')
    .select('user_id')
    .eq('id', jobId)
    .maybeSingle()
  const userId = data && nonEmpty(data.user_id)
  if (error || !userId) throw new Error('evaluation job user identity is unavailable')
  return userId
}

/**
 * Production-reachable, exact-job continuation. The evaluation worker supplies
 * the generated job id; the default-off environment target must already match.
 * Claiming is filtered to opportunity identities loaded from that job's one
 * canonical revision ledger, so another evaluation's work cannot be consumed.
 */
export async function runHeldRecoveryReconstructionProductionContinuation(
  input: { readonly jobId: string; readonly workerId: string },
  dependencies: { readonly supabase?: SupabaseClient } = {},
): Promise<HeldRecoveryProductionContinuationResult> {
  if (!isTargetJob(input.jobId)) return { status: 'target_disabled' }

  const supabase = dependencies.supabase ?? createAdminClient()
  const ledgerIds = await loadCanonicalRevisionOpportunityIdsForJob({
    jobId: input.jobId,
    supabase,
  })
  if (ledgerIds.status !== 'loaded') {
    return { status: 'ledger_unavailable', reason: ledgerIds.reason ?? ledgerIds.status }
  }

  let claimedWork: ClaimedReconstructionWork | null = null
  const basePersistence = createSupabaseHeldRecoveryReconstructionPersistenceAdapter(
    supabase,
    { opportunityIds: ledgerIds.opportunityIds },
  )
  const persistence = captureClaim(basePersistence, (work) => { claimedWork = work })

  const worker = await runHeldRecoveryReconstructionWorkerOnce({
    persistence,
    workerId: input.workerId,
    leaseSeconds: 90,
    enabled: true,
    async reconstructAnchorAuthority(work) {
      const canonical = await loadCanonicalRevisionOpportunityRecord({
        jobId: input.jobId,
        opportunityId: work.opportunityId,
        supabase,
      })
      if (canonical.status !== 'loaded') {
        throw new Error(`canonical opportunity unavailable: ${canonical.status}`)
      }
      const source = nonEmpty(canonical.value.opportunity.rationale)
      const anchor = nonEmpty(canonical.value.opportunity.evidence_anchor)
      if (!source || !anchor || sourceHashFor({ source_text: source.trim() }) !== work.sourceHash) {
        throw new Error('canonical reconstruction source changed')
      }
      const sourceStartOffset = source.trim().indexOf(anchor.trim())
      if (
        sourceStartOffset !== work.sourceStartOffset ||
        sourceStartOffset + anchor.trim().length !== work.sourceEndOffset
      ) {
        throw new Error('canonical reconstruction location changed')
      }
      return {
        sourceHash: work.sourceHash,
        sourceStartOffset: work.sourceStartOffset,
        sourceEndOffset: work.sourceEndOffset,
        recoveryMethod: 'source_text_location_only' as const,
      }
    },
  })

  if (worker.status !== 'completed') return { status: 'worker_finished', worker }
  const work = claimedWork
  if (!work) throw new Error('reconstruction completed without a captured canonical claim')

  const canonical = await loadCanonicalRevisionOpportunityRecord({
    jobId: input.jobId,
    opportunityId: work.opportunityId,
    supabase,
  })
  if (canonical.status !== 'loaded') {
    throw new Error(`canonical opportunity unavailable after reconstruction: ${canonical.status}`)
  }
  const sourceText = nonEmpty(canonical.value.opportunity.rationale)
  const coordinates = nonEmpty(canonical.value.opportunity.manuscript_coordinates)
  if (!sourceText || !coordinates) throw new Error('canonical persistence source is incomplete')

  const attemptAdapter = createSupabaseHeldRecoveryAttemptPersistenceAdapter(supabase)
  const attempts = await attemptAdapter.findByHeldItemAndOpportunity({
    heldItemId: work.heldItemId,
    opportunityId: work.opportunityId,
  })
  const heldItem = canonicalHeldItemFor(work, attempts)
  if (!heldItem) throw new Error('canonical held-item authority is unavailable')

  const runtimeLoaders = createSupabaseHeldRecoveryRuntimeLoaders({
    supabase,
    jobId: input.jobId,
  })
  const proofJobUserId = await proofJobUserIdFor(supabase, input.jobId)
  const readmission = await persistReconstructedAnchorAndReadmit({
    jobId: input.jobId,
    persistence: {
      heldItemId: work.heldItemId,
      opportunityId: work.opportunityId,
      expectedAuthorityVersion: await authorityVersionFor(supabase, work.heldItemId),
      reconstruction: {
        authority: worker.authority as ReconstructedAnchorAuthority,
        canonicalSource: {
          manuscriptId: work.manuscriptId,
          manuscriptVersionSha: work.manuscriptVersionSha,
          text: sourceText,
        },
        chunk: {
          chunkId: `canonical-source:${work.opportunityId}`,
          manuscriptId: work.manuscriptId,
          manuscriptVersionSha: work.manuscriptVersionSha,
          contentAbsoluteStart: 0,
          contentAbsoluteEnd: sourceText.trim().length,
          content: sourceText.trim(),
          contentHash: sourceHashForCanonicalChunkContent(sourceText.trim()),
        },
        canonicalManuscriptCoordinates: coordinates,
      },
    },
  }, {
    isEnabledForJob: (jobId) => jobId === input.jobId,
    persistence: { isEnabled: () => true },
    readmission: {
      loaders: {
        async loadHeldItem(reference) {
          return reference.heldItemId === heldItem.heldItemId
            ? { status: 'loaded', value: heldItem }
            : { status: 'missing' }
        },
        loadOpportunityLedger: runtimeLoaders.loadOpportunityLedger,
      },
      loadReconstructedAnchor: createSupabaseReconstructedAnchorLoader(supabase),
      casWriter: createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(supabase),
      async loadAdmissionOpportunity({ jobId, opportunityId }) {
        if (jobId !== input.jobId) return { status: 'conflict', reason: 'job identity mismatch' }
        const latest = await loadCanonicalRevisionOpportunityRecord({ jobId, opportunityId, supabase })
        if (latest.status !== 'loaded') return { status: latest.status === 'missing' ? 'missing' : 'invalid', reason: latest.status }
        const queue = await getWorkbenchQueueForHeldRecoveryReadmission({
          manuscriptId: work.manuscriptId,
          evaluationJobId: jobId,
          user: { id: proofJobUserId },
        })
        if (!queue.ok) return { status: 'invalid', reason: queue.error ?? 'Workbench projection failed' }
        const hydrated = [
          ...queue.opportunities,
          ...queue.needsTargeting,
          ...queue.withheldUnsupported,
        ].find((opportunity) => opportunity.id === opportunityId)
        if (!hydrated) return { status: 'missing' }
        return {
          status: 'loaded',
          opportunityVersion: revisionOpportunityVersionFor(opportunityId, latest.value.ledgerSourceHash),
          value: hydrated,
        }
      },
    },
  })

  logger.info('Held Recovery targeted production continuation finished', {
    event: 'held_recovery.production_continuation.finished',
    job_id: input.jobId,
    held_item_id: work.heldItemId,
    opportunity_id: work.opportunityId,
    readmission_status: readmission.status,
  })
  return { status: 'readmission_finished', worker, readmission }
}
