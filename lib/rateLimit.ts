/**
 * Phase A.5 Day 1: Surgical Rate Limiting
 * 
 * Simple in-memory token bucket rate limiter.
 * Keys by IP or user ID to prevent abuse on expensive endpoints.
 * 
 * Production: Replace with Redis/Upstash for distributed systems.
 * 
 * @module lib/rateLimit
 */

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Token bucket rate limiter
 * 
 * @param key - Unique identifier (e.g., "retry:192.168.1.1" or "eval:user123")
 * @param limit - Maximum requests per window
 * @param windowMs - Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: limit, last: now };
  const elapsed = now - bucket.last;

  // Reset window if expired
  if (elapsed > windowMs) {
    bucket.tokens = limit;
    bucket.last = now;
  }

  // Check if tokens available
  if (bucket.tokens <= 0) {
    buckets.set(key, bucket);
    return false; // Rate limited
  }

  // Consume token
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true; // Allowed
}

/**
 * Get remaining tokens for a key (for rate limit headers)
 * 
 * @param key - Rate limit key
 * @param limit - Maximum requests per window
 * @returns Remaining tokens
 */
export function getRemainingTokens(key: string, limit: number): number {
  const bucket = buckets.get(key);
  return bucket ? bucket.tokens : limit;
}

/**
 * Clear all rate limit buckets (for testing)
 */
export function clearRateLimits(): void {
  buckets.clear();
}

/**
 * Helper to extract client IP from request
 * 
 * @param headers - Request headers
 * @returns Client IP address
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") || "unknown";
}
