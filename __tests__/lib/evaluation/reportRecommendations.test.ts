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

  test("normalizes anchored-moment lead-in and seam artifacts for top list readability", () => {
    const output = buildTopRecommendations({
      recommendations: {
        strategic_revisions: [
          {
            action:
              'In the anchored moment "Characters are developed through their interactions", replace one abstract reaction line with a concrete decision beat and a because abstract phrasing blunts motivation; clarify internal motivations.',
            why: "Improves action readability in summary surfaces.",
          },
        ],
      },
    });

    expect(output).toEqual([
      "replace one abstract reaction line with a concrete decision beat because abstract phrasing blunts motivation; clarify internal motivations. — Improves action readability in summary surfaces.",
    ]);
    expect(output[0]).not.toContain("In the anchored moment");
    expect(output[0]).not.toContain("Strategic revision:");
    expect(output[0]).not.toContain("and a because");
  });

  test("limits repetitive openings in top recommendations", () => {
    const output = buildTopRecommendations({
      criteria: [
        {
          recommendations: [
            {
              action: 'In the anchored moment "A", replace one abstract reaction line with a concrete decision beat and one contradiction.',
              expected_impact: 'Improves character agency.',
            },
            {
              action: 'In the anchored moment "B", replace one abstract reaction line with a concrete decision beat and one contradiction in a later scene.',
              expected_impact: 'Improves motivation legibility.',
            },
            {
              action: 'In the anchored moment "C", cut one reflective sentence and insert one immediate external action trigger.',
              expected_impact: 'Improves momentum.',
            },
          ],
        },
      ],
    });

    expect(output.length).toBe(2);
    expect(output[0]).toMatch(/^replace one abstract reaction line/);
    expect(output[1]).toMatch(/^cut one reflective sentence/);
  });
});