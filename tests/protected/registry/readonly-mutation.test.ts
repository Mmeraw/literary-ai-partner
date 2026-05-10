// [PROTECTED]

import { describe, it, expect } from "@jest/globals";
import { getRegistryConsumer } from "@/protected/registry";

describe("Protected registry read-only guarantees", () => {
  it("exposes a frozen consumer that cannot be extended", () => {
    const consumer = getRegistryConsumer();

    expect(Object.isFrozen(consumer)).toBe(true);
    expect(() => {
      (consumer as unknown as { mutate?: () => void }).mutate = () => undefined;
    }).toThrow();
  });

  it("returns immutable validation payload", () => {
    const validation = getRegistryConsumer().validateRegistry();

    expect(Object.isFrozen(validation)).toBe(true);
    expect(Object.isFrozen(validation.errors)).toBe(true);

    expect(() => {
      (validation as unknown as { schemaValid: boolean }).schemaValid = false;
    }).toThrow();
  });
});
