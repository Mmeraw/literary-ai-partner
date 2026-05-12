import { validateProductionConfig } from "@/lib/config/productionConfigValidation";

describe("validateProductionConfig", () => {
  it("rejects worker timing when lease is shorter than max execution", () => {
    const result = validateProductionConfig(
      {
        NODE_ENV: "test",
        EVAL_WORKER_LEASE_MS: "800000",
        EVAL_WORKER_MAX_EXECUTION_MS: "810000",
      },
      "/workspaces/literary-ai-partner",
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "EVAL_WORKER_MAX_EXECUTION_MS (810000) must be between 10000 and 800000.",
    );
    expect(result.errors).toContain(
      "Invalid worker timing: EVAL_WORKER_LEASE_MS (800000) must be >= EVAL_WORKER_MAX_EXECUTION_MS (810000).",
    );
  });

  it("accepts aligned worker lease and execution values at the policy ceiling", () => {
    const result = validateProductionConfig(
      {
        NODE_ENV: "test",
        EVAL_OPENAI_TIMEOUT_MS: "720000",
        EVAL_PASS_TIMEOUT_MS: "720000",
        EVAL_WORKER_LEASE_MS: "800000",
        EVAL_WORKER_MAX_EXECUTION_MS: "800000",
      },
      "/workspaces/literary-ai-partner",
    );

    expect(result.valid).toBe(true);
  });
});