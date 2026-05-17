/**
 * tests/stress/mocks/llm.ts
 *
 * Deterministic fault-injecting LLM mock for the pipeline stress harness.
 *
 * Anti-flake guarantees:
 *   - Responses are pre-canned JSON in tests/stress/mocks/responses/. No
 *     dynamic generation per run. Each fault scenario → fixed file.
 *   - Latency is deterministic: by default 0 ms; "hang" faults reject
 *     immediately with a fast-forwarded TimeoutError message that the
 *     pipeline classifies the same way as a real wall-clock timeout. We do
 *     not actually sleep — STRESS_FAST_RETRY=1 is the documented behavior.
 *   - The mock honors a fault-by-call-index map; second invocation of the
 *     same pass deterministically diverges from the first.
 *
 * This module exposes `makeLlmRunners(fault)` returning the three
 * pass-runner functions accepted by runPipeline's `_runners` DI seam. The
 * harness composes runPipeline with these — no production code is patched.
 */

import fs from "fs";
import path from "path";
import type {
  SinglePassOutput,
  SynthesisOutput,
  AxisCriterionResult,
  SynthesizedCriterion,
} from "@/lib/evaluation/pipeline/types";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";

const RESPONSE_DIR = path.resolve("tests/stress/mocks/responses");
const GENERATED_AT = "2026-05-13T00:00:00.000Z";
const PASS_MODELS = {
  pass1: "gpt-4o-2024-08-06",
  pass2: "gpt-4o-2024-08-06",
  pass3: "gpt-4o-2024-08-06",
} as const;

export type LlmFault =
  | { kind: "none" }
  | { kind: "rate-limit"; pass: 1 | 2 | 3 } // L-429
  | { kind: "server-error"; pass: 1 | 2 | 3 } // L-500
  | { kind: "hang"; pass: 1 | 2 | 3; ms: number } // L-hang-*
  | { kind: "empty-string"; pass: 1 | 2 | 3 } // L-empty-str
  | { kind: "empty-object"; pass: 1 | 2 | 3 } // L-empty-obj
  | { kind: "truncated-json"; pass: 1 | 2 | 3 } // L-truncated-json
  | { kind: "finish-length"; pass: 1 | 2 | 3 }; // L-finish-length

export interface RunnerInvocationLog {
  pass: 1 | 2 | 3;
  call_index: number;
  outcome: "ok" | "throw";
  error_message?: string;
  text_length?: number;
}

export interface MockLlmContext {
  fault: LlmFault;
  invocations: RunnerInvocationLog[];
}

function loadCanned<T>(filename: string): T {
  const fullPath = path.join(RESPONSE_DIR, filename);
  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw) as T;
}

function baseCriterion(key: CriterionKey, rationale: string): AxisCriterionResult {
  return {
    key,
    score_0_10: 6,
    rationale,
    evidence: [],
    recommendations: [],
  };
}

/** Healthy single-pass response (mirrors structure used by sipoc llmMock). */
export function healthyPass(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((k) =>
      baseCriterion(
        k,
        `Deterministic stress mock rationale for ${k} (pass ${pass}). ` +
          "Anchored on the manuscript text. Specific to the criterion. " +
          "Mechanism: this works because the rationale references concrete details. " +
          "Specific fix: tighten the third paragraph. Reader effect: increased pressure.",
      ),
    ),
    model: pass === 1 ? PASS_MODELS.pass1 : PASS_MODELS.pass2,
    prompt_version: "stress-mock-v1",
    temperature: 0.2,
    generated_at: GENERATED_AT,
    coverage_summary: {
      fully_evaluated: true,
      analyzed_chars: 1024,
      source_chars: 1024,
      analyzed_words: 200,
      source_words: 200,
      strategy: "full",
    } as unknown as SinglePassOutput["coverage_summary"],
  };
}

function healthySynthCriterion(key: CriterionKey): SynthesizedCriterion {
  return {
    key,
    craft_score: 6,
    editorial_score: 6,
    final_score_0_10: 6,
    score_delta: 0,
    final_rationale:
      "Synthesised final rationale grounded in pass 1 and pass 2 with a concrete mechanism: " +
      "the third paragraph compresses time and signals the protagonist's hesitation. " +
      "Specific fix: tighten the bridging sentence. Reader effect: faster pulse.",
    pressure_points: ["bell tolls"],
    decision_points: ["protagonist hesitates"],
    consequence_status: "landed",
    evidence: [],
    recommendations: [],
  };
}

export function healthySynthesis(): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map(healthySynthCriterion),
    overall: {
      overall_score_0_100: 60,
      verdict: "revise",
      one_paragraph_summary: "Healthy synthesis from stress mock.",
      top_3_strengths: ["pace", "voice", "composition"],
      top_3_risks: ["dialogue density", "exposition", "urgency clarity"],
      submission_readiness: "nearly_ready",
    },
    metadata: {
      pass1_model: PASS_MODELS.pass1,
      pass2_model: PASS_MODELS.pass2,
      pass3_model: PASS_MODELS.pass3,
      generated_at: GENERATED_AT,
    },
    partial_evaluation: false,
  };
}

/**
 * Build the three runner functions used by runPipeline's _runners seam,
 * applying the row's fault to the matching pass.
 *
 * Returns the runner triple + a shared context the harness can read after
 * the run to gather observability (per-call text length, invocation order).
 */
export function makeLlmRunners(fault: LlmFault = { kind: "none" }) {
  const ctx: MockLlmContext = { fault, invocations: [] };
  const callCounts = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;

  function maybeFault(pass: 1 | 2 | 3): Error | null {
    if (fault.kind === "none") return null;
    if ((fault as { pass: number }).pass !== pass) return null;
    switch (fault.kind) {
      case "rate-limit":
        return new Error("OpenAI rate limit exceeded (429)");
      case "server-error":
        return new Error("OpenAI server error (500)");
      case "hang":
        // We do not actually sleep. The pipeline classifies failure-mode by
        // the error message "timed out after Nms". Emit that immediately —
        // outcome under test is "did the pipeline classify correctly?",
        // not "does Node's clock work?".
        return new Error(`pass${pass} timed out after ${fault.ms}ms`);
      case "empty-string":
        return new Error("PASS1_TRUNCATED_EMPTY_RESPONSE: empty LLM response");
      case "empty-object":
        return new Error("PASS_SCHEMA_INVALID: LLM returned {}");
      case "truncated-json":
        return new Error("PASS_JSON_BOUNDARY_FAILED: truncated JSON tail");
      case "finish-length":
        return new Error("empty_response_after_retry: finish_reason=length");
    }
    return null;
  }

  async function runPass1(opts: { manuscriptText?: string }): Promise<SinglePassOutput> {
    callCounts[1] += 1;
    const idx = callCounts[1];
    const err = maybeFault(1);
    if (err) {
      ctx.invocations.push({
        pass: 1,
        call_index: idx,
        outcome: "throw",
        error_message: err.message,
        text_length: opts?.manuscriptText?.length ?? 0,
      });
      throw err;
    }
    ctx.invocations.push({
      pass: 1,
      call_index: idx,
      outcome: "ok",
      text_length: opts?.manuscriptText?.length ?? 0,
    });
    return healthyPass(1);
  }

  async function runPass2(opts: { manuscriptText?: string }): Promise<SinglePassOutput> {
    callCounts[2] += 1;
    const idx = callCounts[2];
    const err = maybeFault(2);
    if (err) {
      ctx.invocations.push({
        pass: 2,
        call_index: idx,
        outcome: "throw",
        error_message: err.message,
        text_length: opts?.manuscriptText?.length ?? 0,
      });
      throw err;
    }
    ctx.invocations.push({
      pass: 2,
      call_index: idx,
      outcome: "ok",
      text_length: opts?.manuscriptText?.length ?? 0,
    });
    return healthyPass(2);
  }

  async function runPass3Synthesis(opts: { manuscriptText?: string }): Promise<SynthesisOutput> {
    callCounts[3] += 1;
    const idx = callCounts[3];
    const err = maybeFault(3);
    if (err) {
      ctx.invocations.push({
        pass: 3,
        call_index: idx,
        outcome: "throw",
        error_message: err.message,
        text_length: opts?.manuscriptText?.length ?? 0,
      });
      throw err;
    }
    ctx.invocations.push({
      pass: 3,
      call_index: idx,
      outcome: "ok",
      text_length: opts?.manuscriptText?.length ?? 0,
    });
    return healthySynthesis();
  }

  // runQualityGate stub: pass = true. Real QG is exercised by SIPOC harness;
  // this harness is plumbing-focused (Tier 1).
  function runQualityGate() {
    return { pass: true, checks: [], warnings: [] };
  }

  return {
    runners: { runPass1, runPass2, runPass3Synthesis, runQualityGate },
    context: ctx,
  };
}

/** Load a canned response file (for documentation/debugging; not strictly required). */
export function loadCannedResponse(name: string): unknown {
  return loadCanned(name);
}
