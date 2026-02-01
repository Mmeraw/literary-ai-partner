// lib/auth/api.ts
// GOVERNANCE: Auth helpers for API routes (user/admin/service-role)

import { NextRequest } from "next/server";

/**
 * INTERNAL ONLY:
 * Validates service-role authentication for daemon/internal mutation endpoints.
 *
 * Contract:
 * - Requires Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 * - Returns boolean only (no derived truth)
 * 
 * SAFE FOR BUILD TIME: Only reads env when called (not at module import)
 */
export function checkServiceRoleAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Read key at runtime, not module import time (safe for next build)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return false;

  return token === serviceRoleKey;
}

/**
 * ADMIN ONLY:
 * Validates admin access for operational endpoints (metrics, dashboards).
 *
 * Contract:
 * - Requires X-Admin-Key header
 * - Compares to ADMIN_API_KEY env var
 */
export function checkAdminAuth(req: NextRequest): boolean {
  const headerKey = req.headers.get("x-admin-key");
  if (!headerKey) return false;

  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;

  return headerKey === adminKey;
}
