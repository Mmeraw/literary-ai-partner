import { canReleaseEvaluationRead } from "@/lib/jobs/readReleaseGate";

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
});
