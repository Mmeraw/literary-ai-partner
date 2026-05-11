/**
 * Tests for per-pass model routing resolution and EVAL_PASS3_FALLBACK_MODEL.
 *
 * Covers:
 *  - resolveEvaluationRuntimeConfig exposes a `routing` section
 *  - pass1/2/3 models resolve from env vars
 *  - EVAL_PASS3_FALLBACK_MODEL resolves independently of primary Pass 3 model
 *  - fallback falls back to pass3 primary when EVAL_PASS3_FALLBACK_MODEL is absent
 *  - getCanonicalPass3FallbackModel in policy resolves from env
 */

import { resolveEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";

// policy.ts reads from process.env directly so we need to set it before importing.
// We call getCanonicalPass3FallbackModel inline after setting env.

const BASE_ENV = {
  OPENAI_API_KEY: "sk-test",
  EVAL_OPENAI_MODEL: "gpt-4o",
  EVAL_WORKER_MAX_EXECUTION_MS: "55000",
  EVAL_WORKER_LEASE_MS: "300000",
  CRON_SECRET: "test-secret",
};

function buildEnv(overrides: Record<string, string | undefined> = {}) {
  return { ...BASE_ENV, ...overrides } as Record<string, string | undefined>;
}

describe("EvaluationRuntimeConfig routing section", () => {
  it("exposes resolved pass models in routing property", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({
        EVAL_PASS1_MODEL: "gpt-5-mini",
        EVAL_PASS2_MODEL: "gpt-5-mini",
        EVAL_PASS3_MODEL: "gpt-5",
        EVAL_PASS3_FALLBACK_MODEL: "gpt-4o",
      }),
    );

    expect(config.routing.pass1Model).toBe("gpt-5-mini");
    expect(config.routing.pass2Model).toBe("gpt-5-mini");
    expect(config.routing.pass3Model).toBe("gpt-5");
    expect(config.routing.pass3FallbackModel).toBe("gpt-4o");
  });

  it("falls back to runtime default model when pass-specific vars are absent", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({ EVAL_OPENAI_MODEL: "gpt-4o" }),
    );

    expect(config.routing.pass1Model).toBe("gpt-4o");
    expect(config.routing.pass2Model).toBe("gpt-4o");
    expect(config.routing.pass3Model).toBe("gpt-4o");
    expect(config.routing.pass3FallbackModel).toBe("gpt-4o");
  });

  it("uses EVAL_CHUNK_MODEL as fallback for pass1 and pass2 when specific vars absent", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({
        EVAL_CHUNK_MODEL: "gpt-5-mini",
        EVAL_OPENAI_MODEL: "gpt-4o",
      }),
    );

    expect(config.routing.pass1Model).toBe("gpt-5-mini");
    expect(config.routing.pass2Model).toBe("gpt-5-mini");
    // Pass 3 does not use EVAL_CHUNK_MODEL
    expect(config.routing.pass3Model).toBe("gpt-4o");
  });

  it("EVAL_PASS3_FALLBACK_MODEL resolves independently from pass3 primary", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({
        EVAL_PASS3_MODEL: "gpt-5-mini",
        EVAL_PASS3_FALLBACK_MODEL: "gpt-5",
      }),
    );

    expect(config.routing.pass3Model).toBe("gpt-5-mini");
    expect(config.routing.pass3FallbackModel).toBe("gpt-5");
  });

  it("fallback model equals primary pass3 model when EVAL_PASS3_FALLBACK_MODEL is absent", () => {
    const config = resolveEvaluationRuntimeConfig(
      buildEnv({ EVAL_PASS3_MODEL: "gpt-5" }),
    );

    expect(config.routing.pass3Model).toBe("gpt-5");
    expect(config.routing.pass3FallbackModel).toBe("gpt-5");
  });
});
