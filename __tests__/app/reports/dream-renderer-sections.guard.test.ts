import * as fs from "fs";
import * as path from "path";

describe("DREAM renderer section coverage guard", () => {
  test("report page includes canonical §1–§16 section headings", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/reports/[jobId]/page.tsx"),
      "utf8",
    );

    const requiredHeadings = [
      "Executive Verdict",
      "Market Shelf",
      "Anti-Patterns to Avoid",
      "Structural Stack",
      "Arc Map",
      "Criterion Analyses",
      "Layer Analyses",
      "Cross-Layer Integration",
      "Symbolic / Doctrine Audit",
      "Reader Experience",
      "Revision Plan",
      "Releasability",
      "Acceptance Checks",
      "Calibration Notes",
      "Repository Summary",
    ];

    for (const heading of requiredHeadings) {
      expect(source).toContain(heading);
    }
  });
});
