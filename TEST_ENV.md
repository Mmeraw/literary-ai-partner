# Test Environment Variables
# Copy this to .env.test and fill in your actual values

# Staging Supabase Project (ngfszuqjoyixmtlbthyv)
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
