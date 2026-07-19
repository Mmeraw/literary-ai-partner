/**
 * Held Recovery Anchor CAS Writer (persistence adapter)
 *
 * Transport/validation boundary over the single SECURITY DEFINER RPC created in the corrective
 * migration 20260718140000_correct_held_recovery_anchor_version_parity.sql:
 *
 *   - apply_held_recovery_anchor_cas_atomic
 *
 * AUTHORITY BOUNDARY (must not be crossed by this module):
 *   The adapter transports and validates anchor-repair CAS data ONLY. It MUST NOT derive,
 *   override, reinterpret, or persist: producer, recovery action, admission result,
 *   classification result, queue destination, cardType, finalDecision, readiness, or retry
 *   state. It invokes the RPC only — NO `.from(table).insert/update/delete`. Unknown RPC
 *   statuses / malformed payloads FAIL CLOSED (throw AnchorCasPersistenceContractError); they
 *   are never coerced into a conflict or a success. RPC RAISE EXCEPTION (conflict / not-found /
 *   duplicate) surfaces as a Supabase error and is mapped to a typed persistence_conflict /
 *   contract-error outcome — never silently swallowed.
 *
 * This module contains NO caller wiring, NO re-admission logic, NO worker logic.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Input / result value objects ─────────────────────────────────────────────

/**
 * The ONLY CAS input. `expectedAnchorFingerprint` is the fine-grained anchor-state guard
 * (held_recovery_anchor_fingerprint of the CURRENT stored anchor). `expectedLedgerSourceHash`
 * is the artifact-level guard. Neither is the canonical opportunity version — the RPC returns
 * that separately.
 */
export type ApplyAnchorCasInput = {
  readonly jobId: string
  readonly opportunityId: string
  readonly expectedLedgerSourceHash: string
  readonly expectedAnchorFingerprint: string
  readonly newEvidenceAnchor: string
  readonly newManuscriptCoordinates: string
}

export type AnchorCasUpdated = {
  readonly status: 'anchor_updated'
  readonly jobId: string
  readonly opportunityId: string
  readonly opportunityVersion: string
  readonly previousAnchorFingerprint: string
  readonly anchorFingerprint: string
  readonly ledgerSourceHash: string
  readonly evidenceAnchor: string
  readonly manuscriptCoordinates: string
}

export type AnchorCasUnchanged = {
  readonly status: 'unchanged'
  readonly jobId: string
  readonly opportunityId: string
  readonly opportunityVersion: string
  readonly anchorFingerprint: string
  readonly ledgerSourceHash: string
}

/**
 * The RPC fails closed via RAISE EXCEPTION for every conflict / degenerate case. The adapter
 * maps those DB errors to this single typed conflict outcome (the caller distinguishes by
 * `reason`) rather than throwing, because a CAS conflict is an expected concurrency outcome —
 * NOT a contract violation.
 */
export type AnchorCasConflictReason =
  | 'ledger_source_hash_conflict'
  | 'anchor_fingerprint_conflict'
  | 'artifact_not_found'
  | 'opportunity_not_found'
  | 'duplicate_opportunity_id'
  | 'malformed_request'
  | 'malformed_artifact'

export type AnchorCasConflict = {
  readonly status: 'persistence_conflict'
  readonly reason: AnchorCasConflictReason
  readonly message: string
}

export type ApplyAnchorCasResult = AnchorCasUpdated | AnchorCasUnchanged | AnchorCasConflict

// ── Contract error (fail-closed for genuinely unexpected states) ──────────────

export class AnchorCasPersistenceContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnchorCasPersistenceContractError'
  }
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface HeldRecoveryAnchorCasPersistenceAdapter {
  applyAnchorCas(input: ApplyAnchorCasInput): Promise<ApplyAnchorCasResult>
}

// ── Validation helpers ─────────────────────────────────────────────────────────

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AnchorCasPersistenceContractError(`anchor CAS input.${field} must be a non-empty string`)
  }
  return value
}

function asObject(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new AnchorCasPersistenceContractError(
      `anchor CAS RPC returned a non-object payload: ${JSON.stringify(data)}`,
    )
  }
  return data as Record<string, unknown>
}

function str(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new AnchorCasPersistenceContractError(`anchor CAS RPC result missing string field '${key}'`)
  }
  return value
}

/**
 * Map a RAISE EXCEPTION message from the RPC to a typed conflict reason. The migration embeds a
 * stable token in each message (e.g. "held_recovery_anchor_cas anchor_fingerprint_conflict ...").
 * Unknown error shapes FAIL CLOSED as a contract error rather than being coerced to a conflict.
 */
const CONFLICT_TOKENS: readonly AnchorCasConflictReason[] = [
  'ledger_source_hash_conflict',
  'anchor_fingerprint_conflict',
  'artifact_not_found',
  'opportunity_not_found',
  'duplicate_opportunity_id',
  'malformed_request',
  'malformed_artifact',
]

function classifyRpcError(message: string): AnchorCasConflict {
  for (const token of CONFLICT_TOKENS) {
    if (message.includes(token)) {
      return { status: 'persistence_conflict', reason: token, message }
    }
  }
  throw new AnchorCasPersistenceContractError(
    `anchor CAS RPC failed with an unrecognized error: ${message}`,
  )
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function createSupabaseHeldRecoveryAnchorCasPersistenceAdapter(
  supabase: Pick<SupabaseClient, 'rpc'> = createAdminClient(),
): HeldRecoveryAnchorCasPersistenceAdapter {
  return {
    async applyAnchorCas(input: ApplyAnchorCasInput): Promise<ApplyAnchorCasResult> {
      requireNonEmptyString(input.jobId, 'jobId')
      requireNonEmptyString(input.opportunityId, 'opportunityId')
      requireNonEmptyString(input.expectedLedgerSourceHash, 'expectedLedgerSourceHash')
      requireNonEmptyString(input.expectedAnchorFingerprint, 'expectedAnchorFingerprint')
      requireNonEmptyString(input.newEvidenceAnchor, 'newEvidenceAnchor')
      requireNonEmptyString(input.newManuscriptCoordinates, 'newManuscriptCoordinates')

      const { data, error } = await supabase.rpc('apply_held_recovery_anchor_cas_atomic', {
        p_request: {
          job_id: input.jobId,
          opportunity_id: input.opportunityId,
          expected_ledger_source_hash: input.expectedLedgerSourceHash,
          expected_anchor_fingerprint: input.expectedAnchorFingerprint,
          new_evidence_anchor: input.newEvidenceAnchor,
          new_manuscript_coordinates: input.newManuscriptCoordinates,
        },
      })

      if (error) {
        // RPC RAISE EXCEPTION -> typed conflict (expected) or contract error (unexpected).
        return classifyRpcError(error.message ?? String(error))
      }

      const row = asObject(data)
      switch (row.status) {
        case 'anchor_updated':
          return {
            status: 'anchor_updated',
            jobId: str(row, 'job_id'),
            opportunityId: str(row, 'opportunity_id'),
            opportunityVersion: str(row, 'opportunity_version'),
            previousAnchorFingerprint: str(row, 'previous_anchor_fingerprint'),
            anchorFingerprint: str(row, 'anchor_fingerprint'),
            ledgerSourceHash: str(row, 'ledger_source_hash'),
            evidenceAnchor: str(row, 'evidence_anchor'),
            manuscriptCoordinates: str(row, 'manuscript_coordinates'),
          }
        case 'unchanged':
          return {
            status: 'unchanged',
            jobId: str(row, 'job_id'),
            opportunityId: str(row, 'opportunity_id'),
            opportunityVersion: str(row, 'opportunity_version'),
            anchorFingerprint: str(row, 'anchor_fingerprint'),
            ledgerSourceHash: str(row, 'ledger_source_hash'),
          }
        default:
          throw new AnchorCasPersistenceContractError(
            `anchor CAS RPC returned an unexpected status: ${JSON.stringify(row.status)}`,
          )
      }
    },
  }
}
