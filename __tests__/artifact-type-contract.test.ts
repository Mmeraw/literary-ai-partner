/**
 * Regression test: Flow 1 artifact type contract.
 * Prevents silent breakage if someone introduces a competing artifact type.
 */
import { ARTIFACT_TYPES } from "@/lib/artifacts/writeArtifact";
import * as fs from "fs";
import * as path from "path";

describe("Flow 1 artifact type contract", () => {
  it("canonical artifact type constant is \"evaluation_result_v1\"", () => {
    expect(ARTIFACT_TYPES.EVALUATION_RESULT_V1).toBe("evaluation_result_v1");
  });

  it("report page queries by the canonical artifact type", () => {
    const reportPath = path.resolve(
      __dirname,
      "../app/evaluate/[jobId]/report/page.tsx"
    );
    const source = fs.readFileSync(reportPath, "utf8");

    // The report page must reference the canonical type string
    expect(source).toContain("evaluation_result_v1");

    // It should appear in exactly one constant declaration, not scattered
    const matches = source.match(/evaluation_result_v1/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("writeArtifact module exports no competing final artifact types", () => {
    const keys = Object.keys(ARTIFACT_TYPES);
    // There should be exactly one artifact type constant today.
    // If a new type is added, this test forces an explicit decision.
    expect(keys).toEqual(["EVALUATION_RESULT_V1"]);
  });

  it("phase2.ts uses ARTIFACT_TYPES constant (not a raw string)", () => {
    const phase2Path = path.resolve(
      __dirname,
      "../lib/jobs/phase2.ts"
    );
    const source = fs.readFileSync(phase2Path, "utf8");

    // Phase 2 must import and use the constant from writeArtifact
    expect(source).toContain("ARTIFACT_TYPES.EVALUATION_RESULT_V1");
    expect(source).toContain("writeArtifact");
  });
});
