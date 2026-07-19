/**
 * Held Recovery Reconstructed-Anchor Writer (RPC adapter)
 *
 * Thin, fail-closed application-code representation of the database contract for
 * `public.insert_held_recovery_reconstructed_anchor_atomic(jsonb)`. This unit
 * validates and normalizes a reconstructed-anchor payload, invokes the atomic
 * compare-and-set RPC, and maps its five deterministic outcomes into typed
 * results. It exists only to prove the DB contract is correctly represented in
 * TypeScript before any runtime behavior depends on it.
 *
 * Scope fence (deliberately excluded): this module performs no queue mutation,
 * no queue transition, no re-admission, no retry scheduling, no attempt writes,
 * no candidate or manuscript mutation, no worker/caller wiring, no UI, and no
 * feature flags. It does not decide routing or currency; the RPC exclusively
 * owns the lock, the replay/conflict classification, and the stale comparison.
 *
 * Authority model (mirrors the RPC, verified against merged code):
 *   * held_item_persisted_version identifies the held-item version whose
 *     reconstructed content is being stored. It is NOT a queue CAS token.
 *   * expectedAuthorityVersion is the caller's snapshot of the mutable queue
 *     authority_version (the queue CAS token).
 *   These two values live in different value spaces and are NEVER compared to
 *   each other here or in the RPC.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The five deterministic outcomes owned by the RPC. Kept as a literal union so
 * the compiler forces exhaustive mapping and the contract cannot silently drift.
 */
export type ReconstructedAnchorInsertStatus =
  | 'inserted'
  | 'already_applied'
  | 'rejected_conflict'
  | 'rejected_stale'
  | 'rejected_missing'

/**
 * Normalized request accepted by the adapter. Every field maps 1:1 onto a key
 * the RPC reads from `p_request`. String fields are trimmed and required to be
 * non-empty; numeric fields must be finite integers. Nothing here is optional:
 * the RPC fails closed on any missing field, and the adapter refuses to send a
 * request the RPC would reject.
 */
export type ReconstructedAnchorInsertRequest = {
  readonly heldItemId: string
  readonly heldItemPersistedVersion: string
  readonly expectedAuthorityVersion: string
  readonly completionFingerprint: string
  readonly opportunityId: string
  /**
   * The manuscript identifier, carried as a canonical integer STRING to preserve
   * exact `bigint` fidelity across the persistence boundary. Modelling this as a
   * JS `number` would risk IEEE-754 precision loss for large bigint values; the
   * RPC already owns the `::bigint` cast, so the adapter passes the exact digits.
   * `manuscripts.id` is a generated positive bigint identity, so this is
   * validated as a positive canonical integer string (no sign, no leading zeros).
   */
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly recoveryMethod: string
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly evidenceAnchor: string
  readonly manuscriptCoordinates: string
}

/**
 * The persisted authority-row identity echoed back by the RPC on the terminal
 * success paths (`inserted` and `already_applied`).
 */
export type ReconstructedAnchorAuthorityRow = {
  readonly id: string
  readonly heldItemId: string
  readonly heldItemPersistedVersion: string
  readonly completionFingerprint: string
}

export type ReconstructedAnchorInsertResult =
  | { readonly status: 'inserted'; readonly row: ReconstructedAnchorAuthorityRow }
  | { readonly status: 'already_applied'; readonly row: ReconstructedAnchorAuthorityRow }
  | {
      readonly status: 'rejected_conflict'
      readonly heldItemId: string
      readonly heldItemPersistedVersion: string
      readonly existingCompletionFingerprint: string
      readonly submittedCompletionFingerprint: string
    }
  | {
      readonly status: 'rejected_stale'
      readonly heldItemId: string
      readonly expectedAuthorityVersion: string
      readonly actualAuthorityVersion: string | null
    }
  | { readonly status: 'rejected_missing'; readonly heldItemId: string }

export type ReconstructedAnchorInsertAdapter = {
  readonly insertReconstructedAnchor: (
    request: ReconstructedAnchorInsertRequest,
  ) => Promise<ReconstructedAnchorInsertResult>
}

/**
 * Raised when the caller-supplied request cannot be normalized into a request
 * the RPC would accept. The adapter fails closed *before* any RPC call so a
 * malformed payload never reaches the database.
 */
export class ReconstructedAnchorRequestError extends Error {
  constructor(message: string) {
    super(`Held Recovery reconstructed-anchor request invalid: ${message}`)
    this.name = 'ReconstructedAnchorRequestError'
  }
}

/**
 * Raised when the RPC returns a shape the adapter cannot map to exactly one of
 * the five deterministic outcomes. Unknown/malformed responses fail closed
 * rather than being coerced into a success or a benign rejection.
 */
export class ReconstructedAnchorResponseError extends Error {
  constructor(message: string) {
    super(`Held Recovery reconstructed-anchor RPC response invalid: ${message}`)
    this.name = 'ReconstructedAnchorResponseError'
  }
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ReconstructedAnchorRequestError(`${field} must be a string`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ReconstructedAnchorRequestError(`${field} must not be empty`)
  }
  return trimmed
}

function requireInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new ReconstructedAnchorRequestError(`${field} must be a finite integer`)
  }
  return value
}

/**
 * Validates a canonical positive integer string and returns it verbatim (after
 * trimming) so the exact bigint digits reach the RPC without ever passing
 * through a JS `number`. Accepts "0" and unsigned digit strings with no leading
 * zeros; rejects empty, signed, decimal, non-digit, and leading-zero forms.
 * `manuscripts.id` is a generated positive bigint identity, so negatives are
 * intentionally not permitted.
 */
function requireCanonicalIntegerString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ReconstructedAnchorRequestError(`${field} must be a string`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new ReconstructedAnchorRequestError(`${field} must not be empty`)
  }
  // Canonical unsigned integer: a single "0", or a non-zero leading digit
  // followed by any digits. No sign, no leading zeros, no decimal point.
  if (!/^(0|[1-9][0-9]*)$/.test(trimmed)) {
    throw new ReconstructedAnchorRequestError(
      `${field} must be a canonical non-negative integer string (no sign, no leading zeros)`,
    )
  }
  return trimmed
}

/**
 * Validates and normalizes a caller request into the exact JSON object the RPC
 * reads. Trimming mirrors the RPC's `nullif(btrim(...), '')` handling so the
 * adapter and the database agree on what "present" means. Fails closed on any
 * missing/blank/non-integer field before the RPC is ever contacted.
 */
export function normalizeReconstructedAnchorRequest(
  request: ReconstructedAnchorInsertRequest,
): Record<string, string | number> {
  if (request === null || typeof request !== 'object') {
    throw new ReconstructedAnchorRequestError('request must be an object')
  }

  return {
    held_item_id: requireNonEmptyString(request.heldItemId, 'heldItemId'),
    held_item_persisted_version: requireNonEmptyString(
      request.heldItemPersistedVersion,
      'heldItemPersistedVersion',
    ),
    expected_authority_version: requireNonEmptyString(
      request.expectedAuthorityVersion,
      'expectedAuthorityVersion',
    ),
    completion_fingerprint: requireNonEmptyString(
      request.completionFingerprint,
      'completionFingerprint',
    ),
    opportunity_id: requireNonEmptyString(request.opportunityId, 'opportunityId'),
    manuscript_id: requireCanonicalIntegerString(request.manuscriptId, 'manuscriptId'),
    manuscript_version_sha: requireNonEmptyString(
      request.manuscriptVersionSha,
      'manuscriptVersionSha',
    ),
    recovery_method: requireNonEmptyString(request.recoveryMethod, 'recoveryMethod'),
    source_hash: requireNonEmptyString(request.sourceHash, 'sourceHash'),
    source_start_offset: requireInteger(request.sourceStartOffset, 'sourceStartOffset'),
    source_end_offset: requireInteger(request.sourceEndOffset, 'sourceEndOffset'),
    evidence_anchor: requireNonEmptyString(request.evidenceAnchor, 'evidenceAnchor'),
    manuscript_coordinates: requireNonEmptyString(
      request.manuscriptCoordinates,
      'manuscriptCoordinates',
    ),
  }
}

function asRecord(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ReconstructedAnchorResponseError('response must be a JSON object')
  }
  return data as Record<string, unknown>
}

function responseString(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new ReconstructedAnchorResponseError(`missing or non-string field "${key}"`)
  }
  return value
}

function nullableResponseString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new ReconstructedAnchorResponseError(`field "${key}" must be a string or null`)
  }
  return value
}

function authorityRow(row: Record<string, unknown>): ReconstructedAnchorAuthorityRow {
  return {
    id: responseString(row, 'id'),
    heldItemId: responseString(row, 'held_item_id'),
    heldItemPersistedVersion: responseString(row, 'held_item_persisted_version'),
    completionFingerprint: responseString(row, 'completion_fingerprint'),
  }
}

/**
 * Maps a raw RPC JSON response into exactly one typed outcome. Any status that
 * is not one of the five known values — or any known status missing a required
 * field — throws, so the caller can never observe an under-specified result.
 */
export function mapReconstructedAnchorResponse(data: unknown): ReconstructedAnchorInsertResult {
  const row = asRecord(data)
  const status = row.status

  switch (status) {
    case 'inserted':
      return { status: 'inserted', row: authorityRow(row) }
    case 'already_applied':
      return { status: 'already_applied', row: authorityRow(row) }
    case 'rejected_conflict':
      return {
        status: 'rejected_conflict',
        heldItemId: responseString(row, 'held_item_id'),
        heldItemPersistedVersion: responseString(row, 'held_item_persisted_version'),
        existingCompletionFingerprint: responseString(row, 'existing_completion_fingerprint'),
        submittedCompletionFingerprint: responseString(row, 'submitted_completion_fingerprint'),
      }
    case 'rejected_stale':
      return {
        status: 'rejected_stale',
        heldItemId: responseString(row, 'held_item_id'),
        expectedAuthorityVersion: responseString(row, 'expected_authority_version'),
        actualAuthorityVersion: nullableResponseString(row, 'actual_authority_version'),
      }
    case 'rejected_missing':
      return {
        status: 'rejected_missing',
        heldItemId: responseString(row, 'held_item_id'),
      }
    default:
      throw new ReconstructedAnchorResponseError(
        `unexpected status "${String(status)}"`,
      )
  }
}

/**
 * Constructs the Supabase-backed adapter. The client is narrowed to just `rpc`
 * so callers (and tests) cannot smuggle table mutations through this boundary.
 */
export function createSupabaseReconstructedAnchorInsertAdapter(
  supabase: Pick<SupabaseClient, 'rpc'> = createAdminClient(),
): ReconstructedAnchorInsertAdapter {
  return {
    async insertReconstructedAnchor(
      request: ReconstructedAnchorInsertRequest,
    ): Promise<ReconstructedAnchorInsertResult> {
      const p_request = normalizeReconstructedAnchorRequest(request)

      const { data, error } = await supabase.rpc(
        'insert_held_recovery_reconstructed_anchor_atomic',
        { p_request },
      )

      if (error) {
        throw new Error(
          `Failed to insert Held Recovery reconstructed anchor: ${error.message}`,
        )
      }

      return mapReconstructedAnchorResponse(data)
    },
  }
}
