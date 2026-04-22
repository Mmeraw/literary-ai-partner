import { describe, it, expect, jest } from "@jest/globals";
import { enforcePass3QualityGuards } from "@/lib/evaluation/governance/runtimeQualityGuards";

describe("enforcePass3QualityGuards", () => {
  const goodTelemetry = {
    criteria_count_by_state: {
      agree: 8,
      soft_divergence: 4,
      hard_divergence: 1,
      missing_or_invalid: 0,
    },
  };

  it("passes for healthy output", () => {
    expect(() =>
      enforcePass3QualityGuards({
        telemetry: goodTelemetry,
        output: {
          criteria: Array.from({ length: 13 }, (_, i) => ({
            key: `criterion_${i}`,
            final_score_0_10: 6,
            final_rationale:
              "This rationale explains the synthesis decision with enough detail to preserve judgment.",
          })),
        },
      }),
    ).not.toThrow();
  });

  it("fails on trivial output collapse", () => {
    expect(() =>
      enforcePass3QualityGuards({
        telemetry: goodTelemetry,
        output: {
          criteria: Array.from({ length: 13 }, (_, i) => ({
            key: `criterion_${i}`,
            final_score_0_10: 6,
            final_rationale: i < 8 ? "Confirmed." : "Adequate rationale with real detail here.",
          })),
        },
      }),
    ).toThrow(/TRIVIAL_OUTPUT_COLLAPSE/);
  });

  it("fails on low-information output", () => {
    expect(() =>
      enforcePass3QualityGuards({
        telemetry: goodTelemetry,
        output: {
          criteria: Array.from({ length: 13 }, (_, i) => ({
            key: `criterion_${i}`,
            final_score_0_10: 6,
            final_rationale: "Rationale has some detail.",
          })),
        },
      }),
    ).toThrow(/LOW_INFORMATION_OUTPUT/);
  });

  it("warns (does not fail) on divergence collapse in initial rollout", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      enforcePass3QualityGuards({
        telemetry: {
          criteria_count_by_state: {
            agree: 13,
            soft_divergence: 0,
            hard_divergence: 0,
            missing_or_invalid: 0,
          },
        },
        output: {
          criteria: Array.from({ length: 13 }, (_, i) => ({
            key: `criterion_${i}`,
            final_score_0_10: 6,
            final_rationale:
              "This rationale explains the synthesis decision with enough detail to preserve judgment.",
          })),
        },
      }),
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("DIVERGENCE_COLLAPSE_WARNING"),
    );

    warnSpy.mockRestore();
  });
});
