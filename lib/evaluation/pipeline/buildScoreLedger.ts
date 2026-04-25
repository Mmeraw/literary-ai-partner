import type { ArtifactScoreLedger } from "./types";

const MAX_SCORE_PER_CRITERION = 10;

export function buildScoreLedger(input: {
  criteria: { final_score_0_10: number }[];
}): ArtifactScoreLedger {
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
