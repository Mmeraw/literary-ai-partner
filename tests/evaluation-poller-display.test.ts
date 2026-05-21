import {
  getProgressDisplay,
  getStageLabelFromPhase,
  __testing__,
} from "@/components/evaluation-poller-display";

const { STAGE_BUDGETS, STAGE_BY_ID, resolveStageId, interpolateWithinStage } =
  __testing__;

const T0 = "2026-05-15T00:00:00.000Z";
const T_PLUS = (sec: number) =>
  new Date(Date.parse(T0) + sec * 1000).toISOString();

describe("evaluation-poller-display: stage roadmap invariants", () => {
  test("stage budgets are contiguous and cover 0..100", () => {
    let cursor = 0;
    for (const stage of STAGE_BUDGETS) {
      expect(stage.start).toBe(cursor);
      expect(stage.end).toBeGreaterThan(stage.start);
      cursor = stage.end;
    }
    expect(cursor).toBe(100);
  });

  test("every stage reserves >=1% headroom for transition (end > start + ceiling)", () => {
    for (const stage of STAGE_BUDGETS) {
      expect(stage.end - stage.start).toBeGreaterThanOrEqual(1);
    }
  });

  test("median seconds are all positive (interpolation safe)", () => {
    for (const stage of STAGE_BUDGETS) {
      expect(stage.medianSeconds).toBeGreaterThan(0);
    }
  });
});

describe("resolveStageId: backend state -> stage", () => {
  test("queued in phase_1 -> preparing_manuscript", () => {
    expect(
      resolveStageId({ phase: "phase_1a", phase_status: "queued" }),
    ).toBe("preparing_manuscript");
  });

  test("running in phase_1 -> analyzing_manuscript (heaviest stage)", () => {
    expect(
      resolveStageId({ phase: "phase_1a", phase_status: "running" }),
    ).toBe("analyzing_manuscript");
  });

  test("complete in phase_1 -> building_diagnosis (handoff)", () => {
    expect(
      resolveStageId({ phase: "phase_1a", phase_status: "complete" }),
    ).toBe("building_diagnosis");
  });

  test("running in phase_2 -> reconciling_passes", () => {
    expect(
      resolveStageId({ phase: "phase_2", phase_status: "running" }),
    ).toBe("reconciling_passes");
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

  test("cross_check complete -> preparing_report", () => {
    expect(
      resolveStageId({
        phase: "phase_2",
        phase_status: "complete",
        cross_check_status: "complete",
      }),
    ).toBe("preparing_report");
  });

  test("unknown phase returns null (caller renders indeterminate)", () => {
    expect(resolveStageId({ phase: null, phase_status: "running" })).toBeNull();
  });
});

describe("interpolateWithinStage: never exceeds stage_end - 1%", () => {
  test("clamps to ceiling even when elapsed >> median", () => {
    const stage = STAGE_BY_ID.analyzing_manuscript; // 2..64, median 420s
    const startedAt = T0;
    const farFuture = Date.parse(T0) + 1_000_000 * 1000; // way past median
    const pct = interpolateWithinStage(stage, startedAt, farFuture);
    expect(pct).toBeLessThanOrEqual(stage.end - 1);
    expect(pct).toBeGreaterThanOrEqual(stage.start);
  });

  test("starts at stage.start when elapsed=0", () => {
    const stage = STAGE_BY_ID.analyzing_manuscript;
    const pct = interpolateWithinStage(stage, T0, Date.parse(T0));
    expect(pct).toBe(stage.start);
  });

  test("returns stage.start when timestamp missing (no fake progress)", () => {
    const stage = STAGE_BY_ID.reconciling_passes;
    const pct = interpolateWithinStage(stage, null, Date.now());
    expect(pct).toBe(stage.start);
  });

  test("returns stage.start when timestamp unparseable", () => {
    const stage = STAGE_BY_ID.reconciling_passes;
    const pct = interpolateWithinStage(stage, "not-a-date", Date.now());
    expect(pct).toBe(stage.start);
  });

  test("interpolates linearly inside the slice for elapsed < median", () => {
    const stage = STAGE_BY_ID.analyzing_manuscript; // start 2, end 64, median 420
    // Half of median should put us ~halfway through the slice (clamped to end-1)
    const pct = interpolateWithinStage(
      stage,
      T0,
      Date.parse(T0) + (stage.medianSeconds / 2) * 1000,
    );
    const expected = stage.start + (stage.end - stage.start) * 0.5;
    expect(Math.abs(pct - expected)).toBeLessThan(0.01);
  });
});

describe("getProgressDisplay: end-to-end behavior", () => {
  test("queued status -> indeterminate, waiting in queue", () => {
    const pd = getProgressDisplay({
      status: "queued",
    });
    expect(pd).not.toBeNull();
    expect(pd!.indeterminate).toBe(true);
    expect(pd!.label).toMatch(/queue/i);
  });

  test("complete status -> 100%, fixed label", () => {
    const pd = getProgressDisplay({
      status: "complete",
    });
    expect(pd).not.toBeNull();
    expect(pd!.percentage).toBe(100);
    expect(pd!.indeterminate).toBe(false);
  });

  test("running without phase -> indeterminate Preparing manuscript", () => {
    const pd = getProgressDisplay({ status: "running" });
    expect(pd).not.toBeNull();
    expect(pd!.indeterminate).toBe(true);
    expect(pd!.label).toBe("Preparing manuscript");
  });

  test("running phase_1 with elapsed=0 -> stage start", () => {
    const now = new Date(T0);
    const pd = getProgressDisplay(
      {
        status: "running",
        phase: "phase_1a",
        phase_status: "running",
        phase1_started_at: T0,
      },
      now,
    );
    expect(pd!.label).toBe("Analyzing manuscript");
    expect(pd!.percentage).toBe(2); // analyzing_manuscript.start
    expect(pd!.indeterminate).toBe(false);
  });

  test("running phase_1 with timing missing -> shimmer at stage start", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_1a",
      phase_status: "running",
    });
    expect(pd!.label).toBe("Analyzing manuscript");
    expect(pd!.indeterminate).toBe(true);
    expect(pd!.percentage).toBe(2);
  });

  test("never returns >= stage_end while still in same stage", () => {
    // Sample many points within analyzing_manuscript stage (median 420s).
    const stage = STAGE_BY_ID.analyzing_manuscript;
    for (const sec of [1, 30, 100, 250, 420, 600, 1200, 10000]) {
      const pd = getProgressDisplay(
        {
          status: "running",
          phase: "phase_1a",
          phase_status: "running",
          phase1_started_at: T0,
        },
        new Date(Date.parse(T0) + sec * 1000),
      );
      expect(pd!.percentage).toBeLessThan(stage.end);
      expect(pd!.percentage).toBeLessThanOrEqual(stage.end - 1);
    }
  });

  test("label is decoupled from percent (label authoritative from phase)", () => {
    // Even when computed percent is at start of stage, label must reflect phase.
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "running",
      phase2_started_at: T0,
    });
    expect(pd!.label).toBe("Reconciling passes");
  });

  test("cross_check running surfaces Final QA checks stage", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "complete",
      cross_check_status: "running",
      pass3_started_at: T0,
    });
    expect(pd!.label).toBe("Final QA checks");
    expect(pd!.percentage).toBeGreaterThanOrEqual(83);
    expect(pd!.percentage).toBeLessThanOrEqual(96);
  });

  test("cross_check complete surfaces Preparing report stage", () => {
    const pd = getProgressDisplay({
      status: "running",
      phase: "phase_2",
      phase_status: "complete",
      cross_check_status: "complete",
      pass3_completed_at: T0,
    });
    expect(pd!.label).toBe("Preparing report");
    expect(pd!.percentage).toBeGreaterThanOrEqual(97);
    expect(pd!.percentage).toBeLessThanOrEqual(98);
  });
});

describe("monotonicity across stage transitions", () => {
  test("phase_1/running -> phase_2/running never moves backward", () => {
    // Pretend phase_1 has been running 60s (well inside its slice).
    const pd1 = getProgressDisplay(
      {
        status: "running",
        phase: "phase_1a",
        phase_status: "running",
        phase1_started_at: T0,
      },
      new Date(Date.parse(T0) + 60 * 1000),
    );
    // Then phase_2 starts immediately.
    const pd2 = getProgressDisplay(
      {
        status: "running",
        phase: "phase_2",
        phase_status: "running",
        phase1_started_at: T0,
        phase1_completed_at: T_PLUS(60),
        phase2_started_at: T_PLUS(60),
      },
      new Date(Date.parse(T0) + 60 * 1000),
    );
    expect(pd2!.percentage).toBeGreaterThanOrEqual(pd1!.percentage);
  });

  test("transitions through all stages produce a non-decreasing percent series", () => {
    const series: number[] = [];
    const base = Date.parse(T0);

    series.push(
      getProgressDisplay(
        {
          status: "running",
          phase: "phase_1a",
          phase_status: "queued",
          created_at: T0,
        },
        new Date(base + 1 * 1000),
      )!.percentage,
    );

    series.push(
      getProgressDisplay(
        {
          status: "running",
          phase: "phase_1a",
          phase_status: "running",
          phase1_started_at: T_PLUS(5),
        },
        new Date(base + 60 * 1000),
      )!.percentage,
    );

    series.push(
      getProgressDisplay(
        {
          status: "running",
          phase: "phase_2",
          phase_status: "running",
          phase1_completed_at: T_PLUS(420),
          phase2_started_at: T_PLUS(421),
        },
        new Date(base + 460 * 1000),
      )!.percentage,
    );

    series.push(
      getProgressDisplay(
        {
          status: "running",
          phase: "phase_2",
          phase_status: "complete",
          cross_check_status: "running",
          phase2_completed_at: T_PLUS(541),
          pass3_started_at: T_PLUS(541),
        },
        new Date(base + 600 * 1000),
      )!.percentage,
    );

    series.push(
      getProgressDisplay(
        {
          status: "running",
          phase: "phase_2",
          phase_status: "complete",
          cross_check_status: "complete",
          pass3_completed_at: T_PLUS(631),
        },
        new Date(base + 635 * 1000),
      )!.percentage,
    );

    series.push(
      getProgressDisplay({ status: "complete" })!.percentage,
    );

    for (let i = 1; i < series.length; i++) {
      expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
    }
    expect(series[series.length - 1]).toBe(100);
  });
});

describe("getStageLabelFromPhase: standalone label resolver", () => {
  test("matches getProgressDisplay's label for the same inputs", () => {
    const label = getStageLabelFromPhase("phase_1a", "running", null);
    expect(label).toBe("Analyzing manuscript");
  });

  test("returns null for queued / unknown so caller can render its own copy", () => {
    expect(getStageLabelFromPhase(null, null, null)).toBeNull();
  });
});
