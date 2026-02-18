// lib/auth/devHeaderActor.ts
// GOVERNANCE: Dev/test-only header-based actor resolution.
// SECURITY: Only activates when BOTH TEST_MODE=true AND ALLOW_HEADER_USER_ID=true.
// In production, this function always returns null.

/**
 * Dev Header Actor — test-mode only identity resolution.
 *
 * Extracts user identity from x-user-id header and admin signal from
 * x-admin header, but ONLY when the server is running in explicit
 * dev/test mode (TEST_MODE=true + ALLOW_HEADER_USER_ID=true).
 *
 * Security guardrails:
 * - Returns null in production (no env flags set)
 * - Admin requires explicit x-admin: "true" header OR x-user-id === "admin-user"
 * - Never grants admin from x-user-id alone (except the dev constant "admin-user")
 *
 * @module lib/auth/devHeaderActor
 */

export type DevHeaderActor = {
  userId: string;
  isAdmin: boolean;
};

/**
 * Check if dev header mode is active.
 * Both TEST_MODE and ALLOW_HEADER_USER_ID must be "true".
 */
function isDevHeaderMode(): boolean {
  return (
    process.env.TEST_MODE === "true" &&
    process.env.ALLOW_HEADER_USER_ID === "true"
  );
}

/**
 * Extract dev actor from request headers.
 *
 * @param req - Request object (NextRequest or Request)
 * @returns DevHeaderActor if in dev mode and x-user-id is present, null otherwise
 */
export function getDevHeaderActor(req: Request): DevHeaderActor | null {
  if (!isDevHeaderMode()) return null;

  const userId = req.headers.get("x-user-id");
  if (!userId || !userId.trim()) return null;

  const trimmedUserId = userId.trim();

  // Admin signal: explicit x-admin header OR the dev-only "admin-user" constant
  const isAdmin =
    req.headers.get("x-admin") === "true" || trimmedUserId === "admin-user";

  return { userId: trimmedUserId, isAdmin };
}
