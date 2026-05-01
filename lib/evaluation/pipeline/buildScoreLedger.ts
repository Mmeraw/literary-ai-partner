import { CRITERIA_KEYS, type CriterionKey as EvaluationCriterionKey } from "@/schemas/criteria-keys";
import {
  CRITERION_WEIGHT_MAP,
  type CriterionKey as GovernanceCriterionKey,
} from "@/lib/governance/canonicalCriteria";
import { computeWeightedCompositeScore } from "@/lib/governance/criteriaEnvelope";
import type { EvaluationEnvelope } from "@/lib/governance/types";
import type { ArtifactScoreLedger } from "./types";

const AUTHORITY_THRESHOLD = 6 as const;
const LEDGER_GATE_PARITY_EPSILON = 1e-9;

const EVALUATION_TO_GOVERNANCE_CRITERION_KEY: Record<
  EvaluationCriterionKey,
  GovernanceCriterionKey
> = {
  concept: "CONCEPT",
  narrativeDrive: "MOMENTUM",
  character: "CHARACTER",
  voice: "POVVOICE",
  sceneConstruction: "SCENE",
  dialogue: "DIALOGUE",
  theme: "THEME",
  worldbuilding: "WORLD",
  pacing: "PACING",
  proseControl: "PROSE",
  tone: "TONE",
  narrativeClosure: "CLOSURE",
  marketability: "MARKET",
};

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

type LedgerCriterion = { key?: string; final_score_0_10: number };

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function isEvaluationCriterionKey(key: unknown): key is EvaluationCriterionKey {
  return typeof key === "string" && CRITERIA_KEYS.includes(key as EvaluationCriterionKey);
}

function resolveGovernanceCriterionKey(key: unknown): GovernanceCriterionKey {
  if (!isEvaluationCriterionKey(key)) {
    throw new Error(`INVALID: unknown criterion key ${String(key)}`);
  }

  return EVALUATION_TO_GOVERNANCE_CRITERION_KEY[key];
}

function getWeightForEvaluationCriterion(key: unknown): number {
  const governanceKey = resolveGovernanceCriterionKey(key);
  const weight = CRITERION_WEIGHT_MAP[governanceKey];

  if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
    throw new Error(`INVALID: missing or invalid weight for criterion key ${String(key)}`);
  }

  return weight;
}

function toGovernanceEnvelope(criteria: LedgerCriterion[]): EvaluationEnvelope {
  return {
    criteria: criteria.map((criterion) => ({
      key: resolveGovernanceCriterionKey(criterion.key),
      score: criterion.final_score_0_10,
    })),
  };
}

export function assertLedgerGateParity(ledgerWcs: number, gateWcs: number): void {
  if (Math.abs(ledgerWcs - gateWcs) > LEDGER_GATE_PARITY_EPSILON) {
    throw new Error(
      `INVALID: buildScoreLedger WCS (${ledgerWcs}) !== eligibility gate WCS (${gateWcs}); canonical scoring drift detected`,
    );
  }
}

function readCriterionScore(
  criteria: Array<{ key?: string; final_score_0_10: number }>,
  key: EvaluationCriterionKey,
): number {
  // Fail-closed for authority composite by treating missing canonical criteria as 0.
  // Main ledger scoring itself validates canonical keys and fails on unknown/missing inputs.
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
    criteria: LedgerCriterion[];
  },
  options?: { mechanismMissing?: boolean },
): ScoreLedgerWithAuthority {
  // POLICY (#231-B): Ledger A uses the canonical weighted 13-criteria scoring
  // model. non_scorable denominator behavior remains explicitly out of scope
  // for this PR and is tracked separately in #231-C.
  const criteria = input.criteria ?? [];

  if (criteria.length === 0) {
    throw new Error("INVALID: buildScoreLedger requires at least one criterion");
  }

  const weightedSum = criteria.reduce((sum, criterion) => {
    return sum + criterion.final_score_0_10 * getWeightForEvaluationCriterion(criterion.key);
  }, 0);

  const weightTotal = criteria.reduce((sum, criterion) => {
    return sum + getWeightForEvaluationCriterion(criterion.key);
  }, 0);

  if (weightTotal <= 0) {
    throw new Error("INVALID: buildScoreLedger weight total must be greater than zero");
  }

  const wcs = weightedSum / weightTotal;
  const gateWcs = computeWeightedCompositeScore(toGovernanceEnvelope(criteria));
  assertLedgerGateParity(wcs, gateWcs);

  return {
    rawTotal: round2(weightedSum),
    maxTotal: round2(weightTotal),
    normalized: round2(wcs),
    weighting: "weighted",
    authorityComposite: computeAuthorityComposite(criteria, options),
  };
}
