// [PROTECTED]

import { getRegistryConsumer } from "@/protected/registry";
import { buildScanTarget, scanTarget } from "@/scripts/ci-guard/scanner";

describe("ci-guard real category enforcement", () => {
  it("detects real protected reference in in-scope path", () => {
    const registry = getRegistryConsumer();
    const target = buildScanTarget(
      "app/real-category/violation.tsx",
      'const x = "narrativeDrive";',
    );
    const matches = scanTarget(target, registry);

    expect(target.inScope).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].result.matched).toBe(true);
    expect(matches[0].result.category).toBe("narrativeDrive");
  });

  it("accepts @InternalOnly annotation on real protected reference", () => {
    const registry = getRegistryConsumer();
    const target = buildScanTarget(
      "app/real-category/exception.tsx",
      '// @InternalOnly\nconst x = "narrativeDrive";',
    );
    const matches = scanTarget(target, registry);

    expect(target.inScope).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].hasNearbyEscapeAnnotation).toBe(true);
    expect(matches[0].span.lineNumber).toBeGreaterThan(0);
  });

  it("produces clean execution on in-scope content with no protected references", () => {
    const registry = getRegistryConsumer();
    const target = buildScanTarget(
      "app/real-category/clean.tsx",
      'export function hello() { return "world"; }',
    );
    const matches = scanTarget(target, registry);

    expect(target.inScope).toBe(true);
    expect(matches).toEqual([]);
  });
});