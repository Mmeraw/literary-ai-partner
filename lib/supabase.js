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

let supabaseClient = null;
let supabaseAdminClient = null;

/**
 * Singleton Supabase client for use in client components/hooks.
 * For server-side usage, prefer createServerSupabaseClient patterns later.
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "");
  }
  return supabaseClient;
}

/**
 * Server-side admin client with service role key (bypasses RLS).
 * Use this for background jobs, migrations, and system operations.
 */
export function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("[RG-SUPABASE] Using ANON key for admin client - RLS will block writes. Set SUPABASE_SERVICE_ROLE_KEY.");
    }
    supabaseAdminClient = createClient(SUPABASE_URL ?? "", key ?? "");
  }
  return supabaseAdminClient;
}
