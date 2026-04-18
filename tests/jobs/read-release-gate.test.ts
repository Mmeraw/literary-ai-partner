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

  test("blocks NaN confidence as malformed_state (fail-closed)", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      confidence_0_1: NaN,
    });
    expect(decision.releasable).toBe(false);
    expect(decision.reason).toBe("malformed_state");
  });

  test("blocks Infinity confidence as malformed_state (fail-closed)", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      confidence_0_1: Infinity,
    });
    expect(decision.releasable).toBe(false);
    expect(decision.reason).toBe("malformed_state");
  });

  test("blocks negative Infinity as malformed_state (fail-closed)", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      confidence_0_1: -Infinity,
    });
    expect(decision.releasable).toBe(false);
    expect(decision.reason).toBe("malformed_state");
  });

  test("blocks out-of-range confidence (> 1) as malformed_state", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      confidence_0_1: 1.5,
    });
    expect(decision.releasable).toBe(false);
    expect(decision.reason).toBe("malformed_state");
  });

  test("blocks out-of-range confidence (< 0) as malformed_state", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      confidence_0_1: -0.5,
    });
    expect(decision.releasable).toBe(false);
    expect(decision.reason).toBe("malformed_state");
  });

  test("blocks malformed nested confidence (NaN in governance)", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      evaluation_result: {
        governance: { confidence: NaN },
      },
    });
    expect(decision.releasable).toBe(false);
    expect(decision.reason).toBe("malformed_state");
  });

  test("accepts valid boundary values: 0", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      confidence_0_1: 0,
    });
    expect(decision.releasable).toBe(false); // 0 < 0.65 threshold
    expect(decision.reason).toBe("low_confidence");
  });

  test("accepts valid boundary values: 1", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      confidence_0_1: 1,
    });
    expect(decision.releasable).toBe(true);
  });

  test("accepts valid boundary values: at threshold", () => {
    const decision = getEvaluationReleaseDecision({
      status: "complete",
      validity_status: "valid",
      confidence_0_1: RELEASE_CONFIDENCE_THRESHOLD,
    });
    expect(decision.releasable).toBe(true);
  });
});
