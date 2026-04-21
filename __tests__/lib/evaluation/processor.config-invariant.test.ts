/**
 * Config invariant tests for lib/evaluation/processor.ts
 *
 * Verifies that the processor consumes the canonical timeout contract.
 *
 * Because processor.ts has module-level side effects (throws on import
 * when invariants are violated), each test case uses jest.isolateModules
 * to get a fresh module evaluation with controlled env vars.
 */

export {};

const ORIGINAL_ENV = { ...process.env };

function withLocalTimeoutBaseline<T>(run: () => T): T {
  jest.doMock("@/lib/evaluation/config", () => {
    const actual = jest.requireActual("@/lib/evaluation/config");
    const baseline = {
      EVAL_OPENAI_TIMEOUT_MS: { raw: "180000", source: ".env.local" },
      EVAL_PASS_TIMEOUT_MS: { raw: "180000", source: ".env.local" },
    };

    return {
      ...actual,
      getEvalPassTimeoutMs: () =>
        actual.resolveEvaluationTimeoutConfig(process.env, baseline).passTimeout.valueMs,
      getEvalOpenAiTimeoutMs: () =>
        actual.resolveEvaluationTimeoutConfig(process.env, baseline).openAiTimeout.valueMs,
      assertEvalTimeoutConfig: () => actual.assertEvalTimeoutConfig(process.env, baseline),
    };
  });

  try {
    return run();
  } finally {
    jest.dontMock("@/lib/evaluation/config");
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

describe("processor.ts timeout config contract", () => {
  it("does not throw when exported timeout vars conflict with local timeout files", () => {
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "60000"; // less than pass timeout

    expect(() => {
      withLocalTimeoutBaseline(() => {
        jest.isolateModules(() => {
          require("@/lib/evaluation/processor");
        });
      });
    }).not.toThrow();
  });

  it("does not throw when EVAL_OPENAI_TIMEOUT_MS === EVAL_PASS_TIMEOUT_MS", () => {
    process.env.EVAL_PASS_TIMEOUT_MS = "120000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "120000";

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/evaluation/processor");
      });
    }).not.toThrow();
  });

  it("does not throw when EVAL_OPENAI_TIMEOUT_MS > EVAL_PASS_TIMEOUT_MS", () => {
    process.env.EVAL_PASS_TIMEOUT_MS = "60000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/evaluation/processor");
      });
    }).not.toThrow();
  });

  it("does not throw with default env values (180000 >= 180000)", () => {
    delete process.env.EVAL_PASS_TIMEOUT_MS;
    delete process.env.EVAL_OPENAI_TIMEOUT_MS;

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/evaluation/processor");
      });
    }).not.toThrow();
  });

  it("does not throw when malformed timeout env values fall back to defaults", () => {
    process.env.EVAL_PASS_TIMEOUT_MS = "abc";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "   ";

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/evaluation/processor");
      });
    }).not.toThrow();
  });

  it("does not throw when poisoned numeric values are clamped into a valid range", () => {
    process.env.EVAL_PASS_TIMEOUT_MS = "0";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "999999999";

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/evaluation/processor");
      });
    }).not.toThrow();
  });
});
