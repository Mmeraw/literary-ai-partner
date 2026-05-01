import { buildScoreLedger } from "../buildScoreLedger";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

describe("buildScoreLedger (weighted)", () => {
  const fullCriteria = CRITERIA_KEYS.map((key) => ({
    key,
    final_score_0_10: 8,
  }));

  it("returns the same score when all criteria have identical scores", () => {
    const ledger = buildScoreLedger({ criteria: fullCriteria });
    expect(ledger.normalized).toBeCloseTo(8, 10);
    expect(ledger.weighting).toBe("weighted");
  });

  it("weights structural criteria more than market criteria", () => {
    const baseline = CRITERIA_KEYS.map((key) => ({ key, final_score_0_10: 8 }));

    const dropConcept = baseline.map((c) =>
      c.key === "concept" ? { ...c, final_score_0_10: 1 } : c,
    );

    const dropMarket = baseline.map((c) =>
      c.key === "marketability" ? { ...c, final_score_0_10: 1 } : c,
    );

    const conceptWcs = buildScoreLedger({ criteria: dropConcept }).normalized;
    const marketWcs = buildScoreLedger({ criteria: dropMarket }).normalized;

    expect(conceptWcs).toBeLessThan(marketWcs);
  });

  it("throws on unknown criterion key", () => {
    expect(() =>
      buildScoreLedger({
        criteria: [{ key: "invalid_key", final_score_0_10: 5 }],
      }),
    ).toThrow(/INVALID/);
  });

  it("throws on empty criteria set", () => {
    expect(() => buildScoreLedger({ criteria: [] })).toThrow(/INVALID/);
  });
});
