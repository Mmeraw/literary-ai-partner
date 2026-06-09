/**
 * Pass 2 Recommendation Action Normalizer — deterministic tests
 *
 * Validates that normalizeRecommendationAction:
 *  - Makes valid outputs tidy (whitespace, punctuation)
 *  - Does NOT launder invalid outputs (fragments, noun phrases, headings)
 *  - Returns null for structurally invalid actions (stripped from output)
 *
 * Based on 14 HANDOFF_INCOMPLETE_SENTENCE violations from Sister eval
 * e685fa1c-0d5c-4869-9dfa-7a65ee679023.
 */

import { normalizeRecommendationAction } from "@/lib/evaluation/pipeline/runPass2";

describe("normalizeRecommendationAction", () => {
  describe("valid complete sentences pass through unchanged", () => {
    it("passes 'Clarify Nora's immediate decision.'", () => {
      expect(normalizeRecommendationAction("Clarify Nora's immediate decision.")).toBe(
        "Clarify Nora's immediate decision."
      );
    });

    it("passes through complete imperative sentence with period", () => {
      expect(
        normalizeRecommendationAction(
          "Anchor the sister's absence to a single recurring sensory image that accumulates pressure across scenes."
        )
      ).toBe(
        "Anchor the sister's absence to a single recurring sensory image that accumulates pressure across scenes."
      );
    });

    it("passes through complete sentence with exclamation", () => {
      expect(
        normalizeRecommendationAction(
          "Ground the emotional arc in physical gesture rather than internal narration!"
        )
      ).toBe("Ground the emotional arc in physical gesture rather than internal narration!");
    });

    it("passes through complete sentence with question mark", () => {
      expect(
        normalizeRecommendationAction(
          "Does the timeline shift need a structural marker to orient the reader?"
        )
      ).toBe("Does the timeline shift need a structural marker to orient the reader?");
    });
  });

  describe("punctuation repair for valid imperative clauses", () => {
    it("repairs 'Clarify Nora's immediate decision' (missing period)", () => {
      expect(normalizeRecommendationAction("Clarify Nora's immediate decision")).toBe(
        "Clarify Nora's immediate decision."
      );
    });

    it("repairs long imperative clause missing only terminal punctuation", () => {
      expect(
        normalizeRecommendationAction(
          "Anchor the central concept in a concrete dramatic question that the reader can track scene by scene"
        )
      ).toBe(
        "Anchor the central concept in a concrete dramatic question that the reader can track scene by scene."
      );
    });

    it("repairs 'Replace summarized backstory with dramatized scene-level action'", () => {
      expect(
        normalizeRecommendationAction("Replace summarized backstory with dramatized scene-level action")
      ).toBe("Replace summarized backstory with dramatized scene-level action.");
    });
  });

  describe("rejects noun phrases, headings, fragments, dangling clauses", () => {
    it("rejects 'Pacing' (single word, fragment)", () => {
      expect(normalizeRecommendationAction("Pacing")).toBeNull();
    });

    it("rejects 'Because the scene' (dangling clause)", () => {
      expect(normalizeRecommendationAction("Because the scene")).toBeNull();
    });

    it("rejects 'Increase consequence' (< 4 words, stub)", () => {
      expect(normalizeRecommendationAction("Increase consequence")).toBeNull();
    });

    it("rejects 'More sensory detail in the opening' (noun phrase — starts with 'More')", () => {
      expect(normalizeRecommendationAction("More sensory detail in the opening")).toBeNull();
    });

    it("rejects 'The pacing of the third act' (noun phrase — starts with 'The')", () => {
      expect(normalizeRecommendationAction("The pacing of the third act")).toBeNull();
    });

    it("rejects 'Although the imagery works well here' (dangling clause — starts with 'Although')", () => {
      expect(normalizeRecommendationAction("Although the imagery works well here")).toBeNull();
    });

    it("rejects 'Better transitions' (< 4 words, noun phrase)", () => {
      expect(normalizeRecommendationAction("Better transitions")).toBeNull();
    });

    it("rejects 'Since the opening already establishes' (dangling clause)", () => {
      expect(normalizeRecommendationAction("Since the opening already establishes")).toBeNull();
    });

    it("rejects empty string", () => {
      expect(normalizeRecommendationAction("")).toBeNull();
    });

    it("rejects whitespace-only", () => {
      expect(normalizeRecommendationAction("   ")).toBeNull();
    });
  });

  describe("whitespace normalization", () => {
    it("normalizes multiple spaces", () => {
      expect(
        normalizeRecommendationAction("Anchor  the  scene  in  concrete  physical  detail.")
      ).toBe("Anchor the scene in concrete physical detail.");
    });

    it("trims leading/trailing whitespace", () => {
      expect(
        normalizeRecommendationAction("  Tighten the dialogue in the opening.  ")
      ).toBe("Tighten the dialogue in the opening.");
    });
  });

  describe("does not launder — no new editorial content synthesized", () => {
    it("does not expand a stub into a full sentence", () => {
      // "Strengthen voice" should NOT become "Strengthen voice throughout the manuscript."
      expect(normalizeRecommendationAction("Strengthen voice")).toBeNull();
    });

    it("does not change the semantic content of valid actions", () => {
      const action = "Ground each flashback in a specific sensory trigger that justifies the temporal shift.";
      expect(normalizeRecommendationAction(action)).toBe(action);
    });
  });

  describe("integration: parsePass2Response strips rejected recommendations", () => {
    it("filters out recommendations with invalid actions before output", () => {
      const { parsePass2Response } = require("@/lib/evaluation/pipeline/runPass2");
      const rawResponse = JSON.stringify({
        pass: 2,
        axis: "editorial_literary",
        criteria: [
          {
            key: "concept",
            score_0_10: 6,
            rationale: "The concept demonstrates thematic depth through its exploration of familial obligation and loss.",
            evidence: [{ snippet: "Sister's shadow hung over everything.", char_start: 100, char_end: 140 }],
            recommendations: [
              {
                priority: "medium",
                action: "Anchor the central concept in a concrete dramatic question that the reader can track scene by scene",
                expected_impact: "Strengthens reader engagement.",
                anchor_snippet: "Sister's shadow hung over everything.",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
                candidate_text_a: "Billy watched the tent flap.",
                candidate_text_b: "The river carried her name.",
                candidate_text_c: "Every shadow wore her face.",
              },
              {
                priority: "low",
                action: "Pacing",
                expected_impact: "Fixes pacing.",
                anchor_snippet: "...",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
                candidate_text_a: "x",
                candidate_text_b: "y",
                candidate_text_c: "z",
              },
              {
                priority: "medium",
                action: "Because the scene",
                expected_impact: "...",
                anchor_snippet: "...",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
                candidate_text_a: "x",
                candidate_text_b: "y",
                candidate_text_c: "z",
              },
            ],
          },
        ],
        prompt_version: "pass2-editorial-v10-candidate-prose",
        temperature: 0.3,
        generated_at: "2026-06-09T00:00:00.000Z",
      });

      const result = parsePass2Response(rawResponse, "gpt-4.1");
      const recs = result.criteria[0].recommendations;

      // Only the valid action should survive (repaired with period)
      expect(recs).toHaveLength(1);
      expect(recs[0].action).toBe(
        "Anchor the central concept in a concrete dramatic question that the reader can track scene by scene."
      );
    });

    it("throws RECOMMENDATION_DENSITY_UNMET if all recs rejected for low-scoring criterion (3000+ words)", () => {
      const { parsePass2Response } = require("@/lib/evaluation/pipeline/runPass2");
      const rawResponse = JSON.stringify({
        pass: 2,
        axis: "editorial_literary",
        criteria: [
          {
            key: "concept",
            score_0_10: 4,
            rationale: "The concept demonstrates thematic depth through its exploration of familial obligation and loss.",
            evidence: [{ snippet: "Sister's shadow hung over everything.", char_start: 100, char_end: 140 }],
            recommendations: [
              {
                priority: "high",
                action: "Pacing",
                expected_impact: "...",
                anchor_snippet: "...",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
              },
              {
                priority: "medium",
                action: "More detail",
                expected_impact: "...",
                anchor_snippet: "...",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
              },
            ],
          },
        ],
        prompt_version: "pass2-editorial-v10-candidate-prose",
        temperature: 0.3,
        generated_at: "2026-06-09T00:00:00.000Z",
      });

      // With 5000-word scope, density enforcement fires (requires ≥1 rec for score ≤5)
      expect(() => parsePass2Response(rawResponse, "gpt-4.1", { manuscriptWordCount: 5000 })).toThrow("RECOMMENDATION_DENSITY_UNMET");
    });

    it("does NOT throw density error for short submission (201 words) even if all recs stripped", () => {
      const { parsePass2Response } = require("@/lib/evaluation/pipeline/runPass2");
      const rawResponse = JSON.stringify({
        pass: 2,
        axis: "editorial_literary",
        criteria: [
          {
            key: "concept",
            score_0_10: 4,
            rationale: "The concept is present but underdeveloped in this short passage.",
            evidence: [],
            recommendations: [
              {
                priority: "high",
                action: "Pacing",
                expected_impact: "...",
                anchor_snippet: "...",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
              },
            ],
          },
        ],
        prompt_version: "pass2-editorial-v10-candidate-prose",
        temperature: 0.3,
        generated_at: "2026-06-09T00:00:00.000Z",
      });

      // With 201-word scope, density enforcement does NOT fire — 0 recs is acceptable
      const result = parsePass2Response(rawResponse, "gpt-4.1", { manuscriptWordCount: 201 });
      expect(result.criteria[0].recommendations).toHaveLength(0);
    });
  });

  describe("end-to-end: malformed Pass 2 recs cannot reach pass12_handoff_v1", () => {
    it("normalizer strips fragments → handoff gate never sees them", () => {
      const { parsePass2Response } = require("@/lib/evaluation/pipeline/runPass2");
      const { runPass12HandoffGate } = require("@/lib/evaluation/pipeline/pass12HandoffGate");

      // Build a Pass 2 response where 3/4 recs have malformed actions
      const rawResponse = JSON.stringify({
        pass: 2,
        axis: "editorial_literary",
        criteria: [
          {
            key: "concept",
            score_0_10: 7,
            rationale: "The concept demonstrates thematic depth through its exploration of familial obligation and loss.",
            evidence: [{ snippet: "Sister's shadow hung over everything.", char_start: 100, char_end: 140 }],
            recommendations: [
              {
                priority: "high",
                action: "Establish a specific recurring image that functions as a pressure symbol across scenes",
                expected_impact: "Creates cumulative tension.",
                anchor_snippet: "Sister's shadow hung over everything.",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
              },
              {
                priority: "medium",
                action: "Stronger imagery",
                expected_impact: "...",
                anchor_snippet: "...",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
              },
              {
                priority: "low",
                action: "Because the scene needs more",
                expected_impact: "...",
                anchor_snippet: "...",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
              },
              {
                priority: "low",
                action: "The opening paragraph",
                expected_impact: "...",
                anchor_snippet: "...",
                issue_family: "scene_structure",
                strategic_lever: "scene_goal_clarity",
                revision_granularity: "scene",
              },
            ],
          },
        ],
        prompt_version: "pass2-editorial-v10-candidate-prose",
        temperature: 0.3,
        generated_at: "2026-06-09T00:00:00.000Z",
      });

      // Step 1: parsePass2Response normalizes/filters
      const parsed = parsePass2Response(rawResponse, "gpt-4.1");
      const survivingRecs = parsed.criteria[0].recommendations;

      // Only the valid long imperative survives (with period appended)
      expect(survivingRecs).toHaveLength(1);
      expect(survivingRecs[0].action).toBe(
        "Establish a specific recurring image that functions as a pressure symbol across scenes."
      );

      // Step 2: Feed the normalized output through the handoff gate
      const pass1Empty = {
        pass: 1,
        axis: "editorial_literary",
        criteria: [],
        model_id: "gpt-4.1",
        prompt_version: "test",
        temperature: 0.3,
        generated_at: "2026-06-09T00:00:00.000Z",
      };

      const gateResult = runPass12HandoffGate(pass1Empty, parsed);

      // Gate should pass — no HANDOFF_INCOMPLETE_SENTENCE violations on rec actions
      const incompleteSentenceViolations = gateResult.violations.filter(
        (v: { code: string; field: string }) => v.code === "HANDOFF_INCOMPLETE_SENTENCE" && v.field === "recommendation_action"
      );
      expect(incompleteSentenceViolations).toHaveLength(0);
    });

    it("handoff gate still catches malformed actions if normalizer is somehow bypassed", () => {
      const { runPass12HandoffGate } = require("@/lib/evaluation/pipeline/pass12HandoffGate");

      // Simulate what would happen if normalizer was disabled — raw malformed recs
      const pass2WithMalformedRecs = {
        pass: 2,
        axis: "editorial_literary",
        criteria: [
          {
            key: "concept",
            score_0_10: 6,
            rationale: "The concept demonstrates thematic depth through its exploration of familial obligation and loss.",
            evidence: [{ snippet: "test quote", char_start: 0, char_end: 10 }],
            recommendations: [
              { priority: "medium", action: "Pacing", expected_impact: "...", anchor_snippet: "...", issue_family: "scene_structure", strategic_lever: "scene_goal_clarity", revision_granularity: "scene" },
              { priority: "medium", action: "More sensory detail in the opening", expected_impact: "...", anchor_snippet: "...", issue_family: "scene_structure", strategic_lever: "scene_goal_clarity", revision_granularity: "scene" },
              { priority: "medium", action: "Because the scene needs better structure", expected_impact: "...", anchor_snippet: "...", issue_family: "scene_structure", strategic_lever: "scene_goal_clarity", revision_granularity: "scene" },
            ],
          },
        ],
        model_id: "gpt-4.1",
        prompt_version: "test",
        temperature: 0.3,
        generated_at: "2026-06-09T00:00:00.000Z",
      };

      const pass1Empty = {
        pass: 1,
        axis: "editorial_literary",
        criteria: [],
        model_id: "gpt-4.1",
        prompt_version: "test",
        temperature: 0.3,
        generated_at: "2026-06-09T00:00:00.000Z",
      };

      const gateResult = runPass12HandoffGate(pass1Empty, pass2WithMalformedRecs);

      // Gate catches malformed actions that lack complete sentences.
      // "Pacing" (1 word) may be too short for the gate's sentence heuristic to flag,
      // but the multi-word fragments without punctuation MUST be caught.
      const incompleteSentenceViolations = gateResult.violations.filter(
        (v: { code: string; field: string }) => v.code === "HANDOFF_INCOMPLETE_SENTENCE" && v.field === "recommendation_action"
      );
      expect(incompleteSentenceViolations.length).toBeGreaterThanOrEqual(2);
    });
  });
});
