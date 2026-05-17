import type { SinglePassOutput } from "./types";

export const DEFAULT_PASS1_WEAK_SCORE_THRESHOLD = 4;
export const PASS1_WEAK_CRITERION_CODE = "PASS1_WEAK_CRITERION";
export const PASS1_REMEDIATION_REQUIRED_CODE = "PASS1_REMEDIATION_REQUIRED";

export function getPass1WeakCriteriaThreshold(): number {
  const raw = process.env.EVAL_PASS1_WEAK_CRITERIA_THRESHOLD;
  if (!raw) return DEFAULT_PASS1_WEAK_SCORE_THRESHOLD;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_PASS1_WEAK_SCORE_THRESHOLD;
  return Math.min(10, Math.max(0, parsed));
}

function uniqueReasonCodes(codes: string[]): string[] {
  return Array.from(new Set(codes.filter((code) => code.trim().length > 0)));
}

export function annotateWeakCriteria(
  output: SinglePassOutput,
  threshold: number = getPass1WeakCriteriaThreshold()
): { output: SinglePassOutput; weakKeys: string[] } {
  const weakKeys: string[] = [];

  const criteria = output.criteria.map((criterion) => {
    const score = Number(criterion.score_0_10);
    const isWeak = Number.isFinite(score) && score <= threshold;

    if (!isWeak) {
      return criterion;
    }

    weakKeys.push(criterion.key);

    return {
      ...criterion,
      reason_codes: uniqueReasonCodes([
        ...(criterion.reason_codes ?? []),
        PASS1_WEAK_CRITERION_CODE,
        PASS1_REMEDIATION_REQUIRED_CODE,
        `PASS1_WEAK_THRESHOLD_LE_${threshold}`,
      ]),
    };
  });

  return {
    output: {
      ...output,
      criteria,
    },
    weakKeys,
  };
}
