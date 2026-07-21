import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { CurrentEvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { makeCurrentProcessorEvaluationResult } from "./currentProcessorEvaluationResult";

describe("makeCurrentProcessorEvaluationResult", () => {
  test("creates complete strict current-write authority by construction", () => {
    const result: CurrentEvaluationResultV2 = makeCurrentProcessorEvaluationResult();

    expect(result.criteria.map((criterion) => criterion.key)).toEqual(CRITERIA_KEYS);
    expect(result.criteria).toHaveLength(CRITERIA_KEYS.length);
    expect(result.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recommendations: [],
          recommendation_status: "no_recommendation_warranted",
          recommendation_status_rationale: expect.stringMatching(/\S.{18,}\S/),
        }),
      ]),
    );
  });

  test("derives recommendation_provided for a meaningful non-empty recommendation", () => {
    const result = makeCurrentProcessorEvaluationResult({
      criteria: [
        {
          key: "concept",
          recommendations: [
            {
              priority: "high",
              action: "Clarify the governing dramatic question in the opening scene.",
              expected_impact: "Readers understand the story promise immediately.",
            },
          ],
        },
      ],
    });

    expect(result.criteria.find((criterion) => criterion.key === "concept")).toEqual(
      expect.objectContaining({
        recommendation_status: "recommendation_provided",
        recommendations: expect.arrayContaining([
          expect.objectContaining({ action: expect.stringContaining("dramatic question") }),
        ]),
      }),
    );
  });

  test("rejects an explicit status that contradicts recommendation cardinality", () => {
    expect(() =>
      makeCurrentProcessorEvaluationResult({
        criteria: [
          {
            key: "concept",
            recommendations: [],
            recommendation_status: "recommendation_provided",
          },
        ],
      }),
    ).toThrow("Current-write recommendation disposition is structurally invalid.");
  });

  test("rejects duplicate criterion overrides instead of applying order-based authority", () => {
    expect(() =>
      makeCurrentProcessorEvaluationResult({
        criteria: [{ key: "concept" }, { key: "concept" }],
      }),
    ).toThrow("Duplicate processor fixture criterion override: concept");
  });
});
