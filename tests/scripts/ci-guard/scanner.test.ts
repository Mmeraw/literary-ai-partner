import fs from "node:fs";
import path from "node:path";
import { buildScanTarget, scanTarget } from "@/scripts/ci-guard/scanner";
import { BoundaryCrossingCategory, type ReadOnlyRegistryConsumer } from "@/protected/registry";

const fixture = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "tests/scripts/ci-guard/fixtures", name), "utf8");

const registry: ReadOnlyRegistryConsumer = {
  hasCategoryMatch(candidate: string) {
    const matched = candidate.includes("SyntheticInternalToken");
    return {
      matched,
      category: matched ? ("synthetic" as unknown as BoundaryCrossingCategory) : null,
      classificationDepth: matched ? "literal" : null,
    };
  },
  getEscapeAnnotationContract() {
    return {
      markerToken: "@InternalOnly",
      requiredValidatorCheck: "path-classification",
      auditLogShape: "ci-summary",
    };
  },
  validateRegistry() {
    return {
      schemaValid: true,
      categoryCount: 1,
      entryCount: 1,
      errors: [],
    };
  },
  getCategoryCount() {
    return 1;
  },
};

describe("ci-guard scanner", () => {
  it("scans in-scope files and finds synthetic match", () => {
    const target = buildScanTarget("app/example/page.tsx", fixture("in-scope-violation.txt"));
    const matches = scanTarget(target, registry);

    expect(target.inScope).toBe(true);
    expect(matches.length).toBe(1);
    expect(matches[0].result.matched).toBe(true);
  });

  it("ignores out-of-scope files", () => {
    const target = buildScanTarget("tests/example.test.ts", fixture("out-of-scope.txt"));
    const matches = scanTarget(target, registry);

    expect(target.inScope).toBe(false);
    expect(matches).toEqual([]);
  });
});
