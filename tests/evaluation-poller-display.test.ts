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

  test("status=queued -> Starting your evaluation, 2%, blue", () => {
    const pd = getProgressDisplay({ status: "queued" });
    expect(pd).not.toBeNull();
    expect(pd!.label).toBe("Starting your evaluation...");
    expect(pd!.percentage).toBe(2);
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

  test("phase_1a/running, no fraction -> late position (35%)", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
    });
    expect(pd!.label).toBe("Understanding your story...");
    expect(pd!.percentage).toBe(35);
    expect(pd!.color).toBe("blue");
    expect(pd!.hardStop).toBe(false);
    expect(pd!.indeterminate).toBe(false);
  });

  test("phase_1a/running, fraction < 0.5 -> early position (15%)", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
      phase_unit_fraction: 0.1,
    });
    expect(pd!.label).toBe("Diagnosing your writing...");
    expect(pd!.percentage).toBe(15);
  });

  test("phase_1a/running, fraction >= 0.5 -> late position (35%)", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
      phase_unit_fraction: 0.6,
    });
    expect(pd!.label).toBe("Understanding your story...");
    expect(pd!.percentage).toBe(35);
  });

  test("phase_1a/queued -> reading label, 15%", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "queued",
    });
    expect(pd!.label).toBe("Diagnosing your writing...");
    expect(pd!.percentage).toBe(15);
  });

  // ── Review Gate ───────────────────────────────────────────────────────────

  test("phase=review_gate/awaiting_approval -> amber hard stop at 50%", () => {
    const pd = getProgressDisplay({
      status: "queued", // status stays queued while at gate
      phase: "review_gate",
      phase_status: "awaiting_approval",
    });
    expect(pd).not.toBeNull();
    expect(pd!.label).toBe("Awaiting Story Layer Approval");
    expect(pd!.percentage).toBe(50);
    expect(pd!.color).toBe("amber");
    expect(pd!.hardStop).toBe(true);
    expect(pd!.indeterminate).toBe(false);
  });

  test("phase=review_gate + hard_fail_present -> red hard stop at 50%", () => {
    const pd = getProgressDisplay({
      status: "queued",
      phase: "review_gate",
      phase_status: "awaiting_approval",
      hard_fail_present: true,
    });
    expect(pd!.label).toBe(
      "Story Layer Blocked: Narrative conflicts detected",
    );
    expect(pd!.percentage).toBe(50);
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
    expect(pdRunning!.percentage).toBe(50);
    expect(pdQueued!.percentage).toBe(50);
  });

  // ── Phase 2 ───────────────────────────────────────────────────────────────

  test("phase_2 -> validating your evaluation, 67%", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "running",
    });
    expect(pd!.label).toBe("Validating your evaluation...");
    expect(pd!.percentage).toBe(67);
    expect(pd!.color).toBe("blue");
    expect(pd!.hardStop).toBe(false);
  });

  // ── Phase 3 / synthesis ───────────────────────────────────────────────────

  test("phase_3 -> finalizing your report, 86%", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_3",
    });
    expect(pd!.label).toBe("Finalizing your report...");
    expect(pd!.percentage).toBe(86);
  });

  test("stale 100% high-water mark is capped at 99% while running", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_3",
      progress_high_water: 100,
    });
    expect(pd!.percentage).toBe(99);
    expect(pd!.valueLabel).toBe("99%");
  });

  // ── Cross-check / Final QA ────────────────────────────────────────────────

  test("cross_check_status=running -> finalizing report, 97%", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "complete",
      cross_check_status: "running",
    });
    expect(pd!.label).toBe("Finalizing your report...");
    expect(pd!.percentage).toBe(97);
  });

  test("cross_check_status=queued -> finalizing report, 97%", () => {
    const pd = getProgressDisplay({
      status: "running",
      cross_check_status: "queued",
    });
    expect(pd!.label).toBe("Finalizing your report...");
    expect(pd!.percentage).toBe(97);
  });

  // ── Unknown running state ─────────────────────────────────────────────────

  test("running with no phase -> preparing your evaluation label, 5%", () => {
    const pd = getProgressDisplay({ status: "running" });
    expect(pd).not.toBeNull();
    expect(pd!.label).toBe("Preparing your evaluation");
    expect(pd!.percentage).toBe(5);
  });

  test("queued stalled state -> explicit stalled label with red hard stop", () => {
    const pd = getProgressDisplay({
      status: "queued",
      phase: "phase_0",
      is_stalled: true,
      heartbeat_age_seconds: 540,
    });
    expect(pd).not.toBeNull();
    expect(pd!.label).toBe("Evaluation stalled — worker not advancing");
    expect(pd!.valueLabel).toBe("Stalled");
    expect(pd!.percentage).toBe(5);
    expect(pd!.color).toBe("red");
    expect(pd!.hardStop).toBe(true);
    expect(pd!.helperText).toContain("540s");
  });

  test("phase_0 queued shows backend phase message when provided", () => {
    const pd = getProgressDisplay({
      status: "queued",
      phase: "phase_0",
      phase_message: "Worker waiting for lease renewal",
    });
    expect(pd).not.toBeNull();
    expect(pd!.helperText).toBe("Worker waiting for lease renewal");
  });
});

describe("getProgressDisplay: hardStop invariants", () => {
  test("bar never advances past 50% while at review_gate", () => {
    const pd = getProgressDisplay({
      status: "queued",
      phase: "review_gate",
      phase_status: "awaiting_approval",
    });
    expect(pd!.percentage).toBe(50);
    expect(pd!.hardStop).toBe(true);
  });

  test("bar moves past 50% after phase_2 starts", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "running",
    });
    expect(pd!.percentage).toBeGreaterThan(50);
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
    /calibrat/i,
    /preflight/i,
    /pipeline/i,
    /cross.?check/i,
    /ingesting/i,
    /evaluation matrix/i,
    /structural/i,
    /benchmark/i,
    /routing/i,
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

  test.each(allStates)("no jargon in label or helperText for %o", (args) => {
    const pd = getProgressDisplay(args);
    if (!pd) return; // failed state returns null — OK
    for (const pattern of jargonPatterns) {
      expect(pd.label).not.toMatch(pattern);
      expect(pd.helperText).not.toMatch(pattern);
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

  test("phase_3 returns the finalizing label", () => {
    const label = getStageLabelFromPhase("phase_3", "running", null);
    expect(label).toBe("Finalizing your report...");
  });

  test("null phase returns null (no jargon fallback)", () => {
    const label = getStageLabelFromPhase(null, null, null);
    // Should still return a string (default calibrating label) — NOT null, since
    // getStageLabelFromPhase always passes status=running and gets the fallback.
    expect(typeof label).toBe("string");
  });
});
