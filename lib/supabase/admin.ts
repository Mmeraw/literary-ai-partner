// lib/supabase/admin.ts
// Server-side admin client that bypasses RLS (Row Level Security)
// Use ONLY in trusted server routes for administrative operations

import { createClient } from "@supabase/supabase-js";
import { guardSupabaseProject } from "./projectGuard";

/**
 * PHASE A.5 NOTE:
 * The dev→prod startup guard has been moved to instrumentation.ts
 * which runs at SERVER STARTUP (not route-time).
 * 
 * This ensures the guard is truly unavoidable and triggers before
 * any routes can execute.
 */

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  // PRODUCTION SAFETY: Verify we're not accidentally using testing database
  guardSupabaseProject();

  return createClient(url, serviceRole, {
    auth: { 
      persistSession: false, 
      autoRefreshToken: false 
    },
  });
}
