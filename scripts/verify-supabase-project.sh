#!/bin/bash
# Verify which Supabase project the app is configured to use
# Run this anytime you're unsure about your configuration

set -e

PRODUCTION_PROJECT="xtumxjnzdswuumndcbwc"
TESTING_PROJECT="ngfszuqjoyixmtlbthyv"

echo ""
echo "🔍 Supabase Project Configuration Check"
echo "========================================"
echo ""

# Load .env.local
if [ ! -f .env.local ]; then
  echo "❌ ERROR: .env.local file not found!"
  echo "   Create it from .env.local.example"
  exit 1
fi

# Extract URL using Node (suppress dotenv output)
SUPABASE_URL=$(node -e "require('dotenv').config({path:'.env.local', debug: false}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '');" 2>&1 | grep -v "dotenv" | grep -v "tip:" | tail -1)

if [ -z "$SUPABASE_URL" ]; then
  echo "❌ ERROR: NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
  exit 1
fi

# Extract project ID from URL
PROJECT_ID=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

echo "📍 Current Configuration:"
echo "   URL: $SUPABASE_URL"
echo "   Project ID: $PROJECT_ID"
echo ""

# Determine which project
if [ "$PROJECT_ID" = "$PRODUCTION_PROJECT" ]; then
  echo "✅ CORRECT: You are using PRODUCTION"
  echo "   Project: RevisionGrade Production"
  echo "   This is the correct configuration for development and deployment."
  exit 0
elif [ "$PROJECT_ID" = "$TESTING_PROJECT" ]; then
  echo "⚠️  CRITICAL WARNING: You are using TESTING DATABASE!"
  echo "   Project: ⚠️ TESTING ONLY - DO NOT USE"
  echo ""
  echo "   This is NOT safe for development or production!"
  echo ""
  echo "🔧 FIX REQUIRED:"
  echo "   Update your .env.local file:"
  echo ""
  echo "   NEXT_PUBLIC_SUPABASE_URL=https://$PRODUCTION_PROJECT.supabase.co"
  echo "   SUPABASE_SERVICE_ROLE_KEY=[get from Supabase Dashboard → RevisionGrade Production → Settings → API]"
  echo ""
  echo "   Then run: npm run dev (to restart with correct config)"
  echo ""
  exit 1
else
  echo "❓ UNKNOWN: Unrecognized Supabase project"
  echo "   Expected production: $PRODUCTION_PROJECT"
  echo "   Expected testing: $TESTING_PROJECT"
  echo "   Got: $PROJECT_ID"
  exit 1
fi
