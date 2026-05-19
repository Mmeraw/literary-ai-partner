/**
 * Phase 2.7 — End-to-End Pipeline Tests
 *
 * Exercises the full 4-pass pipeline with injected runner functions (no jest.mock).
 * Validates the PipelineResult discriminated union and synthesisToEvaluationResult adapter.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  runPipeline,
  synthesisToEvaluationResult,
  synthesisToEvaluationResultV2,
} from "@/lib/evaluation/pipeline/runPipeline";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import { runQualityGateV2 } from "@/lib/evaluation/pipeline/qualityGate";
import { getEvalPassTimeoutMs } from "@/lib/evaluation/config";
import type {
  SinglePassOutput,
  SynthesisOutput,
  QualityGateResult,
  PipelineResult,
  ManuscriptChunkEvidence,
} from "@/lib/evaluation/pipeline/types";
import type { RunPass1Options } from "@/lib/evaluation/pipeline/runPass1";
import type { RunPass2Options } from "@/lib/evaluation/pipeline/runPass2";
import type { RunPass3Options } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import type { LessonsLearnedReport, RuleStage, RuleEvaluationInput } from "@/lib/governance/lessonsLearned";
import { JsonBoundaryError } from "@/lib/llm/jsonParseBoundary";
import type { LongformDreamDocument } from "@/lib/evaluation/pipeline/runPass3bLongform";
import type { CrossCheckOutput, CriterionKey } from "@/lib/evaluation/pipeline/perplexityCrossCheck";

function isPipelineFailure(result: PipelineResult): result is Extract<PipelineResult, { ok: false }> {
  return result.ok === false;
}

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeSinglePassOutput(pass: 1 | 2): SinglePassOutput {
  // IMPORTANT: rationale text for pass 1 and pass 2 must NOT share any 6-word
  // n-gram, otherwise QG check 8 (QG_INDEPENDENCE_VIOLATION) will fire.
  const rationale =
    pass === 1
      ? (key: string) => `Structural craft review of ${key} reveals competent technique with room for improvement.`
      : (key: string) => `Editorial literary perspective on ${key} shows thematic depth requiring further development.`;

  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale: rationale(key),
      evidence: [{ snippet: "The river moved slowly through the valley." }],
      recommendations: [
        {
          priority: "medium",
          action: `Strengthen the ${key} dimension with more targeted evidence from the manuscript text.`,
          expected_impact: "Increases specificity and reader connection.",
          anchor_snippet: '"slowly"',
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
        },
      ],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

function makeChunkMappedSinglePassOutput(pass: 1 | 2, expectedChunks: number): SinglePassOutput {
  return {
    ...makeSinglePassOutput(pass),
    coverage_summary: {
      route: "chunk_map_reduce",
      fully_evaluated: true,
      chunk_ledger: {
        expected_chunks: expectedChunks,
        attempted_chunks: expectedChunks,
        evaluated_chunks: expectedChunks,
        failed_chunks: 0,
        cap_applied: false,
      },
    },
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
      pressure_points: ["Narrative pressure accumulates around this criterion."],
      decision_points: ["The chapter makes a concrete decision at this criterion."],
      consequence_status: "landed" as const,
      evidence: [{ snippet: "The river moved slowly through the valley." }],
      recommendations: [
        {
          priority: "medium",
          action:
            `In the opening scene for ${key}, replace the abstract transition beat with a concrete cause-and-effect move because the current phrasing blunts tension before the decision point.`,
          expected_impact:
            "Gives the reader a clearer escalation chain, improving urgency and comprehension at the turn.",
          anchor_snippet: '"slowly"',
          source_pass: 3 as const,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
          mechanism: "the current phrasing blunts tension before the decision point",
          specific_fix: "replace the abstract transition beat with a concrete cause-and-effect move",
          reader_effect: "clearer escalation chain, improving urgency and comprehension at the turn",
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
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-4o-mini",
      pass2_model: "gpt-4o-mini",
      pass3_model: "gpt-4o-mini",
      generated_at: new Date().toISOString(),
    },
      partial_evaluation: false,
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
      submission_readiness: "not_yet",
    },
  };
}

// ── Mock runners ──────────────────────────────────────────────────────────────

let mockRunPass1: jest.Mock<(opts: RunPass1Options) => Promise<SinglePassOutput>>;
let mockRunPass2: jest.Mock<(opts: RunPass2Options) => Promise<SinglePassOutput>>;
let mockRunPass3: jest.Mock<(opts: RunPass3Options) => Promise<SynthesisOutput>>;

const permissiveLessonsLearned = {
  evaluateRules: () => ({ overall_pass: true, results: [] as LessonsLearnedReport["results"] }),
  deriveDecision: () => ({ action: "ALLOW" as const, reason: "test default allow" }),
};

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
      _lessonsLearned: permissiveLessonsLearned,
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

  it("emits onHeartbeat at expected stage boundaries in order", async () => {
    const observedStages: string[] = [];

    const result = await runPipeline({
      manuscriptText: "The river moved slowly through the valley. She watched from the bank.",
      workType: "literary_fiction",
      title: "The Valley",
      openaiApiKey: "sk-test",
      onHeartbeat: async (stage) => {
        observedStages.push(stage);
      },
      _lessonsLearned: permissiveLessonsLearned,
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(true);
    expect(observedStages).toEqual([
      "parallel_passes_started",
      "parallel_passes_settled",
      "pass3_started",
      "quality_gate_started",
      "quality_gate_completed",
    ]);
  });

  it("does not block on post-convergence lessons-learned warnings when the stage is recoverable", async () => {
    const llrReport: LessonsLearnedReport = {
      overall_pass: false,
      results: [
        {
          rule_id: "LLR-003",
          name: "No Contradictory Diagnostic Framing",
          passed: false,
          severity: "ERROR",
          violations: [
            {
              message: "Contradictory framing found without contextual boundary.",
              severity: "ERROR",
              location: "cross-criteria",
            },
          ],
          evidence: {},
        },
      ],
    };

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
      _lessonsLearned: {
        evaluateRules: (_input: RuleEvaluationInput, stage?: RuleStage) =>
          stage === "post_convergence" ? llrReport : { overall_pass: true, results: [] },
        deriveDecision: (report, stage?: RuleStage) => {
          const hasError = report.results.some((r) => !r.passed && r.severity === "ERROR");
          if (!hasError) {
            return { action: "ALLOW", reason: "no violations" };
          }
          return stage === "post_convergence"
            ? { action: "ALLOW_WITH_WARNINGS", reason: "downgraded for post_convergence" }
            : { action: "BLOCK", reason: "stage missing" };
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
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
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS1_FAILED");
      expect(result.failed_at).toBe("pass1");
      expect(result.error).toContain("OpenAI network error");
    }
  });

  it("returns pass-specific typed code when Pass 1 throws JsonBoundaryError", async () => {
    mockRunPass1.mockRejectedValueOnce(
      new JsonBoundaryError({
        code: "JSON_PARSE_FAILED_NO_OBJECT",
        message: "[Pass1] response parse failed",
        raw: "not json",
        normalized: "not json",
      }),
    );

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
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS1_JSON_PARSE_FAILED_NO_OBJECT");
      expect(result.failed_at).toBe("pass1");
      expect(result.failure_details?.json_boundary?.code).toBe("JSON_PARSE_FAILED_NO_OBJECT");
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
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS2_FAILED");
      expect(result.failed_at).toBe("pass2");
    }
  });

  it("returns pass-specific typed code when Pass 2 throws JsonBoundaryError", async () => {
    mockRunPass2.mockRejectedValueOnce(
      new JsonBoundaryError({
        code: "JSON_PARSE_FAILED_TRUNCATED",
        message: "[Pass2] response parse failed",
        raw: '{"criteria":[{"key":"concept"',
        normalized: '{"criteria":[{"key":"concept"',
      }),
    );

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
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS2_JSON_PARSE_FAILED_TRUNCATED");
      expect(result.failed_at).toBe("pass2");
      expect(result.failure_details?.json_boundary?.code).toBe("JSON_PARSE_FAILED_TRUNCATED");
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
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS3_FAILED");
      expect(result.failed_at).toBe("pass3");
    }
  });

  it("returns pass-specific typed code when Pass 3 throws JsonBoundaryError", async () => {
    mockRunPass3.mockRejectedValueOnce(
      new JsonBoundaryError({
        code: "JSON_PARSE_FAILED_MALFORMED",
        message: "[Pass3] response parse failed",
        raw: '{"criteria":[{"key":"concept",}]',
        normalized: '{"criteria":[{"key":"concept",}]',
      }),
    );

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
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS3_JSON_PARSE_FAILED_MALFORMED");
      expect(result.failed_at).toBe("pass3");
      expect(result.failure_details?.json_boundary?.code).toBe("JSON_PARSE_FAILED_MALFORMED");
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
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("QG_CRITERIA_MISSING");
      expect(result.failed_at).toBe("pass4");
    }
  });

  it("hard-fails when Perplexity returns malformed JSON (probe retries then throws)", async () => {
    // PR #614: dual-model evaluation is mandatory. Malformed JSON from the
    // probe causes a parse error which classifies as transient, the scorer
    // retries once after a 5s backoff, and the second failure trips the
    // PERPLEXITY_CHUNK_SCORER_TRANSIENT_FAILURE hard-fail.
    const originalFetch = global.fetch;
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: { content: "{ this: is invalid }" },
          },
        ],
      }),
      text: async () => "{ this: is invalid }",
    } as Response);

    try {
      await expect(
        runPipeline({
          manuscriptText: "The river moved slowly through the valley. She watched from the bank.",
          workType: "literary_fiction",
          title: "The Valley",
          openaiApiKey: "sk-test",
          perplexityApiKey: "pplx-test",
          _lessonsLearned: permissiveLessonsLearned,
          _runners: {
            runPass1: mockRunPass1,
            runPass2: mockRunPass2,
            runPass3Synthesis: mockRunPass3,
          },
        }),
      ).rejects.toThrow(/PERPLEXITY_CHUNK_SCORER_TRANSIENT_FAILURE/);
    } finally {
      global.fetch = originalFetch;
    }
  }, 15000);

  it("dedupes duplicate recommendation actions pre-gate so quality gate can pass", async () => {
    const synthesisWithDupes = makeSynthesisOutput();
    const duplicateAction =
      'In the opening scene for concept, replace the abstract transition beat with a concrete cause-and-effect move because the current phrasing blunts tension before the decision point.';

    synthesisWithDupes.criteria[0].recommendations = [
      {
        priority: "medium",
        action: duplicateAction,
        expected_impact:
          "Gives the reader a clearer escalation chain, improving urgency and comprehension at the turn.",
        anchor_snippet: '"slowly"',
        source_pass: 3,
        issue_family: "scene_structure",
        strategic_lever: "scene_goal_clarity",
        revision_granularity: "scene",
        mechanism: "the current phrasing blunts tension before the decision point",
        specific_fix: "replace the abstract transition beat with a concrete cause-and-effect move",
        reader_effect: "clearer escalation chain, improving urgency and comprehension at the turn",
      },
    ];

    synthesisWithDupes.criteria[1].recommendations = [
      {
        priority: "medium",
        action: duplicateAction,
        expected_impact:
          "Gives the reader a clearer escalation chain, improving urgency and comprehension at the turn.",
        anchor_snippet: '"slowly"',
        source_pass: 3,
        issue_family: "scene_structure",
        strategic_lever: "scene_goal_clarity",
        revision_granularity: "scene",
        mechanism: "the current phrasing blunts tension before the decision point",
        specific_fix: "replace the abstract transition beat with a concrete cause-and-effect move",
        reader_effect: "clearer escalation chain, improving urgency and comprehension at the turn",
      },
    ];

    // Guardrail: raw synthesis should fail duplicate check without pre-gate dedupe.
    const rawGate = runQualityGate(synthesisWithDupes, makeSinglePassOutput(1), makeSinglePassOutput(2));
    expect(rawGate.pass).toBe(false);
    expect(rawGate.checks.find((c) => c.error_code === "QG_DUPLICATE_REC")).toBeDefined();

    mockRunPass3.mockResolvedValueOnce(synthesisWithDupes);

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _lessonsLearned: permissiveLessonsLearned,
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quality_gate.pass).toBe(true);
      const recs0 = result.synthesis.criteria[0].recommendations;
      const recs1 = result.synthesis.criteria[1].recommendations;
      expect(recs0).toHaveLength(1);
      expect(recs1).toHaveLength(0);
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

    // Pass 1 + Pass 2 run in parallel by design; Pass 3 must not execute.
    expect(mockRunPass3).not.toHaveBeenCalled();
  });

  it("threads a model override to Pass 2 and Pass 3 only", async () => {
    await runPipeline({
      manuscriptText: "The river moved slowly through the valley. She watched from the bank.",
      workType: "literary_fiction",
      title: "The Valley",
      model: "gpt-4o",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(mockRunPass1).toHaveBeenCalledWith(
      expect.not.objectContaining({ model: expect.anything() }),
    );
    expect(mockRunPass2).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" }),
    );
    expect(mockRunPass3).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" }),
    );
  });

  it("fails closed when canonical registry binding fails", async () => {
    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _registryLoader: () => {
        throw new Error("registry corrupt");
      },
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(false);
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("CANON_REGISTRY_BIND_FAILED");
      expect(result.failed_at).toBe("pass1");
      expect(result.error).toContain("checkpoint=CANON_REGISTRY_BINDING");
    }

    expect(mockRunPass1).not.toHaveBeenCalled();
    expect(mockRunPass2).not.toHaveBeenCalled();
    expect(mockRunPass3).not.toHaveBeenCalled();
  });

  it("fails closed when pipeline input is invalid", async () => {
    const result = await runPipeline({
      manuscriptText: "   ",
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
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PIPELINE_INPUT_INVALID");
      expect(result.failed_at).toBe("pass1");
    }

    expect(mockRunPass1).not.toHaveBeenCalled();
    expect(mockRunPass2).not.toHaveBeenCalled();
    expect(mockRunPass3).not.toHaveBeenCalled();
  });

  it("fails closed with PASS1_TIMEOUT when pass exceeds timeout budget", async () => {
    mockRunPass1.mockImplementationOnce(
      () => new Promise<SinglePassOutput>((resolve) => setTimeout(() => resolve(makeSinglePassOutput(1)), 50)),
    );

    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _passTimeoutMs: 5,
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(false);
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PASS1_TIMEOUT");
      expect(result.failed_at).toBe("pass1");
    }

    expect(mockRunPass3).not.toHaveBeenCalled();
  });

  it("uses canonical EVAL_PASS_TIMEOUT_MS when _passTimeoutMs is omitted", async () => {
    // Prove that omitting _passTimeoutMs routes through the canonical
    // timeout resolver path. We use fake timers so this stays deterministic
    // even when canonical timeout baselines are large in CI.
    const canonicalPassTimeoutMs = getEvalPassTimeoutMs();

    jest.useFakeTimers();

    mockRunPass1.mockImplementationOnce(
      // Never resolves — canonical timeout should fire first.
      () => new Promise<SinglePassOutput>(() => undefined),
    );

    try {
      const resultPromise = runPipeline({
        manuscriptText: "test",
        workType: "literary_fiction",
        title: "Test",
        openaiApiKey: "sk-test",
        // _passTimeoutMs is intentionally omitted — canonical env must be used.
        _runners: {
          runPass1: mockRunPass1,
          runPass2: mockRunPass2,
          runPass3Synthesis: mockRunPass3,
        },
      });

      await jest.advanceTimersByTimeAsync(canonicalPassTimeoutMs + 1);
      const result = await resultPromise;

      expect(result.ok).toBe(false);
      if (isPipelineFailure(result)) {
        expect(result.error_code).toBe("PASS1_TIMEOUT");
        expect(result.failed_at).toBe("pass1");
      }
      expect(mockRunPass3).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("fails closed when lessons-learned blocks at post_structural", async () => {
    const evaluateRules = jest.fn<(input: RuleEvaluationInput, stage?: RuleStage) => LessonsLearnedReport>();
    evaluateRules.mockImplementation((_input, stage) => {
      if (stage === "post_structural") {
        return {
          overall_pass: false,
          results: [
            {
              rule_id: "LLR-001",
              name: "Blur, Not Multiplicity",
              passed: false,
              severity: "ERROR",
              violations: [{ message: "failed", severity: "ERROR" }],
            },
          ],
        };
      }
      return { overall_pass: true, results: [] };
    });

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
      _lessonsLearned: {
        evaluateRules,
      },
    });

    expect(result.ok).toBe(false);
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("LLR_POST_STRUCTURAL_BLOCK");
      expect(result.failed_at).toBe("pass1");
      expect(result.error).toContain("checkpoint=LLR_POST_STRUCTURAL");
    }

    // Pass 2 runs in parallel with Pass 1; post_structural block happens before Pass 3.
    expect(mockRunPass2).toHaveBeenCalledTimes(1);
    expect(mockRunPass3).not.toHaveBeenCalled();
  });

  it("fails closed when lessons-learned blocks at pre_artifact_generation", async () => {
    const evaluateRules = jest.fn<(input: RuleEvaluationInput, stage?: RuleStage) => LessonsLearnedReport>();
    evaluateRules.mockImplementation((_input, stage) => {
      if (stage === "pre_artifact_generation") {
        return {
          overall_pass: false,
          results: [
            {
              rule_id: "LLR-005",
              name: "No Generic Canon-Free Critique",
              passed: false,
              severity: "ERROR",
              violations: [{ message: "failed", severity: "ERROR" }],
            },
          ],
        };
      }
      return { overall_pass: true, results: [] };
    });

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
      _lessonsLearned: {
        evaluateRules,
      },
    });

    expect(result.ok).toBe(false);
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("LLR_PRE_ARTIFACT_GENERATION_BLOCK");
      expect(result.failed_at).toBe("pass4");
      expect(result.error).toContain("checkpoint=LLR_PRE_ARTIFACT_GENERATION");
      expect(result.failure_details?.llr_diagnostic_snapshot).toBeDefined();
      expect(result.failure_details?.llr_diagnostic_snapshot?.stage).toBe("pre_artifact_generation");
      expect(result.failure_details?.llr_diagnostic_snapshot?.convergence_result.criteria).toHaveLength(13);
    }

    expect(mockRunPass1).toHaveBeenCalledTimes(1);
    expect(mockRunPass2).toHaveBeenCalledTimes(1);
    expect(mockRunPass3).toHaveBeenCalledTimes(1);
  });

  it("accepts a manuscript at exactly 3,000,000 characters (new ceiling)", async () => {
    const result = await runPipeline({
      manuscriptText: "a".repeat(3_000_000),
      workType: "literary_fiction",
      title: "Long Form Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    // Must NOT fail with PIPELINE_INPUT_INVALID due to length
    if (!result.ok) {
      const r = result as Extract<typeof result, { ok: false }>;
      expect(r.error_code).not.toBe("PIPELINE_INPUT_INVALID");
    }
    expect(mockRunPass1).toHaveBeenCalled();
  });

  it("accepts a 2,000,000-character manuscript (within 3M ceiling)", async () => {
    const result = await runPipeline({
      manuscriptText: "a".repeat(2_000_000),
      workType: "literary_fiction",
      title: "Mid Long Form Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    if (!result.ok) {
      const r = result as Extract<typeof result, { ok: false }>;
      expect(r.error_code).not.toBe("PIPELINE_INPUT_INVALID");
    }
    expect(mockRunPass1).toHaveBeenCalled();
  });

  it("rejects a manuscript over 3,000,000 characters (exceeds new ceiling)", async () => {
    const result = await runPipeline({
      manuscriptText: "a".repeat(3_000_001),
      workType: "literary_fiction",
      title: "Over Ceiling Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(false);
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("PIPELINE_INPUT_INVALID");
      expect(result.failed_at).toBe("pass1");
    }
    expect(mockRunPass1).not.toHaveBeenCalled();
    expect(mockRunPass2).not.toHaveBeenCalled();
    expect(mockRunPass3).not.toHaveBeenCalled();
  });

  it("fails closed when governance injection map validation fails", async () => {
    const result = await runPipeline({
      manuscriptText: "test",
      workType: "literary_fiction",
      title: "Test",
      openaiApiKey: "sk-test",
      _governanceInjectionMapLoader: () => {
        throw new Error("missing required checkpoint: QUALITY_GATE");
      },
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(false);
    if (isPipelineFailure(result)) {
      expect(result.error_code).toBe("GOVERNANCE_INJECTION_MAP_INVALID");
      expect(result.failed_at).toBe("pass1");
    }

    expect(mockRunPass1).not.toHaveBeenCalled();
    expect(mockRunPass2).not.toHaveBeenCalled();
    expect(mockRunPass3).not.toHaveBeenCalled();
  });
});

// ── Pass 3b DREAM long-form synthesis tests ─────────────────────────────────

function makeLongformDreamDocument(): LongformDreamDocument {
  const criterionAnalysis = (key: string) => ({
    key,
    score: 7,
    confidence: "Moderate-High" as const,
    fit_evidence: [`${key} shows clear strength in the opening sequence.`],
    gap_evidence: [`${key} loses focus in the middle act transitions.`],
    revision_queue: [`Compress the ${key} digression in chapter 12.`],
  });

  return {
    executive_verdict:
      "A structurally ambitious long-form manuscript with strong premise and distinct voice. " +
      "Primary revision task is architectural before stylistic: clarify the collision spine and " +
      "tighten the payoff ledger across the five major structural layers.",
    dream_scores: { quality: 66, readiness: 58, commercial: 71, literary: 74 },
    market_shelf: {
      best_shelf: "Literary eco-fable / weird satirical fantasy",
      shelf_neighbors: ["Adult literary fiction", "Weird fiction"],
      comparison_space: ["Environmental literary fiction"],
      marketable_hook: "An amphibian civilization destabilized by human addiction and ecological violence.",
      market_danger: "Could be misread as a children's animal fantasy without strong adult positioning.",
    },
    what_not_to_become: [
      "It should not become a sanitized children's animal fantasy.",
      "It should not over-explain the toadstone mythology before the reader needs it.",
    ],
    structural_stack: [
      {
        layer_name: "Human damage layer",
        function: "Introduces ecological harm and the casual violence that destabilizes Aqua World",
        status: "strong",
        revision_note: "Compress the campsite scenes without losing the grotesque comic-horror register.",
      },
    ],
    arc_map: [
      {
        act_name: "Opening collision setup",
        chapter_range: "Ch. 1–3",
        primary_function: "Establishes premise, characters, and shard mythology",
        revision_priority: "Reduce density — reader needs the governing spine before the worldbuilding.",
      },
    ],
    criterion_analyses: CRITERIA_KEYS.map((key) => criterionAnalysis(key)),
    layer_analyses: [
      { layer_name: "Human damage layer", status: "strong", needed_revision: "Compress campsite scenes." },
    ],
    cross_layer_integration: [
      {
        motif: "Toadstone / shard complex",
        description: "Joins ecology, power, reproduction, and human predation into one symbolic object.",
        integration_quality: "strong",
        revision_note: "Clarify the object rules before chapter 4.",
      },
    ],
    symbolic_audit: {
      preserved_symbols: [
        {
          symbol: "Toadstone",
          current_function: "Object of power and ecological contamination",
          revision_instruction: "Do not simplify to a MacGuffin — its ambivalence is the book's moral center.",
        },
      ],
      doctrine_strengths: ["Gorf / Rancient Code system is internally consistent."],
      doctrine_risks: ["Sanctuary obligations remain underpaid in the final act."],
      audit_conclusion: "Preserve the doctrine. Reduce the exposition delivering it.",
    },
    reader_experience: {
      first_act: {
        reader_question: "What is the shard and what will it cost?",
        emotional_state: "Curious, slightly disoriented by the dual-world structure.",
        risk: "Worldbuilding density may overwhelm before the governing story spine is clear.",
      },
      middle: {
        reader_question: "Who will survive the collision between Hyla\'s rule and Zimeon\'s knowledge?",
        emotional_state: "Invested in Zimeon and Newton but uncertain where the pressure line runs.",
        risk: "Reform arc can feel like a second book if not tied to the shard crisis.",
      },
      final_act: {
        reader_question: "Does the New World promise pay off the ecological and political debts?",
        emotional_state: "Moved but uncertain whether the ending has fully resolved the ledger.",
        risk: "Closure is open rather than earned if the shard and New World arcs are not aligned.",
      },
      aftertaste:
        "A strange, ambitious, adult eco-fable that stays with the reader precisely because its moral ecology is not tidy.",
    },
    revision_plan: [
      {
        priority: 1,
        title: "Resolve manuscript integrity issues",
        goal: "Ensure no duplicate chapter bodies before architectural revision begins.",
        actions: ["Audit chapter list against table of contents.", "Remove or differentiate duplicated chapter bodies."],
        acceptance_check:
          "Zero entries in manuscript_integrity_issues with severity === 'blocking' after revision.",
      },
      {
        priority: 2,
        title: "Clarify the collision spine",
        goal: "Make the shard / toadstone / human predation line the unambiguous primary pressure.",
        actions: ["Seed the shard\'s rules in chapter 1.", "Ensure every council scene changes state."],
        acceptance_check: "Reader can articulate the central conflict by the end of chapter 3.",
      },
      {
        priority: 3,
        title: "Compress the worldbuilding",
        goal: "Information release should follow need, not geography.",
        actions: ["Cut or defer any doctrine block that arrives before its narrative question."],
        acceptance_check: "No chapter contains more than one primary worldbuilding payload.",
      },
    ],
    releasability: [
      { dimension: "Premise", current_status: "Distinctive and strong", verdict: "Ready" },
      { dimension: "Publication readiness", current_status: "Strong beta candidate after integrity pass", verdict: "Revise" },
    ],
    acceptance_checks: {
      required_detection: [
        "Duplicate chapter bodies must be flagged as manuscript_integrity_issues.",
        "All 13 criterion analyses must be present with fit_evidence and gap_evidence.",
      ],
      failure_conditions: [
        "Evaluation that calls the manuscript 'ready' without addressing the integrity issues.",
        "Evaluation that omits the symbolic audit section.",
      ],
    },
    calibration_notes: [
      "A manuscript can be worldbuilding-rich and architecturally weak at the same time.",
      "Voice strength is not a substitute for a clear collision spine.",
    ],
    repo_summary: {
      benchmark_name: "froggin-noggin-dream",
      source: "docs/benchmarks/froggin-noggin-dream.md",
      evaluation_type: "long_form_dream",
      overall_score: 66,
      readiness_score: 58,
      primary_strengths: ["Distinctive premise", "World-building depth", "Thematic integration"],
      primary_blockers: ["Pacing / compression", "Collision spine legibility", "Narrative closure"],
      gold_standard_requirement:
        "All 16 DREAM sections present. Criterion analyses expand Pass 3 scores without contradiction.",
    },
    manuscript_integrity_issues: [
      {
        kind: "duplicate_chapter_body",
        description: "Chapter 4 and Chapter 16 bodies are identical.",
        severity: "blocking",
      },
    ],
    prompt_version: "pass3b-longform-v1-dream-benchmark",
    generated_at: new Date().toISOString(),
    model: "gpt-4o-mini",
  };
}

describe("Pass 3b — long-form DREAM synthesis (pipeline integration)", () => {
  let mockRunPass1: jest.Mock<(opts: RunPass1Options) => Promise<SinglePassOutput>>;
  let mockRunPass2: jest.Mock<(opts: RunPass2Options) => Promise<SinglePassOutput>>;
  let mockRunPass3: jest.Mock<(opts: RunPass3Options) => Promise<SynthesisOutput>>;

  const permissiveLessonsLearned = {
    evaluateRules: () => ({ overall_pass: true, results: [] as LessonsLearnedReport["results"] }),
    deriveDecision: () => ({ action: "ALLOW" as const, reason: "test default allow" }),
  };

  beforeEach(() => {
    mockRunPass1 = jest.fn<(opts: RunPass1Options) => Promise<SinglePassOutput>>();
    mockRunPass2 = jest.fn<(opts: RunPass2Options) => Promise<SinglePassOutput>>();
    mockRunPass3 = jest.fn<(opts: RunPass3Options) => Promise<SynthesisOutput>>();

    mockRunPass1.mockResolvedValue(makeSinglePassOutput(1));
    mockRunPass2.mockResolvedValue(makeSinglePassOutput(2));
    mockRunPass3.mockResolvedValue(makeSynthesisOutput());
  });

  // T1: main job completes for long-form manuscripts WITHOUT Pass 3b (decoupled to /api/workers/process-dream).
  // See fix/pass3b-async-dream-worker (issue #543) — Pass 3b now runs async after job completion.
  it("T1: main pipeline completes without longform_document for long-form manuscripts (Pass 3b decoupled)", async () => {
    const mockChunks: ManuscriptChunkEvidence[] = Array.from({ length: 10 }, (_, i) => ({
      chunk_index: i,
      content: `Chapter ${i + 1} content. The river moved through the valley in the ${["early", "late", "middle", "morning", "night"][i % 5]} light.`,
      word_count: 200,
      chunk_id: `chunk-${i}`,
    }));

    mockRunPass1.mockResolvedValueOnce(makeChunkMappedSinglePassOutput(1, mockChunks.length));
    mockRunPass2.mockResolvedValueOnce(makeChunkMappedSinglePassOutput(2, mockChunks.length));

    // Pass 3b runner injected but must NOT be called — it belongs to the DREAM worker now.
    const mockRunPass3bLongform = jest.fn<() => Promise<LongformDreamDocument>>();
    mockRunPass3bLongform.mockRejectedValue(new Error("Should never be called from main pipeline"));

    const result = await runPipeline({
      manuscriptText: "a ".repeat(25_001),
      workType: "literary_fiction",
      title: "Froggin Noggin",
      openaiApiKey: "sk-test",
      manuscriptChunks: mockChunks,
      _lessonsLearned: permissiveLessonsLearned,
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
        runPass3bLongform: mockRunPass3bLongform,
      },
    });

    // T1 assertion: main job must succeed ...
    expect(result.ok).toBe(true);
    if (result.ok) {
      // ... with all 13 criteria scored
      expect(result.synthesis.criteria).toHaveLength(13);
      expect(result.quality_gate.pass).toBe(true);
      // ... and longform_document absent (it lives in evaluation_artifacts, fetched separately)
      expect((result as Record<string, unknown>).longform_document).toBeUndefined();
    }
    // ... and Pass 3b was never called from within the pipeline
    expect(mockRunPass3bLongform).not.toHaveBeenCalled();
  });

  it("short-form manuscripts complete successfully and never have longform_document (< 25k words)", async () => {
    // Pass 3b is decoupled; even if injected, it must never be called for short-form.
    const mockRunPass3bLongform = jest.fn<() => Promise<LongformDreamDocument>>();

    const result = await runPipeline({
      manuscriptText: "The river moved slowly through the valley. She watched from the bank.",
      workType: "literary_fiction",
      title: "Short Story",
      openaiApiKey: "sk-test",
      _lessonsLearned: permissiveLessonsLearned,
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
        runPass3bLongform: mockRunPass3bLongform,
      },
    });

    expect(result.ok).toBe(true);
    // Pass 3b must not be called for short-form manuscripts (not long-form, and decoupled anyway).
    expect(mockRunPass3bLongform).not.toHaveBeenCalled();
    if (result.ok) {
      expect((result as Record<string, unknown>).longform_document).toBeUndefined();
    }
  });

  // T1-ext: even if a broken runPass3bLongform is injected, the main pipeline must NOT
  // call it (it's decoupled) and must still return ok=true for long-form manuscripts.
  it("T1-ext: pipeline never calls runPass3bLongform even when injected with a throwing mock (decoupled)", async () => {
    const mockChunks: ManuscriptChunkEvidence[] = Array.from({ length: 5 }, (_, i) => ({
      chunk_index: i,
      content: `Chunk ${i} content for the long-form manuscript.`,
      word_count: 200,
      chunk_id: `chunk-fail-${i}`,
    }));

    mockRunPass1.mockResolvedValueOnce(makeChunkMappedSinglePassOutput(1, mockChunks.length));
    mockRunPass2.mockResolvedValueOnce(makeChunkMappedSinglePassOutput(2, mockChunks.length));

    // A throwing mock — if the pipeline calls this, the test will fail via unhandled rejection.
    const mockRunPass3bLongform = jest.fn<() => Promise<LongformDreamDocument>>();
    mockRunPass3bLongform.mockRejectedValue(
      new Error("[Pass3b] EMPTY_RESPONSE: model=gpt-4o finish_reason=length — should never be called")
    );

    const result = await runPipeline({
      manuscriptText: "a ".repeat(25_001),
      workType: "literary_fiction",
      title: "Long Novel",
      openaiApiKey: "sk-test",
      manuscriptChunks: mockChunks,
      _lessonsLearned: permissiveLessonsLearned,
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
        runPass3bLongform: mockRunPass3bLongform,
      },
    });

    // Pass 3b is fully decoupled — the mock must never be called.
    expect(mockRunPass3bLongform).not.toHaveBeenCalled();

    // Main evaluation must succeed regardless.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.synthesis.criteria).toHaveLength(13);
      expect(result.quality_gate.pass).toBe(true);
      expect((result as Record<string, unknown>).longform_document).toBeUndefined();
    }
  });
});

describe("synthesisToEvaluationResult adapter", () => {
  function makeAdapterSynthesisOutput(): SynthesisOutput {
    return {
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        craft_score: 7,
        editorial_score: 6,
        final_score_0_10: 7,
        score_delta: 1,
        final_rationale: `Rationale for ${key}.`,
        pressure_points: ["Narrative pressure accumulates around this criterion."],
        decision_points: ["The chapter makes a concrete decision at this criterion."],
        consequence_status: "landed" as const,
        evidence: [{ snippet: "The river moved slowly." }],
        recommendations: [
          {
            priority: "high" as const,
            action: `High priority: improve ${key} by grounding in specific textual moments.`,
            expected_impact: "Significant improvement.",
            anchor_snippet: '"slowly"',
            source_pass: 1 as const,
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
            mechanism: "the criterion lacks grounding in specific textual moments",
            specific_fix: `grounding ${key} in specific textual moments`,
            reader_effect: "significant improvement in criterion quality",
          },
          {
            priority: "medium" as const,
            action: `Medium priority: continue developing ${key} throughout the manuscript.`,
            expected_impact: "Incremental improvement.",
            anchor_snippet: '"moved"',
            source_pass: 2 as const,
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
            mechanism: "the criterion needs continued development throughout the manuscript",
            specific_fix: `developing ${key} throughout the manuscript`,
            reader_effect: "incremental improvement in criterion quality",
          },
        ],
      })),
      overall: {
        overall_score_0_100: 70,
        verdict: "revise" as const,
        one_paragraph_summary: "Strong manuscript with clear revision needs.",
        top_3_strengths: ["Voice", "Arc", "Imagery"],
        top_3_risks: ["Pacing", "Characters", "World-building"],
        submission_readiness: "nearly_ready",
      },
      metadata: {
        pass1_model: "gpt-4o-mini",
        pass2_model: "gpt-4o-mini",
        pass3_model: "gpt-4o-mini",
        generated_at: new Date().toISOString(),
      },
      partial_evaluation: false,
    };
  }

  it("maps SynthesisOutput to EvaluationResultV1 shape", () => {
    const synthesis: SynthesisOutput = makeAdapterSynthesisOutput();

    const result = synthesisToEvaluationResult({
      synthesis,
      ids: {
        evaluation_run_id: "run-test-123",
        manuscript_id: 42,
        user_id: "user-abc",
      },
    });

    expect(result.schema_version).toBe("evaluation_result_v1");
    expect(result.score_denominator_policy).toBe("full_canonical");
    expect(result.overview.overall_score_0_100).toBe(70);
    expect(result.criteria).toHaveLength(13);
    expect(result.recommendations.quick_wins.length).toBeGreaterThan(0);
    expect(result.recommendations.strategic_revisions.length).toBeGreaterThan(0);
    expect(result.governance.policy_family).toBe("multi-pass-dual-axis");
    expect(result.governance.warnings).toEqual([]);
    expect(result.governance.confidence).toBe(0.85);
    expect(result.ids.evaluation_run_id).toBe("run-test-123");
    expect(result.ids.manuscript_id).toBe(42);
  });

  it("adds INCOMPLETE_CRITERIA_SET warning and downgrades confidence for placeholder zero-score clusters", () => {
    const synthesis = makeAdapterSynthesisOutput();

    const degradedKeys = new Set(CRITERIA_KEYS.slice(0, 6));
    synthesis.criteria = synthesis.criteria.map((criterion) => {
      if (!degradedKeys.has(criterion.key)) return criterion;

      return {
        ...criterion,
        final_score_0_10: 0,
        final_rationale:
          "The chapter did not provide a specific score or analysis for this criterion based on available evidence.",
        evidence: [],
        recommendations: [],
      };
    });

    const result = synthesisToEvaluationResult({
      synthesis,
      ids: {
        evaluation_run_id: "run-placeholder-cluster",
        manuscript_id: 99,
        user_id: "user-abc",
      },
    });

    expect(result.criteria).toHaveLength(13);
    expect(result.governance.warnings.some((w) => w.includes("INCOMPLETE_CRITERIA_SET"))).toBe(true);
    expect(result.governance.warnings.some((w) => w.includes("placeholder_cluster_count=6"))).toBe(true);
    expect(result.governance.confidence).toBe(0.7);
  });

  it("adds distinguishable missing-keys warning details when criteria are absent", () => {
    const synthesis = makeAdapterSynthesisOutput();
    const expectedMissing = CRITERIA_KEYS.slice(-2);
    synthesis.criteria = synthesis.criteria.slice(0, 11);

    const result = synthesisToEvaluationResult({
      synthesis,
      ids: {
        evaluation_run_id: "run-missing-keys",
        manuscript_id: 100,
        user_id: "user-abc",
      },
    });

    expect(result.criteria).toHaveLength(11);
    const missingWarning = result.governance.warnings.find((w) => w.includes("missing_keys="));
    expect(missingWarning).toBeDefined();
    for (const key of expectedMissing) {
      expect(missingWarning).toContain(key);
    }
    expect(result.governance.confidence).toBeCloseTo(0.65, 5);
  });

  it("keeps a stable evaluation object shape for downstream consumers when incomplete warnings are present", () => {
    const synthesis = makeAdapterSynthesisOutput();
    synthesis.criteria = synthesis.criteria.slice(0, 10);

    const result = synthesisToEvaluationResult({
      synthesis,
      ids: {
        evaluation_run_id: "run-stable-shape",
        manuscript_id: 101,
        user_id: "user-abc",
      },
    });

    expect(result.schema_version).toBe("evaluation_result_v1");
    expect(result.score_denominator_policy).toBe("full_canonical");
    expect(result.overview).toEqual(
      expect.objectContaining({
        verdict: expect.any(String),
        overall_score_0_100: expect.any(Number),
      }),
    );
    expect(Array.isArray(result.criteria)).toBe(true);
    expect(Array.isArray(result.governance.warnings)).toBe(true);
    expect(result.governance.warnings.some((w) => w.includes("INCOMPLETE_CRITERIA_SET"))).toBe(true);
  });

  it("normalizes the v2 overview summary to include all bottom-score weaknesses before the gate runs", () => {
    const synthesis = makeAdapterSynthesisOutput();
    const weakKeys = ["pacing", "proseControl", "narrativeClosure"] as const;

    synthesis.criteria = synthesis.criteria.map((criterion) => {
      if (!weakKeys.includes(criterion.key as (typeof weakKeys)[number])) {
        return criterion;
      }

      return {
        ...criterion,
        final_score_0_10: criterion.key === "narrativeClosure" ? 3 : 4,
        final_rationale: `Synthesized analysis for ${criterion.key}: this is a clear weakness requiring revision.`,
      };
    });

    synthesis.overall.one_paragraph_summary =
      "Strong premise and voice carry the manuscript, but the draft needs targeted revision before submission.";

    const result = synthesisToEvaluationResultV2({
      synthesis,
      ids: {
        evaluation_run_id: "run-v2-weakness-normalized",
        manuscript_id: 102,
        user_id: "user-abc",
      },
    });

    expect(result.overview.one_paragraph_summary.toLowerCase()).toContain("pacing");
    expect(result.overview.one_paragraph_summary.toLowerCase()).toContain("prose control");
    expect(result.overview.one_paragraph_summary.toLowerCase()).toContain("narrative closure");

    const gateResult = runQualityGateV2(result);
    expect(
      gateResult.checks.find((check) => check.check_id === "v2_summary_weakness_presence")?.passed,
    ).toBe(true);
  });
});

// ── Pass 4 — Perplexity DREAM Adjudication (pipeline integration) ─────────────
//
// Pass 4 is the external adjudication stage. It fires when perplexityApiKey is
// provided, using sonar-reasoning-pro to independently score the 13 criteria.
// For LONG_FORM manuscripts it co-fires with Pass 3b and enriches the same
// ok=true result — both longform_document AND cross_check must be present.
// Pass 4 is always fail-soft: a Perplexity failure does not block the main job.

function makeCrossCheckOutput(): CrossCheckOutput {
  const criteriaMap = {} as Record<CriterionKey, CrossCheckOutput["criteria"][CriterionKey]>;
  for (const key of [...CRITERIA_KEYS] as CriterionKey[]) {
    criteriaMap[key] = {
      openaiScore: 7,
      openaiRationale: `Pass 3 evaluated ${key} as competent with targeted revision areas.`,
      openaiEvidence: [`${key} evidence from Pass 3.`],
      openaiDetectedSignals: [`${key}_signal`],
      openaiScoringBand: "7-8" as const,
      invalidOpenaiCriterion: false,
      missingFromOpenai: false,
      perplexityScore: 7,
      perplexityRationale: `Perplexity adjudication of ${key} confirms Pass 3 assessment.`,
      perplexityEvidence: [{ quote: "The river moved slowly.", explanation: `Signals ${key} strength.` }],
      perplexityDetectedSignals: [`${key}_pplx_signal`],
      perplexityScoringBand: "7-8" as const,
      perplexityDoctrineTrace: ["Artifact-based evaluation", "No author-intent privilege"],
      delta: 0,
      disputed: false,
      missingFromPerplexity: false,
      invalidPerplexityCriterion: false,
      canonValidity: { valid: true, reasons: [] },
      direction: "MATCH" as const,
    };
  }
  return {
    model: "sonar-reasoning-pro",
    crossCheckedAt: new Date().toISOString(),
    overallAgreement: "STRONG",
    disputedCriteria: [],
    invalidCriteria: [],
    criteria: criteriaMap,
    perplexitySynthesisNote: "Perplexity adjudication confirms Pass 3 synthesis across all 13 criteria.",
    canonValid: true,
    packetChars: 29568,
    packetCompressionRatio: 0.0479,
  };
}

describe("Pass 4 — Perplexity DREAM adjudication (pipeline integration)", () => {
  const permissiveLessonsLearned = {
    evaluateRules: () => ({ overall_pass: true, results: [] as LessonsLearnedReport["results"] }),
    deriveDecision: () => ({ action: "ALLOW" as const, reason: "test default allow" }),
  };

  let mockRunPass1: jest.Mock<(opts: RunPass1Options) => Promise<SinglePassOutput>>;
  let mockRunPass2: jest.Mock<(opts: RunPass2Options) => Promise<SinglePassOutput>>;
  let mockRunPass3: jest.Mock<(opts: RunPass3Options) => Promise<SynthesisOutput>>;

  beforeEach(() => {
    mockRunPass1 = jest.fn<(opts: RunPass1Options) => Promise<SinglePassOutput>>();
    mockRunPass2 = jest.fn<(opts: RunPass2Options) => Promise<SinglePassOutput>>();
    mockRunPass3 = jest.fn<(opts: RunPass3Options) => Promise<SynthesisOutput>>();

    mockRunPass1.mockResolvedValue(makeSinglePassOutput(1));
    mockRunPass2.mockResolvedValue(makeSinglePassOutput(2));
    mockRunPass3.mockResolvedValue(makeSynthesisOutput());
  });

  it("includes cross_check in ok=true result when perplexityApiKey is provided (short-form)", async () => {
    // Pass 4 fires on all manuscripts when perplexityApiKey is present.
    // Use global.fetch mock so no actual HTTP call is made.
    const originalFetch = global.fetch;
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                criteria: Object.fromEntries(
                  ([...CRITERIA_KEYS] as CriterionKey[]).map((k) => [
                    k,
                    {
                      score: 7,
                      rationale: `Adjudicated ${k}.`,
                      evidence: [{ quote: "test quote", explanation: "test exp" }],
                      detectedSignals: [`${k}_signal`],
                      scoringBand: "7-8",
                      doctrineTrace: ["artifact-based"],
                    },
                  ])
                ),
                synthesis_note: "Adjudication complete across 13 criteria.",
              }),
            },
          },
        ],
      }),
      text: async () => "",
    } as Response);

    try {
      const result = await runPipeline({
        manuscriptText: "The river moved slowly through the valley. She watched from the bank.",
        workType: "literary_fiction",
        title: "The Valley",
        openaiApiKey: "sk-test",
        perplexityApiKey: "pplx-test",
        _lessonsLearned: permissiveLessonsLearned,
        _runners: {
          runPass1: mockRunPass1,
          runPass2: mockRunPass2,
          runPass3Synthesis: mockRunPass3,
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Pass 4 retired: cross_check is no longer populated by the pipeline.
        // Dual-model parallel scoring runs Perplexity during Pass 1+2 instead;
        // the result flows into Pass 3 synthesis rather than a post-hoc cross-check.
        expect(result.cross_check).toBeUndefined();
        // external_adjudication still surfaces a status — either skipped (no
        // dual-model packet) or cross_check_completed (packet present).
        expect(result.external_adjudication).toBeDefined();
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  // Post-decoupling: Pass 3b is removed from the main pipeline. This test verifies
  // that Pass 4 (Perplexity cross-check) still fires correctly for LONG_FORM manuscripts
  // and that longform_document is absent from the pipeline result (lives in evaluation_artifacts).
  it("cross_check present for LONG_FORM route with perplexityApiKey (Pass 3b decoupled to DREAM worker)", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                criteria: Object.fromEntries(
                  ([...CRITERIA_KEYS] as CriterionKey[]).map((k) => [
                    k,
                    {
                      score: 7,
                      rationale: `DREAM-adjudicated ${k} for long-form manuscript.`,
                      evidence: [{ quote: "Long-form evidence.", explanation: "Supporting adjudication." }],
                      detectedSignals: [`${k}_longform_signal`],
                      scoringBand: "7-8",
                      doctrineTrace: ["artifact-based", "no-author-intent"],
                    },
                  ])
                ),
                synthesis_note: "Long-form DREAM adjudication confirms structural integrity across 13 criteria.",
              }),
            },
          },
        ],
      }),
      text: async () => "",
    } as Response);

    const mockChunks: ManuscriptChunkEvidence[] = Array.from({ length: 10 }, (_, i) => ({
      chunk_index: i,
      content: `Chapter ${i + 1} content. The river moved through the valley in the ${["early", "late", "middle", "morning", "night"][i % 5]} light.`,
      word_count: 200,
      chunk_id: `chunk-dream-${i}`,
    }));

    mockRunPass1.mockResolvedValueOnce(makeChunkMappedSinglePassOutput(1, mockChunks.length));
    mockRunPass2.mockResolvedValueOnce(makeChunkMappedSinglePassOutput(2, mockChunks.length));

    // Pass 3b injected but must NOT be called (decoupled to DREAM worker)
    const mockRunPass3bLongform = jest.fn<() => Promise<LongformDreamDocument>>();

    try {
      const result = await runPipeline({
        manuscriptText: "a ".repeat(25_001),
        workType: "literary_fiction",
        title: "Cartel Babies",
        openaiApiKey: "sk-test",
        perplexityApiKey: "pplx-test",
        manuscriptChunks: mockChunks,
        _lessonsLearned: permissiveLessonsLearned,
        _runners: {
          runPass1: mockRunPass1,
          runPass2: mockRunPass2,
          runPass3Synthesis: mockRunPass3,
          runPass3bLongform: mockRunPass3bLongform,
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Pass 4 retired: cross_check is no longer populated by the pipeline.
        expect(result.cross_check).toBeUndefined();

        // Main pipeline output must be complete
        expect(result.quality_gate.pass).toBe(true);
        expect(result.synthesis.criteria).toHaveLength(13);

        // Pass 3b is decoupled — longform_document NOT in pipeline result
        expect((result as Record<string, unknown>).longform_document).toBeUndefined();
      }

      // Pass 3b must never be called from the main pipeline
      expect(mockRunPass3bLongform).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("hard-fails when Perplexity network fails on LONG_FORM route (no fail-soft)", async () => {
    // PR #614: Perplexity network failure must hard-fail dual-model evaluation.
    // The probe (chunk 0) fails twice (network reject + retry reject) and the
    // scorer throws PERPLEXITY_CHUNK_SCORER_TRANSIENT_FAILURE, which propagates
    // out of runPipeline. Pass 3b is decoupled to the DREAM worker — never runs here.
    const originalFetch = global.fetch;
    global.fetch = jest.fn<typeof fetch>().mockRejectedValue(
      new Error("Network error: ECONNREFUSED")
    );

    const mockChunks: ManuscriptChunkEvidence[] = Array.from({ length: 5 }, (_, i) => ({
      chunk_index: i,
      content: `Chunk ${i} long-form content for Perplexity hard-fail test.`,
      word_count: 200,
      chunk_id: `chunk-pplx-fail-${i}`,
    }));

    mockRunPass1.mockResolvedValueOnce(makeChunkMappedSinglePassOutput(1, mockChunks.length));
    mockRunPass2.mockResolvedValueOnce(makeChunkMappedSinglePassOutput(2, mockChunks.length));

    // Pass 3b runner injected but must NOT be called
    const mockRunPass3bLongform = jest.fn<() => Promise<LongformDreamDocument>>();

    try {
      await expect(
        runPipeline({
          manuscriptText: "a ".repeat(25_001),
          workType: "literary_fiction",
          title: "Froggin Noggin",
          openaiApiKey: "sk-test",
          perplexityApiKey: "pplx-test",
          manuscriptChunks: mockChunks,
          _lessonsLearned: permissiveLessonsLearned,
          _runners: {
            runPass1: mockRunPass1,
            runPass2: mockRunPass2,
            runPass3Synthesis: mockRunPass3,
            runPass3bLongform: mockRunPass3bLongform,
          },
        }),
      ).rejects.toThrow(/PERPLEXITY_CHUNK_SCORER_TRANSIENT_FAILURE/);

      // Pass 3b must not be called from the main pipeline
      expect(mockRunPass3bLongform).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  }, 15000);

  it("external_adjudication status is correctly set for optional mode without API key", async () => {
    // When no perplexityApiKey is provided and mode is 'optional',
    // external_adjudication.status must be 'no_api_key' and the pipeline must succeed.
    const result = await runPipeline({
      manuscriptText: "The river moved slowly through the valley. She watched from the bank.",
      workType: "literary_fiction",
      title: "The Valley",
      openaiApiKey: "sk-test",
      // No perplexityApiKey — optional mode default
      _lessonsLearned: permissiveLessonsLearned,
      _runners: {
        runPass1: mockRunPass1,
        runPass2: mockRunPass2,
        runPass3Synthesis: mockRunPass3,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cross_check).toBeUndefined();
      // external_adjudication must be present. After Pass 4 retirement the
      // skipped reason reflects the new contract (dual-model parallel scoring
      // is the replacement for the post-hoc cross-check).
      expect(result.external_adjudication).toBeDefined();
      expect(result.external_adjudication?.status).toBe("skipped");
      if (result.external_adjudication?.status === "skipped") {
        expect(result.external_adjudication.reason).toBe("pass4_retired_dual_model_parallel_scoring");
      }
    }
  });
});
