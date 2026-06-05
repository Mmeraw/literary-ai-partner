import {
  matchesNormalizedPhaseAlias,
  normalizePhaseAlias,
} from "@/lib/admin/phaseAliasMatch";

describe("phaseAliasMatch hardening", () => {
  test("normalizes case, separators, and duplicate underscores", () => {
    expect(normalizePhaseAlias("  PHASE-05.Semantic   Seed__  ")).toBe("phase_05_semantic_seed");
  });

  test("supports exact and boundary matches", () => {
    expect(matchesNormalizedPhaseAlias("phase05", "phase05")).toBe(true);
    expect(matchesNormalizedPhaseAlias("phase05_semantic_seed", "phase05")).toBe(true);
    expect(matchesNormalizedPhaseAlias("phase0.5a_seed", "phase0.5a")).toBe(true);
    expect(matchesNormalizedPhaseAlias("pre_phase05_suffix", "phase05")).toBe(true);
    expect(matchesNormalizedPhaseAlias("pre_phase05", "phase05")).toBe(true);
  });

  test("prevents accidental substring collisions", () => {
    expect(matchesNormalizedPhaseAlias("phase05a_full_context_ledger", "phase05")).toBe(false);
    expect(matchesNormalizedPhaseAlias("xphase05y", "phase05")).toBe(false);
    expect(matchesNormalizedPhaseAlias("pass10", "pass1")).toBe(false);
    expect(matchesNormalizedPhaseAlias("phase50", "phase5")).toBe(false);
    expect(matchesNormalizedPhaseAlias("phase_050", "phase_05")).toBe(false);
  });

  test("returns false on empty or non-meaningful alias input", () => {
    expect(matchesNormalizedPhaseAlias("phase05", "")).toBe(false);
    expect(matchesNormalizedPhaseAlias("phase05", "---")).toBe(false);
    expect(matchesNormalizedPhaseAlias("", "phase05")).toBe(false);
  });
});
