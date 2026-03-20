/**
 * Phase 2.7 — End-to-End Pipeline Tests
 *
 * Exercises the full 4-pass pipeline with injected runner functions (no jest.mock).
 * Validates the PipelineResult discriminated union and synthesisToEvaluationResult adapter.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import { runPipeline, synthesisToEvaluationResult } from "@/lib/evaluation/pipeline/runPipeline";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import type { SinglePassOutput, SynthesisOutput, QualityGateResult } from "@/lib/evaluation/pipeline/types";
import type { RunPass1Options } from "@/lib/evaluation/pipeline/runPass1";
import type { RunPass2Options } from "@/lib/evaluation/pipeline/runPass2";
import type { RunPass3Options } from "@/lib/evaluation/pipeline/runPass3Synthesis";

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeSinglePassOutput(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: `Pass ${pass} analysis of ${key}: the manuscript demonstrates solid craft.`,
      evidence: [{ snippet: "The river moved slowly through the valley." }],
      recommendations: [
        {
          priority: "medium",
          action: `Strengthen the ${key} dimension with more targeted evidence from the manuscript text.`,
          expected_impact: "Increases specificity and reader connection.",
          anchor_snippet: '"slowly"',
        },
      ],
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
      editorial_score: 6,
      final_score_0_10: 7,
      score_delta: 1,
      final_rationale: `Synthesized analysis for ${key}: craft and editorial perspectives converge.`,
      evidence: [{ snippet: "The river moved slowly through the valley." }],
      recommendations: [
        {
          priority: "medium",
          action: `Refine the ${key} dimension to bring craft and editorial perspectives into alignment.`,
          expected_impact: "Elevates overall evaluation quality.",
          anchor_snippet: '"slowly"',
          source_pass: 3 as const,
        },
      ],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary:
        "This manuscript demonstrates solid craft and distinctive literary sensibility, requiring targeted revision before submission.",
      top_3_strengths: ["Strong narrative voice", "Clear structural arc", "Vivid sensory imagery"],
      top_3_risks: ["Pacing inconsistencies in act two", "Thin supporting character motivation", "World-building gaps"],
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
      generated_at: new Date().toISOString(),
    },
  };
}

function makeTruncatedSynthesisOutput(): SynthesisOutput {
  const full = makeSynthesisOutput();
  return {
    ...full,
    // Only 5 criteria instead of 13 — quality gate should catch this
    criteria: full.criteria.slice(0, 5),
    overall: {
      overall_score_0_100: 50,
      verdict: "revise",
      one_paragraph_summary: "Partial output.",
      top_3_strengths: [],
      top_3_risks: [],
    },
  };
}

// ── Mock runners ──────────────────────────────────────────────────────────────

let mockRunPass1: jest.Mock<(opts: RunPass1Options) => Promise<SinglePassOutput>>;
let mockRunPass2: jest.Mock<(opts: RunPass2Options) => Promise<SinglePassOutput>>;
let mockRunPass3: jest.Mock<(opts: RunPass3Options) => Promise<SynthesisOutput>>;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runPipeline (e2e with injected runners)", () => {
  beforeEach(() => {
    mockRunPass1 = jest.fn<(opts: RunPass1Options) => Promise<SinglePassOutput>>();
    mockRunPass2 = jest.fn<(opts: RunPass2Options) => Promise<SinglePassOutput>>();
    mockRunPass3 = jest.fn<(opts: RunPass3Options) => Promise<SynthesisOutput>>();

    mockRunPass1.mockResolvedValue(makeSinglePassOutput(1));
    mockRunPass2.mockResolvedValue(makeSinglePassOutput(2));
    mockRunPass3.mockResolvedValue(makeSynthesisOutput());
  });

  it("returns ok=true with synthesis and quality_gate on success", async () => {
    const result = await runPipeline({
      manuscriptText: "The river moved slowly through the valley. She watched from the bank.",
      workType: "literary_fiction",
      title: "The Valley",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.synthesis.criteria).toHaveLength(13);
      expect(result.synthesis.overall.overall_score_0_100).toBe(70);
      expect(result.quality_gate.pass).toBe(true);
    }
  });

  it("returns ok=false with PASS1_FAILED when Pass 1 throws", async () => {
    mockRunPass1.mockRejectedValueOnce(new Error("OpenAI network error"));

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("PASS1_FAILED");
      expect(result.failed_at).toBe("pass1");
      expect(result.error).toContain("OpenAI network error");
    }
  });

  it("returns ok=false with PASS2_FAILED when Pass 2 throws", async () => {
    mockRunPass2.mockRejectedValueOnce(new Error("Rate limit exceeded"));

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("PASS2_FAILED");
      expect(result.failed_at).toBe("pass2");
    }
  });

  it("returns ok=false with PASS3_FAILED when Pass 3 throws", async () => {
    mockRunPass3.mockRejectedValueOnce(new Error("Context length exceeded"));

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("PASS3_FAILED");
      expect(result.failed_at).toBe("pass3");
    }
  });

  it("returns ok=false with quality gate error code when QG rejects output", async () => {
    mockRunPass3.mockResolvedValueOnce(makeTruncatedSynthesisOutput());

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("QG_CRITERIA_MISSING");
      expect(result.failed_at).toBe("pass4");
    }
  });

  it("Pass 1 failure prevents Pass 2 and Pass 3 from running", async () => {
    mockRunPass1.mockRejectedValueOnce(new Error("fail"));

    await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(mockRunPass2).not.toHaveBeenCalled();
    expect(mockRunPass3).not.toHaveBeenCalled();
  });
});

describe("synthesisToEvaluationResult", () => {
  it("maps SynthesisOutput to EvaluationResultV1 shape", () => {
    const synthesis: SynthesisOutput = {
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        craft_score: 7,
        editorial_score: 6,
        final_score_0_10: 7,
        score_delta: 1,
        final_rationale: `Rationale for ${key}.`,
        evidence: [{ snippet: "The river moved slowly." }],
        recommendations: [
          {
            priority: "high" as const,
            action: `High priority: improve ${key} by grounding in specific textual moments.`,
            expected_impact: "Significant improvement.",
            anchor_snippet: '"slowly"',
            source_pass: 1 as const,
          },
          {
            priority: "medium" as const,
            action: `Medium priority: continue developing ${key} throughout the manuscript.`,
            expected_impact: "Incremental improvement.",
            anchor_snippet: '"moved"',
            source_pass: 2 as const,
          },
        ],
      })),
      overall: {
        overall_score_0_100: 70,
        verdict: "revise" as const,
        one_paragraph_summary: "Strong manuscript with clear revision needs.",
        top_3_strengths: ["Voice", "Arc", "Imagery"],
        top_3_risks: ["Pacing", "Characters", "World-building"],
      },
      metadata: {
        pass1_model: "gpt-4o-mini",
        pass2_model: "gpt-4o-mini",
        pass3_model: "gpt-4o-mini",
        generated_at: new Date().toISOString(),
      },
    };

    const result = synthesisToEvaluationResult({
      synthesis,
      ids: {
        evaluation_run_id: "run-test-123",
        manuscript_id: 42,
        user_id: "user-abc",
      },
    });

    expect(result.schema_version).toBe("evaluation_result_v1");
    expect(result.overview.overall_score_0_100).toBe(70);
    expect(result.criteria).toHaveLength(13);
    expect(result.recommendations.quick_wins.length).toBeGreaterThan(0);
    expect(result.recommendations.strategic_revisions.length).toBeGreaterThan(0);
    expect(result.governance.policy_family).toBe("multi-pass-dual-axis");
    expect(result.ids.evaluation_run_id).toBe("run-test-123");
    expect(result.ids.manuscript_id).toBe(42);
  });
});
