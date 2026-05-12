import { getProgressDisplay } from "@/components/evaluation-poller-display";

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
        "Approximate progress based on completed pipeline stages. Stages: Preparing manuscript → Reading manuscript → Building diagnosis → Reconciling passes → Final QA checks → Validating report → Finalizing report.",
      indeterminate: false,
      percentage: 46,
    });
  });

  test("maps running progress to non-revealing stages", () => {
    expect(getProgressDisplay({ status: "running", progress: 0 })?.label).toBe("Preparing manuscript");
    expect(getProgressDisplay({ status: "running", progress: 25 })?.label).toBe("Building diagnosis");
    expect(getProgressDisplay({ status: "running", progress: 45 })?.label).toBe("Reconciling passes");
    expect(getProgressDisplay({ status: "running", progress: 65 })?.label).toBe("Final QA checks");
    expect(getProgressDisplay({ status: "running", progress: 85 })?.label).toBe("Validating report");
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
});
