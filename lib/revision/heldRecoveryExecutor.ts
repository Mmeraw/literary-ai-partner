/**
 * Held Recovery Executor
 *
 * Pure, fail-closed recovery execution dispatcher. This module performs no
 * persistence, queue mutation, manuscript application, LLM calls, or runtime
 * orchestration. It validates the recovery contract and required inputs, then
 * dispatches to a single pure executor function keyed by the contract's
 * `recoveryAction`.
 */

import type {
  HeldReasonRecoveryContract,
  RecoveryExecutionAction,
} from './heldRecoveryReasons'
import { getRecoveryContractForReason } from './heldRecoveryReasons'
import type { HeldReasonProducer, HeldReasonSource } from './heldRecoverySources'
import {
  sourceHashFor,
} from './heldRecoveryVersioning'

// ─────────────────────────────────────────────────────────────────────────────
// Input and result types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trusted canonical values provided by the orchestration layer. These values
 * are derived from authoritative ledger / recovery-attempt state before the
 * pure executor runs; the executor must not derive both sides of freshness
 * comparisons from the request.
 *
 * `canonicalRecoveryInputFingerprint` is the fingerprint of the current
 * authoritative recovery-bearing inputs. It is not the persisted prior-attempt
 * fingerprint, which belongs in retry orchestration rather than this bounded
 * execution step.
 */
export type RecoveryAuthoritySnapshot = {
  readonly canonicalLedgerSourceHash: string
  readonly canonicalOpportunityVersion: string
  readonly canonicalCandidateSetVersion: string | null
  readonly canonicalRecoveryInputFingerprint: string
}

export type RecoveryReasonIdentity = {
  readonly code: string
  readonly source: HeldReasonSource
}

export type RecoveryExecutorInput = {
  readonly reason: RecoveryReasonIdentity
  /**
   * Optional inert metadata retained for upstream audit transport. This pure
   * executor does not compare, hash, persist, or emit it, and it must never
   * drive dispatch, validation, result identity, or execution mode.
   */
  readonly callerContractSnapshot?: HeldReasonRecoveryContract
  readonly opportunityId: string
  readonly manuscriptVersionSha: string
  readonly ledgerSourceHash: string
  readonly opportunityVersion: string
  readonly candidateSetVersion: string | null
  readonly recoveryInputFingerprint: string
  readonly authority?: RecoveryAuthoritySnapshot
  readonly inputs: Record<string, unknown>
}

type ResolvedRecoveryExecutorInput = RecoveryExecutorInput & {
  readonly contract: HeldReasonRecoveryContract
}

export type RecoveryExecutionOutcome =
  | 'success'
  | 'no_op'
  | 'retryable_failure'
  | 'terminal_failure'
  /**
   * The action is validated and work is fully specified, but execution requires
   * an LLM-assisted phase not yet authorized in this bounded deterministic
   * phase. The held item is NOT permanently unrecoverable.
   */
  | 'deferred_work'

export type RecoveryExecutionResult = {
  outcome: RecoveryExecutionOutcome
  action: RecoveryExecutionAction
  producer: HeldReasonProducer
  code: string
  output?: Record<string, unknown>
  error?: string
  details?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Fingerprint and identity helpers
// ─────────────────────────────────────────────────────────────────────────────

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNonEmptyString(value: unknown): boolean {
  return isString(value) && value.trim().length > 0
}

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function isNonEmptyObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0
}

function isNonEmpty(value: unknown): boolean {
  if (isString(value)) return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (value !== null && typeof value === 'object') return Object.keys(value).length > 0
  return false
}

function isValidAnchor(value: unknown): boolean {
  return isNonEmptyString(value)
}

function isCompleteDiagnostic(value: unknown): boolean {
  if (isNonEmptyString(value)) return true
  if (!isNonEmptyObject(value)) return false
  const obj = value as Record<string, unknown>
  for (const key of ['symptom', 'cause', 'fix_direction', 'reader_effect']) {
    if (!isNonEmptyString(obj[key])) return false
  }
  return true
}

function isCompleteCandidateSet(value: unknown): boolean {
  if (!isNonEmptyObject(value)) return false
  const obj = value as Record<string, unknown>
  for (const key of ['a', 'b', 'c']) {
    if (!isNonEmptyString(obj[key])) return false
  }
  return true
}

function passesValidation(value: unknown, validation: string): boolean {
  switch (validation) {
    case 'non_empty':
      return isNonEmpty(value)
    case 'valid_anchor':
      return isValidAnchor(value)
    case 'complete_diagnostic':
      return isCompleteDiagnostic(value)
    case 'complete_candidate_set':
      return isCompleteCandidateSet(value)
    case 'non_empty_source_hash':
      return isNonEmptyString(value)
    default:
      return false
  }
}

function validateRequiredInputs(input: ResolvedRecoveryExecutorInput): {
  missing: string[]
  invalidRetryable: string[]
  invalidTerminal: string[]
} {
  const missing: string[] = []
  const invalidRetryable: string[] = []
  const invalidTerminal: string[] = []

  for (const requirement of input.contract.requiredInputs) {
    const value = input.inputs[requirement.key]
    const present = value !== undefined && value !== null
    if (requirement.required && !present) {
      missing.push(requirement.key)
      continue
    }
    if (present && !passesValidation(value, requirement.validation)) {
      if (requirement.validation === 'non_empty_source_hash') {
        invalidTerminal.push(requirement.key)
      } else {
        invalidRetryable.push(requirement.key)
      }
    }
  }

  return { missing, invalidRetryable, invalidTerminal }
}

function makeResult(
  input: ResolvedRecoveryExecutorInput,
  outcome: RecoveryExecutionOutcome,
  options: {
    output?: Record<string, unknown>
    error?: string
    details?: Record<string, unknown>
    action?: RecoveryExecutionAction
  } = {},
): RecoveryExecutionResult {
  return {
    outcome,
    action: options.action ?? input.contract.recoveryAction,
    producer: input.contract.producer,
    code: input.contract.code,
    output: options.output,
    error: options.error,
    details: options.details,
  }
}

/**
 * Computes an action-specific recovery-input fingerprint.
 *
 * This fingerprint is used ONLY to detect whether the inputs consumed by this
 * action have changed within a single recovery series. It is NOT a canonical
 * opportunity version or candidate-set identity. Identity metadata
 * (opportunityVersion, candidateSetVersion) is excluded from this fingerprint
 * because those values already have independent identity checks.
 */
export function computeRecoveryInputFingerprint(
  action: RecoveryExecutionAction,
  inputs: Record<string, unknown>,
): string {
  switch (action) {
    case 'resolve_anchor':
    case 'retrieve_context':
      return sourceHashFor({
        evidence_anchor: inputs.evidence_anchor,
        source_text: inputs.source_text,
        manuscript_coordinates: inputs.manuscript_coordinates,
      })
    case 'repair_diagnosis':
      return sourceHashFor({
        symptom: inputs.symptom,
        cause: inputs.cause,
        fix_direction: inputs.fix_direction,
        reader_effect: inputs.reader_effect,
        rationale: inputs.rationale,
      })
    case 'create_versioned_candidate_set':
      // Identity metadata (opportunityVersion, candidateSetVersion) is
      // intentionally excluded; those have independent identity checks.
      return sourceHashFor({
        source_text: inputs.source_text,
        evidence_anchor: inputs.evidence_anchor,
        diagnostic_object: inputs.diagnostic_object,
        rationale: inputs.rationale,
      })
    case 'none':
    default:
      return ''
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure executor functions
// ─────────────────────────────────────────────────────────────────────────────

export function executeResolveAnchor(input: ResolvedRecoveryExecutorInput): RecoveryExecutionResult {
  const { source_text, evidence_anchor, manuscript_coordinates } = input.inputs

  if (!isNonEmptyString(source_text) || !isNonEmptyString(evidence_anchor) || !isNonEmptyString(manuscript_coordinates)) {
    return makeResult(input, 'retryable_failure', {
      error: 'MISSING_REQUIRED_INPUTS',
      details: { reason: 'resolve_anchor requires source_text, evidence_anchor, and manuscript_coordinates' },
    })
  }

  const source = (source_text as string).trim()
  const anchor = (evidence_anchor as string).trim()
  const startOffset = source.indexOf(anchor)

  if (startOffset === -1) {
    return makeResult(input, 'retryable_failure', {
      error: 'ANCHOR_NOT_FOUND_IN_SOURCE_TEXT',
      details: { manuscript_coordinates, anchorLength: anchor.length },
    })
  }

  return makeResult(input, 'deferred_work', {
    error: 'ANCHOR_RECONSTRUCTION_REQUIRED',
    details: {
      locatedAnchor: anchor,
      sourceStartOffset: startOffset,
      sourceEndOffset: startOffset + anchor.length,
      manuscriptCoordinates: manuscript_coordinates as string,
      sourceHash: sourceHashFor({ source_text: source }),
      recoveryMethod: 'source_text_location_only' as const,
    },
  })
}

export function executeRetrieveContext(input: ResolvedRecoveryExecutorInput): RecoveryExecutionResult {
  const { source_text, evidence_anchor, manuscript_chunks } = input.inputs

  if (!isNonEmptyString(source_text) || !isNonEmptyString(evidence_anchor) || !isNonEmptyArray(manuscript_chunks)) {
    return makeResult(input, 'retryable_failure', {
      error: 'MISSING_REQUIRED_INPUTS',
      details: { reason: 'retrieve_context requires source_text, evidence_anchor, and manuscript_chunks' },
    })
  }

  const source = (source_text as string).trim()
  const anchor = (evidence_anchor as string).trim()

  if (!source.includes(anchor)) {
    return makeResult(input, 'retryable_failure', {
      error: 'ANCHOR_NOT_FOUND_IN_SOURCE_TEXT',
      details: { anchorLength: anchor.length },
    })
  }

  const chunks = (manuscript_chunks as unknown[]).filter((c): c is string => typeof c === 'string')
  const selectedChunks = chunks
    .map((text, index) => ({ index, text, anchorOffset: text.indexOf(anchor) }))
    .filter((chunk) => chunk.anchorOffset !== -1)

  if (selectedChunks.length === 0) {
    return makeResult(input, 'retryable_failure', {
      error: 'ANCHOR_NOT_FOUND_IN_CHUNKS',
      details: { chunkCount: chunks.length },
    })
  }

  return makeResult(input, 'success', {
    output: {
      selectedChunks,
      matchingChunkCount: selectedChunks.length,
      anchor,
      selectionRule: 'anchor_substring_match' as const,
    },
  })
}

export function executeRepairDiagnosis(input: ResolvedRecoveryExecutorInput): RecoveryExecutionResult {
  // Deterministic validation only. The actual rewrite is LLM-assisted and is
  // not authorized in this bounded executor phase. deferred_work signals that
  // the held item is recoverable once an LLM phase is authorized.
  const { symptom, cause, fix_direction, reader_effect, diagnostic_object } = input.inputs

  const diagnostic = diagnostic_object ?? { symptom, cause, fix_direction, reader_effect }
  if (!isCompleteDiagnostic(diagnostic)) {
    return makeResult(input, 'retryable_failure', {
      error: 'INCOMPLETE_DIAGNOSTIC',
      details: { diagnostic },
    })
  }

  return makeResult(input, 'deferred_work', {
    error: 'LLM_ASSISTED_NOT_AUTHORIZED',
    details: { action: 'repair_diagnosis', phase: 'deterministic_only' },
  })
}

export function executeCreateVersionedCandidateSet(input: ResolvedRecoveryExecutorInput): RecoveryExecutionResult {
  const { source_text, evidence_anchor, diagnostic_object, existing_candidates_a_b_c } = input.inputs

  if (!isNonEmptyString(source_text) || !isNonEmptyString(evidence_anchor) || !isCompleteDiagnostic(diagnostic_object)) {
    return makeResult(input, 'retryable_failure', {
      error: 'MISSING_REQUIRED_INPUTS',
      details: { reason: 'create_versioned_candidate_set requires source_text, evidence_anchor, and diagnostic_object' },
    })
  }

  if (existing_candidates_a_b_c !== undefined && existing_candidates_a_b_c !== null) {
    if (!isCompleteCandidateSet(existing_candidates_a_b_c)) {
      return makeResult(input, 'retryable_failure', {
        error: 'INCOMPLETE_CANDIDATE_SET',
        details: { existing_candidates_a_b_c },
      })
    }
  } else if (input.candidateSetVersion !== null) {
    return makeResult(input, 'terminal_failure', {
      error: 'STALE_CANDIDATE_SET_VERSION',
      details: { reason: 'candidateSetVersion provided but no existing_candidates_a_b_c' },
    })
  }

  // Inputs validated. New candidate generation is LLM-assisted and not
  // authorized in this bounded executor phase. deferred_work signals that
  // the held item is recoverable once an LLM phase is authorized.
  return makeResult(input, 'deferred_work', {
    error: 'LLM_ASSISTED_NOT_AUTHORIZED',
    details: { action: 'create_versioned_candidate_set', phase: 'deterministic_only' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

const EXECUTORS: Record<
  Exclude<RecoveryExecutionAction, 'none'>,
  (input: ResolvedRecoveryExecutorInput) => RecoveryExecutionResult
> = {
  resolve_anchor: executeResolveAnchor,
  retrieve_context: executeRetrieveContext,
  repair_diagnosis: executeRepairDiagnosis,
  create_versioned_candidate_set: executeCreateVersionedCandidateSet,
}

function validateAuthoritySnapshot(input: ResolvedRecoveryExecutorInput): RecoveryExecutionResult | null {
  if (!input.authority) {
    return makeResult(input, 'terminal_failure', {
      error: 'MISSING_CANONICAL_AUTHORITY_SNAPSHOT',
      details: { reason: 'Executable recovery requires independently derived canonical authority.' },
    })
  }

  if (input.ledgerSourceHash !== input.authority.canonicalLedgerSourceHash) {
    return makeResult(input, 'terminal_failure', {
      error: 'STALE_LEDGER_SOURCE_HASH',
      details: {
        ledgerSourceHash: input.ledgerSourceHash,
        canonicalLedgerSourceHash: input.authority.canonicalLedgerSourceHash,
      },
    })
  }

  if (input.opportunityVersion !== input.authority.canonicalOpportunityVersion) {
    return makeResult(input, 'terminal_failure', {
      error: 'STALE_OPPORTUNITY_VERSION',
      details: {
        opportunityVersion: input.opportunityVersion,
        canonicalOpportunityVersion: input.authority.canonicalOpportunityVersion,
      },
    })
  }

  if (input.candidateSetVersion !== input.authority.canonicalCandidateSetVersion) {
    return makeResult(input, 'terminal_failure', {
      error: 'STALE_CANDIDATE_SET_VERSION',
      details: {
        candidateSetVersion: input.candidateSetVersion,
        canonicalCandidateSetVersion: input.authority.canonicalCandidateSetVersion,
      },
    })
  }

  const recomputedFingerprint = computeRecoveryInputFingerprint(input.contract.recoveryAction, input.inputs)
  if (
    input.recoveryInputFingerprint !== input.authority.canonicalRecoveryInputFingerprint ||
    recomputedFingerprint !== input.authority.canonicalRecoveryInputFingerprint
  ) {
    return makeResult(input, 'retryable_failure', {
      error: 'STALE_RECOVERY_INPUT_FINGERPRINT',
      details: {
        recoveryInputFingerprint: input.recoveryInputFingerprint,
        recomputedFingerprint,
        canonicalRecoveryInputFingerprint: input.authority.canonicalRecoveryInputFingerprint,
      },
    })
  }

  return null
}

export function executeRecoveryAction(input: RecoveryExecutorInput): RecoveryExecutionResult {
  if (!input || typeof input !== 'object' || !input.reason) {
    return {
      outcome: 'terminal_failure',
      action: 'none',
      producer: '' as HeldReasonProducer,
      code: '',
      error: 'MISSING_RECOVERY_INPUT',
    }
  }

  const contract = getRecoveryContractForReason(input.reason)
  if (!contract) {
    return {
      outcome: 'terminal_failure',
      action: 'none',
      producer: '' as HeldReasonProducer,
      code: input.reason.code,
      error: 'UNKNOWN_RECOVERY_CONTRACT',
      details: { reason: input.reason },
    }
  }

  const resolvedInput: ResolvedRecoveryExecutorInput = { ...input, contract }

  if (contract.authorityRole !== 'origin') {
    return makeResult(resolvedInput, 'terminal_failure', {
      error: 'NOT_AN_ORIGIN_PRODUCER',
      details: { authorityRole: contract.authorityRole, producer: contract.producer, code: contract.code },
    })
  }

  if (contract.recoveryAction === 'none') {
    return makeResult(resolvedInput, 'no_op', {
      error: 'TERMINAL_CONTRACT_NO_ACTION',
      details: { producer: contract.producer, code: contract.code },
    })
  }

  const action = contract.recoveryAction
  if (!Object.prototype.hasOwnProperty.call(EXECUTORS, action)) {
    return makeResult(resolvedInput, 'terminal_failure', {
      error: 'UNKNOWN_RECOVERY_ACTION',
      details: { recoveryAction: action },
    })
  }

  const authorityError = validateAuthoritySnapshot(resolvedInput)
  if (authorityError) return authorityError

  const { missing, invalidRetryable, invalidTerminal } = validateRequiredInputs(resolvedInput)
  if (missing.length > 0) {
    return makeResult(resolvedInput, 'retryable_failure', {
      error: 'MISSING_REQUIRED_INPUTS',
      details: { missing },
    })
  }
  if (invalidRetryable.length > 0) {
    return makeResult(resolvedInput, 'retryable_failure', {
      error: 'INVALID_RECOVERABLE_INPUTS',
      details: { invalid: invalidRetryable },
    })
  }
  if (invalidTerminal.length > 0) {
    return makeResult(resolvedInput, 'terminal_failure', {
      error: 'INVALID_REQUIRED_INPUTS',
      details: { invalid: invalidTerminal },
    })
  }

  return EXECUTORS[contract.recoveryAction as keyof typeof EXECUTORS](resolvedInput)
}
