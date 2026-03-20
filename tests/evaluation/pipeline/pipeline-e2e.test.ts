/**
 * Phase 2.7 — End-to-End Pipeline Tests
 *
 * Exercises the full 4-pass pipeline with mocked OpenAI responses.
 * Validates the PipelineResult discriminated union and synthesisToEvaluationResult adapter.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

// ── Fixture builders ──────────────────────────────────────────────────────────

function makePassCriteriaFixture(pass: 1 | 2) {
  return CRITERIA_KEYS.map((key) => ({
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
  }));
}

function makeSynthesisCriteriaFixture() {
  return CRITERIA_KEYS.map((key) => ({
    key,
    craft_score: 7,
    editorial_score: 6,
    final_score_0_10: 7,
    final_rationale: `Synthesized analysis for ${key}: craft and editorial perspectives converge.`,
    evidence: [{ snippet: "The river moved slowly through the valley." }],
    recommendations: [
      {
        priority: "medium",
        action: `Refine the ${key} dimension to bring craft and editorial perspectives into alignment.`,
        expected_impact: "Elevates overall evaluation quality.",
        anchor_snippet: '"slowly"',
      },
    ],
  }));
}

function makePass1Response() {
  return JSON.stringify({ criteria: makePassCriteriaFixture(1) });
}

function makePass2Response() {
  return JSON.stringify({ criteria: makePassCriteriaFixture(2) });
}

function makePass3Response() {
  return JSON.stringify({
    criteria: makeSynthesisCriteriaFixture(),
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
    },
  });
}

// ── Mock OpenAI ───────────────────────────────────────────────────────────────

const mockCreate = jest.fn();

jest.mock("openai", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// ── Import after mock ─────────────────────────────────────────────────────────

import { runPipeline, synthesisToEvaluationResult } from "@/lib/evaluation/pipeline/runPipeline";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runPipeline (e2e with mocked OpenAI)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns ok=true with synthesis and quality_gate on success", async () => {
    // Three sequential calls: pass1, pass2, pass3
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: makePass1Response() } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: makePass2Response() } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: makePass3Response() } }] });

    const result = await runPipeline({
      manuscriptText: "The river moved slowly through the valley. She watched from the bank.",
      workType: "literary_fiction",
      title: "The Valley",
      openaiApiKey: "sk-test",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.synthesis.criteria).toHaveLength(13);
      expect(result.synthesis.overall.overall_score_0_100).toBe(70);
      expect(result.quality_gate.pass).toBe(true);
    }
  });

  it("returns ok=false with PASS1_FAILED when Pass 1 throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("OpenAI network error"));

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
      expect(result.error).toContain("OpenAI network error");
    }
  });

  it("returns ok=false with PASS2_FAILED when Pass 2 throws", async () => {
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: makePass1Response() } }] })
      .mockRejectedValueOnce(new Error("Rate limit exceeded"));

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
  });

  it("returns ok=false with PASS3_FAILED when Pass 3 throws", async () => {
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: makePass1Response() } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: makePass2Response() } }] })
      .mockRejectedValueOnce(new Error("Context length exceeded"));

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("PASS3_FAILED");
      expect(result.failed_at).toBe("pass3");
    }
  });

  it("returns ok=false with quality gate error code when QG rejects output", async () => {
    // Force synthesis output that has only 5 criteria (QG_CRITERIA_MISSING)
    const truncatedSynthesis = JSON.stringify({
      criteria: makeSynthesisCriteriaFixture().slice(0, 5),
      overall: {
        overall_score_0_100: 50,
        verdict: "revise",
        one_paragraph_summary: "Partial output.",
        top_3_strengths: [],
        top_3_risks: [],
      },
      metadata: { pass1_model: "gpt-4o-mini", pass2_model: "gpt-4o-mini", pass3_model: "gpt-4o-mini" },
    });

    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: makePass1Response() } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: makePass2Response() } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: truncatedSynthesis } }] });

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("QG_CRITERIA_MISSING");
      expect(result.failed_at).toBe("pass4");
    }
  });
});

describe("synthesisToEvaluationResult", () => {
  it("maps SynthesisOutput to EvaluationResultV1 shape", () => {
    const synthesis = {
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
          },
          {
            priority: "medium" as const,
            action: `Medium priority: continue developing ${key} throughout the manuscript.`,
            expected_impact: "Incremental improvement.",
            anchor_snippet: '"moved"',
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

    expect(result.overall_score).toBe(70);
    expect(result.criteria_scores).toHaveLength(13);
    expect(result.quick_wins.length).toBeGreaterThan(0);
    expect(result.strategic_revisions.length).toBeGreaterThan(0);
    expect(result.governance.policy_family).toBe("multi-pass-dual-axis");
    expect(result.ids.evaluation_run_id).toBe("run-test-123");
    expect(result.ids.manuscript_id).toBe(42);
  });
});
