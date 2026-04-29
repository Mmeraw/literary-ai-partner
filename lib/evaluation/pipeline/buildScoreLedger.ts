import type { ArtifactScoreLedger } from "./types";

const MAX_SCORE_PER_CRITERION = 10;

export function buildScoreLedger(input: {
  criteria: { final_score_0_10: number }[];
}): ArtifactScoreLedger {
  // POLICY (current canonical behavior): denominator uses the full criteria
  // set provided to the ledger builder. In this PR slice, non_scorable status
  // affects confidence/scorability metadata and gating signals, but does not
  // alter ledger denominator math.
  //
  // Follow-up track: evaluate a scorable-only denominator policy in a
  // dedicated PR to avoid expanding this slice scope.
  const criteria = input.criteria ?? [];

  const rawTotal = criteria.reduce((sum, criterion) => {
    return sum + criterion.final_score_0_10;
  }, 0);

  const maxTotal = criteria.length * MAX_SCORE_PER_CRITERION;
  const normalized = maxTotal > 0 ? Math.round((rawTotal / maxTotal) * 100) : 0;

  return {
    rawTotal,
    maxTotal,
    normalized,
    weighting: "equal",
  };
}
