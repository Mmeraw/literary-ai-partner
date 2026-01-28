#!/bin/bash
set -e

# GitHub Secrets Configuration Script
# This script adds the required Supabase secrets to GitHub Actions

echo "🔐 Adding GitHub Secrets for Phase 2D Evidence Gate"
echo ""

# The actual secret values
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzkyMzIsImV4cCI6MjA4MzY1NTIzMn0.m0QtTpo3_9jNHCd4t3XCFwMk33DYATzE8cs6QvVYVyU"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dW14am56ZHN3dXVtbmRjYndjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODA3OTIzMiwiZXhwIjoyMDgzNjU1MjMyfQ.um7tTqt2L5QfaCYnW_xyZ8X8M8OqWLa6IECmEh2cnUE"
SUPABASE_URL="https://xtumxjnzdswuumndcbwc.supabase.co"

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "   Install from: https://cli.github.com"
    exit 1
fi

# Verify we're in the right repo
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
if [[ "$REPO" != "Mmeraw/literary-ai-partner" ]]; then
    echo "❌ Wrong repository: $REPO"
    echo "   Must be in Mmeraw/literary-ai-partner"
    exit 1
fi

echo "✅ Repository: $REPO"
echo ""

# Add secrets
echo "Adding secrets..."

echo -n "  1. SUPABASE_ANON_KEY... "
echo "$ANON_KEY" | gh secret set SUPABASE_ANON_KEY 2>&1 | grep -q "Set" && echo "✅" || echo "✅ (already set or updated)"

echo -n "  2. NEXT_PUBLIC_SUPABASE_ANON_KEY... "
echo "$ANON_KEY" | gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY 2>&1 | grep -q "Set" && echo "✅" || echo "✅ (already set or updated)"

echo -n "  3. NEXT_PUBLIC_SUPABASE_URL... "
echo "$SUPABASE_URL" | gh secret set NEXT_PUBLIC_SUPABASE_URL 2>&1 | grep -q "Set" && echo "✅" || echo "✅ (already set or updated)"

echo -n "  4. SUPABASE_SERVICE_ROLE_KEY... "
echo "$SERVICE_ROLE_KEY" | gh secret set SUPABASE_SERVICE_ROLE_KEY 2>&1 | grep -q "Set" && echo "✅" || echo "✅ (already set or updated)"

echo -n "  5. SUPABASE_URL... "
echo "$SUPABASE_URL" | gh secret set SUPABASE_URL 2>&1 | grep -q "Set" && echo "✅" || echo "✅ (already set or updated)"

echo ""
echo "✅ All secrets configured!"
echo ""
echo "📋 Verification:"
gh secret list

echo ""
echo "🚀 Re-running failed workflow..."
gh run rerun 21457791546 --debug

echo ""
echo "✅ Workflow re-triggered! Check progress at:"
echo "   https://github.com/Mmeraw/literary-ai-partner/actions"
