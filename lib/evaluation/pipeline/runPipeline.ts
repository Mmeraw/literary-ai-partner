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
import { runPerplexityCrossCheck, CrossCheckOutput } from "./perplexityCrossCheck";
import { evaluatePass4Governance } from "@/lib/evaluation/governance/evaluatePass4Governance";
import { runQualityGate as defaultRunQualityGate } from "./qualityGate";
import type { PipelineResult, SinglePassOutput, SynthesisOutput, QualityGateResult } from "./types";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import { PASS1_PROMPT_VERSION } from "./prompts/pass1-craft";
import { PASS2_PROMPT_VERSION } from "./prompts/pass2-editorial";
import { PASS3_PROMPT_VERSION } from "./prompts/pass3-synthesis";
import type { RunPass1Options } from "./runPass1";
import type { RunPass2Options } from "./runPass2";
import type { RunPass3Options } from "./runPass3Synthesis";
import { loadCanonicalRegistry } from "@/lib/governance/canonRegistry";
import type { CanonRegistry } from "@/lib/governance/canonRegistry";
import {
  loadGovernanceInjectionMap,
  getGovernanceCheckpointById,
  getLlrCheckpointForStage,
} from "@/lib/governance/injectionMap";
import type { GovernanceCheckpoint, GovernanceInjectionMap } from "@/lib/governance/injectionMap";
import {
  evaluateLessonsLearnedRules as defaultEvaluateLessonsLearnedRules,
  deriveLessonsLearnedEnforcementDecision as defaultDeriveLessonsLearnedEnforcementDecision,
} from "@/lib/governance/lessonsLearned";
import type {
  RuleEvaluationInput,
  RuleStage,
  LessonsLearnedReport,
  EnforcementDecision,
} from "@/lib/governance/lessonsLearned";

export interface RunPipelineOptions {
  manuscriptText: string;
  workType: string;
  title: string;
  model?: string;
  openaiApiKey?: string;
  /** Optional: Perplexity API key. When provided, enables Pass 4 cross-check via sonar-reasoning-pro. */
  perplexityApiKey?: string;
  /** Per-pass timeout. Defaults to 60s. */
  _passTimeoutMs?: number;
  /** Maximum accepted manuscript size. Defaults to 1,000,000 chars. */
  _maxManuscriptChars?: number;
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
  /** Dependency injection for registry loader (testing only). */
  _registryLoader?: () => CanonRegistry;
  /** Dependency injection for governance injection map loader (testing only). */
  _governanceInjectionMapLoader?: () => GovernanceInjectionMap;
  manuscriptId?: string;
  executionMode?: "TRUSTED_PATH" | "STUDIO";
  /** Dependency injection for lessons-learned engine (testing only). */
  _lessonsLearned?: {
    evaluateRules?: (input: RuleEvaluationInput, stage?: RuleStage) => LessonsLearnedReport;
    deriveDecision?: (report: LessonsLearnedReport) => EnforcementDecision;
  };
}

const DEFAULT_PASS_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_MANUSCRIPT_CHARS = 1_000_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function validatePipelineInput(opts: RunPipelineOptions): string | null {
  const manuscriptText = opts.manuscriptText?.trim();
  const workType = opts.workType?.trim();
  const title = opts.title?.trim();
  const maxChars = opts._maxManuscriptChars ?? DEFAULT_MAX_MANUSCRIPT_CHARS;

  if (!manuscriptText) return "manuscriptText is required";
  if (!workType) return "workType is required";
  if (!title) return "title is required";
  if (!Number.isInteger(maxChars) || maxChars <= 0) return "_maxManuscriptChars must be a positive integer";
  if (manuscriptText.length > maxChars) {
    return `manuscriptText exceeds max length (${manuscriptText.length} > ${maxChars})`;
  }

  if (opts._passTimeoutMs !== undefined && (!Number.isInteger(opts._passTimeoutMs) || opts._passTimeoutMs <= 0)) {
    return "_passTimeoutMs must be a positive integer";
  }

  return null;
}

/**
 * Run the full 4-pass evaluation pipeline.
 *
 * Returns PipelineResult — a discriminated union:
 *   { ok: true,  synthesis, quality_gate }
 *   { ok: false, error, error_code, failed_at }
 */
export async function runPipeline(opts: RunPipelineOptions): Promise<PipelineResult> {
  const inputValidationError = validatePipelineInput(opts);
  if (inputValidationError) {
    return {
      ok: false,
      error: `Pipeline input validation failed: ${inputValidationError}`,
      error_code: "PIPELINE_INPUT_INVALID",
      failed_at: "pass1",
    };
  }

  const passTimeoutMs = opts._passTimeoutMs ?? DEFAULT_PASS_TIMEOUT_MS;

  const _runPass1 = opts._runners?.runPass1 ?? defaultRunPass1;
  const _runPass2 = opts._runners?.runPass2 ?? defaultRunPass2;
  const _runPass3 = opts._runners?.runPass3Synthesis ?? defaultRunPass3;
  const _runQualityGate = opts._runners?.runQualityGate ?? defaultRunQualityGate;
  const _loadRegistry = opts._registryLoader ?? loadCanonicalRegistry;
  const _loadGovernanceInjectionMap = opts._governanceInjectionMapLoader ?? loadGovernanceInjectionMap;
  const _evaluateLessonsLearned = opts._lessonsLearned?.evaluateRules ?? defaultEvaluateLessonsLearnedRules;
  const _deriveLessonsLearnedDecision =
    opts._lessonsLearned?.deriveDecision ?? defaultDeriveLessonsLearnedEnforcementDecision;

  let governanceInjectionMap: GovernanceInjectionMap;
  try {
    governanceInjectionMap = _loadGovernanceInjectionMap();
  } catch (err) {
    return {
      ok: false,
      error: `Governance injection map invalid: ${String(err instanceof Error ? err.message : err)}`,
      error_code: "GOVERNANCE_INJECTION_MAP_INVALID",
      failed_at: "pass1",
    };
  }

  const checkpointContext = (checkpoint: GovernanceCheckpoint): string => {
    return ` [checkpoint=${checkpoint.id} authority=${checkpoint.authority}]`;
  };

  const llrContextBase = {
    manuscript_id: opts.manuscriptId ?? `pipeline:${opts.title}`,
    execution_mode: opts.executionMode ?? "TRUSTED_PATH",
    metadata: {
      trace_id: `llr-${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  };

  const enforceLessonsLearnedStage = (
    stage: RuleStage,
    failedAt: "pass1" | "pass2" | "pass3" | "pass4",
    input: Omit<RuleEvaluationInput, "metadata" | "execution_mode" | "manuscript_id">,
  ): PipelineResult | null => {
    const report = _evaluateLessonsLearned(
      {
        ...llrContextBase,
        ...input,
      },
      stage,
    );
    const decision = _deriveLessonsLearnedDecision(report);
    const checkpoint = getLlrCheckpointForStage(stage, governanceInjectionMap);

    if (decision.action === "BLOCK") {
      const failedRules = report.results
        .filter((r) => !r.passed && r.severity === "ERROR")
        .map((r) => r.rule_id)
        .join(", ");

      return {
        ok: false,
        error: `Lessons-learned enforcement blocked at ${stage}: ${decision.reason}${failedRules ? ` (rules: ${failedRules})` : ""}${checkpointContext(checkpoint)}`,
        error_code: checkpoint.blockErrorCode ?? `LLR_${stage.toUpperCase()}_BLOCK`,
        failed_at: failedAt,
      };
    }

    return null;
  };

  let registry: CanonRegistry;
  const registryBindingCheckpoint = getGovernanceCheckpointById("CANON_REGISTRY_BINDING", governanceInjectionMap);
  const canonGateCheckpoint = getGovernanceCheckpointById("CANON_GATE", governanceInjectionMap);
  try {
    registry = _loadRegistry();
  } catch (err) {
    return {
      ok: false,
      error: `Canonical registry binding failed: ${String(err instanceof Error ? err.message : err)}${checkpointContext(registryBindingCheckpoint)}`,
      error_code: registryBindingCheckpoint.blockErrorCode ?? "CANON_REGISTRY_BIND_FAILED",
      failed_at: "pass1",
    };
  }

  if (registry.size === 0) {
    return {
      ok: false,
      error: `Canonical registry binding failed: registry empty${checkpointContext(canonGateCheckpoint)}`,
      error_code: canonGateCheckpoint.blockErrorCode ?? "CANON_REGISTRY_EMPTY",
      failed_at: "pass1",
    };
  }

  let pass1Output: SinglePassOutput;
  let pass2Output: SinglePassOutput;
  let pass3Output: SynthesisOutput;

  // ── Pass 1: Craft Execution ─────────────────────────────────────────────
  try {
    pass1Output = await withTimeout(
      _runPass1({
        manuscriptText: opts.manuscriptText,
        workType: opts.workType,
        title: opts.title,
        executionMode: opts.executionMode,
        model: opts.model,
        openaiApiKey: opts.openaiApiKey,
        registry,
      }),
      passTimeoutMs,
      "Pass 1",
    );
  } catch (err) {
    const errMessage = String(err instanceof Error ? err.message : err);
    return {
      ok: false,
      error: errMessage,
      error_code: errMessage.includes("timed out") ? "PASS1_TIMEOUT" : "PASS1_FAILED",
      failed_at: "pass1",
    };
  }

  {
    const llrResult = enforceLessonsLearnedStage("post_structural", "pass1", {
      structural_result: pass1Output,
      registry,
    });
    if (llrResult) return llrResult;
  }

  // ── Pass 2: Editorial/Literary Insight ──────────────────────────────────
  // Independence guarantee: Pass 2 receives ONLY manuscript text.
  // pass1Output is deliberately NOT passed here.
  try {
    pass2Output = await withTimeout(
      _runPass2({
        manuscriptText: opts.manuscriptText,
        workType: opts.workType,
        title: opts.title,
        executionMode: opts.executionMode,
        model: opts.model,
        openaiApiKey: opts.openaiApiKey,
        registry,
      }),
      passTimeoutMs,
      "Pass 2",
    );
  } catch (err) {
    const errMessage = String(err instanceof Error ? err.message : err);
    return {
      ok: false,
      error: errMessage,
      error_code: errMessage.includes("timed out") ? "PASS2_TIMEOUT" : "PASS2_FAILED",
      failed_at: "pass2",
    };
  }

  {
    const llrResult = enforceLessonsLearnedStage("post_diagnostic", "pass2", {
      structural_result: pass1Output,
      diagnostic_result: pass2Output,
      registry,
    });
    if (llrResult) return llrResult;
  }

  // ── Pass 3: Synthesis & Reconciliation ─────────────────────────────────
  try {
    pass3Output = await withTimeout(
      _runPass3({
        pass1: pass1Output,
        pass2: pass2Output,
        manuscriptText: opts.manuscriptText,
        title: opts.title,
        executionMode: opts.executionMode,
        model: opts.model,
        openaiApiKey: opts.openaiApiKey,
        registry,
      }),
      passTimeoutMs,
      "Pass 3",
    );
  } catch (err) {
    const errMessage = String(err instanceof Error ? err.message : err);
    return {
      ok: false,
      error: errMessage,
      error_code: errMessage.includes("timed out") ? "PASS3_TIMEOUT" : "PASS3_FAILED",
      failed_at: "pass3",
    };
  }

  {
    const llrPostConvergence = enforceLessonsLearnedStage("post_convergence", "pass3", {
      structural_result: pass1Output,
      diagnostic_result: pass2Output,
      convergence_result: pass3Output,
      registry,
    });
    if (llrPostConvergence) return llrPostConvergence;

    const llrPreArtifactGeneration = enforceLessonsLearnedStage("pre_artifact_generation", "pass4", {
      structural_result: pass1Output,
      diagnostic_result: pass2Output,
      convergence_result: pass3Output,
      registry,
    });
    if (llrPreArtifactGeneration) return llrPreArtifactGeneration;
  }

  // ── Pass 4: Quality Gate (deterministic) ───────────────────────────────
  const qualityGate = _runQualityGate(pass3Output, pass1Output, pass2Output);
  if (!qualityGate.pass) {
    const qualityGateCheckpoint = getGovernanceCheckpointById("QUALITY_GATE", governanceInjectionMap);
    const failedChecks = qualityGate.checks.filter((c) => !c.passed);
    const errorCode = failedChecks[0]?.error_code ?? "QG_UNKNOWN";
    const details = failedChecks.map((c) => c.details ?? c.error_code).join("; ");

    // --- Pass 4: Perplexity Cross-Check (optional, fail-soft) ---
    let crossCheckResult: CrossCheckOutput | undefined;
    if (opts.perplexityApiKey) {
      try {
        crossCheckResult = await runPerplexityCrossCheck({
          openaiCriteria: synthesis.criteria,
          openaiSynthesis: synthesis.overall?.one_paragraph_summary ?? "",
          manuscriptExcerpt: manuscriptText,
          workType: workType,
          title: title,
          perplexityApiKey: opts.perplexityApiKey,
        });
      } catch (err) {
        console.warn(
          "[Pass4] Perplexity cross-check failed (non-fatal):",
          err instanceof Error ? err.message : String(err)
        );
      }
    }
    const pass4Governance = evaluatePass4Governance(crossCheckResult);

    return {
      ok: false,
      error: `Quality gate failed: ${details}${checkpointContext(qualityGateCheckpoint)}`,
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
      crossCheck: crossCheckResult,
        pass4Governance,
      limitations: ["Single-chunk evaluation; multi-chunk synthesis in Phase 2.8"],
      policy_family: "multi-pass-dual-axis",
    },
  };
}
