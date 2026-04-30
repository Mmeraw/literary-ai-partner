import { describe, expect, test } from "@jest/globals";
import { buildScoreLedger } from "@/lib/evaluation/pipeline/buildScoreLedger";

function criteria(overrides: Partial<Record<"voice" | "proseControl" | "tone", number>> = {}) {
  return [
    { key: "voice", final_score_0_10: overrides.voice ?? 7 },
    { key: "proseControl", final_score_0_10: overrides.proseControl ?? 7 },
    { key: "tone", final_score_0_10: overrides.tone ?? 7 },
    { key: "concept", final_score_0_10: 7 },
    { key: "narrativeDrive", final_score_0_10: 7 },
    { key: "character", final_score_0_10: 7 },
    { key: "sceneConstruction", final_score_0_10: 7 },
    { key: "dialogue", final_score_0_10: 7 },
    { key: "theme", final_score_0_10: 7 },
    { key: "worldbuilding", final_score_0_10: 7 },
    { key: "pacing", final_score_0_10: 7 },
    { key: "narrativeClosure", final_score_0_10: 7 },
    { key: "marketability", final_score_0_10: 7 },
  ];
}

describe("Authority Composite score ledger metadata", () => {
  test("computes composite from voice, proseControl, and tone", () => {
    const ledger = buildScoreLedger({
      criteria: criteria({ voice: 5, proseControl: 6, tone: 4 }),
    });

    expect(ledger.authorityComposite.score_0_10).toBe(5);
    expect(ledger.authorityComposite.originalCompositeInputs).toEqual({
      voice: 5,
      proseControl: 6,
      tone: 4,
    });
  });

  test("emits ledger SIGNAL code when composite is below threshold", () => {
    const ledger = buildScoreLedger({
      criteria: criteria({ voice: 4, proseControl: 4, tone: 4 }),
    });

    expect(ledger.authorityComposite.capApplied).toBe(true);
    expect(ledger.authorityComposite.capReasonCodes).toContain(
      "AUTHORITY_COMPOSITE_BELOW_THRESHOLD",
    );
    expect(ledger.authorityComposite.capReasonCodes).not.toContain(
      "AUTHORITY_CAP_APPLIED",
    );
  });

  test("does not signal when composite is exactly threshold", () => {
    const ledger = buildScoreLedger({
      criteria: criteria({ voice: 6, proseControl: 6, tone: 6 }),
    });

    expect(ledger.authorityComposite.score_0_10).toBe(6);
    expect(ledger.authorityComposite.capApplied).toBe(false);
    expect(ledger.authorityComposite.capReasonCodes).toEqual([]);
  });

  test("treats missing authority keys as zero fail-closed", () => {
    const ledger = buildScoreLedger({
      criteria: [{ key: "voice", final_score_0_10: 9 }],
    });

    expect(ledger.authorityComposite.score_0_10).toBe(3);
    expect(ledger.authorityComposite.originalCompositeInputs).toEqual({
      voice: 9,
      proseControl: 0,
      tone: 0,
    });
    expect(ledger.authorityComposite.capApplied).toBe(true);
  });

  test("does not mutate input criteria", () => {
    const input = criteria({ voice: 3, proseControl: 4, tone: 5 });
    const before = JSON.stringify(input);

    buildScoreLedger({ criteria: input });

    expect(JSON.stringify(input)).toBe(before);
  });

  test("forward-compatible mechanismMissing hook can trigger cap without numeric trigger", () => {
    const ledger = buildScoreLedger(
      { criteria: criteria({ voice: 9, proseControl: 9, tone: 9 }) },
      { mechanismMissing: true },
    );

    expect(ledger.authorityComposite.capApplied).toBe(true);
    expect(ledger.authorityComposite.capReasonCodes).toContain("MECHANISM_MISSING");
  });
});
