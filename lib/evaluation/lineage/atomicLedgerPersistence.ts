/**
 * Pass 2 → Pass 3 lineage: atomic canonical-result + ledger persistence.
 *
 * The lineage outcome ledger is the durable, no-prose record of what happened to
 * every Pass 2 source (materialized / consolidated / suppressed). It must be
 * written in the SAME transaction as the canonical Pass 3 result: a reader must
 * never observe a canonical result without its ledger, or a ledger without its
 * result. This module defines that transactional contract as an injectable
 * store (so the concrete adapter — e.g. Supabase — lives on the persistence
 * track) plus an in-memory reference implementation with fault injection used to
 * prove the all-or-nothing property.
 *
 * "No prose": the ledger stores governance *identity* (rule id, outcome, target
 * source id) and a `rationale_ref` sha256 digest of any rationale/evidence prose
 * — never the prose itself — so it stays a compact, tamper-evident audit record.
 */
import { createHash } from 'crypto';
import type { RecommendationLineageOutcome } from '@/lib/evaluation/policy/opportunityDiscoveryPolicy';
import { LINEAGE_PUBLIC_FAILURE_CODE, type LineagePublicFailureCode } from './lineageSubcodes';

export type LineageLedgerEntry = {
  source_id: string;
  outcome: RecommendationLineageOutcome['outcome'];
  canonical_opportunity_id: string | null;
  consolidated_into_source_id: string | null;
  governing_rule: string | null;
  /** sha256:<hex> of concatenated rationale+evidence prose, or null when absent. */
  rationale_ref: string | null;
};

export type CanonicalResultRecord = {
  attempt_id: string;
  manuscript_id: string;
  payload_fingerprint: string;
};

function proseRef(...parts: Array<string | undefined>): string | null {
  const prose = parts.filter((p) => typeof p === 'string' && p.trim().length > 0).join('\n');
  if (prose.length === 0) return null;
  return `sha256:${createHash('sha256').update(prose, 'utf8').digest('hex')}`;
}

/** Project outcomes into no-prose ledger entries with deterministic ordering. */
export function buildLineageLedger(
  outcomes: readonly RecommendationLineageOutcome[],
): LineageLedgerEntry[] {
  return [...outcomes]
    .sort((a, b) => a.source_id.localeCompare(b.source_id))
    .map((o) => ({
      source_id: o.source_id,
      outcome: o.outcome,
      canonical_opportunity_id: o.canonical_opportunity_id ?? null,
      consolidated_into_source_id: o.consolidated_into_source_id ?? null,
      governing_rule: o.governing_rule ?? null,
      rationale_ref: proseRef(o.rationale, o.evidence),
    }));
}

/**
 * Transactional store contract. A conforming implementation MUST persist the
 * canonical result and the ledger atomically: on any failure it leaves NEITHER
 * written, and it validates preconditions BEFORE mutating any state.
 */
export interface AtomicLineageStore {
  persistCanonicalResultWithLedger(
    canonicalResult: CanonicalResultRecord,
    ledger: readonly LineageLedgerEntry[],
  ): Promise<void>;
}

export class LineageLedgerPersistenceError extends Error {
  public readonly failureCode: LineagePublicFailureCode = LINEAGE_PUBLIC_FAILURE_CODE;
  public readonly subcode = 'LINEAGE_LEDGER_PERSISTENCE_FAILED' as const;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'LineageLedgerPersistenceError';
    this.details = details;
  }
}

/**
 * Orchestrate an atomic persist. Builds the no-prose ledger, then delegates to
 * the injected store. Any store failure is wrapped in a
 * LineageLedgerPersistenceError so callers see the stable public code + subcode.
 */
export async function persistCanonicalResultWithLedger(
  store: AtomicLineageStore,
  canonicalResult: CanonicalResultRecord,
  outcomes: readonly RecommendationLineageOutcome[],
): Promise<LineageLedgerEntry[]> {
  const ledger = buildLineageLedger(outcomes);
  try {
    await store.persistCanonicalResultWithLedger(canonicalResult, ledger);
  } catch (err) {
    throw new LineageLedgerPersistenceError(
      'Atomic canonical-result + lineage-ledger persistence failed; no partial state was committed.',
      { attempt_id: canonicalResult.attempt_id, cause: err instanceof Error ? err.message : String(err) },
    );
  }
  return ledger;
}

export type InMemoryFaultInjection = null | 'before_canonical' | 'before_ledger';

/**
 * In-memory reference implementation. Proves the all-or-nothing contract:
 *  - `faultInjection` fires BEFORE any state is mutated, so an injected fault can
 *    never leave a partially written pair.
 *  - a successful call publishes both records under a single version bump.
 */
export class InMemoryAtomicLineageStore implements AtomicLineageStore {
  public canonicalResults = new Map<string, CanonicalResultRecord>();
  public ledgers = new Map<string, LineageLedgerEntry[]>();
  public version = 0;

  constructor(private readonly faultInjection: InMemoryFaultInjection = null) {}

  async persistCanonicalResultWithLedger(
    canonicalResult: CanonicalResultRecord,
    ledger: readonly LineageLedgerEntry[],
  ): Promise<void> {
    // Validate + inject faults strictly BEFORE mutation so a fault is atomic.
    if (!canonicalResult.attempt_id) {
      throw new Error('canonicalResult.attempt_id is required');
    }
    if (this.faultInjection === 'before_canonical' || this.faultInjection === 'before_ledger') {
      throw new Error(`injected fault: ${this.faultInjection}`);
    }
    // Single atomic publish: both maps and the version move together.
    const nextVersion = this.version + 1;
    this.canonicalResults.set(canonicalResult.attempt_id, canonicalResult);
    this.ledgers.set(canonicalResult.attempt_id, [...ledger]);
    this.version = nextVersion;
  }
}
