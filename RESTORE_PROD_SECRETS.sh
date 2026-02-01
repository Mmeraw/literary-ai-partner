#!/bin/bash
# RESTORE PRODUCTION SUPABASE KEYS TO GITHUB SECRETS
# Fixes project reference mismatch per documented CI policy

set -e

echo "🔧 FIXING CI SUPABASE PROJECT MISMATCH"
echo "======================================="
echo ""
echo "Current issue: Mixed project references (ngfszuqjoyixmtlbthyv + xtumxjnzdswuumndcbwc)"
echo "Documented policy: CI uses PRODUCTION (xtumxjnzdswuumndcbwc)"
echo ""

# Production URL
PROD_URL="https://xtumxjnzdswuumndcbwc.supabase.co"

echo "📋 You need the PRODUCTION keys from:"
echo "   https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/settings/api"
echo ""
read -p "Enter PRODUCTION service_role key (starts with eyJ): " SERVICE_KEY
read -p "Enter PRODUCTION anon key (starts with eyJ): " ANON_KEY

echo ""
echo "🔧 Setting GitHub secrets..."

gh secret set SUPABASE_URL --body "$PROD_URL"
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "$PROD_URL"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "$SERVICE_KEY"
gh secret set SUPABASE_ANON_KEY --body "$ANON_KEY"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "$ANON_KEY"

echo ""
echo "✅ DONE! All secrets now point to PRODUCTION project."
echo ""
echo "🔍 Verify with:"
echo "   git commit --allow-empty -m 'test: verify prod secrets'"
echo "   git push"
echo "   gh run list --branch main --limit 1"
echo ""
echo "Expected: Phase 2D Evidence shows 'xtumxjnzdswuumndcbwc' for all refs"
