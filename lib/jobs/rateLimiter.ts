/**
 * Rate Limiting for 100k-User Scale
 * 
 * Multi-layer protection against abuse and self-DDOS:
 * - Per-user job creation limits
 * - Manuscript size validation
 * - Concurrent job limits per user
 * - IP-based fallback throttling
 */

import { RATE_LIMITS } from "./guards";
import { getSupabaseClient } from "../supabase";

/**
 * In-memory rate limit tracking (for IP-based throttling)
 * In production with multiple instances, consider Redis
 */
const ipRateLimits = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired rate limit entries (called periodically)
 */
function cleanupExpiredRateLimits() {
  const now = Date.now();
  for (const [ip, data] of ipRateLimits.entries()) {
    if (now > data.resetAt) {
      ipRateLimits.delete(ip);
    }
  }
}

// Cleanup interval handle for proper shutdown
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the cleanup interval (called on module load in production)
 * Exposed for proper lifecycle management in tests
 */
export function startCleanupInterval() {
  if (cleanupInterval) return; // Already running
  cleanupInterval = setInterval(cleanupExpiredRateLimits, 5 * 60 * 1000);
}

/**
 * Stop the cleanup interval (for graceful shutdown and tests)
 */
export function stopCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Only start in production (not in test environment)
if (process.env.NODE_ENV !== 'test') {
  startCleanupInterval();
}

/**
 * Rate limit result with reason for observability
 */
export type RateLimitResult = 
  | { allowed: true; reason: "ok" }
  | { allowed: false; reason: string; retryAfter?: number };

/**
 * Extract user ID from request (via auth header, session, etc.)
 * Returns null for anonymous users
 */
function getUserIdFromRequest(req: Request): string | null {
  // TODO: Implement actual auth integration
  // For now, check for a user_id in query params or headers
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    if (userId) return userId;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      // Parse JWT or session token here
      return null; // Placeholder
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extract IP address from request (for IP-based throttling)
 */
function getIpFromRequest(req: Request): string {
  // Check common proxy headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  // Fallback to a generic identifier
  return "unknown";
}

/**
 * Check IP-based rate limits (fallback for anonymous users)
 * Allows 20 requests per hour per IP
 */
function checkIpRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;
  
  const existing = ipRateLimits.get(ip);
  
  if (!existing || now > existing.resetAt) {
    // New window
    ipRateLimits.set(ip, { count: 1, resetAt: now + hourInMs });
    return { allowed: true, reason: "ok" };
  }
  
  if (existing.count >= 20) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return {
      allowed: false,
      reason: "IP rate limit exceeded. Maximum 20 jobs per hour.",
      retryAfter,
    };
  }
  
  existing.count++;
  return { allowed: true, reason: "ok" };
}

/**
 * Check per-user job creation rate limit
 * Queries evaluation_jobs via manuscripts join to get user's jobs
 * 
 * CRITICAL: evaluation_jobs.manuscript_id → manuscripts.id → manuscripts.user_id
 */
async function checkUserJobRateLimit(userId: string): Promise<RateLimitResult> {
  const supabase = getSupabaseClient();
  
  // Production safety: during build or when env vars missing, fail open
  if (!supabase) {
    console.warn("[RATE-LIMIT] Supabase client unavailable, allowing request");
    return { allowed: true, reason: "ok" };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  try {
    // Query: Get user's manuscripts first, then count their jobs
    // evaluation_jobs doesn't have user_id directly - must join through manuscripts
    const { data: manuscripts, error: manuError } = await supabase
      .from("manuscripts")
      .select("id")
      .eq("user_id", userId);

    if (manuError) {
      console.error("[RATE-LIMIT] Error fetching user manuscripts:", manuError);
      // Fail open - allow request but log for monitoring
      return { allowed: true, reason: "ok" };
    }

    if (!manuscripts || manuscripts.length === 0) {
      // No manuscripts = no jobs possible yet, allow
      return { allowed: true, reason: "ok" };
    }

    const manuscriptIds = manuscripts.map(m => m.id);

    // Count jobs for user's manuscripts in the last hour
    const { count, error } = await supabase
      .from("evaluation_jobs")
      .select("id", { count: "exact", head: true })
      .in("manuscript_id", manuscriptIds)
      .gte("created_at", oneHourAgo);
    
    if (error) {
      console.error("[RATE-LIMIT] Error counting jobs:", error);
      // Fail open on DB errors (but log for monitoring)
      return { allowed: true, reason: "ok" };
    }
    
    if ((count ?? 0) >= RATE_LIMITS.JOB_CREATION_PER_HOUR) {
      return {
        allowed: false,
        reason: `Rate limit exceeded. Maximum ${RATE_LIMITS.JOB_CREATION_PER_HOUR} jobs per hour.`,
        retryAfter: 3600,
      };
    }
    
    return { allowed: true, reason: "ok" };
  } catch (err) {
    console.error("[RATE-LIMIT] Exception during rate check:", err);
    // Fail open on exceptions - never block requests due to internal errors
    return { allowed: true, reason: "ok" };
  }
}

/**
 * Check concurrent active jobs limit per user
 * Prevents users from queuing too many jobs at once
 * 
 * CRITICAL: evaluation_jobs.manuscript_id → manuscripts.id → manuscripts.user_id
 */
async function checkConcurrentJobsLimit(userId: string): Promise<RateLimitResult> {
  const supabase = getSupabaseClient();
  
  // Production safety: during build or when env vars missing, fail open
  if (!supabase) {
    console.warn("[CONCURRENT-LIMIT] Supabase client unavailable, allowing request");
    return { allowed: true, reason: "ok" };
  }

  const MAX_CONCURRENT = 5; // Configurable based on subscription tier
  
  try {
    // Query: Get user's manuscripts first, then count active jobs
    const { data: manuscripts, error: manuError } = await supabase
      .from("manuscripts")
      .select("id")
      .eq("user_id", userId);

    if (manuError) {
      console.error("[CONCURRENT-LIMIT] Error fetching user manuscripts:", manuError);
      return { allowed: true, reason: "ok" };
    }

    if (!manuscripts || manuscripts.length === 0) {
      return { allowed: true, reason: "ok" };
    }

    const manuscriptIds = manuscripts.map(m => m.id);

    const { count, error } = await supabase
      .from("evaluation_jobs")
      .select("id", { count: "exact", head: true })
      .in("manuscript_id", manuscriptIds)
      .in("status", ["queued", "running", "retry_pending"]);
    
    if (error) {
      console.error("[CONCURRENT-LIMIT] Error counting active jobs:", error);
      return { allowed: true, reason: "ok" };
    }
    
    if ((count ?? 0) >= MAX_CONCURRENT) {
      return {
        allowed: false,
        reason: `Too many active jobs. Maximum ${MAX_CONCURRENT} concurrent jobs allowed.`,
      };
    }
    
    return { allowed: true, reason: "ok" };
  } catch (err) {
    console.error("Concurrent jobs check exception:", err);
    return { allowed: true, reason: "ok" };
  }
}

/**
 * Validate manuscript size
 */
export function validateManuscriptSize(sizeInBytes: number): RateLimitResult {
  if (sizeInBytes > RATE_LIMITS.MAX_MANUSCRIPT_SIZE) {
    const maxMB = RATE_LIMITS.MAX_MANUSCRIPT_SIZE / (1024 * 1024);
    return {
      allowed: false,
      reason: `Manuscript too large. Maximum size: ${maxMB}MB`,
    };
  }
  return { allowed: true, reason: "ok" };
}

/**
 * Main rate limit check for job creation
 * Coordinates multiple layers of protection
 */
export async function checkJobCreationRateLimit(req: Request): Promise<RateLimitResult> {
  const userId = getUserIdFromRequest(req);
  const ip = getIpFromRequest(req);
  
  // Layer 1: IP-based throttling (for anonymous or as fallback)
  if (!userId) {
    const ipLimit = checkIpRateLimit(ip);
    if (!ipLimit.allowed) return ipLimit;
  }
  
  // Layer 2: Per-user rate limits (if authenticated)
  if (userId) {
    const userRateLimit = await checkUserJobRateLimit(userId);
    if (!userRateLimit.allowed) return userRateLimit;
    
    const concurrentLimit = await checkConcurrentJobsLimit(userId);
    if (!concurrentLimit.allowed) return concurrentLimit;
  }
  
  return { allowed: true, reason: "ok" };
}

/**
 * Feature-specific rate limits for different job types
 * Premium features get different thresholds
 */
export function getFeatureRateLimit(jobType: string): {
  maxPerHour: number;
  requiresAuth: boolean;
  premiumOnly: boolean;
} {
  const limits: Record<string, { maxPerHour: number; requiresAuth: boolean; premiumOnly: boolean }> = {
    // Core evaluation features
    evaluate_full: { maxPerHour: 10, requiresAuth: true, premiumOnly: false },
    evaluate_chapter: { maxPerHour: 20, requiresAuth: true, premiumOnly: false },
    evaluate_scene: { maxPerHour: 30, requiresAuth: true, premiumOnly: false },
    
    // WAVE evaluation (higher-order, more resource-intensive)
    evaluate_wave: { maxPerHour: 5, requiresAuth: true, premiumOnly: true },
    
    // Agent package generation (8.0+ quality threshold)
    generate_agent_package: { maxPerHour: 3, requiresAuth: true, premiumOnly: true },
    generate_synopsis: { maxPerHour: 10, requiresAuth: true, premiumOnly: false },
    generate_query_letter: { maxPerHour: 10, requiresAuth: true, premiumOnly: false },
    generate_comparables: { maxPerHour: 5, requiresAuth: true, premiumOnly: true },
    
    // Conversion features
    convert_chapter_to_scene: { maxPerHour: 15, requiresAuth: true, premiumOnly: false },
    convert_manuscript_to_screenplay: { maxPerHour: 5, requiresAuth: true, premiumOnly: true },
    
    // Film adaptation package
    generate_film_package: { maxPerHour: 3, requiresAuth: true, premiumOnly: true },
    
    // Revision workflow
    apply_revision: { maxPerHour: 50, requiresAuth: true, premiumOnly: false },
    
    // Default for unknown types
    default: { maxPerHour: 10, requiresAuth: true, premiumOnly: false },
  };
  
  return limits[jobType] ?? limits.default;
}

/**
 * Check if user can access a specific job type
 * 
 * Security: x-user-id header bypass is only honored when ALLOW_HEADER_USER_ID is explicitly enabled
 * (CI/dev environments). In production, this must always be false or unset.
 */
export async function checkFeatureAccess(
  userId: string | null,
  jobType: string,
  userTier: "free" | "premium" | "agent" = "free"
): Promise<RateLimitResult> {
  const featureLimit = getFeatureRateLimit(jobType);
  
  // Gate: Only allow header-based auth bypass in explicitly non-production environments
  const allowHeaderUserId = process.env.ALLOW_HEADER_USER_ID === "true";
  const isProduction = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
  
  // Fail-safe: Never honor header bypass in production, even if misconfigured
  const effectiveUserId = (allowHeaderUserId && !isProduction) ? userId : null;
  
  // Check authentication requirement
  if (featureLimit.requiresAuth && !effectiveUserId) {
    return {
      allowed: false,
      reason: "Authentication required for this feature.",
    };
  }
  
  // Check premium requirement
  if (featureLimit.premiumOnly && userTier === "free") {
    return {
      allowed: false,
      reason: "This feature requires a premium subscription.",
    };
  }
  
  return { allowed: true, reason: "ok" };
}
