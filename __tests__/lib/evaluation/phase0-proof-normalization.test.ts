export {};

import {
  isPhase0ProofSatisfied,
  normalizePhase0ProofDuration,
} from "../../../lib/evaluation/processor";

describe("Phase 0 proof normalization regression", () => {
  test("normalizes 11999ms raw duration to 12000ms via llm+dwell component sum", () => {
    const llmDurationMs = 9984;
    const dwellDurationMs = 2016;
    const measuredDurationMs = 11999;
    const words = 748;

    expect(words).toBeGreaterThanOrEqual(500);

    const normalized = normalizePhase0ProofDuration({
      measuredDurationMs,
      llmDurationMs,
      dwellDurationMs,
      minDwellMs: 12_000,
    });

    expect(normalized.normalizedDurationMs).toBe(12_000);
    expect(normalized.proofNormalized).toBe(true);

    const proven = isPhase0ProofSatisfied({
      totalDurationMs: normalized.normalizedDurationMs,
      measuredDurationMs,
      minProvenMs: 12_000,
      toleranceMs: 100,
    });

    expect(proven).toBe(true);
  });
});
