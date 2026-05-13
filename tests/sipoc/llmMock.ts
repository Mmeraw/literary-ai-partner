/**
 * tests/sipoc/llmMock.ts
 *
 * Deterministic in-memory LLM mock for the SIPOC runtime harness.
 *
 * The harness never calls a real OpenAI/Perplexity endpoint. Instead, each
 * fail-closed fixture probe constructs a synthesised pass output (or rejects)
 * with characteristics that exercise the production fail-closed branches:
 *
 *   - Pass 1 timeout / truncation (s05)
 *   - Pass 2 independence violation (s06)
 *   - Pass 3 generic / malformed synthesis (s07)
 *
 * The mock is intentionally minimal — just enough to satisfy SinglePassOutput
 * and SynthesisOutput type contracts. Real validation/gate logic in
 * `lib/evaluation/pipeline/**` then decides pass vs fail.
 *
 * All probes complete synchronously; the harness wall-time stays well under
 * the 60-s budget mandated by PR #3.
 */
import type {
  SinglePassOutput,
  SynthesisOutput,
  SynthesizedCriterion,
  AxisCriterionResult,
} from "@/lib/evaluation/pipeline/types";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";

const CRITERION_KEYS: readonly CriterionKey[] = CRITERIA_KEYS;

const GENERATED_AT = "2026-05-13T00:00:00.000Z";

const PASS_MODELS = {
  pass1: "gpt-4o-2024-08-06",
  pass2: "gpt-4o-2024-08-06",
  pass3: "gpt-4o-2024-08-06",
} as const;

function baseCriterion(key: CriterionKey, rationale: string): AxisCriterionResult {
  return {
    key,
    score_0_10: 6,
    rationale,
    evidence: [],
    recommendations: [],
  };
}

/** Healthy pass output for a single axis. Used as a baseline for mutation. */
export function mockHealthyPass(pass: 1 | 2): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERION_KEYS.map((k) =>
      baseCriterion(
        k,
        `Deterministic SIPOC mock rationale for ${k} (pass ${pass}). ` +
          "Anchored on the manuscript text. Specific to the criterion. " +
          "Mechanism: this works because the rationale references concrete details. " +
          "Specific fix: tighten the third paragraph. Reader effect: increased pressure.",
      ),
    ),
    model: pass === 1 ? PASS_MODELS.pass1 : PASS_MODELS.pass2,
    prompt_version: "sipoc-mock-v1",
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

/** Trigger PASS1_TIMEOUT by rejecting with the exact timeout message string the runtime keys on. */
export async function mockPass1Timeout(): Promise<SinglePassOutput> {
  return Promise.reject(new Error("pass1 timed out after 1ms"));
}

/** Pass 2 that uses identical n-gram phrasing to pass 1 (forces independence guard to fail). */
export function mockPass2IndependenceBreach(pass1: SinglePassOutput): SinglePassOutput {
  const sharedRationale =
    "The scene opens softly, then the bell tolls and the protagonist hesitates while everyone else is moving forward at a measured pace through the corridor.";

  const mutatedPass1Criteria: AxisCriterionResult[] = pass1.criteria.map((c) => ({
    ...c,
    rationale: sharedRationale,
  }));
  pass1.criteria.splice(0, pass1.criteria.length, ...mutatedPass1Criteria);

  return {
    pass: 2,
    axis: "editorial_literary",
    criteria: CRITERION_KEYS.map((k) => ({
      key: k,
      score_0_10: 6,
      rationale: sharedRationale,
      evidence: [],
      recommendations: [],
    })),
    model: PASS_MODELS.pass2,
    prompt_version: "sipoc-mock-v1",
    temperature: 0.2,
    generated_at: GENERATED_AT,
  };
}

function genericCriterion(key: CriterionKey): SynthesizedCriterion {
  return {
    key,
    craft_score: 6,
    editorial_score: 6,
    final_score_0_10: 6,
    score_delta: 0,
    final_rationale: "Generic rationale.",
    pressure_points: [],
    decision_points: [],
    consequence_status: "landed",
    evidence: [],
    recommendations: [
      {
        priority: "high",
        action: "improve the prose",
        expected_impact: "better reading experience",
        anchor_snippet: "",
        source_pass: 3,
        issue_family: "PROSE_CONTROL" as unknown as SynthesizedCriterion["recommendations"][number]["issue_family"],
        strategic_lever:
          "TIGHTEN_PROSE" as unknown as SynthesizedCriterion["recommendations"][number]["strategic_lever"],
        revision_granularity:
          "PASSAGE" as unknown as SynthesizedCriterion["recommendations"][number]["revision_granularity"],
        mechanism: "",
        specific_fix: "",
        reader_effect: "",
      },
    ],
  };
}

/** Synthesis with anchorless / generic recommendations → triggers QG_GENERIC_REC at quality gate. */
export function mockPass3GenericSynthesis(): SynthesisOutput {
  return {
    criteria: CRITERION_KEYS.map(genericCriterion),
    overall: {
      overall_score_0_100: 60,
      verdict: "revise",
      one_paragraph_summary: "Generic synthesis.",
      top_3_strengths: ["x", "y", "z"],
      top_3_risks: ["a", "b", "c"],
      submission_readiness: "close",
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

/** Synthesis with score_range violation: integer above 10 → QG_SCORE_RANGE. */
export function mockPass3OutOfRangeScore(): SynthesisOutput {
  const synth = mockPass3GenericSynthesis();
  synth.criteria = synth.criteria.map((c) => ({
    ...c,
    final_score_0_10: 99,
  }));
  return synth;
}
