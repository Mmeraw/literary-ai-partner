/**
 * Job System Logging
 * 
 * Debug logs are opt-in via environment flags:
 * - REVISIONGRADE_DEBUG=1 (global debug)
 * - JOBS_DEBUG=1 (job system specific)
 * 
 * Default: silent (clean CI output, no noise in prod)
 */

export function debugLog(...args: unknown[]) {
  const enabled =
    process.env.REVISIONGRADE_DEBUG === "1" ||
    process.env.JOBS_DEBUG === "1";

  if (!enabled) return;

  // eslint-disable-next-line no-console
  console.log(...args);
}

/**
 * Production safety: Error logs are always enabled
 */
export function errorLog(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.error(...args);
}
