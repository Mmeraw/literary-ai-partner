/**
 * Phase 2.7 — Pass 2 Lexical Independence Guard Tests (#314)
 *
 * Validates:
 * 1. enforcePass2LexicalIndependence rewrites rationale when observed_overlap_count >= 5.
 * 2. Pipeline returns PASS2_INDEPENDENCE_REWRITE_FAILED when overlap is still >= 6 after rewrite.
 * 3. Mechanism-based rewrite templates produce rationale with < 6 overlap against typical Pass 1 phrasing.
 * 4. Guard does not fire when overlap is below threshold.
 * 5. Guard does not modify Pass 1 output.
 */

import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  enforcePass2LexicalIndependence,
  PASS2_INDEPENDENCE_REWRITE_TRIGGER,
  PASS2_INDEPENDENCE_FAIL_THRESHOLD,
} from "@/lib/evaluation/pipeline/pass2IndependenceGuard";
import {
  collectNgrams,
  QG_INDEPENDENCE_NGRAM_SIZE,
} from "@/lib/evaluation/pipeline/qualityGate";
import type { SinglePassOutput, PipelineResult } from "@/lib/evaluation/pipeline/types";

/** Assertion helper: narrows PipelineResult to the ok: false branch. */
function assertPipelineFailed(
  result: PipelineResult,
): asserts result is Extract<PipelineResult, { ok: false }> {
  if (result.ok) throw new Error("Expected pipeline failure but result was ok");
}

// ── Fixture builders ──────────────────────────────────────────────────────────

function makePass(pass: 1 | 2, worldbuildingRationale: string): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      score_0_10: 7,
      rationale:
        key === "worldbuilding"
          ? worldbuildingRationale
          : `Independent editorial analysis for ${key} criterion at pass ${pass}.`,
      evidence: [],
      recommendations: [],
    })),
    model: "gpt-4o-mini",
    prompt_version: pass === 1 ? "pass1-v1" : "pass2-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Count unique 8-gram overlaps between two rationale strings, excluding evidence n-grams.
 */
function countRationaleOverlap(
  pass1Rationale: string,
  pass2Rationale: string,
  evidenceSnippets: string[] = [],
): number {
  const ngramSize = QG_INDEPENDENCE_NGRAM_SIZE;
  const evidenceNgrams = new Set<string>();
  for (const snippet of evidenceSnippets) {
    for (const gram of collectNgrams(snippet, ngramSize)) {
      evidenceNgrams.add(gram);
    }
  }
  const pass1Ngrams = new Set<string>();
  for (const gram of collectNgrams(pass1Rationale, ngramSize)) {
    if (!evidenceNgrams.has(gram)) pass1Ngrams.add(gram);
  }
  const overlapNgrams = new Set<string>();
  for (const gram of collectNgrams(pass2Rationale, ngramSize)) {
    if (!evidenceNgrams.has(gram) && pass1Ngrams.has(gram)) {
      overlapNgrams.add(gram);
    }
  }
  return overlapNgrams.size;
}

// ── Constants sanity ─────────────────────────────────────────────────────────

describe("Pass 2 independence guard — constant sanity", () => {
  it("REWRITE_TRIGGER is QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION - 1 = 5", () => {
    expect(PASS2_INDEPENDENCE_REWRITE_TRIGGER).toBe(5);
  });

  it("FAIL_THRESHOLD is QG_INDEPENDENCE_MIN_OVERLAPS_PER_CRITERION = 6", () => {
    expect(PASS2_INDEPENDENCE_FAIL_THRESHOLD).toBe(6);
  });
});

// ── True-overlap case (mirrors confirmed proof job 4e45f7eb) ─────────────────

describe("Pass 2 independence guard — true_overlap rewrite (worldbuilding)", () => {
  // Confirmed from evaluation_artifacts for job 4e45f7eb-da56-4458-bef7-30c35b01f923
  const pass1WorldbuildingRationale =
    "The world is richly detailed, with a strong sense of place and cultural context.";
  const pass2WorldbuildingRationale =
    "The world is richly detailed, with a strong sense of place and cultural history that enhances the narrative.";

  it("confirmed fixture produces observed_overlap_count = 6 (above threshold)", () => {
    const count = countRationaleOverlap(
      pass1WorldbuildingRationale,
      pass2WorldbuildingRationale,
    );
    // confirmed: 6 overlapping 8-grams
    expect(count).toBeGreaterThanOrEqual(PASS2_INDEPENDENCE_FAIL_THRESHOLD);
  });

  it("rewrite is applied when overlap >= REWRITE_TRIGGER", () => {
    const pass1 = makePass(1, pass1WorldbuildingRationale);
    const pass2 = makePass(2, pass2WorldbuildingRationale);

    const result = enforcePass2LexicalIndependence(pass1, pass2);

    expect(result.rewriteApplied).toBe(true);
    expect(result.rewrittenKeys).toContain("worldbuilding");
  });

  it("rewritten worldbuilding rationale has overlap < FAIL_THRESHOLD against confirmed Pass 1", () => {
    const pass1 = makePass(1, pass1WorldbuildingRationale);
    const pass2 = makePass(2, pass2WorldbuildingRationale);

    const result = enforcePass2LexicalIndependence(pass1, pass2);

    expect(result.ok).toBe(true);
    expect(result.failedKeys).toHaveLength(0);

    // Verify rewritten rationale actually achieves independence
    const rewrittenWorldbuilding = result.output.criteria.find((c) => c.key === "worldbuilding");
    expect(rewrittenWorldbuilding).toBeDefined();

    const postRewriteOverlap = countRationaleOverlap(
      pass1WorldbuildingRationale,
      rewrittenWorldbuilding!.rationale,
    );
    expect(postRewriteOverlap).toBeLessThan(PASS2_INDEPENDENCE_FAIL_THRESHOLD);
  });

  it("rewritten rationale uses mechanism-based language, not original descriptive phrasing", () => {
    const pass1 = makePass(1, pass1WorldbuildingRationale);
    const pass2 = makePass(2, pass2WorldbuildingRationale);

    const result = enforcePass2LexicalIndependence(pass1, pass2);

    const rewrittenWorldbuilding = result.output.criteria.find((c) => c.key === "worldbuilding");
    expect(rewrittenWorldbuilding).toBeDefined();

    // Must not reuse the original descriptive stem
    expect(rewrittenWorldbuilding!.rationale).not.toContain("richly detailed");
    expect(rewrittenWorldbuilding!.rationale).not.toContain("strong sense of place");
    // Must use mechanism vocabulary
    const text = rewrittenWorldbuilding!.rationale.toLowerCase();
    const hasMechanismVerb = /channels|generates|produces|activates|establishes|drives|anchors|conditions|calibrates/.test(text);
    expect(hasMechanismVerb).toBe(true);
  });

  it("original Pass 2 output (before guard) would trigger QG_INDEPENDENCE_VIOLATION", () => {
    // This confirms the guard is necessary: the raw LLM output has true_overlap
    const overlap = countRationaleOverlap(
      pass1WorldbuildingRationale,
      pass2WorldbuildingRationale,
    );
    expect(overlap).toBeGreaterThanOrEqual(PASS2_INDEPENDENCE_FAIL_THRESHOLD);
  });
});

// ── Below-threshold case (no rewrite) ────────────────────────────────────────

describe("Pass 2 independence guard — no rewrite when overlap < REWRITE_TRIGGER", () => {
  it("does not rewrite when overlap is below threshold", () => {
    const pass1 = makePass(1, "Narrative drive propels the story forward with urgency.");
    const pass2 = makePass(
      2,
      "The worldbuilding scaffolding channels spatial legibility across scene boundaries.",
    );

    const result = enforcePass2LexicalIndependence(pass1, pass2);

    expect(result.rewriteApplied).toBe(false);
    expect(result.rewrittenKeys).toHaveLength(0);
    expect(result.ok).toBe(true);
    // Output must be the same object reference (no copy made)
    expect(result.output).toBe(pass2);
  });

  it("does not modify Pass 1 output", () => {
    const pass1WorldbuildingRationale =
      "The world is richly detailed, with a strong sense of place and cultural context.";
    const pass1 = makePass(1, pass1WorldbuildingRationale);
    const pass2 = makePass(
      2,
      "The world is richly detailed, with a strong sense of place and cultural history.",
    );
    const pass1CriteriaSnapshot = JSON.stringify(pass1.criteria);

    enforcePass2LexicalIndependence(pass1, pass2);

    // Pass 1 must be unmodified
    expect(JSON.stringify(pass1.criteria)).toBe(pass1CriteriaSnapshot);
  });
});

// ── Fail-closed after failed rewrite ─────────────────────────────────────────

describe("Pass 2 independence guard — fail-closed when rewrite still exceeds threshold", () => {
  it("returns ok=false and failedKeys when rewrite rationale overlaps Pass 1", () => {
    // Construct a Pass 1 whose n-grams exactly match the mechanism rewrite template
    // so that even the deterministic rewrite would fail the overlap check.
    // We achieve this by using the rewrite template text verbatim as Pass 1 rationale.
    const worldbuildingTemplate =
      "Environmental scaffolding channels reader orientation through locational and cultural reference points, establishing spatial legibility across scene boundaries.";

    // Build a full pass1 where worldbuilding rationale == the template
    const pass1: SinglePassOutput = {
      pass: 1,
      axis: "craft_execution",
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        score_0_10: 7,
        rationale:
          key === "worldbuilding"
            ? worldbuildingTemplate
            : `Pass 1 structural analysis for ${key} using specific evidence.`,
        evidence: [],
        recommendations: [],
      })),
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    // Pass 2 worldbuilding rationale also uses the template text (max overlap)
    const pass2: SinglePassOutput = {
      pass: 2,
      axis: "editorial_literary",
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        score_0_10: 7,
        rationale:
          key === "worldbuilding"
            ? worldbuildingTemplate // identical — maximum overlap
            : `Pass 2 editorial analysis for ${key} with independent literary judgment.`,
        evidence: [],
        recommendations: [],
      })),
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const result = enforcePass2LexicalIndependence(pass1, pass2);

    // Rewrite was attempted
    expect(result.rewrittenKeys).toContain("worldbuilding");
    // But it still failed because the template == Pass 1 rationale
    expect(result.failedKeys).toContain("worldbuilding");
    expect(result.ok).toBe(false);
  });
});

// ── Pipeline integration: guard blocks job with correct error_code ─────────────

describe("Pass 2 independence guard — pipeline integration", () => {
  // These tests use runPipeline with dependency-injected runners to verify
  // the pipeline correctly surfaces PASS2_INDEPENDENCE_REWRITE_FAILED.

  it("pipeline returns PASS2_INDEPENDENCE_REWRITE_FAILED when guard fails", async () => {
    const { runPipeline } = await import("@/lib/evaluation/pipeline/runPipeline");
    const { CRITERIA_KEYS: keys } = await import("@/schemas/criteria-keys");

    // The rewrite template for worldbuilding is the deterministic output.
    // Use it as Pass 1's rationale so that the rewritten Pass 2 == Pass 1 → fail.
    const worldbuildingTemplate =
      "Environmental scaffolding channels reader orientation through locational and cultural reference points, establishing spatial legibility across scene boundaries.";

    const makePass1 = (): SinglePassOutput => ({
      pass: 1,
      axis: "craft_execution",
      criteria: keys.map((key) => ({
        key,
        score_0_10: 7,
        rationale:
          key === "worldbuilding"
            ? worldbuildingTemplate
            : `Craft analysis for ${key} with structural grounding.`,
        evidence: [],
        recommendations: [],
      })),
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    });

    const makePass2 = (): SinglePassOutput => ({
      pass: 2,
      axis: "editorial_literary",
      criteria: keys.map((key) => ({
        key,
        score_0_10: 7,
        rationale:
          key === "worldbuilding"
            ? worldbuildingTemplate // identical to pass1 → guard will rewrite, but rewrite == pass1 → fail
            : `Editorial analysis for ${key} with independent judgment.`,
        evidence: [],
        recommendations: [],
      })),
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    });

    const result = await runPipeline({
      manuscriptText: "The river moved through the valley.",
      workType: "literary_fiction",
      title: "Independence Guard Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: async () => makePass1(),
        runPass2: async () => makePass2(),
        runPass3Synthesis: async () => {
          throw new Error("Pass 3 should not be called");
        },
        runQualityGate: () => {
          throw new Error("Quality gate should not be called");
        },
        runPass1a: async () => ({
          chunkOutputs: [],
          failedChunkIndices: [],
          model: "gpt-4o",
          prompt_version: "test-v1",
          total_chunks: 0,
          successful_chunks: 0,
        }),
      },
    });

    expect(result.ok).toBe(false);
    assertPipelineFailed(result);
    expect(result.error_code).toBe("PASS2_INDEPENDENCE_REWRITE_FAILED");
    expect(result.failed_at).toBe("pass2");
  });

  it("PASS2_INDEPENDENCE_REWRITE_FAILED includes structured failure_details for auditability", async () => {
    const { runPipeline } = await import("@/lib/evaluation/pipeline/runPipeline");
    const { CRITERIA_KEYS: keys } = await import("@/schemas/criteria-keys");

    const worldbuildingTemplate =
      "Environmental scaffolding channels reader orientation through locational and cultural reference points, establishing spatial legibility across scene boundaries.";

    const makePass1 = (): SinglePassOutput => ({
      pass: 1,
      axis: "craft_execution",
      criteria: keys.map((key) => ({
        key,
        score_0_10: 7,
        rationale:
          key === "worldbuilding"
            ? worldbuildingTemplate
            : `Craft analysis for ${key} with structural grounding.`,
        evidence: [],
        recommendations: [],
      })),
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    });

    const makePass2 = (): SinglePassOutput => ({
      pass: 2,
      axis: "editorial_literary",
      criteria: keys.map((key) => ({
        key,
        score_0_10: 7,
        rationale:
          key === "worldbuilding"
            ? worldbuildingTemplate
            : `Editorial analysis for ${key} with independent judgment.`,
        evidence: [],
        recommendations: [],
      })),
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    });

    const result = await runPipeline({
      manuscriptText: "The river moved through the valley.",
      workType: "literary_fiction",
      title: "Independence Guard Audit Test",
      openaiApiKey: "sk-test",
      _runners: {
        runPass1: async () => makePass1(),
        runPass2: async () => makePass2(),
        runPass3Synthesis: async () => {
          throw new Error("Pass 3 should not be called");
        },
        runQualityGate: () => {
          throw new Error("Quality gate should not be called");
        },
        runPass1a: async () => ({
          chunkOutputs: [],
          failedChunkIndices: [],
          model: "gpt-4o",
          prompt_version: "test-v1",
          total_chunks: 0,
          successful_chunks: 0,
        }),
      },
    });

    expect(result.ok).toBe(false);
    assertPipelineFailed(result);

    expect(result.error_code).toBe("PASS2_INDEPENDENCE_REWRITE_FAILED");
    expect(result.failed_at).toBe("pass2");

    // Structured failure details must be present and auditable
    const details = result.failure_details?.pass2_independence;
    expect(details).toBeDefined();
    expect(details!.failed_keys).toContain("worldbuilding");
    expect(details!.rewritten_keys).toContain("worldbuilding");
    expect(typeof details!.threshold_n).toBe("number");
    expect(typeof details!.threshold_min).toBe("number");
    expect(details!.threshold_n).toBeGreaterThan(0);
    expect(details!.threshold_min).toBeGreaterThan(0);

    // Per-criterion audit record
    expect(Array.isArray(details!.per_failed_criterion)).toBe(true);
    expect(details!.per_failed_criterion.length).toBeGreaterThan(0);
    const wbCriterion = details!.per_failed_criterion.find(
      (c) => c.criterion_key === "worldbuilding",
    );
    expect(wbCriterion).toBeDefined();
    expect(typeof wbCriterion!.initial_overlap_count).toBe("number");
    expect(typeof wbCriterion!.post_rewrite_overlap_count).toBe("number");
    expect(wbCriterion!.initial_overlap_count).toBeGreaterThanOrEqual(details!.threshold_min);
    expect(wbCriterion!.post_rewrite_overlap_count).toBeGreaterThanOrEqual(details!.threshold_min);
  });
});
