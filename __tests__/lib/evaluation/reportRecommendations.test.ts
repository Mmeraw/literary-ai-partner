const {
  buildTopRecommendations,
  normalizeRecommendationActionForDisplay,
} = require("../../../lib/evaluation/reportRecommendations");

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
      "Condense the council-profile sequence by combining repeated motive beats. — This preserves the strongest revelations while reducing pattern fatigue.",
      "Insert one irreversible discovery before the river meditation closes the chapter. — This converts accumulated pressure into immediate narrative consequence.",
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

  test("removes strategic prefix and chapter-title anchored lead-in from top bullets", () => {
    const output = buildTopRecommendations({
      recommendations: {
        strategic_revisions: [
          {
            action:
              'Strategic revision: In the anchored moment "Chapter 11 – Witness Turns to Record", cut one reflective sentence and insert one immediate external action trigger because reflection stalls momentum; trim dense informational passages to maintain momentum.',
            why: "Improved narrative momentum and reader engagement.",
          },
        ],
      },
    });

    expect(output).toEqual([
      "cut one reflective sentence and insert one immediate external action trigger because reflection stalls momentum; trim dense informational passages to maintain momentum. — Improved narrative momentum and reader engagement.",
    ]);
    expect(output[0]).toMatch(/^cut one reflective sentence/i);
    expect(output[0]).not.toContain("Strategic revision:");
    expect(output[0]).not.toContain("In the anchored moment");
    expect(output[0]).not.toContain("Chapter 11");
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

describe("normalizeRecommendationActionForDisplay", () => {
  test("strips strategic prefix and anchored chapter lead-in", () => {
    const normalized = normalizeRecommendationActionForDisplay(
      'Strategic revision: In the anchored moment "Chapter 11 – Witness Turns to Record", replace one expository exchange with two short turns plus a brief interruption line because exposition flattens speaker pressure; revise dialogue in key scenes to include more subtext.',
    );

    expect(normalized).toBe(
      "replace one expository exchange with two short turns plus a brief interruption line because exposition flattens speaker pressure; revise dialogue in key scenes to include more subtext.",
    );
    expect(normalized).not.toContain("Strategic revision:");
    expect(normalized).not.toContain("In the anchored moment");
    expect(normalized).not.toContain("Chapter 11");
  });

  test("strips repeated family prefixes and leading bullet marker", () => {
    const normalized = normalizeRecommendationActionForDisplay(
      '• Strategic revision: Quick win: Strategic revision: In the anchored moment "Chapter 11 – Witness Turns to Record", cut one reflective sentence and insert one immediate external action trigger because reflection stalls momentum.',
    );

    expect(normalized).toBe(
      "cut one reflective sentence and insert one immediate external action trigger because reflection stalls momentum.",
    );
    expect(normalized.toLowerCase()).not.toContain("strategic revision:");
    expect(normalized.toLowerCase()).not.toContain("quick win:");
    expect(normalized).not.toContain("In the anchored moment");
  });
});