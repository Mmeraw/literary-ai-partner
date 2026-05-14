/**
 * Long-Form Pipeline Success Contract — machine-readable constants.
 *
 * Canonical source: docs/governance/LONG_FORM_PIPELINE_SUCCESS_CONTRACT.md
 *
 * This module exists to prevent drift between prose contract clauses
 * and Tier 2/runtime assertions.
 *
 * Current scope: test/contract consumers (Tier 2 and related harnesses).
 * Runtime/UI imports are intentionally deferred to the follow-on adoption PR.
 *
 * Any change here REQUIRES a corresponding change to the canonical
 * contract document, per the contract's amendment rule.
 */

/**
 * Clause IDs — one per numbered clause in §"The 12 Clauses".
 *
 * Use these to tag Tier 2 assertions and pipeline error contexts so
 * every failure points back to a named contract clause.
 */
export const LONG_FORM_CLAUSE_IDS = [
  'CLAUSE_1_ROUTING_ENGAGED',
  'CLAUSE_2_COVERAGE_SUFFICIENT',
  'CLAUSE_3_PASS1_WITHIN_BUDGET',
  'CLAUSE_4_PASS2_WITHIN_BUDGET',
  'CLAUSE_5_PASS3_WITHIN_BUDGET',
  'CLAUSE_6_PASS4_GOVERNANCE_PRESENT',
  'CLAUSE_7_CROSS_CHECK_PRESENT',
  'CLAUSE_8_QUALITY_GATE_PASSES',
  'CLAUSE_9_SCORES_PRODUCED',
  'CLAUSE_10_SUMMARIES_PRODUCED',
  'CLAUSE_11_TOTAL_RUNTIME_WITHIN_BUDGET',
  'CLAUSE_12_PERSISTENCE_COMPLETE',
] as const;

export type LongFormClauseId = (typeof LONG_FORM_CLAUSE_IDS)[number];

/**
 * Human-readable titles for each clause, sourced verbatim from the
 * canonical contract document headings.
 */
export const LONG_FORM_CLAUSE_TITLES: Record<LongFormClauseId, string> = {
  CLAUSE_1_ROUTING_ENGAGED: 'Routing engaged',
  CLAUSE_2_COVERAGE_SUFFICIENT: 'Chunk coverage sufficient',
  CLAUSE_3_PASS1_WITHIN_BUDGET: 'Pass 1 completes within budget',
  CLAUSE_4_PASS2_WITHIN_BUDGET: 'Pass 2 completes within budget',
  CLAUSE_5_PASS3_WITHIN_BUDGET: 'Pass 3 completes within budget',
  CLAUSE_6_PASS4_GOVERNANCE_PRESENT: 'Pass 4 governance present (required mode)',
  CLAUSE_7_CROSS_CHECK_PRESENT: 'Cross-check present (required mode)',
  CLAUSE_8_QUALITY_GATE_PASSES: 'Quality gate passes',
  CLAUSE_9_SCORES_PRODUCED: 'Scores produced',
  CLAUSE_10_SUMMARIES_PRODUCED: 'Summaries produced',
  CLAUSE_11_TOTAL_RUNTIME_WITHIN_BUDGET: 'Total runtime within budget',
  CLAUSE_12_PERSISTENCE_COMPLETE: 'Persistence complete',
};

/**
 * Fail-closed codes — one per clause, plus the multi-layer addendum.
 *
 * These strings must be the exact values persisted to `failure_code`
 * on a failed evaluation_jobs row for long-form contract failures.
 *
 * Note: this list is the long-form contract overlay, not the job retry
 * taxonomy in `lib/jobs/failures.ts`.
 */
export const LONG_FORM_FAIL_CODES = [
  'CHUNK_ROUTING_NOT_ENGAGED',
  'COVERAGE_INSUFFICIENT',
  'PASS1_TIMEOUT',
  'PASS2_TIMEOUT',
  'PASS3_TIMEOUT',
  'PASS4_MISSING',
  'CROSS_CHECK_MISSING',
  'QG_FAILED',
  'SCORES_MISSING',
  'SUMMARIES_MISSING',
  'TOTAL_TIMEOUT',
  'PERSISTENCE_INCOMPLETE',
  'LAYER_INCOMPLETE',
] as const;

export type LongFormFailCode = (typeof LONG_FORM_FAIL_CODES)[number];

/**
 * Map every clause to its canonical fail-closed code.
 * Multi-layer addendum has its own LAYER_INCOMPLETE code, not bound
 * to a numbered clause.
 */
export const LONG_FORM_CLAUSE_TO_FAIL_CODE: Record<LongFormClauseId, LongFormFailCode> = {
  CLAUSE_1_ROUTING_ENGAGED: 'CHUNK_ROUTING_NOT_ENGAGED',
  CLAUSE_2_COVERAGE_SUFFICIENT: 'COVERAGE_INSUFFICIENT',
  CLAUSE_3_PASS1_WITHIN_BUDGET: 'PASS1_TIMEOUT',
  CLAUSE_4_PASS2_WITHIN_BUDGET: 'PASS2_TIMEOUT',
  CLAUSE_5_PASS3_WITHIN_BUDGET: 'PASS3_TIMEOUT',
  CLAUSE_6_PASS4_GOVERNANCE_PRESENT: 'PASS4_MISSING',
  CLAUSE_7_CROSS_CHECK_PRESENT: 'CROSS_CHECK_MISSING',
  CLAUSE_8_QUALITY_GATE_PASSES: 'QG_FAILED',
  CLAUSE_9_SCORES_PRODUCED: 'SCORES_MISSING',
  CLAUSE_10_SUMMARIES_PRODUCED: 'SUMMARIES_MISSING',
  CLAUSE_11_TOTAL_RUNTIME_WITHIN_BUDGET: 'TOTAL_TIMEOUT',
  CLAUSE_12_PERSISTENCE_COMPLETE: 'PERSISTENCE_INCOMPLETE',
};

/**
 * Default budgets in milliseconds.
 *
 * These are CONTRACT DEFAULTS for clauses 3, 4, 5, and 11. Production
 * runtime configuration may apply stricter floors or different bounds.
 * Values here exist for contract-aware tests, fixtures, and docs to import
 * a stable reference.
 *
 * Sourced from the contract's intent (Tier 2 evidence: 429 backoff
 * legitimately consumes 40-70s, so a 720s long-form floor is applied in
 * runtime config today).
 */
export const LONG_FORM_BUDGETS_MS = {
  PASS_TIMEOUT_MS: 720_000,
  TOTAL_TIMEOUT_MS: 900_000,
} as const;

/**
 * Coverage threshold for Clause 2.
 *
 * A long-form run with analyzed-word coverage below this threshold
 * must fail with COVERAGE_INSUFFICIENT. Manuscript-wide certification
 * is forbidden below this threshold.
 */
export const LONG_FORM_COVERAGE_MIN_PCT = 100;

/**
 * Required-mode marker — used by Clauses 6 and 7.
 *
 * Jobs running in modes that enforce external adjudication evidence
 * must produce both pass4_governance and cross_check outputs.
 */
export const LONG_FORM_REQUIRED_MODE = 'required' as const;
export type LongFormAdjudicationMode = 'required' | 'optional' | 'veto';

export const LONG_FORM_EVIDENCE_REQUIRED_MODES = [
  'required',
  'veto',
] as const satisfies readonly LongFormAdjudicationMode[];

/**
 * Convenience: tier 2 assertion message helper.
 *
 * Tier 2 assertions should prefix every failure with the clause ID
 * and fail code so log readers can map back to the canonical contract
 * without searching prose docs.
 */
export function formatClauseFailureMessage(
  clauseId: LongFormClauseId,
  detail: string,
): string {
  const code = LONG_FORM_CLAUSE_TO_FAIL_CODE[clauseId];
  const title = LONG_FORM_CLAUSE_TITLES[clauseId];
  return `[${clauseId}] ${title} (${code}): ${detail}`;
}
