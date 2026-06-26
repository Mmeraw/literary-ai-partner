/**
 * Regression test: Flow 1 artifact type contract.
 * Prevents silent breakage if someone introduces a competing artifact type.
 */
import { ARTIFACT_TYPES } from "@/lib/artifacts/writeArtifact";
import * as fs from "fs";
import * as path from "path";

describe("Flow 1 artifact type contract", () => {
  it("canonical artifact type constant is \"one_page_summary\"", () => {
    expect(ARTIFACT_TYPES.ONE_PAGE_SUMMARY).toBe("one_page_summary");
  });

  it("API route queries by the canonical artifact type", () => {
    const apiPath = path.resolve(
      __dirname,
      "../app/api/evaluations/[jobId]/route.ts"
    );
    const source = fs.readFileSync(apiPath, "utf8");

    // The API route must reference the canonical type string
    expect(source).toContain("one_page_summary");

    // It should also reference the V2 artifact type (current pipeline)
    expect(source).toContain("evaluation_result_v2");
  });

  it("writeArtifact module exports no competing final artifact types", () => {
    const keys = Object.keys(ARTIFACT_TYPES);
    // Each canonical artifact type constant must be listed here.
    // If a new type is added, this test forces an explicit decision.
    expect(keys).toEqual(["ONE_PAGE_SUMMARY", "FINAL_EXTERNAL_AUDIT"]);
  });

  it("phase2.ts uses ARTIFACT_TYPES constant (not a raw string)", () => {
    const phase2Path = path.resolve(
      __dirname,
      "../lib/jobs/phase2.ts"
    );
    const source = fs.readFileSync(phase2Path, "utf8");

    // Phase 2 must import and use the constant from writeArtifact
    expect(source).toContain("ARTIFACT_TYPES.ONE_PAGE_SUMMARY");
    expect(source).toContain("writeArtifact");
  });
});
