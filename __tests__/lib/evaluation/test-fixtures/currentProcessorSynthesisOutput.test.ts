import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { CurrentSynthesisOutput } from "@/lib/evaluation/pipeline/types";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import {
  buildProcessorSynthesisManuscriptContent,
  buildProcessorSynthesisRecommendations,
  makeCurrentProcessorSynthesisOutput,
} from "./currentProcessorSynthesisOutput";

describe("makeCurrentProcessorSynthesisOutput", () => {
  test("creates complete strict current-write synthesis authority by construction", () => {
    const result: CurrentSynthesisOutput = makeCurrentProcessorSynthesisOutput();

    expect(result.criteria.map((criterion) => criterion.key)).toEqual(CRITERIA_KEYS);
    expect(result.criteria).toHaveLength(CRITERIA_KEYS.length);
    expect(result.criteria.every((criterion) => criterion.recommendations.length === 0)).toBe(true);
    expect(
      result.criteria.every(
        (criterion) => criterion.recommendation_status === "no_recommendation_warranted",
      ),
    ).toBe(true);
  });

  test("derives recommendation_provided when a bounded override adds canonical recommendations", () => {
    const result = makeCurrentProcessorSynthesisOutput({
      criteria: [
        {
          key: "concept",
          recommendations: buildProcessorSynthesisRecommendations("concept"),
        },
      ],
    });

    expect(result.criteria.find((criterion) => criterion.key === "concept")).toEqual(
      expect.objectContaining({
        recommendation_status: "recommendation_provided",
        recommendations: expect.arrayContaining([
          expect.objectContaining({ action: expect.stringContaining("premise") }),
        ]),
      }),
    );
  });

  test("re-derives a governed empty disposition after a bounded cardinality mutation", () => {
    const result = makeCurrentProcessorSynthesisOutput({
      mutateCriterion: (criterion) =>
        criterion.key === "theme"
          ? {
              recommendations: [],
              final_rationale:
                "Theme remains scorable, while this fixture intentionally abstains from prescribing an unsafe revision.",
            }
          : undefined,
    });

    expect(result.criteria.find((criterion) => criterion.key === "theme")).toEqual(
      expect.objectContaining({
        recommendations: [],
        recommendation_status: "no_recommendation_warranted",
        recommendation_status_rationale: expect.stringMatching(/no supported revision recommendation/),
      }),
    );
  });

  test("rejects an explicit disposition that contradicts recommendation cardinality", () => {
    expect(() =>
      makeCurrentProcessorSynthesisOutput({
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
      makeCurrentProcessorSynthesisOutput({
        criteria: [{ key: "concept" }, { key: "concept" }],
      }),
    ).toThrow("Duplicate processor synthesis fixture criterion override: concept");
  });

  test("survives the real synthesis-to-current-evaluation projection without disposition drift", () => {
    const manuscriptText = buildProcessorSynthesisManuscriptContent();
    const result = synthesisToEvaluationResultV2({
      synthesis: makeCurrentProcessorSynthesisOutput(),
      ids: {
        evaluation_run_id: "run-synthesis-fixture-contract",
        manuscript_id: 789,
        user_id: "00000000-0000-0000-0000-000000000002",
      },
      manuscriptText,
      sourceText: manuscriptText,
      llmEnrichment: {
        premise: "A fixture proves strict disposition continuity through the real projection.",
        diagnosed_genre: "literary fiction",
        target_audience: "Adult readers of character-driven literary fiction.",
      },
    });

    expect(result.criteria).toHaveLength(CRITERIA_KEYS.length);
    expect(
      result.criteria.every(
        (criterion) =>
          criterion.recommendations.length === 0
          && criterion.recommendation_status === "no_recommendation_warranted",
      ),
    ).toBe(true);
  });
});
