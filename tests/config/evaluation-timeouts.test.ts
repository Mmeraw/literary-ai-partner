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

    expect(config.passTimeout.valueMs).toBe(180000);
    expect(config.passTimeout.reason).toBe("default_fallback");
    expect(config.openAiTimeout.valueMs).toBe(180000);
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

  it("falls back for malformed env values", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "abc",
      EVAL_OPENAI_TIMEOUT_MS: "   ",
    }, {});

    expect(config.passTimeout.reason).toBe("malformed_env_fallback");
    expect(config.passTimeout.valueMs).toBe(180000);
    expect(config.openAiTimeout.reason).toBe("malformed_env_fallback");
    expect(config.openAiTimeout.valueMs).toBe(180000);
  });

  it("treats decimal strings as malformed and falls back", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "1500.5",
    }, {});

    expect(config.passTimeout.reason).toBe("malformed_env_fallback");
    expect(config.passTimeout.valueMs).toBe(180000);
  });

  it("clamps numeric values below the minimum", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "0",
      EVAL_OPENAI_TIMEOUT_MS: "-1",
    }, {});

    expect(config.passTimeout.reason).toBe("clamped_to_min");
    expect(config.passTimeout.valueMs).toBe(10000);
    expect(config.openAiTimeout.reason).toBe("clamped_to_min");
    expect(config.openAiTimeout.valueMs).toBe(1000);
  });

  it("clamps numeric values above the maximum", () => {
    const config = resolveEvaluationTimeoutConfig({
      EVAL_PASS_TIMEOUT_MS: "999999999",
      EVAL_OPENAI_TIMEOUT_MS: "999999999",
    }, {});

    expect(config.passTimeout.reason).toBe("clamped_to_max");
    expect(config.passTimeout.valueMs).toBe(180000);
    expect(config.openAiTimeout.reason).toBe("clamped_to_max");
    expect(config.openAiTimeout.valueMs).toBe(180000);
  });

  it("detects when explicit env values override local env file baselines", () => {
    const baseline: TimeoutBaseline = {
      EVAL_OPENAI_TIMEOUT_MS: { raw: "180000", source: ".env.local" },
    };

    const config = resolveEvaluationTimeoutConfig(
      { EVAL_OPENAI_TIMEOUT_MS: "30000" },
      baseline,
    );

    expect(config.openAiTimeout.reason).toBe("conflicting_env_override");
    expect(config.openAiTimeout.valueMs).toBe(180000);
    expect(config.openAiTimeout.conflict).toEqual({ raw: "180000", source: ".env.local" });
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
      'EVAL_OPENAI_TIMEOUT_MS=conflicting_env_override(180000) ignored_shell="30000" using=.env.local("180000")',
    );
    expect(formatTimeoutResolutionSummary(config)).toContain(
      'EVAL_PASS_TIMEOUT_MS=malformed_env_fallback(180000) raw="abc"',
    );
  });

  it("still throws on invalid raw inequality when no local baseline is provided", () => {
    expect(() => {
      assertEvalTimeoutConfig(
        {
          EVAL_PASS_TIMEOUT_MS: "180000",
          EVAL_OPENAI_TIMEOUT_MS: "60000",
        },
        {},
      );
    }).toThrow(/\[CONFIG_ERROR\].*EVAL_OPENAI_TIMEOUT_MS.*must be.*>=.*EVAL_PASS_TIMEOUT_MS/);
  });
});