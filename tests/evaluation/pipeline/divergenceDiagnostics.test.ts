import { describe, expect, it } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { buildComparisonPacket } from "@/lib/evaluation/pipeline/comparisonPacket";
import {
  buildDivergenceDiagnosticArtifact,
  derivePass3CriteriaCountByStateFromRawResponse,
} from "@/lib/evaluation/pipeline/divergenceDiagnostics";
import type { SinglePassOutput, Pass3CriteriaCountByState } from "@/lib/evaluation/pipeline/types";

function makePass(pass: 1 | 2, axis: "craft_execution" | "editorial_literary"): SinglePassOutput {
  return {
    pass,
    axis,
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `${axis} rationale for ${key}. This rationale is deterministic and test-stable for overlap checks.`,
      evidence: [{ snippet: `Evidence for ${key}.`, char_start: 10, char_end: 40 }],
      recommendations: [],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

describe("buildDivergenceDiagnosticArtifact", () => {
  it("returns divergence_collapse_detected=false when agreement is preserved", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");
    const comparisonPacket = buildComparisonPacket(pass1, pass2, { manuscriptText: "abc".repeat(200) });

    const postSynthesisCounts: Pass3CriteriaCountByState = {
      agree: CRITERIA_KEYS.length,
      soft_divergence: 0,
      hard_divergence: 0,
      missing_or_invalid: 0,
    };

    const artifact = buildDivergenceDiagnosticArtifact({
      pass1,
      pass2,
      comparisonPacket,
      manuscriptText: "abc".repeat(200),
      comparisonPacketChars: 300,
      pass3CriteriaCountByState: postSynthesisCounts,
    });

    expect(artifact.divergence_collapse_detected).toBe(false);
    expect(artifact.pass3_criteria_count_by_state).toEqual(postSynthesisCounts);
  });

  it("preserves mixed pre-synthesis states keyed by canonical criterion key", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    pass1.criteria.find((c) => c.key === "concept")!.score_0_10 = 9;
    pass2.criteria.find((c) => c.key === "concept")!.score_0_10 = 7; // soft
    pass1.criteria.find((c) => c.key === "voice")!.score_0_10 = 10;
    pass2.criteria.find((c) => c.key === "voice")!.score_0_10 = 5; // hard

    const comparisonPacket = buildComparisonPacket(pass1, pass2, { manuscriptText: "x".repeat(1000) });

    const artifact = buildDivergenceDiagnosticArtifact({
      pass1,
      pass2,
      comparisonPacket,
      manuscriptText: "x".repeat(1000),
      comparisonPacketChars: 200,
      pass3CriteriaCountByState: comparisonPacket.criteria_count_by_state,
    });

    expect(artifact.pass1_pass2_criterion_state_pre_synthesis.concept.apparent_state).toBe("soft_divergence");
    expect(artifact.pass1_pass2_criterion_state_pre_synthesis.voice.apparent_state).toBe("hard_divergence");
    expect(
      artifact.pass1_pass2_criterion_state_pre_synthesis.concept.raw_rationale_overlap_count,
    ).toEqual(expect.any(Number));
    expect(Object.keys(artifact.pass1_pass2_criterion_state_pre_synthesis)).toEqual(CRITERIA_KEYS);
  });

  it("detects collapse when pre-synthesis divergence exists but post-synthesis counts are all agree", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");

    pass1.criteria.find((c) => c.key === "character")!.score_0_10 = 9;
    pass2.criteria.find((c) => c.key === "character")!.score_0_10 = 6; // divergence pre-synthesis

    const comparisonPacket = buildComparisonPacket(pass1, pass2, { manuscriptText: "z".repeat(900) });

    const postSynthesisAllAgree: Pass3CriteriaCountByState = {
      agree: CRITERIA_KEYS.length,
      soft_divergence: 0,
      hard_divergence: 0,
      missing_or_invalid: 0,
    };

    const artifact = buildDivergenceDiagnosticArtifact({
      pass1,
      pass2,
      comparisonPacket,
      manuscriptText: "z".repeat(900),
      comparisonPacketChars: 450,
      pass3CriteriaCountByState: postSynthesisAllAgree,
    });

    expect(comparisonPacket.criteria_count_by_state.soft_divergence + comparisonPacket.criteria_count_by_state.hard_divergence).toBeGreaterThan(0);
    expect(artifact.pass3_criteria_count_by_state).toEqual(postSynthesisAllAgree);
    expect(artifact.divergence_collapse_detected).toBe(true);
  });

  it("computes retained ratio deterministically and handles zero-length manuscript", () => {
    const pass1 = makePass(1, "craft_execution");
    const pass2 = makePass(2, "editorial_literary");
    const comparisonPacket = buildComparisonPacket(pass1, pass2, { manuscriptText: "abcd".repeat(100) });

    const artifact = buildDivergenceDiagnosticArtifact({
      pass1,
      pass2,
      comparisonPacket,
      manuscriptText: "abcd".repeat(100),
      comparisonPacketChars: 160,
      pass3CriteriaCountByState: comparisonPacket.criteria_count_by_state,
    });

    expect(artifact.comparison_packet_retained_ratio).toBe(0.4);

    const zeroLength = buildDivergenceDiagnosticArtifact({
      pass1,
      pass2,
      comparisonPacket,
      manuscriptText: "",
      comparisonPacketChars: 160,
      pass3CriteriaCountByState: comparisonPacket.criteria_count_by_state,
    });

    expect(zeroLength.comparison_packet_retained_ratio).toBe(0);
  });

  it("derives post-synthesis criterion counts from raw pass3 response deterministically", () => {
    const rawResponseText = JSON.stringify({
      criteria: [
        { key: "concept", craft_score: 7, editorial_score: 7 },
        { key: "voice", craft_score: 8, editorial_score: 6 },
        { key: "dialogue", craft_score: 9, editorial_score: 4 },
        { key: "tone", craft_score: null, editorial_score: 6 },
      ],
    });

    const counts = derivePass3CriteriaCountByStateFromRawResponse({
      rawResponseText,
      fallback: { agree: 0, soft_divergence: 0, hard_divergence: 0, missing_or_invalid: 0 },
    });

    expect(counts).toEqual({
      agree: 1,
      soft_divergence: 1,
      hard_divergence: 1,
      missing_or_invalid: 1,
    });
  });
});
