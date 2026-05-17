import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import {
  annotateWeakCriteria,
  DEFAULT_PASS1_WEAK_SCORE_THRESHOLD,
  PASS1_REMEDIATION_REQUIRED_CODE,
  PASS1_WEAK_CRITERION_CODE,
} from "@/lib/evaluation/pipeline/weakCriteriaCheck";

function makeOutput(scores: number[]): SinglePassOutput {
  return {
    pass: 1,
    axis: "craft_execution",
    criteria: CRITERIA_KEYS.map((key, i) => ({
      key,
      score_0_10: scores[i] ?? 7,
      rationale: `rationale ${key}`,
      evidence: [{ snippet: `evidence ${key}` }],
      recommendations: [],
    })),
    model: "gpt-5.1",
    prompt_version: "pass1-craft-v8-provenance-hardening",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

describe("annotateWeakCriteria", () => {
  it("flags criteria at or below threshold with deterministic reason codes", () => {
    const output = makeOutput([8, 4, 3, 7, 2]);
    const result = annotateWeakCriteria(output, 4);

    expect(result.weakKeys).toEqual(
      expect.arrayContaining([
        CRITERIA_KEYS[1],
        CRITERIA_KEYS[2],
        CRITERIA_KEYS[4],
      ])
    );

    const weak = result.output.criteria.find((c) => c.key === CRITERIA_KEYS[2]);
    expect(weak?.reason_codes).toEqual(
      expect.arrayContaining([
        PASS1_WEAK_CRITERION_CODE,
        PASS1_REMEDIATION_REQUIRED_CODE,
        "PASS1_WEAK_THRESHOLD_LE_4",
      ])
    );
  });

  it("does not alter non-weak criteria", () => {
    const output = makeOutput(Array.from({ length: CRITERIA_KEYS.length }, () => 8));
    const result = annotateWeakCriteria(output);

    expect(result.weakKeys).toHaveLength(0);
    expect(
      result.output.criteria.every((criterion) => !criterion.reason_codes || criterion.reason_codes.length === 0)
    ).toBe(true);
  });

  it("uses default threshold when not provided", () => {
    const output = makeOutput([DEFAULT_PASS1_WEAK_SCORE_THRESHOLD]);
    const result = annotateWeakCriteria(output);

    expect(result.weakKeys).toContain(CRITERIA_KEYS[0]);
  });
});
