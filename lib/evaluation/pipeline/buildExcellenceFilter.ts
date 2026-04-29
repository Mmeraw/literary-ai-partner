import type { ExcellenceFilterFooter, SubmissionReadiness } from "./types";

const HARD_BLOCK_THRESHOLD = 5;
const SOFT_BLOCK_THRESHOLD = 6;

export function buildExcellenceFilter(input: {
  criteria: { key: ExcellenceFilterFooter["blockingCriteria"][number]; final_score_0_10: number }[];
}): ExcellenceFilterFooter {
  const criteria = input.criteria ?? [];

  const blockers = criteria
    .filter((criterion) => criterion.final_score_0_10 <= SOFT_BLOCK_THRESHOLD)
    .map((criterion) => criterion.key);

  const hasHardBlock = criteria.some(
    (criterion) => criterion.final_score_0_10 <= HARD_BLOCK_THRESHOLD,
  );

  const average =
    criteria.length > 0
      ? criteria.reduce((sum, criterion) => sum + criterion.final_score_0_10, 0) /
        criteria.length
      : 0;

  let verdict: SubmissionReadiness = "submission-ready";

  if (hasHardBlock || average < 7) {
    verdict = "not-yet-ready";
  } else if (blockers.length > 0 || average < 8) {
    verdict = "close-but-not-ready";
  }

  return {
    verdict,
    blockingCriteria: blockers,
  };
}
