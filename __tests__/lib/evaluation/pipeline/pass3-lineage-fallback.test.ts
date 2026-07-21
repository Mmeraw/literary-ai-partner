import { describe, expect, it } from "@jest/globals";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { buildCurrentRawPass3Json } from "@/tests/evaluation/pipeline/test-fixtures/currentPass3Response";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { buildRecommendationSourceIdentities } from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

function makePassOutput(
  pass: 1 | 2,
  recommendationsByKey: Partial<Record<CriterionKey, object | object[]>> = {},
): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    model: "gpt-4o",
    prompt_version: `pass${pass}-v1`,
    temperature: 0.2,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Rationale for ${key} from pass ${pass}.`,
      evidence: [{ snippet: `Evidence for ${key} in the manuscript.` }],
      recommendations: recommendationsByKey[key]
        ? Array.isArray(recommendationsByKey[key])
          ? recommendationsByKey[key]
          : [recommendationsByKey[key]]
        : [],
      ...(pass === 2
        ? {
            recommendation_status: recommendationsByKey[key]
              ? ("recommendation_provided" as const)
              : ("no_recommendation_warranted" as const),
            recommendation_status_rationale: recommendationsByKey[key]
              ? undefined
              : `Pass 2 did not surface a separate safe recommendation for ${key}.`,
          }
        : {}),
    })),
  };
}

const pass2Recommendation = {
  priority: "medium" as const,
  action: "Condense the exposition in the dialogue to maintain a brisker pace.",
  expected_impact: "This will enhance engagement and keep the reader's interest high.",
  anchor_snippet: "Calvin said, 'So, you didn't have me fly here business class...'",
  issue_family: "pacing",
  strategic_lever: "dialogue efficiency",
  revision_granularity: "scene",
};

function sourceIdForPass2Recommendation(criterion: CriterionKey, recommendation: object): string {
  const [identity] = buildRecommendationSourceIdentities([{ ...recommendation, criterion }]);
  return identity.source_id;
}

const narrativeDriveSourceId = sourceIdForPass2Recommendation("narrativeDrive", pass2Recommendation);

const longEnoughManuscriptForMultiRecFixtures = [
  "De Beers gave each sightholder a box...",
  "Cameroon is divided between...",
  "Calvin said, 'So, you didn't have me fly here business class...'",
  "manuscript ".repeat(2500),
].join(" ");

const pass3Recommendation = {
  priority: "medium" as const,
  action: "Condense the exposition in the dialogue to maintain a brisker pace.",
  expected_impact: "This will enhance engagement and keep the reader's interest high.",
  anchor_snippet: "Calvin said, 'So, you didn't have me fly here business class...'",
  source_pass: 3 as const,
  issue_family: "pacing",
  strategic_lever: "dialogue efficiency",
  revision_granularity: "scene",
  mechanism: "the exposition stalls momentum before the negotiation turn",
  specific_fix: "condense the exposition in the dialogue",
  reader_effect: "keeps the reader's interest high through a brisker pace",
};

const montyExpositionPass2 = {
  priority: "medium" as const,
  action: "Condense Monty's explanation of De Beers' sightholder system in the penthouse-bar exchange.",
  expected_impact: "Keeps the revelation of Eurostar's collapse moving toward Monty's cobalt decision.",
  anchor_snippet: "De Beers gave each sightholder a box...",
  issue_family: "exposition",
  strategic_lever: "exposition_load_reduction",
  revision_granularity: "scene",
};

const calvinCameroonPass2 = {
  priority: "medium" as const,
  action: "Shorten Calvin's geopolitical summary of Cameroon before the balcony confrontation.",
  expected_impact: "Returns attention to Calvin's fear about Monty accepting the GeoCam assignment.",
  anchor_snippet: "Cameroon is divided between...",
  issue_family: "exposition",
  strategic_lever: "exposition_load_reduction",
  revision_granularity: "beat",
};

const montyExpositionPass3 = {
  ...montyExpositionPass2,
  source_pass: 3 as const,
  mechanism: "the extended sightholder explanation stalls momentum before Monty's cobalt decision",
  specific_fix: "condense Monty's sightholder explanation to one pressure-bearing exchange",
  reader_effect: "keeps the reader focused on Eurostar's collapse and Monty's decision",
};

const calvinCameroonPass3 = {
  ...calvinCameroonPass2,
  source_pass: 3 as const,
  mechanism: "the geopolitical summary delays Calvin's fear before the balcony confrontation",
  specific_fix: "shorten Calvin's Cameroon summary to the detail that changes Monty's choice",
  reader_effect: "returns attention to Calvin's fear about the GeoCam assignment",
};

function buildRawWithRecommendations(
  recommendationsByKey: Partial<Record<CriterionKey, object[]>>,
  extra: Record<string, unknown> = {},
): string {
  return buildCurrentRawPass3Json({
    criteria: Object.entries(recommendationsByKey).map(([key, recommendations]) => ({
      key: key as CriterionKey,
      craft_score: 6,
      editorial_score: 7,
      final_score_0_10: 7,
      final_rationale: `The ${key} recommendation set is specific and manuscript-grounded.`,
      evidence: [{ snippet: "De Beers gave each sightholder a box..." }],
      recommendations,
    })),
    overall: {
      overall_score_0_100: 72,
      verdict: "revise",
      one_paragraph_summary: "The chapter opens cleanly but needs tighter exposition control.",
      top_3_strengths: ["voice", "concept", "character"],
      top_3_risks: ["pacing", "tone", "dialogue"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "gpt-4o",
      pass3_model: "gpt-4o",
    },
    ...extra,
  });
}

describe("Pass 3B recommendation lineage fallback", () => {
  it("materializes omitted lineage when Pass 3 recommendations clearly match Pass 2 discoveries", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2Recommendation });

    const raw = buildCurrentRawPass3Json({
      criteria: [
        {
          key: "narrativeDrive",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [pass3Recommendation],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "The chapter opens cleanly but bogs down in exposition.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "nearly_ready",
      },
      metadata: {
        pass1_model: "gpt-4o",
        pass2_model: "gpt-4o",
        pass3_model: "gpt-4o",
      },
    });

    const result = parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true);

    const narrativeDrive = result.criteria.find((c) => c.key === "narrativeDrive");
    expect(narrativeDrive?.recommendations).toHaveLength(1);
    const rec = narrativeDrive!.recommendations[0];
    expect(rec.source_recommendation_ids).toHaveLength(1);
    expect(rec.source_recommendation_ids![0]).toBe(narrativeDriveSourceId);
    expect(result.recommendation_lineage).toBeDefined();
    expect(result.recommendation_lineage!.length).toBe(1);
    expect(result.recommendation_lineage![0].outcome).toBe("materialized");
  });

  it("still fails closed when Pass 3 recommendations do not match Pass 2 provenance", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2Recommendation });

    const mismatchedRec = { ...pass3Recommendation, issue_family: "voice", strategic_lever: "pov_rendering_precision" };

    const raw = buildCurrentRawPass3Json({
      criteria: [
        {
          key: "narrativeDrive",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [mismatchedRec],
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "The chapter opens cleanly but bogs down in exposition.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "nearly_ready",
      },
      metadata: {
        pass1_model: "gpt-4o",
        pass2_model: "gpt-4o",
        pass3_model: "gpt-4o",
      },
    });

    expect(() =>
      parsePass3Response(raw, pass1, pass2, "gpt-4o", longEnoughManuscriptForMultiRecFixtures, undefined, undefined, true)
    ).toThrow("Pass 3 did not account for every Pass 2 recommendation discovery");
  });

  it("passes without fallback when the model emits correct recommendation_lineage and source_recommendation_ids", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2Recommendation });

    const recWithLineage = {
      ...pass3Recommendation,
      source_recommendation_ids: [narrativeDriveSourceId],
    };

    const raw = buildCurrentRawPass3Json({
      criteria: [
        {
          key: "narrativeDrive",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [recWithLineage],
        },
      ],
      recommendation_lineage: [
        {
          source_id: narrativeDriveSourceId,
          outcome: "materialized",
          canonical_opportunity_id: "REC-41251dc413e566eaa7ee-1",
        },
      ],
      overall: {
        overall_score_0_100: 72,
        verdict: "revise",
        one_paragraph_summary: "The chapter opens cleanly but bogs down in exposition.",
        top_3_strengths: ["voice", "concept", "character"],
        top_3_risks: ["pacing", "tone", "dialogue"],
        submission_readiness: "nearly_ready",
      },
      metadata: {
        pass1_model: "gpt-4o",
        pass2_model: "gpt-4o",
        pass3_model: "gpt-4o",
      },
    });

    const result = parsePass3Response(raw, pass1, pass2, "gpt-4o", longEnoughManuscriptForMultiRecFixtures, undefined, undefined, true);
    expect(result.recommendation_lineage).toHaveLength(1);
    const narrativeDrive = result.criteria.find((c) => c.key === "narrativeDrive");
    expect(narrativeDrive!.recommendations[0].source_recommendation_ids).toEqual([
      narrativeDriveSourceId,
    ]);
  });

  it("fails closed when two Pass 2 sources compete for one fallback recommendation", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, {
      narrativeDrive: [montyExpositionPass2, calvinCameroonPass2],
    });

    const raw = buildRawWithRecommendations({
      narrativeDrive: [
        {
          ...montyExpositionPass3,
          action: "Condense Monty's explanation of De Beers' sightholder system and shorten Calvin's geopolitical summary of Cameroon before the balcony confrontation.",
          expected_impact: "Keeps Eurostar's collapse and Calvin's fear moving toward Monty's GeoCam decision.",
          anchor_snippet: "De Beers gave each sightholder a box... Cameroon is divided between...",
        },
      ],
    });

    expect(() =>
      parsePass3Response(raw, pass1, pass2, "gpt-4o", longEnoughManuscriptForMultiRecFixtures, undefined, undefined, true)
    ).toThrow("Pass 3 did not account for every Pass 2 recommendation discovery");
  });

  it("fails closed when one Pass 2 source has two viable fallback recommendations", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: montyExpositionPass2 });

    const raw = buildRawWithRecommendations({
      narrativeDrive: [
        montyExpositionPass3,
        {
          ...montyExpositionPass3,
          action: "Compress the penthouse-bar explanation of De Beers' sightholder box before Monty's cobalt decision.",
          specific_fix: "compress the sightholder box explanation in the penthouse-bar exchange",
          revision_granularity: "beat",
        },
      ],
    });

    expect(() =>
      parsePass3Response(raw, pass1, pass2, "gpt-4o", longEnoughManuscriptForMultiRecFixtures, undefined, undefined, true)
    ).toThrow("Pass 3 did not account for every Pass 2 recommendation discovery");
  });

  it("materializes two independent one-to-one fallback matches", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, {
      narrativeDrive: [montyExpositionPass2, calvinCameroonPass2],
    });
    const montySourceId = sourceIdForPass2Recommendation("narrativeDrive", montyExpositionPass2);
    const calvinSourceId = sourceIdForPass2Recommendation("narrativeDrive", calvinCameroonPass2);

    const raw = buildRawWithRecommendations({
      narrativeDrive: [montyExpositionPass3, calvinCameroonPass3],
    });

    const result = parsePass3Response(raw, pass1, pass2, "gpt-4o", longEnoughManuscriptForMultiRecFixtures, undefined, undefined, true);
    const narrativeDrive = result.criteria.find((c) => c.key === "narrativeDrive");
    expect(narrativeDrive!.recommendations).toHaveLength(2);
    const assigned = narrativeDrive!.recommendations.flatMap((rec) => rec.source_recommendation_ids ?? []);
    expect(assigned.sort()).toEqual([calvinSourceId, montySourceId].sort());
    expect(new Set(assigned).size).toBe(2);
    expect(result.recommendation_lineage?.map((outcome) => outcome.source_id).sort()).toEqual(
      [calvinSourceId, montySourceId].sort(),
    );
  });

  it("does not cross-match a source into a different criterion", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { pacing: montyExpositionPass2 });

    const raw = buildRawWithRecommendations({ narrativeDrive: [montyExpositionPass3] });

    expect(() =>
      parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true)
    ).toThrow("Pass 3 did not account for every Pass 2 recommendation discovery");
  });

  it("rejects native source ids without native recommendation_lineage instead of invoking fallback", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: montyExpositionPass2 });
    const montySourceId = sourceIdForPass2Recommendation("narrativeDrive", montyExpositionPass2);

    const raw = buildRawWithRecommendations({
      narrativeDrive: [{ ...montyExpositionPass3, source_recommendation_ids: [montySourceId] }],
    });

    expect(() =>
      parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true)
    ).toThrow("Pass 3 did not account for every Pass 2 recommendation discovery");
  });

  it("rejects present-but-empty native recommendation_lineage instead of invoking fallback", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: montyExpositionPass2 });

    const raw = buildRawWithRecommendations(
      { narrativeDrive: [montyExpositionPass3] },
      { recommendation_lineage: [] },
    );

    expect(() =>
      parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true)
    ).toThrow("Pass 3 did not account for every Pass 2 recommendation discovery");
  });
});
