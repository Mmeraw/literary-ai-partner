/**
 * Held Recovery — Reconstructed Anchor Content Builder
 *
 * Purely transforms verified reconstruction authority plus canonical source
 * inputs into the content required by re-admission:
 *
 *   ReconstructedAnchorAuthority
 *   + exact canonical source text
 *   + one normalized canonical chunk
 *   + canonical manuscriptCoordinates
 *   → ReconstructedAnchorContent
 *
 * This module does NOT: load database rows, interpret raw
 * manuscript_chunks char-offset/overlap fields, stitch chunks together,
 * search for the anchor as a substring, regenerate manuscript coordinates,
 * talk to the backing database directly, perform re-admission, classify
 * opportunities, assign finalDecision.cardType, transition queues, mutate
 * its inputs, or perform orchestration of any kind. The future canonical
 * chunk loader owns translating raw manuscript_chunks persistence into the
 * CanonicalSingleChunkSource shape this module consumes.
 *
 * sourceHash semantics (proven from executeResolveAnchor,
 * lib/revision/heldRecoveryExecutor.ts):
 *   authority.sourceHash = sourceHashFor({ source_text: <trimmed source> })
 *   — a hash of the FULL trimmed canonical source text, not a hash of a
 *   manuscript chunk's raw content. Whitespace trimming happens exactly
 *   once below, only to reproduce this hash for verification — the
 *   extracted evidenceAnchor and the canonicalManuscriptCoordinates are
 *   never altered or normalized.
 *
 * Offset semantics: all offsets are JavaScript string-index offsets — i.e.
 * UTF-16 code-unit positions as produced by plain length / slice operations,
 * the same coordinate system executeResolveAnchor uses. They are NOT byte
 * offsets and NOT Unicode code-point offsets: a character outside the Basic
 * Multilingual Plane occupies two string-index positions. Offsets are over
 * half-open intervals [start, end). chunk.contentAbsoluteStart /
 * chunk.contentAbsoluteEnd must already be normalized by the caller to
 * exactly bound chunk.content in this same coordinate system (verified
 * below); this module never derives that normalization itself.
 *
 * Single-chunk-only: any authority span not fully contained within the one
 * supplied chunk fails closed as 'cross_chunk_span_unsupported'. No
 * adjacent-chunk loading, concatenation, or boundary stitching is performed
 * by this module.
 */

import { sourceHashFor } from './heldRecoveryVersioning'
import { sourceHashForCanonicalChunkContent } from './heldRecoveryRuntimeInputs'

export type ReconstructedAnchorAuthority = {
  /**
   * Canonical non-negative integer STRING (e.g. "9223372036854775807"), never a
   * JS number, so the exact bigint value of `manuscripts.id` survives unchanged
   * from the executor boundary through this builder to the persistence adapter.
   * Identity is compared by string equality against canonicalSource.manuscriptId
   * and chunk.manuscriptId; no numeric conversion occurs anywhere in this path.
   */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly recoveryMethod: 'source_text_location_only'
  readonly completionFingerprint: string
}

export type ReconstructedAnchorContent = {
  readonly evidenceAnchor: string
  readonly manuscriptCoordinates: string
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly recoveryMethod: 'source_text_location_only'
}

/**
 * A single canonical chunk whose (contentAbsoluteStart, contentAbsoluteEnd)
 * interval already exactly bounds content
 * (contentAbsoluteEnd - contentAbsoluteStart === content.length).
 * Producing this normalized shape from raw manuscript_chunks storage is the
 * responsibility of a future canonical chunk loader — never this module.
 */
export type CanonicalSingleChunkSource = {
  readonly chunkId: string
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly contentAbsoluteStart: number
  readonly contentAbsoluteEnd: number
  readonly content: string
  readonly contentHash: string
}

export type BuildReconstructedAnchorContentInput = {
  readonly authority: ReconstructedAnchorAuthority

  /**
   * Exact canonical source text corresponding to the executor's source_text —
   * the same text whose trimmed form was hashed into authority.sourceHash by
   * executeResolveAnchor.
   */
  readonly canonicalSource: {
    readonly manuscriptId: string
    readonly manuscriptVersionSha: string
    readonly text: string
  }

  readonly chunk: CanonicalSingleChunkSource

  /**
   * Existing producer-authored canonical locator
   * (opportunity.manuscriptCoordinates). Carried forward unchanged — never
   * synthesized from offsets, chunk ids, or hashes, because no canonical
   * offset-to-coordinate formatter exists.
   */
  readonly canonicalManuscriptCoordinates: string
}

export type BuildReconstructedAnchorContentRejectionReason =
  | 'manuscript_identity_mismatch'
  | 'manuscript_version_mismatch'
  | 'unsupported_recovery_method'
  | 'chunk_content_hash_mismatch'
  | 'authority_source_hash_mismatch'
  | 'malformed_chunk_offsets'
  | 'malformed_authority_offsets'
  | 'cross_chunk_span_unsupported'
  | 'chunk_content_length_mismatch'
  | 'chunk_canonical_source_mismatch'
  | 'empty_reconstructed_anchor'
  | 'missing_canonical_manuscript_coordinates'

/**
 * The builder computes exactly these two fields. The remaining
 * ReconstructedAnchorContent fields (sourceHash, sourceStartOffset,
 * sourceEndOffset, recoveryMethod) are already fully known to the caller
 * from ReconstructedAnchorAuthority and are not recomputed or re-returned
 * here — this module does not create a second, competing content type.
 */
export type ReconstructedAnchorContentResult = Pick<
  ReconstructedAnchorContent,
  'evidenceAnchor' | 'manuscriptCoordinates'
>

export type BuildReconstructedAnchorContentResult =
  | { readonly status: 'built'; readonly value: ReconstructedAnchorContentResult }
  | { readonly status: 'rejected'; readonly reason: BuildReconstructedAnchorContentRejectionReason }

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && /\S/.test(value)
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function rejected(
  reason: BuildReconstructedAnchorContentRejectionReason,
): BuildReconstructedAnchorContentResult {
  return { status: 'rejected', reason }
}

export function buildReconstructedAnchorContent(
  input: BuildReconstructedAnchorContentInput,
): BuildReconstructedAnchorContentResult {
  const { authority, canonicalSource, chunk, canonicalManuscriptCoordinates } = input

  if (authority.manuscriptId !== canonicalSource.manuscriptId || authority.manuscriptId !== chunk.manuscriptId) {
    return rejected('manuscript_identity_mismatch')
  }

  if (
    authority.manuscriptVersionSha !== canonicalSource.manuscriptVersionSha ||
    authority.manuscriptVersionSha !== chunk.manuscriptVersionSha
  ) {
    return rejected('manuscript_version_mismatch')
  }

  if (authority.recoveryMethod !== 'source_text_location_only') {
    return rejected('unsupported_recovery_method')
  }

  if (typeof canonicalSource.text !== 'string') {
    return rejected('authority_source_hash_mismatch')
  }
  const canonicalTrimmedSource = canonicalSource.text.trim()
  const expectedSourceHash = sourceHashFor({ source_text: canonicalTrimmedSource })
  if (expectedSourceHash !== authority.sourceHash) {
    return rejected('authority_source_hash_mismatch')
  }

  if (sourceHashForCanonicalChunkContent(chunk.content) !== chunk.contentHash) {
    return rejected('chunk_content_hash_mismatch')
  }

  if (!isSafeInteger(authority.sourceStartOffset) || !isSafeInteger(authority.sourceEndOffset)) {
    return rejected('malformed_authority_offsets')
  }
  if (!isSafeInteger(chunk.contentAbsoluteStart) || !isSafeInteger(chunk.contentAbsoluteEnd)) {
    return rejected('malformed_chunk_offsets')
  }

  if (authority.sourceStartOffset < 0 || authority.sourceEndOffset <= authority.sourceStartOffset) {
    return rejected('malformed_authority_offsets')
  }
  if (chunk.contentAbsoluteStart < 0 || chunk.contentAbsoluteEnd <= chunk.contentAbsoluteStart) {
    return rejected('malformed_chunk_offsets')
  }

  if (chunk.contentAbsoluteEnd - chunk.contentAbsoluteStart !== chunk.content.length) {
    return rejected('chunk_content_length_mismatch')
  }

  if (chunk.contentAbsoluteEnd > canonicalTrimmedSource.length) {
    return rejected('chunk_canonical_source_mismatch')
  }
  const expectedChunkContent = canonicalTrimmedSource.slice(
    chunk.contentAbsoluteStart,
    chunk.contentAbsoluteEnd,
  )
  if (expectedChunkContent !== chunk.content) {
    return rejected('chunk_canonical_source_mismatch')
  }

  if (authority.sourceStartOffset < chunk.contentAbsoluteStart || authority.sourceEndOffset > chunk.contentAbsoluteEnd) {
    return rejected('cross_chunk_span_unsupported')
  }

  const relativeStart = authority.sourceStartOffset - chunk.contentAbsoluteStart
  const relativeEnd = authority.sourceEndOffset - chunk.contentAbsoluteStart
  const evidenceAnchor = chunk.content.slice(relativeStart, relativeEnd)

  if (evidenceAnchor.length === 0) {
    return rejected('empty_reconstructed_anchor')
  }

  if (!isNonEmptyString(canonicalManuscriptCoordinates)) {
    return rejected('missing_canonical_manuscript_coordinates')
  }

  return {
    status: 'built',
    value: {
      evidenceAnchor,
      manuscriptCoordinates: canonicalManuscriptCoordinates,
    },
  }
}
