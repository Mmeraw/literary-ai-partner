# ⚠️ TESTING ENVIRONMENT VARIABLES ⚠️
# ❌ DO NOT USE THESE IN PRODUCTION ❌
# Copy this to .env.test and fill in your actual values

# ⚠️ TESTING ONLY Supabase Project (ngfszuqjoyixmtlbthyv)
# ⚠️ WARNING: This is NOT the production database!
# ⚠️ This project is named "⚠️ TESTING ONLY - DO NOT USE" in Supabase Dashboard
# Production uses: xtumxjnzdswuumndcbwc (RevisionGrade Production)
SUPABASE_URL=https://ngfszuqjoyixmtlbthyv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# To run tests that need Supabase:
# 1. Copy this file to .env.test (not committed)
# 2. Fill in your keys (get from Supabase dashboard)
# 3. Run: source <(grep -v '^#' .env.test | xargs -I {} echo export {}) && npm test

# Or for a single test:
# SUPABASE_URL="https://ngfszuqjoyixmtlbthyv.supabase.co" \
# SUPABASE_SERVICE_ROLE_KEY="your_key" \
# npm test -- manuscript-chunks-stability.test.ts
