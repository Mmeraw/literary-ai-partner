/**
 * Phase 2.7 — Pipeline Independence Tests (spec §3.2, Non-Negotiable Rule #3)
 *
 * Proves that Pass 2 is NEVER called with Pass 1 output.
 * Mocks runPass1/runPass2/runPass3Synthesis/runQualityGate at the module level
 * to inspect call arguments without hitting OpenAI.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SinglePassOutput, SynthesisOutput, QualityGateResult } from "@/lib/evaluation/pipeline/types";
import type { RunPass1Options } from "@/lib/evaluation/pipeline/runPass1";
import type { RunPass2Options } from "@/lib/evaluation/pipeline/runPass2";

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeSinglePassOutput(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Test rationale for ${key}.`,
      evidence: [],
      recommendations: [],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makeSynthesisOutput(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      score_delta: 0,
      final_rationale: `Synthesized rationale for ${key}.`,
      evidence: [],
      recommendations: [],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary: "Manuscript shows promise and needs targeted revision before submission.",
      top_3_strengths: ["Strong voice", "Clear arc", "Vivid imagery"],
      top_3_risks: ["Pacing", "Motivation", "World-building"],
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
      generated_at: new Date().toISOString(),
    },
  };
}

function makePassingQualityGate(): QualityGateResult {
  return {
    pass: true,
    checks: [{ check_id: "criteria_complete", passed: true }],
    warnings: [],
  };
}

// ── Mock module-level runners ─────────────────────────────────────────────────

const mockRunPass1 = jest.fn<(opts: RunPass1Options) => Promise<SinglePassOutput>>();
const mockRunPass2 = jest.fn<(opts: RunPass2Options) => Promise<SinglePassOutput>>();
const mockRunPass3 = jest.fn<() => Promise<SynthesisOutput>>();
const mockRunQualityGate = jest.fn<() => QualityGateResult>();

jest.mock("@/lib/evaluation/pipeline/runPass1", () => ({
  runPass1: mockRunPass1,
}));
jest.mock("@/lib/evaluation/pipeline/runPass2", () => ({
  runPass2: mockRunPass2,
}));
jest.mock("@/lib/evaluation/pipeline/runPass3Synthesis", () => ({
  runPass3Synthesis: mockRunPass3,
}));
jest.mock("@/lib/evaluation/pipeline/qualityGate", () => ({
  runQualityGate: mockRunQualityGate,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { runPipeline } from "@/lib/evaluation/pipeline/runPipeline";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Pipeline Independence Guarantee (spec §3.2)", () => {
  beforeEach(() => {
    mockRunPass1.mockReset();
    mockRunPass2.mockReset();
    mockRunPass3.mockReset();
    mockRunQualityGate.mockReset();

    mockRunPass1.mockResolvedValue(makeSinglePassOutput(1));
    mockRunPass2.mockResolvedValue(makeSinglePassOutput(2));
    mockRunPass3.mockResolvedValue(makeSynthesisOutput());
    mockRunQualityGate.mockReturnValue(makePassingQualityGate());
  });

  it("runPass2 is never called with Pass 1 output in its options", async () => {
    const pass1Output = makeSinglePassOutput(1);
    mockRunPass1.mockResolvedValueOnce(pass1Output);

    await runPipeline({
      manuscriptText: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "Independence Test",
      openaiApiKey: "sk-test",
    });

    expect(mockRunPass2).toHaveBeenCalledTimes(1);
    const pass2CallArg = mockRunPass2.mock.calls[0][0];

    // Pass 2 options must NOT contain any reference to Pass 1 output
    expect((pass2CallArg as Record<string, unknown>)["pass1"]).toBeUndefined();
    expect((pass2CallArg as Record<string, unknown>)["pass1Output"]).toBeUndefined();
    expect((pass2CallArg as Record<string, unknown>)["criteria"]).toBeUndefined();

    // Pass 2 receives only manuscript context
    expect(pass2CallArg.manuscriptText).toBe("The river moved slowly through the valley.");
    expect(pass2CallArg.workType).toBe("literary_fiction");
    expect(pass2CallArg.title).toBe("Independence Test");
  });

  it("Pass 1 output IS passed to Pass 3 (required for synthesis)", async () => {
    const pass1Output = makeSinglePassOutput(1);
    const pass2Output = makeSinglePassOutput(2);
    mockRunPass1.mockResolvedValueOnce(pass1Output);
    mockRunPass2.mockResolvedValueOnce(pass2Output);

    await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    expect(mockRunPass3).toHaveBeenCalledTimes(1);
    const pass3CallArg = mockRunPass3.mock.calls[0][0] as Record<string, unknown>;
    // Pass 3 should receive pass1 and pass2
    expect(pass3CallArg["pass1"]).toBeDefined();
    expect(pass3CallArg["pass2"]).toBeDefined();
  });

  it("fails closed when Pass 1 throws — Pass 2 is never called", async () => {
    mockRunPass1.mockRejectedValueOnce(new Error("Pass 1 OpenAI error"));

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("PASS1_FAILED");
      expect(result.failed_at).toBe("pass1");
    }
    expect(mockRunPass2).not.toHaveBeenCalled();
    expect(mockRunPass3).not.toHaveBeenCalled();
  });

  it("fails closed when Pass 2 throws — Pass 3 is never called", async () => {
    mockRunPass2.mockRejectedValueOnce(new Error("Pass 2 OpenAI error"));

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("PASS2_FAILED");
      expect(result.failed_at).toBe("pass2");
    }
    expect(mockRunPass3).not.toHaveBeenCalled();
  });
});
