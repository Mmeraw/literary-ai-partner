#!/bin/bash
# Quick setup script for staging smoke test
# Creates test user and manuscript in Supabase

set -e

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "Error: SUPABASE environment variables not set"
  echo "Make sure .env.local is sourced"
  exit 1
fi

echo "Creating test user and getting JWT token..."
echo "Supabase URL: $SUPABASE_URL"

# Sign up test user (or sign in if already exists)
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staging-test@example.com",
    "password": "test-password-staging-123"
  }')

echo "Signup response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Try to sign in (in case user already exists)
echo -e "\nSigning in..."
SIGNIN_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staging-test@example.com",
    "password": "test-password-staging-123"
  }')

echo "Sign-in response:"
echo "$SIGNIN_RESPONSE" | jq '.' 2>/dev/null || echo "$SIGNIN_RESPONSE"

# Extract access token
ACCESS_TOKEN=$(echo "$SIGNIN_RESPONSE" | jq -r '.access_token // empty')

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
  echo -e "\n✅ Got JWT token!"
  echo "export STAGING_JWT=\"$ACCESS_TOKEN\""
  echo ""
  echo "Run this to set it:"
  echo "  export STAGING_JWT=\"$ACCESS_TOKEN\""
else
  echo -e "\n❌ Failed to get JWT token"
  echo "You may need to create the user manually in Supabase Dashboard"
fi
