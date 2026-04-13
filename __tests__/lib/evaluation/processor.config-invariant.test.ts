/**
 * Config invariant tests for lib/evaluation/processor.ts
 *
 * Verifies that the processor enforces the timeout config contract:
 * EVAL_OPENAI_TIMEOUT_MS must be >= EVAL_PASS_TIMEOUT_MS.
 *
 * Because processor.ts has module-level side effects (throws on import
 * when invariants are violated), each test case uses jest.isolateModules
 * to get a fresh module evaluation with controlled env vars.
 */

export {};

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

describe("processor.ts config invariant: EVAL_OPENAI_TIMEOUT_MS >= EVAL_PASS_TIMEOUT_MS", () => {
  it("throws CONFIG_ERROR when EVAL_OPENAI_TIMEOUT_MS < EVAL_PASS_TIMEOUT_MS", () => {
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "60000"; // less than pass timeout

    expect(() => {
      jest.isolateModules(() => {
        require("@/lib/evaluation/processor");
      });
    }).toThrow(/\[CONFIG_ERROR\].*EVAL_OPENAI_TIMEOUT_MS.*must be.*>=.*EVAL_PASS_TIMEOUT_MS/);
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
});
