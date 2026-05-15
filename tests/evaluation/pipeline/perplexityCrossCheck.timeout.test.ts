import {
  DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS,
  MIN_PERPLEXITY_REQUEST_TIMEOUT_MS,
  resolvePerplexityRequestTimeoutMs,
} from "@/lib/evaluation/pipeline/perplexityCrossCheck";

describe("resolvePerplexityRequestTimeoutMs", () => {
  it("defaults to 180000 when unset or blank", () => {
    expect(resolvePerplexityRequestTimeoutMs(undefined)).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("")).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("   ")).toBe(180000);
  });

  it("uses a valid explicit timeout", () => {
    expect(resolvePerplexityRequestTimeoutMs("240000")).toBe(240000);
    expect(resolvePerplexityRequestTimeoutMs("300000")).toBe(300000);
  });

  it("falls back for invalid values", () => {
    expect(resolvePerplexityRequestTimeoutMs("abc")).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("NaN")).toBe(180000);
  });

  it("falls back for non-positive or too-low values", () => {
    expect(resolvePerplexityRequestTimeoutMs("0")).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("-1")).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("1000")).toBe(180000);
    expect(
      resolvePerplexityRequestTimeoutMs(
        String(MIN_PERPLEXITY_REQUEST_TIMEOUT_MS - 1),
      ),
    ).toBe(180000);
  });

  it("accepts the minimum floor exactly", () => {
    expect(
      resolvePerplexityRequestTimeoutMs(
        String(MIN_PERPLEXITY_REQUEST_TIMEOUT_MS),
      ),
    ).toBe(MIN_PERPLEXITY_REQUEST_TIMEOUT_MS);
  });

  it("exports the expected default", () => {
    expect(DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS).toBe(180000);
  });
});