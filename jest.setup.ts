// Jest test environment setup
// Pass through environment variables if set (GitHub Actions, local CI)
// Otherwise use sensible test defaults

process.env.SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://localhost:54321";

process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? "test_anon_key";

process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test_service_role_key";

// Ensure NEXT_PUBLIC variants are set for client-side code
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

// Map database URLs for TTL/concurrency tests (psql CLI integration tests)
// Tries multiple common env var names in priority order
if (!process.env.PG_URL) {
  const dbUrl = 
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPROTECTED;
  
  if (dbUrl) {
    (process.env as any).PG_URL = dbUrl;
  }
}
