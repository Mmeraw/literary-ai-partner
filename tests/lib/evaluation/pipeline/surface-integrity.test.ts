import { checkSurfaceIntegrity } from "@/lib/evaluation/pipeline/surfaceIntegrity";
import { parsePass3Response } from "@/lib/evaluation/pipeline/runPass3Synthesis";

type ExpectedStatus = "ACCEPT" | "FLAG" | "REJECT";

describe("#364 surface-integrity fixture matrix", () => {
  const fixtures: Array<{ input: string; expected: ExpectedStatus }> = [
    { input: "adding more personal.", expected: "REJECT" },
    { input: "make the scene more specific.", expected: "REJECT" },
    { input: "sharpen the emotional stakes to feel more immediate.", expected: "ACCEPT" },
    { input: "make the secondary characters more.", expected: "REJECT" },
    { input: "make the secondary characters more personal.", expected: "FLAG" },
    {
      input:
        "Replace one expository exchange with two short turns plus an interruption beat so scene because the attribution gap causes speaker intent to blur.",
      expected: "REJECT",
    },
    {
      input:
        "Tighten the reflection so the section can balance detailed because the current draft stalls momentum.",
      expected: "REJECT",
    },
    {
      input:
        "Reorder the beats so that because the cause is delayed, the effect feels disconnected.",
      expected: "REJECT",
    },
    { input: "Reorder the beats so the cause arrives before the effect.", expected: "ACCEPT" },
    {
      input: "Trim overly detailed scene descriptions to maintain narrative momentum.",
      expected: "REJECT",
    },
    { input: "Improve the pacing.", expected: "REJECT" },
    {
      input:
        "Tighten sentence-level prose in Chapter 11 by cutting repeated reflections after the key decision beat so the section reads cleaner and faster.",
      expected: "ACCEPT",
    },
    {
      input: "By adding more pressure on the protagonist, the river's history becomes clearer.",
      expected: "FLAG",
    },
    { input: "After increasing the tension, the scene feels more urgent.", expected: "ACCEPT" },
    {
      input:
        "To deepen the secondary character, the confrontation scene on the bridge should be expanded.",
      expected: "ACCEPT",
    },
    { input: "To make it more personal.", expected: "REJECT" },
    { input: "Clarify who makes the key decision and.", expected: "REJECT" },
    {
      input:
        "Clarify who makes the key decision and how it changes the group's approach to the river.",
      expected: "ACCEPT",
    },
    { input: "Tighten the scene by cutting redundant description and by.", expected: "REJECT" },
    {
      input:
        "Tighten the scene by cutting redundant description and by anchoring the reflection in a specific physical choice.",
      expected: "ACCEPT",
    },
  ];

  test.each(fixtures)("$expected — $input", ({ input, expected }) => {
    expect(checkSurfaceIntegrity(input).status).toBe(expected);
  });
});

describe("#364 integration in parsePass3Response", () => {
  const basePass = {
    criteria: [],
    model: "test",
  };

  function buildRaw(action: string, anchorSnippet = "opening scene") {
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
              anchor_snippet: anchorSnippet,
              priority: "high",
              source_pass: 3,
              issue_family: "character",
              strategic_lever: "character_voice_differentiation",
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
        submission_readiness: "close",
      },
    });
  }

  test("REJECT action is dropped from synthesized recommendations", () => {
    const result = parsePass3Response(
      buildRaw("Improve the pacing.", ""),
      basePass as any,
      basePass as any,
    );

    const criterion = result.criteria.find((c) => c.key === "character");
    expect(criterion?.recommendations).toHaveLength(0);
  });

  test("FLAG action is retained with bounded annotation", () => {
    const result = parsePass3Response(
      buildRaw("make the secondary characters more personal.", ""),
      basePass as any,
      basePass as any,
    );

    const criterion = result.criteria.find((c) => c.key === "character");
    expect(criterion?.recommendations).toHaveLength(1);
    expect(criterion?.recommendations[0]?.expected_impact).toMatch(/Surface-integrity flag:/i);
  });
});
