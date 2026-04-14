/**
 * Canonical lease-timeout policy for job phase execution.
 *
 * Env precedence:
 * 1) JOB_PHASE_LEASE_TIMEOUT_SECONDS
 * 2) JOB_LEASE_TIMEOUT_SECONDS (legacy compatibility)
 * 3) default 300s
 *
 * Clamped to [30s, 900s] for safety.
 */
export function getLeaseTimeoutSeconds(): number {
  const raw =
    process.env.JOB_PHASE_LEASE_TIMEOUT_SECONDS ??
    process.env.JOB_LEASE_TIMEOUT_SECONDS ??
    "300";

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return 300;
  }

  return Math.min(900, Math.max(30, parsed));
}
/**
 * Job System Configuration
 *
 * Central configuration and startup validation for job system.
 * Imported by lib/jobs/rateLimiter.ts to enforce security globally.
 *
 * Guard logic is exported (as _test helpers) so it can be unit-tested
 * without side effects.  See __tests__/lib/jobs/config.test.ts
 */

// SECURITY: Production fail-safe - prevent auth bypass in production runtime
// Only throw during actual production runtime, not during Next.js build phase
// and not during CI evidence runs (GitHub Actions sets CI=true)
const nextPhase = process.env.NEXT_PHASE;
const isNextBuild = nextPhase === "phase-production-build";
const isCI = process.env.CI === "true";
const isProdRuntime = process.env.NODE_ENV === "production" && !isNextBuild && !isCI;

if (isProdRuntime && process.env.ALLOW_HEADER_USER_ID === "true") {
  throw new Error(
    "SECURITY VIOLATION: ALLOW_HEADER_USER_ID must never be enabled in production. " +
    "This setting bypasses authentication and is only permitted in CI/dev environments. " +
    `[NODE_ENV=${process.env.NODE_ENV}, NEXT_PHASE=${nextPhase ?? "(unset)"}, ` +
    `CI=${process.env.CI ?? "(unset)"}, ALLOW_HEADER_USER_ID=${process.env.ALLOW_HEADER_USER_ID}]`
  );
}

// Export flag for runtime checks
export const ALLOW_HEADER_USER_ID = process.env.ALLOW_HEADER_USER_ID === "true";

// Export guard computation for unit testing (prefixed with _test)
export const _test = { isProdRuntime, isNextBuild, isCI } as const;

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
    CI: process.env.CI,
  });
}
