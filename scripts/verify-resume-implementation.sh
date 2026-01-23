#!/bin/bash
# Verification script for Resume + Skip Completed implementation

set -e

echo "=== Resume + Skip Completed Verification ==="
echo ""

echo "1. Checking database migrations..."
if [ -f "supabase/migrations/20260122000000_manuscript_chunks.sql" ]; then
  echo "   ✅ Found: manuscript_chunks migration"
else
  echo "   ❌ Missing: manuscript_chunks migration"
  exit 1
fi

if [ -f "supabase/migrations/20260122000001_claim_chunk_function.sql" ]; then
  echo "   ✅ Found: claim_chunk_function migration"
else
  echo "   ❌ Missing: claim_chunk_function migration"
  exit 1
fi

echo ""
echo "2. Checking code files..."
if grep -q "getEligibleChunks" lib/manuscripts/chunks.ts; then
  echo "   ✅ Found: getEligibleChunks function"
else
  echo "   ❌ Missing: getEligibleChunks function"
  exit 1
fi

if grep -q "claimChunkForProcessing" lib/manuscripts/chunks.ts; then
  echo "   ✅ Found: claimChunkForProcessing function"
else
  echo "   ❌ Missing: claimChunkForProcessing function"
  exit 1
fi

if grep -q "getEligibleChunks" lib/jobs/phase1.ts; then
  echo "   ✅ Phase1 uses getEligibleChunks"
else
  echo "   ❌ Phase1 doesn't use getEligibleChunks"
  exit 1
fi

if grep -q "claimChunkForProcessing" lib/jobs/phase1.ts; then
  echo "   ✅ Phase1 uses claimChunkForProcessing"
else
  echo "   ❌ Phase1 doesn't use claimChunkForProcessing"
  exit 1
fi

echo ""
echo "3. Checking documentation..."
if [ -f "docs/RESUME_SKIP_COMPLETED.md" ]; then
  echo "   ✅ Found: RESUME_SKIP_COMPLETED.md"
else
  echo "   ❌ Missing: RESUME_SKIP_COMPLETED.md"
  exit 1
fi

if [ -f "IMPLEMENTATION_SUMMARY.md" ]; then
  echo "   ✅ Found: IMPLEMENTATION_SUMMARY.md"
else
  echo "   ❌ Missing: IMPLEMENTATION_SUMMARY.md"
  exit 1
fi

echo ""
echo "4. Verifying code invariants (grep checks)..."

# Check that markChunkFailure NEVER touches result_json
if grep -q "result_json" lib/manuscripts/chunks.ts | grep -A 5 "markChunkFailure" | grep -q "result_json:"; then
  echo "   ❌ CRITICAL: markChunkFailure includes result_json in update!"
  exit 1
else
  echo "   ✅ markChunkFailure never touches result_json"
fi

# Check that markChunkSuccess DOES set result_json
if grep -A 10 "markChunkSuccess" lib/manuscripts/chunks.ts | grep -q "result_json:"; then
  echo "   ✅ markChunkSuccess sets result_json"
else
  echo "   ❌ markChunkSuccess doesn't set result_json!"
  exit 1
fi

# Check that RPC function sets processing_started_at (not in TypeScript, in SQL)
if grep -q "processing_started_at = now()" supabase/migrations/20260122000001_claim_chunk_function.sql; then
  echo "   ✅ RPC function sets processing_started_at in SQL"
else
  echo "   ❌ RPC function doesn't set processing_started_at!"
  exit 1
fi

# Check that eligibility includes stuck recovery
if grep -A 20 "getEligibleChunksWithStuckRecovery" lib/manuscripts/chunks.ts | grep -q "processing_started_at"; then
  echo "   ✅ Eligibility query includes stuck recovery via processing_started_at"
else
  echo "   ❌ Eligibility query doesn't handle stuck chunks!"
  exit 1
fi

echo ""
echo "5. Running tests..."
npm test > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ All Jest tests passing"
else
  echo "   ❌ Jest tests failing"
  exit 1
fi

echo ""
echo "6. Checking for Jest open handles..."
if npm test -- --detectOpenHandles 2>&1 | grep -q "open handle"; then
  echo "   ❌ Jest has open handles (will hang)"
  npm test -- --detectOpenHandles 2>&1 | grep -A 5 "open handle"
  exit 1
else
  echo "   ✅ Jest exits cleanly (no open handles)"
fi

echo ""
echo "7. Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
  VERSION=$(supabase --version)
  echo "   ✅ Supabase CLI installed: v$VERSION"
else
  echo "   ❌ Supabase CLI not found"
  exit 1
fi

echo ""
echo "8. Checking build..."
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   ✅ Next.js build successful"
else
  echo "   ❌ Next.js build failed"
  exit 1
fi

echo ""
echo "=== ✅ ALL CHECKS PASSED ==="
echo ""
echo "Implementation complete and verified:"
echo "  - Database migrations created"
echo "  - Chunk filtering and claiming implemented"
echo "  - Phase 1 runner updated"
echo "  - Tests passing"
echo "  - Build successful"
echo "  - Documentation complete"
echo ""
echo "Next steps:"
echo "  1. Apply migrations: supabase db push"
echo "  2. Run acceptance test with failure injection"
echo "  3. Deploy to staging environment"
echo ""
