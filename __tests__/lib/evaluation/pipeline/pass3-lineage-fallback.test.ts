import { describe, expect, it } from "@jest/globals";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { buildCurrentRawPass3Json } from "@/tests/evaluation/pipeline/test-fixtures/currentPass3Response";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import { buildRecommendationSourceIdentities } from "@/lib/evaluation/policy/opportunityDiscoveryPolicy";
import type { SinglePassOutput } from "@/lib/evaluation/pipeline/types";

function makePassOutput(pass: 1 | 2, recommendationsByKey: Partial<Record<CriterionKey, object | object[]>> = {}): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    model: "gpt-4o",
    prompt_version: `pass${pass}-v1`,
    temperature: 0.2,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key) => {
      const raw = recommendationsByKey[key];
      const recommendations = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
      return {
        key,
        score_0_10: 7,
        rationale: `Rationale for ${key} from pass ${pass}.`,
        evidence: [{ snippet: `Evidence for ${key} in the manuscript.` }],
        recommendations,
        ...(pass === 2
          ? {
              recommendation_status: recommendations.length > 0
                ? ("recommendation_provided" as const)
                : ("no_recommendation_warranted" as const),
              recommendation_status_rationale: recommendations.length > 0
                ? undefined
                : `Pass 2 did not surface a separate safe recommendation for ${key}.`,
            }
          : {}),
      };
    }),
  };
}

// Canonical values accepted by the production schemas and normalizers.
const canonicalIssueFamily = "pacing";
const canonicalStrategicLever = "momentum_visibility";

const pass2NarrativeDriveRec = {
  priority: "medium" as const,
  action: "Condense the exposition in the dialogue to maintain a brisker pace.",
  expected_impact: "This will enhance engagement and keep the reader's interest high.",
  anchor_snippet: "Calvin said, 'So, you didn't have me fly here business class...'",
  issue_family: canonicalIssueFamily,
  strategic_lever: canonicalStrategicLever,
  revision_granularity: "scene" as const,
};

const pass3NarrativeDriveRec = {
  priority: "medium" as const,
  action: "Condense the exposition in the dialogue to maintain a brisker pace.",
  expected_impact: "This will enhance engagement and keep the reader's interest high.",
  anchor_snippet: "Calvin said, 'So, you didn't have me fly here business class...'",
  source_pass: 3 as const,
  issue_family: canonicalIssueFamily,
  strategic_lever: canonicalStrategicLever,
  revision_granularity: "scene" as const,
  mechanism: "the exposition stalls momentum before the negotiation turn",
  specific_fix: "condense the exposition in the dialogue",
  reader_effect: "keeps the reader's interest high through a brisker pace",
};

function sourceId(criterion: CriterionKey, recommendation: object): string {
  const [identity] = buildRecommendationSourceIdentities([{ ...recommendation, criterion }]);
  return identity.source_id;
}

function buildRawPass3Partial(overrides: { criteria?: object[]; recommendation_lineage?: object[] } = {}): string {
  return buildCurrentRawPass3Json({
    criteria: overrides.criteria ?? [
      {
        key: "narrativeDrive",
        craft_score: 6,
        editorial_score: 7,
        final_score_0_10: 7,
        final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
        evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
        recommendations: [pass3NarrativeDriveRec],
      },
    ],
    recommendation_lineage: overrides.recommendation_lineage,
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
}

describe("Pass 3B recommendation lineage fallback", () => {
  const narrativeDriveSourceId = sourceId("narrativeDrive", pass2NarrativeDriveRec);

  it("fallback attaches one exact source to one unprovenanced recommendation", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2NarrativeDriveRec });
    const raw = buildRawPass3Partial();

    const result = parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true);

    const narrativeDrive = result.criteria.find((c) => c.key === "narrativeDrive");
    const rec = narrativeDrive!.recommendations[0];
    expect(rec.source_recommendation_ids).toEqual([narrativeDriveSourceId]);
    expect(result.recommendation_lineage).toHaveLength(1);
    expect(result.recommendation_lineage![0]).toMatchObject({
      source_id: narrativeDriveSourceId,
      outcome: "materialized",
    });
  });

  it("fails closed when two sources compete for one recommendation", () => {
    const secondPass2Rec = {
      ...pass2NarrativeDriveRec,
      action: "Add a sharper transition so the negotiation turn lands.",
      anchor_snippet: "Monty leaned back and said nothing.",
      expected_impact: "This will clarify the chapter-level decision and keep momentum high.",
    };

    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, {
      narrativeDrive: [pass2NarrativeDriveRec, secondPass2Rec],
    });
    const raw = buildRawPass3Partial();

    expect(() =>
      parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true)
    ).toThrow("Pass 3 did not account for every Pass 2 recommendation discovery");
  });

  it("fails closed when one source matches two recommendations", () => {
    // Both recommendations share the same canonical issue_family and strategic_lever
    // and both match the Pass 2 source, but they differ in revision_granularity
    // so production cross-criterion deduplication does not collapse them.
    const ambiguousRecA = { ...pass3NarrativeDriveRec, revision_granularity: "scene" as const };
    const ambiguousRecB = { ...pass3NarrativeDriveRec, revision_granularity: "beat" as const };

    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2NarrativeDriveRec });
    const raw = buildRawPass3Partial({
      criteria: [
        {
          key: "narrativeDrive",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [ambiguousRecA, ambiguousRecB],
        },
      ],
    });

    let resultOrError: any;
    try {
      resultOrError = parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true);
      const nd = resultOrError.criteria.find((c: any) => c.key === "narrativeDrive")!;
      console.log("AMBIGUITY TEST result:", JSON.stringify({
        recCount: nd.recommendations.length,
        recs: nd.recommendations.map((r: any) => ({ action: r.action.slice(0,40), gran: r.revision_granularity, sourceIds: r.source_recommendation_ids })),
        lineage: resultOrError.recommendation_lineage,
      }, null, 2));
    } catch (e: any) {
      resultOrError = e;
      console.log("AMBIGUITY TEST error:", e.message, JSON.stringify(e.details, null, 2));
    }
    expect(() => { throw resultOrError; }).toThrow("Pass 3 did not account for every Pass 2 recommendation discovery");
  });

  it("fails closed when a source has no strong enough match", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2NarrativeDriveRec });

    const weakRec = {
      ...pass3NarrativeDriveRec,
      action: "Improve overall quality.",
      anchor_snippet: "",
      mechanism: "the quality is weak",
      specific_fix: "improve overall quality",
      reader_effect: "better overall",
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
          recommendations: [weakRec],
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

  it("attaches one-to-one when two sources have two unique reciprocal matches", () => {
    const secondIssueFamily = "exposition" as const;
    const secondStrategicLever = "exposition_load_reduction" as const;

    const secondPass2Rec = {
      priority: "medium" as const,
      action: "Trim the opening travelogue so the airport turn lands faster.",
      expected_impact: "This will keep the opening pace brisk and the reader oriented.",
      anchor_snippet: "The flight from New York had been long and uneventful.",
      issue_family: secondIssueFamily,
      strategic_lever: secondStrategicLever,
      revision_granularity: "scene" as const,
    };
    const secondPass3Rec = {
      priority: "medium" as const,
      action: "Trim the opening travelogue so the airport turn lands faster.",
      expected_impact: "This will keep the opening pace brisk and the reader oriented.",
      anchor_snippet: "The flight from New York had been long and uneventful.",
      source_pass: 3 as const,
      issue_family: secondIssueFamily,
      strategic_lever: secondStrategicLever,
      revision_granularity: "scene" as const,
      mechanism: "the travelogue delays the narrative turn",
      specific_fix: "trim the opening travelogue",
      reader_effect: "keeps the opening pace brisk",
    };

    const sourceA = sourceId("narrativeDrive", pass2NarrativeDriveRec);
    const sourceB = sourceId("narrativeDrive", secondPass2Rec);

    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, {
      narrativeDrive: [pass2NarrativeDriveRec, secondPass2Rec],
    });

    const raw = buildRawPass3Partial({
      criteria: [
        {
          key: "narrativeDrive",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [pass3NarrativeDriveRec, secondPass3Rec],
        },
      ],
    });

    let result: any;
    try {
      result = parsePass3Response(raw, pass1, pass2, "gpt-4o", "A manuscript excerpt.", undefined, undefined, true);
      const nd = result.criteria.find((c: any) => c.key === "narrativeDrive")!;
      console.log("ONE-TO-ONE TEST result:", JSON.stringify({
        recCount: nd.recommendations.length,
        recs: nd.recommendations.map((r: any) => ({ action: r.action.slice(0,40), issue: r.issue_family, lever: r.strategic_lever, gran: r.revision_granularity, sourceIds: r.source_recommendation_ids })),
        lineage: result.recommendation_lineage,
      }, null, 2));
    } catch (e: any) {
      console.log("ONE-TO-ONE TEST error:", e.message, JSON.stringify(e.details, null, 2));
      throw e;
    }
    const narrativeDrive = result.criteria.find((c: any) => c.key === "narrativeDrive")!;
    const recA = narrativeDrive.recommendations[0];
    const recB = narrativeDrive.recommendations[1];

    // Pre-match candidate graph implied by the one-to-one assignment:
    // source A is only eligible for recommendation A and vice-versa,
    // source B is only eligible for recommendation B and vice-versa.
    expect(recA.source_recommendation_ids).toEqual([sourceA]);
    expect(recB.source_recommendation_ids).toEqual([sourceB]);
    expect(result.recommendation_lineage).toHaveLength(2);
    expect(new Set(result.recommendation_lineage!.map((o: any) => o.source_id))).toEqual(new Set([sourceA, sourceB]));
  });

  it("does not alter a recommendation that already has native lineage", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2NarrativeDriveRec });

    const nativeRec = { ...pass3NarrativeDriveRec, source_recommendation_ids: [narrativeDriveSourceId] };
    const raw = buildCurrentRawPass3Json({
      criteria: [
        {
          key: "narrativeDrive",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [nativeRec],
        },
      ],
      recommendation_lineage: [
        {
          source_id: narrativeDriveSourceId,
          outcome: "materialized",
          canonical_opportunity_id: "REC-native-1",
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
    const rec = result.criteria.find((c) => c.key === "narrativeDrive")!.recommendations[0];
    expect(rec.source_recommendation_ids).toEqual([narrativeDriveSourceId]);
    expect(result.recommendation_lineage).toHaveLength(1);
    expect(result.recommendation_lineage![0].canonical_opportunity_id).toBe("REC-native-1");
  });

  it("does not cross-match a source to a recommendation in another criterion", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2NarrativeDriveRec });

    const crossCriterionRec = {
      ...pass3NarrativeDriveRec,
      issue_family: "voice",
      strategic_lever: "pov_rendering_precision",
    };

    const raw = buildCurrentRawPass3Json({
      criteria: [
        {
          key: "voice",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "Voice is consistent but the focal point drifts.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [crossCriterionRec],
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

  it("accepts an explicit model consolidation when fully governed", () => {
    const secondPass2Rec = {
      ...pass2NarrativeDriveRec,
      action: "Add a sharper transition so the negotiation turn lands.",
      anchor_snippet: "Monty leaned back and said nothing.",
      expected_impact: "This will clarify the chapter-level decision and keep momentum high.",
    };

    const sourceA = sourceId("narrativeDrive", pass2NarrativeDriveRec);
    const sourceB = sourceId("narrativeDrive", secondPass2Rec);

    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, {
      narrativeDrive: [pass2NarrativeDriveRec, secondPass2Rec],
    });

    const raw = buildCurrentRawPass3Json({
      criteria: [
        {
          key: "narrativeDrive",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [{ ...pass3NarrativeDriveRec, source_recommendation_ids: [sourceA, sourceB] }],
        },
      ],
      recommendation_lineage: [
        {
          source_id: sourceA,
          outcome: "materialized",
          canonical_opportunity_id: "REC-merged-1",
        },
        {
          source_id: sourceB,
          outcome: "consolidated",
          consolidated_into_source_id: sourceA,
          canonical_opportunity_id: "REC-merged-1",
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
    const rec = result.criteria.find((c) => c.key === "narrativeDrive")!.recommendations[0];
    expect(rec.source_recommendation_ids).toContain(sourceA);
    expect(rec.source_recommendation_ids).toContain(sourceB);
    expect(result.recommendation_lineage).toHaveLength(2);
    const consolidated = result.recommendation_lineage!.find((o) => o.source_id === sourceB)!;
    expect(consolidated.outcome).toBe("consolidated");
    expect(consolidated.consolidated_into_source_id).toBe(sourceA);
  });

  it("rejects partial native lineage and does not run fallback", () => {
    const pass1 = makePassOutput(1);
    const pass2 = makePassOutput(2, { narrativeDrive: pass2NarrativeDriveRec });

    const raw = buildCurrentRawPass3Json({
      criteria: [
        {
          key: "narrativeDrive",
          craft_score: 6,
          editorial_score: 7,
          final_score_0_10: 7,
          final_rationale: "The narrative drive is clear but the dialogue exposition diffuses momentum.",
          evidence: [{ snippet: "Calvin said, 'So, you didn't have me fly here business class...'" }],
          recommendations: [{ ...pass3NarrativeDriveRec, source_recommendation_ids: [narrativeDriveSourceId] }],
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
});
