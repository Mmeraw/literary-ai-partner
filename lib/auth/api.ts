// lib/auth/api.ts
// GOVERNANCE: Auth helpers for API routes (user/admin/service-role)

import { NextRequest } from "next/server";
import crypto from "crypto";

const MAX_SECRET_LENGTH = 512;

/**
 * Timing-safe string comparison using SHA-256 digests.
 * Prevents timing side-channel attacks on secret comparisons.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length > MAX_SECRET_LENGTH || b.length > MAX_SECRET_LENGTH) return false;
  const aHash = crypto.createHash("sha256").update(a, "utf8").digest();
  const bHash = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * INTERNAL ONLY:
 * Validates service-role authentication for daemon/internal mutation endpoints.
 *
 * Contract:
 * - Requires Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 * - Returns boolean only (no derived truth)
 * - Uses timing-safe comparison to prevent side-channel attacks
 * 
 * SAFE FOR BUILD TIME: Only reads env when called (not at module import)
 */
export function checkServiceRoleAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return false;

  return timingSafeCompare(token, serviceRoleKey);
}

/**
 * ADMIN ONLY:
 * Validates admin access for operational endpoints (metrics, dashboards).
 *
 * Contract:
 * - Requires X-Admin-Key header
 * - Compares to ADMIN_API_KEY env var
 * - Uses timing-safe comparison to prevent side-channel attacks
 */
export function checkAdminAuth(req: NextRequest): boolean {
  const headerKey = req.headers.get("x-admin-key");
  if (!headerKey) return false;

  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;

  return timingSafeCompare(headerKey, adminKey);
}
