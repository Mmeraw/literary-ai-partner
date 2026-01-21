/**
 * Production Safety Guards
 * 
 * Ensures the system fails fast on misconfigurations
 * rather than silently degrading at scale.
 */

import { errorLog } from "./logging";

/**
 * Prevents memory store usage in production
 * Memory store is for tests/dev only - not concurrent-safe or durable
 */
export function assertNotProductionMemoryStore() {
  const isProduction = process.env.NODE_ENV === "production";
  const useSupabase = process.env.USE_SUPABASE_JOBS === "true";
  
  if (isProduction && !useSupabase) {
    errorLog("FATAL: Memory job store cannot be used in production");
    errorLog("Set USE_SUPABASE_JOBS=true or change NODE_ENV");
    throw new Error(
      "Memory job store is not production-safe. " +
      "Use Supabase/Postgres-backed store for concurrent-safe, durable job storage."
    );
  }
}

/**
 * Rate limit configuration for 100k-user scale
 */
export const RATE_LIMITS = {
  // Jobs per user per hour
  JOB_CREATION_PER_HOUR: 10,
  
  // Max manuscript size (bytes) - prevents abuse
  MAX_MANUSCRIPT_SIZE: 5 * 1024 * 1024, // 5MB
  
  // Polling backoff thresholds
  POLLING_FAST_UNTIL_SECONDS: 30,  // 2s polling for first 30s
  POLLING_MEDIUM_UNTIL_SECONDS: 120, // 5s polling 30s-2min
  POLLING_SLOW_SECONDS: 10,         // 10s polling after 2min
} as const;
