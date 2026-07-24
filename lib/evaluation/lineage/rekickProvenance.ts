/**
 * Pass 2 → Pass 3 lineage: re-kick provenance envelope.
 *
 * Invariant: a Pass 3 re-kick (S07_PASS3 backward kick for an unexhausted
 * CRITERION_OPPORTUNITY_COVERAGE_INVALID) may change *outcomes* (which sources
 * materialize/consolidate/suppress), but it must NEVER rewrite Pass 2 *identity
 * or provenance* — the set of sources, their fingerprints, and the chunk each
 * source came from with the exact chunk hash.
 *
 * This envelope is a small, deterministic projection of the immutable Pass 2
 * source manifest (`Pass2SourceManifest`, one record per surviving Pass 2
 * recommendation). Captured before a re-kick and validated against the manifest
 * observed on the re-kick, it independently enforces the invariant that the
 * merged reconciler assumes but does not itself check on re-kick.
 */
import type { Pass2SourceManifest } from '@/lib/evaluation/pipeline/types';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import type { LineageSubcode } from './lineageSubcodes';
import { LINEAGE_PUBLIC_FAILURE_CODE, type LineagePublicFailureCode } from './lineageSubcodes';

export type RekickProvenanceEnvelope = {
  original_attempt_id: string;
  source_set_fingerprint: string;
  source_count: number;
  criterion_count: number;
  /** Sorted source ids — the identity set that must survive a re-kick. */
  source_ids: string[];
  /** source_id → origin_chunk_hash. A change here is a forbidden content rewrite. */
  chunk_hashes: Record<string, string>;
  /** source_id → origin_chunk_id, so a source cannot be silently re-homed. */
  chunk_ids: Record<string, number>;
};

/** Deterministically derive the envelope from an immutable Pass 2 manifest. */
export function buildRekickProvenanceEnvelope(
  manifest: Pass2SourceManifest,
  originalAttemptId: string,
): RekickProvenanceEnvelope {
  const records = [...manifest.records].sort((a, b) => a.source_id.localeCompare(b.source_id));
  const source_ids = records.map((r) => r.source_id);
  const chunk_hashes: Record<string, string> = {};
  const chunk_ids: Record<string, number> = {};
  const criteria = new Set<string>();
  for (const r of records) {
    chunk_hashes[r.source_id] = r.origin_chunk_hash;
    chunk_ids[r.source_id] = r.origin_chunk_id;
    criteria.add(r.criterion_key);
  }
  return {
    original_attempt_id: originalAttemptId,
    source_set_fingerprint: manifest.source_set_fingerprint,
    source_count: manifest.source_count,
    criterion_count: criteria.size,
    source_ids,
    chunk_hashes,
    chunk_ids,
  };
}

export type RekickValidationResult = {
  valid: boolean;
  public_failure_code: LineagePublicFailureCode;
  subcodes: LineageSubcode[];
  /** Human-usable detail tokens for telemetry; never surfaced as a public code. */
  details: string[];
};

/**
 * Validate a re-kick manifest against the pre-re-kick envelope. Distinguishes a
 * forbidden content rewrite (chunk-hash drift → LINEAGE_CHUNK_HASH_MISMATCH)
 * from any other identity/provenance drift (→ LINEAGE_REKICK_PROVENANCE_MISMATCH).
 * Fail-closed: any drift yields `valid: false`.
 */
export function validateRekickProvenance(
  envelope: RekickProvenanceEnvelope,
  rekickManifest: Pass2SourceManifest,
): RekickValidationResult {
  const subcodes = new Set<LineageSubcode>();
  const details: string[] = [];

  const current = buildRekickProvenanceEnvelope(rekickManifest, envelope.original_attempt_id);

  if (current.source_set_fingerprint !== envelope.source_set_fingerprint) {
    subcodes.add('LINEAGE_REKICK_PROVENANCE_MISMATCH');
    details.push('source_set_fingerprint_drift');
  }
  if (current.source_count !== envelope.source_count) {
    subcodes.add('LINEAGE_REKICK_PROVENANCE_MISMATCH');
    details.push(`source_count:${envelope.source_count}->${current.source_count}`);
  }
  if (current.criterion_count !== envelope.criterion_count) {
    subcodes.add('LINEAGE_REKICK_PROVENANCE_MISMATCH');
    details.push(`criterion_count:${envelope.criterion_count}->${current.criterion_count}`);
  }

  const expectedIds = new Set(envelope.source_ids);
  const actualIds = new Set(current.source_ids);
  for (const id of envelope.source_ids) {
    if (!actualIds.has(id)) {
      subcodes.add('LINEAGE_REKICK_PROVENANCE_MISMATCH');
      details.push(`dropped_source:${id}`);
    }
  }
  for (const id of current.source_ids) {
    if (!expectedIds.has(id)) {
      subcodes.add('LINEAGE_REKICK_PROVENANCE_MISMATCH');
      details.push(`introduced_source:${id}`);
    }
  }

  // For sources present in both, a changed chunk hash means the underlying Pass 2
  // content was rewritten — the single most serious provenance violation. A
  // changed chunk id (same hash) is re-homing: still a provenance mismatch.
  for (const id of envelope.source_ids) {
    if (!actualIds.has(id)) continue;
    if (envelope.chunk_hashes[id] !== current.chunk_hashes[id]) {
      subcodes.add('LINEAGE_CHUNK_HASH_MISMATCH');
      details.push(`chunk_hash_rewrite:${id}`);
    }
    if (envelope.chunk_ids[id] !== current.chunk_ids[id]) {
      subcodes.add('LINEAGE_REKICK_PROVENANCE_MISMATCH');
      details.push(`chunk_rehome:${id}`);
    }
  }

  return {
    valid: subcodes.size === 0,
    public_failure_code: LINEAGE_PUBLIC_FAILURE_CODE,
    subcodes: [...subcodes],
    details,
  };
}

/** Stable digest of an envelope, e.g. for embedding in a durable attempt record. */
export function fingerprintRekickEnvelope(envelope: RekickProvenanceEnvelope): string {
  return canonicalJsonSha256({
    source_set_fingerprint: envelope.source_set_fingerprint,
    source_count: envelope.source_count,
    criterion_count: envelope.criterion_count,
    source_ids: envelope.source_ids,
    chunk_hashes: envelope.chunk_hashes,
    chunk_ids: envelope.chunk_ids,
  });
}
