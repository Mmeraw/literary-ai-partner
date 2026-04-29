import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { buildExcellenceFilter } from "../buildExcellenceFilter";
import { buildScoreLedger } from "../buildScoreLedger";
import {
  hasBlockingArtifactReasonCodes,
  validateEvaluationArtifact,
} from "../validateEvaluationArtifact";
import type { EvaluationArtifact } from "../types";

function makeArtifact(overrides?: Partial<EvaluationArtifact>): EvaluationArtifact {
  const criteria = CRITERIA_KEYS.map((key) => ({
    key,
    final_score_0_10: 7,
    reasoning: `Reasoning for ${key}`,
    evidence: `At river-bank scene after camp setup: \"Evidence for ${key}\"`,
    interpretation: `Interpretation for ${key}`,
  }));

  return {
    criteria,
    ledger: buildScoreLedger({ criteria }),
    efg: buildExcellenceFilter({ criteria }),
    ...overrides,
  };
}

describe("validateEvaluationArtifact", () => {
  it("returns PASS with no reason codes for a compliant artifact", () => {
    const artifact = makeArtifact();
    const result = validateEvaluationArtifact(artifact);

    expect(result.result).toBe("PASS");
    expect(result.reasonCodes).toEqual([]);
    expect(result.validatedAt).toBeTruthy();
  });

  it("returns HOLD with SCORE-NORM-1 when ledger does not match criteria", () => {
    const artifact = makeArtifact({
      ledger: {
        rawTotal: 1,
        maxTotal: 130,
        normalized: 1,
        weighting: "equal",
      },
    });

    const result = validateEvaluationArtifact(artifact);
    expect(result.result).toBe("HOLD");
    expect(result.reasonCodes).toContain("SCORE-NORM-1");
    expect(hasBlockingArtifactReasonCodes(result.reasonCodes)).toBe(true);
  });

  it("returns FAIL when criteria are fully missing", () => {
    const artifact = makeArtifact({
      criteria: [],
      ledger: {
        rawTotal: 0,
        maxTotal: 0,
        normalized: 0,
        weighting: "equal",
      },
      efg: {
        verdict: "not-yet-ready",
        blockingCriteria: [],
      },
    });

    const result = validateEvaluationArtifact(artifact);
    expect(result.result).toBe("FAIL");
    expect(result.reasonCodes).toContain("CRIT-MISSING-ALL");
    expect(result.reasonCodes).toContain("CRIT-MISSING-1");
  });

  it("flags evidence/reasoning/interpretation and non-integer score violations", () => {
    const criteria = CRITERIA_KEYS.map((key, idx) => ({
      key,
      final_score_0_10: idx === 0 ? 7.5 : 7,
      reasoning: idx === 1 ? "N/A" : `Reasoning for ${key}`,
      evidence: idx === 2 ? "weak" : `At chapter opening: \"Evidence for ${key}\"`,
      interpretation: idx === 3 ? "" : `Interpretation for ${key}`,
    }));

    const artifact: EvaluationArtifact = {
      criteria,
      ledger: buildScoreLedger({
        criteria: criteria.map((criterion) => ({
          final_score_0_10: Math.round(criterion.final_score_0_10),
        })),
      }),
      efg: buildExcellenceFilter({
        criteria: criteria.map((criterion) => ({
          key: criterion.key as CriterionKey,
          final_score_0_10: Math.round(criterion.final_score_0_10),
        })),
      }),
    };

    const result = validateEvaluationArtifact(artifact);
    expect(result.reasonCodes).toContain("SCORE-NON-INTEGER-1");
    expect(result.reasonCodes).toContain("REASONING-MISSING-1");
    expect(result.reasonCodes).toContain("EVIDENCE-MISSING-1");
    expect(result.reasonCodes).toContain("INTERP-MISSING-1");
  });
});
