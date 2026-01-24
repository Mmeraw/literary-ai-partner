#!/usr/bin/env node
/**
 * Centralized HTTP helper for job system smoke tests
 * 
 * Provides:
 * - authHeaders(): x-user-id for CI/dev auth bypass
 * - jfetch(): fetch wrapper with auth headers
 * - must(): fetch + response validation
 * 
 * Single source of truth for test authentication wiring.
 */

/**
 * Get auth headers for CI/dev smoke tests
 * Uses x-user-id bypass (only honored when ALLOW_HEADER_USER_ID=true)
 */
export function authHeaders() {
  return {
    "x-user-id": "smoke-test-user",
  };
}

/**
 * Fetch with automatic auth headers for POST/PUT/DELETE
 * GET requests don't include auth headers (read-only)
 */
export async function jfetch(url, options = {}) {
  const method = options.method?.toUpperCase() || "GET";
  const needsAuth = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  const headers = {
    ...options.headers,
    ...(needsAuth ? authHeaders() : {}),
  };

  return fetch(url, { ...options, headers });
}

/**
 * Fetch with response validation
 * Throws on non-OK status with detailed error message
 */
export async function must(fetchPromise, context) {
  const res = await fetchPromise;
  
  if (!res || typeof res.ok !== "boolean") {
    throw new Error(
      `must() expected a fetch Response, got: ${Object.prototype.toString.call(res)}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${context}: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }

  return res;
}

/**
 * Sleep helper
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
