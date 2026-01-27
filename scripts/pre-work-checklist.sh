#!/bin/bash
# Quick verification checklist - run this before starting work each day

set -e

echo ""
echo "🔍 Pre-Work Safety Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: Supabase Project
echo "1️⃣  Checking Supabase project configuration..."
if bash scripts/verify-supabase-project.sh > /dev/null 2>&1; then
  echo "   ✅ Supabase: Production project (CORRECT)"
else
  echo "   ❌ Supabase: WRONG PROJECT DETECTED!"
  echo ""
  echo "   Run this for details:"
  echo "   $ bash scripts/verify-supabase-project.sh"
  echo ""
  exit 1
fi

# Check 2: Git Status
echo "2️⃣  Checking git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
  BRANCH=$(git branch --show-current)
  echo "   ✅ Git: On branch '$BRANCH'"
  
  # Check for uncommitted changes
  if git diff-index --quiet HEAD --; then
    echo "   ✅ Git: Working tree clean"
  else
    echo "   ⚠️  Git: You have uncommitted changes"
  fi
else
  echo "   ❌ Git: Not in a git repository"
fi

# Check 3: Dependencies
echo "3️⃣  Checking dependencies..."
if [ -d "node_modules" ]; then
  echo "   ✅ Dependencies: node_modules exists"
else
  echo "   ⚠️  Dependencies: node_modules missing"
  echo "   Run: npm install"
fi

# Check 4: Environment File
echo "4️⃣  Checking environment file..."
if [ -f ".env.local" ]; then
  echo "   ✅ Environment: .env.local exists"
else
  echo "   ❌ Environment: .env.local missing"
  echo "   Create it with production credentials"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL CHECKS PASSED - Safe to start development!"
echo ""
echo "Next steps:"
echo "  $ npm run dev"
echo ""
