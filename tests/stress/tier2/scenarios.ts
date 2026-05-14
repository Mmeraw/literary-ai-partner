/**
 * tests/stress/tier2/scenarios.ts
 *
 * Tier 2 stress matrix — live OpenAI + live Perplexity against a real
 * long-form manuscript. One row to start, by design.
 *
 * Why one row: Tier 2 is expensive (live model spend, ~15 min wall-time per
 * run). The intent is to catch the class of failure that bit prod eval
 * 609dc776-6ccd-41dd-9353-1425697f1fb2 on 2026-05-13 — silent skip /
 * missing cross-check / Pass 4 governance not populated on real
 * 50k-word manuscripts at production concurrency. One representative row
 * locks the regression; additional rows (quality drift, refusal handling,
 * variant coverage) belong in follow-up PRs.
 */

export type Tier2Outcome = "success" | "fail";

export interface Tier2Expectation {
  outcome: Tier2Outcome;
  /** evaluation_result.cross_check must be a non-empty object. */
  cross_check_required: boolean;
  /** evaluation_result.pass4_governance must be populated. */
  pass4_governance_required: boolean;
  /** Minimum chunk-coverage percent for success. */
  coverage_min_pct: number;
  /** Wall-time ceiling for the full pipeline (ms). */
  max_total_ms: number;
  /** Wall-time ceiling for Pass 4 cross-check alone (ms). */
  max_pass4_ms: number;
}

export interface Tier2Row {
  id: string;
  manuscript_fixture: string;
  work_type: string;
  english_variant: "american" | "british";
  expected: Tier2Expectation;
  notes: string;
}

export const TIER2_SCENARIOS: Tier2Row[] = [
  {
    id: "Q-long-real-perplexity",
    manuscript_fixture: "long-form-50k.txt",
    work_type: "novel",
    english_variant: "american",
    expected: {
      outcome: "success",
      cross_check_required: true,
      pass4_governance_required: true,
      coverage_min_pct: 95,
      max_total_ms: 15 * 60 * 1000, // 15 min hard cap
      max_pass4_ms: 90 * 1000, // 90s Pass 4 budget (Perplexity 60s × 1.5 slack)
    },
    notes:
      "Long-form route (>25k words) + real OpenAI + real Perplexity. Catches " +
      "the silent-skip class that bit prod eval 609dc776 on 2026-05-13: " +
      "`External adjudication mode 'required' requires cross-check output`.",
  },
];
