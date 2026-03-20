/**
 * Phase 2.7 — Orchestrator: runPipeline
 *
 * Coordinates Pass 1 → Pass 2 → Pass 3 → Pass 4 (Quality Gate).
 * Also provides synthesisToEvaluationResult() adapter to preserve
 * downstream compatibility with EvaluationResultV1.
 *
 * Pipeline invariants (spec §7):
 *   1. Pass 2 NEVER receives Pass 1 output (independence guarantee)
 *   2. Quality gate is deterministic code, not AI
 *   3. Fails closed — any pass failure → job FAILED, no artifact persisted
 *   4. All 13 criteria must appear in output
 *   5. Scores are integers 0-10
 */

import { runPass1 as defaultRunPass1 } from "./runPass1";
import { runPass2 as defaultRunPass2 } from "./runPass2";
import { runPass3Synthesis as defaultRunPass3 } from "./runPass3Synthesis";
import { runQualityGate as defaultRunQualityGate } from "./qualityGate";
import type { PipelineResult, SinglePassOutput, SynthesisOutput, QualityGateResult } from "./types";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import { PASS1_PROMPT_VERSION } from "./prompts/pass1-craft";
import { PASS2_PROMPT_VERSION } from "./prompts/pass2-editorial";
import { PASS3_PROMPT_VERSION } from "./prompts/pass3-synthesis";
import type { RunPass1Options } from "./runPass1";
import type { RunPass2Options } from "./runPass2";
import type { RunPass3Options } from "./runPass3Synthesis";

export interface RunPipelineOptions {
  manuscriptText: string;
  workType: string;
  title: string;
  model?: string;
  openaiApiKey?: string;
  /**
   * Dependency injection for runner functions (testing only).
   * Production callers omit this entirely.
   */
  _runners?: {
    runPass1?: (opts: RunPass1Options) => Promise<SinglePassOutput>;
    runPass2?: (opts: RunPass2Options) => Promise<SinglePassOutput>;
    runPass3Synthesis?: (opts: RunPass3Options) => Promise<SynthesisOutput>;
    runQualityGate?: (synthesis: SynthesisOutput, pass1: SinglePassOutput, pass2: SinglePassOutput) => QualityGateResult;
  };
}

/**
 * Run the full 4-pass evaluation pipeline.
 *
 * Returns PipelineResult — a discriminated union:
 *   { ok: true,  synthesis, quality_gate }
 *   { ok: false, error, error_code, failed_at }
 */
export async function runPipeline(opts: RunPipelineOptions): Promise<PipelineResult> {
  const _runPass1 = opts._runners?.runPass1 ?? defaultRunPass1;
  const _runPass2 = opts._runners?.runPass2 ?? defaultRunPass2;
  const _runPass3 = opts._runners?.runPass3Synthesis ?? defaultRunPass3;
  const _runQualityGate = opts._runners?.runQualityGate ?? defaultRunQualityGate;

  let pass1Output: SinglePassOutput;
  let pass2Output: SinglePassOutput;
  let pass3Output: SynthesisOutput;

  // ── Pass 1: Craft Execution ─────────────────────────────────────────────
  try {
    pass1Output = await _runPass1({
      manuscriptText: opts.manuscriptText,
      workType: opts.workType,
      title: opts.title,
      model: opts.model,
      openaiApiKey: opts.openaiApiKey,
    });
  } catch (err) {
    return {
      ok: false,
      error: String(err instanceof Error ? err.message : err),
      error_code: "PASS1_FAILED",
      failed_at: "pass1",
    };
  }

  // ── Pass 2: Editorial/Literary Insight ──────────────────────────────────
  // Independence guarantee: Pass 2 receives ONLY manuscript text.
  // pass1Output is deliberately NOT passed here.
  try {
    pass2Output = await _runPass2({
      manuscriptText: opts.manuscriptText,
      workType: opts.workType,
      title: opts.title,
      model: opts.model,
      openaiApiKey: opts.openaiApiKey,
    });
  } catch (err) {
    return {
      ok: false,
      error: String(err instanceof Error ? err.message : err),
      error_code: "PASS2_FAILED",
      failed_at: "pass2",
    };
  }

  // ── Pass 3: Synthesis & Reconciliation ─────────────────────────────────
  try {
    pass3Output = await _runPass3({
      pass1: pass1Output,
      pass2: pass2Output,
      manuscriptText: opts.manuscriptText,
      title: opts.title,
      model: opts.model,
      openaiApiKey: opts.openaiApiKey,
    });
  } catch (err) {
    return {
      ok: false,
      error: String(err instanceof Error ? err.message : err),
      error_code: "PASS3_FAILED",
      failed_at: "pass3",
    };
  }

  // ── Pass 4: Quality Gate (deterministic) ───────────────────────────────
  const qualityGate = _runQualityGate(pass3Output, pass1Output, pass2Output);
  if (!qualityGate.pass) {
    const failedChecks = qualityGate.checks.filter((c) => !c.passed);
    const errorCode = failedChecks[0]?.error_code ?? "QG_UNKNOWN";
    const details = failedChecks.map((c) => c.details ?? c.error_code).join("; ");
    return {
      ok: false,
      error: `Quality gate failed: ${details}`,
      error_code: errorCode,
      failed_at: "pass4",
    };
  }

  return { ok: true, synthesis: pass3Output, quality_gate: qualityGate };
}

// ── EvaluationResultV1 Adapter ────────────────────────────────────────────────

export interface SynthesisToEvaluationResultOptions {
  synthesis: SynthesisOutput;
  ids: {
    evaluation_run_id: string;
    job_id?: string;
    manuscript_id: number;
    project_id?: number;
    user_id: string;
  };
}

/**
 * Map a SynthesisOutput (Phase 2.7 pipeline result) to EvaluationResultV1
 * so that downstream code (phase2.ts, report UI, A6 credibility) works unchanged.
 */
export function synthesisToEvaluationResult(
  opts: SynthesisToEvaluationResultOptions,
): EvaluationResultV1 {
  const { synthesis, ids } = opts;

  const criteria: EvaluationResultV1["criteria"] = synthesis.criteria.map((c) => ({
    key: c.key,
    score_0_10: c.final_score_0_10,
    rationale: c.final_rationale,
    evidence: c.evidence.map((e) => ({
      snippet: e.snippet,
      ...(e.char_start !== undefined || e.char_end !== undefined
        ? {
            location: {
              char_start: e.char_start,
              char_end: e.char_end,
              segment_id: e.segment_id,
            },
          }
        : {}),
    })),
    recommendations: c.recommendations.map((r) => ({
      priority: r.priority,
      action: r.action,
      expected_impact: r.expected_impact,
    })),
  }));

  // Derive quick_wins (high-priority recs from all criteria)
  const quick_wins = synthesis.criteria
    .flatMap((c) =>
      c.recommendations
        .filter((r) => r.priority === "high")
        .map((r) => ({
          action: r.action,
          why: r.expected_impact,
          effort: "medium" as const,
          impact: "high" as const,
        })),
    )
    .slice(0, 5);

  // Derive strategic_revisions (medium-priority recs)
  const strategic_revisions = synthesis.criteria
    .flatMap((c) =>
      c.recommendations
        .filter((r) => r.priority === "medium")
        .map((r) => ({
          action: r.action,
          why: r.expected_impact,
          effort: "medium" as const,
          impact: "medium" as const,
        })),
    )
    .slice(0, 5);

  return {
    schema_version: "evaluation_result_v1",
    ids,
    generated_at: synthesis.metadata.generated_at,
    engine: {
      model: synthesis.metadata.pass3_model,
      provider: "openai",
      prompt_version: `${PASS1_PROMPT_VERSION}+${PASS2_PROMPT_VERSION}+${PASS3_PROMPT_VERSION}`,
    },
    overview: {
      verdict: synthesis.overall.verdict,
      overall_score_0_100: synthesis.overall.overall_score_0_100,
      one_paragraph_summary: synthesis.overall.one_paragraph_summary,
      top_3_strengths: synthesis.overall.top_3_strengths,
      top_3_risks: synthesis.overall.top_3_risks,
    },
    criteria,
    recommendations: {
      quick_wins,
      strategic_revisions,
    },
    metrics: {
      manuscript: {},
      processing: {},
    },
    artifacts: [],
    governance: {
      confidence: 0.85,
      warnings: [],
      limitations: ["Single-chunk evaluation; multi-chunk synthesis in Phase 2.8"],
      policy_family: "multi-pass-dual-axis",
    },
  };
}
