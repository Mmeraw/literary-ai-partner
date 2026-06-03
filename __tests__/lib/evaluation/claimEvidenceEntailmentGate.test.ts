import { validateClaimEvidenceEntailment } from "@/lib/evaluation/claimEvidenceEntailmentGate";

describe("claimEvidenceEntailmentGate", () => {
  test("blocks Brutus direct-action drift when evidence frames shard cask as Zimeon inference", () => {
    const result = validateClaimEvidenceEntailment([
      {
        path: "$.criteria.narrativeClosure.recommendations[0].action",
        claimText: "Shape a stronger interim climax around Brutus's spilled shard cask near the campsite.",
        evidenceText:
          "In the morning, Zimeon continued to smell death in the air. It seemed Red-spots had unsettled the wooden cask. The shard had leeched into the lake.",
      },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain("CLAIM_ATTRIBUTION_DRIFT");
      expect(result.issues.map((issue) => issue.code)).toContain("CERTAINTY_UPGRADE");
    }
  });

  test("allows Zimeon-centered wording that preserves observation and inference", () => {
    const result = validateClaimEvidenceEntailment([
      {
        path: "$.criteria.narrativeClosure.recommendations[0].action",
        claimText:
          "Use Zimeon's discovery that the beachside shard cask appears to have been disturbed to pressure his decision about returning to the Dead Zone.",
        evidenceText:
          "In the morning, Zimeon continued to smell death in the air. It seemed Red-spots had unsettled the wooden cask. The shard had leeched into the lake.",
      },
    ]);

    expect(result).toEqual({ ok: true, issues: [] });
  });
});
