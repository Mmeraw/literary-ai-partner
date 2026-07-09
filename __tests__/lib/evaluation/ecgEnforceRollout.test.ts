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
        verdict: "revise",
        one_paragraph_summary:
          "The manuscript earns 74/100 because the central concept and character pressure are clear, while pacing and thematic escalation remain the principal revision priorities.",
        one_sentence_pitch:
          "A retired diamond trader faces a friendship-defining cobalt proposition in Antwerp.",
        one_paragraph_pitch:
          "A retired Antwerp diamond trader is drawn into a cobalt opportunity that tests friendship, loyalty, and the cost of staying relevant in a collapsing industry.",
        top_3_strengths: [
          "The central friendship creates clear emotional stakes.",
          "The Antwerp setting gives the manuscript a concrete market texture.",
          "The premise creates strong revision leverage for pacing and theme.",
        ],
        top_3_risks: [
          "Pacing weakens when exposition delays scene-level consequence.",
          "Thematic pressure needs sharper escalation across decision beats.",
          "Reader investment depends on clearer causal payoff in the final turn.",
        ],
      },
      enrichment: {
        premise:
          "An Antwerp diamond trader must decide whether a cobalt venture is a lifeline, a betrayal, or the final proof that his old life is over.",
        diagnosed_genre: "Upmarket fiction",
        target_audience: "Adult readers of literary commercial fiction",
      },
      recommendations: {
        quick_wins: [
          {
            action:
              "Compress the first exposition-heavy exchange so the reader reaches the cobalt proposition before momentum softens.",
          },
        ],
        strategic_revisions: [
          {
            action:
              "Add one visible decision beat after the cobalt offer so the protagonist's loyalty conflict becomes external and testable.",
          },
        ],
      },
      criteria: [
        {
          key: "concept",
          final_score_0_10: 8,
          final_rationale:
            "The cobalt-and-diamond premise has strong market-facing specificity and clear ethical pressure.",
        },
        {
          key: "pacing",
          final_score_0_10: 6,
          final_rationale:
            "The manuscript has visible propulsion, but several exposition runs delay the next consequential beat.",
        },
      ],
      governance: {
        confidence: 0.84,
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

  it("defaults unset ECG_MODE to ENFORCE", () => {
    delete process.env.ECG_MODE;
    expect(ECG_DEFAULT_MODE).toBe("ENFORCE");
    expect(getECGMode()).toBe("ENFORCE");
  });

  it("defaults empty ECG_MODE to ENFORCE", () => {
    process.env.ECG_MODE = "   ";
    expect(getECGMode()).toBe("ENFORCE");
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

  it("certifies a clean artifact under the ENFORCE default", () => {
    delete process.env.ECG_MODE;
    const result = runEvaluationCertificationGate(makeCertificationInput());

    expect(result.mode).toBe("ENFORCE");
    expect(result.status).toBe("CERTIFIED");
    expect(result.fatal).toHaveLength(0);
  });
});
