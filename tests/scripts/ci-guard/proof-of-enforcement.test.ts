// [PROTECTED]

import fs from "node:fs";
import path from "node:path";
import { getRegistryConsumer } from "@/protected/registry";
import { buildScanTarget, scanTarget } from "@/scripts/ci-guard/scanner";

const fixture = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "tests/scripts/ci-guard/fixtures", name), "utf8");

describe("ci-guard proof of enforcement", () => {
  it("registry is populated after first synthetic proof population", () => {
    const registry = getRegistryConsumer();
    const validation = registry.validateRegistry();

    expect(validation.schemaValid).toBe(true);
    expect(validation.entryCount).toBeGreaterThan(0);
    expect(registry.getCategoryCount()).toBeGreaterThan(0);
  });

  it("detects synthetic protected reference in in-scope content", () => {
    const registry = getRegistryConsumer();
    const target = buildScanTarget("app/synthetic-proof/page.tsx", fixture("synthetic-violation.txt"));
    const matches = scanTarget(target, registry);

    expect(target.inScope).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].result.matched).toBe(true);
    expect(matches[0].result.category).toBe("ZXQ_SYNTHETIC_PROOF_TOKEN");
    expect(matches[0].hasNearbyEscapeAnnotation).toBe(false);
  });

  it("finds nearby @InternalOnly annotation for synthetic exception case", () => {
    const registry = getRegistryConsumer();
    const target = buildScanTarget(
      "app/synthetic-proof/exception.tsx",
      fixture("synthetic-annotated-exception.txt"),
    );
    const matches = scanTarget(target, registry);

    expect(target.inScope).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].hasNearbyEscapeAnnotation).toBe(true);
  });

  it("passes clean in-scope content with no synthetic reference", () => {
    const registry = getRegistryConsumer();
    const target = buildScanTarget("app/synthetic-proof/clean.tsx", fixture("in-scope-clean.txt"));
    const matches = scanTarget(target, registry);

    expect(target.inScope).toBe(true);
    expect(matches).toEqual([]);
  });
});
