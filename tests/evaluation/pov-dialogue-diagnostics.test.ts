import { analyzePovRendering } from "@/lib/evaluation/pov/analyzePovRendering";
import { analyzeDialogueAttribution } from "@/lib/evaluation/pov/analyzeDialogueAttribution";
import { validatePovCriterionEvidence } from "@/lib/evaluation/pov/validatePovCriterionEvidence";
import { runQualityGate } from "@/lib/evaluation/pipeline/qualityGate";
import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";
import type { SynthesisOutput, SynthesizedCriterion } from "@/lib/evaluation/pipeline/types";

function makeCriterion(
  key: CriterionKey,
  overrides: Partial<SynthesizedCriterion> = {},
): SynthesizedCriterion {
  return {
    key,
    craft_score: 7,
    editorial_score: 7,
    final_score_0_10: 7,
    score_delta: 0,
    final_rationale:
      key === "voice"
        ? "POV thought is integrated into narration with stable cognition channel and no unnecessary italics."
        : key === "dialogue"
          ? "Dialogue attribution remains minimal with clear speaker tracking and low tag dependency."
          : "Criterion is supported by clear evidence and coherent causal reasoning in this chapter.",
    pressure_points: ["Pressure begins in opening exchange"],
    decision_points: ["Narrator commits to comparative framing"],
    consequence_status: "landed",
    evidence: [{ snippet: "The Yucatán," }],
    recommendations: [
      {
        priority: "medium",
        action:
          "Tighten one sentence-level transition so the paragraph turn lands with sharper consequence framing and cleaner cognitive flow.",
        expected_impact: "Improves continuity and preserves momentum.",
        anchor_snippet: "Same pattern. Everywhere.",
        source_pass: 3,
      },
    ],
    ...overrides,
  };
}

function makeSynthesis(overrides: Partial<SynthesizedCriterion>[] = []): SynthesisOutput {
  return {
    criteria: CRITERIA_KEYS.map((key, i) => makeCriterion(key, overrides[i] ?? {})),
    overall: {
      overall_score_0_100: 76,
      verdict: "pass",
      one_paragraph_summary:
        "A controlled chapter with stable narrative authority and clear thematic progression that can still tighten some transitions.",
      top_3_strengths: ["voice", "theme", "dialogue"],
      top_3_risks: ["pacing", "marketability", "closure"],
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

describe("POV + dialogue diagnostics", () => {
  test("close POV zero-italics produces positive signals", () => {
    const manuscript = `I checked the mirror again. Why am I checking it again?\n\n"The Yucatán."\nCliff tapped the map. "Sounds familiar."`;

    const pov = analyzePovRendering({
      manuscriptText: manuscript,
      isClosePov: true,
      povMode: "first_person",
    });

    expect(
      pov.findings.some(
        (f) =>
          f.code === "ZERO_ITALICS_CLOSE_POV_VALID" ||
          f.code === "INTEGRATED_COGNITION_STRONG",
      ),
    ).toBe(true);
    expect(pov.issueCount).toBe(0);
  });

  test("mixed thought rendering is flagged", () => {
    const manuscript = `Why am I still trusting him?\n\n*He is lying.*\n\nI could feel the shift before he spoke.`;
    const pov = analyzePovRendering({ manuscriptText: manuscript, isClosePov: true, povMode: "first_person" });
    expect(pov.findings.some((f) => f.code === "MIXED_THOUGHT_RENDERING_NO_LOGIC")).toBe(true);
  });

  test("non-auditory quoted channel is flagged", () => {
    const manuscript = `Dampness whispered, "We remember every drop."`;
    const pov = analyzePovRendering({ manuscriptText: manuscript, isClosePov: false, povMode: "unknown" });
    expect(pov.findings.some((f) => f.code === "NON_AUDITORY_IN_QUOTES")).toBe(true);
  });

  test("redundant tag candidates are detected", () => {
    const manuscript = `"The Yucatán," I said.\n"Sounds familiar," he said.\n"Same pattern," I said.`;
    const dialogue = analyzeDialogueAttribution({ manuscriptText: manuscript });
    expect(dialogue.removableTagCount).toBeGreaterThan(0);
    expect(dialogue.findings.some((f) => f.code === "REDUNDANT_ATTRIBUTION")).toBe(true);
  });

  test("quality gate fails manuscript-aware POV checks for generic voice/dialogue rationale", () => {
    const synthesis = makeSynthesis(
      CRITERIA_KEYS.map((key) =>
        key === "voice"
          ? { final_rationale: "The voice feels strong and mostly effective." }
          : key === "dialogue"
            ? { final_rationale: "Conversations work and generally read fine." }
            : {},
      ),
    );

    const manuscript = `I looked at Cliff.\n\n"The Yucatán," I said.\n"Sounds familiar," he said.`;
    const result = runQualityGate(synthesis, undefined, undefined, manuscript);

    expect(result.pass).toBe(false);
    expect(result.checks.some((c) => c.error_code === "QG_POV_GENERIC_REASONING")).toBe(true);
    expect(result.checks.some((c) => c.error_code === "QG_DIALOGUE_ATTRIBUTION_UNDERAUDITED")).toBe(true);
  });

  test("evidence pack validator reports missing anchors deterministically", () => {
    const validated = validatePovCriterionEvidence({
      criterion: "voice",
      pov: {
        dominantMode: "unknown",
        integratedThoughtCount: 0,
        markedThoughtCount: 0,
        mixedRenderingCount: 0,
        externalConsciousnessCount: 0,
        issueCount: 0,
        findings: [],
      },
      dialogue: {
        totalDialogueLines: 0,
        totalAttributionTags: 0,
        tagsPerThousandWords: 0,
        softTagCount: 0,
        removableTagCount: 0,
        dependencyScore: 0,
        findings: [],
      },
      requiredEvidencePresent: false,
    });

    expect(validated.requiredEvidencePresent).toBe(false);
    expect(validated.invalidReason).toBe("MISSING_POV_EVIDENCE");
  });
});
