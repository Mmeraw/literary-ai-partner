import { describe, expect, test, beforeEach, afterEach, jest } from "@jest/globals";
import {
  MODEL_COMPLETION_TOKEN_CAPS,
  buildOpenAIOutputTokenParam,
  getModelCompletionTokenCap,
} from "@/lib/evaluation/policy";

describe("policy: MODEL_COMPLETION_TOKEN_CAPS + buildOpenAIOutputTokenParam clamp (Bug 1)", () => {
  let warnSpy: jest.SpiedFunction<typeof console.warn>;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("table contains the gpt-4o family at 16384", () => {
    expect(MODEL_COMPLETION_TOKEN_CAPS["gpt-4o"]).toBe(16384);
    expect(MODEL_COMPLETION_TOKEN_CAPS["gpt-4o-2024-08-06"]).toBe(16384);
    expect(MODEL_COMPLETION_TOKEN_CAPS["gpt-4o-mini"]).toBe(16384);
  });

  test("table contains gpt-4-turbo family at 4096", () => {
    expect(MODEL_COMPLETION_TOKEN_CAPS["gpt-4-turbo"]).toBe(4096);
    expect(MODEL_COMPLETION_TOKEN_CAPS["gpt-4-1106-preview"]).toBe(4096);
  });

  test("getModelCompletionTokenCap is case-insensitive and trims", () => {
    expect(getModelCompletionTokenCap("GPT-4o")).toBe(16384);
    expect(getModelCompletionTokenCap("  gpt-4o  ")).toBe(16384);
  });

  test("getModelCompletionTokenCap returns null for unknown models", () => {
    expect(getModelCompletionTokenCap("totally-made-up-model")).toBeNull();
    expect(getModelCompletionTokenCap("")).toBeNull();
  });

  test("clamps when requested > cap for non-reasoning model (gpt-4o, 20000 -> 16384)", () => {
    const out = buildOpenAIOutputTokenParam("gpt-4o", 20000);
    expect(out).toEqual({ max_tokens: 16384 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/clamping max_tokens from 20000 to per-model cap 16384/);
  });

  test("does NOT clamp when requested <= cap (gpt-4o, 16384)", () => {
    const out = buildOpenAIOutputTokenParam("gpt-4o", 16384);
    expect(out).toEqual({ max_tokens: 16384 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("does NOT clamp when requested below cap (gpt-4o, 4096)", () => {
    const out = buildOpenAIOutputTokenParam("gpt-4o", 4096);
    expect(out).toEqual({ max_tokens: 4096 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("clamps for reasoning-style model using max_completion_tokens (gpt-5.1, 200000 -> 128000)", () => {
    const out = buildOpenAIOutputTokenParam("gpt-5.1", 200000);
    expect(out).toEqual({ max_completion_tokens: 128000 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test("unknown model passes through unclamped (no warn, no truncation)", () => {
    const out = buildOpenAIOutputTokenParam("some-unmapped-model", 50000);
    expect(out).toEqual({ max_tokens: 50000 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("unknown reasoning-style model passes through unclamped on max_completion_tokens path", () => {
    const out = buildOpenAIOutputTokenParam("o3-future-unmapped", 99999);
    expect(out).toEqual({ max_completion_tokens: 99999 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("gpt-4-turbo clamps 20000 down to 4096", () => {
    const out = buildOpenAIOutputTokenParam("gpt-4-turbo", 20000);
    expect(out).toEqual({ max_tokens: 4096 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
