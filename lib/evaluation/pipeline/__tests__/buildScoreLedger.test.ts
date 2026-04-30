import { buildScoreLedger } from "../buildScoreLedger";

describe("buildScoreLedger", () => {
  it("computes raw, max, and normalized equal-weight score", () => {
    const output = {
      criteria: [
        { final_score_0_10: 6 },
        { final_score_0_10: 5 },
        { final_score_0_10: 7 },
        { final_score_0_10: 8 },
        { final_score_0_10: 6 },
        { final_score_0_10: 6 },
        { final_score_0_10: 6 },
        { final_score_0_10: 8 },
        { final_score_0_10: 5 },
        { final_score_0_10: 7 },
        { final_score_0_10: 7 },
        { final_score_0_10: 6 },
        { final_score_0_10: 6 },
      ],
    };

    expect(buildScoreLedger(output)).toEqual({
      rawTotal: 83,
      maxTotal: 130,
      normalized: 64,
      weighting: "equal",
      authorityComposite: {
        score_0_10: 0,
        threshold: 6,
        capApplied: true,
        capReasonCodes: ["AUTHORITY_COMPOSITE_BELOW_THRESHOLD"],
        originalCompositeInputs: {
          voice: 0,
          proseControl: 0,
          tone: 0,
        },
      },
    });
  });

  it("returns zero ledger for empty criteria", () => {
    expect(buildScoreLedger({ criteria: [] })).toEqual({
      rawTotal: 0,
      maxTotal: 0,
      normalized: 0,
      weighting: "equal",
      authorityComposite: {
        score_0_10: 0,
        threshold: 6,
        capApplied: true,
        capReasonCodes: ["AUTHORITY_COMPOSITE_BELOW_THRESHOLD"],
        originalCompositeInputs: {
          voice: 0,
          proseControl: 0,
          tone: 0,
        },
      },
    });
  });
});
