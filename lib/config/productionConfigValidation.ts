import fs from "node:fs";
import path from "node:path";
import {
  formatTimeoutResolutionSummary,
  readLocalTimeoutBaseline,
  resolveEvaluationTimeoutConfig,
} from "@/lib/config/evaluationTimeouts";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  timeoutConfig: ReturnType<typeof resolveEvaluationTimeoutConfig>;
};

const WORKER_BATCH_SIZE_MIN = 1;
const WORKER_BATCH_SIZE_MAX = 5;
const WORKER_LEASE_MS_MIN = 30_000;
const WORKER_LEASE_MS_MAX = 180_000;
const WORKER_MAX_EXECUTION_MS_MIN = 10_000;
const WORKER_MAX_EXECUTION_MS_MAX = WORKER_LEASE_MS_MAX;

function parseIntEnv(env: NodeJS.ProcessEnv, name: string, fallback: number) {
  const raw = env[name];
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function validateProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = env.NODE_ENV === "production";
  const useSupabase = env.USE_SUPABASE_JOBS === "true";

  if (isProduction && !useSupabase) {
    errors.push(
      "Memory job store is not production-safe. Set USE_SUPABASE_JOBS=true for 100k-user scale.",
    );
  }

  if (useSupabase && !env.SUPABASE_URL) {
    warnings.push("SUPABASE_URL is not set but USE_SUPABASE_JOBS=true");
  }

  if (useSupabase && !env.SUPABASE_ANON_KEY) {
    warnings.push("SUPABASE_ANON_KEY is not set but USE_SUPABASE_JOBS=true");
  }

  const timeoutBaseline = readLocalTimeoutBaseline(cwd);
  const timeoutConfig = resolveEvaluationTimeoutConfig(env, timeoutBaseline);

  for (const setting of [timeoutConfig.openAiTimeout, timeoutConfig.passTimeout]) {
    if (setting.reason === "conflicting_env_override" && setting.conflict) {
      warnings.push(
        `[config:validate] ${setting.name}=${JSON.stringify(setting.raw)} conflicts with ${setting.conflict.source}=${JSON.stringify(setting.conflict.raw)}. The evaluation timeout resolver is ignoring the exported shell value and using the local file-backed timeout instead.`,
      );
    }

    if (setting.reason === "malformed_env_fallback") {
      warnings.push(
        `${setting.name} is malformed (${JSON.stringify(setting.raw)}) and fell back to ${setting.valueMs}.`,
      );
    }

    if (setting.reason === "clamped_to_min" || setting.reason === "clamped_to_max") {
      warnings.push(
        `${setting.name}=${JSON.stringify(setting.raw)} was ${setting.reason === "clamped_to_min" ? "below" : "above"} the allowed range and resolved to ${setting.valueMs}.`,
      );
    }
  }

  const passTimeoutMs = timeoutConfig.passTimeout.valueMs;
  const openAiTimeoutMs = timeoutConfig.openAiTimeout.valueMs;
  if (openAiTimeoutMs < passTimeoutMs) {
    errors.push(
      `EVAL_OPENAI_TIMEOUT_MS (${openAiTimeoutMs}) must be >= EVAL_PASS_TIMEOUT_MS (${passTimeoutMs}). ${formatTimeoutResolutionSummary(timeoutConfig)}`,
    );
  }

  const workerBatchSize = parseIntEnv(env, "EVAL_WORKER_BATCH_SIZE", 5);
  if (workerBatchSize < WORKER_BATCH_SIZE_MIN || workerBatchSize > WORKER_BATCH_SIZE_MAX) {
    errors.push(
      `EVAL_WORKER_BATCH_SIZE (${workerBatchSize}) must be between ${WORKER_BATCH_SIZE_MIN} and ${WORKER_BATCH_SIZE_MAX}.`,
    );
  }

  const workerLeaseMs = parseIntEnv(env, "EVAL_WORKER_LEASE_MS", WORKER_LEASE_MS_MAX);
  if (workerLeaseMs < WORKER_LEASE_MS_MIN || workerLeaseMs > WORKER_LEASE_MS_MAX) {
    errors.push(
      `EVAL_WORKER_LEASE_MS (${workerLeaseMs}) must be between ${WORKER_LEASE_MS_MIN} and ${WORKER_LEASE_MS_MAX}.`,
    );
  }

  const workerMaxExecutionMs = parseIntEnv(env, "EVAL_WORKER_MAX_EXECUTION_MS", 55_000);
  if (
    workerMaxExecutionMs < WORKER_MAX_EXECUTION_MS_MIN ||
    workerMaxExecutionMs > WORKER_MAX_EXECUTION_MS_MAX
  ) {
    errors.push(
      `EVAL_WORKER_MAX_EXECUTION_MS (${workerMaxExecutionMs}) must be between ${WORKER_MAX_EXECUTION_MS_MIN} and ${WORKER_MAX_EXECUTION_MS_MAX}.`,
    );
  }

  if (workerLeaseMs < workerMaxExecutionMs) {
    errors.push(
      `Invalid worker timing: EVAL_WORKER_LEASE_MS (${workerLeaseMs}) must be >= EVAL_WORKER_MAX_EXECUTION_MS (${workerMaxExecutionMs}).`,
    );
  }

  const vercelConfigPath = path.join(cwd, "vercel.json");
  if (fs.existsSync(vercelConfigPath)) {
    try {
      const raw = fs.readFileSync(vercelConfigPath, "utf8");
      const parsed = JSON.parse(raw);
      const crons = Array.isArray(parsed?.crons) ? parsed.crons : [];
      const secretPaths = crons
        .map((cron: { path?: unknown }) => String(cron?.path ?? ""))
        .filter((p: string) => /\bsecret=|\$CRON_SECRET|CRON_SECRET/i.test(p));

      if (secretPaths.length > 0) {
        errors.push(
          `vercel.json contains cron paths with secrets in query string: ${secretPaths.join(", ")}. Remove secrets from URLs.`,
        );
      }
    } catch (error) {
      errors.push(
        `vercel.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    timeoutConfig,
  };
}