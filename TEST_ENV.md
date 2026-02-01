# ⚠️⚠️⚠️ TESTING ENVIRONMENT VARIABLES ⚠️⚠️⚠️
# ❌ NEVER USE IN CI/CD OR PRODUCTION ❌
# ❌ LOCAL TESTING ONLY ❌
# Copy this to .env.test (NOT COMMITTED) and fill in your actual values

# ========================================
# ⚠️ TESTING ONLY Supabase Project
# ========================================
# Project: ngfszuqjoyixmtlbthyv (⚠️ TESTING ONLY - DO NOT USE)
# Purpose: LOCAL migration testing ONLY
# 
# ❌ DO NOT USE IN:
#    - GitHub Actions CI
#    - Vercel deployments
#    - Any production/staging environment
# 
# ✅ PRODUCTION PROJECT: xtumxjnzdswuumndcbwc (RevisionGrade Production)
# ✅ See: FIX_GITHUB_SECRETS_NOW.md for CI setup
# ========================================

SUPABASE_URL=https://ngfszuqjoyixmtlbthyv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_testing_service_role_key_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_testing_anon_key_here

# To run tests that need Supabase:
# 1. Copy this file to .env.test (not committed)
# 2. Fill in your keys (get from Supabase dashboard)
# 3. Run: source <(grep -v '^#' .env.test | xargs -I {} echo export {}) && npm test

# Or for a single test:
# SUPABASE_URL="https://ngfszuqjoyixmtlbthyv.supabase.co" \
# SUPABASE_SERVICE_ROLE_KEY="your_key" \
# npm test -- manuscript-chunks-stability.test.ts
