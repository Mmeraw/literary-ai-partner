import { validateProductionConfig } from "@/lib/config/productionConfigValidation";

describe("validateProductionConfig", () => {
  it("rejects worker timing when max execution exceeds the policy ceiling", () => {
    const result = validateProductionConfig(
      {
        NODE_ENV: "test",
        EVAL_WORKER_LEASE_MS: "3600000",
        EVAL_WORKER_MAX_EXECUTION_MS: "3700000",
      },
      "/workspaces/literary-ai-partner",
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "EVAL_WORKER_MAX_EXECUTION_MS (3700000) must be between 10000 and 3600000.",
    );
  });

  it("accepts aligned worker lease and execution values at the policy ceiling", () => {
    const result = validateProductionConfig(
      {
        NODE_ENV: "test",
        EVAL_OPENAI_TIMEOUT_MS: "720000",
        EVAL_PASS_TIMEOUT_MS: "720000",
        EVAL_WORKER_LEASE_MS: "3600000",
        EVAL_WORKER_MAX_EXECUTION_MS: "3600000",
      },
      "/workspaces/literary-ai-partner",
    );

    expect(result.valid).toBe(true);
  });

  it("promotes low OpenAI timeout instead of blocking build when pass timeout is higher", () => {
    const result = validateProductionConfig(
      {
        NODE_ENV: "test",
        EVAL_OPENAI_TIMEOUT_MS: "30000",
        EVAL_PASS_TIMEOUT_MS: "720000",
        EVAL_WORKER_LEASE_MS: "3600000",
        EVAL_WORKER_MAX_EXECUTION_MS: "3600000",
      },
      "/workspaces/literary-ai-partner",
    );

    expect(result.valid).toBe(true);
    expect(result.timeoutConfig.openAiTimeout.valueMs).toBe(720000);
    expect(result.timeoutConfig.openAiTimeout.reason).toBe("promoted_to_pass_timeout");
    expect(result.errors).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining("EVAL_OPENAI_TIMEOUT_MS (30000) must be >= EVAL_PASS_TIMEOUT_MS"),
      ]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("EVAL_OPENAI_TIMEOUT_MS resolved below EVAL_PASS_TIMEOUT_MS and was promoted"),
      ]),
    );
  });
});