/**
 * Job System Configuration
 * 
 * Central configuration and startup validation for job system.
 * Imported by all job routes to enforce security invariants.
 */

// SECURITY: Production fail-safe - prevent auth bypass in production
if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
  if (process.env.ALLOW_HEADER_USER_ID === "true") {
    throw new Error(
      "SECURITY VIOLATION: ALLOW_HEADER_USER_ID must never be enabled in production. " +
      "This setting bypasses authentication and is only permitted in CI/dev environments."
    );
  }
}

// Export flag for runtime checks
export const ALLOW_HEADER_USER_ID = process.env.ALLOW_HEADER_USER_ID === "true";

// Log configuration on startup (non-production only)
if (process.env.NODE_ENV !== "production") {
  console.log("[Job System Config]", {
    USE_SUPABASE_JOBS: process.env.USE_SUPABASE_JOBS,
    ALLOW_HEADER_USER_ID,
    NODE_ENV: process.env.NODE_ENV,
  });
}
