import {
  canReleaseEvaluationRead,
  getEvaluationReleaseDecision,
  RELEASE_CONFIDENCE_THRESHOLD,
} from "@/lib/jobs/readReleaseGate";

describe("canReleaseEvaluationRead", () => {
  test("returns true only for complete + valid", () => {
    expect(
      canReleaseEvaluationRead({
        status: "complete",
        validity_status: "valid",
      }),
    ).toBe(true);
  });

  test("returns false for complete + invalid", () => {
    expect(
      canReleaseEvaluationRead({
        status: "complete",
        validity_status: "invalid",
      }),
    ).toBe(false);
  });

  test("returns false for running + valid", () => {
    expect(
      canReleaseEvaluationRead({
        status: "running",
        validity_status: "valid",
      }),
    ).toBe(false);
  });

  test("returns false for malformed statuses (fail-closed)", () => {
    expect(
      canReleaseEvaluationRead({
        status: "completed",
        validity_status: "valid",
      }),
    ).toBe(false);

    expect(
      canReleaseEvaluationRead({
        status: "complete",
        validity_status: "approved",
      }),
    ).toBe(false);
  });

  test("returns false for low-confidence result without acceptance override", () => {
    expect(
      canReleaseEvaluationRead({
        status: "complete",
        validity_status: "valid",
        evaluation_result: {
          governance: { confidence: RELEASE_CONFIDENCE_THRESHOLD - 0.01 },
        },
      }),
    ).toBe(false);
  });

  test("returns true for low-confidence result with acceptance override", () => {
    expect(
      canReleaseEvaluationRead({
        status: "complete",
        validity_status: "valid",
        accepted_low_confidence: true,
        evaluation_result: {
          governance: { confidence: RELEASE_CONFIDENCE_THRESHOLD - 0.2 },
        },
      }),
    ).toBe(true);
  });
});

describe("getEvaluationReleaseDecision", () => {
  test("returns low_confidence reason when confidence signal blocks release", () => {
    expect(
      getEvaluationReleaseDecision({
        status: "complete",
        validity_status: "valid",
        confidence_0_1: RELEASE_CONFIDENCE_THRESHOLD - 0.05,
      }),
    ).toEqual({
      releasable: false,
      reason: "low_confidence",
      status: "complete",
      validity_status: "valid",
      confidence: RELEASE_CONFIDENCE_THRESHOLD - 0.05,
    });
  });
});
