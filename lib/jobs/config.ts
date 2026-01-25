/**
 * Job System Configuration
 * 
 * Central configuration and startup validation for job system.
 * Imported by lib/jobs/rateLimiter.ts to enforce security globally.
 */

// SECURITY: Production fail-safe - prevent auth bypass in production runtime
// Only throw during actual production runtime, not during Next.js build phase
const nextPhase = process.env.NEXT_PHASE;
const isNextBuild = nextPhase === "phase-production-build";
const isProdRuntime = process.env.NODE_ENV === "production" && !isNextBuild;

if (isProdRuntime && process.env.ALLOW_HEADER_USER_ID === "true") {
  throw new Error(
    "SECURITY VIOLATION: ALLOW_HEADER_USER_ID must never be enabled in production. " +
    "This setting bypasses authentication and is only permitted in CI/dev environments."
  );
}

// Export flag for runtime checks
export const ALLOW_HEADER_USER_ID = process.env.ALLOW_HEADER_USER_ID === "true";

// Log configuration on startup (dev only, not tests or build)
// Silent in: test, production, CI builds
const shouldLogConfig =
  process.env.DEBUG_JOBS_CONFIG === "true" ||
  process.env.NODE_ENV === "development";

if (shouldLogConfig) {
  console.log("[Job System Config]", {
    USE_SUPABASE_JOBS: process.env.USE_SUPABASE_JOBS,
    ALLOW_HEADER_USER_ID,
    NODE_ENV: process.env.NODE_ENV,
  });
}
