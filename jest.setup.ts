// Jest test environment setup
process.env.SUPABASE_URL =
  process.env.SUPABASE_URL ?? "http://localhost:54321";
process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? "test_anon_key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test_service_role_key";
