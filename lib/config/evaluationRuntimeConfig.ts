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

export interface EvaluationPassRouting {
  /** Resolved model for Pass 1 chunk evaluation. */
  pass1Model: string;
  /** Resolved model for Pass 2 chunk evaluation. */
  pass2Model: string;
  /** Resolved model for Pass 3 synthesis. */
  pass3Model: string;
  /** Resolved fallback model when Pass 3 primary route fails. */
  pass3FallbackModel: string;
}

export interface EvaluationRuntimeConfig {
  model: string;
  adjudicationMode: ExternalAdjudicationMode;
  openaiApiKey?: string;
  perplexityApiKey?: string;
  evalDebugEnabled: boolean;
  minManuscriptWords: number;
  staleRunningMinutes: number;
  frozenHeartbeatSecs: number;
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
  /** Resolved per-pass model routing. Single canonical source of truth. */
  routing: EvaluationPassRouting;
}

export type TimeoutScopeInputScale =
  | "micro_excerpt"
  | "light_chapter"
  | "standard_chapter"
  | "multi_chapter"
  | "full_manuscript";

export const LONG_FORM_TIMEOUT_FLOOR_MS = 720_000;

export interface ScopedTimeoutResolution {
  inputScale: TimeoutScopeInputScale;
  floorMs: number;
  floorApplied: boolean;
  basePassTimeoutMs: number;
  baseOpenAiTimeoutMs: number;
  passTimeoutMs: number;
  openAiTimeoutMs: number;
  /** Number of chunks used to scale the timeout, if chunk-aware scaling was applied. */
  chunkScaledFrom?: number;
}

function isLongFormTimeoutScale(inputScale: TimeoutScopeInputScale): boolean {
  return inputScale === "multi_chapter" || inputScale === "full_manuscript";
}

export function resolveScopedEvaluationTimeouts(args: {
  inputScale: TimeoutScopeInputScale;
  passTimeoutMs: number;
  openAiTimeoutMs: number;
  floorMs?: number;
  /**
   * Expected chunk count for the job. When provided and > 1, the pass timeout
   * is scaled up so that a full chunk sweep at concurrency=8 and a conservative
   * avg of 30s/chunk still fits within the budget:
   *   scaled = BASE_MS + PER_CHUNK_MS * chunkCount
   * Capped at MAX_CHUNK_SCALED_PASS_TIMEOUT_MS.
   */
  expectedChunks?: number;
}): ScopedTimeoutResolution {
  const floorMs = args.floorMs ?? LONG_FORM_TIMEOUT_FLOOR_MS;
  const longFormScale = isLongFormTimeoutScale(args.inputScale);

  // --- Chunk-count-aware timeout scaling -----------------------------------
  // For long-form jobs the flat 720s floor is insufficient when chunk counts
  // grow. With concurrency=8 and avg 30s/chunk:
  //   ceil(52/8) * 30_000 = 7 * 30_000 = 210_000ms  → fits in 720s
  //   ceil(72/8) * 30_000 = 9 * 30_000 = 270_000ms  → fits in 720s
  // But a single rate-limit stall or slow provider response can push any
  // chunk well past 30s. The chunk-scaled timeout adds a per-chunk buffer:
  //   scaled = 300_000 (base) + 12_000 (per chunk) * N
  //   @ N=52: 300_000 + 624_000 = 924_000ms (~15.4 min)
  //   @ N=72: 300_000 + 864_000 = 1_164_000ms (~19.4 min)
  // This keeps the budget proportional to the workload instead of fixed.
  const CHUNK_SCALE_BASE_MS = 300_000;
  const CHUNK_SCALE_PER_CHUNK_MS = 12_000;
  const MAX_CHUNK_SCALED_PASS_TIMEOUT_MS = 1_800_000; // 30 min hard ceiling

  let chunkScaledFrom: number | undefined;
  let effectiveFloor = floorMs;

  if (
    longFormScale &&
    typeof args.expectedChunks === "number" &&
    args.expectedChunks > 1
  ) {
    const chunkScaled = Math.min(
      CHUNK_SCALE_BASE_MS + CHUNK_SCALE_PER_CHUNK_MS * args.expectedChunks,
      MAX_CHUNK_SCALED_PASS_TIMEOUT_MS,
    );
    if (chunkScaled > effectiveFloor) {
      effectiveFloor = chunkScaled;
      chunkScaledFrom = args.expectedChunks;
    }
  }

  const passTimeoutMs = longFormScale
    ? Math.max(args.passTimeoutMs, effectiveFloor)
    : args.passTimeoutMs;

  // Keep provider timeout >= pass timeout after scoped floor application.
  const openAiTimeoutMs = longFormScale
    ? Math.max(args.openAiTimeoutMs, passTimeoutMs, effectiveFloor)
    : args.openAiTimeoutMs;

  return {
    inputScale: args.inputScale,
    floorMs: effectiveFloor,
    floorApplied: passTimeoutMs !== args.passTimeoutMs || openAiTimeoutMs !== args.openAiTimeoutMs,
    basePassTimeoutMs: args.passTimeoutMs,
    baseOpenAiTimeoutMs: args.openAiTimeoutMs,
    passTimeoutMs,
    openAiTimeoutMs,
    ...(chunkScaledFrom !== undefined ? { chunkScaledFrom } : {}),
  };
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
    defaultValue: 8000,
    min: 1000,
    max: 16000,
  });
  const pass2MaxTokens = parseBoundedInteger(env, "EVAL_PASS2_MAX_TOKENS", {
    defaultValue: 8000,
    min: 1000,
    max: 16000,
  });
  const pass3MaxTokens = parseBoundedInteger(env, "EVAL_PASS3_MAX_TOKENS", {
      defaultValue: 20000,
    min: 2000,
    max: 30000,
  });
  const pass3PromptMaxChars = parseBoundedInteger(env, "EVAL_PASS3_PROMPT_MAX_CHARS", {
    // Raised from 40k/120k: Pass 3 now receives the full manuscript reference
    // window (up to 400k chars) so the tripwire must accommodate full novels.
    // gpt-5 context window supports this comfortably.
    defaultValue: 500000,
    min: 8000,
    max: 1000000,
  });
  const inputCharBudget = envContract.inputCharBudget;
  const synthesisRefCharBudget = envContract.synthesisRefCharBudget;

  const batchSize = parseBoundedInteger(env, "EVAL_WORKER_BATCH_SIZE", {
    defaultValue: 5,
    min: 1,
    max: 5,
  });
  const leaseMs = parseBoundedInteger(env, "EVAL_WORKER_LEASE_MS", {
    defaultValue: 800000,
    min: 30000,
    max: 800000,
  });
  const maxExecutionMs = parseBoundedInteger(env, "EVAL_WORKER_MAX_EXECUTION_MS", {
    defaultValue: 800000,
    min: 10000,
    max: 800000,
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

  // Resolve per-pass routing from env vars. Uses the same priority chain as policy.ts
  // model resolvers but without the circular import (policy.ts imports this module).
  function resolvePassModel(envKeys: string[]): string {
    for (const key of envKeys) {
      const v = env[key];
      if (typeof v === "string" && v.trim().length > 0) return v.trim();
    }
    return model;
  }

  const pass1Model = resolvePassModel(["EVAL_PASS1_MODEL", "EVAL_CHUNK_MODEL"]);
  const pass2Model = resolvePassModel(["EVAL_PASS2_MODEL", "EVAL_CHUNK_MODEL"]);
  const pass3Model = resolvePassModel(["EVAL_PASS3_MODEL", "EVAL_SYNTHESIS_MODEL"]);
  const pass3FallbackModel = resolvePassModel(["EVAL_PASS3_FALLBACK_MODEL", "EVAL_PASS3_MODEL", "EVAL_SYNTHESIS_MODEL"]);

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
    // Default raised from 10 → 13: Vercel Pro/Enterprise fluid-compute hard ceiling
    // is 800s (13m 20s). A 10-minute default killed legitimate large-manuscript jobs
    // (40–48 chunks) before the Vercel function wall clock was reached. 13 minutes
    // gives the full function budget while still catching truly crashed jobs before
    // the next cron tick (~15 min cadence).
    staleRunningMinutes: parseBoundedInteger(env, "EVAL_STALE_RUNNING_MINUTES", {
      defaultValue: 13,
      min: 1,
      max: 240,
    }),
    // Fast-fail: jobs whose leaseRenewalLoop stopped firing (Vercel fluid-compute freeze).
    // If last_heartbeat_at is older than this many seconds, the function is frozen — kill it.
    // Default 60s: heartbeat fires every 30s, so two missed beats = frozen.
    frozenHeartbeatSecs: parseBoundedInteger(env, "EVAL_FROZEN_HEARTBEAT_SECS", {
      defaultValue: 60,
      min: 35,
      max: 300,
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
    routing: {
      pass1Model,
      pass2Model,
      pass3Model,
      pass3FallbackModel,
    },
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
