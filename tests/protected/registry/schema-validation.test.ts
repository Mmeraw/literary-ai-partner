// [PROTECTED]

import { describe, it, expect } from "@jest/globals";
import { validateEntry, validateRegistryContents } from "@/protected/registry/schema";

describe("Protected registry schema validation", () => {
  it("accepts an empty scaffold registry as valid", () => {
    const result = validateRegistryContents([]);
    expect(result.schemaValid).toBe(true);
    expect(result.categoryCount).toBe(0);
    expect(result.entryCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("returns schema errors for malformed entries", () => {
    const malformed = {
      category: "",
      classificationDepth: "invalid-depth",
      auditOrigin: { registryPrNumber: "NaN", mergedAt: 42 },
    };

    const errors = validateEntry(malformed, 0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.errorKind === "schema" || e.errorKind === "classification")).toBe(true);
  });

  it("fails closed when malformed entries are present", () => {
    const result = validateRegistryContents([{}]);
    expect(result.schemaValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
