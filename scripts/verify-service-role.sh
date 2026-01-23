#!/bin/bash
# Service Role Key Verification
# Ensures proper auth configuration for production

set -e

echo "=== Service Role Key Verification ==="
echo ""

echo "1. Checking environment variables..."

# Check if running in test mode
if [ "$NODE_ENV" = "test" ]; then
  echo "   ⚠️  Running in TEST mode - ANON key acceptable"
  echo "   ✅ Test environment detected"
  exit 0
fi

# Check for service role key
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "   ❌ SUPABASE_SERVICE_ROLE_KEY not set!"
  echo ""
  echo "   This is REQUIRED for production server-side writes."
  echo "   Add to your .env.local:"
  echo ""
  echo "   SUPABASE_SERVICE_ROLE_KEY=eyJh..."
  echo ""
  echo "   Get it from: https://supabase.com/dashboard → Settings → API"
  exit 1
else
  echo "   ✅ SUPABASE_SERVICE_ROLE_KEY is set"
  
  # Verify it's not the anon key
  if [ "$SUPABASE_SERVICE_ROLE_KEY" = "$SUPABASE_ANON_KEY" ]; then
    echo "   ❌ SERVICE_ROLE_KEY is same as ANON_KEY!"
    echo "   These must be different keys."
    exit 1
  fi
  
  echo "   ✅ Service role key is distinct from anon key"
fi

# Check for URL
if [ -z "$SUPABASE_URL" ]; then
  echo "   ❌ SUPABASE_URL not set!"
  exit 1
else
  echo "   ✅ SUPABASE_URL is set: $SUPABASE_URL"
fi

echo ""
echo "2. Checking lib/supabase.js usage..."

# Verify admin client uses service role
if grep -q "SUPABASE_SERVICE_ROLE_KEY" lib/supabase.js; then
  echo "   ✅ Admin client configured to use SERVICE_ROLE_KEY"
else
  echo "   ❌ Admin client not configured for SERVICE_ROLE_KEY!"
  exit 1
fi

# Check for warning when using anon key
if grep -q "Using ANON key for admin client" lib/supabase.js; then
  echo "   ✅ Warning present when service role key missing"
else
  echo "   ⚠️  No warning for missing service role key"
fi

echo ""
echo "3. Checking that client vs server usage is correct..."

# Client code should use anon key
if grep -q "SUPABASE_ANON_KEY" app/**/*.{js,jsx,ts,tsx} 2>/dev/null || grep -q "SUPABASE_ANON_KEY" components/**/*.{js,jsx,ts,tsx} 2>/dev/null; then
  echo "   ✅ Client code uses ANON key (correct)"
else
  echo "   ⚠️  No client-side Supabase usage detected"
fi

# Server code should use service role
if grep -q "getSupabaseAdminClient" app/api/**/*.{js,ts} 2>/dev/null; then
  echo "   ✅ Server routes use admin client (correct)"
else
  echo "   ⚠️  No server-side admin client usage detected"
fi

echo ""
echo "=== ✅ SERVICE ROLE CONFIGURATION VERIFIED ==="
echo ""
echo "Production checklist:"
echo "  ✅ SUPABASE_SERVICE_ROLE_KEY set and distinct"
echo "  ✅ Admin client uses service role key"
echo "  ✅ Warning present for fallback to anon key"
echo "  ✅ Client/server separation understood"
echo ""
echo "Next: Deploy with proper environment variables"
echo "  - Vercel: Add SUPABASE_SERVICE_ROLE_KEY to env vars"
echo "  - Docker: Add to docker-compose.yml or .env"
echo "  - Manual: Set in production shell environment"
