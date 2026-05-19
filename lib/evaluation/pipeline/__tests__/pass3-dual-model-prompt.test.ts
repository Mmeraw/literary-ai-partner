/**
 * Pass 3 dual-model synthesis prompt — packet-present vs packet-absent branches.
 *
 * Verifies that buildPass3UserPrompt:
 *   1. Injects the DUAL-MODEL block when perplexityChunkPacket is provided.
 *   2. Omits the DUAL-MODEL block when perplexityChunkPacket is undefined
 *      (graceful fallback to GPT-only).
 *   3. Renders per-criterion Perplexity scores in the summary.
 */

import { describe, expect, test } from "@jest/globals";
import { buildPass3UserPrompt } from "../prompts/pass3-synthesis";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { Pass2aStructuredContext, SinglePassOutput } from "../types";

const emptyContext: Pass2aStructuredContext = {
  character_ledger: [],
  scene_index: [],
  timeline_anchors: [],
};

function buildPerplexityPacket(): SinglePassOutput {
  return {
    pass: 1,
    axis: "craft_execution",
    model: "sonar-reasoning-pro",
    prompt_version: "pplx-chunk-scorer-v1",
    temperature: 0.1,
    generated_at: new Date().toISOString(),
    criteria: CRITERIA_KEYS.map((key, i) => ({
      key,
      score_0_10: ((i % 9) + 1),
      rationale: `Independent observation for ${key}.`,
      evidence: [{ snippet: `quote-${key}` }],
      recommendations: [],
    })),
  };
}

describe("buildPass3UserPrompt — dual-model behavior", () => {
  test("omits DUAL-MODEL block when perplexityChunkPacket is undefined (GPT-only fallback)", () => {
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
    });

    expect(prompt).not.toContain("DUAL-MODEL PARALLEL SCORING");
    expect(prompt).not.toContain("PERPLEXITY INDEPENDENT SCORES");
    expect(prompt).not.toContain("sonar-reasoning-pro");
  });

  test("injects DUAL-MODEL block when perplexityChunkPacket is provided", () => {
    const packet = buildPerplexityPacket();
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      perplexityChunkPacket: packet,
    });

    expect(prompt).toContain("DUAL-MODEL PARALLEL SCORING");
    expect(prompt).toContain("PERPLEXITY INDEPENDENT SCORES");
    expect(prompt).toContain("sonar-reasoning-pro");
    // Divergence rule (>1 point) is the contract — must appear verbatim.
    expect(prompt).toContain("diverge by MORE THAN 1 point");
  });

  test("renders one summary line per criterion in the DUAL-MODEL block", () => {
    const packet = buildPerplexityPacket();
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      perplexityChunkPacket: packet,
    });
    for (const key of CRITERIA_KEYS) {
      expect(prompt).toContain(`- ${key}:`);
    }
  });

  test("dualModelMode=false suppresses the block even when packet is present", () => {
    const packet = buildPerplexityPacket();
    const prompt = buildPass3UserPrompt({
      comparisonPacketJson: "{}",
      pass2aStructuredContext: emptyContext,
      manuscriptText: "minimal manuscript text",
      title: "Test",
      perplexityChunkPacket: packet,
      dualModelMode: false,
    });
    expect(prompt).not.toContain("DUAL-MODEL PARALLEL SCORING");
  });
});
