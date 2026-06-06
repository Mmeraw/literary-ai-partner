import * as fs from "fs";
import * as path from "path";

describe("DREAM renderer section coverage guard", () => {
  test("legacy report page redirects to canonical evaluation report surface", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/reports/[jobId]/page.tsx"),
      "utf8",
    );

    expect(source).toContain("redirect(`/evaluate/${params.jobId}${printSuffix}`)");
    expect(source).toContain("force-dynamic");
    expect(source).not.toContain("Executive Verdict");
  });
});
