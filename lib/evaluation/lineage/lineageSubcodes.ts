/**
 * Pass 2 → Pass 3 lineage: precise internal subcodes.
 *
 * The merged reconciler (`reconcilePass2ToPass3Lineage` in runPass3Synthesis.ts)
 * throws a `RecommendationDispositionContractError` whose public failure code is
 * always `CRITERION_OPPORTUNITY_COVERAGE_INVALID` and whose `details.issues` is a
 * flat list of untyped strings (e.g. `"unknown:src-1"`, `"missing:src-2"`).
 *
 * This module adds a precise internal subcode vocabulary on top of that public
 * code WITHOUT changing the public code or the reconciler's decision. It lets
 * diagnosis/telemetry distinguish, say, a re-kick provenance rewrite from a
 * plain coverage miss, while every one of these still surfaces to callers as the
 * single stable public code.
 */

/** The public, caller-facing failure code. Never changes per-subcode. */
export const LINEAGE_PUBLIC_FAILURE_CODE = 'CRITERION_OPPORTUNITY_COVERAGE_INVALID' as const;
export type LineagePublicFailureCode = typeof LINEAGE_PUBLIC_FAILURE_CODE;

/** Precise internal subcodes. Diagnostic only — never widen the public surface. */
export const LINEAGE_SUBCODES = [
  'LINEAGE_OUTCOME_MISSING_SOURCE_ID',
  'LINEAGE_UNKNOWN_SOURCE',
  'LINEAGE_DUPLICATE_SOURCE',
  'LINEAGE_MISSING_SOURCE',
  'LINEAGE_SUPPRESSION_MISSING_GOVERNANCE',
  'LINEAGE_CONSOLIDATION_MISSING_TARGET',
  'LINEAGE_CONSOLIDATION_UNKNOWN_TARGET',
  'LINEAGE_CONSOLIDATION_SELF_TARGET',
  'LINEAGE_CONSOLIDATION_TARGET_MISSING',
  'LINEAGE_UNRESOLVED_SURVIVING_TARGET',
  'LINEAGE_UNKNOWN_OUTCOME',
  'LINEAGE_REKICK_PROVENANCE_MISMATCH',
  'LINEAGE_CHUNK_HASH_MISMATCH',
  'LINEAGE_LEDGER_PERSISTENCE_FAILED',
  'LINEAGE_UNCLASSIFIED',
] as const;

export type LineageSubcode = (typeof LINEAGE_SUBCODES)[number];

/**
 * Map one reconciler `issues[]` string to a precise subcode. The reconciler
 * emits either a bare token (`outcome_missing_source_id`) or a
 * `prefix:source_id` pair; we classify on the prefix so the source id itself is
 * never interpreted.
 */
export function mapReconcilerIssueToSubcode(issue: string): LineageSubcode {
  const token = issue.includes(':') ? issue.slice(0, issue.indexOf(':')) : issue;
  switch (token) {
    case 'outcome_missing_source_id':
      return 'LINEAGE_OUTCOME_MISSING_SOURCE_ID';
    case 'unknown':
      return 'LINEAGE_UNKNOWN_SOURCE';
    case 'duplicate':
      return 'LINEAGE_DUPLICATE_SOURCE';
    case 'missing':
      return 'LINEAGE_MISSING_SOURCE';
    case 'suppression_missing_governance':
      return 'LINEAGE_SUPPRESSION_MISSING_GOVERNANCE';
    case 'consolidation_missing_target':
      return 'LINEAGE_CONSOLIDATION_MISSING_TARGET';
    case 'consolidation_unknown_target':
      return 'LINEAGE_CONSOLIDATION_UNKNOWN_TARGET';
    case 'consolidation_self_target':
      return 'LINEAGE_CONSOLIDATION_SELF_TARGET';
    case 'consolidation_target_missing':
      return 'LINEAGE_CONSOLIDATION_TARGET_MISSING';
    case 'unresolved_surviving_target':
      return 'LINEAGE_UNRESOLVED_SURVIVING_TARGET';
    case 'unknown_outcome':
      return 'LINEAGE_UNKNOWN_OUTCOME';
    default:
      return 'LINEAGE_UNCLASSIFIED';
  }
}

export type LineageClassification = {
  public_failure_code: LineagePublicFailureCode;
  subcodes: LineageSubcode[];
};

/**
 * Classify a reconciler failure's `issues[]` into precise, de-duplicated
 * subcodes while pinning the public failure code. Deterministic subcode order
 * (issue order, first occurrence wins) keeps telemetry stable across runs.
 */
export function classifyReconcilerIssues(issues: readonly string[]): LineageClassification {
  const subcodes: LineageSubcode[] = [];
  const seen = new Set<LineageSubcode>();
  for (const issue of issues) {
    if (typeof issue !== 'string' || issue.length === 0) continue;
    const subcode = mapReconcilerIssueToSubcode(issue);
    if (!seen.has(subcode)) {
      seen.add(subcode);
      subcodes.push(subcode);
    }
  }
  return { public_failure_code: LINEAGE_PUBLIC_FAILURE_CODE, subcodes };
}
