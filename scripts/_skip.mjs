#!/usr/bin/env node
/**
 * Centralized environment detection and skip logic for job system tests
 * 
 * Provides audit-grade skip messages and consistent behavior across all smoke tests.
 */

/**
 * Check if we're in memory mode (no Supabase + no worker)
 * @returns {boolean}
 */
export function isMemoryMode() {
  return process.env.USE_SUPABASE_JOBS === "false";
}

/**
 * Skip test with standardized message and successful exit
 * Use for tests that require infrastructure not available in current mode
 * 
 * @param {string} testName - Name of the test being skipped
 * @param {string} reason - Why the test is being skipped
 */
export function skipTest(testName, reason) {
  console.log(`⚠️  SKIP: ${testName}`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Mode: USE_SUPABASE_JOBS=${process.env.USE_SUPABASE_JOBS || 'not set'}`);
  console.log(`✅ Skip is intentional and expected for this environment`);
  process.exit(0);
}

/**
 * Skip if in memory mode with standardized message
 * 
 * @param {string} testName - Name of the test
 * @param {string} requirement - What infrastructure is required
 */
export function skipIfMemoryMode(testName, requirement) {
  if (isMemoryMode()) {
    skipTest(
      testName,
      `Memory mode detected; requires ${requirement}`
    );
  }
}
