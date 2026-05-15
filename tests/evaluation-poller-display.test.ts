import {
  getProgressDisplay,
  getStageLabelFromPhase,
} from "@/components/evaluation-poller-display";

describe("getProgressDisplay", () => {
  test("shows an indeterminate queued progress section", () => {
    expect(getProgressDisplay({ status: "queued", progress: 0 })).toEqual({
      label: "Waiting in queue",
      valueLabel: "Waiting in queue",
      helperText:
        "Your job is queued. We'll begin automatically as soon as a worker is available.",
      indeterminate: true,
      percentage: 0,
    });
  });

  test("shows determinate running progress with stage-safe wording", () => {
    expect(getProgressDisplay({ status: "running", progress: 42 })).toEqual({
      label: "Reconciling passes",
      valueLabel: "~46%",
      helperText:
        "Approximate progress based on completed pipeline stages. Stages: Preparing manuscript → Reading manuscript → Building diagnosis → Reconciling passes → Final QA checks → Preparing report → Finalizing report.",
      indeterminate: false,
      percentage: 46,
    });
  });

  test("maps running progress to non-revealing stages (heuristic fallback when phase absent)", () => {
    expect(getProgressDisplay({ status: "running", progress: 0 })?.label).toBe("Preparing manuscript");
    expect(getProgressDisplay({ status: "running", progress: 25 })?.label).toBe("Building diagnosis");
    expect(getProgressDisplay({ status: "running", progress: 45 })?.label).toBe("Reconciling passes");
    expect(getProgressDisplay({ status: "running", progress: 65 })?.label).toBe("Final QA checks");
    expect(getProgressDisplay({ status: "running", progress: 85 })?.label).toBe("Preparing report");
    expect(getProgressDisplay({ status: "running", progress: 100 })?.label).toBe("Report ready");
  });

  test("clamps running progress to canonical bounds", () => {
    expect(getProgressDisplay({ status: "running", progress: 120 })?.percentage).toBe(100);
    expect(getProgressDisplay({ status: "running", progress: -5 })?.percentage).toBe(0);
  });

  test("shows report-ready progress for complete jobs and hides failed jobs", () => {
    expect(getProgressDisplay({ status: "complete", progress: 100 })).toEqual({
      label: "Report ready",
      valueLabel: "100%",
      helperText: "Your report is ready.",
      indeterminate: false,
      percentage: 100,
    });
    expect(getProgressDisplay({ status: "failed", progress: 10 })).toBeNull();
  });

  test("prefers authoritative phase label over heuristic when present", () => {
    // Visually animated bar may be at 79% (UI soft-ceiling), but the canonical
    // pipeline is still in phase_1/running. The label must follow the phase,
    // not the visual bar.
    expect(
      getProgressDisplay({
        status: "running",
        progress: 79,
        phase: "phase_1",
        phase_status: "running",
      })?.label,
    ).toBe("Reading manuscript");

    // Same visual percentage, different real phase → different label.
    expect(
      getProgressDisplay({
        status: "running",
        progress: 79,
        phase: "phase_2",
        phase_status: "running",
      })?.label,
    ).toBe("Reconciling passes");

    // Cross-check active outranks phase signal.
    expect(
      getProgressDisplay({
        status: "running",
        progress: 79,
        phase: "phase_2",
        phase_status: "complete",
        cross_check_status: "running",
      })?.label,
    ).toBe("Final QA checks");

    // Cross-check complete → preparing report.
    expect(
      getProgressDisplay({
        status: "running",
        progress: 79,
        phase: "phase_2",
        phase_status: "complete",
        cross_check_status: "complete",
      })?.label,
    ).toBe("Preparing report");
  });

  test("retains existing percentage when phase is provided (animation behavior unchanged)", () => {
    const out = getProgressDisplay({
      status: "running",
      progress: 79,
      phase: "phase_1",
      phase_status: "running",
    });
    // toApproxRunningPercentage(79): 75 + ((79-66)/34)*24 = 84.176 → 84
    expect(out?.percentage).toBe(84);
    expect(out?.valueLabel).toBe("~84%");
  });

  test("falls back to heuristic label when phase data is missing or non-canonical", () => {
    expect(
      getProgressDisplay({
        status: "running",
        progress: 42,
        phase: null,
        phase_status: null,
      })?.label,
    ).toBe("Reconciling passes");

    expect(
      getProgressDisplay({
        status: "running",
        progress: 42,
        phase: "unknown_phase",
        phase_status: "running",
      })?.label,
    ).toBe("Reconciling passes");
  });
});

describe("getStageLabelFromPhase", () => {
  test("maps phase_1 lifecycle to user-safe labels", () => {
    expect(getStageLabelFromPhase("phase_1", "queued", null)).toBe("Preparing manuscript");
    expect(getStageLabelFromPhase("phase_1", "running", null)).toBe("Reading manuscript");
    expect(getStageLabelFromPhase("phase_1", "complete", null)).toBe("Building diagnosis");
  });

  test("maps phase_2 lifecycle to user-safe labels", () => {
    expect(getStageLabelFromPhase("phase_2", "queued", null)).toBe("Building diagnosis");
    expect(getStageLabelFromPhase("phase_2", "running", null)).toBe("Reconciling passes");
    expect(getStageLabelFromPhase("phase_2", "complete", null)).toBe("Final QA checks");
  });

  test("cross_check_status overrides phase signal", () => {
    expect(getStageLabelFromPhase("phase_2", "complete", "running")).toBe("Final QA checks");
    expect(getStageLabelFromPhase("phase_2", "complete", "complete")).toBe("Preparing report");
  });

  test("returns null when phase data is insufficient", () => {
    expect(getStageLabelFromPhase(null, null, null)).toBeNull();
    expect(getStageLabelFromPhase(undefined, undefined, undefined)).toBeNull();
    expect(getStageLabelFromPhase("phase_1", "unexpected_state", null)).toBeNull();
  });
});
