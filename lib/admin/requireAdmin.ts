/**
 * Phase A.5 Day 1: Admin Endpoint Authentication
 * 
 * Protects /api/admin/* routes with x-admin-key header validation.
 * Returns 401 if unauthorized, null if OK.
 * 
 * Usage:
 *   const denied = requireAdmin(request);
 *   if (denied) return denied;
 * 
 * @module lib/admin/requireAdmin
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Validates admin access via x-admin-key header
 * 
 * @param req - Next.js request object
 * @returns NextResponse with 401/500 if unauthorized, null if OK
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_API_KEY;
  const got = req.headers.get("x-admin-key");

  // Server misconfiguration
  if (!expected) {
    console.error("[requireAdmin] ADMIN_API_KEY not configured in environment");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "admin_config_missing",
          message: "Admin API key not configured",
        },
      },
      { status: 500 }
    );
  }

  // Missing or wrong key
  if (!got || got !== expected) {
    console.warn("[requireAdmin] Unauthorized admin access attempt", {
      hasKey: !!got,
      ip: req.headers.get("x-forwarded-for") || "unknown",
      path: req.nextUrl.pathname,
    });
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "admin_unauthorized",
          message: "Unauthorized - admin access required",
        },
      },
      { status: 401 }
    );
  }

  // Success - allow request to proceed
  return null;
}

/**
 * Alternative: check if request has admin key (for conditional logic)
 * 
 * @param req - Next.js request object
 * @returns true if admin key is valid
 */
export function isAdmin(req: NextRequest): boolean {
  const expected = process.env.ADMIN_API_KEY;
  const got = req.headers.get("x-admin-key");
  return !!expected && got === expected;
}
