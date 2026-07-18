/**
 * Held Recovery Versioning Helpers
 *
 * Canonical identity helpers for recovery retry series, opportunity versions,
 * and candidate-set versions. These wrap the same stable-hash authority used by
 * the opportunity ledger so recovery does not invent a competing identity scheme.
 */

import { sourceHashFor as opportunityLedgerSourceHashFor } from './opportunityLedger'

export { opportunityLedgerSourceHashFor as sourceHashFor }

function normalizeCandidateText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * The canonical opportunity identity for recovery.
 *
 * @param opportunityId The persisted opportunity id.
 * @param ledgerSourceHash The source hash from the opportunity ledger.
 * @returns A deterministic opportunity version string.
 */
export function revisionOpportunityVersionFor(
  opportunityId: string,
  ledgerSourceHash: string,
): string {
  return opportunityLedgerSourceHashFor({ opportunityId, ledgerSourceHash })
}

/**
 * The canonical candidate-set identity for recovery.
 *
 * The identity is derived from the normalized A/B/C candidate texts and the
 * associated options. Incomplete sets (any candidate missing or empty) have a
 * `null` version, because missing B/C alone must never silently authorize
 * regeneration.
 */
export function candidateSetVersionFor(candidates: {
  a: string
  b: string
  c: string
  options?: { a?: unknown; b?: unknown; c?: unknown }
}): string | null {
  const a = normalizeCandidateText(candidates.a)
  const b = normalizeCandidateText(candidates.b)
  const c = normalizeCandidateText(candidates.c)

  if (a.length === 0 || b.length === 0 || c.length === 0) {
    return null
  }

  const options = candidates.options ?? {}
  return opportunityLedgerSourceHashFor({
    a,
    b,
    c,
    options: {
      a: options.a,
      b: options.b,
      c: options.c,
    },
  })
}

/**
 * A helper that normalizes candidate text for stable comparison.
 */
export function revisionNormalizeCandidateText(value: string): string {
  return normalizeCandidateText(value)
}
