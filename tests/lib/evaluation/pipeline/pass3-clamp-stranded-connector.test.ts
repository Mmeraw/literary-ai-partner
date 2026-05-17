/**
 * Pass3 clamp · stranded-connector regression contract
 *
 * Locks in the contract that the Pass 3 recommendation clamp must never
 * produce an action whose tail strands a conjunction or mechanism connector,
 * because such tails are correctly rejected as surface-integrity defects
 * (`unresolved_conjunction_tail` / `unresolved_mechanism_tail`).
 *
 * Two implementations carry the clamp boundary:
 *   - lib/evaluation/pipeline/runPass3Synthesis.ts::clampRecommendationAction
 *   - lib/evaluation/pipeline/surfaceIntegrity.ts::simulateRecommendationClamp
 *
 * They are an intentional witness pair. This test exercises the production
 * boundary through `parsePass3Response`, so any drift in either implementation
 * surfaces here as a contract violation rather than as a recommendation
 * silently dropped at the surface-integrity REJECT layer.
 *
 * Coverage shape: contract-coupled, not implementation-coupled. The matrix
 * is adversarial — it deliberately constructs inputs whose unmodified clamp
 * truncation would land on a connector, including each connector class:
 *   conjunctions: and, or, by
 *   mechanism connectors: because, since, so, so that
 *
 * Idempotency is also asserted: clamping a clamped action yields no further
 * mutation.
 */

import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { checkSurfaceIntegrity } from "@/lib/evaluation/pipeline/surfaceIntegrity";

describe("Pass3 clamp · stranded-connector regression contract", () => {
  const basePass = {
    criteria: [],
    model: "test",
  };

  /**
   * Builds a Pass 3 raw response carrying a single character-criterion
   * recommendation whose `action` is the supplied string.
   */
  function buildRaw(action: string): string {
    return JSON.stringify({
      criteria: [
        {
          key: "character",
          final_score_0_10: 7,
          final_rationale: "Valid rationale with mechanism.",
          recommendations: [
            {
              action,
              expected_impact: "Improves clarity and engagement for the reader.",
              anchor_snippet: "opening scene",
              priority: "high",
              source_pass: 3,
              issue_family: "character",
              strategic_lever: "motivation",
              revision_granularity: "scene",
            },
          ],
        },
      ],
      overall: {
        overall_score_0_100: 70,
        verdict: "revise",
        one_paragraph_summary: "Summary.",
        top_3_strengths: [],
        top_3_risks: [],
        submission_readiness: "nearly_ready",
      },
    });
  }

  function characterAction(raw: string): string {
    const result = parsePass3Response(raw, basePass as any, basePass as any);
    const criterion = result.criteria.find((c) => c.key === "character");
    if (!criterion?.recommendations[0]) {
      throw new Error(
        "Contract violation: clamp produced output the surface-integrity " +
          "layer rejected, dropping the recommendation entirely. The clamp " +
          "must produce surface-clean output for any input.",
      );
    }
    return criterion.recommendations[0].action;
  }

  // Adversarial matrix. Each entry is engineered so that a naive
  // length-bounded truncation would land on a stranded connector.
  const longTail =
    "and weak and unclear and broken and stranded and pointless and ineffective " +
    "and ambiguous and confusing and inadequate and lifeless and limp and so on " +
    "and so on and so on and";

  const adversarialInputs: Array<{ label: string; action: string }> = [
    {
      label: "trailing and-chain after because",
      action:
        "In the opening scene, rewrite the dialogue exchange to clarify motivation " +
        "because the current phrasing is vague " +
        longTail,
    },
    {
      label: "trailing or",
      action:
        "Rewrite the scene to clarify motivation or restructure the act-level " +
        "beats to surface stakes earlier because momentum stalls when the " +
        "protagonist's drive is hidden behind expository monologue or interior " +
        "reflection or",
    },
    {
      label: "trailing by",
      action:
        "Tighten the scene by cutting redundant description and by anchoring " +
        "the reflection in a specific physical choice and by",
    },
    {
      label: "trailing because",
      action:
        "Rewrite the dialogue exchange to clarify character intent because " +
        "the phrasing is vague and the motivation is hidden because",
    },
    {
      label: "trailing since",
      action:
        "Restructure the chapter to surface stakes earlier since the protagonist's " +
        "drive is buried under exposition since",
    },
    {
      // Note: the input deliberately avoids a `so ... because` sequence,
      // because that is a separate REJECT class (connector_collision_so_because)
      // unrelated to the stranded-connector tail this test exercises.
      label: "trailing so",
      action:
        "Cut one reflective beat and insert an external trigger to clarify " +
        "motivation since the reflection stalls forward motion so",
    },
    {
      label: "trailing so that",
      action:
        "Reorder the beats to clarify cause and effect so that the consequence " +
        "lands cleanly and the reader can follow the turn so that",
    },
  ];

  test.each(adversarialInputs)(
    "$label — clamp tail is surface-clean",
    ({ action }) => {
      const clamped = characterAction(buildRaw(action));

      // 1. Length contract.
      expect(clamped.length).toBeLessThanOrEqual(300);

      // 2. Surface-clean contract: the clamped tail must pass surface-integrity
      //    on its own. This is the inverse of the bug — the post-clamp surface
      //    check should never need to REJECT a clamp's own output.
      const integrity = checkSurfaceIntegrity(clamped);
      expect(integrity.status).not.toBe("REJECT");

      // 3. No stranded-connector tail (the specific defect class).
      expect(clamped).not.toMatch(/\b(and|or|by)\s*\.$/i);
      expect(clamped).not.toMatch(/\b(because|since|so|so\s+that)\s*\.$/i);
    },
  );

  test("idempotency: clamping a clamped action is a no-op", () => {
    for (const { action } of adversarialInputs) {
      const first = characterAction(buildRaw(action));
      const second = characterAction(buildRaw(first));
      expect(second).toBe(first);
    }
  });

  test("preserves anchor when present in the kept prefix", () => {
    const action =
      "In the opening scene, " +
      "rewrite the dialogue exchange to clarify character intent and emotional " +
      "stakes because the current phrasing is vague and does not establish " +
      "clear motivation, which reduces reader engagement and weakens narrative " +
      "momentum across the entire interaction. ".repeat(2);
    const clamped = characterAction(buildRaw(action));
    expect(clamped.toLowerCase()).toMatch(/opening scene|in the/);
  });

  test("preserves mechanism connector when present", () => {
    const action =
      "Rewrite the dialogue exchange to clarify character intent and " +
      "emotional stakes because the current phrasing is vague and does not " +
      "establish clear motivation, which reduces reader engagement and " +
      "weakens narrative momentum across the entire interaction. ".repeat(2);
    const clamped = characterAction(buildRaw(action));
    expect(clamped).toMatch(/\b(because|since|so that)\b/i);
  });

  /**
   * Short well-formed actions that already satisfy the editorial contract
   * (specific_fix + mechanism + reader_effect) bypass the rhetorical-family
   * repair layer introduced by PR #359 and pass through the clamp untouched
   * except for terminal punctuation.
   *
   * Anchored actions that lack one of the three contract markers are
   * intentionally rewritten by buildCriterionAwareActionRepair; that
   * behavior is owned by the diversifier contract, not the clamp contract,
   * and is asserted in pass3-backfill-quality.test.ts.
   */
  test("short, well-formed actions are unchanged except for terminal punctuation", () => {
    const wellFormed =
      "Rewrite the dialogue exchange to clarify motivation because " +
      "the current phrasing leaves reader stakes flat";
    const clamped = characterAction(buildRaw(wellFormed));
    expect(clamped).toBe(`${wellFormed}.`);
  });
});
