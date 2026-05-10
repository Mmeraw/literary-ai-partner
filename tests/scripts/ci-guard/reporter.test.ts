import { buildReport, renderSummary } from "@/scripts/ci-guard/reporter";
import type { RawMatch, ScanTarget } from "@/scripts/ci-guard/types";
import type { BoundaryCrossingCategory } from "@/protected/registry";

const target: ScanTarget = {
  relativePath: "app/example/page.tsx",
  content: "SyntheticInternalToken",
  inScope: true,
  scopeRationale: "wire crossing",
};

const rawMatch: RawMatch = {
  relativePath: target.relativePath,
  span: { startOffset: 0, endOffset: 22, lineNumber: 1 },
  result: {
    matched: true,
    category: "synthetic" as unknown as BoundaryCrossingCategory,
    classificationDepth: "literal",
  },
  hasNearbyEscapeAnnotation: false,
};

const escapeContract = {
  markerToken: "@InternalOnly",
  requiredValidatorCheck: "path-classification" as const,
  auditLogShape: "ci-summary" as const,
};

describe("ci-guard reporter", () => {
  it("builds fail report when violations exist", () => {
    const report = buildReport({
      targets: [target],
      rawMatches: [rawMatch],
      registryValidationOk: true,
      escapeContract,
      contentByPath: new Map([[target.relativePath, target.content]]),
    });

    expect(report.outcome).toBe("fail");
    expect(report.violationCount).toBe(1);
  });

  it("renders summary containing outcome", () => {
    const report = buildReport({
      targets: [],
      rawMatches: [],
      registryValidationOk: true,
      escapeContract,
      contentByPath: new Map(),
    });
    expect(renderSummary(report)).toContain("Outcome:");
  });
});
