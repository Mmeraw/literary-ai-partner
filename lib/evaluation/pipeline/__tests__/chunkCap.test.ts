import { afterEach, describe, expect, test } from "@jest/globals";
import { DEFAULT_CHUNK_MAX_PER_PASS, getConfiguredChunkCap } from "../chunkCap";

describe("chunk cap configuration", () => {
  afterEach(() => {
    delete process.env.EVAL_CHUNK_MAX_PER_PASS;
  });

  test("defaults to 72 when env is unset", () => {
    delete process.env.EVAL_CHUNK_MAX_PER_PASS;
    expect(DEFAULT_CHUNK_MAX_PER_PASS).toBe(72);
    expect(getConfiguredChunkCap()).toBe(72);
  });

  test("uses env override when set to a positive integer", () => {
    process.env.EVAL_CHUNK_MAX_PER_PASS = "60";
    expect(getConfiguredChunkCap()).toBe(60);
  });

  test("falls back to default when env is invalid", () => {
    process.env.EVAL_CHUNK_MAX_PER_PASS = "not-a-number";
    expect(getConfiguredChunkCap()).toBe(72);
  });
});
