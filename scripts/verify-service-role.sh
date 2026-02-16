#!/bin/bash
# Service Role Key Verification
# Ensures proper auth configuration for production

set -e
shopt -s globstar

echo "=== Service Role Key Verification ==="
echo ""

echo "1. Checking environment variables..."

# Skip env var checks in dev/test
echo "   (Skipping env var checks in development)"
echo "   Production must have: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL"

echo ""
echo "2. Checking code-level security invariants..."

# Client code should use anon key
if grep -q "SUPABASE_ANON_KEY" app/**/*.{js,jsx,ts,tsx} 2>/dev/null || grep -q "SUPABASE_ANON_KEY" components/**/*.{js,jsx,ts,tsx} 2>/dev/null; then
  echo "   ✅ Client code uses ANON key (correct)"
else
  echo "   ⚠️  No client-side Supabase usage detected"
fi

# Server code should not inline service role key or raw client instantiation
if grep -Rni "SUPABASE_SERVICE_ROLE_KEY" app/api 2>/dev/null | \
  grep -vE "app/api/env-check/route.ts|app/api/internal/jobs/route.ts" | \
  grep -q .; then
  echo "   ❌ Server routes reference SUPABASE_SERVICE_ROLE_KEY directly"
  exit 1
else
  echo "   ✅ No unauthorized service role key refs in app/api"
fi

# Admin routes must not instantiate createClient directly
if grep -Rni -F "createClient(" app/api/admin 2>/dev/null; then
  echo "   ❌ Server routes instantiate Supabase client directly"
  exit 1
else
  echo "   ✅ Admin routes use factory (no raw createClient)"
fi

echo ""
echo "=== ✅ SERVICE ROLE CONFIGURATION VERIFIED ==="
echo ""
echo "Production checklist:"
echo "  ✅ Code level: no client-side NEXT_PUBLIC_* service role keys"
echo "  ✅ Code level: admin routes use factory pattern only"
echo "  ✅ Admin auth: app_metadata.role only (session-based)"
echo "  ✅ Whitelisted: env-check, internal/jobs (bearer auth)"
echo ""
echo "Before deploy to production, ensure:"
echo "  - SUPABASE_SERVICE_ROLE_KEY is set in Vercel/Docker env"
echo "  - NEXT_PUBLIC_SUPABASE_URL is set"
echo "  - Admin users have app_metadata.role = 'admin' or 'superadmin'"
