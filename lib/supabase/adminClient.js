import { createClient } from "@supabase/supabase-js";
import { guardSupabaseProject } from "./projectGuard.js";

/**
 * JavaScript shim for runtime environments that resolve .js extensions only.
 * Mirrors lib/supabase/admin.ts behavior for getSupabaseAdminClient().
 */
export function createAdminClient(options = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    if (options.nullable) {
      return null;
    }

    if (!url) {
      throw new Error(
        "Missing Supabase URL. Expected NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL. " +
          "In CI, ensure SUPABASE_URL_CI secret is set and workflow overrides canonical names."
      );
    }

    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. " +
        "In CI, ensure SUPABASE_SERVICE_ROLE_KEY_CI secret is set and workflow overrides canonical names."
    );
  }

  guardSupabaseProject();

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
