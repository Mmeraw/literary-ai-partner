#!/usr/bin/env node

/**
 * Production Environment Validation
 * Ensures 100k-user scale configuration is correct before deployment
 */

import fs from "node:fs";
import path from "node:path";

// Inline validation to avoid TypeScript import issues during pre-build
function validateProductionConfig() {
  const errors = [];
  const warnings = [];
  
  const isProduction = process.env.NODE_ENV === "production";
  const useSupabase = process.env.USE_SUPABASE_JOBS === "true";
  
  // Critical: Memory store cannot be used in production
  if (isProduction && !useSupabase) {
    errors.push(
      "Memory job store is not production-safe. Set USE_SUPABASE_JOBS=true for 100k-user scale."
    );
  }
  
  // Warnings for missing Supabase config (non-blocking for dev)
  if (useSupabase && !process.env.SUPABASE_URL) {
    warnings.push("SUPABASE_URL is not set but USE_SUPABASE_JOBS=true");
  }
  
  if (useSupabase && !process.env.SUPABASE_ANON_KEY) {
    warnings.push("SUPABASE_ANON_KEY is not set but USE_SUPABASE_JOBS=true");
  }

  const parseIntEnv = (name, fallback) => {
    const raw = process.env[name];
    const parsed = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  // Canonical timeout invariant: OpenAI timeout must not be lower than pass timeout.
  const passTimeoutMs = parseIntEnv("EVAL_PASS_TIMEOUT_MS", 180000);
  const openAiTimeoutMs = parseIntEnv("EVAL_OPENAI_TIMEOUT_MS", 180000);
  if (openAiTimeoutMs < passTimeoutMs) {
    errors.push(
      `EVAL_OPENAI_TIMEOUT_MS (${openAiTimeoutMs}) must be >= EVAL_PASS_TIMEOUT_MS (${passTimeoutMs}).`,
    );
  }

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
        .map((cron) => String(cron?.path ?? ""))
        .filter((p) => /\bsecret=|\$CRON_SECRET|CRON_SECRET/i.test(p));

      if (secretPaths.length > 0) {
        errors.push(
          `vercel.json contains cron paths with secrets in query string: ${secretPaths.join(", ")}. Remove secrets from URLs.`,
        );
      }
    } catch (error) {
      errors.push(`vercel.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

console.log("🔍 Validating production configuration for 100k-user scale...\n");

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
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}`);
  console.log("\n");
  
  process.exit(0);
} else {
  console.error("❌ Production configuration validation FAILED");
  console.error("Fix the errors above before deploying to production.\n");
  process.exit(1);
}
