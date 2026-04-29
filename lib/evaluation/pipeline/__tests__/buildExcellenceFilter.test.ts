import { buildExcellenceFilter } from "../buildExcellenceFilter";

describe("buildExcellenceFilter", () => {
  it("returns not-yet-ready when hard blockers exist", () => {
    const result = buildExcellenceFilter({
      criteria: [
        { key: "concept", final_score_0_10: 6 },
        { key: "narrativeDrive", final_score_0_10: 5 },
        { key: "pacing", final_score_0_10: 5 },
      ],
    });

    expect(result).toEqual({
      verdict: "not-yet-ready",
      blockingCriteria: ["concept", "narrativeDrive", "pacing"],
    });
  });

  it("returns close-but-not-ready when no hard block exists but average is below 8", () => {
    const result = buildExcellenceFilter({
      criteria: [
        { key: "concept", final_score_0_10: 7 },
        { key: "voice", final_score_0_10: 8 },
        { key: "worldbuilding", final_score_0_10: 8 },
      ],
    });

    expect(result.verdict).toBe("close-but-not-ready");
  });

  it("returns submission-ready when no blockers exist and average is strong", () => {
    const result = buildExcellenceFilter({
      criteria: [
        { key: "concept", final_score_0_10: 8 },
        { key: "voice", final_score_0_10: 9 },
        { key: "worldbuilding", final_score_0_10: 9 },
      ],
    });

    expect(result).toEqual({
      verdict: "submission-ready",
      blockingCriteria: [],
    });
  });
});
