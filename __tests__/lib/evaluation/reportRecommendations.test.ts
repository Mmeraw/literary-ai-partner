const { buildTopRecommendations } = require("../../../lib/evaluation/reportRecommendations");

describe("buildTopRecommendations", () => {
  test("prefers explicit quick wins and strategic revisions over summary text", () => {
    const output = buildTopRecommendations({
      summary: "This summary should not be echoed as a recommendation.",
      recommendations: {
        quick_wins: [
          {
            action: "Condense the council-profile sequence by combining repeated motive beats.",
            why: "This preserves the strongest revelations while reducing pattern fatigue.",
          },
        ],
        strategic_revisions: [
          {
            action: "Insert one irreversible discovery before the river meditation closes the chapter.",
            why: "This converts accumulated pressure into immediate narrative consequence.",
          },
        ],
      },
    });

    expect(output).toEqual([
      "Quick win: Condense the council-profile sequence by combining repeated motive beats. — This preserves the strongest revelations while reducing pattern fatigue.",
      "Strategic revision: Insert one irreversible discovery before the river meditation closes the chapter. — This converts accumulated pressure into immediate narrative consequence.",
    ]);
  });

  test("falls back to criterion recommendations before summary sentences", () => {
    const output = buildTopRecommendations({
      summary: "Sentence one. Sentence two.",
      criteria: [
        {
          recommendations: [
            {
              action: "Differentiate Malcolm and Frankie through distinct consequence paths.",
              expected_impact: "This reduces repetitive profile rhythm.",
            },
          ],
        },
      ],
    });

    expect(output).toEqual([
      "Differentiate Malcolm and Frankie through distinct consequence paths. — This reduces repetitive profile rhythm.",
    ]);
  });
});