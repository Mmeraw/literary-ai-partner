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
import {
  runQualityGate as defaultRunQualityGate,
  summarizeQualityGateFailures,
} from "./qualityGate";
import type { PipelineResult, SinglePassOutput, SynthesisOutput, QualityGateResult } from "./types";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
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
import { JsonBoundaryError } from "@/lib/llm/jsonParseBoundary";
import type {
  RuleEvaluationInput,
  RuleStage,
  LessonsLearnedReport,
  EnforcementDecision,
} from "@/lib/governance/lessonsLearned";
import type { GovernanceDecision } from "@/lib/evaluation/governance/evaluatePass4Governance";

// Pass 4 governance result type — derived from evaluatePass4Governance return
type Pass4GovernanceResult = GovernanceDecision;

export interface RunPipelineOptions {
  manuscriptText: string;
  workType: string;
  title: string;
  jobId?: string;
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
    runQualityGate?: (
      synthesis: SynthesisOutput,
      pass1: SinglePassOutput,
      pass2: SinglePassOutput,
      manuscriptText?: string,
    ) => QualityGateResult;
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

function nowMs(): number {
  return Date.now();
}

type PipelineTimings = {
  total_ms?: number;
  pass1_ms?: number;
  pass2_ms?: number;
  pass3_ms?: number;
  pass4_ms?: number;
};

function logPipelineTimings(
  stage: "success" | "failure",
  meta: {
    manuscriptId?: string;
    title: string;
    workType: string;
    failedAt?: "pass1" | "pass2" | "pass3" | "pass4";
    errorCode?: string;
    timings: PipelineTimings;
  },
): void {
  console.log("[Pipeline][Timings]", {
    stage,
    manuscript_id: meta.manuscriptId ?? null,
    title: meta.title,
    work_type: meta.workType,
    failed_at: meta.failedAt ?? null,
    error_code: meta.errorCode ?? null,
    ...meta.timings,
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

function normalizeRecommendationAction(action: string): string {
  return action.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeRecommendationsPreGate(synthesis: SynthesisOutput): {
  synthesis: SynthesisOutput;
  removedCount: number;
} {
  const seenActions = new Set<string>();
  let removedCount = 0;

  const criteria = synthesis.criteria.map((criterion) => {
    const recommendations = criterion.recommendations.filter((rec) => {
      const normalizedAction = normalizeRecommendationAction(rec.action);
      if (!normalizedAction) return true;
      if (seenActions.has(normalizedAction)) {
        removedCount += 1;
        return false;
      }
      seenActions.add(normalizedAction);
      return true;
    });

    return {
      ...criterion,
      recommendations,
    };
  });

  return {
    synthesis: {
      ...synthesis,
      criteria,
    },
    removedCount,
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
  const pipelineStartMs = nowMs();
  const timings: PipelineTimings = {};

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
  // Pass 4 state — owned exclusively by runPipeline(), passed explicitly to adapter
  let crossCheckResult: CrossCheckOutput | undefined;
  let pass4Governance: Pass4GovernanceResult | undefined;

  // ── Pass 1 + Pass 2: Parallel execution ────────────────────────────────
  //
  // INDEPENDENCE GUARANTEE
  // Pass 2 receives ONLY manuscript text (see _runPass2 signature — no Pass 1
  // parameter exists). It never reads or depends on Pass 1 output, making true
  // parallel execution safe by construction. Any future change that introduces
  // a data dependency between Pass 1 and Pass 2 MUST convert this back to
  // sequential await and update this comment.
  //
  // FAILURE PRECEDENCE RULE (binding)
  // We use Promise.allSettled (never Promise.all) so both passes always run to
  // completion regardless of the other's outcome.
  //   • Only Pass 1 fails  → return Pass 1 failure. Pass 2 result discarded.
  //   • Only Pass 2 fails  → return Pass 2 failure. Pass 1 result discarded.
  //   • Both fail          → Pass 1 failure is the canonical return value.
  //                          Pass 2 failure is logged at ERROR level for audit.
  //                          Both error_code values appear in the log.
  //   • Both succeed       → proceed to Pass 3 synthesis (sequential, by
  //                          design — Pass 3 requires both outputs).
  //
  // This precedence rule is deterministic and must not be changed without
  // updating both this comment and the audit log structure below.
  const pass1StartMs = nowMs();
  const pass2StartMs = nowMs();

  const pass1Promise = withTimeout(
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
  ).finally(() => {
    timings.pass1_ms = nowMs() - pass1StartMs;
  });

  const pass2Promise = withTimeout(
    _runPass2({
      manuscriptText: opts.manuscriptText,
      workType: opts.workType,
      title: opts.title,
      executionMode: opts.executionMode,
      model: opts.model,
      openaiApiKey: opts.openaiApiKey,
      manuscriptId: opts.manuscriptId,
      jobId: opts.jobId,
      registry,
    }),
    passTimeoutMs,
    "Pass 2",
  ).finally(() => {
    timings.pass2_ms = nowMs() - pass2StartMs;
  });

  const [pass1Settled, pass2Settled] = await Promise.allSettled([pass1Promise, pass2Promise]);

  const normalizePassFailure = (pass: "pass1" | "pass2" | "pass3", reason: unknown) => {
    const message = String(reason instanceof Error ? reason.message : reason);
    const timeoutCode =
      pass === "pass1" ? "PASS1_TIMEOUT" : pass === "pass2" ? "PASS2_TIMEOUT" : "PASS3_TIMEOUT";
    if (reason instanceof JsonBoundaryError) {
      const prefix = pass === "pass1" ? "PASS1" : pass === "pass2" ? "PASS2" : "PASS3";
      return {
        message,
        errorCode: `${prefix}_${reason.code}`,
        failedAt: pass,
        failureDetails: {
          json_boundary: {
            code: reason.code,
            candidates_found: reason.candidatesFound,
            raw_head: reason.raw.slice(0, 1000),
            raw_tail: reason.raw.slice(-500),
            normalized_tail: reason.normalized.slice(-250),
            candidate_tail: reason.candidate?.slice(-250),
          },
        },
      } as const;
    }
    const genericCode = pass === "pass1" ? "PASS1_FAILED" : pass === "pass2" ? "PASS2_FAILED" : "PASS3_FAILED";
    const failedAt = pass;
    return {
      message,
      errorCode: message.includes("timed out") ? timeoutCode : genericCode,
      failedAt,
      failureDetails: undefined,
    } as const;
  };

  const pass1Failed = pass1Settled.status === "rejected";
  const pass2Failed = pass2Settled.status === "rejected";

  // ── Failure routing (implements the FAILURE PRECEDENCE RULE above) ────────
  if (pass1Failed && pass2Failed) {
    // DUAL-FAILURE BRANCH: Pass 1 failure is canonical per the precedence rule.
    // Both failures are logged here — this log is the sole audit record of
    // the secondary (Pass 2) failure and must not be removed.
    const pass1Failure = normalizePassFailure("pass1", pass1Settled.reason);
    const pass2Failure = normalizePassFailure("pass2", pass2Settled.reason);

    console.error("[Pipeline] Parallel pass dual failure", {
      manuscript_id: opts.manuscriptId ?? null,
      title: opts.title,
      work_type: opts.workType,
      pass1: {
        error_code: pass1Failure.errorCode,
        error: pass1Failure.message,
      },
      pass2: {
        error_code: pass2Failure.errorCode,
        error: pass2Failure.message,
      },
      timings,
    });

    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: pass1Failure.failedAt,
      errorCode: pass1Failure.errorCode,
      timings,
    });

    return {
      ok: false,
      error: `${pass1Failure.message} | secondary: ${pass2Failure.message}`,
      error_code: pass1Failure.errorCode,
      failed_at: pass1Failure.failedAt,
      failure_details: pass1Failure.failureDetails,
    };
  }

  if (pass1Failed) {
    const failure = normalizePassFailure("pass1", pass1Settled.reason);
    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: failure.failedAt,
      errorCode: failure.errorCode,
      timings,
    });
    return {
      ok: false,
      error: failure.message,
      error_code: failure.errorCode,
      failed_at: failure.failedAt,
      failure_details: failure.failureDetails,
    };
  }

  if (pass2Failed) {
    const failure = normalizePassFailure("pass2", pass2Settled.reason);
    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: failure.failedAt,
      errorCode: failure.errorCode,
      timings,
    });
    return {
      ok: false,
      error: failure.message,
      error_code: failure.errorCode,
      failed_at: failure.failedAt,
      failure_details: failure.failureDetails,
    };
  }

  pass1Output = pass1Settled.value;
  pass2Output = pass2Settled.value;

  {
    const llrResult = enforceLessonsLearnedStage("post_structural", "pass1", {
      structural_result: pass1Output,
      registry,
    });
    if (llrResult) return llrResult;
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
    const pass3StartMs = nowMs();
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
    timings.pass3_ms = nowMs() - pass3StartMs;
  } catch (err) {
    const failure = normalizePassFailure("pass3", err);
    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: failure.failedAt,
      errorCode: failure.errorCode,
      timings,
    });
    return {
      ok: false,
      error: failure.message,
      error_code: failure.errorCode,
      failed_at: failure.failedAt,
      failure_details: failure.failureDetails,
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
  const dedupeResult = dedupeRecommendationsPreGate(pass3Output);
  pass3Output = dedupeResult.synthesis;
  if (dedupeResult.removedCount > 0) {
    console.log("[Pipeline][PreGate] recommendation dedupe applied", {
      manuscript_id: opts.manuscriptId ?? null,
      title: opts.title,
      removed_recommendations: dedupeResult.removedCount,
    });
  }

  const pass4StartMs = nowMs();
  const qualityGate = _runQualityGate(pass3Output, pass1Output, pass2Output, opts.manuscriptText);
  timings.pass4_ms = nowMs() - pass4StartMs;
  if (!qualityGate.pass) {
    const qualityGateCheckpoint = getGovernanceCheckpointById("QUALITY_GATE", governanceInjectionMap);
    const failedChecks = qualityGate.checks.filter((c) => !c.passed);
    const errorCode = failedChecks[0]?.error_code ?? "QG_UNKNOWN";
    const details = failedChecks.map((c) => c.details ?? c.error_code).join("; ");
    const qualityGateTelemetry = summarizeQualityGateFailures(qualityGate.checks);

    console.warn("[Pipeline][QualityGate] failure", {
      manuscript_id: opts.manuscriptId ?? null,
      work_type: opts.workType,
      title: opts.title,
      ...qualityGateTelemetry,
      warning_count: qualityGate.warnings.length,
      warning_samples: qualityGate.warnings.slice(0, 5),
      failed_check_details: failedChecks.slice(0, 5).map((check) => ({
        check_id: check.check_id,
        error_code: check.error_code ?? "QG_UNKNOWN",
        details: check.details,
      })),
    });

    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: "pass4",
      errorCode,
      timings,
    });

    return {
      ok: false,
      error: `Quality gate failed: ${details}${checkpointContext(qualityGateCheckpoint)}`,
      error_code: errorCode,
      failed_at: "pass4",
    };
  }

  // ── Pass 4b: Optional external cross-check + governance ─────────────────
  // Cross-check runs only on the success path (quality gate already passed).
  // Fail-soft on execution; fail-hard if governance decision is not ok.
  if (opts.perplexityApiKey) {
    try {
      // Map SynthesizedCriterion[] → Record<CriterionKey, OpenAICriterionInput>
      const criteriaRecord = Object.fromEntries(
        pass3Output.criteria.map((c) => [
          c.key,
          {
            score: c.final_score_0_10,
            rationale: c.final_rationale,
            evidence: c.evidence.map((e) => e.snippet).filter(Boolean),
          } satisfies import("./perplexityCrossCheck").OpenAICriterionInput,
        ]),
      ) as Record<import("./perplexityCrossCheck").CriterionKey, import("./perplexityCrossCheck").OpenAICriterionInput>;

      crossCheckResult = await runPerplexityCrossCheck({
        openaiCriteria: criteriaRecord,
        openaiSynthesis: pass3Output.overall?.one_paragraph_summary ?? "",
        manuscriptExcerpt: opts.manuscriptText,
        workType: opts.workType,
        title: opts.title,
        perplexityApiKey: opts.perplexityApiKey,
      });
    } catch (err) {
      console.warn(
        "[Pass4] Perplexity cross-check failed (non-fatal):",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  pass4Governance = evaluatePass4Governance(crossCheckResult);

  if (pass4Governance && !pass4Governance.ok) {
    const errorCode = pass4Governance.blockCode ?? "PASS4_GOVERNANCE_FAILED";
    timings.total_ms = nowMs() - pipelineStartMs;
    logPipelineTimings("failure", {
      manuscriptId: opts.manuscriptId,
      title: opts.title,
      workType: opts.workType,
      failedAt: "pass4",
      errorCode,
      timings,
    });

    return {
      ok: false,
      error: `Pass 4 governance failed: ${pass4Governance.message ?? pass4Governance.blockCode ?? "unknown governance error"}`,
      error_code: errorCode,
      failed_at: "pass4",
    };
  }

  timings.total_ms = nowMs() - pipelineStartMs;
  logPipelineTimings("success", {
    manuscriptId: opts.manuscriptId,
    title: opts.title,
    workType: opts.workType,
    timings,
  });

  return {
    ok: true,
    synthesis: pass3Output,
    quality_gate: qualityGate,
    cross_check: crossCheckResult,
    pass4_governance: pass4Governance,
  };
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
  /** Pass 4 cross-check result — must be threaded from runPipeline(), never inferred */
  crossCheckResult?: CrossCheckOutput;
  /** Pass 4 governance decision — must be threaded from runPipeline(), never inferred */
  pass4Governance?: Pass4GovernanceResult;
}

const DEFAULT_ADAPTER_CONFIDENCE = 0.85;
const INCOMPLETE_CRITERIA_WARNING = "INCOMPLETE_CRITERIA_SET";
const PLACEHOLDER_CLUSTER_THRESHOLD = 5;

function isThinText(value: string | undefined, minWords = 6): boolean {
  const text = value?.trim() ?? "";
  if (!text) return true;
  return text.split(/\s+/).filter(Boolean).length < minWords;
}

function looksPlaceholderRationale(rationale: string): boolean {
  const normalized = rationale.toLowerCase();
  return [
    "did not provide a specific score",
    "did not provide specific score",
    "did not provide specific analysis",
    "did not provide a specific analysis",
    "no specific score",
    "no specific analysis",
    "insufficient information",
    "insufficient evidence",
    "unable to assess",
  ].some((pattern) => normalized.includes(pattern));
}

function assessCriteriaCompleteness(criteria: EvaluationResultV1["criteria"]): {
  warnings: string[];
  confidence: number;
} {
  const presentKeys = new Set(criteria.map((c) => c.key));
  const missingKeys = CRITERIA_KEYS.filter((key) => !presentKeys.has(key));

  const zeroScoreCount = criteria.filter((c) => c.score_0_10 === 0).length;

  const placeholderKeys = criteria
    .filter((criterion) => {
      const placeholderRationale = looksPlaceholderRationale(criterion.rationale);
      const thinEvidence =
        criterion.evidence.length === 0 || criterion.evidence.every((e) => isThinText(e.snippet, 4));
      const thinRecommendations =
        criterion.recommendations.length === 0 ||
        criterion.recommendations.every(
          (r) => isThinText(r.action) || isThinText(r.expected_impact),
        );

      return (
        (criterion.score_0_10 === 0 && placeholderRationale) ||
        (placeholderRationale && thinEvidence) ||
        (criterion.score_0_10 === 0 && thinEvidence && thinRecommendations)
      );
    })
    .map((c) => c.key);

  const hasPlaceholderCluster =
    placeholderKeys.length >= PLACEHOLDER_CLUSTER_THRESHOLD && zeroScoreCount >= PLACEHOLDER_CLUSTER_THRESHOLD;

  if (missingKeys.length === 0 && !hasPlaceholderCluster) {
    return {
      warnings: [],
      confidence: DEFAULT_ADAPTER_CONFIDENCE,
    };
  }

  const warnings: string[] = [];

  if (missingKeys.length > 0) {
    warnings.push(
      `${INCOMPLETE_CRITERIA_WARNING}: missing_keys=${missingKeys.join(",")} expected=${CRITERIA_KEYS.length} actual=${criteria.length}`,
    );
  }

  if (hasPlaceholderCluster) {
    warnings.push(
      `${INCOMPLETE_CRITERIA_WARNING}: placeholder_cluster_count=${placeholderKeys.length} zero_score_count=${zeroScoreCount} sample=${placeholderKeys
        .slice(0, 5)
        .join(",")}`,
    );
  }

  const confidence = Math.max(
    0,
    DEFAULT_ADAPTER_CONFIDENCE - (missingKeys.length > 0 ? 0.2 : 0) - (hasPlaceholderCluster ? 0.15 : 0),
  );

  return {
    warnings,
    confidence,
  };
}

/**
 * Map a SynthesisOutput (Phase 2.7 pipeline result) to EvaluationResultV1
 * so that downstream code (phase2.ts, report UI, A6 credibility) works unchanged.
 */
export function synthesisToEvaluationResult(
  opts: SynthesisToEvaluationResultOptions,
): EvaluationResultV1 {
  const { synthesis, ids, crossCheckResult, pass4Governance } = opts;

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

  const completenessAssessment = assessCriteriaCompleteness(criteria);

  const governanceWarnings = [...completenessAssessment.warnings];

  if (crossCheckResult?.warnings?.length) {
    governanceWarnings.push(...crossCheckResult.warnings);
  }

  if (pass4Governance && !pass4Governance.ok && pass4Governance.message) {
    governanceWarnings.push(pass4Governance.message);
  }

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
      confidence: completenessAssessment.confidence,
      warnings: governanceWarnings,
      limitations: ["Single-chunk evaluation; multi-chunk synthesis in Phase 2.8"],
      policy_family: "multi-pass-dual-axis",
      // Pass 4 governance data is returned on PipelineResult, not stored on EvaluationResultV1
      // Callers who need it read it from the pipeline success result directly.
    },
  };
}
