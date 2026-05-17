import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";

describe("Pass3 recommendation length contract", () => {
  const basePass = {
    criteria: [],
    model: "test",
  };

  const makeLongAction = () =>
    "In the opening scene, rewrite the dialogue exchange to clarify character intent and emotional stakes because the current phrasing is vague and does not establish clear motivation, which reduces reader engagement and weakens narrative momentum across the entire interaction.";

  const observedLongPacingAction =
    "Cut one reflective sentence and insert one immediate external action trigger; Scene momentum drops near years of bureaucratic observation, maps over maps. when reflection resolves before action. Re-sequencing the turn as trigger → reaction → consequence would streamline dense informational sections to maintain narrative momentum because the reflective passage stalls forward momentum before the narrative urgency peaks.";

  function characterAction(result: ReturnType<typeof parsePass3Response>): string {
    const criterion = result.criteria.find((c) => c.key === "character");
    if (!criterion?.recommendations[0]) {
      throw new Error("Expected character recommendation");
    }
    return criterion.recommendations[0].action;
  }

  function buildRaw(action: string) {
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

  test("1. raw overlong recommendation is clamped", () => {
    const result = parsePass3Response(
      buildRaw(makeLongAction().repeat(3)),
      basePass as any,
      basePass as any
    );

    const action = characterAction(result);
    expect(action.length).toBeLessThanOrEqual(300);
  });

  test("2. normalized/repaired recommendation is also clamped", () => {
    const result = parsePass3Response(
      buildRaw("Rewrite dialogue"),
      basePass as any,
      basePass as any
    );

    const action = characterAction(result);
    expect(action.length).toBeLessThanOrEqual(300);
  });

  test("3. preserves anchor/location phrase", () => {
    const result = parsePass3Response(
      buildRaw("In the opening scene, " + makeLongAction().repeat(2)),
      basePass as any,
      basePass as any
    );

    const action = characterAction(result).toLowerCase();
    expect(action).toMatch(/opening scene|in the/);
  });

  test("4. preserves mechanism connector", () => {
    const result = parsePass3Response(
      buildRaw(makeLongAction().repeat(2)),
      basePass as any,
      basePass as any
    );

    const action = characterAction(result);
    expect(action).toMatch(/\b(because|since|so that)\b/i);
  });

  test("5. preserves concrete revision move", () => {
    const result = parsePass3Response(
      buildRaw("Rewrite the dialogue exchange " + makeLongAction().repeat(2)),
      basePass as any,
      basePass as any
    );

    const action = characterAction(result).toLowerCase();
    expect(action).toMatch(/rewrite|cut|insert|replace|move|clarify/);
  });

  test("6. does not trigger QG_LONG_REC", () => {
    const result = parsePass3Response(
      buildRaw(makeLongAction().repeat(3)),
      basePass as any,
      basePass as any
    );

    const gate = runQualityGate(result);
    const longRecFailure = gate.checks.find(
      (c) => c.error_code === "QG_LONG_REC" && !c.passed
    );

    expect(longRecFailure).toBeUndefined();
  });

  test("7. backfilled recommendations are clamped", () => {
    const passWithLongRecommendation = {
      criteria: [
        {
          key: "character",
          score_0_10: 7,
          rationale: "Character rationale.",
          evidence: [{ snippet: "opening scene", char_start: 0, char_end: 12 }],
          recommendations: [
            {
              priority: "high",
              action: makeLongAction().repeat(3),
              expected_impact: "Improves clarity and engagement for the reader.",
              anchor_snippet: "opening scene",
              source_pass: 1,
              issue_family: "character",
              strategic_lever: "motivation",
              revision_granularity: "scene",
            },
          ],
        },
      ],
      model: "test",
    };

    const rawWithoutRecommendations = JSON.stringify({
      criteria: [
        {
          key: "character",
          final_score_0_10: 7,
          final_rationale: "Valid rationale with mechanism.",
          recommendations: [],
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

    const result = parsePass3Response(
      rawWithoutRecommendations,
      passWithLongRecommendation as any,
      basePass as any,
    );

    const action = characterAction(result);
    expect(action.length).toBeLessThanOrEqual(300);

    const gate = runQualityGate(result);
    const longRecFailure = gate.checks.find(
      (c) => c.error_code === "QG_LONG_REC" && !c.passed,
    );
    expect(longRecFailure).toBeUndefined();
  });

  test("8. clamps exact observed 421-char failure shape", () => {
    const result = parsePass3Response(
      JSON.stringify({
        criteria: [
          {
            key: "pacing",
            final_score_0_10: 6,
            final_rationale: "Valid pacing rationale with mechanism.",
            recommendations: [
              {
                action: observedLongPacingAction,
                expected_impact: "Improves momentum and keeps reader engagement through the turn.",
                anchor_snippet: "years of bureaucratic observation, maps over maps",
                priority: "high",
                source_pass: 3,
                issue_family: "pacing",
                strategic_lever: "tempo",
                revision_granularity: "scene",
              },
            ],
          },
        ],
        overall: {
          overall_score_0_100: 68,
          verdict: "revise",
          one_paragraph_summary: "Summary.",
          top_3_strengths: [],
          top_3_risks: [],
          submission_readiness: "nearly_ready",
        },
      }),
      basePass as any,
      basePass as any,
    );

    const pacing = result.criteria.find((c) => c.key === "pacing");
    expect(pacing?.recommendations[0]?.action.length).toBeLessThanOrEqual(300);

    const gate = runQualityGate(result);
    const longRecFailure = gate.checks.find(
      (c) => c.error_code === "QG_LONG_REC" && !c.passed,
    );
    expect(longRecFailure).toBeUndefined();
  });
});
