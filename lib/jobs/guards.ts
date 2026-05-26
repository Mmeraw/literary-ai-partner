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
  // Jobs per user per hour (authenticated users)
  JOB_CREATION_PER_HOUR: 10,
  
  // Max concurrent active jobs per user
  MAX_CONCURRENT_JOBS: 5,
  
  // IP-based limit (anonymous/fallback) - requests per hour
  IP_REQUESTS_PER_HOUR: 20,
  
  // Max manuscript size (bytes) - prevents abuse
  // 5MB covers most manuscripts (avg novel ~400KB, large screenplay ~2MB)
  MAX_MANUSCRIPT_SIZE: 5 * 1024 * 1024, // 5MB
  
  // Polling backoff thresholds (client-side)
  POLLING_FAST_UNTIL_SECONDS: 30,  // 2s polling for first 30s
  POLLING_MEDIUM_UNTIL_SECONDS: 120, // 5s polling 30s-2min
  POLLING_SLOW_UNTIL_SECONDS: 600,  // 10s polling 2min-10min
  POLLING_SLOWEST_SECONDS: 30,      // 30s polling after 10min
} as const;

/**
 * Validates production environment configuration
 * Ensures all required settings are present for 100k-user scale
 */
export function validateProductionConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const isProduction = process.env.NODE_ENV === "production";
  
  if (isProduction) {
    // Critical: Database backing required
    if (process.env.USE_SUPABASE_JOBS !== "true") {
      errors.push("USE_SUPABASE_JOBS must be 'true' in production");
    }
    
    // Critical: Supabase connection.
    // NEXT_PUBLIC_SUPABASE_URL is the canonical client-facing name (required by Next.js
    // for browser bundle inclusion). SUPABASE_URL is the server-side alias — admin.ts
    // reads whichever is present via `NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL`.
    // Guard on NEXT_PUBLIC_SUPABASE_URL as the single source of truth here; if it's
    // missing the client bundle is broken regardless of SUPABASE_URL.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push("NEXT_PUBLIC_SUPABASE_URL is required in production");
    }

    // NEXT_PUBLIC_SUPABASE_ANON_KEY is the canonical client-facing name.
    // SUPABASE_ANON_KEY is the server-side alias. Same reasoning as above.
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production");
    }
    
    // Warning: Rate limiting works better with these
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push("SUPABASE_SERVICE_ROLE_KEY recommended for admin operations");
    }
    
    // Warning: Authentication integration
    if (!process.env.NEXTAUTH_SECRET && !process.env.SUPABASE_JWT_SECRET) {
      warnings.push("Authentication secret not configured - rate limiting will use IP-based fallback");
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
