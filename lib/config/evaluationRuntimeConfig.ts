import "server-only";

import {
  assertEvalTimeoutConfig,
  resolveEvaluationTimeoutConfig,
  type EvaluationTimeoutConfig,
  type TimeoutBaseline,
} from "@/lib/config/evaluationTimeouts";
import {
  resolveEvalEnvContract,
  type AdjudicationMode,
  type NodeEnv,
} from "@/lib/config/envContract";

export type ExternalAdjudicationMode = AdjudicationMode;

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
    disabled: boolean;
  };
  auth: {
    cronSecret: string;
  };
  platform: {
    nodeEnv: NodeEnv;
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


export function resolveEvaluationRuntimeConfig(
  env: EnvLike = process.env,
  timeoutBaseline?: TimeoutBaseline,
): EvaluationRuntimeConfig {
  const timeouts = resolveEvaluationTimeoutConfig(env, timeoutBaseline);
  assertEvalTimeoutConfig(env, timeoutBaseline);

  let envContract: ReturnType<typeof resolveEvalEnvContract>;
  try {
    envContract = resolveEvalEnvContract(env as NodeJS.ProcessEnv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new EvaluationRuntimeConfigError(`env contract validation failed: ${message}`);
  }

  const model = envContract.openAiModel;
  const adjudicationMode = envContract.adjudicationMode;

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
      defaultValue: 16000,
    min: 2000,
    max: 20000,
  });
  const pass3PromptMaxChars = parseBoundedInteger(env, "EVAL_PASS3_PROMPT_MAX_CHARS", {
    defaultValue: 40000,
    min: 8000,
    max: 120000,
  });
  const inputCharBudget = envContract.inputCharBudget;
  const synthesisRefCharBudget = envContract.synthesisRefCharBudget;

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
    max: 180000,
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

  const nodeEnv = envContract.nodeEnv;

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
      disabled: env.EVAL_WORKER_DISABLED === "true" || env.EVAL_WORKER_DISABLED === "1",
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
