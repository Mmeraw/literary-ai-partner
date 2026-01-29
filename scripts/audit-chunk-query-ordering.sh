#!/usr/bin/env bash
# Query Ordering Audit for manuscript_chunks (ENFORCING)
# Exit 1 if any manuscript_chunks retrieval queries lack ORDER BY chunk_index

ROOT="/workspaces/literary-ai-partner"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════════════"
echo "  Query Ordering Audit: manuscript_chunks (ENFORCING)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Simple grep-based audit
TOTAL=0
VIOLATIONS=0

echo "Scanning for manuscript_chunks retrieval queries..."

# Find ALL manuscript_chunks SELECT queries (excluding this audit script)
ALL_QUERIES=$(grep -rn "SELECT.*FROM.*manuscript_chunks\|FROM.*manuscript_chunks" \
  "$ROOT/supabase/migrations" "$ROOT/src" "$ROOT/scripts" 2>/dev/null | \
  grep -v "CREATE\|UPDATE\|INSERT\|DELETE" | \
  grep -v "audit-chunk-query-ordering.sh" || true)

if [ -n "$ALL_QUERIES" ]; then
  TOTAL=$(echo "$ALL_QUERIES" | wc -l)
fi

# Find violations (queries that retrieve chunk data but lack ORDER BY)
VIOLATING_FILES=$(echo "$ALL_QUERIES" | \
  grep -v "COUNT(\*)\|COUNT(1)\|EXISTS\|SELECT 1 FROM" | \
  grep -v "ORDER BY.*chunk_index" || true)

if [ -n "$VIOLATING_FILES" ]; then
  VIOLATIONS=$(echo "$VIOLATING_FILES" | wc -l)
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Audit Results"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Total queries: $TOTAL"
echo "Data retrieval queries: $((TOTAL - VIOLATIONS))"
echo "Violations (missing ORDER BY): $VIOLATIONS"
echo ""

if [ "$VIOLATIONS" -gt 0 ]; then
  echo -e "${RED}❌ AUDIT FAILED: ORDERING VIOLATIONS${NC}"
  echo ""
  echo "Queries that retrieve chunk data MUST use 'ORDER BY chunk_index ASC':"
  echo ""
  echo "$VIOLATING_FILES" | head -20
  echo ""
  if [ "$VIOLATIONS" -gt 20 ]; then
    echo "(Showing first 20 of $VIOLATIONS violations)"
    echo ""
  fi
  echo "Note: COUNT(*), EXISTS, and 'SELECT 1' checks are automatically exempt."
  echo ""
  echo "Fix: Add 'ORDER BY chunk_index ASC' to queries that retrieve chunk content/data."
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ AUDIT PASSED${NC}"
  echo ""
  if [ "$TOTAL" -eq 0 ]; then
    echo "No manuscript_chunks queries found (early development)."
  else
    echo "All chunk data retrieval queries include ORDER BY chunk_index."
    exempt_count=$((TOTAL))
    echo "Note: COUNT/EXISTS checks don't require ordering ($exempt_count total queries)."
  fi
  echo ""
  echo "✅ Chunking query ordering is regression-proof."
  echo ""
  exit 0
fi
