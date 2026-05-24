/**
 * Tests for the deterministic UX translation map in evaluation-poller-display.ts
 *
 * The new implementation drives progress 100% from backend phase state.
 * No elapsed-time interpolation. No client-side drift.
 * Every state in the canonical table must map to exactly one label/percentage/color.
 */
import {
  getProgressDisplay,
  getStageLabelFromPhase,
} from "@/components/evaluation-poller-display";

describe("getProgressDisplay: canonical state mapping", () => {
  // ── Queued ───────────────────────────────────────────────────────────────

  test("status=queued -> Calibrating benchmark models, 5%, blue", () => {
    const pd = getProgressDisplay({ status: "queued" });
    expect(pd).not.toBeNull();
    expect(pd!.label).toBe("Calibrating benchmark models...");
    expect(pd!.percentage).toBe(5);
    expect(pd!.color).toBe("blue");
    expect(pd!.hardStop).toBe(false);
    expect(pd!.indeterminate).toBe(false);
  });

  // ── Failed ───────────────────────────────────────────────────────────────

  test("status=failed -> null (no bar)", () => {
    const pd = getProgressDisplay({ status: "failed" });
    expect(pd).toBeNull();
  });

  // ── Complete ─────────────────────────────────────────────────────────────

  test("status=complete -> Evaluation complete!, 100%, green", () => {
    const pd = getProgressDisplay({ status: "complete" });
    expect(pd).not.toBeNull();
    expect(pd!.label).toBe("Evaluation complete!");
    expect(pd!.percentage).toBe(100);
    expect(pd!.color).toBe("green");
    expect(pd!.hardStop).toBe(false);
    expect(pd!.indeterminate).toBe(false);
  });

  // ── Phase 1A ─────────────────────────────────────────────────────────────

  test("phase_1a/running, no fraction -> late position (45%)", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
    });
    expect(pd!.label).toBe("Extracting core narrative footprint...");
    expect(pd!.percentage).toBe(45);
    expect(pd!.color).toBe("blue");
    expect(pd!.hardStop).toBe(false);
    expect(pd!.indeterminate).toBe(false);
  });

  test("phase_1a/running, fraction < 0.5 -> early position (25%)", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
      phase_unit_fraction: 0.1,
    });
    expect(pd!.label).toBe("Ingesting manuscript & mapping chapters...");
    expect(pd!.percentage).toBe(25);
  });

  test("phase_1a/running, fraction >= 0.5 -> late position (45%)", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
      phase_unit_fraction: 0.6,
    });
    expect(pd!.label).toBe("Extracting core narrative footprint...");
    expect(pd!.percentage).toBe(45);
  });

  test("phase_1a/queued -> ingesting label, 25%", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "queued",
    });
    expect(pd!.label).toBe("Ingesting manuscript & mapping chapters...");
    expect(pd!.percentage).toBe(25);
  });

  // ── Review Gate ───────────────────────────────────────────────────────────

  test("phase=review_gate/awaiting_approval -> amber hard stop at 60%", () => {
    const pd = getProgressDisplay({
      status: "queued", // status stays queued while at gate
      phase: "review_gate",
      phase_status: "awaiting_approval",
    });
    expect(pd).not.toBeNull();
    expect(pd!.label).toBe("Awaiting Story Layer Approval");
    expect(pd!.percentage).toBe(60);
    expect(pd!.color).toBe("amber");
    expect(pd!.hardStop).toBe(true);
    expect(pd!.indeterminate).toBe(false);
  });

  test("phase=review_gate + hard_fail_present -> red hard stop at 60%", () => {
    const pd = getProgressDisplay({
      status: "queued",
      phase: "review_gate",
      phase_status: "awaiting_approval",
      hard_fail_present: true,
    });
    expect(pd!.label).toBe(
      "Story Layer Blocked: Narrative conflicts detected",
    );
    expect(pd!.percentage).toBe(60);
    expect(pd!.color).toBe("red");
    expect(pd!.hardStop).toBe(true);
  });

  test("review_gate overrides status (status could be running/queued)", () => {
    // phase takes precedence — regardless of status value
    const pdRunning = getProgressDisplay({
      status: "running",
      phase: "review_gate",
      phase_status: "awaiting_approval",
    });
    const pdQueued = getProgressDisplay({
      status: "queued",
      phase: "review_gate",
      phase_status: "awaiting_approval",
    });
    expect(pdRunning!.hardStop).toBe(true);
    expect(pdQueued!.hardStop).toBe(true);
    expect(pdRunning!.percentage).toBe(60);
    expect(pdQueued!.percentage).toBe(60);
  });

  // ── Phase 2 ───────────────────────────────────────────────────────────────

  test("phase_2 -> deep structural craft diagnostics, 80%", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "running",
    });
    expect(pd!.label).toBe("Running deep structural craft diagnostics...");
    expect(pd!.percentage).toBe(80);
    expect(pd!.color).toBe("blue");
    expect(pd!.hardStop).toBe(false);
  });

  // ── Phase 3 / synthesis ───────────────────────────────────────────────────

  test("phase_3 -> Assembling evaluation matrix, 90%", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_3",
    });
    expect(pd!.label).toBe("Assembling evaluation matrix...");
    expect(pd!.percentage).toBe(90);
  });

  // ── Cross-check / Final QA ────────────────────────────────────────────────

  test("cross_check_status=running -> final structural cross-checks, 95%", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "complete",
      cross_check_status: "running",
    });
    expect(pd!.label).toBe("Running final structural cross-checks...");
    expect(pd!.percentage).toBe(95);
  });

  test("cross_check_status=queued -> final structural cross-checks, 95%", () => {
    const pd = getProgressDisplay({
      status: "running",
      cross_check_status: "queued",
    });
    expect(pd!.label).toBe("Running final structural cross-checks...");
    expect(pd!.percentage).toBe(95);
  });

  // ── Unknown running state ─────────────────────────────────────────────────

  test("running with no phase -> calibrating label, 5%", () => {
    const pd = getProgressDisplay({ status: "running" });
    expect(pd).not.toBeNull();
    expect(pd!.label).toBe("Calibrating benchmark models...");
    expect(pd!.percentage).toBe(5);
  });
});

describe("getProgressDisplay: hardStop invariants", () => {
  test("bar never advances past 60% while at review_gate", () => {
    const pd = getProgressDisplay({
      status: "queued",
      phase: "review_gate",
      phase_status: "awaiting_approval",
    });
    expect(pd!.percentage).toBe(60);
    expect(pd!.hardStop).toBe(true);
  });

  test("bar moves past 60% after phase_2 starts", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "running",
    });
    expect(pd!.percentage).toBeGreaterThan(60);
    expect(pd!.hardStop).toBe(false);
  });
});

describe("getProgressDisplay: monotonicity across pipeline stages", () => {
  test("percentages are non-decreasing through the full pipeline", () => {
    const pipeline: Array<Parameters<typeof getProgressDisplay>[0]> = [
      { status: "queued" },
      { status: "running", phase: "phase_1a", phase_status: "running", phase_unit_fraction: 0.1 },
      { status: "running", phase: "phase_1a", phase_status: "running", phase_unit_fraction: 0.8 },
      { status: "queued", phase: "review_gate", phase_status: "awaiting_approval" },
      { status: "running", phase: "phase_2", phase_status: "running" },
      { status: "running", phase: "phase_3" },
      { status: "running", cross_check_status: "running" },
      { status: "complete" },
    ];

    const percentages = pipeline.map((args) => getProgressDisplay(args)!.percentage);
    for (let i = 1; i < percentages.length; i++) {
      expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
    }
    expect(percentages[percentages.length - 1]).toBe(100);
  });
});

describe("getProgressDisplay: no backend jargon in labels", () => {
  const jargonPatterns = [
    /phase_1a/i,
    /phase_2/i,
    /phase_3/i,
    /artifact/i,
    /pass1a/i,
    /review_gate/i,
    /awaiting_approval/i,
  ];

  const allStates: Array<Parameters<typeof getProgressDisplay>[0]> = [
    { status: "queued" },
    { status: "running" },
    { status: "running", phase: "phase_1a", phase_status: "running" },
    { status: "queued", phase: "review_gate", phase_status: "awaiting_approval" },
    { status: "running", phase: "phase_2", phase_status: "running" },
    { status: "running", phase: "phase_3" },
    { status: "running", cross_check_status: "running" },
    { status: "complete" },
  ];

  test.each(allStates)("no jargon in label for %o", (args) => {
    const pd = getProgressDisplay(args);
    if (!pd) return; // failed state returns null — OK
    for (const pattern of jargonPatterns) {
      expect(pd.label).not.toMatch(pattern);
    }
  });
});

describe("getStageLabelFromPhase: convenience wrapper", () => {
  test("phase_1a/running returns a label", () => {
    const label = getStageLabelFromPhase("phase_1a", "running", null);
    expect(label).toBeTruthy();
    expect(typeof label).toBe("string");
  });

  test("review_gate returns the hard-stop label", () => {
    const label = getStageLabelFromPhase("review_gate", "awaiting_approval", null);
    expect(label).toBe("Awaiting Story Layer Approval");
  });

  test("phase_3 returns the synthesis label", () => {
    const label = getStageLabelFromPhase("phase_3", "running", null);
    expect(label).toBe("Assembling evaluation matrix...");
  });

  test("null phase returns null (no jargon fallback)", () => {
    const label = getStageLabelFromPhase(null, null, null);
    // Should still return a string (default calibrating label) — NOT null, since
    // getStageLabelFromPhase always passes status=running and gets the fallback.
    expect(typeof label).toBe("string");
  });
});
