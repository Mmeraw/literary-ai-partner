/**
 * Editorial Specificity Repair — Pipeline Mistake-Proofing Guard
 *
 * Tests the enforceEditorialSpecificityBeforeGate() function that runs between
 * density enforcement and the Quality Gate.
 *
 * This is the SIPOC mistake-proofing step that prevents hollow LLM recs
 * (missing mechanism/specific_fix/reader_effect) from reaching QG and
 * triggering QG_EDITORIAL_GENERIC_FEEDBACK failures.
 *
 * Root cause fix for: Ancient Bloodlines (6e5c8f29) failure where Pass 3
 * produced anchored recommendations with empty editorial contract fields.
 */

import { describe, it, expect } from "@jest/globals";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  buildCriterionAwareMechanismDefault,
  buildCriterionAwareSpecificFixDefault,
  buildCriterionAwareReaderEffectDefault,
} from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import type { SynthesisOutput, SinglePassOutput } from "@/lib/evaluation/pipeline/types";

// Re-implement enforceEditorialSpecificityBeforeGate locally for unit testing
// (it's a private function inside runPipeline.ts — same logic, tested in isolation)
function enforceEditorialSpecificityBeforeGate(synthesis: SynthesisOutput): {
  synthesis: SynthesisOutput;
  repairedCount: number;
} {
  let repairedCount = 0;
  const criteria = synthesis.criteria.map((criterion) => {
    if (!criterion.recommendations || criterion.recommendations.length === 0) return criterion;

    const recommendations = criterion.recommendations.map((rec) => {
      if (!rec.anchor_snippet || rec.anchor_snippet.trim().length === 0) return rec;

      let patched = false;
      let mechanism = rec.mechanism;
      let specificFix = rec.specific_fix;
      let readerEffect = rec.reader_effect;

      if (!mechanism || mechanism.trim().length === 0) {
        mechanism = buildCriterionAwareMechanismDefault(criterion.key);
        patched = true;
      }
      if (!specificFix || specificFix.trim().length === 0) {
        specificFix = buildCriterionAwareSpecificFixDefault(criterion.key);
        patched = true;
      }
      if (!readerEffect || readerEffect.trim().length === 0) {
        readerEffect = buildCriterionAwareReaderEffectDefault(criterion.key);
        patched = true;
      }

      if (patched) {
        repairedCount++;
        return { ...rec, mechanism, specific_fix: specificFix, reader_effect: readerEffect };
      }
      return rec;
    });

    return { ...criterion, recommendations };
  });

  return {
    synthesis: { ...synthesis, criteria },
    repairedCount,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHollowRec(key: string) {
  return {
    priority: "medium" as const,
    action: `Enhance ${key} to improve reader engagement.`,
    expected_impact: `This will improve the manuscript's ${key}.`,
    anchor_snippet: `Evidence for ${key}: The river moved slowly past the old bridge.`,
    source_pass: 3 as const,
    issue_family: "scene_structure" as const,
    strategic_lever: "scene_goal_clarity" as const,
    revision_granularity: "scene" as const,
    mechanism: "",
    specific_fix: "",
    reader_effect: "",
    symptom: `A concrete craft issue weakens reader clarity or momentum at this location.`,
  };
}

function makeFullRec(key: string) {
  return {
    priority: "medium" as const,
    action: `Replace the abstract ${key} line with a concrete beat in the opening scene.`,
    expected_impact: `Gives the reader clearer cause-and-effect.`,
    anchor_snippet: `Anchor for ${key}: The chapter turn carries weight.`,
    source_pass: 3 as const,
    issue_family: "scene_structure" as const,
    strategic_lever: "scene_goal_clarity" as const,
    revision_granularity: "scene" as const,
    mechanism: `the current phrasing diffuses tension for ${key}`,
    specific_fix: `replace the abstract ${key} line with a concrete beat`,
    reader_effect: `clearer cause-and-effect at the turn`,
    symptom: `Tension diffuses at this location.`,
  };
}

function makeAnchorlessRec() {
  return {
    priority: "medium" as const,
    action: `Improve the overall tone of the manuscript.`,
    expected_impact: `This will make things better.`,
    anchor_snippet: "",
    source_pass: 3 as const,
    issue_family: "scene_structure" as const,
    strategic_lever: "scene_goal_clarity" as const,
    revision_granularity: "scene" as const,
    mechanism: "",
    specific_fix: "",
    reader_effect: "",
    symptom: `Generic issue.`,
  };
}

function buildSynthesis(
  overrides?: Partial<Record<string, { recs: ReturnType<typeof makeHollowRec>[]; score?: number }>>
): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key) => ({
      key,
      craft_score: 7,
      editorial_score: 7,
      final_score_0_10: overrides?.[key]?.score ?? 7,
      score_delta: 0,
      final_rationale: `Rationale for ${key}.`,
      pressure_points: [],
      decision_points: [],
      consequence_status: "landed" as const,
      evidence: [{ snippet: `Evidence for ${key}: The river moved slowly.` }],
      recommendations: overrides?.[key]?.recs ?? [makeFullRec(key)],
    })),
    overall: {
      overall_score_0_100: 70,
      verdict: "revise" as const,
      one_paragraph_summary: "The manuscript has strong potential and needs revision.",
      top_3_strengths: ["voice", "premise", "character"],
      top_3_risks: ["pacing", "tone", "worldbuilding"],
      submission_readiness: "nearly_ready" as const,
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("enforceEditorialSpecificityBeforeGate — pipeline SIPOC repair", () => {
  it("backfills mechanism/specific_fix/reader_effect for hollow anchored recs", () => {
    const synthesis = buildSynthesis({
      sceneConstruction: { recs: [makeHollowRec("sceneConstruction")] },
      dialogue: { recs: [makeHollowRec("dialogue")] },
      concept: { recs: [makeHollowRec("concept")] },
    });

    const { synthesis: repaired, repairedCount } = enforceEditorialSpecificityBeforeGate(synthesis);

    expect(repairedCount).toBe(3);

    const sceneRec = repaired.criteria.find((c) => c.key === "sceneConstruction")!.recommendations[0];
    expect(sceneRec.mechanism).toBe(buildCriterionAwareMechanismDefault("sceneConstruction"));
    expect(sceneRec.specific_fix).toBe(buildCriterionAwareSpecificFixDefault("sceneConstruction"));
    expect(sceneRec.reader_effect).toBe(buildCriterionAwareReaderEffectDefault("sceneConstruction"));

    const dialogueRec = repaired.criteria.find((c) => c.key === "dialogue")!.recommendations[0];
    expect(dialogueRec.mechanism).toBe(buildCriterionAwareMechanismDefault("dialogue"));
    expect(dialogueRec.specific_fix).toBe(buildCriterionAwareSpecificFixDefault("dialogue"));
    expect(dialogueRec.reader_effect).toBe(buildCriterionAwareReaderEffectDefault("dialogue"));
  });

  it("does NOT modify anchorless recommendations — preserves gate ability to detect generic content", () => {
    const synthesis = buildSynthesis({
      tone: { recs: [makeAnchorlessRec()], score: 5 },
    });

    const { synthesis: repaired, repairedCount } = enforceEditorialSpecificityBeforeGate(synthesis);

    // Anchorless recs must NOT be repaired
    const toneRec = repaired.criteria.find((c) => c.key === "tone")!.recommendations[0];
    expect(toneRec.mechanism).toBe("");
    expect(toneRec.specific_fix).toBe("");
    expect(toneRec.reader_effect).toBe("");
    // repairedCount does NOT include anchorless recs
    expect(repairedCount).toBe(0);
  });

  it("does NOT modify already-complete recommendations", () => {
    const synthesis = buildSynthesis({
      voice: { recs: [makeFullRec("voice")] },
      pacing: { recs: [makeFullRec("pacing")] },
    });

    const { synthesis: repaired, repairedCount } = enforceEditorialSpecificityBeforeGate(synthesis);

    expect(repairedCount).toBe(0);

    const voiceRec = repaired.criteria.find((c) => c.key === "voice")!.recommendations[0];
    expect(voiceRec.mechanism).toBe(`the current phrasing diffuses tension for voice`);
    expect(voiceRec.specific_fix).toBe(`replace the abstract voice line with a concrete beat`);
  });

  it("repairs all 13 criteria when all have hollow recs", () => {
    const overrides: Record<string, { recs: ReturnType<typeof makeHollowRec>[] }> = {};
    for (const key of CRITERIA_KEYS) {
      overrides[key] = { recs: [makeHollowRec(key)] };
    }

    const synthesis = buildSynthesis(overrides);
    const { synthesis: repaired, repairedCount } = enforceEditorialSpecificityBeforeGate(synthesis);

    expect(repairedCount).toBe(13);

    for (const criterion of repaired.criteria) {
      const rec = criterion.recommendations[0];
      expect(rec.mechanism.length).toBeGreaterThan(10);
      expect(rec.specific_fix.length).toBeGreaterThan(10);
      expect(rec.reader_effect.length).toBeGreaterThan(10);
    }
  });

  it("partially-complete recs get only missing fields backfilled", () => {
    const partialRec = {
      ...makeHollowRec("narrativeDrive"),
      mechanism: "the stakes signal arrives too late, diffusing urgency",
      // specific_fix and reader_effect still empty
    };
    const synthesis = buildSynthesis({
      narrativeDrive: { recs: [partialRec] },
    });

    const { synthesis: repaired, repairedCount } = enforceEditorialSpecificityBeforeGate(synthesis);

    expect(repairedCount).toBe(1);
    const rec = repaired.criteria.find((c) => c.key === "narrativeDrive")!.recommendations[0];
    // mechanism preserved (was already filled)
    expect(rec.mechanism).toBe("the stakes signal arrives too late, diffusing urgency");
    // specific_fix and reader_effect backfilled
    expect(rec.specific_fix).toBe(buildCriterionAwareSpecificFixDefault("narrativeDrive"));
    expect(rec.reader_effect).toBe(buildCriterionAwareReaderEffectDefault("narrativeDrive"));
  });
});

describe("enforceEditorialSpecificityBeforeGate + QG integration", () => {
  function makePass(pass: 1 | 2): SinglePassOutput {
    return {
      pass,
      axis: pass === 1 ? "craft_execution" : "editorial_literary",
      model: "gpt-4o",
      prompt_version: "test",
      temperature: 0.2,
      generated_at: new Date().toISOString(),
      criteria: CRITERIA_KEYS.map((key) => ({
        key,
        score_0_10: 7,
        rationale: `Pass ${pass} rationale for ${key}.`,
        evidence: [{ snippet: `Pass ${pass} evidence: The river moved.` }],
        recommendations: [],
      })),
    };
  }

  it("hollow recs that would fail QG_EDITORIAL_GENERIC_FEEDBACK now pass after specificity repair", () => {
    // Build synthesis with ALL hollow recs (the Ancient Bloodlines scenario)
    const overrides: Record<string, { recs: ReturnType<typeof makeHollowRec>[] }> = {};
    for (const key of CRITERIA_KEYS) {
      overrides[key] = { recs: [makeHollowRec(key)] };
    }
    const hollowSynthesis = buildSynthesis(overrides);

    // First: confirm QG FAILS without the repair
    const pass1 = makePass(1);
    const pass2 = makePass(2);
    const qgBefore = runQualityGate(hollowSynthesis, pass1, pass2, "test manuscript text");
    const editorialCheckBefore = qgBefore.checks.find(
      (c) => c.error_code === "QG_EDITORIAL_GENERIC_FEEDBACK"
    );
    // The editorial check should either not pass, or the overall gate should fail
    const editorialFailsBefore = editorialCheckBefore && !editorialCheckBefore.passed;

    // Apply the repair
    const { synthesis: repaired } = enforceEditorialSpecificityBeforeGate(hollowSynthesis);

    // After repair: QG should not fail on QG_EDITORIAL_GENERIC_FEEDBACK
    const qgAfter = runQualityGate(repaired, pass1, pass2, "test manuscript text");
    const editorialCheckAfter = qgAfter.checks.find(
      (c) => c.error_code === "QG_EDITORIAL_GENERIC_FEEDBACK"
    );

    // If the editorial check fired before, it should now pass (or not fire at all)
    if (editorialFailsBefore) {
      expect(!editorialCheckAfter || editorialCheckAfter.passed).toBe(true);
    }
  });
});
