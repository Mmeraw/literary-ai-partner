import {
  buildEvaluationOutputText,
  detectContextContamination,
} from "@/lib/evaluation/governance/contextContaminationGuard";
import type { EvaluationResultV1 } from "@/schemas/evaluation-result-v1";

function makeResult(summary: string, risks: string[] = []): EvaluationResultV1 {
  return {
    schema_version: "evaluation_result_v1",
    ids: {
      evaluation_run_id: "run-1",
      manuscript_id: 1,
      user_id: "user-1",
    },
    generated_at: "2026-04-12T00:00:00.000Z",
    engine: {
      model: "o3",
      provider: "openai",
      prompt_version: "test",
    },
    overview: {
      verdict: "revise",
      overall_score_0_100: 63,
      one_paragraph_summary: summary,
      top_3_strengths: ["Strong atmosphere"],
      top_3_risks: risks,
    },
    criteria: [
      {
        key: "concept",
        score_0_10: 6,
        rationale: "The setup is coherent.",
        evidence: [{ snippet: "River current moved under the bridge." }],
        recommendations: [
          {
            priority: "medium",
            action: "Add friction at scene boundaries.",
            expected_impact: "Improves momentum.",
          },
        ],
      },
    ] as EvaluationResultV1["criteria"],
    recommendations: {
      quick_wins: [
        {
          action: "Clarify transition language.",
          why: "Improves readability.",
          effort: "low",
          impact: "medium",
        },
      ],
      strategic_revisions: [],
    },
    metrics: {
      manuscript: {
        word_count: 1000,
      },
      processing: {
        segment_count: 1,
      },
    },
    artifacts: [],
    governance: {
      confidence: 0.8,
      warnings: [],
      limitations: [],
      policy_family: "standard",
    },
  };
}

describe("context contamination guard", () => {
  test("does not flag grounded output", () => {
    const sourceText = [
      "Cliff piloted the skiff across Carpenter Lake.",
      "At Minto, the narrator reflects on erased foundations.",
    ].join(" ");

    const result = makeResult(
      "Cliff and the narrator sustain reflective tension as they move across Carpenter Lake near Minto.",
      ["Momentum softens in reflective passages."],
    );

    const check = detectContextContamination({ sourceText, evaluationResult: result });

    expect(check.contaminated).toBe(false);
  });

  test("flags cross-manuscript entity bleed (Maria/cartel)", () => {
    const sourceText = [
      "Cliff piloted the skiff across Carpenter Lake.",
      "At Minto, the narrator reflects on erased foundations.",
    ].join(" ");

    const result = makeResult(
      "Maria receives a letter from her missing father in cartel territory and prepares to leave the village.",
      ["The cartel setup needs more external pressure."],
    );

    const check = detectContextContamination({ sourceText, evaluationResult: result });

    expect(check.contaminated).toBe(true);
    expect(check.offendingEntities).toEqual(expect.arrayContaining(["maria"]));
  });

  test("does not false-positive on substring matches (mariage vs maria)", () => {
    const sourceText = [
      "Cliff piloted the skiff across Carpenter Lake.",
      "At Minto, the narrator reflects on erased foundations.",
    ].join(" ");

    const result = makeResult(
      "The narrator reflects on a difficult mariage and uncertain future near Carpenter Lake.",
      ["Reflective tension remains coherent."],
    );

    const check = detectContextContamination({ sourceText, evaluationResult: result });

    expect(check.offendingEntities).not.toContain("maria");
  });

  test("buildEvaluationOutputText includes overview, rationale, and recommendation surfaces", () => {
    const result = makeResult("Minto chapter has strong atmosphere.", ["Needs clearer stakes."]);
    const text = buildEvaluationOutputText(result);

    expect(text).toContain("Minto chapter has strong atmosphere.");
    expect(text).toContain("The setup is coherent.");
    expect(text).toContain("Clarify transition language.");
    expect(text).toContain("Improves readability.");
  });

  test("is deterministic across repeated runs", () => {
    const sourceText = [
      "Cliff piloted the skiff across Carpenter Lake.",
      "At Minto, the narrator reflects on erased foundations.",
    ].join(" ");

    const grounded = makeResult(
      "Cliff and the narrator sustain reflective tension as they move across Carpenter Lake near Minto.",
      ["Momentum softens in reflective passages."],
    );

    const contaminated = makeResult(
      "Maria receives a letter from her missing father in cartel territory and prepares to leave the village.",
      ["The cartel setup needs more external pressure."],
    );

    for (let i = 0; i < 20; i += 1) {
      const groundedCheck = detectContextContamination({ sourceText, evaluationResult: grounded });
      const contaminatedCheck = detectContextContamination({ sourceText, evaluationResult: contaminated });

      expect(groundedCheck.contaminated).toBe(false);
      expect(contaminatedCheck.contaminated).toBe(true);
      expect(contaminatedCheck.offendingEntities).toEqual(expect.arrayContaining(["maria"]));
    }
  });

  test("returns deterministically sorted offending entities", () => {
    const sourceText = "Cliff piloted the skiff across Carpenter Lake.";
    const result = makeResult(
      "zebraline aurorafield cliffstone marineroad",
      ["quartzline amberlight silverpath"],
    );

    const check = detectContextContamination({ sourceText, evaluationResult: result });
    const sorted = [...check.offendingEntities].sort();

    expect(check.contaminated).toBe(true);
    expect(check.offendingEntities).toEqual(sorted);
  });
});
