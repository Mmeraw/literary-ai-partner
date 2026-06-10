/**
 * Tests for S06b_HANDOFF_GATE — Pass 1/2 Handoff Gate
 *
 * Validates that the gate correctly identifies and blocks:
 * - Scaffold residue
 * - Incomplete sentences
 * - Broken modal phrases
 * - Generic workshop language without evidence
 * - Missing evidence anchors
 * - Orphaned conjunctions
 * - Dangling references
 */

import {
  runPass12HandoffGate,
  shouldPassHandoffGate,
  type HandoffGateResult,
} from "@/lib/evaluation/pipeline/pass12HandoffGate";
import type { SinglePassOutput, AxisCriterionResult } from "@/lib/evaluation/pipeline/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCleanCriterion(key: string): AxisCriterionResult {
  return {
    key: key as any,
    score_0_10: 7,
    rationale: "The manuscript demonstrates strong pacing through deliberate scene transitions that build tension incrementally.",
    evidence: [
      {
        snippet: "She reached for the door handle, but something—",
        location: "Chapter 3, paragraph 12",
        relevance: "Shows interrupted action creating suspense",
      },
    ],
    recommendations: [
      {
        priority: "medium",
        action: "Strengthen the transition between chapters 4 and 5 by adding a bridging sentence that carries the emotional momentum forward.",
        expected_impact: "Creates smoother narrative flow and prevents reader disengagement at the chapter break.",
        anchor_snippet: "She reached for the door handle, but something—",
        issue_family: "pacing" as any,
        strategic_lever: "structural_rhythm" as any,
        revision_granularity: "paragraph" as any,
      },
    ],
  };
}

function makePassOutput(criteria: AxisCriterionResult[], pass: 1 | 2 = 1): SinglePassOutput {
  return {
    pass,
    axis: pass === 1 ? "craft_execution" : "editorial_literary",
    criteria,
    model: "gpt-4o",
    prompt_version: "test-v1",
    temperature: 0.3,
    generated_at: new Date().toISOString(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Pass 1/2 Handoff Gate (S06b)", () => {
  describe("clean output", () => {
    it("passes clean Pass 1 + Pass 2 output without violations", () => {
      const pass1 = makePassOutput([
        makeCleanCriterion("narrative_drive"),
        makeCleanCriterion("character_voice"),
      ], 1);
      const pass2 = makePassOutput([
        makeCleanCriterion("narrative_drive"),
        makeCleanCriterion("character_voice"),
      ], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.ok).toBe(true);
      expect(result.total_violations).toBe(0);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("scaffold residue detection", () => {
    it("detects [PLACEHOLDER] in rationale", () => {
      const criterion = makeCleanCriterion("narrative_drive");
      criterion.rationale = "The manuscript shows [PLACEHOLDER] in its pacing structure.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("narrative_drive")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.ok).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          code: "HANDOFF_SCAFFOLD_RESIDUE",
          criterion_key: "narrative_drive",
          field: "rationale",
        }),
      );
    });

    it("detects TODO: in recommendation action", () => {
      const criterion = makeCleanCriterion("character_voice");
      criterion.recommendations[0].action = "TODO: Write a better recommendation for this criterion.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("character_voice")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.code === "HANDOFF_SCAFFOLD_RESIDUE")).toBe(true);
    });

    it("detects {{template_token}} in expected_impact", () => {
      const criterion = makeCleanCriterion("pacing");
      criterion.recommendations[0].expected_impact = "This will {{improve}} the manuscript by {{amount}}.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("pacing")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.code === "HANDOFF_SCAFFOLD_RESIDUE")).toBe(true);
    });
  });

  describe("broken modal detection", () => {
    it("detects 'which More' pattern", () => {
      const criterion = makeCleanCriterion("dialogue");
      criterion.rationale = "The dialogue section which More effectively demonstrates authentic voice.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("dialogue")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.ok).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          code: "HANDOFF_BROKEN_MODAL",
          detail: expect.stringContaining("which More"),
        }),
      );
    });

    it("detects 'can long stretches' pattern", () => {
      const criterion = makeCleanCriterion("pacing");
      criterion.rationale = "The section can long stretches of narrative without proper punctuation breaks.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("pacing")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.code === "HANDOFF_BROKEN_MODAL")).toBe(true);
    });

    it("detects doubled modal verbs", () => {
      const criterion = makeCleanCriterion("prose_control");
      criterion.recommendations[0].action = "The author would would benefit from tightening this passage by removing redundant phrases.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("prose_control")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.code === "HANDOFF_BROKEN_MODAL")).toBe(true);
    });
  });

  describe("generic workshop language detection", () => {
    it("detects generic advice without evidence anchor", () => {
      const criterion = makeCleanCriterion("character_voice");
      criterion.recommendations[0].action = "Consider adding more detail to the character descriptions throughout the manuscript.";
      criterion.recommendations[0].anchor_snippet = ""; // no evidence

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("character_voice")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some((v) => v.code === "HANDOFF_GENERIC_LANGUAGE")).toBe(true);
    });

    it("allows generic-sounding language when evidence anchor is present", () => {
      const criterion = makeCleanCriterion("character_voice");
      criterion.recommendations[0].action = "Consider adding more detail to the character's internal reaction in this scene.";
      criterion.recommendations[0].anchor_snippet = "She stared at the wall, unblinking.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("character_voice")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.filter((v) => v.code === "HANDOFF_GENERIC_LANGUAGE")).toHaveLength(0);
    });
  });

  describe("missing evidence anchor detection", () => {
    it("flags recommendations without anchor_snippet", () => {
      const criterion = makeCleanCriterion("scene_construction");
      criterion.recommendations[0].anchor_snippet = "";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("scene_construction")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some((v) => v.code === "HANDOFF_MISSING_EVIDENCE_ANCHOR")).toBe(true);
    });

    it("flags criterion with recs but no evidence array entries", () => {
      const criterion = makeCleanCriterion("worldbuilding");
      criterion.evidence = [];

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("worldbuilding")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some(
        (v) => v.code === "HANDOFF_MISSING_EVIDENCE_ANCHOR" && v.field === "evidence",
      )).toBe(true);
    });
  });

  describe("sentence completeness", () => {
    it("detects rationale without terminal punctuation", () => {
      const criterion = makeCleanCriterion("tonal_authority");
      criterion.rationale = "The manuscript demonstrates a consistent tone throughout however it lacks";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("tonal_authority")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some((v) => v.code === "HANDOFF_INCOMPLETE_SENTENCE")).toBe(true);
    });

    it("passes short rationale under 15 chars as exempt", () => {
      const criterion = makeCleanCriterion("marketability");
      criterion.rationale = "N/A";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("marketability")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.filter((v) => v.code === "HANDOFF_INCOMPLETE_SENTENCE")).toHaveLength(0);
    });

    it("does NOT flag recommendation_action missing terminal punctuation (imperative directive)", () => {
      const criterion = makeCleanCriterion("concept");
      criterion.recommendations[0].action =
        "Refine the concept dimension to achieve stronger integration between thematic elements and narrative structure";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("concept")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.filter(
        (v) => v.code === "HANDOFF_INCOMPLETE_SENTENCE" && v.field === "recommendation_action",
      )).toHaveLength(0);
    });

    it("still flags recommendation_action that is too short (< 4 words)", () => {
      const criterion = makeCleanCriterion("concept");
      criterion.recommendations[0].action = "Fix the dialogue";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("concept")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some(
        (v) => v.code === "HANDOFF_INCOMPLETE_SENTENCE" && v.field === "recommendation_action",
      )).toBe(true);
    });
  });

  describe("orphaned conjunctions", () => {
    it("detects rationale starting with orphaned conjunction", () => {
      const criterion = makeCleanCriterion("narrative_drive");
      criterion.rationale = "However the pacing in chapter three demonstrates strong momentum throughout the middle act.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("narrative_drive")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some((v) => v.code === "HANDOFF_ORPHANED_CONJUNCTION")).toBe(true);
    });

    it("detects recommendation action starting with But", () => {
      const criterion = makeCleanCriterion("character_voice");
      criterion.recommendations[0].action = "But strengthen the dialogue in chapter five to reveal the character's internal conflict more clearly.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("character_voice")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some(
        (v) => v.code === "HANDOFF_ORPHANED_CONJUNCTION" && v.field === "recommendation_action",
      )).toBe(true);
    });

    it("does not flag conjunction mid-sentence as orphaned", () => {
      const criterion = makeCleanCriterion("pacing");
      criterion.rationale = "The manuscript builds tension effectively, however the final chapter resolves too quickly.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("pacing")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.filter((v) => v.code === "HANDOFF_ORPHANED_CONJUNCTION")).toHaveLength(0);
    });
  });

  describe("dangling references", () => {
    it("detects 'this section' without evidence anchor", () => {
      const criterion = makeCleanCriterion("worldbuilding");
      criterion.rationale = "This section could benefit from more grounded detail to establish the physical environment.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("worldbuilding")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some((v) => v.code === "HANDOFF_DANGLING_REFERENCE")).toBe(true);
    });

    it("detects 'the above' in rationale", () => {
      const criterion = makeCleanCriterion("narrative_drive");
      criterion.rationale = "As mentioned above the narrative drive is weakened by the pacing decisions in the middle section.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("narrative_drive")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some((v) => v.code === "HANDOFF_DANGLING_REFERENCE")).toBe(true);
    });

    it("detects dangling reference in recommendation action without anchor", () => {
      const criterion = makeCleanCriterion("dialogue_subtext");
      criterion.recommendations[0].action = "Address these issues by revising the dialogue in the affected passages.";
      criterion.recommendations[0].anchor_snippet = "";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("dialogue_subtext")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.some(
        (v) => v.code === "HANDOFF_DANGLING_REFERENCE" && v.field === "recommendation_action",
      )).toBe(true);
    });

    it("does not flag dangling reference in action when anchor_snippet is present", () => {
      const criterion = makeCleanCriterion("dialogue_subtext");
      criterion.recommendations[0].action = "Address these issues by revising the dialogue to add subtext.";
      criterion.recommendations[0].anchor_snippet = "He nodded slowly, saying nothing.";

      const pass1 = makePassOutput([criterion], 1);
      const pass2 = makePassOutput([makeCleanCriterion("dialogue_subtext")], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.violations.filter(
        (v) => v.code === "HANDOFF_DANGLING_REFERENCE" && v.field === "recommendation_action",
      )).toHaveLength(0);
    });
  });

  describe("threshold policy (shouldPassHandoffGate)", () => {
    it("blocks on any scaffold residue", () => {
      const result: HandoffGateResult = {
        ok: false,
        violations: [{ code: "HANDOFF_SCAFFOLD_RESIDUE", criterion_key: "x", field: "rationale", detail: "" }],
        total_violations: 1,
        pass1_violations: 1,
        pass2_violations: 0,
        check_summary: {
          HANDOFF_SCAFFOLD_RESIDUE: 1,
          HANDOFF_INCOMPLETE_SENTENCE: 0,
          HANDOFF_BROKEN_MODAL: 0,
          HANDOFF_GENERIC_LANGUAGE: 0,
          HANDOFF_MISSING_EVIDENCE_ANCHOR: 0,
          HANDOFF_ORPHANED_CONJUNCTION: 0,
          HANDOFF_DANGLING_REFERENCE: 0,
        },
      };

      expect(shouldPassHandoffGate(result)).toBe(false);
    });

    it("blocks on any broken modal", () => {
      const result: HandoffGateResult = {
        ok: false,
        violations: [{ code: "HANDOFF_BROKEN_MODAL", criterion_key: "x", field: "rationale", detail: "" }],
        total_violations: 1,
        pass1_violations: 0,
        pass2_violations: 1,
        check_summary: {
          HANDOFF_SCAFFOLD_RESIDUE: 0,
          HANDOFF_INCOMPLETE_SENTENCE: 0,
          HANDOFF_BROKEN_MODAL: 1,
          HANDOFF_GENERIC_LANGUAGE: 0,
          HANDOFF_MISSING_EVIDENCE_ANCHOR: 0,
          HANDOFF_ORPHANED_CONJUNCTION: 0,
          HANDOFF_DANGLING_REFERENCE: 0,
        },
      };

      expect(shouldPassHandoffGate(result)).toBe(false);
    });

    it("allows 2 generic language violations (under threshold)", () => {
      const result: HandoffGateResult = {
        ok: false,
        violations: [
          { code: "HANDOFF_GENERIC_LANGUAGE", criterion_key: "a", field: "recommendation_action", detail: "" },
          { code: "HANDOFF_GENERIC_LANGUAGE", criterion_key: "b", field: "recommendation_action", detail: "" },
        ],
        total_violations: 2,
        pass1_violations: 1,
        pass2_violations: 1,
        check_summary: {
          HANDOFF_SCAFFOLD_RESIDUE: 0,
          HANDOFF_INCOMPLETE_SENTENCE: 0,
          HANDOFF_BROKEN_MODAL: 0,
          HANDOFF_GENERIC_LANGUAGE: 2,
          HANDOFF_MISSING_EVIDENCE_ANCHOR: 0,
          HANDOFF_ORPHANED_CONJUNCTION: 0,
          HANDOFF_DANGLING_REFERENCE: 0,
        },
      };

      expect(shouldPassHandoffGate(result)).toBe(true);
    });

    it("blocks on 3+ generic language violations", () => {
      const result: HandoffGateResult = {
        ok: false,
        violations: Array(3).fill({ code: "HANDOFF_GENERIC_LANGUAGE", criterion_key: "x", field: "recommendation_action", detail: "" }),
        total_violations: 3,
        pass1_violations: 2,
        pass2_violations: 1,
        check_summary: {
          HANDOFF_SCAFFOLD_RESIDUE: 0,
          HANDOFF_INCOMPLETE_SENTENCE: 0,
          HANDOFF_BROKEN_MODAL: 0,
          HANDOFF_GENERIC_LANGUAGE: 3,
          HANDOFF_MISSING_EVIDENCE_ANCHOR: 0,
          HANDOFF_ORPHANED_CONJUNCTION: 0,
          HANDOFF_DANGLING_REFERENCE: 0,
        },
      };

      expect(shouldPassHandoffGate(result)).toBe(false);
    });

    it("blocks on 5+ missing evidence anchors", () => {
      const result: HandoffGateResult = {
        ok: false,
        violations: Array(5).fill({ code: "HANDOFF_MISSING_EVIDENCE_ANCHOR", criterion_key: "x", field: "recommendation_action", detail: "" }),
        total_violations: 5,
        pass1_violations: 3,
        pass2_violations: 2,
        check_summary: {
          HANDOFF_SCAFFOLD_RESIDUE: 0,
          HANDOFF_INCOMPLETE_SENTENCE: 0,
          HANDOFF_BROKEN_MODAL: 0,
          HANDOFF_GENERIC_LANGUAGE: 0,
          HANDOFF_MISSING_EVIDENCE_ANCHOR: 5,
          HANDOFF_ORPHANED_CONJUNCTION: 0,
          HANDOFF_DANGLING_REFERENCE: 0,
        },
      };

      expect(shouldPassHandoffGate(result)).toBe(false);
    });

    it("blocks on 3+ orphaned conjunctions", () => {
      const result: HandoffGateResult = {
        ok: false,
        violations: Array(3).fill({ code: "HANDOFF_ORPHANED_CONJUNCTION", criterion_key: "x", field: "rationale", detail: "" }),
        total_violations: 3,
        pass1_violations: 2,
        pass2_violations: 1,
        check_summary: {
          HANDOFF_SCAFFOLD_RESIDUE: 0,
          HANDOFF_INCOMPLETE_SENTENCE: 0,
          HANDOFF_BROKEN_MODAL: 0,
          HANDOFF_GENERIC_LANGUAGE: 0,
          HANDOFF_MISSING_EVIDENCE_ANCHOR: 0,
          HANDOFF_ORPHANED_CONJUNCTION: 3,
          HANDOFF_DANGLING_REFERENCE: 0,
        },
      };

      expect(shouldPassHandoffGate(result)).toBe(false);
    });

    it("blocks on 5+ dangling references", () => {
      const result: HandoffGateResult = {
        ok: false,
        violations: Array(5).fill({ code: "HANDOFF_DANGLING_REFERENCE", criterion_key: "x", field: "rationale", detail: "" }),
        total_violations: 5,
        pass1_violations: 3,
        pass2_violations: 2,
        check_summary: {
          HANDOFF_SCAFFOLD_RESIDUE: 0,
          HANDOFF_INCOMPLETE_SENTENCE: 0,
          HANDOFF_BROKEN_MODAL: 0,
          HANDOFF_GENERIC_LANGUAGE: 0,
          HANDOFF_MISSING_EVIDENCE_ANCHOR: 0,
          HANDOFF_ORPHANED_CONJUNCTION: 0,
          HANDOFF_DANGLING_REFERENCE: 5,
        },
      };

      expect(shouldPassHandoffGate(result)).toBe(false);
    });
  });

  describe("cross-pass validation", () => {
    it("reports violations from both passes separately", () => {
      const badCriterion1 = makeCleanCriterion("narrative_drive");
      badCriterion1.rationale = "This is a [PLACEHOLDER] rationale for testing.";

      const badCriterion2 = makeCleanCriterion("character_voice");
      badCriterion2.rationale = "The dialogue which More clearly shows character intent.";

      const pass1 = makePassOutput([badCriterion1], 1);
      const pass2 = makePassOutput([badCriterion2], 2);

      const result = runPass12HandoffGate(pass1, pass2);

      expect(result.ok).toBe(false);
      expect(result.pass1_violations).toBeGreaterThan(0);
      expect(result.pass2_violations).toBeGreaterThan(0);
      expect(result.total_violations).toBe(result.pass1_violations + result.pass2_violations);
    });
  });
});
