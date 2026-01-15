// lib/supabase.js

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // This will surface clearly in logs during dev/build.
  // In production, set these in your Vercel env vars.
  console.warn(
    "[RG-SUPABASE] Missing Supabase environment variables: SUPABASE_URL / SUPABASE_ANON_KEY"
  );
}

let supabaseClient = null;

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
