import { describe, expect, it } from "@jest/globals";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { buildCurrentRawPass3Json } from "@/tests/evaluation/pipeline/test-fixtures/currentPass3Response";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { buildRecommendationSourceIdentities } from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

function makePassOutput(pass: 1 | 2, recommendationsByKey: Partial<Record<CriterionKey, object>> = {}): SinglePassOutput {
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
      recommendations: recommendationsByKey[key] ? [recommendationsByKey[key]] : [],
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
      parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true)
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

    const result = parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true);
    expect(result.recommendation_lineage).toHaveLength(1);
    const narrativeDrive = result.criteria.find((c) => c.key === "narrativeDrive");
    expect(narrativeDrive!.recommendations[0].source_recommendation_ids).toEqual([
      narrativeDriveSourceId,
    ]);
  });
});
