import { getProgressDisplay } from "@/components/evaluation-poller-display";

describe("getProgressDisplay", () => {
  test("shows an indeterminate queued progress section", () => {
    expect(getProgressDisplay({ status: "queued", progress: 0 })).toEqual({
      label: "Queue status",
      valueLabel: "Waiting to start",
      helperText:
        "Your job is queued. Progress details will appear here as soon as processing begins.",
      indeterminate: true,
      percentage: 0,
    });
  });

  test("shows determinate running progress", () => {
    expect(getProgressDisplay({ status: "running", progress: 42 })).toEqual({
      label: "Progress",
      valueLabel: "42%",
      helperText: "This page refreshes automatically while your evaluation is running.",
      indeterminate: false,
      percentage: 42,
    });
  });

  test("clamps running progress to canonical bounds", () => {
    expect(getProgressDisplay({ status: "running", progress: 120 })?.percentage).toBe(100);
    expect(getProgressDisplay({ status: "running", progress: -5 })?.percentage).toBe(0);
  });

  test("hides progress section for terminal jobs", () => {
    expect(getProgressDisplay({ status: "complete", progress: 100 })).toBeNull();
    expect(getProgressDisplay({ status: "failed", progress: 10 })).toBeNull();
  });
});