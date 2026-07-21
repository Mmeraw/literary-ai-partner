import {
  buildCurrentRawPass3Criterion,
  buildCurrentRawPass3Response,
  buildInvalidRawPass3CriterionForDispositionTest,
} from "./currentPass3Response";

describe("current raw Pass 3 fixture authority", () => {
  test("derives recommendation_provided for a meaningful recommendation", () => {
    const criterion = buildCurrentRawPass3Criterion({
      key: "concept",
      recommendations: [
        {
          action: "Clarify the governing dramatic question in the opening scene.",
          expected_impact: "Readers can identify the story promise before the first turn.",
        },
      ],
    });

    expect(criterion).toEqual(expect.objectContaining({
      recommendation_status: "recommendation_provided",
    }));
    expect(criterion).not.toHaveProperty("recommendation_status_rationale");
  });

  test("derives a substantive governed disposition for an empty collection", () => {
    const criterion = buildCurrentRawPass3Criterion({
      key: "voice",
      recommendations: [],
    });

    expect(criterion).toEqual(expect.objectContaining({
      recommendation_status: "no_recommendation_warranted",
      recommendation_status_rationale: expect.stringMatching(/\S.{18,}\S/),
    }));
  });

  test("materializes all canonical criteria and rejects duplicate identities", () => {
    const response = buildCurrentRawPass3Response({ criteria: [{ key: "concept" }] });
    expect(response.criteria).toHaveLength(13);

    expect(() => buildCurrentRawPass3Response({
      criteria: [{ key: "concept" }, { key: "concept" }],
    })).toThrow("Duplicate current Pass 3 fixture criterion: concept");
  });

  test("blocks direct disposition overrides in successful fixture construction", () => {
    expect(() => buildCurrentRawPass3Criterion({
      key: "concept",
      recommendations: [],
      recommendation_status: "recommendation_provided",
    })).toThrow("cannot override recommendation disposition fields directly");
  });

  test("makes contradictory metadata available only through the named fail-closed builder", () => {
    const criterion = buildInvalidRawPass3CriterionForDispositionTest(
      { key: "concept", recommendations: [] },
      {
        expectedFailureCode: "CRITERION_OPPORTUNITY_COVERAGE_INVALID",
        recommendation_status: "recommendation_provided",
      },
    );

    expect(criterion).toEqual(expect.objectContaining({
      recommendations: [],
      recommendation_status: "recommendation_provided",
    }));
  });
});
