import {
  EvaluationRuntimeConfigError,
  resolveEvaluationRuntimeConfig,
} from "@/lib/config/evaluationRuntimeConfig";

const resolveWithoutBaseline = (env: Record<string, string | undefined>) =>
  resolveEvaluationRuntimeConfig(env, {});

describe("resolveEvaluationRuntimeConfig", () => {
  it("resolves deterministic defaults", () => {
    const config = resolveWithoutBaseline({});

    expect(config.model).toBe("gpt-4o");
    expect(config.adjudicationMode).toBe("optional");
    expect(config.pass.pass1MaxTokens).toBe(8000);
    expect(config.pass.pass2MaxTokens).toBe(8000);
    expect(config.pass.pass3MaxTokens).toBe(20000);
    expect(config.pass.pass3PromptMaxChars).toBe(40000);
    expect(config.pass.inputCharBudget).toBe(40000);
    expect(config.pass.synthesisRefCharBudget).toBe(8000);
    expect(config.worker.batchSize).toBe(5);
    expect(config.worker.leaseMs).toBe(300000);
    expect(config.worker.maxExecutionMs).toBe(55000);
    expect(config.worker.disabled).toBe(false);
    expect(config.timeouts.passTimeout.valueMs).toBe(600000);
    expect(config.timeouts.openAiTimeout.valueMs).toBe(600000);
  });

  it("parses worker disabled kill-switch from env", () => {
    const configFromTrue = resolveWithoutBaseline({
      EVAL_WORKER_DISABLED: "true",
    });
    expect(configFromTrue.worker.disabled).toBe(true);

    const configFromOne = resolveWithoutBaseline({
      EVAL_WORKER_DISABLED: "1",
    });
    expect(configFromOne.worker.disabled).toBe(true);

    const configFromFalse = resolveWithoutBaseline({
      EVAL_WORKER_DISABLED: "false",
    });
    expect(configFromFalse.worker.disabled).toBe(false);
  });

  it("throws on malformed numeric pass token values", () => {
    expect(() =>
      resolveEvaluationRuntimeConfig({
        EVAL_PASS1_MAX_TOKENS: "35OO",
      }, {}),
    ).toThrow(EvaluationRuntimeConfigError);
  });

  it("throws on out-of-range numeric worker values", () => {
    expect(() =>
      resolveEvaluationRuntimeConfig({
        EVAL_WORKER_BATCH_SIZE: "9",
      }, {}),
    ).toThrow(EvaluationRuntimeConfigError);
  });

  it("throws when lease is shorter than worker max execution", () => {
    expect(() =>
      resolveEvaluationRuntimeConfig({
        EVAL_WORKER_LEASE_MS: "30000",
        EVAL_WORKER_MAX_EXECUTION_MS: "60000",
      }, {}),
    ).toThrow(EvaluationRuntimeConfigError);
  });

  it("throws when worker max execution exceeds the lease policy ceiling", () => {
    expect(() =>
      resolveEvaluationRuntimeConfig({
        EVAL_WORKER_LEASE_MS: "600000",
        EVAL_WORKER_MAX_EXECUTION_MS: "610000",
      }, {}),
    ).toThrow(/EVAL_WORKER_MAX_EXECUTION_MS must be between 10000 and 600000/);
  });

  it("accepts explicit 600000ms worker max execution when lease is aligned", () => {
    const config = resolveWithoutBaseline({
      EVAL_WORKER_LEASE_MS: "600000",
      EVAL_WORKER_MAX_EXECUTION_MS: "600000",
    });

    expect(config.worker.leaseMs).toBe(600000);
    expect(config.worker.maxExecutionMs).toBe(600000);
  });

  it("throws when adjudication mode requires Perplexity key and key is missing", () => {
    expect(() =>
      resolveEvaluationRuntimeConfig({
        EVAL_EXTERNAL_ADJUDICATION_MODE: "required",
      }, {}),
    ).toThrow(EvaluationRuntimeConfigError);
  });

  it("accepts required adjudication mode when Perplexity key is present", () => {
    const config = resolveWithoutBaseline({
      EVAL_EXTERNAL_ADJUDICATION_MODE: "required",
      PERPLEXITY_API_KEY: "pplx-test",
    });

    expect(config.adjudicationMode).toBe("required");
    expect(config.perplexityApiKey).toBe("pplx-test");
  });

  it("uses file baseline over conflicting env shell override for timeout family", () => {
    const config = resolveEvaluationRuntimeConfig(
      {
        EVAL_PASS_TIMEOUT_MS: "120000",
        EVAL_OPENAI_TIMEOUT_MS: "90000",
      },
      {
        EVAL_PASS_TIMEOUT_MS: {
          raw: "180000",
          source: ".env.local",
        },
        EVAL_OPENAI_TIMEOUT_MS: {
          raw: "180000",
          source: ".env.local",
        },
      },
    );

    expect(config.timeouts.passTimeout.reason).toBe("conflicting_env_override");
    expect(config.timeouts.openAiTimeout.reason).toBe("conflicting_env_override");
    expect(config.timeouts.passTimeout.valueMs).toBe(180000);
    expect(config.timeouts.openAiTimeout.valueMs).toBe(180000);
  });

  it("throws when timeout ordering invariant is violated", () => {
    expect(() =>
      resolveEvaluationRuntimeConfig({
        EVAL_PASS_TIMEOUT_MS: "180000",
        EVAL_OPENAI_TIMEOUT_MS: "60000",
      }, {}),
    ).toThrow(/EVAL_OPENAI_TIMEOUT_MS/);
  });

  it("keeps optional vars absent without silent behavior shift", () => {
    const config = resolveWithoutBaseline({
      OPENAI_API_KEY: "sk-test",
    });

    expect(config.openaiApiKey).toBe("sk-test");
    expect(config.evalDebugEnabled).toBe(false);
    expect(config.contextContaminationGuardEnabled).toBe(false);
  });

  it("throws when NODE_ENV is outside canonical contract values", () => {
    expect(() =>
      resolveEvaluationRuntimeConfig({
        NODE_ENV: "staging",
      }, {}),
    ).toThrow(EvaluationRuntimeConfigError);
  });

  it("throws on forbidden contract combinations", () => {
    expect(() =>
      resolveEvaluationRuntimeConfig({
        USE_REAL_LLM: "true",
      }, {}),
    ).toThrow(EvaluationRuntimeConfigError);
  });
});
