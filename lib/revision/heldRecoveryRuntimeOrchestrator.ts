/**
 * Bounded Held Recovery Runtime Orchestration
 *
 * Orchestration boundary for invoking the canonical #1326 runtime adapter and
 * pure executor. The default runtime entrypoint remains read-only. The opt-in
 * attempt-recording entrypoint may persist a recovery-attempt audit record only;
 * neither path mutates queues, schedules retries, updates ledgers, writes
 * candidates, alters manuscripts, touches Final Review state, or renders UI/API
 * output.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildRecoveryExecutorInputFromCanonicalState,
  deriveCanonicalManuscriptChunkReferences,
  type CanonicalManuscriptChunkRow,
  type CanonicalRecoveryDiagnostic,
  type CanonicalRecoveryOpportunity,
  type CanonicalRecoveryState,
  type HeldRecoveryRuntimeRequest as AdapterHeldRecoveryRuntimeRequest,
} from './heldRecoveryRuntimeInputs'
import {
  executeRecoveryAction,
  type RecoveryExecutionResult,
  type RecoveryExecutorInput,
  type RecoveryReasonIdentity,
} from './heldRecoveryExecutor'
import {
  recordHeldRecoveryAttempt,
  type HeldRecoveryAttemptPersistenceAdapter,
  type RecordRecoveryAttemptResult,
  type RecoveryAttemptTrigger,
} from './heldRecoveryAttemptRecorder'
import { getRecoveryContractForReason } from './heldRecoveryReasons'
import type { HeldReasonProducer } from './heldRecoverySources'

export type HeldItemReference = {
  readonly heldItemId: string
}

export type CanonicalHeldItem = {
  readonly heldItemId: string
  readonly opportunityId: string
  readonly reason: RecoveryReasonIdentity
  readonly producer: HeldReasonProducer
  readonly persistedVersion: string
  /**
   * Canonical non-negative integer string (bigint fidelity). Never a JS number:
   * the manuscript_id identity may exceed 2^53 and must survive to the
   * persistence boundary unchanged.
   */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
}

export type CanonicalPersistedOpportunity = Omit<CanonicalRecoveryOpportunity, 'existingCandidatesABC'>

export type CanonicalPersistedCandidateState = {
  readonly a: string
  readonly b: string
  readonly c: string
  readonly options?: { readonly a?: unknown; readonly b?: unknown; readonly c?: unknown }
}

export type CanonicalHeldItemLoadResult =
  | { readonly status: 'loaded'; readonly value: CanonicalHeldItem }
  | { readonly status: 'missing' }
  | { readonly status: 'legacy_only'; readonly legacyArtifactId: string }
  | { readonly status: 'conflict'; readonly reason: string }
  | { readonly status: 'invalid'; readonly reason: string }

export type CanonicalOpportunityLoadResult =
  | { readonly status: 'loaded'; readonly value: CanonicalPersistedOpportunity }
  | { readonly status: 'missing' }
  | { readonly status: 'legacy_only'; readonly legacyArtifactId: string }
  | { readonly status: 'conflict'; readonly reason: string }
  | { readonly status: 'invalid'; readonly reason: string }

export type CanonicalCandidateStateLoadResult =
  | { readonly status: 'loaded'; readonly value: CanonicalPersistedCandidateState | null }
  | { readonly status: 'missing' }
  | { readonly status: 'legacy_only'; readonly legacyArtifactId: string }
  | { readonly status: 'conflict'; readonly reason: string }
  | { readonly status: 'invalid'; readonly reason: string }

export type CanonicalManuscriptChunkRowsLoadResult =
  | { readonly status: 'loaded'; readonly value: readonly CanonicalManuscriptChunkRow[] }
  | { readonly status: 'missing' }
  | { readonly status: 'legacy_only'; readonly legacyArtifactId: string }
  | { readonly status: 'conflict'; readonly reason: string }
  | { readonly status: 'invalid'; readonly reason: string }

export type HeldRecoveryRuntimeLoaders = {
  readonly loadHeldItem: (reference: HeldItemReference) => Promise<CanonicalHeldItemLoadResult>
  readonly loadOpportunityLedger: (
    opportunityId: string,
    heldItem: CanonicalHeldItem,
  ) => Promise<CanonicalOpportunityLoadResult>
  readonly loadCandidateState: (
    opportunityId: string,
    heldItem: CanonicalHeldItem,
  ) => Promise<CanonicalCandidateStateLoadResult>
  readonly loadManuscriptChunks: (
    manuscriptId: string,
    manuscriptVersionSha: string,
  ) => Promise<CanonicalManuscriptChunkRowsLoadResult>
}

export type RecoveryDeferredReason =
  | 'llm_assisted_action_not_authorized'
  | 'deterministic_followup_required'

export type RecoveryUnchangedReason =
  | 'contract_no_action'

export type RecoveryRejectionReason =
  | 'unknown_held_reason'
  | 'missing_canonical_input'
  | 'invalid_canonical_input'
  | 'legacy_artifact_unsupported'
  | 'conflicting_persisted_authority'
  | 'stale_authority'
  | 'identity_mismatch'

export type HeldRecoveryRuntimeOutcome =
  | { readonly status: 'completed'; readonly result: RecoveryExecutionResult }
  | { readonly status: 'deferred'; readonly reason: RecoveryDeferredReason; readonly result: RecoveryExecutionResult }
  | { readonly status: 'unchanged'; readonly reason: RecoveryUnchangedReason; readonly result: RecoveryExecutionResult }
  | {
      readonly status: 'rejected'
      readonly reason: RecoveryRejectionReason
      readonly details?: Record<string, unknown>
      readonly result?: RecoveryExecutionResult
    }

export type HeldRecoveryRuntimeDependencies = {
  readonly buildExecutorInputFromCanonicalState?: (
    request: AdapterHeldRecoveryRuntimeRequest,
    state: CanonicalRecoveryState,
  ) => RecoveryExecutorInput
  readonly executeRecoveryAction?: (input: RecoveryExecutorInput) => RecoveryExecutionResult
}

export type HeldRecoveryRuntimeAttemptRecordingOptions = {
  readonly trigger: RecoveryAttemptTrigger
  readonly nowIso?: string
  readonly dependencies?: HeldRecoveryRuntimeDependencies
  /**
   * Recording is part of this opt-in boundary's durability contract. If the
   * recorder rejects after executor invocation, this wrapper rejects rather than
   * returning a runtime-success envelope with a missing audit record.
   */
  readonly recordRecoveryAttempt?: typeof recordHeldRecoveryAttempt
}

export type HeldRecoveryRuntimeAttemptRecordingResult = {
  readonly runtimeOutcome: HeldRecoveryRuntimeOutcome
  readonly attemptRecording: RecordRecoveryAttemptResult | null
  readonly recordingSkippedReason?: 'executor_not_invoked'
}

type HeldRecoveryRuntimeExecution = {
  readonly outcome: HeldRecoveryRuntimeOutcome
  readonly heldItem?: CanonicalHeldItem
  readonly executorInput?: RecoveryExecutorInput
}

type RecordableHeldRecoveryRuntimeOutcome = HeldRecoveryRuntimeOutcome & { readonly result: RecoveryExecutionResult }

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function loadedOrReject(
  result:
    | CanonicalOpportunityLoadResult
    | CanonicalCandidateStateLoadResult
    | CanonicalManuscriptChunkRowsLoadResult,
): HeldRecoveryRuntimeOutcome | null {
  switch (result.status) {
    case 'loaded':
      return null
    case 'missing':
      return { status: 'rejected', reason: 'missing_canonical_input' }
    case 'legacy_only':
      return {
        status: 'rejected',
        reason: 'legacy_artifact_unsupported',
        details: { legacyArtifactId: result.legacyArtifactId },
      }
    case 'conflict':
      return {
        status: 'rejected',
        reason: 'conflicting_persisted_authority',
        details: { reason: result.reason },
      }
    case 'invalid':
      return {
        status: 'rejected',
        reason: 'invalid_canonical_input',
        details: { reason: result.reason },
      }
    default:
      return { status: 'rejected', reason: 'invalid_canonical_input' }
  }
}

function classifyExecutorResult(result: RecoveryExecutionResult): HeldRecoveryRuntimeOutcome {
  if (result.outcome === 'success') {
    return { status: 'completed', result }
  }

  if (result.outcome === 'deferred_work') {
    const reason: RecoveryDeferredReason =
      result.action === 'repair_diagnosis' || result.action === 'create_versioned_candidate_set'
        ? 'llm_assisted_action_not_authorized'
        : 'deterministic_followup_required'
    return { status: 'deferred', reason, result }
  }

  if (result.outcome === 'no_op') {
    return { status: 'unchanged', reason: 'contract_no_action', result }
  }

  if (
    result.error === 'STALE_LEDGER_SOURCE_HASH' ||
    result.error === 'STALE_OPPORTUNITY_VERSION' ||
    result.error === 'STALE_CANDIDATE_SET_VERSION' ||
    result.error === 'STALE_RECOVERY_INPUT_FINGERPRINT' ||
    result.error === 'STALE_MANUSCRIPT_CHUNK_VERSION'
  ) {
    return { status: 'rejected', reason: 'stale_authority', result, details: result.details }
  }

  if (result.error === 'UNKNOWN_RECOVERY_CONTRACT') {
    return { status: 'rejected', reason: 'unknown_held_reason', result, details: result.details }
  }

  if (
    result.error === 'MISSING_REQUIRED_INPUTS' ||
    result.error === 'MISSING_CANONICAL_AUTHORITY_SNAPSHOT'
  ) {
    return { status: 'rejected', reason: 'missing_canonical_input', result, details: result.details }
  }

  if (
    result.error === 'INVALID_REQUIRED_INPUTS' ||
    result.error === 'INVALID_RECOVERABLE_INPUTS' ||
    result.error === 'INVALID_CANONICAL_CHUNK_REFERENCES'
  ) {
    return { status: 'rejected', reason: 'invalid_canonical_input', result, details: result.details }
  }

  if (result.error === 'NOT_AN_ORIGIN_PRODUCER') {
    return { status: 'rejected', reason: 'identity_mismatch', result, details: result.details }
  }

  return { status: 'rejected', reason: 'invalid_canonical_input', result, details: result.details }
}

export async function runHeldRecoveryRuntimeOrchestration(
  reference: HeldItemReference,
  loaders: HeldRecoveryRuntimeLoaders,
  dependencies: HeldRecoveryRuntimeDependencies = {},
): Promise<HeldRecoveryRuntimeOutcome> {
  return (await runHeldRecoveryRuntimeExecution(reference, loaders, dependencies)).outcome
}

async function runHeldRecoveryRuntimeExecution(
  reference: HeldItemReference,
  loaders: HeldRecoveryRuntimeLoaders,
  dependencies: HeldRecoveryRuntimeDependencies = {},
): Promise<HeldRecoveryRuntimeExecution> {
  const heldItemResult = await loaders.loadHeldItem(reference)
  if (heldItemResult.status !== 'loaded') {
    return {
      outcome: loadedOrReject(heldItemResult as CanonicalOpportunityLoadResult) ?? {
        status: 'rejected',
        reason: 'invalid_canonical_input',
      },
    }
  }

  const heldItem = heldItemResult.value
  const contract = getRecoveryContractForReason(heldItem.reason)
  if (!contract) {
    return {
      outcome: {
        status: 'rejected',
        reason: 'unknown_held_reason',
        details: { reason: heldItem.reason, heldItemId: heldItem.heldItemId },
      },
      heldItem,
    }
  }

  if (contract.producer !== heldItem.producer || contract.code !== heldItem.reason.code) {
    return {
      outcome: {
        status: 'rejected',
        reason: 'identity_mismatch',
        details: {
          heldItemProducer: heldItem.producer,
          contractProducer: contract.producer,
          heldItemCode: heldItem.reason.code,
          contractCode: contract.code,
        },
      },
      heldItem,
    }
  }

  const opportunityResult = await loaders.loadOpportunityLedger(heldItem.opportunityId, heldItem)
  const opportunityRejection = loadedOrReject(opportunityResult)
  if (opportunityRejection) return { outcome: opportunityRejection, heldItem }
  if (opportunityResult.status !== 'loaded') {
    return { outcome: { status: 'rejected', reason: 'invalid_canonical_input' }, heldItem }
  }

  const candidateResult = await loaders.loadCandidateState(heldItem.opportunityId, heldItem)
  const candidateRejection = loadedOrReject(candidateResult)
  if (candidateRejection) return { outcome: candidateRejection, heldItem }
  if (candidateResult.status !== 'loaded') {
    return { outcome: { status: 'rejected', reason: 'invalid_canonical_input' }, heldItem }
  }

  const chunksResult = await loaders.loadManuscriptChunks(heldItem.manuscriptId, heldItem.manuscriptVersionSha)
  const chunksRejection = loadedOrReject(chunksResult)
  if (chunksRejection) return { outcome: chunksRejection, heldItem }
  if (chunksResult.status !== 'loaded') {
    return { outcome: { status: 'rejected', reason: 'invalid_canonical_input' }, heldItem }
  }

  let chunks
  try {
    chunks = deriveCanonicalManuscriptChunkReferences(chunksResult.value, {
      manuscriptVersionSha: heldItem.manuscriptVersionSha,
    })
  } catch (error) {
    return {
      outcome: {
        status: 'rejected',
        reason: 'invalid_canonical_input',
        details: { reason: error instanceof Error ? error.message : String(error) },
      },
      heldItem,
    }
  }

  const state: CanonicalRecoveryState = {
    opportunity: {
      ...opportunityResult.value,
      existingCandidatesABC: candidateResult.value ?? undefined,
    },
    manuscript: {
      manuscriptId: heldItem.manuscriptId,
      manuscriptVersionSha: heldItem.manuscriptVersionSha,
      chunks,
    },
  }

  const buildInput = dependencies.buildExecutorInputFromCanonicalState ?? buildRecoveryExecutorInputFromCanonicalState
  const execute = dependencies.executeRecoveryAction ?? executeRecoveryAction
  const executorInput = buildInput({ reason: heldItem.reason }, state)
  const result = execute(executorInput)
  return { outcome: classifyExecutorResult(result), heldItem, executorInput }
}

function hasRecordableResult(outcome: HeldRecoveryRuntimeOutcome): outcome is RecordableHeldRecoveryRuntimeOutcome {
  return 'result' in outcome && outcome.result !== undefined
}

export async function runHeldRecoveryRuntimeOrchestrationWithAttemptRecording(
  reference: HeldItemReference,
  loaders: HeldRecoveryRuntimeLoaders,
  attemptPersistence: HeldRecoveryAttemptPersistenceAdapter,
  options: HeldRecoveryRuntimeAttemptRecordingOptions,
): Promise<HeldRecoveryRuntimeAttemptRecordingResult> {
  const execution = await runHeldRecoveryRuntimeExecution(reference, loaders, options.dependencies)
  if (!execution.heldItem || !execution.executorInput || !hasRecordableResult(execution.outcome)) {
    return {
      runtimeOutcome: execution.outcome,
      attemptRecording: null,
      recordingSkippedReason: 'executor_not_invoked',
    }
  }

  const record = options.recordRecoveryAttempt ?? recordHeldRecoveryAttempt
  const attemptRecording = await record(attemptPersistence, {
    heldItem: execution.heldItem,
    executorInput: execution.executorInput,
    runtimeOutcome: execution.outcome,
    trigger: options.trigger,
    nowIso: options.nowIso,
  })

  return { runtimeOutcome: execution.outcome, attemptRecording }
}

type LedgerArtifactRow = {
  readonly id?: unknown
  readonly artifact_type?: unknown
  readonly artifact_version?: unknown
  readonly source_hash?: unknown
  readonly content?: unknown
  readonly created_at?: unknown
}

type ClassifiedLedgerArtifact =
  | { readonly status: 'current'; readonly row: LedgerArtifactRow; readonly content: Record<string, unknown> }
  | { readonly status: 'legacy'; readonly row: LedgerArtifactRow; readonly content: Record<string, unknown> }
  | { readonly status: 'invalid'; readonly row: LedgerArtifactRow; readonly reason: string }

type LedgerArtifactLoadResult =
  | { readonly status: 'loaded'; readonly content: Record<string, unknown>; readonly artifactId: string | null }
  | { readonly status: 'missing' }
  | { readonly status: 'legacy_only'; readonly legacyArtifactId: string }
  | { readonly status: 'conflict'; readonly reason: string }
  | { readonly status: 'invalid'; readonly reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function artifactIdFor(row: LedgerArtifactRow): string {
  return isNonEmptyString(row.id) ? row.id : 'unknown_legacy_revision_opportunity_ledger_v1'
}

function classifyRevisionLedgerArtifact(row: LedgerArtifactRow): ClassifiedLedgerArtifact {
  const content = isRecord(row.content) ? row.content : null
  if (!content) return { status: 'invalid', row, reason: 'revision_opportunity_ledger_v1 content is not an object' }

  const contentArtifactType = content.artifact_type
  const rowArtifactType = row.artifact_type
  const artifactType = isNonEmptyString(contentArtifactType) ? contentArtifactType : rowArtifactType
  if (artifactType !== 'revision_opportunity_ledger_v1') {
    return { status: 'invalid', row, reason: 'artifact_type is not revision_opportunity_ledger_v1' }
  }

  const opportunities = content.opportunities
  if (!Array.isArray(opportunities)) {
    return { status: 'invalid', row, reason: 'opportunities array is missing' }
  }

  const sourceHash = isNonEmptyString(content.source_hash) ? content.source_hash : row.source_hash
  const hasCurrentAuthorityFields =
    isNonEmptyString(sourceHash) &&
    isNonEmptyString(content.opportunity_source_authority) &&
    isRecord(content.revise_queue_preflight) &&
    isRecord(content.quality_manifest)

  if (hasCurrentAuthorityFields) return { status: 'current', row, content }
  return { status: 'legacy', row, content }
}

function opportunityIds(content: Record<string, unknown>): string[] {
  const opportunities = Array.isArray(content.opportunities) ? content.opportunities : []
  return opportunities
    .filter(isRecord)
    .map((opportunity) => opportunity.opportunity_id)
    .filter(isNonEmptyString)
    .sort()
}

function artifactsEquivalent(current: Record<string, unknown>, legacy: Record<string, unknown>): boolean {
  const currentHash = current.source_hash
  const legacyHash = legacy.source_hash
  if (isNonEmptyString(currentHash) && isNonEmptyString(legacyHash) && currentHash !== legacyHash) return false
  return JSON.stringify(opportunityIds(current)) === JSON.stringify(opportunityIds(legacy))
}

async function loadCanonicalLedgerArtifact(
  supabase: Pick<SupabaseClient, 'from'>,
  jobId: string,
): Promise<LedgerArtifactLoadResult> {
  const { data, error } = await supabase
    .from('evaluation_artifacts')
    .select('id, artifact_type, artifact_version, source_hash, content, created_at')
    .eq('job_id', jobId)
    .eq('artifact_type', 'revision_opportunity_ledger_v1')
    .order('created_at', { ascending: false })

  if (error) return { status: 'invalid', reason: error.message ?? 'failed to read revision_opportunity_ledger_v1' }
  const rows = Array.isArray(data) ? data as LedgerArtifactRow[] : []
  if (rows.length === 0) return { status: 'missing' }

  const classified = rows.map(classifyRevisionLedgerArtifact)
  const invalid = classified.find((item) => item.status === 'invalid')
  if (invalid) return { status: 'invalid', reason: invalid.reason }

  const current = classified.filter((item): item is Extract<ClassifiedLedgerArtifact, { status: 'current' }> => item.status === 'current')
  const legacy = classified.filter((item): item is Extract<ClassifiedLedgerArtifact, { status: 'legacy' }> => item.status === 'legacy')

  if (current.length === 0 && legacy.length > 0) {
    return { status: 'legacy_only', legacyArtifactId: artifactIdFor(legacy[0].row) }
  }

  if (current.length === 0) return { status: 'missing' }
  if (current.length > 1) return { status: 'conflict', reason: 'multiple current revision_opportunity_ledger_v1 artifacts found' }

  if (legacy.length > 0 && !legacy.every((item) => artifactsEquivalent(current[0].content, item.content))) {
    return { status: 'conflict', reason: 'current and legacy revision_opportunity_ledger_v1 artifacts are not identity-equivalent' }
  }

  return { status: 'loaded', content: current[0].content, artifactId: artifactIdFor(current[0].row) }
}

function findOpportunity(content: Record<string, unknown>, opportunityId: string): Record<string, unknown> | null {
  const opportunities = Array.isArray(content.opportunities) ? content.opportunities : []
  return opportunities
    .filter(isRecord)
    .find((opportunity) => opportunity.opportunity_id === opportunityId) ?? null
}

function diagnosticFor(opportunity: Record<string, unknown>): CanonicalRecoveryDiagnostic | undefined {
  const symptom = opportunity.symptom
  const cause = opportunity.cause
  const fixDirection = opportunity.fix_direction
  const readerEffect = opportunity.reader_effect
  if (
    isNonEmptyString(symptom) &&
    isNonEmptyString(cause) &&
    isNonEmptyString(fixDirection) &&
    isNonEmptyString(readerEffect)
  ) {
    return {
      symptom,
      cause,
      fix_direction: fixDirection,
      reader_effect: readerEffect,
    }
  }
  return undefined
}

function candidateStateFor(opportunity: Record<string, unknown>): CanonicalPersistedCandidateState | null {
  if (
    isNonEmptyString(opportunity.candidate_text_a) &&
    isNonEmptyString(opportunity.candidate_text_b) &&
    isNonEmptyString(opportunity.candidate_text_c)
  ) {
    return {
      a: opportunity.candidate_text_a,
      b: opportunity.candidate_text_b,
      c: opportunity.candidate_text_c,
    }
  }
  return null
}

export type SupabaseHeldRecoveryRuntimeLoaderOptions = {
  readonly supabase?: Pick<SupabaseClient, 'from' | 'rpc'>
  readonly jobId: string
}

export function createSupabaseHeldRecoveryRuntimeLoaders(
  options: SupabaseHeldRecoveryRuntimeLoaderOptions,
): Pick<HeldRecoveryRuntimeLoaders, 'loadOpportunityLedger' | 'loadCandidateState' | 'loadManuscriptChunks'> {
  const supabase = options.supabase ?? createAdminClient()

  async function loadLedgerArtifact(): Promise<LedgerArtifactLoadResult> {
    return loadCanonicalLedgerArtifact(supabase, options.jobId)
  }

  return {
    async loadOpportunityLedger(opportunityId: string): Promise<CanonicalOpportunityLoadResult> {
      const artifact = await loadLedgerArtifact()
      if (artifact.status !== 'loaded') return artifact
      const opportunity = findOpportunity(artifact.content, opportunityId)
      if (!opportunity) return { status: 'missing' }

      const ledgerSourceHash = isNonEmptyString(artifact.content.source_hash)
        ? artifact.content.source_hash
        : isNonEmptyString(opportunity.source_ued_hash)
          ? opportunity.source_ued_hash
          : null

      if (!isNonEmptyString(ledgerSourceHash)) return { status: 'invalid', reason: 'canonical ledger source hash is missing' }
      if (!isNonEmptyString(opportunity.evidence_anchor)) return { status: 'invalid', reason: 'evidence_anchor is missing' }
      if (!isNonEmptyString(opportunity.rationale)) return { status: 'invalid', reason: 'rationale/source_text is missing' }
      if (!isNonEmptyString(opportunity.manuscript_coordinates)) return { status: 'invalid', reason: 'manuscript_coordinates is missing' }

      return {
        status: 'loaded',
        value: {
          opportunityId,
          ledgerSourceHash,
          sourceText: opportunity.rationale,
          evidenceAnchor: opportunity.evidence_anchor,
          manuscriptCoordinates: opportunity.manuscript_coordinates,
          rationale: isNonEmptyString(opportunity.rationale) ? opportunity.rationale : undefined,
          diagnostic: diagnosticFor(opportunity),
        },
      }
    },

    async loadCandidateState(opportunityId: string): Promise<CanonicalCandidateStateLoadResult> {
      const artifact = await loadLedgerArtifact()
      if (artifact.status !== 'loaded') return artifact
      const opportunity = findOpportunity(artifact.content, opportunityId)
      if (!opportunity) return { status: 'missing' }
      return { status: 'loaded', value: candidateStateFor(opportunity) }
    },

    async loadManuscriptChunks(manuscriptId: string): Promise<CanonicalManuscriptChunkRowsLoadResult> {
      // Read through the narrow text-returning RPC so the bigint manuscript_id
      // survives as an exact string (get_held_recovery_manuscript_chunks projects
      // manuscript_id::text). The manuscriptId argument is the canonical integer
      // string carried from heldItem.manuscriptId; Postgres accepts it for the
      // bigint parameter. There is deliberately no fallback to a direct
      // .from('manuscript_chunks') read: a numeric read here would reintroduce the
      // precision loss this path exists to prevent.
      const { data, error } = await supabase.rpc('get_held_recovery_manuscript_chunks', {
        p_manuscript_id: manuscriptId,
      })

      // RPC error -> same existing load-error (invalid) result.
      if (error) return { status: 'invalid', reason: error.message ?? 'failed to read manuscript_chunks' }

      const rawRows = Array.isArray(data) ? (data as ReadonlyArray<Record<string, unknown>>) : []
      // RPC success with no rows -> same existing missing-chunks result.
      if (rawRows.length === 0) return { status: 'missing' }

      // Transport-shape adaptation ONLY: rename manuscript_id_text -> manuscript_id
      // so downstream canonical derivation is unchanged. No trimming, no
      // normalization, no numeric conversion. Malformed rows (e.g. missing or
      // non-canonical manuscript_id_text) flow into the same canonical derivation
      // path, whose validation rejects them as invalid_canonical_input.
      const rows = rawRows.map((row) => {
        const { manuscript_id_text, ...rest } = row
        return { ...rest, manuscript_id: manuscript_id_text } as unknown as CanonicalManuscriptChunkRow
      })
      return { status: 'loaded', value: rows }
    },
  }
}