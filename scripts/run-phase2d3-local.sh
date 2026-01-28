#!/usr/bin/env bash
set -euo pipefail
set +H  # Disable history expansion for ! in strings

# Phase 2D-3 Local Test Runner
# Sets up local Supabase env and runs reconciler tests

echo "Setting up local Supabase environment..."

# Check if .env.local exists (created by developer)
if [ -f .env.local ]; then
  echo "✅ Loading .env.local"
  set -a && source .env.local && set +a
else
  echo "⚠️  No .env.local found, using defaults"
  export SUPABASE_URL="http://127.0.0.1:54321"
  export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
  # Standard Supabase local development JWT (matches default jwt_secret)
  export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
fi

# Validate JWT format (either JWT or sb_secret_ base64 token)
if [[ "$SUPABASE_SERVICE_ROLE_KEY" =~ ^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
  echo "✅ SERVICE_ROLE_KEY validated (JWT format)"
elif [[ "$SUPABASE_SERVICE_ROLE_KEY" =~ ^sb_secret_ ]]; then
  echo "✅ SERVICE_ROLE_KEY validated (base64 token format)"
else
  echo "❌ SUPABASE_SERVICE_ROLE_KEY is not a valid JWT or base64 token"
  echo "   Got: ${SUPABASE_SERVICE_ROLE_KEY:0:50}..."
  exit 1
fi

echo "✅ SUPABASE_URL=$SUPABASE_URL"
echo ""

npx jest phase2d3-reconciler-proof.test.ts --no-coverage
