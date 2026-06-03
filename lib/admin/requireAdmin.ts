/**
 * Admin Endpoint Authentication
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
import { isPipelineHealthAdminEmail } from "@/lib/admin/pipelineHealthAllowlist";

/**
 * Validates admin access via Supabase session cookies.
 *
 * Canonical privileged access is app_metadata.role = admin/superadmin.
 * Owner break-glass access is also allowed for tsavobc@hotmail.com so the
 * protected Admin Control Center is available even before app metadata is set.
 */
function isAdminUser(user: User | null): boolean {
  if (!user) return false;

  const role = (user.app_metadata as any)?.role;
  return role === "admin" || role === "superadmin" || isPipelineHealthAdminEmail(user.email);
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
        email: user.email ?? null,
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
