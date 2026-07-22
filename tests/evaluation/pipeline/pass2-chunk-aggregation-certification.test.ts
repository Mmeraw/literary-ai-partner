import replayOutput from "@/tests/fixtures/gate-replay/ch11b_pass/pass2_parsed.json";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  aggregateSelectedPass2ChunkResults,
  type IndexedPass2ChunkResult,
} from "@/lib/evaluation/pipeline/runPass2";
import { PASS2_PROMPT_VERSION } from "@/lib/evaluation/pipeline/prompts/pass2-editorial";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

/**
 * The checked-in CH11B gate replay is a real full Pass 2 provider artifact
 * from the canonical replay corpus. Adapt only its versioned disposition
 * metadata so the historical payload can exercise today's contract; its
 * scores, rationales, evidence, and recommendations remain unchanged.
 */
function currentReplay(chunkLabel: string): SinglePassOutput {
  return {
    ...structuredClone(replayOutput),
    pass: 2,
    axis: "editorial_literary",
    prompt_version: PASS2_PROMPT_VERSION,
    criteria: replayOutput.criteria.map((criterion) => ({
      ...criterion,
      evidence: criterion.evidence.map((evidence) => ({ ...evidence })),
      recommendations: criterion.recommendations.map((recommendation) => ({
        ...recommendation,
        anchor_snippet: `${recommendation.anchor_snippet} [${chunkLabel}]`,
      })),
      recommendation_status: "recommendation_provided" as const,
    })),
  } as SinglePassOutput;
}

function indexed(chunkIndex: number, output = currentReplay(`chunk-${chunkIndex}`)): IndexedPass2ChunkResult {
  return { chunk_index: chunkIndex, result: output };
}

describe("Pass 2 selected-chunk aggregation certification", () => {
  test("a canonical full-output replay proves exact selected-chunk coverage and lossless recommendation aggregation", () => {
    const first = currentReplay("selected-7");
    const second = currentReplay("selected-19");
    const before = JSON.stringify([first, second]);

    const aggregate = aggregateSelectedPass2ChunkResults(
      [7, 19],
      [indexed(19, second), indexed(7, first)],
    );

    expect(aggregate.criteria.map((criterion) => criterion.key)).toEqual(CRITERIA_KEYS);
    for (const criterion of aggregate.criteria) {
      const sourceFirst = first.criteria.find((candidate) => candidate.key === criterion.key)!;
      const sourceSecond = second.criteria.find((candidate) => candidate.key === criterion.key)!;
      expect(criterion.recommendations.map((recommendation) => recommendation.anchor_snippet)).toEqual([
        sourceFirst.recommendations[0].anchor_snippet,
        sourceSecond.recommendations[0].anchor_snippet,
      ]);
      expect(criterion.recommendation_status).toBe("recommendation_provided");
    }
    expect(JSON.stringify([first, second])).toBe(before);
  });

  test.each([
    {
      name: "missing selected result",
      selected: [4, 8],
      results: [indexed(4)],
      diagnostic: /"missing_result_chunks":\[8\]/,
    },
    {
      name: "duplicated result identity",
      selected: [4, 8],
      results: [indexed(4), indexed(4)],
      diagnostic: /"duplicate_result_chunks":\[4\]/,
    },
    {
      name: "unselected result identity",
      selected: [4, 8],
      results: [indexed(4), indexed(99)],
      diagnostic: /"unexpected_result_chunks":\[99\]/,
    },
    {
      name: "duplicated selected identity",
      selected: [4, 4],
      results: [indexed(4), indexed(4)],
      diagnostic: /"duplicate_selected_chunks":\[4\]/,
    },
  ])("fails closed for $name", ({ selected, results, diagnostic }) => {
    expect(() => aggregateSelectedPass2ChunkResults(selected, results)).toThrow(
      /PASS2_CHUNK_COVERAGE_INVALID/,
    );
    expect(() => aggregateSelectedPass2ChunkResults(selected, results)).toThrow(diagnostic);
  });

  test("a real full replay still fails closed when chunk-level governed dispositions conflict", () => {
    const first = currentReplay("conflict-a");
    const second = currentReplay("conflict-b");
    first.criteria[0] = {
      ...first.criteria[0],
      recommendations: [],
      recommendation_status: "insufficient_evidence",
      recommendation_status_rationale: "This selected chunk lacks sufficient intervention evidence.",
    };
    second.criteria[0] = {
      ...second.criteria[0],
      recommendations: [],
      recommendation_status: "no_recommendation_warranted",
      recommendation_status_rationale: "This selected chunk warrants no distinct intervention.",
    };

    expect(() =>
      aggregateSelectedPass2ChunkResults([1, 2], [indexed(1, first), indexed(2, second)]),
    ).toThrow(/PASS2_CHUNK_AGGREGATE_DISPOSITION_CONFLICT/);
  });
});
