// lib/supabase/admin.ts
// Server-side admin client that bypasses RLS (Row Level Security)
// Use ONLY in trusted server routes for administrative operations

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { guardSupabaseProject } from "./projectGuard";

/**
 * PHASE A.5 NOTE:
 * The dev→prod startup guard has been moved to instrumentation.ts
 * which runs at SERVER STARTUP (not route-time).
 * 
 * This ensures the guard is truly unavoidable and triggers before
 * any routes can execute.
 * 
 * CI ENVIRONMENT NOTE:
 * When running in CI (JOB_SYSTEM_ENV=ci), the workflow injects
 * CI-specific Supabase credentials into the canonical env var names
 * (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * 
 * This client reads those canonical names, so no branching is needed.
 * The CI project has the latest schema (manuscript_chunks.last_error, etc.)
 * while production can evolve independently via deliberate migrations.
 */

type CreateAdminClientOptions = {
  nullable?: boolean;
};

export function createAdminClient(): SupabaseClient;
export function createAdminClient(
  options: { nullable: true }
): SupabaseClient | null;
export function createAdminClient(
  options: CreateAdminClientOptions = {}
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    if (options.nullable) {
      return null;
    }

    if (!url) {
      throw new Error(
        "Missing Supabase URL. Expected NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL as server-side alias). " +
        "In CI, the workflow injects these from the canonical SUPABASE_URL / SUPABASE_ANON_KEY repository secrets."
      );
    }

    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. " +
      "In CI, the workflow injects this from the canonical SUPABASE_SERVICE_ROLE_KEY repository secret."
    );
  }

  // PRODUCTION SAFETY: Verify we're not accidentally using testing database
  // (This is bypassed in CI via workflow-injected credentials)
  guardSupabaseProject();

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
