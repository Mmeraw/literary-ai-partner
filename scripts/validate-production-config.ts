#!/usr/bin/env tsx

/**
 * Production Environment Validation
 * Ensures 100k-user scale configuration is correct before deployment
 */

import fs from "node:fs";
import path from "node:path";
import {
  formatTimeoutResolutionSummary,
  readLocalTimeoutBaseline,
  resolveEvaluationTimeoutConfig,
} from "../lib/config/evaluationTimeouts";

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  timeoutConfig: ReturnType<typeof resolveEvaluationTimeoutConfig>;
};

function validateProductionConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";
  const useSupabase = process.env.USE_SUPABASE_JOBS === "true";

  // Critical: Memory store cannot be used in production
  if (isProduction && !useSupabase) {
    errors.push(
      "Memory job store is not production-safe. Set USE_SUPABASE_JOBS=true for 100k-user scale.",
    );
  }

  // Warnings for missing Supabase config (non-blocking for dev)
  if (useSupabase && !process.env.SUPABASE_URL) {
    warnings.push("SUPABASE_URL is not set but USE_SUPABASE_JOBS=true");
  }

  if (useSupabase && !process.env.SUPABASE_ANON_KEY) {
    warnings.push("SUPABASE_ANON_KEY is not set but USE_SUPABASE_JOBS=true");
  }

  const timeoutBaseline = readLocalTimeoutBaseline(process.cwd());
  const timeoutConfig = resolveEvaluationTimeoutConfig(process.env, timeoutBaseline);

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

  // Canonical timeout invariant: OpenAI timeout must not be lower than pass timeout.
  const passTimeoutMs = timeoutConfig.passTimeout.valueMs;
  const openAiTimeoutMs = timeoutConfig.openAiTimeout.valueMs;
  if (openAiTimeoutMs < passTimeoutMs) {
    errors.push(
      `EVAL_OPENAI_TIMEOUT_MS (${openAiTimeoutMs}) must be >= EVAL_PASS_TIMEOUT_MS (${passTimeoutMs}). ${formatTimeoutResolutionSummary(timeoutConfig)}`,
    );
  }

  const parseIntEnv = (name: string, fallback: number) => {
    const raw = process.env[name];
    const parsed = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  // Worker envelope checks (bounded for route runtime safety).
  const workerBatchSize = parseIntEnv("EVAL_WORKER_BATCH_SIZE", 5);
  if (workerBatchSize < 1 || workerBatchSize > 5) {
    errors.push(`EVAL_WORKER_BATCH_SIZE (${workerBatchSize}) must be between 1 and 5.`);
  }

  const workerLeaseMs = parseIntEnv("EVAL_WORKER_LEASE_MS", 180000);
  if (workerLeaseMs < 30000 || workerLeaseMs > 180000) {
    errors.push(`EVAL_WORKER_LEASE_MS (${workerLeaseMs}) must be between 30000 and 180000.`);
  }

  const workerMaxExecutionMs = parseIntEnv("EVAL_WORKER_MAX_EXECUTION_MS", 55000);
  if (workerMaxExecutionMs < 10000 || workerMaxExecutionMs > 295000) {
    errors.push(
      `EVAL_WORKER_MAX_EXECUTION_MS (${workerMaxExecutionMs}) must be between 10000 and 295000.`,
    );
  }

  // Prevent secrets in Vercel cron paths (no query-string secrets)
  const vercelConfigPath = path.join(process.cwd(), "vercel.json");
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

console.log("🔍 Validating production configuration for 100k-user scale...\n");
console.log("Timeout precedence for evaluation timeout vars: .env.local > .env > built-in defaults; conflicting exported shell values are ignored with warnings.\n");

const result = validateProductionConfig();

if (result.errors.length > 0) {
  console.error("❌ CRITICAL ERRORS - Deployment blocked:\n");
  result.errors.forEach((error, i) => {
    console.error(`   ${i + 1}. ${error}`);
  });
  console.error("\n");
}

if (result.warnings.length > 0) {
  console.warn("⚠️  WARNINGS - Non-critical but recommended:\n");
  result.warnings.forEach((warning, i) => {
    console.warn(`   ${i + 1}. ${warning}`);
  });
  console.warn("\n");
}

if (result.valid) {
  console.log("✅ Production configuration is valid\n");

  console.log("📊 Configuration Summary:");
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   USE_SUPABASE_JOBS: ${process.env.USE_SUPABASE_JOBS}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? "✓ Set" : "✗ Missing"}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? "✓ Set" : "✗ Missing"}`);
  console.log(`   Timeouts: ${formatTimeoutResolutionSummary(result.timeoutConfig)}`);
  console.log("\n");

  process.exit(0);
} else {
  console.error("❌ Production configuration validation FAILED");
  console.error("Fix the errors above before deploying to production.\n");
  process.exit(1);
}