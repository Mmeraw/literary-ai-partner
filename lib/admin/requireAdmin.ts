/**
 * Phase A.5 Day 1: Admin Endpoint Authentication
 * 
 * Protects /api/admin/* routes with cookie-based admin session validation.
 * Returns 401/403 if unauthorized, null if OK.
 * 
 * Usage:
 *   const denied = await requireAdmin(request);
 *   if (denied) return denied;
 * 
 * @module lib/admin/requireAdmin
 */

import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Validates admin access via Supabase session cookies + admin claim
 * 
 * @param req - Next.js request object
 * @returns NextResponse with 401/500 if unauthorized, null if OK
 */
function isAdminUser(user: User | null): boolean {
  if (!user) return false;

  // Canonical admin role check: app_metadata.role only.
  // No fallbacks to user_metadata or permissions.
  // This is audit-clean and server-trustable.
  const role = (user.app_metadata as any)?.role;
  return role === "admin" || role === "superadmin";
}

export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user ?? null;

    if (error || !user) {
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

    if (!isAdminUser(user)) {
      console.warn("[requireAdmin] Forbidden admin access attempt", {
        userId: user.id,
        ip: req.headers.get("x-forwarded-for") || "unknown",
        path: req.nextUrl.pathname,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "admin_forbidden",
            message: "Forbidden - admin access required",
          },
        },
        { status: 403 }
      );
    }

    return null;
  } catch (err) {
    console.error("[requireAdmin] Admin auth failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "admin_auth_error",
          message: "Admin authentication failed",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Alternative: check if request is admin (session-based)
 * 
 * @param req - Next.js request object
 * @returns true if user is admin
 */
export async function isAdmin(req: NextRequest): Promise<boolean> {
  const denied = await requireAdmin(req);
  return denied === null;
}
