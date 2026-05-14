#!/usr/bin/env tsx

/**
 * Production Environment Validation
 * Ensures 100k-user scale configuration is correct before deployment
 */

import { formatTimeoutResolutionSummary } from "../lib/config/evaluationTimeouts";
import { validateProductionConfig } from "../lib/config/productionConfigValidation";

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
  console.log(`   VERCEL_ENV: ${process.env.VERCEL_ENV}`);
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