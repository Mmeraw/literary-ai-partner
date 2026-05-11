/**
 * #286 Canary: Pass 3 recommendation contract hardening
 *
 * Validates that recommendations following the v8 five-part prompt structure
 * (Anchor → Symptom → Mechanism → Concrete Move → Reader Effect) satisfy the
 * QG_EDITORIAL_GENERIC_FEEDBACK gate without blocks.
 *
 * Also validates that known pre-v8 failure patterns are still caught, confirming
 * the gate is unchanged and only the generation quality improved.
 *
 * Classification targets (from #285 baseline):
 *   Primary:   missing_mechanism
 *   Secondary: missing_anchor, missing_symptom, missing_fix, missing_reader_effect
 */

import { describe, expect, it } from "@jest/globals";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import { PASS3_PROMPT_VERSION } from "@/lib/evaluation/pipeline/prompts/pass3-synthesis";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type { SynthesisOutput, SynthesizedCriterion } from "@/lib/evaluation/pipeline/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function baseCriterion(key: CriterionKey, overrides: Partial<SynthesizedCriterion> = {}): SynthesizedCriterion {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale: `Criterion ${key} is grounded in direct textual evidence with criterion-specific analysis meeting rationale depth requirements.`,
    pressure_points: ["Pressure signals accumulate at the scene transition."],
    decision_points: ["A consequential choice is reached at the chapter turn."],
    consequence_status: "landed",
    evidence: [{ snippet: `Evidence for ${key}: the scene turn carries narrative weight confirmed by textual detail.` }],
    recommendations: [],
    ...overrides,
  };
}

function makeSynthesis(overrides: Partial<Record<CriterionKey, Partial<SynthesizedCriterion>>> = {}): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => baseCriterion(key, overrides[key] ?? {})),
    overall: {
      overall_score_0_100: 72,
      verdict: "revise",
      one_paragraph_summary: "The manuscript has strong foundational material but needs targeted scene-level revision.",
      top_3_strengths: ["voice", "premise", "character"],
      top_3_risks: ["pacing", "tension delivery", "closure"],
      submission_readiness: "close",
    },
    metadata: {
      pass1_model: "gpt-4o",
      pass2_model: "gpt-4o",
      pass3_model: "gpt-4o",
      generated_at: new Date().toISOString(),
    },
    partial_evaluation: false,
  };
}

// ── Prompt version ────────────────────────────────────────────────────────────

it("PASS3_PROMPT_VERSION reflects v10 non-certified three-and-three contract", () => {
  expect(PASS3_PROMPT_VERSION).toBe("pass3-synthesis-v10-non-certified-three-and-three");
});

// ── Five-part contract: passing fixtures ─────────────────────────────────────

describe("v8 five-part contract — compliant recommendations pass the gate", () => {
  it("recommendation with full A→S→M→F→E structure: no block", () => {
    // All five: anchor (opening scene), symptom (diffuses), mechanism (because), fix (replace), reader effect (urgency)
    const result = runQualityGate(makeSynthesis({
      concept: {
        recommendations: [{
          priority: "medium",
          action: "In the opening scene, replace the abstract reaction line with a concrete sensory beat because the current phrasing diffuses tension before the pivotal decision.",
          expected_impact: "Gives the reader a clearer cause-and-effect chain, increasing urgency and emotional clarity at the turn.",
          anchor_snippet: "He nodded, unsure what to do next.",
          source_pass: 3,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
          mechanism: "the current phrasing diffuses tension before the pivotal decision",
          specific_fix: "replace the abstract reaction line with a concrete sensory beat",
          reader_effect: "clearer cause-and-effect chain, increasing urgency and emotional clarity at the turn",
        }],
      },
    }));

    const editorialCheck = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");
    expect(editorialCheck?.passed).toBe(true);
    expect(result.editorial_diagnostics).toBeUndefined();
  });

  it("recommendation using 'since' as mechanism connector: no block", () => {
    const result = runQualityGate(makeSynthesis({
      voice: {
        recommendations: [{
          priority: "high",
          action: "In the midpoint paragraph, cut the three-line interior monologue since it interrupts the focalization and weakens psychic distance at the emotional peak.",
          expected_impact: "Gives the reader stronger immersion by preserving close-third rendering without collapsing into summary.",
          anchor_snippet: "She wondered whether he had ever meant any of it.",
          source_pass: 3,
          issue_family: "voice",
          strategic_lever: "pov_rendering_precision",
          revision_granularity: "beat",
          mechanism: "it interrupts the focalization and weakens psychic distance at the emotional peak",
          specific_fix: "cut the three-line interior monologue",
          reader_effect: "stronger immersion by preserving close-third rendering without collapsing into summary",
        }],
      },
    }));

    const editorialCheck = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");
    expect(editorialCheck?.passed).toBe(true);
    expect(result.editorial_diagnostics).toBeUndefined();
  });

  it("recommendation using 'so that' as mechanism connector: no block", () => {
    const result = runQualityGate(makeSynthesis({
      narrativeDrive: {
        recommendations: [{
          priority: "medium",
          action: "In the chapter-closing beat, insert a concrete consequence that lands the stalled decision so that the narrative drive carries forward without dissipating momentum.",
          expected_impact: "Increases reader momentum by anchoring the chapter turn to a visible consequence.",
          anchor_snippet: "He closed the folder without reading the last page.",
          source_pass: 3,
          issue_family: "pacing",
          strategic_lever: "momentum_visibility",
          revision_granularity: "beat",
          mechanism: "the stalled decision dissipates narrative momentum without a visible landing consequence",
          specific_fix: "insert a concrete consequence that lands the stalled decision",
          reader_effect: "reader momentum by anchoring the chapter turn to a visible consequence",
        }],
      },
    }));

    const editorialCheck = result.checks.find((c) => c.check_id === "recommendation_editorial_quality");
    expect(editorialCheck?.passed).toBe(true);
    expect(result.editorial_diagnostics).toBeUndefined();
  });
});

// ── Classification targets: pre-v8 patterns still detected (isolated => WARN) ────────────────────

describe("pre-v8 failure patterns remain visible without collapsing whole eval", () => {
  it("[missing_mechanism] no causal connector → warn", () => {
    const result = runQualityGate(makeSynthesis({
      pacing: {
        recommendations: [{
          priority: "medium",
          action: "In the opening scene, replace the flat reaction line with a concrete sensory beat at the chapter turn.",
          expected_impact: "Gives the reader stronger engagement at the turn.",
          anchor_snippet: "He walked away without looking back.",
          source_pass: 3,
          issue_family: "pacing",
          strategic_lever: "momentum_visibility",
          revision_granularity: "scene",
          mechanism: "",
          specific_fix: "replace the flat reaction line with a concrete sensory beat",
          reader_effect: "stronger engagement at the turn",
        }],
      },
    }));

    const diag = result.editorial_diagnostics?.find((d) => d.criterion === "pacing");
    expect(result.pass).toBe(true);
    expect(diag?.classification).toBe("missing_mechanism");
    expect(diag?.action_applied).toBe("warn");
  });

  it("[missing_anchor] no location reference → warn editorially but still fails no_generic_recs", () => {
    const result = runQualityGate(makeSynthesis({
      character: {
        recommendations: [{
          priority: "medium",
          action: "Replace the abstract motivation statement because the current phrasing lacks stakes and weakens character agency.",
          expected_impact: "Gives the reader clearer stakes and engagement.",
          anchor_snippet: "",
          source_pass: 3,
          issue_family: "characterization",
          strategic_lever: "character_voice_differentiation",
          revision_granularity: "beat",
          mechanism: "the current phrasing lacks stakes and weakens character agency",
          specific_fix: "replace the abstract motivation statement",
          reader_effect: "clearer stakes and engagement",
        }],
      },
    }));

    const diag = result.editorial_diagnostics?.find((d) => d.criterion === "character");
    expect(result.pass).toBe(false);
    expect(diag?.classification).toBe("missing_anchor");
    expect(diag?.action_applied).toBe("warn");
  });

  it("[missing_reader_effect] expected_impact has no reader-facing word → warn", () => {
    const result = runQualityGate(makeSynthesis({
      sceneConstruction: {
        recommendations: [{
          priority: "low",
          action: "In the second scene, insert a concrete consequence beat because the scene currently dissipates tension before the pivotal moment.",
          expected_impact: "This change will tighten the structure and improve narrative arc flow.",
          anchor_snippet: "The door clicked shut behind her.",
          source_pass: 3,
          issue_family: "scene_structure",
          strategic_lever: "scene_goal_clarity",
          revision_granularity: "scene",
          mechanism: "the scene currently dissipates tension before the pivotal moment",
          specific_fix: "insert a concrete consequence beat",
          reader_effect: "",
        }],
      },
    }));

    const diag = result.editorial_diagnostics?.find((d) => d.criterion === "sceneConstruction");
    expect(result.pass).toBe(true);
    expect(diag?.classification).toBe("missing_reader_effect");
    expect(diag?.action_applied).toBe("warn");
  });

  it("[missing_fix] no active fix-marker verb → warn", () => {
    const result = runQualityGate(makeSynthesis({
      theme: {
        recommendations: [{
          priority: "low",
          action: "In the opening scene, enhance the thematic resonance because the current framing lacks clarity for the reader at the chapter turn.",
          expected_impact: "Gives the reader stronger thematic coherence and payoff.",
          anchor_snippet: "The city spread out below like a broken mirror.",
          source_pass: 3,
          issue_family: "theme",
          strategic_lever: "thematic_grounding",
          revision_granularity: "scene",
          mechanism: "the current framing lacks clarity for the reader at the chapter turn",
          specific_fix: "",
          reader_effect: "stronger thematic coherence and payoff",
        }],
      },
    }));

    const diag = result.editorial_diagnostics?.find((d) => d.criterion === "theme");
    expect(result.pass).toBe(true);
    expect(diag?.classification).toBe("missing_fix");
    expect(diag?.action_applied).toBe("warn");
  });
});

// ── Diagnostics summary shape after v8 contract run ──────────────────────────

describe("diagnostics summary shape on mixed pass/fail synthesis", () => {
  it("summary block_reason_histogram is zero when diagnostics are warn-only", () => {
    const synthesis = makeSynthesis({
      dialogue: {
        recommendations: [{
          priority: "medium",
          action: "In the opening exchange, replace the abstract dialogue tag at the scene turn because it lacks attribution mechanism and weakens speaker clarity.",
          expected_impact: "Gives the reader stronger immersion and engagement through clear speaker grounding.",
          anchor_snippet: "\"I know,\" she said.",
          source_pass: 3,
          issue_family: "dialogue",
          strategic_lever: "dialogue_exposition_density",
          revision_granularity: "beat",
          mechanism: "the abstract dialogue tag lacks attribution mechanism and weakens speaker clarity",
          specific_fix: "replace the abstract dialogue tag at the scene turn",
          reader_effect: "stronger immersion and engagement through clear speaker grounding",
        }],
      },
      pacing: {
        recommendations: [{
          priority: "medium",
          action: "In the midpoint scene, insert a concrete stakes beat because the current phrasing stalls narrative tension before the chapter decision.",
          expected_impact: "Improves the section overall.",
          anchor_snippet: "He paused at the threshold.",
          source_pass: 3,
          issue_family: "pacing",
          strategic_lever: "momentum_visibility",
          revision_granularity: "scene",
          mechanism: "the current phrasing stalls narrative tension before the chapter decision",
          specific_fix: "insert a concrete stakes beat",
          reader_effect: "",
        }],
      },
    });

    const result = runQualityGate(synthesis);
    // dialogue passes; pacing is flagged but isolated defects are warn-only
    expect(result.pass).toBe(true);
    expect(result.editorial_diagnostics_summary).toBeDefined();

    const histogram = result.editorial_diagnostics_summary?.block_reason_histogram ?? {};
    const totalBlocked = Object.values(histogram).reduce((a, b) => a + b, 0);
    expect(totalBlocked).toBe(0);
    expect(result.editorial_diagnostics?.some((d) => d.action_applied === "warn")).toBe(true);
    // All histogram keys must be canonical EditorialDiagnosticClassification values
    const validKeys = new Set([
      "generic_feedback", "missing_symptom", "missing_mechanism",
      "missing_fix", "missing_reader_effect", "missing_anchor", "duplicate_reasoning",
    ]);
    for (const key of Object.keys(histogram)) {
      expect(validKeys.has(key)).toBe(true);
    }
  });
});
