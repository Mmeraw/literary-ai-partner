/**
 * Phase 2.7 — Quality Gate Tests
 *
 * All checks are deterministic (no AI calls needed).
 * Validates all 10 quality gate checks from spec §3.4.
 */

import { describe, it, expect } from "@jest/globals";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import type { SynthesisOutput, SynthesizedCriterion, SinglePassOutput } from "@/lib/evaluation/pipeline/types";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCriterion(key: (typeof CRITERIA_KEYS)[number], overrides: Partial<SynthesizedCriterion> = {}): SynthesizedCriterion {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale: "The passage demonstrates competent handling of this criterion.",
    pressure_points: ["Pressure builds around this criterion as scene stakes escalate."],
    decision_points: ["The chapter commits to a clear direction for this criterion."],
    consequence_status: "landed",
    evidence: [{ snippet: "The river moved slowly through the valley." }],
    recommendations: [
      {
        priority: "medium",
        action: `Address the ${key} dimension by grounding specific textual evidence — the current draft does not yet demonstrate clear mastery of this criterion.`,
        expected_impact: "Increases specificity and reader connection for this criterion.",
        anchor_snippet: '"she whispered"',
        source_pass: 1,
        issue_family: "scene_structure",
        strategic_lever: "scene_goal_clarity",
        revision_granularity: "scene",
        mechanism: "the current draft does not yet demonstrate clear mastery of this criterion",
        specific_fix: "grounding specific textual evidence",
        reader_effect: "reader connection for this criterion",
        symptom: "Test symptom: craft issue identified at this location.",
      },
    ],
    ...overrides,
  };
}

function makeValidSynthesis(criteriaOverrides: Partial<SynthesizedCriterion>[] = []): SynthesisOutput {
  const criteria = CRITERIA_KEYS.map((key, i) =>
    makeCriterion(key, criteriaOverrides[i] ?? {}),
  );
  return {
    criteria,
    overall: {
      overall_score_0_100: 70,
      verdict: "revise",
      one_paragraph_summary:
        "This manuscript shows promise in narrative structure but needs tighter editorial work before submission.",
      top_3_strengths: ["Strong voice", "Clear narrative arc", "Memorable dialogue"],
      top_3_risks: ["Weak world-building", "Pacing issues in act two", "Thin character motivation"],
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runQualityGate", () => {
  it("passes a valid synthesis with all 13 criteria", () => {
    const result = runQualityGate(makeValidSynthesis());
    expect(result.pass).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  // ── QG_CRITERIA_MISSING ──────────────────────────────────────────────────

  it("rejects when criteria count is not 13 (QG_CRITERIA_MISSING)", () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria = synthesis.criteria.slice(0, 10); // only 10
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    const check = result.checks.find((c) => c.error_code === "QG_CRITERIA_MISSING");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  // ── QG_SCORE_RANGE ───────────────────────────────────────────────────────

  it("rejects non-integer score (QG_SCORE_RANGE)", () => {
    const synthesis = makeValidSynthesis([{ final_score_0_10: 7.5 }]);
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    const check = result.checks.find((c) => c.error_code === "QG_SCORE_RANGE");
    expect(check).toBeDefined();
  });

  it("rejects score > 10 (QG_SCORE_RANGE)", () => {
    const synthesis = makeValidSynthesis([{ final_score_0_10: 11 }]);
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_SCORE_RANGE")).toBeDefined();
  });

  it("rejects score < 0 (QG_SCORE_RANGE)", () => {
    const synthesis = makeValidSynthesis([{ craft_score: -1 }]);
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_SCORE_RANGE")).toBeDefined();
  });

  it("accepts scores of 0 and 10 (boundary)", () => {
    const synthesis = makeValidSynthesis([{ final_score_0_10: 0, craft_score: 0, editorial_score: 0 }, { final_score_0_10: 10, craft_score: 10, editorial_score: 10 }]);
    const result = runQualityGate(synthesis);
    const scoreCheck = result.checks.find((c) => c.check_id === "score_range");
    expect(scoreCheck?.passed).toBe(true);
  });

  // ── QG_GENERIC_REC ──────────────────────────────────────────────────────

  it("rejects recommendation with empty anchor_snippet (QG_GENERIC_REC)", () => {
    const synthesis = makeValidSynthesis([
      {
        recommendations: [
          {
            priority: "high",
            action: "Rewrite the opening chapter to establish a stronger hook for your target audience.",
            expected_impact: "Increases agent interest in the first page.",
            anchor_snippet: "",
            source_pass: 1,
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
            mechanism: "the opening chapter lacks a strong hook for the target audience",
            specific_fix: "rewrite the opening chapter to establish a stronger hook",
            reader_effect: "increased agent interest in the first page",
            symptom: "Test symptom: craft issue identified at this location.",
          },
        ],
      },
    ]);
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_GENERIC_REC")).toBeDefined();
  });

  // ── QG_SHORT_REC ─────────────────────────────────────────────────────────

  it("rejects recommendation action < 50 chars (QG_SHORT_REC)", () => {
    const synthesis = makeValidSynthesis([
      {
        recommendations: [
          {
            priority: "low",
            action: "Trim this section.", // 18 chars — too short
            expected_impact: "Tighter prose.",
            anchor_snippet: '"she whispered"',
            source_pass: 2,
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
            mechanism: "the section is too long",
            specific_fix: "trim this section",
            reader_effect: "tighter prose",
            symptom: "Test symptom: craft issue identified at this location.",
          },
        ],
      },
    ]);
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_SHORT_REC")).toBeDefined();
  });

  // ── QG_LONG_REC ──────────────────────────────────────────────────────────
  // The action field carries substantive editorial analysis; the gate only fires
  // on pathological runaway text (> 1500 chars), not normal editorial guidance.

  it("rejects recommendation action body > 1500 chars (QG_LONG_REC)", () => {
    // Programmatically guaranteed to exceed 1500 chars: normal editorial
    // sentence repeated enough times to be clearly pathological/runaway.
    const sentence =
      'In the opening scene, rewrite the river-arrival passage to include visceral sensory anchoring because the current prose reports movement without grounding the reader in texture, sound, or smell, which leaves the protagonist\'s emotional state abstract when it should feel immediate and embodied.';
    // ~290 chars × 6 = ~1740 chars — well above the 1500-char pathological cap.
    const longAction = sentence.repeat(6);
    expect(longAction.length).toBeGreaterThan(1500);
    const synthesis = makeValidSynthesis([
      {
        recommendations: [
          {
            priority: "high",
            action: longAction,
            expected_impact: "Fuller immersion.",
            anchor_snippet: '"The river moved slowly"',
            source_pass: 1,
            issue_family: "scene_structure",
            strategic_lever: "scene_goal_clarity",
            revision_granularity: "scene",
            mechanism: "the scene lacks visceral sensory grounding",
            specific_fix: "rewrite this scene to include a visceral sensory detail",
            reader_effect: "fuller immersion",
            symptom: "Test symptom: craft issue identified at this location.",
          },
        ],
      },
    ]);
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_LONG_REC")).toBeDefined();
  });

  // ── QG_LONG_EVIDENCE ────────────────────────────────────────────────────

  it("rejects evidence snippet > 200 chars (QG_LONG_EVIDENCE)", () => {
    const longSnippet =
      "The river moved slowly through the valley, its dark waters reflecting the pale light of a moon that had risen only moments before and now hung low over the distant ridge as though uncertain whether to climb higher into the night sky or retreat into the mist.";
    expect(longSnippet.length).toBeGreaterThan(200);
    const synthesis = makeValidSynthesis([
      { evidence: [{ snippet: longSnippet }] },
    ]);
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_LONG_EVIDENCE")).toBeDefined();
  });

  // ── QG_LONG_OVERVIEW ────────────────────────────────────────────────────

  it("rejects one_paragraph_summary > 500 chars (QG_LONG_OVERVIEW)", () => {
    const longSummary =
      "This manuscript demonstrates an impressive command of narrative structure while simultaneously revealing a number of areas where additional attention would result in meaningful improvement to the reading experience, particularly in the middle sections where the pacing slows and the thematic through-line becomes obscured by secondary plot threads that, though individually interesting, do not clearly serve the central story arc or the character development of the protagonist in ways that feel earned or satisfying to the reader upon reflection after completion of the full text.";
    expect(longSummary.length).toBeGreaterThan(500);
    const synthesis = makeValidSynthesis();
    synthesis.overall.one_paragraph_summary = longSummary;
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_LONG_OVERVIEW")).toBeDefined();
  });

  // ── QG_DUPLICATE_REC ────────────────────────────────────────────────────

  it("rejects duplicate recommendation actions across criteria (QG_DUPLICATE_REC)", () => {
    const dupeAction = 'Rewrite the passage at "she whispered" to add a concrete sensory detail that places the reader in the scene.';
    const synthesis = makeValidSynthesis([
      {
        recommendations: [
          {
            priority: "high",
            action: dupeAction,
            expected_impact: "Creates more visceral scene.",
            anchor_snippet: '"she whispered"',
            source_pass: 1,
            issue_family: "characterization",
            strategic_lever: "character_voice_differentiation",
            revision_granularity: "scene",
            mechanism: "the passage lacks concrete sensory grounding",
            specific_fix: "rewrite the passage to add a concrete sensory detail",
            reader_effect: "more visceral scene",
            symptom: "Test symptom: craft issue identified at this location.",
          },
        ],
      },
      {
        recommendations: [
          {
            priority: "medium",
            action: dupeAction, // same action — duplicate
            expected_impact: "Creates more visceral scene.",
            anchor_snippet: '"she whispered"',
            source_pass: 2,
            issue_family: "characterization",
            strategic_lever: "character_voice_differentiation",
            revision_granularity: "scene",
            mechanism: "the passage lacks concrete sensory grounding",
            specific_fix: "rewrite the passage to add a concrete sensory detail",
            reader_effect: "more visceral scene",
            symptom: "Test symptom: craft issue identified at this location.",
          },
        ],
      },
    ]);
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_DUPLICATE_REC")).toBeDefined();
  });

  // ── QG_INDEPENDENCE_VIOLATION ───────────────────────────────────────────

  it("rejects when Pass 2 reuses multiple non-evidence Pass 1 rationale phrases (QG_INDEPENDENCE_VIOLATION)", () => {
    const synthesis = makeValidSynthesis();

    const pass1: SinglePassOutput = {
      pass: 1,
      axis: "craft_execution",
      criteria: [
        {
          key: "voice",
          score_0_10: 7,
          rationale:
            "The narrative voice demonstrates consistent structural clarity and precise word choice throughout the opening passage while maintaining cadence.",
          evidence: [{ snippet: "The river moved slowly through the valley." }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    // Pass 2 copies verbatim phrase from Pass 1
    const pass2: SinglePassOutput = {
      pass: 2,
      axis: "editorial_literary",
      criteria: [
        {
          key: "voice",
          score_0_10: 6,
          rationale:
            "The narrative voice demonstrates consistent structural clarity and precise word choice throughout the opening passage with an elegant cadence and register.",
          evidence: [{ snippet: "The river moved slowly through the valley." }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const result = runQualityGate(synthesis, pass1, pass2);
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.error_code === "QG_INDEPENDENCE_VIOLATION")).toBeDefined();
    expect(result.warnings.some((w) => w.includes("pass1_rationale=\"") && w.includes("pass2_rationale=\""))).toBe(true);
  });

  it("passes independence check when Pass 2 has no verbatim Pass 1 phrases", () => {
    const synthesis = makeValidSynthesis();

    const pass1: SinglePassOutput = {
      pass: 1,
      axis: "craft_execution",
      criteria: [
        {
          key: "voice",
          score_0_10: 7,
          rationale: "Structural clarity and precise word choice anchor the narrative voice in a consistent register.",
          evidence: [],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const pass2: SinglePassOutput = {
      pass: 2,
      axis: "editorial_literary",
      criteria: [
        {
          key: "voice",
          score_0_10: 8,
          rationale: "The author's literary sensibility shines through — there is a distinct emotional resonance in the imagery.",
          evidence: [],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const result = runQualityGate(synthesis, pass1, pass2);
    const indepCheck = result.checks.find((c) => c.check_id === "pass_independence");
    expect(indepCheck?.passed).toBe(true);
  });

  it("does not fail independence when overlap is only manuscript-sourced evidence phrasing", () => {
    const synthesis = makeValidSynthesis();

    const sharedEvidence = "The river moved slowly through the valley under moonlight and mist.";

    const pass1: SinglePassOutput = {
      pass: 1,
      axis: "craft_execution",
      criteria: [
        {
          key: "voice",
          score_0_10: 7,
          rationale: `This criterion is anchored by quoted text: ${sharedEvidence}`,
          evidence: [{ snippet: sharedEvidence }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const pass2: SinglePassOutput = {
      pass: 2,
      axis: "editorial_literary",
      criteria: [
        {
          key: "voice",
          score_0_10: 8,
          rationale: `Editorially, the same quote appears: ${sharedEvidence}`,
          evidence: [{ snippet: sharedEvidence }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const result = runQualityGate(synthesis, pass1, pass2);
    const indepCheck = result.checks.find((c) => c.check_id === "pass_independence");
    expect(indepCheck?.passed).toBe(true);
  });

  it("does not fail independence when only a single non-evidence overlap is present", () => {
    const synthesis = makeValidSynthesis();

    const pass1: SinglePassOutput = {
      pass: 1,
      axis: "craft_execution",
      criteria: [
        {
          key: "voice",
          score_0_10: 7,
          rationale:
            "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron",
          evidence: [],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const pass2: SinglePassOutput = {
      pass: 2,
      axis: "editorial_literary",
      criteria: [
        {
          key: "voice",
          score_0_10: 8,
          rationale:
            "alpha beta gamma delta epsilon zeta eta theta uniqueone uniquetwo uniquethree uniquefour",
          evidence: [],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const result = runQualityGate(synthesis, pass1, pass2);
    const indepCheck = result.checks.find((c) => c.check_id === "pass_independence");
    expect(indepCheck?.passed).toBe(true);
  });

  it("does not fail independence when exactly two shared non-evidence 8-grams occur in one criterion", () => {
    const synthesis = makeValidSynthesis();

    const pass1: SinglePassOutput = {
      pass: 1,
      axis: "craft_execution",
      criteria: [
        {
          key: "narrativeClosure",
          score_0_10: 7,
          rationale:
            "The chapter concludes with a strong thematic statement, but lacks a clear resolution or forward momentum for the next chapter.",
          evidence: [{ snippet: "I think it proves the river remembers" }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const pass2: SinglePassOutput = {
      pass: 2,
      axis: "editorial_literary",
      criteria: [
        {
          key: "narrativeClosure",
          score_0_10: 7,
          rationale:
            "The chapter concludes with a strong thematic statement, but a more definitive resolution or call to action could enhance its impact and leave a lasting impression.",
          evidence: [{ snippet: "The people on the land pay the highest price." }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const result = runQualityGate(synthesis, pass1, pass2);
    const indepCheck = result.checks.find((c) => c.check_id === "pass_independence");
    expect(indepCheck?.passed).toBe(true);
  });

  it("does not fail independence when exactly five shared non-evidence 8-grams occur in one criterion", () => {
    const synthesis = makeValidSynthesis();

    const pass1: SinglePassOutput = {
      pass: 1,
      axis: "craft_execution",
      criteria: [
        {
          key: "dialogue",
          score_0_10: 8,
          rationale:
            "Dialogue is natural and serves to advance the plot while revealing character perspectives. The exchanges effectively convey urgency and tension.",
          evidence: [{ snippet: "‘Acceptable national standards,’ he muttered. 'For killing what’s sacred.'" }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const pass2: SinglePassOutput = {
      pass: 2,
      axis: "editorial_literary",
      criteria: [
        {
          key: "dialogue",
          score_0_10: 8,
          rationale:
            "Dialogue is sharp and serves to advance the plot while revealing character perspectives. The exchanges feel authentic and contribute to the thematic exploration.",
          evidence: [{ snippet: "‘Acceptable national standards,’ he muttered. 'For killing what’s sacred.'" }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    const result = runQualityGate(synthesis, pass1, pass2);
    const indepCheck = result.checks.find((c) => c.check_id === "pass_independence");
    expect(indepCheck?.passed).toBe(true);
  });

  // ── Multiple failures ────────────────────────────────────────────────────

  it("can report multiple failures simultaneously", () => {
    const synthesis = makeValidSynthesis();
    synthesis.criteria = synthesis.criteria.slice(0, 5); // QG_CRITERIA_MISSING
    synthesis.overall.one_paragraph_summary = "x".repeat(600);          // QG_LONG_OVERVIEW
    const result = runQualityGate(synthesis);
    expect(result.pass).toBe(false);
    const failedCodes = result.checks
      .filter((c) => !c.passed && c.error_code)
      .map((c) => c.error_code);
    expect(failedCodes).toContain("QG_CRITERIA_MISSING");
    expect(failedCodes).toContain("QG_LONG_OVERVIEW");
  });

  // ── Word-count-aware independence threshold (#309) ─────────────────────

  it("passes independence for short manuscript even with 6+ overlap (word-count-aware threshold)", () => {
    const synthesis = makeValidSynthesis();

    // Short manuscript: ~3,200 words → threshold = 12
    const shortManuscript = Array.from({ length: 200 }, (_, i) =>
      `Sentence ${i + 1} brings the narrative forward through the landscape of memory.`
    ).join(" ");

    const pass1: SinglePassOutput = {
      pass: 1,
      axis: "craft_execution",
      criteria: [
        {
          key: "voice",
          score_0_10: 7,
          rationale:
            "The narrative voice demonstrates consistent structural clarity and precise word choice throughout the opening passage while maintaining cadence.",
          evidence: [{ snippet: "The river moved slowly through the valley." }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass1-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    // Pass 2 shares phrasing — would fail at threshold 6 but passes at 12
    const pass2: SinglePassOutput = {
      pass: 2,
      axis: "editorial_literary",
      criteria: [
        {
          key: "voice",
          score_0_10: 6,
          rationale:
            "The narrative voice demonstrates consistent structural clarity and precise word choice throughout the opening passage with an elegant cadence and register.",
          evidence: [{ snippet: "The river moved slowly through the valley." }],
          recommendations: [],
        },
      ],
      model: "gpt-4o-mini",
      prompt_version: "pass2-v1",
      temperature: 0.3,
      generated_at: new Date().toISOString(),
    };

    // Without manuscriptText → threshold 6 → would fail
    const resultWithoutMs = runQualityGate(synthesis, pass1, pass2);
    const failCheck = resultWithoutMs.checks.find((c) => c.check_id === "pass_independence");
    expect(failCheck?.passed).toBe(false);

    // With short manuscriptText → threshold 12 → passes
    const resultWithMs = runQualityGate(synthesis, pass1, pass2, shortManuscript);
    const passCheck = resultWithMs.checks.find((c) => c.check_id === "pass_independence");
    expect(passCheck?.passed).toBe(true);
  });

  // ── Low-dialogue gate auto-pass (#278) ─────────────────────────────────

  it("auto-passes dialogue gate for low-dialogue manuscript", () => {
    const synthesis = makeValidSynthesis();

    // Manuscript with no quoted dialogue — epistolary/introspective style
    const lowDialogueText = Array.from({ length: 300 }, (_, i) =>
      `The evening light fell across the room in long amber stripes. She thought about the letter again, turning its phrases over in her mind like smooth stones. Paragraph ${i + 1} continued the internal monologue.`
    ).join("\n\n");

    const result = runQualityGate(synthesis, undefined, undefined, lowDialogueText);
    const dialogueCheck = result.checks.find((c) => c.check_id === "dialogue_attribution_specificity");
    // Should either not exist (no actionable signals) or be passed (auto-pass for low dialogue)
    if (dialogueCheck) {
      expect(dialogueCheck.passed).toBe(true);
    }
  });
});
