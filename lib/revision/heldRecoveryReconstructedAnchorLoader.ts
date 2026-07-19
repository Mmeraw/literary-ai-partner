/**
 * Read-only loader for the canonical persisted reconstructed-anchor authority.
 *
 * This is the only reconstructed-content input accepted by re-admission. The
 * caller supplies an identity key, never evidence text or coordinates. The
 * backing RPC projects manuscript_id::text so bigint identity remains exact.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export type ReconstructedAnchorRecord = {
  readonly id: string
  readonly heldItemId: string
  readonly opportunityId: string
  readonly manuscriptId: string
  readonly manuscriptVersionSha: string
  readonly heldItemPersistedVersion: string
  readonly completionFingerprint: string
  readonly recoveryMethod: 'source_text_location_only'
  readonly sourceHash: string
  readonly sourceStartOffset: number
  readonly sourceEndOffset: number
  readonly evidenceAnchor: string
  readonly manuscriptCoordinates: string
}

export type LoadReconstructedAnchorInput = {
  readonly heldItemId: string
  readonly heldItemPersistedVersion: string
}

export type LoadReconstructedAnchorResult =
  | { readonly status: 'loaded'; readonly value: ReconstructedAnchorRecord }
  | { readonly status: 'missing' }

export type ReconstructedAnchorLoader = (
  input: LoadReconstructedAnchorInput,
) => Promise<LoadReconstructedAnchorResult>

export class ReconstructedAnchorLoadContractError extends Error {
  constructor(message: string) {
    super(`Held Recovery reconstructed-anchor load contract violated: ${message}`)
    this.name = 'ReconstructedAnchorLoadContractError'
  }
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ReconstructedAnchorLoadContractError(`missing or invalid ${field}`)
  }
  return value
}

function canonicalManuscriptId(value: unknown): string {
  const manuscriptId = nonEmpty(value, 'manuscript_id_text')
  if (!/^(0|[1-9][0-9]*)$/.test(manuscriptId)) {
    throw new ReconstructedAnchorLoadContractError('manuscript_id_text is not canonical')
  }
  return manuscriptId
}

function safeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new ReconstructedAnchorLoadContractError(`${field} is not a safe integer`)
  }
  return value
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReconstructedAnchorLoadContractError('RPC response is not an object')
  }
  return value as Record<string, unknown>
}

export function mapReconstructedAnchorLoadResponse(
  data: unknown,
): LoadReconstructedAnchorResult {
  const row = asRecord(data)
  if (row.status === 'missing') return { status: 'missing' }
  if (row.status !== 'loaded') {
    throw new ReconstructedAnchorLoadContractError(`unexpected status ${String(row.status)}`)
  }

  const recoveryMethod = nonEmpty(row.recovery_method, 'recovery_method')
  if (recoveryMethod !== 'source_text_location_only') {
    throw new ReconstructedAnchorLoadContractError('unsupported recovery_method')
  }
  const sourceStartOffset = safeInteger(row.source_start_offset, 'source_start_offset')
  const sourceEndOffset = safeInteger(row.source_end_offset, 'source_end_offset')
  if (sourceStartOffset < 0 || sourceEndOffset <= sourceStartOffset) {
    throw new ReconstructedAnchorLoadContractError('source offsets are malformed')
  }

  return {
    status: 'loaded',
    value: {
      id: nonEmpty(row.id, 'id'),
      heldItemId: nonEmpty(row.held_item_id, 'held_item_id'),
      opportunityId: nonEmpty(row.opportunity_id, 'opportunity_id'),
      manuscriptId: canonicalManuscriptId(row.manuscript_id_text),
      manuscriptVersionSha: nonEmpty(row.manuscript_version_sha, 'manuscript_version_sha'),
      heldItemPersistedVersion: nonEmpty(
        row.held_item_persisted_version,
        'held_item_persisted_version',
      ),
      completionFingerprint: nonEmpty(row.completion_fingerprint, 'completion_fingerprint'),
      recoveryMethod,
      sourceHash: nonEmpty(row.source_hash, 'source_hash'),
      sourceStartOffset,
      sourceEndOffset,
      evidenceAnchor: nonEmpty(row.evidence_anchor, 'evidence_anchor'),
      manuscriptCoordinates: nonEmpty(row.manuscript_coordinates, 'manuscript_coordinates'),
    },
  }
}

function requireKey(value: string, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ReconstructedAnchorLoadContractError(`${field} must be a non-empty string`)
  }
  return value
}

export function createSupabaseReconstructedAnchorLoader(
  supabase: Pick<SupabaseClient, 'rpc'> = createAdminClient(),
): ReconstructedAnchorLoader {
  return async (input) => {
    const heldItemId = requireKey(input.heldItemId, 'heldItemId')
    const heldItemPersistedVersion = requireKey(
      input.heldItemPersistedVersion,
      'heldItemPersistedVersion',
    )
    const { data, error } = await supabase.rpc('get_held_recovery_reconstructed_anchor', {
      p_held_item_id: heldItemId,
      p_held_item_persisted_version: heldItemPersistedVersion,
    })
    if (error) {
      throw new ReconstructedAnchorLoadContractError(
        error.message ?? 'RPC failed without an error message',
      )
    }
    return mapReconstructedAnchorLoadResponse(data)
  }
}
