import { validateProductionConfig } from "@/lib/config/productionConfigValidation";

describe("validateProductionConfig", () => {
  it("rejects worker timing when lease is shorter than max execution", () => {
    const result = validateProductionConfig(
      {
        EVAL_WORKER_LEASE_MS: "180000",
        EVAL_WORKER_MAX_EXECUTION_MS: "280000",
      },
      "/workspaces/literary-ai-partner",
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "EVAL_WORKER_MAX_EXECUTION_MS (280000) must be between 10000 and 180000.",
    );
    expect(result.errors).toContain(
      "Invalid worker timing: EVAL_WORKER_LEASE_MS (180000) must be >= EVAL_WORKER_MAX_EXECUTION_MS (280000).",
    );
  });

  it("accepts aligned worker lease and execution values at the policy ceiling", () => {
    const result = validateProductionConfig(
      {
        EVAL_WORKER_LEASE_MS: "180000",
        EVAL_WORKER_MAX_EXECUTION_MS: "180000",
      },
      "/workspaces/literary-ai-partner",
    );

    expect(result.valid).toBe(true);
  });
});