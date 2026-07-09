/**
 * #1222 ECG rollout proof.
 *
 * These tests deliberately exercise policy resolution and gate behavior only.
 * Processor/persistence behavior is covered by existing processor real-gate suites;
 * Flow 1 remains an infra smoke proof and is isolated in WARN_ONLY by workflow env.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { getECGMode, ECG_DEFAULT_MODE } from "@/lib/evaluation/policy";
import {
  buildECGInput,
  runEvaluationCertificationGate,
  type ECGInput,
} from "@/lib/evaluation/pipeline/evaluationCertificationGate";

const ORIGINAL_ECG_MODE = process.env.ECG_MODE;

function restoreECGMode() {
  if (ORIGINAL_ECG_MODE === undefined) {
    delete process.env.ECG_MODE;
  } else {
    process.env.ECG_MODE = ORIGINAL_ECG_MODE;
  }
}

function makeCertificationInput(): ECGInput {
  return buildECGInput(
    {
      overview: {
        overall_score_0_100: 74,
        verdict: "not_market_ready",
        one_paragraph_summary:
          "The manuscript earns a 74/100 on the strength of its Concept & Premise and Character Depth, with clear revision pressure in Pacing & Structural Balance. The author should preserve the specific Antwerp setting and sharpen scene-level consequence before submission.",
        one_sentence_pitch:
          "A sardonic Antwerp diamond dealer's retirement evening becomes a reckoning with cobalt, blood money, and a lifelong friendship.",
        one_paragraph_pitch:
          "Calvin, a burned-out diamond trader, joins his old friend Monty in Antwerp's SkyNooz penthouse for a farewell evening that turns into an ultimatum: join a high-stakes cobalt operation in the Democratic Republic of Congo, or watch a twenty-five-year friendship dissolve.",
        top_3_strengths: [
          "Strong Calvin-Monty friendship dynamic with specific banter.",
          "Vivid Antwerp worldbuilding with authoritative industry detail.",
          "Consistent sardonic tonal authority throughout.",
        ],
        top_3_risks: [
          "Mid-chapter expository density slows pacing before the GeoCam reveal.",
          "Occasional overextended sentences weaken the narrative voice.",
          "Excerpt ending defers emotional payoff without a clear promise.",
        ],
      },
      enrichment: {
        premise:
          "A burned-out Antwerp diamond trader facing the collapse of his industry lures his cautious Canadian friend into a lavish SkyNooz penthouse evening where a risky cobalt job forces them to confront how much they will risk for money, status, and friendship.",
        diagnosed_genre: "Literary / Upmarket Fiction",
        target_audience: "Adult literary fiction readers",
      },
      recommendations: {
        quick_wins: [
          {
            action:
              "Compress the most repetitive sentences in the mid-chapter diamond and vanity exposition so the narrative reaches the GeoCam offer a page sooner without sacrificing the core ideas.",
          },
        ],
        strategic_revisions: [
          {
            action:
              "Introduce one or two small physical beats in the penthouse scene that use the windows or Macallan bottle to echo Monty's emotional state whenever the conversation about the Democratic Republic of Congo reaches a new turning point.",
          },
        ],
      },
      criteria: [
        {
          key: "concept",
          final_score_0_10: 8,
          final_rationale:
            "The concept linking diamond industry collapse to cobalt mining and personal ethics is fresh.",
        },
        {
          key: "narrativeDrive",
          final_score_0_10: 7,
          final_rationale:
            "Momentum flows through the escalating penthouse conversation but stalls during exposition.",
        },
      ],
      governance: {
        confidence: 0.82,
        confidence_label: "High Confidence",
      },
    },
    74,
  );
}

describe("ECG ENFORCE rollout policy (#1222)", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreECGMode();
  });

  it("defaults unset ECG_MODE to ENFORCE without emitting a warning", () => {
    delete process.env.ECG_MODE;
    expect(ECG_DEFAULT_MODE).toBe("ENFORCE");
    expect(getECGMode()).toBe("ENFORCE");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("defaults empty ECG_MODE to ENFORCE without emitting a warning", () => {
    process.env.ECG_MODE = "   ";
    expect(getECGMode()).toBe("ENFORCE");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("defaults invalid ECG_MODE to ENFORCE and emits an operator warning", () => {
    process.env.ECG_MODE = "maybe";
    expect(getECGMode()).toBe("ENFORCE");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown ECG_MODE="MAYBE", falling back to ENFORCE'),
    );
  });

  it.each(["OFF", "WARN_ONLY", "ENFORCE", " warn_only ", " enforce "])(
    "preserves explicit rollback or enforcement override %s",
    (mode) => {
      process.env.ECG_MODE = mode;
      expect(getECGMode()).toBe(mode.trim().toUpperCase());
    },
  );

  it("blocks fatal certification defects by default when ECG_MODE is unset", () => {
    delete process.env.ECG_MODE;
    const input = makeCertificationInput();
    input.overview.one_sentence_pitch = "";

    const result = runEvaluationCertificationGate(input);

    expect(result.mode).toBe("ENFORCE");
    expect(result.status).toBe("CERTIFICATION_FAILED");
    expect(result.fatal.map((violation) => violation.code)).toContain(
      "ECG_ART_MISSING_SENTENCE_PITCH",
    );
  });

  it("keeps WARN_ONLY as an explicit rollback mode that measures fatal rate without blocking", () => {
    process.env.ECG_MODE = "WARN_ONLY";
    const input = makeCertificationInput();
    input.overview.one_sentence_pitch = "";

    const result = runEvaluationCertificationGate(input);

    expect(result.mode).toBe("WARN_ONLY");
    expect(result.status).toBe("CERTIFIED");
    expect(result.fatal.map((violation) => violation.code)).toContain(
      "ECG_ART_MISSING_SENTENCE_PITCH",
    );
  });

  it("skips all invariants under explicit OFF rollback mode", () => {
    process.env.ECG_MODE = "OFF";
    const input = makeCertificationInput();
    input.overview.overall_score_0_100 = 0;
    input.overview.one_paragraph_summary = "";
    input.overview.one_sentence_pitch = "";
    input.recommendations = { quick_wins: [], strategic_revisions: [] };

    const result = runEvaluationCertificationGate(input);

    expect(result.mode).toBe("OFF");
    expect(result.status).toBe("SKIPPED");
    expect(result.violations).toHaveLength(0);
    expect(result.fatal).toHaveLength(0);
  });

  it("certifies a clean artifact under the ENFORCE default", () => {
    delete process.env.ECG_MODE;
    const result = runEvaluationCertificationGate(makeCertificationInput());

    expect(result.mode).toBe("ENFORCE");
    expect(result.status).toBe("CERTIFIED");
    expect(result.fatal).toHaveLength(0);
  });
});
