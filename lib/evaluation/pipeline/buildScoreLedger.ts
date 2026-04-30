import type { ArtifactScoreLedger } from "./types";

const MAX_SCORE_PER_CRITERION = 10;
const AUTHORITY_THRESHOLD = 6 as const;

export type AuthorityCompositeReasonCode =
  | "AUTHORITY_COMPOSITE_BELOW_THRESHOLD"
  | "MECHANISM_MISSING";

export type AuthorityComposite = {
  /** (voice + proseControl + tone) / 3, rounded to 2 decimal places. */
  score_0_10: number;
  /** Numeric threshold below which the authority cap applies. Registry-driven thresholding is deferred. */
  threshold: typeof AUTHORITY_THRESHOLD;
  /** True when numeric authority is below threshold or a future structured mechanism gate triggers. */
  capApplied: boolean;
  /** Ledger-level SIGNAL codes. Artifact-level enforcement records use separate vocabulary. */
  capReasonCodes: AuthorityCompositeReasonCode[];
  /** Audit trail for the source scores that produced the composite. */
  originalCompositeInputs: {
    voice: number;
    proseControl: number;
    tone: number;
  };
};

export type ScoreLedgerWithAuthority = ArtifactScoreLedger & {
  authorityComposite: AuthorityComposite;
};

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function readCriterionScore(
  criteria: Array<{ key?: string; final_score_0_10: number }>,
  key: string,
): number {
  // Fail-closed: missing canonical criteria are treated as 0 to prevent a
  // false-high Authority Composite. Doctrinally required — never coerce up.
  return criteria.find((criterion) => criterion.key === key)?.final_score_0_10 ?? 0;
}

export function computeAuthorityComposite(
  criteria: Array<{ key?: string; final_score_0_10: number }>,
  options?: { mechanismMissing?: boolean },
): AuthorityComposite {
  const voice = readCriterionScore(criteria, "voice");
  const proseControl = readCriterionScore(criteria, "proseControl");
  const tone = readCriterionScore(criteria, "tone");

  const score_0_10 = round2((voice + proseControl + tone) / 3);
  const numericTrigger = score_0_10 < AUTHORITY_THRESHOLD;
  const mechanismTrigger = options?.mechanismMissing === true;

  const capReasonCodes: AuthorityCompositeReasonCode[] = [];
  // Ledger codes = SIGNAL (why the composite triggered).
  // Artifact score_adjustments.reason = ENFORCEMENT (what was applied).
  // Keep these vocabularies distinct.
  if (numericTrigger) {
    capReasonCodes.push("AUTHORITY_COMPOSITE_BELOW_THRESHOLD");
  }
  if (mechanismTrigger) {
    capReasonCodes.push("MECHANISM_MISSING");
  }

  return {
    score_0_10,
    threshold: AUTHORITY_THRESHOLD,
    capApplied: numericTrigger || mechanismTrigger,
    capReasonCodes,
    originalCompositeInputs: { voice, proseControl, tone },
  };
}

export function buildScoreLedger(
  input: {
    criteria: { key?: string; final_score_0_10: number }[];
  },
  options?: { mechanismMissing?: boolean },
): ScoreLedgerWithAuthority {
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
    authorityComposite: computeAuthorityComposite(criteria, options),
  };
}
