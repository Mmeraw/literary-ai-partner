// [PROTECTED]

import { describe, it, expect } from "@jest/globals";
import { getRegistryConsumer } from "@/protected/registry";
import type { ReadOnlyRegistryConsumer } from "@/protected/registry";

describe("Protected registry consumer contract", () => {
  it("exposes the read-only consumer interface", () => {
    const consumer: ReadOnlyRegistryConsumer = getRegistryConsumer();
    expect(typeof consumer.hasCategoryMatch).toBe("function");
    expect(typeof consumer.getEscapeAnnotationContract).toBe("function");
    expect(typeof consumer.validateRegistry).toBe("function");
    expect(typeof consumer.getCategoryCount).toBe("function");
  });

  it("returns no match for any candidate at scaffold time", () => {
    const consumer = getRegistryConsumer();
    const result = consumer.hasCategoryMatch("arbitrary-test-string");
    expect(result.matched).toBe(false);
    expect(result.category).toBeNull();
    expect(result.classificationDepth).toBeNull();
  });

  it("returns frozen result objects and contract payloads", () => {
    const consumer = getRegistryConsumer();
    const result = consumer.hasCategoryMatch("test");
    const contract = consumer.getEscapeAnnotationContract();

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(contract)).toBe(true);
  });
});
