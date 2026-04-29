import { buildAdvisoryPlan } from "../buildAdvisoryPlan";

describe("buildAdvisoryPlan", () => {
  it("creates blocking and advisory lanes from low scores", () => {
    const result = buildAdvisoryPlan({
      criteria: [
        { key: "concept", final_score_0_10: 6 },
        { key: "narrativeDrive", final_score_0_10: 5 },
        { key: "voice", final_score_0_10: 8 },
        { key: "pacing", final_score_0_10: 5 },
      ],
    });

    expect(result).toEqual([
      {
        criterion: "concept",
        score: 6,
        severity: "advisory",
        advisoryLane: "clarify_premise_hook",
        requiredRevisionScope: "chapter",
      },
      {
        criterion: "narrativeDrive",
        score: 5,
        severity: "blocking",
        advisoryLane: "increase_escalation_consequence",
        requiredRevisionScope: "scene",
      },
      {
        criterion: "pacing",
        score: 5,
        severity: "blocking",
        advisoryLane: "compress_pacing_drag",
        requiredRevisionScope: "scene",
      },
    ]);
  });

  it("returns empty plan when no criteria score 6 or below", () => {
    const result = buildAdvisoryPlan({
      criteria: [
        { key: "concept", final_score_0_10: 8 },
        { key: "voice", final_score_0_10: 9 },
      ],
    });

    expect(result).toEqual([]);
  });

  it("throws when a criterion key has no lane mapping", () => {
    expect(() =>
      buildAdvisoryPlan({
        criteria: [{ key: "concept" as never, final_score_0_10: 6 }],
      }),
    ).not.toThrow();

    expect(() =>
      buildAdvisoryPlan({
        criteria: [{ key: "unknown_key" as never, final_score_0_10: 6 }],
      }),
    ).toThrow("Missing advisory lane for criterion: unknown_key");
  });
});
