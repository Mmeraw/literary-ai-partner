import { describe, expect, it } from "@jest/globals";
import {
  assertEvalTimeoutConfig,
  formatTimeoutResolutionSummary,
  resolveEvaluationTimeoutConfig,
  type TimeoutBaseline,
} from "@/lib/config/evaluationTimeouts";

describe("resolveEvaluationTimeoutConfig", () => {
  it("uses defaults when both timeout vars are unset", () => {
    const config = resolveEvaluationTimeoutConfig({}, {});

    expect(config.passTimeout.valueMs).toBe(720000);
    expect(config.passTimeout.reason).toBe("default_fallback");
    expect(config.openAiTimeout.valueMs).toBe(720000);
    expect(config.openAiTimeout.reason).toBe("default_fallback");
  });

  it("passes through valid explicit env values unchanged", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "120000",
      EVAL_OPENAI_TIMEOUT_MS: "180000",
    }, {});

    expect(config.passTimeout.valueMs).toBe(120000);
    expect(config.passTimeout.reason).toBe("explicit_env");
    expect(config.openAiTimeout.valueMs).toBe(180000);
    expect(config.openAiTimeout.reason).toBe("explicit_env");
  });

  it("promotes OpenAI timeout when an exported shell value is below the pass timeout", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "720000",
      EVAL_OPENAI_TIMEOUT_MS: "30000",
    }, {});

    expect(config.passTimeout.valueMs).toBe(720000);
    expect(config.openAiTimeout.valueMs).toBe(720000);
    expect(config.openAiTimeout.reason).toBe("promoted_to_pass_timeout");
    expect(config.openAiTimeout.originalValueMs).toBe(30000);
    expect(config.openAiTimeout.originalReason).toBe("explicit_env");
  });

  it("falls back for malformed env values", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "abc",
      EVAL_OPENAI_TIMEOUT_MS: "   ",
    }, {});

    expect(config.passTimeout.reason).toBe("malformed_env_fallback");
    expect(config.passTimeout.valueMs).toBe(720000);
    expect(config.openAiTimeout.reason).toBe("malformed_env_fallback");
    expect(config.openAiTimeout.valueMs).toBe(720000);
  });

  it("treats decimal strings as malformed and falls back", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "1500.5",
    }, {});

    expect(config.passTimeout.reason).toBe("malformed_env_fallback");
    expect(config.passTimeout.valueMs).toBe(720000);
  });

  it("clamps numeric values below the minimum", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "0",
      EVAL_OPENAI_TIMEOUT_MS: "-1",
    }, {});

    expect(config.passTimeout.reason).toBe("clamped_to_min");
    expect(config.passTimeout.valueMs).toBe(10000);
    expect(config.openAiTimeout.reason).toBe("promoted_to_pass_timeout");
    expect(config.openAiTimeout.valueMs).toBe(10000);
    expect(config.openAiTimeout.originalReason).toBe("clamped_to_min");
    expect(config.openAiTimeout.originalValueMs).toBe(1000);
  });

  it("clamps numeric values above the maximum", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "999999999",
      EVAL_OPENAI_TIMEOUT_MS: "999999999",
    }, {});

    expect(config.passTimeout.reason).toBe("clamped_to_max");
    expect(config.passTimeout.valueMs).toBe(800000);
    expect(config.openAiTimeout.reason).toBe("clamped_to_max");
    expect(config.openAiTimeout.valueMs).toBe(800000);
  });

  it("detects when explicit env values override local env file baselines", () => {
    const baseline: TimeoutBaseline = {
      EVAL_OPENAI_TIMEOUT_MS: { raw: "180000", source: ".env.local" },
    };

    const config = resolveEvaluationTimeoutConfig(
      { EVAL_OPENAI_TIMEOUT_MS: "30000" },
      baseline,
    );

    expect(config.openAiTimeout.reason).toBe("promoted_to_pass_timeout");
    expect(config.openAiTimeout.valueMs).toBe(720000);
    expect(config.openAiTimeout.originalReason).toBe("conflicting_env_override");
    expect(config.openAiTimeout.originalValueMs).toBe(180000);
    expect(config.openAiTimeout.conflict).toEqual({ raw: "180000", source: ".env.local" });
  });

  it("uses the local env file baseline when the env var is unset", () => {
    const baseline: TimeoutBaseline = {
      EVAL_PASS_TIMEOUT_MS: { raw: "120000", source: ".env.local" },
      EVAL_OPENAI_TIMEOUT_MS: { raw: "180000", source: ".env.local" },
    };

    const config = resolveEvaluationTimeoutConfig({}, baseline);

    expect(config.passTimeout.reason).toBe("file_baseline");
    expect(config.passTimeout.valueMs).toBe(120000);
    expect(config.openAiTimeout.reason).toBe("file_baseline");
    expect(config.openAiTimeout.valueMs).toBe(180000);
  });

  it("formats a concise diagnostic summary", () => {
    const baseline: TimeoutBaseline = {
      EVAL_OPENAI_TIMEOUT_MS: { raw: "180000", source: ".env.local" },
    };
    const config = resolveEvaluationTimeoutConfig(
      {
        EVAL_OPENAI_TIMEOUT_MS: "30000",
        EVAL_PASS_TIMEOUT_MS: "abc",
      },
      baseline,
    );

    expect(formatTimeoutResolutionSummary(config)).toContain(
      "EVAL_OPENAI_TIMEOUT_MS=promoted_to_pass_timeout(720000) original=180000 original_reason=conflicting_env_override",
    );
    expect(formatTimeoutResolutionSummary(config)).toContain(
      'EVAL_PASS_TIMEOUT_MS=malformed_env_fallback(720000) raw="abc"',
    );
  });

  it("formats the baseline source when local env files provide the value", () => {
    const baseline: TimeoutBaseline = {
      EVAL_PASS_TIMEOUT_MS: { raw: "120000", source: ".env.local" },
    };

    const config = resolveEvaluationTimeoutConfig({}, baseline);

    expect(formatTimeoutResolutionSummary(config)).toContain(
      'EVAL_PASS_TIMEOUT_MS=file_baseline(120000) source=.env.local raw="120000"',
    );
  });

  it("does not throw on raw inequality because OpenAI timeout is promoted to the pass timeout", () => {
    expect(() => {
      assertEvalTimeoutConfig(
        {
          EVAL_PASS_TIMEOUT_MS: "180000",
          EVAL_OPENAI_TIMEOUT_MS: "60000",
        },
        {},
      );
    }).not.toThrow();

    const config = resolveEvaluationTimeoutConfig(
      {
        EVAL_PASS_TIMEOUT_MS: "180000",
        EVAL_OPENAI_TIMEOUT_MS: "60000",
      },
      {},
    );
    expect(formatTimeoutResolutionSummary(config)).toContain(
      "EVAL_OPENAI_TIMEOUT_MS=promoted_to_pass_timeout(180000) original=60000 original_reason=explicit_env",
    );
  });
});