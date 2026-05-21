import {
  getProgressDisplay,
  getStageLabelFromPhase,
  __testing__,
} from "@/components/evaluation-poller-display";

const { STAGES, STAGE_COUNT, STAGE_BY_ID, resolveStageId, getStagePercentage } =
  __testing__;

const T0 = "2026-05-15T00:00:00.000Z";

describe("evaluation-poller-display: seven-stage invariants", () => {
  test("defines exactly the seven user-facing stages in order", () => {
    expect(STAGES.map((s) => s.label)).toEqual([
      "Preparing manuscript",
      "Analyzing manuscript",
      "Building diagnosis",
      "Reconciling passes",
      "Final QA checks",
      "Preparing report",
      "Finalizing report",
    ]);
    expect(STAGE_COUNT).toBe(7);
    expect(STAGES.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test("stage percentages are canonical index/7 and running stages stay below 100", () => {
    expect(getStagePercentage(STAGE_BY_ID.preparing_manuscript)).toBe(14);
    expect(getStagePercentage(STAGE_BY_ID.analyzing_manuscript)).toBe(29);
    expect(getStagePercentage(STAGE_BY_ID.building_diagnosis)).toBe(43);
    expect(getStagePercentage(STAGE_BY_ID.reconciling_passes)).toBe(57);
    expect(getStagePercentage(STAGE_BY_ID.final_qa_checks)).toBe(71);
    expect(getStagePercentage(STAGE_BY_ID.preparing_report)).toBe(86);
    expect(getStagePercentage(STAGE_BY_ID.finalizing_report)).toBe(99);
  });
});

describe("resolveStageId: backend state -> seven visible stages", () => {
  test("phase_1a queued -> preparing_manuscript", () => {
    expect(resolveStageId({ phase: "phase_1a", phase_status: "queued" })).toBe(
      "preparing_manuscript",
    );
  });

  test("phase_1a running -> analyzing_manuscript", () => {
    expect(resolveStageId({ phase: "phase_1a", phase_status: "running" })).toBe(
      "analyzing_manuscript",
    );
  });

  test("phase_1a complete -> building_diagnosis", () => {
    expect(resolveStageId({ phase: "phase_1a", phase_status: "complete" })).toBe(
      "building_diagnosis",
    );
  });

  test("phase_2 running -> reconciling_passes", () => {
    expect(resolveStageId({ phase: "phase_2", phase_status: "running" })).toBe(
      "reconciling_passes",
    );
  });

  test("cross_check running -> final_qa_checks regardless of phase", () => {
    expect(
      resolveStageId({
        phase: "phase_2",
        phase_status: "complete",
        cross_check_status: "running",
      }),
    ).toBe("final_qa_checks");
  });

  test("cross_check complete aliases -> preparing_report", () => {
    expect(
      resolveStageId({
        phase: "phase_2",
        phase_status: "complete",
        cross_check_status: "complete",
      }),
    ).toBe("preparing_report");
    expect(
      resolveStageId({
        phase: "phase_2",
        phase_status: "complete",
        cross_check_status: "cross_check_completed",
      }),
    ).toBe("preparing_report");
  });

  test("phase_3 complete -> finalizing_report", () => {
    expect(resolveStageId({ phase: "phase_3", phase_status: "complete" })).toBe(
      "finalizing_report",
    );
  });

  test("unknown phase returns null", () => {
    expect(resolveStageId({ phase: null, phase_status: "running" })).toBeNull();
  });
});

describe("getProgressDisplay: canonical stage progress", () => {
  test("queued status -> indeterminate, waiting in queue", () => {
    const pd = getProgressDisplay({ status: "queued" });
    expect(pd).not.toBeNull();
    expect(pd!.indeterminate).toBe(true);
    expect(pd!.label).toMatch(/queue/i);
    expect(pd!.percentage).toBe(0);
  });

  test("complete status -> 100%, fixed label", () => {
    const pd = getProgressDisplay({ status: "complete" });
    expect(pd).not.toBeNull();
    expect(pd!.percentage).toBe(100);
    expect(pd!.indeterminate).toBe(false);
  });

  test("running without phase -> indeterminate Preparing manuscript", () => {
    const pd = getProgressDisplay({ status: "running" });
    expect(pd).not.toBeNull();
    expect(pd!.indeterminate).toBe(true);
    expect(pd!.label).toBe("Preparing manuscript");
    expect(pd!.percentage).toBe(0);
  });

  test("running phase_1a shows stage 2/7 at 29%, not stale completed_units", () => {
    const pd = getProgressDisplay(
      {
        status: "running",
        phase: "phase_1a",
        phase_status: "running",
        created_at: T0,
        phase1_started_at: T0,
      },
      new Date(T0),
    );
    expect(pd!.label).toBe("Analyzing manuscript");
    expect(pd!.percentage).toBe(29);
    expect(pd!.valueLabel).toBe("29%");
    expect(pd!.helperText).toContain("Stage 2 of 7");
    expect(pd!.indeterminate).toBe(false);
  });

  test("phase_2 running shows stage 4/7", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "running",
      phase2_started_at: T0,
    });
    expect(pd!.label).toBe("Reconciling passes");
    expect(pd!.percentage).toBe(57);
  });

  test("cross_check running shows stage 5/7", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "complete",
      cross_check_status: "running",
      phase2_completed_at: T0,
    });
    expect(pd!.label).toBe("Final QA checks");
    expect(pd!.percentage).toBe(71);
  });

  test("cross_check complete shows stage 6/7", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "complete",
      cross_check_status: "complete",
      pass3_completed_at: T0,
    });
    expect(pd!.label).toBe("Preparing report");
    expect(pd!.percentage).toBe(86);
  });

  test("final running stage is capped at 99 until terminal complete", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_3",
      phase_status: "complete",
      pass3_completed_at: T0,
    });
    expect(pd!.label).toBe("Finalizing report");
    expect(pd!.percentage).toBe(99);
  });
});

describe("getStageLabelFromPhase: standalone label resolver", () => {
  test("matches getProgressDisplay's label for the same inputs", () => {
    const label = getStageLabelFromPhase("phase_1a", "running", null);
    expect(label).toBe("Analyzing manuscript");
  });

  test("returns null for unknown so caller can render its own copy", () => {
    expect(getStageLabelFromPhase(null, null, null)).toBeNull();
  });
});
