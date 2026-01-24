// lib/supabase.js

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // This will surface clearly in logs during dev/build.
  // In production, set these in your Vercel env vars.
  console.warn(
    "[RG-SUPABASE] Missing Supabase environment variables: SUPABASE_URL / SUPABASE_ANON_KEY"
  );
}

// Typed singletons
/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let supabaseClient = null;
/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let supabaseAdminClient = null;

/**
 * Singleton Supabase client for use in client components/hooks.
 * For server-side code and tests, use getSupabaseAdminClient instead.
 * 
 * PRODUCTION SAFETY: Returns null during build if env vars missing.
 * Route handlers must handle null client gracefully.
 */
export function getSupabaseClient() {
  // CRITICAL: Check env vars BEFORE creating client
  // createClient() will throw if given empty strings
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // During Next.js build without env vars, return null to avoid hard crash
    if (typeof window === "undefined") {
      // Server-side (including build) - return null, routes must handle it
      return null;
    }
    // Client-side - still try to create for better error messaging
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    });
  }
  return supabaseClient;
}

/**
 * Server-side admin client with service role key (bypasses RLS).
 * Use this for background jobs, migrations, tests, and system operations.
 * 
 * PRODUCTION SAFETY: Returns null when credentials missing (CI, build environments).
 * Callers must handle null gracefully.
 */
export function getSupabaseAdminClient() {
  // CRITICAL: Check credentials BEFORE creating client
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Missing credentials - return null for graceful degradation
    // CI and build environments don't need real Supabase
    if (typeof window === "undefined") {
      // Server-side without credentials - return null
      console.warn("[RG-SUPABASE] Admin client unavailable (missing credentials), returning null");
      return null;
    }
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseAdminClient;
}
