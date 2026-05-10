import { runGuard } from "@/scripts/ci-guard/index";

describe("ci-guard integration", () => {
  it("passes with current empty protected registry scaffold", () => {
    const exitCode = runGuard(["app/page.tsx", "tests/scripts/ci-guard/fixtures/out-of-scope.txt"]);
    expect(exitCode).toBe(0);
  });
});
