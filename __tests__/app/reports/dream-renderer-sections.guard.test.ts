import * as fs from "fs";
import * as path from "path";

describe("DREAM renderer section coverage guard", () => {
  test("report page is the canonical full evaluation renderer", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/reports/[jobId]/page.tsx"),
      "utf8",
    );

    // The reports page must be the full renderer (not a redirect)
    expect(source).toContain("force-dynamic");
    expect(source).toContain("isEvaluationResultV2");
    expect(source).toContain("canReleaseEvaluationRead");
  });

  test("legacy /evaluate/[jobId]/report redirects to canonical /reports/[jobId]", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/evaluate/[jobId]/report/page.tsx"),
      "utf8",
    );

    expect(source).toContain("redirect(`/reports/${jobId}`)");
    expect(source).toContain("force-dynamic");
  });
});
