/**
 * PR #506 — Pass 4 external_adjudication contract tests.
 *
 * Closes the Froggin Noggin truth gap. Before this PR, a completed evaluation
 * could be persisted with cross_check_status=null when:
 *   - EVAL_EXTERNAL_ADJUDICATION_MODE=optional and the Perplexity key was
 *     missing from the runtime perplexityApiKey plumbing, or
 *   - the Perplexity call failed soft and runPipeline silently swallowed it.
 *
 * The new contract: every PipelineResult success path carries an
 * `external_adjudication` field. `synthesisToEvaluationResultV2` MUST surface it
 * in `governance.transparency.external_adjudication` and MUST set a
 * `EXTERNAL_ADJUDICATION_<STATUS>` governance warning whenever status !==
 * "cross_check_completed".
 *
 * Scope locked to surfacing/persistence only. Provider-call telemetry repair,
 * jobs-table schema work, and Pass 3 reducer fixes are tracked separately.
 */

import { describe, expect, test } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import type { SynthesisOutput } from "@/lib/evaluation/pipeline/types";
import type { ExternalAdjudicationStatus } from "@/lib/evaluation/pipeline/types";
import { synthesisToEvaluationResultV2 } from "@/lib/evaluation/pipeline/runPipeline";
import type { SubmissionScopeProfile } from "@/lib/evaluation/pipeline/submissionScope";

function makeFullManuscriptScopeProfile(): SubmissionScopeProfile {
  // Froggin Noggin-shaped fixture: 127k-word full manuscript run, 34 chunks.
  return {
    inputScale: "full_manuscript",
    wordCount: 127_036,
    chunkCount: 34,
    scorableCount: 13,
    confidenceCapSummary: "HIGH",
    scopePolicyVersion: "v1",
  };
}

function makeFullCoverageLongFormSynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: 7,
      score_delta: 0,
      final_rationale: `Criterion ${key} is supported by full chunk-map coverage of the manuscript.`,
      pressure_points: ["Pressure enters and escalates across the chunked windows."],
      decision_points: ["A visible turn lands in the chunked synthesis."],
      consequence_status: "landed" as const,
      evidence: [{ snippet: `Full-coverage evidence for ${key}.` }],
      recommendations: [
        {
          priority: "medium" as const,
          action: `Sharpen ${key} via a concrete beat in the next revision.`,
          expected_impact: `Improves ${key} clarity across the manuscript.`,
          anchor_snippet: `Anchor for ${key}.`,
          source_pass: 3 as const,
          issue_family: "scene_structure" as const,
          strategic_lever: "scene_goal_clarity" as const,
          revision_granularity: "scene" as const,
          mechanism: "manuscript-wide reasoning",
          specific_fix: "add a concrete beat",
          reader_effect: "clearer local consequence",
        },
      ],
      confidence_score_0_100: 78,
      confidence_level: "moderate" as const,
      confidence_reasons: ["full_chunk_map_coverage"],
      scorability_status: "scorable" as const,
    })),
    overall: {
      overall_score_0_100: 72,
      verdict: "revise",
      one_paragraph_summary:
        "Full chunk-map synthesis suggests a promising manuscript with targeted revision needs.",
      top_3_strengths: ["voice", "concept", "character"],
      top_3_risks: ["pacing", "dialogue", "closure"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: "gpt-5.1",
      pass2_model: "gpt-5.1",
      pass3_model: "gpt-5.1",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
    coverage_scope: {
      sourceChars: 617_000,
      sourceWords: 127_036,
      analyzedChars: 617_000,
      analyzedWords: 127_036,
      strategy: "full_chunk_map_reduce",
    },
  };
}

function adapt(externalAdjudication: ExternalAdjudicationStatus | undefined) {
  return synthesisToEvaluationResultV2({
    synthesis: makeFullCoverageLongFormSynthesis(),
    ids: {
      evaluation_run_id: "run-pr506-fixture",
      job_id: "job-pr506-fixture",
      manuscript_id: 506506,
      user_id: "00000000-0000-0000-0000-000000506506",
    },
    scopeProfile: makeFullManuscriptScopeProfile(),
    manuscriptText: "word ".repeat(127_036),
    sourceText: "word ".repeat(127_036),
    title: "Froggin Noggin fixture",
    externalAdjudication,
  });
}

describe("PR #506 — Pass 4 external_adjudication contract (synthesisToEvaluationResultV2)", () => {
  test("Froggin Noggin completed required-mode run preserves packet provenance", () => {
    const result = adapt({
      status: "cross_check_completed",
      mode: "required",
      cross_check_returned: true,
      packet_chars: 29_568,
      packet_compression_ratio: 0.0479,
    });

    expect(result.governance.transparency?.external_adjudication).toEqual({
      status: "cross_check_completed",
      mode: "required",
      cross_check_returned: true,
      packet_chars: 29_568,
      packet_compression_ratio: 0.0479,
    });
    // A successful required-mode adjudication MUST NOT trip the adjudication warning.
    expect(
      result.governance.warnings.some((w) => w.startsWith("EXTERNAL_ADJUDICATION_")),
    ).toBe(false);
    // Full coverage + completed adjudication: manuscript stays certifiable.
    expect(result.governance.transparency?.evaluation_scope).toEqual(
      expect.objectContaining({ manuscript_wide_certifiable: true }),
    );
  });

  test("skipped optional run surfaces status + reason; does NOT block certification", () => {
    const result = adapt({
      status: "skipped",
      mode: "optional",
      cross_check_returned: false,
      reason: "no_api_key",
    });

    expect(result.governance.transparency?.external_adjudication).toEqual({
      status: "skipped",
      mode: "optional",
      cross_check_returned: false,
      reason: "no_api_key",
    });
    expect(result.governance.warnings).toContain(
      "EXTERNAL_ADJUDICATION_SKIPPED (mode=optional, reason=no_api_key)",
    );
    // optional mode is allowed to skip and still certify if coverage is full.
    expect(result.governance.transparency?.evaluation_scope).toEqual(
      expect.objectContaining({ manuscript_wide_certifiable: true }),
    );
  });

  test("skipped required-mode run BLOCKS manuscript-wide certification", () => {
    const result = adapt({
      status: "skipped",
      mode: "required",
      cross_check_returned: false,
      reason: "no_api_key",
    });

    expect(result.governance.transparency?.external_adjudication).toMatchObject({
      status: "skipped",
      mode: "required",
      cross_check_returned: false,
      reason: "no_api_key",
    });
    expect(result.governance.warnings).toContain(
      "EXTERNAL_ADJUDICATION_SKIPPED (mode=required, reason=no_api_key)",
    );
    // Required-mode skip MUST NOT produce a certified report.
    expect(result.governance.transparency?.evaluation_scope?.manuscript_wide_certifiable).toBe(
      false,
    );
    expect(result.governance.transparency?.evaluation_scope?.reason_codes ?? []).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/external_adjudication_skipped_in_required_mode/),
      ]),
    );
  });

  test("failed_soft optional run surfaces reason without blocking certification", () => {
    const result = adapt({
      status: "failed_soft",
      mode: "optional",
      cross_check_returned: false,
      reason: "perplexity 500 internal error",
      packet_chars: 29_568,
      packet_compression_ratio: 0.0479,
    });

    expect(result.governance.transparency?.external_adjudication).toMatchObject({
      status: "failed_soft",
      mode: "optional",
      cross_check_returned: false,
      reason: "perplexity 500 internal error",
      packet_chars: 29_568,
      packet_compression_ratio: 0.0479,
    });
    expect(result.governance.warnings).toContain(
      "EXTERNAL_ADJUDICATION_FAILED_SOFT (mode=optional, reason=perplexity 500 internal error)",
    );
    expect(result.governance.transparency?.evaluation_scope?.manuscript_wide_certifiable).toBe(
      true,
    );
  });

  test("failed_blocking required-mode run blocks certification and exposes reason", () => {
    const result = adapt({
      status: "failed_blocking",
      mode: "required",
      cross_check_returned: false,
      reason: "perplexity_request_timeout",
    });

    expect(result.governance.transparency?.external_adjudication).toMatchObject({
      status: "failed_blocking",
      mode: "required",
      cross_check_returned: false,
      reason: "perplexity_request_timeout",
    });
    expect(result.governance.warnings).toContain(
      "EXTERNAL_ADJUDICATION_FAILED_BLOCKING (mode=required, reason=perplexity_request_timeout)",
    );
    expect(result.governance.transparency?.evaluation_scope?.manuscript_wide_certifiable).toBe(
      false,
    );
  });

  test("legacy callers without externalAdjudication still produce a valid result", () => {
    // Backward compatibility: undefined externalAdjudication MUST NOT crash and
    // MUST NOT emit a transparency.external_adjudication block (so consumers can
    // distinguish "PR #506 contract not yet wired" from "explicit skipped").
    const result = adapt(undefined);
    expect(result.governance.transparency?.external_adjudication).toBeUndefined();
    expect(
      result.governance.warnings.some((w) => w.startsWith("EXTERNAL_ADJUDICATION_")),
    ).toBe(false);
  });
});
