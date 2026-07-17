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
import type { HeldReasonProducer } from './heldRecoverySources'
import {
  candidateSetVersionFor,
  revisionOpportunityVersionFor,
  sourceHashFor,
} from './heldRecoveryVersioning'

// ─────────────────────────────────────────────────────────────────────────────
// Input and result types
// ─────────────────────────────────────────────────────────────────────────────

export type RecoveryExecutorInput = {
  contract: HeldReasonRecoveryContract
  opportunityId: string
  manuscriptVersionSha: string
  ledgerSourceHash: string
  opportunityVersion: string
  candidateSetVersion: string | null
  recoveryInputFingerprint: string
  inputs: Record<string, unknown>
}

export type RecoveryExecutionOutcome =
  | 'success'
  | 'no_op'
  | 'retryable_failure'
  | 'terminal_failure'

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
    case 'source_hash_match':
      return isNonEmptyObject(value)
    default:
      return false
  }
}

function validateRequiredInputs(input: RecoveryExecutorInput): {
  missing: string[]
  invalid: string[]
} {
  const missing: string[] = []
  const invalid: string[] = []

  for (const requirement of input.contract.requiredInputs) {
    const value = input.inputs[requirement.key]
    const present = value !== undefined && value !== null
    if (requirement.required && !present) {
      missing.push(requirement.key)
      continue
    }
    if (present && !passesValidation(value, requirement.validation)) {
      invalid.push(requirement.key)
    }
  }

  return { missing, invalid }
}

function makeResult(
  input: RecoveryExecutorInput,
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
 * Computes an action-specific recovery-input fingerprint. This fingerprint is
 * used only to detect whether the inputs consumed by this action have changed
 * within a single recovery series; it is not a canonical opportunity or
 * candidate-set identity.
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
      return sourceHashFor({
        opportunityVersion: inputs.opportunityVersion,
        candidateSetVersion: inputs.candidateSetVersion,
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

export function executeResolveAnchor(input: RecoveryExecutorInput): RecoveryExecutionResult {
  const { source_text, evidence_anchor, manuscript_coordinates } = input.inputs

  if (!isNonEmptyString(source_text) || !isNonEmptyString(evidence_anchor) || !isNonEmptyString(manuscript_coordinates)) {
    return makeResult(input, 'retryable_failure', {
      error: 'MISSING_REQUIRED_INPUTS',
      details: { reason: 'resolve_anchor requires source_text, evidence_anchor, and manuscript_coordinates' },
    })
  }

  const source = (source_text as string).trim()
  const anchor = (evidence_anchor as string).trim()

  if (!source.includes(anchor)) {
    return makeResult(input, 'retryable_failure', {
      error: 'ANCHOR_NOT_FOUND_IN_SOURCE_TEXT',
      details: { source, anchor, manuscript_coordinates },
    })
  }

  return makeResult(input, 'success', {
    output: {
      resolvedAnchor: anchor,
      sourceText: source,
      manuscriptCoordinates: manuscript_coordinates,
    },
  })
}

export function executeRetrieveContext(input: RecoveryExecutorInput): RecoveryExecutionResult {
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
      details: { source, anchor },
    })
  }

  const chunks = (manuscript_chunks as unknown[]).filter((chunk): chunk is string => typeof chunk === 'string')
  const matchingChunks = chunks.filter((chunk) => chunk.includes(anchor))

  if (matchingChunks.length === 0) {
    return makeResult(input, 'retryable_failure', {
      error: 'ANCHOR_NOT_FOUND_IN_CHUNKS',
      details: { chunks },
    })
  }

  return makeResult(input, 'success', {
    output: {
      retrievedContext: matchingChunks.join('\n'),
      matchingChunkCount: matchingChunks.length,
    },
  })
}

export function executeRepairDiagnosis(input: RecoveryExecutorInput): RecoveryExecutionResult {
  // Deterministic validation only. The actual rewrite is LLM-assisted and is not
  // authorized in this bounded executor phase.
  const { symptom, cause, fix_direction, reader_effect, diagnostic_object } = input.inputs

  const diagnostic = diagnostic_object ?? { symptom, cause, fix_direction, reader_effect }
  if (!isCompleteDiagnostic(diagnostic)) {
    return makeResult(input, 'retryable_failure', {
      error: 'INCOMPLETE_DIAGNOSTIC',
      details: { diagnostic },
    })
  }

  return makeResult(input, 'terminal_failure', {
    error: 'LLM_ASSISTED_NOT_AUTHORIZED',
    details: { action: 'repair_diagnosis' },
  })
}

export function executeCreateVersionedCandidateSet(input: RecoveryExecutorInput): RecoveryExecutionResult {
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

    const expectedVersion = candidateSetVersionFor(existing_candidates_a_b_c as { a: string; b: string; c: string })
    if (input.candidateSetVersion !== expectedVersion) {
      return makeResult(input, 'retryable_failure', {
        error: 'STALE_CANDIDATE_SET_VERSION',
        details: { expectedVersion, candidateSetVersion: input.candidateSetVersion },
      })
    }
  } else if (input.candidateSetVersion !== null) {
    return makeResult(input, 'terminal_failure', {
      error: 'STALE_CANDIDATE_SET_VERSION',
      details: { reason: 'candidateSetVersion provided but no existing_candidates_a_b_c' },
    })
  }

  // Deterministic validation only. New candidate generation is LLM-assisted and
  // is not authorized in this bounded executor phase.
  return makeResult(input, 'terminal_failure', {
    error: 'LLM_ASSISTED_NOT_AUTHORIZED',
    details: { action: 'create_versioned_candidate_set' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

const EXECUTORS: Record<
  Exclude<RecoveryExecutionAction, 'none'>,
  (input: RecoveryExecutorInput) => RecoveryExecutionResult
> = {
  resolve_anchor: executeResolveAnchor,
  retrieve_context: executeRetrieveContext,
  repair_diagnosis: executeRepairDiagnosis,
  create_versioned_candidate_set: executeCreateVersionedCandidateSet,
}

function validateOpportunityVersion(input: RecoveryExecutorInput): RecoveryExecutionResult | null {
  const expected = revisionOpportunityVersionFor(input.opportunityId, input.ledgerSourceHash)
  if (input.opportunityVersion !== expected) {
    return makeResult(input, 'terminal_failure', {
      error: 'STALE_OPPORTUNITY_VERSION',
      details: { expected, opportunityVersion: input.opportunityVersion },
    })
  }
  return null
}

function validateCandidateSetVersion(input: RecoveryExecutorInput): RecoveryExecutionResult | null {
  if (input.contract.recoveryAction !== 'create_versioned_candidate_set') return null

  const existing = input.inputs.existing_candidates_a_b_c
  if (existing !== undefined && existing !== null) {
    if (!isCompleteCandidateSet(existing)) {
      return makeResult(input, 'retryable_failure', {
        error: 'INCOMPLETE_CANDIDATE_SET',
        details: { existing_candidates_a_b_c: existing },
      })
    }
    const expected = candidateSetVersionFor(existing as { a: string; b: string; c: string })
    if (input.candidateSetVersion !== expected) {
      return makeResult(input, 'terminal_failure', {
        error: 'STALE_CANDIDATE_SET_VERSION',
        details: { expected, candidateSetVersion: input.candidateSetVersion },
      })
    }
  } else if (input.candidateSetVersion !== null) {
    return makeResult(input, 'terminal_failure', {
      error: 'STALE_CANDIDATE_SET_VERSION',
      details: { reason: 'candidateSetVersion provided but no existing_candidates_a_b_c' },
    })
  }
  return null
}

function validateFingerprint(input: RecoveryExecutorInput): RecoveryExecutionResult | null {
  const fingerprintInputs = {
    ...input.inputs,
    opportunityVersion: input.opportunityVersion,
    candidateSetVersion: input.candidateSetVersion,
  }
  const expected = computeRecoveryInputFingerprint(input.contract.recoveryAction, fingerprintInputs)
  if (input.recoveryInputFingerprint !== expected) {
    return makeResult(input, 'retryable_failure', {
      error: 'STALE_RECOVERY_INPUT_FINGERPRINT',
      details: { expected, recoveryInputFingerprint: input.recoveryInputFingerprint },
    })
  }
  return null
}

export function executeRecoveryAction(input: RecoveryExecutorInput): RecoveryExecutionResult {
  if (!input || typeof input !== 'object' || !input.contract) {
    return {
      outcome: 'terminal_failure',
      action: 'none',
      producer: '' as HeldReasonProducer,
      code: '',
      error: 'MISSING_RECOVERY_INPUT',
    }
  }

  const { contract } = input

  if (contract.authorityRole !== 'origin') {
    return makeResult(input, 'terminal_failure', {
      error: 'NOT_AN_ORIGIN_PRODUCER',
      details: { authorityRole: contract.authorityRole, producer: contract.producer, code: contract.code },
    })
  }

  if (contract.recoveryAction === 'none') {
    return makeResult(input, 'no_op', {
      error: 'TERMINAL_CONTRACT_NO_ACTION',
      details: { producer: contract.producer, code: contract.code },
    })
  }

  const action = contract.recoveryAction
  if (!Object.prototype.hasOwnProperty.call(EXECUTORS, action)) {
    return makeResult(input, 'terminal_failure', {
      error: 'UNKNOWN_RECOVERY_ACTION',
      details: { recoveryAction: action },
    })
  }

  const opportunityVersionError = validateOpportunityVersion(input)
  if (opportunityVersionError) return opportunityVersionError

  const candidateSetVersionError = validateCandidateSetVersion(input)
  if (candidateSetVersionError) return candidateSetVersionError

  const { missing, invalid } = validateRequiredInputs(input)
  if (missing.length > 0 || invalid.length > 0) {
    return makeResult(input, 'retryable_failure', {
      error: 'MISSING_REQUIRED_INPUTS',
      details: { missing, invalid },
    })
  }

  const fingerprintError = validateFingerprint(input)
  if (fingerprintError) return fingerprintError

  return EXECUTORS[contract.recoveryAction as keyof typeof EXECUTORS](input)
}
