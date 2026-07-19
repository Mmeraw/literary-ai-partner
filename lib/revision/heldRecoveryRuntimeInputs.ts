/**
 * Held Recovery Runtime Input Proof Helpers
 *
 * Pure, side-effect-free helpers for proving the boundary between persisted
 * canonical state and the held-recovery executor input. This module does not
 * read databases, mutate queues, write ledgers, or wire the executor into any
 * production runtime. Callers must provide already-read canonical state.
 */

import { createHash } from 'crypto'
import {
  computeRecoveryInputFingerprint,
  executeRecoveryAction,
  type RecoveryAuthoritySnapshot,
  type RecoveryExecutorInput,
  type RecoveryExecutionResult,
  type RecoveryReasonIdentity,
} from './heldRecoveryExecutor'
import { getRecoveryContractForReason, type RecoveryExecutionAction } from './heldRecoveryReasons'
import type { HeldReasonSource } from './heldRecoverySources'
import { candidateSetVersionFor, revisionOpportunityVersionFor } from './heldRecoveryVersioning'

export type CanonicalChunkSource = 'manuscript_chunks'

export type CanonicalManuscriptChunkRow = {
  readonly id: string
  /**
   * Canonical non-negative integer STRING, never a JS number. manuscript_chunks.
   * manuscript_id is a Postgres bigint whose exact value can exceed 2^53; reading
   * it as a number would lose precision. This boundary accepts only the canonical
   * string form (see get_held_recovery_manuscript_chunks, which projects
   * manuscript_id::text). Numeric IDs are rejected, not converted.
   */
  readonly manuscript_id: string
  readonly chunk_index: number
  readonly char_start: number
  readonly char_end: number
  readonly overlap_chars?: number | null
  readonly label?: string | null
  readonly content: string
  readonly content_hash: string
}

export type CanonicalManuscriptChunkReference = {
  readonly chunkId: string
  /** Canonical non-negative integer string carried unchanged from the DB read. */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly chunkIndex: number
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly overlapChars: number
  readonly label: string | null
  readonly content: string
  readonly contentHash: string
  readonly provenance: {
    readonly source: CanonicalChunkSource
    readonly rowId: string
  }
}

export type CanonicalRecoveryDiagnostic = {
  readonly symptom: string
  readonly cause: string
  readonly fix_direction: string
  readonly reader_effect: string
}

export type CanonicalRecoveryOpportunity = {
  readonly opportunityId: string
  readonly ledgerSourceHash: string
  readonly sourceText: string
  readonly evidenceAnchor: string
  readonly manuscriptCoordinates: string
  readonly rationale?: string
  readonly diagnostic?: CanonicalRecoveryDiagnostic
  readonly existingCandidatesABC?: {
    readonly a: string
    readonly b: string
    readonly c: string
    readonly options?: { readonly a?: unknown; readonly b?: unknown; readonly c?: unknown }
  }
}

export type CanonicalRecoveryState = {
  readonly opportunity: CanonicalRecoveryOpportunity
  readonly manuscript: {
    /** Canonical non-negative integer string; never a JS number (bigint fidelity). */
    readonly manuscriptId: string
    readonly manuscriptVersionSha: string
    readonly chunks: readonly CanonicalManuscriptChunkReference[]
  }
}

export type RecoveryInputProvenance = {
  readonly source_text: 'canonical_opportunity.sourceText'
  readonly manuscript_coordinates: 'canonical_opportunity.manuscriptCoordinates'
  readonly evidence_anchor: 'canonical_opportunity.evidenceAnchor'
  readonly manuscript_chunks: 'manuscript_chunks.derivedCanonicalReferences'
  readonly symptom: 'canonical_opportunity.diagnostic.symptom'
  readonly cause: 'canonical_opportunity.diagnostic.cause'
  readonly fix_direction: 'canonical_opportunity.diagnostic.fix_direction'
  readonly reader_effect: 'canonical_opportunity.diagnostic.reader_effect'
  readonly rationale: 'canonical_opportunity.rationale'
  readonly diagnostic_object: 'canonical_opportunity.diagnostic'
  readonly existing_candidates_a_b_c: 'persisted_ledger.existingCandidatesABC'
}

export const HELD_RECOVERY_INPUT_PROVENANCE: RecoveryInputProvenance = {
  source_text: 'canonical_opportunity.sourceText',
  manuscript_coordinates: 'canonical_opportunity.manuscriptCoordinates',
  evidence_anchor: 'canonical_opportunity.evidenceAnchor',
  manuscript_chunks: 'manuscript_chunks.derivedCanonicalReferences',
  symptom: 'canonical_opportunity.diagnostic.symptom',
  cause: 'canonical_opportunity.diagnostic.cause',
  fix_direction: 'canonical_opportunity.diagnostic.fix_direction',
  reader_effect: 'canonical_opportunity.diagnostic.reader_effect',
  rationale: 'canonical_opportunity.rationale',
  diagnostic_object: 'canonical_opportunity.diagnostic',
  existing_candidates_a_b_c: 'persisted_ledger.existingCandidatesABC',
}

export type HeldRecoveryRuntimeRequest = {
  readonly reason: RecoveryReasonIdentity
  /**
   * Explicitly untrusted caller metadata. These values are accepted only so
   * adversarial tests can prove they are ignored by the adapter.
   */
  readonly requestedIdentity?: {
    readonly ledgerSourceHash?: string
    readonly opportunityVersion?: string
    readonly candidateSetVersion?: string | null
    readonly recoveryInputFingerprint?: string
    readonly manuscriptVersionSha?: string
  }
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number.isFinite(value)
}

/**
 * Canonical non-negative integer string: an optional single leading zero only
 * for the literal "0", otherwise no leading zeros, and no sign, decimal point,
 * exponent, or surrounding whitespace. This is the ONLY accepted form for a
 * manuscript_id at this boundary. Values such as " 1", "01", "+1", "1.0", and
 * "1e3" are rejected rather than repaired, and numeric IDs are rejected outright
 * so a precision-lossy number can never masquerade as an identity here.
 */
const CANONICAL_INTEGER_STRING = /^(0|[1-9][0-9]*)$/

function isCanonicalManuscriptId(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_INTEGER_STRING.test(value)
}

export function deriveCanonicalManuscriptChunkReference(
  row: CanonicalManuscriptChunkRow,
  context: { readonly manuscriptVersionSha: string },
): CanonicalManuscriptChunkReference {
  if (!isNonEmptyString(row.id)) throw new Error('Canonical chunk row is missing stable id')
  if (!isCanonicalManuscriptId(row.manuscript_id)) throw new Error(`Canonical chunk ${row.id} has a non-canonical manuscript_id`)
  if (!isFiniteInteger(row.chunk_index) || row.chunk_index < 0) throw new Error(`Canonical chunk ${row.id} has invalid chunk_index`)
  if (!isFiniteInteger(row.char_start) || !isFiniteInteger(row.char_end) || row.char_end <= row.char_start) {
    throw new Error(`Canonical chunk ${row.id} has invalid source offsets`)
  }
  if (!isNonEmptyString(row.content)) throw new Error(`Canonical chunk ${row.id} is missing content`)
  if (!isNonEmptyString(row.content_hash)) throw new Error(`Canonical chunk ${row.id} is missing content_hash`)
  if (!isNonEmptyString(context.manuscriptVersionSha)) throw new Error(`Canonical chunk ${row.id} is missing manuscriptVersionSha binding`)

  const recomputedHash = sha256Hex(row.content)
  if (row.content_hash !== recomputedHash) {
    throw new Error(`Canonical chunk ${row.id} content_hash does not match content`)
  }

  return {
    chunkId: row.id,
    // Carried unchanged: no trimming, no normalization, no numeric conversion.
    manuscriptId: row.manuscript_id,
    manuscriptVersionSha: context.manuscriptVersionSha,
    chunkIndex: row.chunk_index,
    sourceStartOffset: row.char_start,
    sourceEndOffset: row.char_end,
    overlapChars: row.overlap_chars ?? 0,
    label: row.label ?? null,
    content: row.content,
    contentHash: row.content_hash,
    provenance: {
      source: 'manuscript_chunks',
      rowId: row.id,
    },
  }
}

export function deriveCanonicalManuscriptChunkReferences(
  rows: readonly CanonicalManuscriptChunkRow[],
  context: { readonly manuscriptVersionSha: string },
): CanonicalManuscriptChunkReference[] {
  const refs = rows
    .map((row) => deriveCanonicalManuscriptChunkReference(row, context))
    .sort((a, b) => a.chunkIndex - b.chunkIndex)

  for (let index = 0; index < refs.length; index += 1) {
    if (refs[index].chunkIndex !== index) {
      throw new Error(`Canonical chunk indexes must be contiguous from 0; saw ${refs[index].chunkIndex} at position ${index}`)
    }
  }

  return refs
}

export function isCanonicalManuscriptChunkReference(value: unknown): value is CanonicalManuscriptChunkReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const ref = value as CanonicalManuscriptChunkReference
  return isNonEmptyString(ref.chunkId) &&
    isCanonicalManuscriptId(ref.manuscriptId) &&
    isNonEmptyString(ref.manuscriptVersionSha) &&
    isFiniteInteger(ref.chunkIndex) &&
    isFiniteInteger(ref.sourceStartOffset) &&
    isFiniteInteger(ref.sourceEndOffset) &&
    ref.sourceEndOffset > ref.sourceStartOffset &&
    isNonEmptyString(ref.content) &&
    isNonEmptyString(ref.contentHash) &&
    ref.contentHash === sha256Hex(ref.content) &&
    ref.provenance?.source === 'manuscript_chunks' &&
    ref.provenance.rowId === ref.chunkId
}

function requireDiagnostic(opportunity: CanonicalRecoveryOpportunity): CanonicalRecoveryDiagnostic {
  if (!opportunity.diagnostic) throw new Error(`Opportunity ${opportunity.opportunityId} is missing canonical diagnostic_object`)
  return opportunity.diagnostic
}

function candidateSetVersionFromOpportunity(opportunity: CanonicalRecoveryOpportunity): string | null {
  const candidates = opportunity.existingCandidatesABC
  if (!candidates) return null
  return candidateSetVersionFor({
    a: candidates.a,
    b: candidates.b,
    c: candidates.c,
    options: candidates.options,
  })
}

export function buildCanonicalRecoveryInputs(
  action: RecoveryExecutionAction,
  state: CanonicalRecoveryState,
): Record<string, unknown> {
  const opportunity = state.opportunity
  const diagnostic = opportunity.diagnostic

  switch (action) {
    case 'resolve_anchor':
      return {
        source_text: opportunity.sourceText,
        manuscript_coordinates: opportunity.manuscriptCoordinates,
        evidence_anchor: opportunity.evidenceAnchor,
      }
    case 'retrieve_context':
      return {
        source_text: opportunity.sourceText,
        evidence_anchor: opportunity.evidenceAnchor,
        manuscript_chunks: state.manuscript.chunks,
      }
    case 'repair_diagnosis': {
      const requiredDiagnostic = requireDiagnostic(opportunity)
      return {
        symptom: requiredDiagnostic.symptom,
        cause: requiredDiagnostic.cause,
        fix_direction: requiredDiagnostic.fix_direction,
        reader_effect: requiredDiagnostic.reader_effect,
        rationale: opportunity.rationale,
      }
    }
    case 'create_versioned_candidate_set':
      return {
        source_text: opportunity.sourceText,
        evidence_anchor: opportunity.evidenceAnchor,
        rationale: opportunity.rationale,
        diagnostic_object: requireDiagnostic(opportunity),
        existing_candidates_a_b_c: opportunity.existingCandidatesABC,
      }
    case 'none':
    default:
      return diagnostic ? { diagnostic_object: diagnostic } : {}
  }
}

export function buildRecoveryExecutorInputFromCanonicalState(
  request: HeldRecoveryRuntimeRequest,
  state: CanonicalRecoveryState,
): RecoveryExecutorInput {
  const contract = getRecoveryContractForReason(request.reason)
  const action = contract?.recoveryAction ?? 'none'
  const inputs = buildCanonicalRecoveryInputs(action, state)
  const opportunityVersion = revisionOpportunityVersionFor(
    state.opportunity.opportunityId,
    state.opportunity.ledgerSourceHash,
  )
  const candidateSetVersion = candidateSetVersionFromOpportunity(state.opportunity)
  const recoveryInputFingerprint = computeRecoveryInputFingerprint(action, inputs)
  const authority: RecoveryAuthoritySnapshot | undefined = action === 'none'
    ? undefined
    : {
        canonicalLedgerSourceHash: state.opportunity.ledgerSourceHash,
        canonicalOpportunityVersion: opportunityVersion,
        canonicalCandidateSetVersion: candidateSetVersion,
        canonicalRecoveryInputFingerprint: recoveryInputFingerprint,
      }

  return {
    reason: request.reason,
    opportunityId: state.opportunity.opportunityId,
    manuscriptVersionSha: state.manuscript.manuscriptVersionSha,
    ledgerSourceHash: state.opportunity.ledgerSourceHash,
    opportunityVersion,
    candidateSetVersion,
    recoveryInputFingerprint,
    authority,
    inputs,
  }
}

export function executeHeldRecoveryRuntimeProof(
  request: HeldRecoveryRuntimeRequest,
  state: CanonicalRecoveryState,
): RecoveryExecutionResult {
  return executeRecoveryAction(buildRecoveryExecutorInputFromCanonicalState(request, state))
}

export function sourceHashForCanonicalChunkContent(content: string): string {
  return sha256Hex(content)
}

export type CanonicalRecoveryInputSourceMapEntry = {
  readonly key: keyof RecoveryInputProvenance
  readonly canonicalSource: RecoveryInputProvenance[keyof RecoveryInputProvenance]
  readonly persistedAuthority: string
}

export function listCanonicalRecoveryInputSourceMap(): CanonicalRecoveryInputSourceMapEntry[] {
  return [
    { key: 'source_text', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.source_text, persistedAuthority: 'revision opportunity ledger / canonical opportunity projection' },
    { key: 'manuscript_coordinates', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.manuscript_coordinates, persistedAuthority: 'revision opportunity ledger / canonical opportunity projection' },
    { key: 'evidence_anchor', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.evidence_anchor, persistedAuthority: 'revision opportunity ledger / canonical opportunity projection' },
    { key: 'manuscript_chunks', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.manuscript_chunks, persistedAuthority: 'manuscript_chunks rows with manuscriptVersionSha binding' },
    { key: 'symptom', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.symptom, persistedAuthority: 'revision opportunity ledger diagnostic fields' },
    { key: 'cause', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.cause, persistedAuthority: 'revision opportunity ledger diagnostic fields' },
    { key: 'fix_direction', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.fix_direction, persistedAuthority: 'revision opportunity ledger diagnostic fields' },
    { key: 'reader_effect', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.reader_effect, persistedAuthority: 'revision opportunity ledger diagnostic fields' },
    { key: 'rationale', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.rationale, persistedAuthority: 'revision opportunity ledger rationale' },
    { key: 'diagnostic_object', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.diagnostic_object, persistedAuthority: 'revision opportunity ledger diagnostic fields' },
    { key: 'existing_candidates_a_b_c', canonicalSource: HELD_RECOVERY_INPUT_PROVENANCE.existing_candidates_a_b_c, persistedAuthority: 'persisted opportunity ledger candidate A/B/C fields' },
  ]
}

export function heldRecoveryReason(code: string, source: HeldReasonSource): RecoveryReasonIdentity {
  return { code, source }
}