import {
  assertEvalTimeoutConfig,
  resolveEvaluationTimeoutConfig,
  type EvaluationTimeoutConfig,
  type TimeoutBaseline,
} from "@/lib/config/evaluationTimeouts";

export type ExternalAdjudicationMode = "optional" | "required" | "veto";

export type EnvLike = Readonly<Record<string, string | undefined>>;

export class EvaluationRuntimeConfigError extends Error {
  constructor(message: string) {
    super(`[EVAL_RUNTIME_CONFIG] ${message}`);
    this.name = "EvaluationRuntimeConfigError";
  }
}

export interface EvaluationRuntimeConfig {
  model: string;
  adjudicationMode: ExternalAdjudicationMode;
  openaiApiKey?: string;
  perplexityApiKey?: string;
  evalDebugEnabled: boolean;
  minManuscriptWords: number;
  staleRunningMinutes: number;
  contextContaminationGuardEnabled: boolean;
  pass: {
    pass1MaxTokens: number;
    pass2MaxTokens: number;
    pass3MaxTokens: number;
    pass3PromptMaxChars: number;
    inputCharBudget: number;
    synthesisRefCharBudget: number;
  };
  worker: {
    batchSize: number;
    leaseMs: number;
    maxExecutionMs: number;
    allowDevServiceRole: boolean;
  };
  auth: {
    cronSecret: string;
  };
  platform: {
    nodeEnv: string;
    vercel: boolean;
    vercelEnv?: string;
    hostname?: string;
  };
  timeouts: EvaluationTimeoutConfig;
}

function parseStrictInteger(raw: string, name: string): number {
  const trimmed = raw.trim();
  if (!/^-?\d+$/u.test(trimmed)) {
    throw new EvaluationRuntimeConfigError(
      `${name} must be an integer string, got ${JSON.stringify(raw)}`,
    );
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    throw new EvaluationRuntimeConfigError(
      `${name} must be a finite integer, got ${JSON.stringify(raw)}`,
    );
  }

  return parsed;
}

function parseBoundedInteger(
  env: EnvLike,
  name: string,
  options: { defaultValue: number; min: number; max: number },
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") {
    return options.defaultValue;
  }

  const parsed = parseStrictInteger(raw, name);
  if (parsed < options.min || parsed > options.max) {
    throw new EvaluationRuntimeConfigError(
      `${name} must be between ${options.min} and ${options.max}, got ${parsed}`,
    );
  }

  return parsed;
}

function parseAdjudicationMode(env: EnvLike): ExternalAdjudicationMode {
  const raw = (env.EVAL_EXTERNAL_ADJUDICATION_MODE ?? "optional").trim().toLowerCase();
  if (raw === "optional" || raw === "required" || raw === "veto") {
    return raw;
  }

  throw new EvaluationRuntimeConfigError(
    `EVAL_EXTERNAL_ADJUDICATION_MODE must be one of "optional", "required", "veto"; got ${JSON.stringify(raw)}`,
  );
}

function parseModel(env: EnvLike): string {
  const model = (env.EVAL_OPENAI_MODEL ?? "o3").trim();
  if (!model) {
    throw new EvaluationRuntimeConfigError(
      "EVAL_OPENAI_MODEL is set but empty. Remove it or provide a valid model name.",
    );
  }
  return model;
}

export function resolveEvaluationRuntimeConfig(
  env: EnvLike = process.env,
  timeoutBaseline?: TimeoutBaseline,
): EvaluationRuntimeConfig {
  const timeouts = resolveEvaluationTimeoutConfig(env, timeoutBaseline);
  assertEvalTimeoutConfig(env, timeoutBaseline);

  const model = parseModel(env);
  const adjudicationMode = parseAdjudicationMode(env);

  const pass1MaxTokens = parseBoundedInteger(env, "EVAL_PASS1_MAX_TOKENS", {
    defaultValue: 3500,
    min: 1000,
    max: 8000,
  });
  const pass2MaxTokens = parseBoundedInteger(env, "EVAL_PASS2_MAX_TOKENS", {
    defaultValue: 3500,
    min: 1000,
    max: 8000,
  });
  const pass3MaxTokens = parseBoundedInteger(env, "EVAL_PASS3_MAX_TOKENS", {
    defaultValue: 5000,
    min: 2000,
    max: 20000,
  });
  const pass3PromptMaxChars = parseBoundedInteger(env, "EVAL_PASS3_PROMPT_MAX_CHARS", {
    defaultValue: 40000,
    min: 8000,
    max: 120000,
  });
  const inputCharBudget = parseBoundedInteger(env, "EVAL_PIPELINE_INPUT_CHAR_BUDGET", {
    defaultValue: 50000,
    min: 12000,
    max: 100000,
  });
  const synthesisRefCharBudget = parseBoundedInteger(
    env,
    "EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET",
    {
      defaultValue: 18000,
      min: 4000,
      max: 50000,
    },
  );

  const batchSize = parseBoundedInteger(env, "EVAL_WORKER_BATCH_SIZE", {
    defaultValue: 5,
    min: 1,
    max: 5,
  });
  const leaseMs = parseBoundedInteger(env, "EVAL_WORKER_LEASE_MS", {
    defaultValue: 180000,
    min: 30000,
    max: 180000,
  });
  const maxExecutionMs = parseBoundedInteger(env, "EVAL_WORKER_MAX_EXECUTION_MS", {
    defaultValue: 55000,
    min: 10000,
    max: 295000,
  });

  if (leaseMs < maxExecutionMs) {
    throw new EvaluationRuntimeConfigError(
      `Invalid worker timing: EVAL_WORKER_LEASE_MS (${leaseMs}) must be >= EVAL_WORKER_MAX_EXECUTION_MS (${maxExecutionMs})`,
    );
  }

  const openaiApiKey = env.OPENAI_API_KEY?.trim() || undefined;
  const perplexityApiKey = env.PERPLEXITY_API_KEY?.trim() || undefined;
  if ((adjudicationMode === "required" || adjudicationMode === "veto") && !perplexityApiKey) {
    throw new EvaluationRuntimeConfigError(
      `PERPLEXITY_API_KEY is required when EVAL_EXTERNAL_ADJUDICATION_MODE=${adjudicationMode}`,
    );
  }

  const nodeEnv = (env.NODE_ENV ?? "development").trim() || "development";

  return {
    model,
    adjudicationMode,
    openaiApiKey,
    perplexityApiKey,
    evalDebugEnabled: env.EVAL_DEBUG === "1",
    minManuscriptWords: (() => {
      const minWordsRaw = env.EVAL_MIN_MANUSCRIPT_WORDS;
      if (minWordsRaw && minWordsRaw.trim() !== "") {
        return parseBoundedInteger(env, "EVAL_MIN_MANUSCRIPT_WORDS", {
          defaultValue: 200,
          min: 0,
          max: 20000,
        });
      }

      const minCharsRaw = env.EVAL_MIN_MANUSCRIPT_CHARS;
      if (minCharsRaw && minCharsRaw.trim() !== "") {
        const chars = parseBoundedInteger(env, "EVAL_MIN_MANUSCRIPT_CHARS", {
          defaultValue: 1000,
          min: 0,
          max: 1_000_000,
        });
        return Math.ceil(chars / 5);
      }

      return 200;
    })(),
    staleRunningMinutes: parseBoundedInteger(env, "EVAL_STALE_RUNNING_MINUTES", {
      defaultValue: 10,
      min: 1,
      max: 240,
    }),
    contextContaminationGuardEnabled: (() => {
      const raw = (env.EVAL_CONTEXT_CONTAMINATION_GUARD ?? "auto").trim().toLowerCase();
      if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") {
        return true;
      }
      if (raw === "false" || raw === "0" || raw === "no" || raw === "off") {
        return false;
      }
      return nodeEnv === "production";
    })(),
    pass: {
      pass1MaxTokens,
      pass2MaxTokens,
      pass3MaxTokens,
      pass3PromptMaxChars,
      inputCharBudget,
      synthesisRefCharBudget,
    },
    worker: {
      batchSize,
      leaseMs,
      maxExecutionMs,
      allowDevServiceRole: env.WORKER_ALLOW_SERVICE_ROLE_DEV === "1",
    },
    auth: {
      cronSecret: env.CRON_SECRET || "",
    },
    platform: {
      nodeEnv,
      vercel: env.VERCEL === "1" || !!env.VERCEL_ENV,
      vercelEnv: env.VERCEL_ENV,
      hostname: env.HOSTNAME,
    },
    timeouts,
  };
}

let cachedRuntimeConfig: EvaluationRuntimeConfig | undefined;

export function getEvaluationRuntimeConfig(): EvaluationRuntimeConfig {
  if (!cachedRuntimeConfig) {
    cachedRuntimeConfig = resolveEvaluationRuntimeConfig(process.env);
  }
  return cachedRuntimeConfig;
}

export function resetEvaluationRuntimeConfigCacheForTests(): void {
  cachedRuntimeConfig = undefined;
}
